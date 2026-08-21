package com.patienttriage.healthsync.data

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.format.DateTimeFormatter

/** The two record types this MVP reads — deliberately narrow scope, see
 * the architecture plan for why steps/heart rate first. */
val REQUIRED_PERMISSIONS = setOf(
    HealthPermission.getReadPermission(StepsRecord::class),
    HealthPermission.getReadPermission(HeartRateRecord::class),
)

/** First-ever sync has no high-water mark — look back this far rather
 * than pulling a patient's entire Health Connect history at once. */
private const val DEFAULT_LOOKBACK_DAYS = 7L

sealed class HealthConnectAvailability {
    data object Available : HealthConnectAvailability()
    data object NotInstalled : HealthConnectAvailability()
    data object UpdateRequired : HealthConnectAvailability()
}

class HealthConnectManager(private val context: Context) {
    private val client: HealthConnectClient? by lazy {
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
            HealthConnectClient.getOrCreate(context)
        } else null
    }

    fun availability(): HealthConnectAvailability = when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> HealthConnectAvailability.Available
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> HealthConnectAvailability.UpdateRequired
        else -> HealthConnectAvailability.NotInstalled
    }

    fun permissionRequestContract() = PermissionController.createRequestPermissionResultContract()

    suspend fun hasAllPermissions(): Boolean {
        val granted = client?.permissionController?.getGrantedPermissions() ?: return false
        return granted.containsAll(REQUIRED_PERMISSIONS)
    }

    /**
     * Reads every Steps/HeartRate record since [since] (or the default
     * lookback window on first sync) and normalizes them into the exact
     * shape the backend's ingest endpoint validates against — see
     * backend/src/validators/health-data.validator.ts. A HeartRateRecord
     * can contain many instantaneous samples spanning a time range; each
     * sample becomes its own reading, since the backend schema is one
     * value + one timestamp per reading, not a range.
     */
    suspend fun readSince(since: Instant?): List<HealthReading> {
        val healthConnect = client ?: return emptyList()
        val start = since ?: Instant.now().minusSeconds(DEFAULT_LOOKBACK_DAYS * 24 * 3600)
        val filter = TimeRangeFilter.after(start)
        val formatter = DateTimeFormatter.ISO_INSTANT

        val steps = healthConnect.readRecords(ReadRecordsRequest(StepsRecord::class, filter)).records
        val stepsReadings = steps.map { record ->
            HealthReading(
                metricType = "STEPS",
                value = record.count.toDouble(),
                unit = "count",
                recordedAt = formatter.format(record.endTime),
                externalId = "hc-${record.metadata.id}",
            )
        }

        val heartRate = healthConnect.readRecords(ReadRecordsRequest(HeartRateRecord::class, filter)).records
        val heartRateReadings = heartRate.flatMap { record ->
            record.samples.map { sample ->
                HealthReading(
                    metricType = "HEART_RATE",
                    value = sample.beatsPerMinute.toDouble(),
                    unit = "bpm",
                    recordedAt = formatter.format(sample.time),
                    // Composite id: Health Connect assigns the UUID per
                    // record, not per sample, and one record can hold many
                    // samples — without the sample time in the id, every
                    // sample in the same record would collide on the
                    // backend's idempotency key and only the first would
                    // ever be stored.
                    externalId = "hc-${record.metadata.id}-${sample.time.epochSecond}",
                )
            }
        }

        return stepsReadings + heartRateReadings
    }
}
