import { IsString, Matches, MaxLength } from "class-validator";

/** Send a friend request by the target's unique @handle. */
export class SendRequestDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_]{3,20}$/, {
    message: "handle must be 3–20 letters, digits, or underscores",
  })
  handle!: string;
}

/** Invite a friend into a room the caller is in, by invite code. */
export class InviteToRoomDto {
  @IsString()
  @MaxLength(12)
  @Matches(/^[A-Za-z0-9]+$/, { message: "invalid room code" })
  code!: string;
}
