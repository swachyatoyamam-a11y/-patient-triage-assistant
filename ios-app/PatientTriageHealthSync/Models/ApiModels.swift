import Foundation

/// One normalized reading pushed to the shared ingest endpoint — mirrors
/// backend/src/validators/health-data.validator.ts's healthReadingSchema
/// field-for-field, and Android's identical ApiModels.kt HealthReading.
struct HealthReading: Codable {
    let metricType: String
    let value: Double
    let unit: String
    /// ISO-8601 UTC, e.g. "2026-08-22T10:15:00Z".
    let recordedAt: String
    /// HealthKit's own per-sample id (HKSample.uuid) — used for idempotent
    /// re-submission via the backend's (patientId, source, externalRecordId)
    /// unique index.
    let externalId: String
}

struct IngestRequest: Codable {
    let readings: [HealthReading]
}

struct IngestResponse: Codable {
    let connectionId: String
    let submitted: Int
    let ingested: Int
    let skipped: Int
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct LoginUser: Codable {
    let id: String
    let role: String
}

struct LoginResponse: Codable {
    let user: LoginUser
    let token: String
}

struct HealthConnection: Codable {
    let id: String
    let provider: String
    let status: String
    let lastSyncedAt: String?
}

struct ConnectionsResponse: Codable {
    let connections: [HealthConnection]
}

struct ApiErrorDetail: Codable {
    let message: String
}

struct ApiErrorBody: Codable {
    let error: ApiErrorDetail
}

struct ApiError: Error, LocalizedError {
    let statusCode: Int
    let message: String

    var errorDescription: String? { message }
}
