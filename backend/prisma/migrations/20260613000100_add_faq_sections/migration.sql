CREATE TABLE IF NOT EXISTS "FaqSection" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FaqSection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Faq" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Faq" ADD COLUMN IF NOT EXISTS "sectionId" INTEGER;

INSERT INTO "FaqSection" ("title", "sortOrder")
SELECT 'ЗАКАЗЫ', 0
WHERE NOT EXISTS (SELECT 1 FROM "FaqSection");

INSERT INTO "FaqSection" ("title", "sortOrder")
SELECT 'ОПЛАТА', 1
WHERE NOT EXISTS (SELECT 1 FROM "FaqSection" WHERE "title" = 'ОПЛАТА');

INSERT INTO "FaqSection" ("title", "sortOrder")
SELECT 'ТОВАРЫ', 2
WHERE NOT EXISTS (SELECT 1 FROM "FaqSection" WHERE "title" = 'ТОВАРЫ');

UPDATE "Faq"
SET "sectionId" = (SELECT "id" FROM "FaqSection" ORDER BY "sortOrder" ASC, "id" ASC LIMIT 1)
WHERE "sectionId" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Faq_sectionId_fkey'
  ) THEN
    ALTER TABLE "Faq"
    ADD CONSTRAINT "Faq_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "FaqSection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
