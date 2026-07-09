CREATE TABLE IF NOT EXISTS "ProductFolder" (
	"id" SERIAL NOT NULL,
	"name" TEXT NOT NULL,
	"sortOrder" INTEGER NOT NULL DEFAULT 0,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "ProductFolder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductFolder_name_key" ON "ProductFolder"("name");

ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "folderId" INTEGER;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'Item_folderId_fkey'
	) THEN
		ALTER TABLE "Item"
			ADD CONSTRAINT "Item_folderId_fkey"
			FOREIGN KEY ("folderId") REFERENCES "ProductFolder"("id")
			ON DELETE SET NULL ON UPDATE CASCADE;
	END IF;
END $$;
