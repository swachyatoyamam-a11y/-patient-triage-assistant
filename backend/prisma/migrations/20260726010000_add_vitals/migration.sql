-- CreateTable
CREATE TABLE "Vitals" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "heartRate" INTEGER,
    "bloodPressureSystolic" INTEGER,
    "bloodPressureDiastolic" INTEGER,
    "temperatureCelsius" DOUBLE PRECISION,
    "oxygenSaturation" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vitals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vitals_assessmentId_key" ON "Vitals"("assessmentId");

-- AddForeignKey
ALTER TABLE "Vitals" ADD CONSTRAINT "Vitals_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
