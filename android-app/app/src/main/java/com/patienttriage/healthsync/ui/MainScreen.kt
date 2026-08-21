package com.patienttriage.healthsync.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.patienttriage.healthsync.data.ApiClient
import com.patienttriage.healthsync.data.HealthConnectAvailability
import com.patienttriage.healthsync.data.HealthConnectManager
import com.patienttriage.healthsync.data.PROVIDER_ID
import com.patienttriage.healthsync.data.REQUIRED_PERMISSIONS
import com.patienttriage.healthsync.data.SyncManager
import com.patienttriage.healthsync.data.SyncResult
import kotlinx.coroutines.launch

/**
 * Shows Health Connect availability/permission state, a sync trigger, and
 * the current connection status as the backend already sees it (fetched via
 * GET /health-data/connections — the same data the web app's health-data
 * page reads). No polling: state refreshes on screen entry and after each
 * user-initiated action, since this is a manual-sync MVP, not a background
 * service.
 */
@Composable
fun MainScreen(
    healthConnectManager: HealthConnectManager,
    syncManager: SyncManager,
    apiClient: ApiClient,
    lastPermissionResult: Set<String>?,
    onRequestPermissions: (Set<String>) -> Unit,
    onLogout: () -> Unit,
) {
    var hasPermissions by remember { mutableStateOf(false) }
    var lastSyncResult by remember { mutableStateOf<SyncResult?>(null) }
    var syncing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var connectionStatus by remember { mutableStateOf<String?>(null) }
    var isConnected by remember { mutableStateOf(false) }
    var disconnecting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun refreshPermissions() {
        hasPermissions = healthConnectManager.hasAllPermissions()
    }

    suspend fun refreshConnection() {
        try {
            val connections = apiClient.listConnections().connections
            val connection = connections.firstOrNull { it.provider == PROVIDER_ID }
            isConnected = connection?.status == "CONNECTED"
            connectionStatus = connection
                ?.let { "${it.status} · last synced ${it.lastSyncedAt ?: "never"}" }
                ?: "Not connected yet"
        } catch (e: Exception) {
            connectionStatus = null
        }
    }

    LaunchedEffect(Unit) {
        refreshPermissions()
        refreshConnection()
    }

    LaunchedEffect(lastPermissionResult) {
        if (lastPermissionResult != null) refreshPermissions()
    }

    val availability = healthConnectManager.availability()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Top,
    ) {
        Text("Health Connect sync")

        when (availability) {
            is HealthConnectAvailability.NotInstalled ->
                Text("Health Connect isn't installed on this device. Install it from the Play Store, then reopen this app.")
            is HealthConnectAvailability.UpdateRequired ->
                Text("Health Connect needs an update from the Play Store before this app can read data.")
            is HealthConnectAvailability.Available -> {
                if (!hasPermissions) {
                    Text("Grant access to Steps and Heart Rate to start syncing.", modifier = Modifier.padding(top = 8.dp))
                    Button(
                        onClick = { onRequestPermissions(REQUIRED_PERMISSIONS) },
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        Text("Grant permissions")
                    }
                } else {
                    Text("Permissions granted.", modifier = Modifier.padding(top = 8.dp))
                    Button(
                        onClick = {
                            error = null
                            syncing = true
                            scope.launch {
                                try {
                                    lastSyncResult = syncManager.syncNow()
                                    refreshConnection()
                                } catch (e: Exception) {
                                    error = e.message ?: "Sync failed."
                                } finally {
                                    syncing = false
                                }
                            }
                        },
                        enabled = !syncing,
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        if (syncing) CircularProgressIndicator(modifier = Modifier.size(18.dp)) else Text("Sync now")
                    }
                    lastSyncResult?.let {
                        Text(
                            "Read ${it.readingsRead}, ingested ${it.ingested}, skipped ${it.skipped} (already synced).",
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                }
            }
        }

        error?.let { Text(it, modifier = Modifier.padding(top = 8.dp)) }

        Divider(modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp))

        Text("Backend connection")
        Text(connectionStatus ?: "Checking...", modifier = Modifier.padding(top = 4.dp))

        if (isConnected) {
            TextButton(
                onClick = {
                    disconnecting = true
                    scope.launch {
                        try {
                            apiClient.disconnect(PROVIDER_ID)
                            syncManager.resetSyncState()
                            lastSyncResult = null
                            refreshConnection()
                        } catch (e: Exception) {
                            error = e.message ?: "Couldn't disconnect."
                        } finally {
                            disconnecting = false
                        }
                    }
                },
                enabled = !disconnecting,
                modifier = Modifier.padding(top = 8.dp),
            ) {
                Text(if (disconnecting) "Disconnecting…" else "Disconnect Health Connect")
            }
        }

        TextButton(onClick = onLogout, modifier = Modifier.padding(top = 24.dp)) {
            Text("Log out")
        }
    }
}
