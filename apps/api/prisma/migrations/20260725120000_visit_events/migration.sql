CREATE TABLE "visit_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visit_events_createdAt_idx" ON "visit_events"("createdAt");
CREATE INDEX "visit_events_country_region_city_idx" ON "visit_events"("country", "region", "city");
CREATE INDEX "visit_events_userId_createdAt_idx" ON "visit_events"("userId", "createdAt");

ALTER TABLE "visit_events" ADD CONSTRAINT "visit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
