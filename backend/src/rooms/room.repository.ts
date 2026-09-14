import { Injectable } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { Prisma, type Room, type RoomMember, type RoomStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedIdentity } from "../auth/types";

/** A room with its seats, ordered by seatIndex — the shape the service works on. */
export type RoomWithMembers = Room & { members: RoomMember[] };

// Invite-code alphabet: uppercase, no 0/O/1/I/L to avoid ambiguity when typed.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** Raised when a seat is taken concurrently (unique [roomId, seatIndex]) so the
 *  service can recompute a free seat and retry. */
export const SEAT_TAKEN = "SEAT_TAKEN";

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

/**
 * Data access for lobby rooms and their seats. Pure persistence — all business
 * rules (who may start, readiness, seat limits) live in RoomsService.
 */
@Injectable()
export class RoomRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** A short, unambiguous, unused invite code. */
  async newCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
      }
      const existing = await this.prisma.room.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new Error("Could not allocate a unique room code.");
  }

  /** Create a room with the host occupying seat 0 (ready by default). */
  async createRoom(
    code: string,
    host: AuthenticatedIdentity,
    name: string,
    maxPlayers: number,
  ): Promise<RoomWithMembers> {
    return this.prisma.room.create({
      data: {
        code,
        maxPlayers,
        hostUserId: host.userId ?? null,
        hostGuestId: host.guestId ?? null,
        members: {
          create: {
            seatIndex: 0,
            name,
            userId: host.userId ?? null,
            guestId: host.guestId ?? null,
            isHost: true,
            ready: true,
          },
        },
      },
      include: { members: { orderBy: { seatIndex: "asc" } } },
    });
  }

  async findByCode(code: string): Promise<RoomWithMembers | null> {
    return this.prisma.room.findUnique({
      where: { code },
      include: { members: { orderBy: { seatIndex: "asc" } } },
    });
  }

  /** Add a member at a specific seat. Throws SEAT_TAKEN on a seat-unique clash. */
  async addMember(
    roomId: string,
    seatIndex: number,
    identity: AuthenticatedIdentity,
    name: string,
  ): Promise<void> {
    try {
      await this.prisma.roomMember.create({
        data: {
          roomId,
          seatIndex,
          name,
          userId: identity.userId ?? null,
          guestId: identity.guestId ?? null,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new Error(SEAT_TAKEN);
      throw e;
    }
  }

  async removeMember(memberId: string): Promise<void> {
    await this.prisma.roomMember.delete({ where: { id: memberId } }).catch(() => undefined);
  }

  async setReady(memberId: string, ready: boolean): Promise<void> {
    await this.prisma.roomMember.update({
      where: { id: memberId },
      data: { ready },
    });
  }

  async setMaxPlayers(roomId: string, maxPlayers: number): Promise<void> {
    await this.prisma.room.update({
      where: { id: roomId },
      data: { maxPlayers },
    });
  }

  /** Promote a member to host: mark the member and move the host fields on Room. */
  async promoteHost(
    roomId: string,
    member: RoomMember,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.roomMember.update({
        where: { id: member.id },
        data: { isHost: true, ready: true },
      }),
      this.prisma.room.update({
        where: { id: roomId },
        data: {
          hostUserId: member.userId,
          hostGuestId: member.guestId,
        },
      }),
    ]);
  }

  async setStatus(roomId: string, status: RoomStatus): Promise<void> {
    await this.prisma.room.update({ where: { id: roomId }, data: { status } });
  }

  async transitionToGame(roomId: string, gameId: string): Promise<void> {
    await this.prisma.room.update({
      where: { id: roomId },
      data: { status: "IN_GAME", gameId },
    });
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.prisma.room.delete({ where: { id: roomId } }).catch(() => undefined);
  }

  /** Delete rooms idle since before `cutoff` (sweeper). Returns how many. */
  async deleteIdle(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.room.deleteMany({
      where: { updatedAt: { lt: cutoff } },
    });
    return count;
  }
}
