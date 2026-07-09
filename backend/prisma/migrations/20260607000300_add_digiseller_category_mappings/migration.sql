CREATE TABLE IF NOT EXISTS "DigisellerCategoryMapping" (
    "id" SERIAL NOT NULL,
    "digisellerCategoryId" TEXT NOT NULL,
    "digisellerCategoryName" TEXT,
    "categoryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigisellerCategoryMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DigisellerCategoryMapping_digisellerCategoryId_key" ON "DigisellerCategoryMapping"("digisellerCategoryId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DigisellerCategoryMapping_categoryId_fkey'
    ) THEN
        ALTER TABLE "DigisellerCategoryMapping"
        ADD CONSTRAINT "DigisellerCategoryMapping_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;