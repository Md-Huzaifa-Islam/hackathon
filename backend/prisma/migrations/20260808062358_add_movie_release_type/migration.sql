-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('NOW_SHOWING', 'NEW_RELEASE', 'COMING_SOON');

-- AlterTable
ALTER TABLE "movies" ADD COLUMN     "rating" TEXT,
ADD COLUMN     "releaseDate" TIMESTAMP(3),
ADD COLUMN     "releaseType" "ReleaseType" NOT NULL DEFAULT 'NOW_SHOWING';
