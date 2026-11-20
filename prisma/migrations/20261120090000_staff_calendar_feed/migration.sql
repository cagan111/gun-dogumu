CREATE TABLE "StaffCalendarFeed" (
  "staffId" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffCalendarFeed_pkey" PRIMARY KEY ("staffId")
);
CREATE UNIQUE INDEX "StaffCalendarFeed_tokenHash_key" ON "StaffCalendarFeed"("tokenHash");
ALTER TABLE "StaffCalendarFeed" ADD CONSTRAINT "StaffCalendarFeed_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
