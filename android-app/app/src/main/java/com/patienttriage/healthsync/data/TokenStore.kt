package com.patienttriage.healthsync.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Keystore-backed encrypted storage for the JWT and the sync high-water
 * mark. Never store the token in plain SharedPreferences/DataStore — this
 * is the same "never plaintext" requirement the backend applies to OAuth
 * tokens (see backend/src/utils/crypto.ts), just on the device side.
 */
class TokenStore(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "health_sync_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    /** Last successful sync time, ISO-8601 UTC. Null means "never synced —
     * read a default lookback window instead." Only advanced after a sync
     * actually succeeds, so a failed POST never silently drops readings. */
    var lastSyncedAt: String?
        get() = prefs.getString(KEY_LAST_SYNCED, null)
        set(value) = prefs.edit().putString(KEY_LAST_SYNCED, value).apply()

    fun clear() = prefs.edit().clear().apply()

    private companion object {
        const val KEY_TOKEN = "auth_token"
        const val KEY_LAST_SYNCED = "last_synced_at"
    }
}
