-- Événements de la vie de l'école, pilotés par le réglage d'école `events_enabled`.

CREATE TYPE "EventCategory" AS ENUM ('MEETING', 'TERM_START', 'OUTING', 'HOLIDAY', 'CLOSURE', 'CELEBRATION', 'OTHER');
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'MEMBERS', 'STAFF');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "summary" VARCHAR(280),
    "description" TEXT,
    "category" "EventCategory" NOT NULL,
    "visibility" "EventVisibility" NOT NULL DEFAULT 'MEMBERS',
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" VARCHAR(250),
    "announceDaysBefore" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventImage" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "storageKey" VARCHAR(250) NOT NULL,
    "alt" VARCHAR(250),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Event_id_schoolId_key" ON "Event"("id", "schoolId");
CREATE UNIQUE INDEX "Event_schoolId_slug_key" ON "Event"("schoolId", "slug") WHERE ("isActive" = true);
CREATE INDEX "Event_schoolId_idx" ON "Event"("schoolId");
CREATE INDEX "Event_schoolId_startAt_idx" ON "Event"("schoolId", "startAt");
CREATE INDEX "Event_schoolId_status_visibility_startAt_idx" ON "Event"("schoolId", "status", "visibility", "startAt");

CREATE UNIQUE INDEX "EventImage_id_schoolId_key" ON "EventImage"("id", "schoolId");
CREATE INDEX "EventImage_eventId_idx" ON "EventImage"("eventId");
CREATE INDEX "EventImage_schoolId_idx" ON "EventImage"("schoolId");

ALTER TABLE "Event" ADD CONSTRAINT "Event_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventImage" ADD CONSTRAINT "EventImage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventImage" ADD CONSTRAINT "EventImage_eventId_schoolId_fkey" FOREIGN KEY ("eventId", "schoolId") REFERENCES "Event"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Le réglage doit exister pour être atteignable depuis `/dashboard/config`, qui
-- n'affiche que les lignes présentes. Éteint par défaut : la fonctionnalité est optionnelle.
INSERT INTO "Config" ("id", "schoolId", "name", "value", "valueType", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), s."id", 'events_enabled', 'false', 'BOOLEAN'::"ConfigValueType", true, NOW(), NOW()
FROM "School" s
WHERE NOT EXISTS (
  SELECT 1 FROM "Config" c
  WHERE c."schoolId" = s."id" AND c."name" = 'events_enabled' AND c."isActive" = true
);
