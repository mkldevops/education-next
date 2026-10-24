-- Un niveau peut désormais mener à plusieurs niveaux : la colonne `Level.nextLevelId` devient
-- une table d'arêtes. Les liens existants sont recopiés avant la suppression de la colonne.

CREATE TABLE "LevelProgression" (
    "schoolId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "nextLevelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LevelProgression_pkey" PRIMARY KEY ("levelId","nextLevelId")
);

CREATE INDEX "LevelProgression_nextLevelId_idx" ON "LevelProgression"("nextLevelId");
CREATE INDEX "LevelProgression_schoolId_idx" ON "LevelProgression"("schoolId");

ALTER TABLE "LevelProgression" ADD CONSTRAINT "LevelProgression_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LevelProgression" ADD CONSTRAINT "LevelProgression_levelId_schoolId_fkey" FOREIGN KEY ("levelId", "schoolId") REFERENCES "Level"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LevelProgression" ADD CONSTRAINT "LevelProgression_nextLevelId_schoolId_fkey" FOREIGN KEY ("nextLevelId", "schoolId") REFERENCES "Level"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "LevelProgression" ("schoolId", "levelId", "nextLevelId")
SELECT "schoolId", "id", "nextLevelId"
FROM "Level"
WHERE "nextLevelId" IS NOT NULL;

ALTER TABLE "Level" DROP CONSTRAINT "Level_nextLevelId_schoolId_fkey";
DROP INDEX "Level_nextLevelId_schoolId_key";
ALTER TABLE "Level" DROP COLUMN "nextLevelId";
