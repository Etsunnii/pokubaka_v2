ALTER TABLE "Item" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;
UPDATE "Item" SET "isVisible" = false WHERE "digisellerProductId" IS NOT NULL;