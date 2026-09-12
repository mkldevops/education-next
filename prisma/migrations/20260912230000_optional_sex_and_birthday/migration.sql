-- Une fiche d'inscription papier ne porte souvent ni le sexe ni la date de naissance : les
-- exiger forçait à inventer une valeur, qui se lisait ensuite comme une donnée réelle.
-- AlterTable
ALTER TABLE "Person" ALTER COLUMN "sex" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "birthday" DROP NOT NULL;
