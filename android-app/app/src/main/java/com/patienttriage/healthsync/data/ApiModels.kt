package com.patienttriage.healthsync.data

import kotlinx.serialization.Serializable

// Mirrors backend/src/validators/health-data.validator.ts's healthIngestSchema
// exactly — metricType/unit must match backend/src/health/metric-types.ts's
// whitelist, or the server rejects the whole reading. Kept in sync by hand
// since the two projects don't share a schema definition.
@Serializable
data class HealthReading(
    val metricType: String,
    val value: Double,
    val unit: String,
    val recordedAt: String, // ISO-8601, UTC
    val externalId: String,
)

@Serializable
data class IngestRequest(val readings: List<HealthReading>)

@Serializable
data class IngestResponse(
    val connectionId: String,
    val submitted: Int,
    val ingested: Int,
    val skipped: Int,
)

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class LoginUser(val id: String, val role: String)

@Serializable
data class LoginResponse(val user: LoginUser, val token: String)

@Serializable
data class HealthConnection(
    val id: String,
    val provider: String,
    val status: String,
    val lastSyncedAt: String? = null,
)

@Serializable
data class ConnectionsResponse(val connections: List<HealthConnection>)

@Serializable
data class ApiErrorBody(val error: ApiErrorDetail)

@Serializable
data class ApiErrorDetail(val message: String)

/** Thrown for any non-2xx response, carrying the server's own error message
 * (backend/src/middleware/error-handler.ts's { error: { message } } shape)
 * where available, so the UI can show something meaningful instead of a
 * raw HTTP status. */
class ApiException(val statusCode: Int, message: String) : Exception(message)
