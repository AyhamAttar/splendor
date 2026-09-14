-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "hostGuestId" TEXT,
ADD COLUMN     "maxPlayers" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "RoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomMember_roomId_idx" ON "RoomMember"("roomId");

-- CreateIndex
CREATE INDEX "RoomMember_userId_idx" ON "RoomMember"("userId");

-- CreateIndex
CREATE INDEX "RoomMember_guestId_idx" ON "RoomMember"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_seatIndex_key" ON "RoomMember"("roomId", "seatIndex");

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE INDEX "Room_updatedAt_idx" ON "Room"("updatedAt");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostGuestId_fkey" FOREIGN KEY ("hostGuestId") REFERENCES "GuestIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
