-- CreateEnum
CREATE TYPE "HealthProvider" AS ENUM ('DEMO', 'FITBIT', 'APPLE_HEALTH');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "HealthConnection" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "provider" "HealthProvider" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "scopes" TEXT[],
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "externalAccountId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "HealthConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthMetric" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "connectionId" TEXT,
    "source" "HealthProvider" NOT NULL,
    "metricType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "HealthMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentHealthSnapshot" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthConnection_patientId_provider_key" ON "HealthConnection"("patientId", "provider");

-- CreateIndex
CREATE INDEX "HealthConnection_patientId_idx" ON "HealthConnection"("patientId");

-- CreateIndex
CREATE INDEX "HealthMetric_patientId_metricType_recordedAt_idx" ON "HealthMetric"("patientId", "metricType", "recordedAt");

-- CreateIndex
CREATE INDEX "HealthMetric_connectionId_idx" ON "HealthMetric"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentHealthSnapshot_assessmentId_key" ON "AssessmentHealthSnapshot"("assessmentId");

-- AddForeignKey
ALTER TABLE "HealthConnection" ADD CONSTRAINT "HealthConnection_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthMetric" ADD CONSTRAINT "HealthMetric_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthMetric" ADD CONSTRAINT "HealthMetric_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "HealthConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentHealthSnapshot" ADD CONSTRAINT "AssessmentHealthSnapshot_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
