-- Rôles multiples par appartenance : un compte peut être enseignant et parent dans la même
-- école, et cumule alors les droits des deux. Chaque membre garde son rôle actuel comme
-- unique élément de `roles` : aucun droit ne change au déploiement.
ALTER TABLE "SchoolMember" ADD COLUMN "roles" "SchoolRole"[];

UPDATE "SchoolMember" SET "roles" = ARRAY["role"];

ALTER TABLE "SchoolMember" ALTER COLUMN "roles" SET NOT NULL;

-- Un membre sans rôle n'aurait aucun droit tout en restant listé : il se retire, il ne se vide pas.
ALTER TABLE "SchoolMember" ADD CONSTRAINT "SchoolMember_roles_check"
  CHECK (cardinality("roles") >= 1 AND array_position("roles", NULL) IS NULL);

DROP INDEX "SchoolMember_schoolId_role_idx";

ALTER TABLE "SchoolMember" DROP COLUMN "role";

CREATE INDEX "SchoolMember_schoolId_idx" ON "SchoolMember"("schoolId");
