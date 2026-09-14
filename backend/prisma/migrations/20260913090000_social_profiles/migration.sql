-- AlterTable: Phase 4 profile fields on the account.
ALTER TABLE "User" ADD COLUMN     "handle" TEXT,
ADD COLUMN     "avatar" TEXT;

-- CreateIndex: handles are a unique public identity (case handled in app: stored lowercase).
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");
