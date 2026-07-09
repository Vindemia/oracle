-- AlterTable
ALTER TABLE "User" ADD COLUMN     "themeId" TEXT NOT NULL DEFAULT 'neutral';

-- DataMigration: les comptes existants avant l'introduction des thèmes (v3-12)
-- restent visuellement inchangés — ils sont migrés vers l'univers mystique
-- "oracle" (l'ancien défaut). Seuls les nouveaux comptes naissent en
-- 'neutral' (valeur DEFAULT de la colonne, appliquée aux futurs INSERT).
UPDATE "User" SET "themeId" = 'oracle';
