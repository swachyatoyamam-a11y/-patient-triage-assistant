package com.patienttriage.healthsync.data

import java.time.Instant
import java.time.format.DateTimeFormatter

const val PROVIDER_ID = "GOOGLE_HEALTH_CONNECT"

// Matches backend/src/validators/health-data.validator.ts's MAX_READINGS_PER_INGEST.
private const val MAX_READINGS_PER_REQUEST = 500

data class SyncResult(val readingsRead: Int, val ingested: Int, val skipped: Int)

/**
 * Orchestrates one sync cycle: read from Health Connect since the last
 * high-water mark, POST to the shared ingest endpoint (chunked to the
 * backend's batch cap), and only advance the high-water mark once the
 * network call actually succeeds — a failed POST must never cause the next
 * sync to skip the readings it never actually delivered.
 */
class SyncManager(
    private val healthConnectManager: HealthConnectManager,
    private val apiClient: ApiClient,
    private val tokenStore: TokenStore,
) {
    suspend fun syncNow(): SyncResult {
        val since = tokenStore.lastSyncedAt?.let { Instant.parse(it) }
        val readings = healthConnectManager.readSince(since)
        if (readings.isEmpty()) return SyncResult(0, 0, 0)

        var ingested = 0
        var skipped = 0
        for (chunk in readings.chunked(MAX_READINGS_PER_REQUEST)) {
            val result = apiClient.ingest(PROVIDER_ID, chunk)
            ingested += result.ingested
            skipped += result.skipped
        }

        // Only advance the mark after every chunk has been accepted by the
        // server — if any chunk throws, this line is never reached, and
        // the next sync attempt re-reads (and safely re-submits, via the
        // same externalId idempotency the backend already enforces) from
        // the same starting point.
        tokenStore.lastSyncedAt = DateTimeFormatter.ISO_INSTANT.format(Instant.now())

        return SyncResult(readings.size, ingested, skipped)
    }

    /**
     * Clears the local high-water mark after a disconnect, so a future
     * reconnect re-reads from the default lookback window instead of
     * silently picking up only from wherever the old mark was left — the
     * backend connection row itself is the source of truth for "connected
     * or not," this just keeps the client's notion of sync progress
     * consistent with it.
     */
    fun resetSyncState() {
        tokenStore.lastSyncedAt = null
    }
}
