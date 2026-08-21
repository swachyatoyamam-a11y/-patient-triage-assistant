package com.patienttriage.healthsync.data

import com.patienttriage.healthsync.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Base URL for the existing backend — same API the web app calls, reusing
 * its auth and the already-live health-data ingest endpoint (see
 * backend/src/routes/health-data.routes.ts). Set per build type in
 * app/build.gradle.kts: debug builds point at the local dev backend via
 * 10.0.2.2 (the emulator's alias for the host machine's localhost), release
 * builds point at production. A physical device on the same Wi-Fi network
 * needs the host's LAN IP instead of 10.0.2.2 — see android-app/README.md.
 */
val API_BASE_URL: String = BuildConfig.API_BASE_URL

private val json = Json { ignoreUnknownKeys = true }
private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

/**
 * Thin wrapper over OkHttp for the three calls this app needs. Not a full
 * REST client library on purpose — Retrofit's converter/adapter machinery
 * would be more ceremony than three endpoints justify.
 */
class ApiClient(private val tokenStore: TokenStore) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun login(email: String, password: String): LoginResponse {
        val body = json.encodeToString(LoginRequest(email, password)).toRequestBody(JSON_MEDIA_TYPE)
        val request = Request.Builder()
            .url("$API_BASE_URL/auth/login")
            .post(body)
            .build()
        return execute(request, requiresAuth = false)
    }

    suspend fun ingest(provider: String, readings: List<HealthReading>): IngestResponse {
        val body = json.encodeToString(IngestRequest(readings)).toRequestBody(JSON_MEDIA_TYPE)
        val request = Request.Builder()
            .url("$API_BASE_URL/health-data/connections/$provider/ingest")
            .post(body)
            .build()
        return execute(request, requiresAuth = true)
    }

    suspend fun listConnections(): ConnectionsResponse {
        val request = Request.Builder()
            .url("$API_BASE_URL/health-data/connections")
            .get()
            .build()
        return execute(request, requiresAuth = true)
    }

    suspend fun disconnect(provider: String) {
        val request = Request.Builder()
            .url("$API_BASE_URL/health-data/connections/$provider")
            .delete()
            .build()
        executeNoBody(request)
    }

    private suspend inline fun <reified T> execute(request: Request, requiresAuth: Boolean): T =
        withContext(Dispatchers.IO) {
            val finalRequest = if (requiresAuth) authorize(request) else request
            client.newCall(finalRequest).execute().use { response ->
                val text = response.body?.string().orEmpty()
                if (!response.isSuccessful) throw apiException(response.code, text)
                json.decodeFromString(text)
            }
        }

    private suspend fun executeNoBody(request: Request) = withContext(Dispatchers.IO) {
        client.newCall(authorize(request)).execute().use { response ->
            if (!response.isSuccessful) {
                throw apiException(response.code, response.body?.string().orEmpty())
            }
        }
    }

    private fun authorize(request: Request): Request {
        val token = tokenStore.token ?: throw ApiException(401, "Not logged in")
        return request.newBuilder().addHeader("Authorization", "Bearer $token").build()
    }

    private fun apiException(code: Int, body: String): ApiException {
        val message = runCatching { json.decodeFromString<ApiErrorBody>(body).error.message }
            .getOrNull() ?: "Request failed ($code)"
        return ApiException(code, message)
    }
}
