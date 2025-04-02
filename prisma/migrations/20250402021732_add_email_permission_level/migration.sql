-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailPermissionLevel" TEXT NOT NULL DEFAULT 'read-only';
