import Foundation

/// Provider id this app pushes readings under — matches the
/// HealthProvider enum value already deployed on the backend
/// (backend/prisma/schema.prisma) and the existing appleHealthProvider
/// registry entry.
let providerId = "APPLE_HEALTH"

/// Matches backend/src/validators/health-data.validator.ts's
/// MAX_READINGS_PER_INGEST, and Android's identical constant.
private let maxReadingsPerRequest = 500

struct SyncResult {
    let readingsRead: Int
    let ingested: Int
    let skipped: Int
}

/// Orchestrates one sync cycle: read from HealthKit since the last
/// high-water mark, POST to the shared ingest endpoint (chunked to the
/// backend's batch cap), and only advance the high-water mark once the
/// network call actually succeeds. Exact mirror of Android's
/// SyncManager.kt — a failed POST must never cause the next sync to skip
/// readings it never actually delivered.
final class SyncManager {
    private let healthKitManager: HealthKitManager
    private let apiClient: ApiClient
    private let tokenStore: TokenStore

    init(healthKitManager: HealthKitManager, apiClient: ApiClient, tokenStore: TokenStore) {
        self.healthKitManager = healthKitManager
        self.apiClient = apiClient
        self.tokenStore = tokenStore
    }

    func syncNow() async throws -> SyncResult {
        let since = tokenStore.lastSyncedAt.flatMap { ISO8601DateFormatter().date(from: $0) }
        let readings = try await healthKitManager.readSince(since)
        if readings.isEmpty {
            return SyncResult(readingsRead: 0, ingested: 0, skipped: 0)
        }

        var ingested = 0
        var skipped = 0
        for chunk in readings.chunked(into: maxReadingsPerRequest) {
            let result = try await apiClient.ingest(provider: providerId, readings: chunk)
            ingested += result.ingested
            skipped += result.skipped
        }

        // Only advance the mark after every chunk has been accepted by the
        // server — if any chunk throws, this line is never reached, and
        // the next sync attempt re-reads (and safely re-submits, via the
        // same externalId idempotency the backend already enforces) from
        // the same starting point.
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        tokenStore.lastSyncedAt = formatter.string(from: Date())

        return SyncResult(readingsRead: readings.count, ingested: ingested, skipped: skipped)
    }

    /// Clears the local high-water mark after a disconnect, so a future
    /// reconnect re-reads from the default lookback window instead of
    /// silently picking up only from wherever the old mark was left.
    func resetSyncState() {
        tokenStore.lastSyncedAt = nil
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
