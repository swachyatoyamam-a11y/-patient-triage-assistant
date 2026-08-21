package com.patienttriage.healthsync

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.patienttriage.healthsync.data.ApiClient
import com.patienttriage.healthsync.data.HealthConnectManager
import com.patienttriage.healthsync.data.SyncManager
import com.patienttriage.healthsync.data.TokenStore
import com.patienttriage.healthsync.ui.TriageApp

/**
 * Single-Activity app. Dependencies are constructed once here and passed
 * down as plain parameters — a full DI framework (Hilt) would be more
 * ceremony than a two-screen MVP justifies.
 *
 * The Health Connect permission launcher specifically has to be registered
 * as an Activity-level field (ActivityResultContracts requires registration
 * before the Activity reaches STARTED — it can't live inside a Composable).
 * `permissionResult` is a plain mutableStateOf so TriageApp can react to
 * the outcome via normal Compose recomposition.
 */
class MainActivity : ComponentActivity() {
    private val tokenStore by lazy { TokenStore(applicationContext) }
    private val apiClient by lazy { ApiClient(tokenStore) }
    private val healthConnectManager by lazy { HealthConnectManager(applicationContext) }
    private val syncManager by lazy { SyncManager(healthConnectManager, apiClient, tokenStore) }

    private var permissionResult by mutableStateOf<Set<String>?>(null)

    private val permissionLauncher = registerForActivityResult(
        healthConnectManager.permissionRequestContract(),
    ) { granted -> permissionResult = granted }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme {
                Surface {
                    TriageApp(
                        tokenStore = tokenStore,
                        apiClient = apiClient,
                        healthConnectManager = healthConnectManager,
                        syncManager = syncManager,
                        lastPermissionResult = permissionResult,
                        onRequestPermissions = { permissionLauncher.launch(it) },
                    )
                }
            }
        }
    }
}
