import Foundation

/// Thin wrapper over URLSession for the four calls this app needs — the
/// iOS mirror of Android's ApiClient.kt. Not a networking library on
/// purpose, same reasoning as the Android side: four endpoints don't
/// justify pulling in Alamofire or similar.
final class ApiClient {
    private let tokenStore: TokenStore
    private let session: URLSession

    init(tokenStore: TokenStore) {
        self.tokenStore = tokenStore
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 30
        self.session = URLSession(configuration: config)
    }

    private var decoder: JSONDecoder { JSONDecoder() }
    private var encoder: JSONEncoder { JSONEncoder() }

    func login(email: String, password: String) async throws -> LoginResponse {
        var request = URLRequest(url: url("/auth/login"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(LoginRequest(email: email, password: password))
        return try await execute(request, requiresAuth: false)
    }

    func ingest(provider: String, readings: [HealthReading]) async throws -> IngestResponse {
        var request = URLRequest(url: url("/health-data/connections/\(provider)/ingest"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(IngestRequest(readings: readings))
        return try await execute(request, requiresAuth: true)
    }

    func listConnections() async throws -> ConnectionsResponse {
        var request = URLRequest(url: url("/health-data/connections"))
        request.httpMethod = "GET"
        return try await execute(request, requiresAuth: true)
    }

    func disconnect(provider: String) async throws {
        var request = URLRequest(url: url("/health-data/connections/\(provider)"))
        request.httpMethod = "DELETE"
        _ = try await executeNoBody(request)
    }

    private func url(_ path: String) -> URL {
        URL(string: AppConfig.apiBaseURL + path)!
    }

    private func authorize(_ request: URLRequest) throws -> URLRequest {
        guard let token = tokenStore.token else {
            throw ApiError(statusCode: 401, message: "Not logged in")
        }
        var authorized = request
        authorized.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return authorized
    }

    private func execute<T: Decodable>(_ request: URLRequest, requiresAuth: Bool) async throws -> T {
        let finalRequest = requiresAuth ? try authorize(request) : request
        let (data, response) = try await session.data(for: finalRequest)
        guard let http = response as? HTTPURLResponse else {
            throw ApiError(statusCode: 0, message: "No response from server")
        }
        guard (200...299).contains(http.statusCode) else {
            throw apiError(statusCode: http.statusCode, body: data)
        }
        return try decoder.decode(T.self, from: data)
    }

    private func executeNoBody(_ request: URLRequest) async throws -> Void {
        let authorized = try authorize(request)
        let (data, response) = try await session.data(for: authorized)
        guard let http = response as? HTTPURLResponse else {
            throw ApiError(statusCode: 0, message: "No response from server")
        }
        guard (200...299).contains(http.statusCode) else {
            throw apiError(statusCode: http.statusCode, body: data)
        }
    }

    private func apiError(statusCode: Int, body: Data) -> ApiError {
        if let decoded = try? decoder.decode(ApiErrorBody.self, from: body) {
            return ApiError(statusCode: statusCode, message: decoded.error.message)
        }
        return ApiError(statusCode: statusCode, message: "Request failed (\(statusCode))")
    }
}
