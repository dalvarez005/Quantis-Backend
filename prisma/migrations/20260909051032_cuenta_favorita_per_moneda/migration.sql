-- AlterTable
ALTER TABLE "cuentas" ADD COLUMN     "esFavorita" BOOLEAN NOT NULL DEFAULT false;

-- Preserva la preferencia existente: la cuenta que era cuentaDefaultId de un
-- usuario pasa a ser su cuenta favorita para esa moneda.
UPDATE "cuentas" c
SET "esFavorita" = true
FROM "users" u
WHERE u."cuentaDefaultId" = c.id;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "cuentaDefaultId";
