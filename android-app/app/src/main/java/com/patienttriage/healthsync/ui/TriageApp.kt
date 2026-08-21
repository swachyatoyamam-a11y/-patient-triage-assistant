package com.patienttriage.healthsync.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.patienttriage.healthsync.data.ApiClient
import com.patienttriage.healthsync.data.HealthConnectManager
import com.patienttriage.healthsync.data.SyncManager
import com.patienttriage.healthsync.data.TokenStore

/**
 * Two screens, switched on whether a token is already stored — no
 * navigation-compose graph needed for something this small.
 */
@Composable
fun TriageApp(
    tokenStore: TokenStore,
    apiClient: ApiClient,
    healthConnectManager: HealthConnectManager,
    syncManager: SyncManager,
    lastPermissionResult: Set<String>?,
    onRequestPermissions: (Set<String>) -> Unit,
) {
    var loggedIn by remember { mutableStateOf(tokenStore.token != null) }

    if (loggedIn) {
        MainScreen(
            healthConnectManager = healthConnectManager,
            syncManager = syncManager,
            apiClient = apiClient,
            lastPermissionResult = lastPermissionResult,
            onRequestPermissions = onRequestPermissions,
            onLogout = {
                tokenStore.clear()
                loggedIn = false
            },
        )
    } else {
        LoginScreen(
            apiClient = apiClient,
            onLoginSuccess = { token ->
                tokenStore.token = token
                loggedIn = true
            },
        )
    }
}
