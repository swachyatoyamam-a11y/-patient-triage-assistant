-- AlterEnum
ALTER TYPE "HealthProvider" ADD VALUE 'GOOGLE_HEALTH_CONNECT';

-- AlterTable
ALTER TABLE "HealthMetric" ADD COLUMN     "externalRecordId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HealthMetric_patientId_source_externalRecordId_key" ON "HealthMetric"("patientId", "source", "externalRecordId");
