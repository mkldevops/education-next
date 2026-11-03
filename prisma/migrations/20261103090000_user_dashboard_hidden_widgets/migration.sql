-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dashboardHiddenWidgets" TEXT[] DEFAULT ARRAY[]::TEXT[];
