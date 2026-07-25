CREATE TABLE "admin_report_templates" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_report_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_report_templates_ownerId_updatedAt_idx" ON "admin_report_templates"("ownerId", "updatedAt");

ALTER TABLE "admin_report_templates" ADD CONSTRAINT "admin_report_templates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
