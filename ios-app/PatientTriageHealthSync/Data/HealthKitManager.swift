import Foundation
import HealthKit

/// The two record types this MVP reads — deliberately narrow scope,
/// matching Android's HealthConnectManager.kt exactly (Steps + Heart Rate
/// only; no calories, sleep, etc. yet).
enum HealthKitAvailability {
    case available
    case unavailable
}

/// First-ever sync has no high-water mark — look back this far rather
/// than pulling a patient's entire HealthKit history at once. Matches
/// Android's DEFAULT_LOOKBACK_DAYS.
private let defaultLookbackDays: Double = 7

final class HealthKitManager {
    private let healthStore = HKHealthStore()

    private let stepType = HKObjectType.quantityType(forIdentifier: .stepCount)!
    private let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate)!

    private var readTypes: Set<HKObjectType> { [stepType, heartRateType] }

    func availability() -> HealthKitAvailability {
        HKHealthStore.isHealthDataAvailable() ? .available : .unavailable
    }

    /// Requests read access for Steps and Heart Rate. HealthKit
    /// deliberately never tells an app whether read access was actually
    /// granted or denied (unlike Health Connect's getGrantedPermissions,
    /// which is introspectable) — this is a private-by-design Apple
    /// choice, not a bug. Once the user has gone through this prompt once,
    /// the only way to know if data is really flowing is to attempt a
    /// sync and see what comes back.
    func requestAuthorization() async throws {
        try await healthStore.requestAuthorization(toShare: [], read: readTypes)
    }

    /// Reads every Steps/HeartRate sample since [since] (or the default
    /// lookback window on first sync) and normalizes them into the exact
    /// shape the backend's ingest endpoint validates against — see
    /// backend/src/validators/health-data.validator.ts. Raw samples are
    /// used deliberately rather than HKStatisticsQuery aggregation: a
    /// summed/aggregated value would be this app inventing an
    /// interpretation of the data rather than passing through what
    /// HealthKit actually recorded.
    func readSince(_ since: Date?) async throws -> [HealthReading] {
        guard availability() == .available else { return [] }
        let start = since ?? Date().addingTimeInterval(-defaultLookbackDays * 24 * 3600)

        let steps = try await querySamples(type: stepType, start: start)
        let stepsReadings = steps.compactMap { sample -> HealthReading? in
            guard let quantitySample = sample as? HKQuantitySample else { return nil }
            return HealthReading(
                metricType: "STEPS",
                value: quantitySample.quantity.doubleValue(for: .count()),
                unit: "count",
                recordedAt: isoFormatter.string(from: quantitySample.endDate),
                externalId: "hk-\(quantitySample.uuid.uuidString)"
            )
        }

        let heartRateUnit = HKUnit(from: "count/min")
        let heartRate = try await querySamples(type: heartRateType, start: start)
        let heartRateReadings = heartRate.compactMap { sample -> HealthReading? in
            guard let quantitySample = sample as? HKQuantitySample else { return nil }
            return HealthReading(
                metricType: "HEART_RATE",
                value: quantitySample.quantity.doubleValue(for: heartRateUnit),
                unit: "bpm",
                recordedAt: isoFormatter.string(from: quantitySample.startDate),
                externalId: "hk-\(quantitySample.uuid.uuidString)"
            )
        }

        return stepsReadings + heartRateReadings
    }

    private var isoFormatter: ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }

    private func querySamples(type: HKSampleType, start: Date) async throws -> [HKSample] {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: samples ?? [])
                }
            }
            healthStore.execute(query)
        }
    }
}
