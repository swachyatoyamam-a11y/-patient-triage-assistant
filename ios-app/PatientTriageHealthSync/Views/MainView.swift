import SwiftUI

/// Shows HealthKit availability/permission state, a sync trigger, and the
/// current connection status as the backend already sees it (fetched via
/// GET /health-data/connections — the same data the web app's health-data
/// page and the Android companion app read). No background sync: state
/// refreshes on screen entry and after each user-initiated action, since
/// this is a manual-sync MVP, matching Android exactly.
struct MainView: View {
    let healthKitManager: HealthKitManager
    let syncManager: SyncManager
    let apiClient: ApiClient
    let onLogout: () -> Void

    /// HealthKit never reports whether read access was actually granted or
    /// denied (Apple's privacy-by-design choice — unlike Health Connect's
    /// introspectable getGrantedPermissions). This flag only tracks
    /// whether the user has gone through the request prompt at least once
    /// in this app; it is not proof access was granted. The real signal is
    /// whether a sync afterward actually returns data.
    @AppStorage("hasRequestedHealthKitAuth") private var hasRequestedPermissions = false

    @State private var connectionStatus: String?
    @State private var isConnected = false
    @State private var lastSyncResult: SyncResult?
    @State private var syncing = false
    @State private var disconnecting = false
    @State private var requestingAuth = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("HealthKit sync")
                .font(.title2)
                .bold()

            if healthKitManager.availability() == .unavailable {
                Text("HealthKit isn't available on this device.")
            } else if !hasRequestedPermissions {
                Text("Grant access to Steps and Heart Rate to start syncing.")
                Button {
                    requestAuthorization()
                } label: {
                    if requestingAuth {
                        ProgressView()
                    } else {
                        Text("Grant permissions")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(requestingAuth)
            } else {
                Button {
                    syncNow()
                } label: {
                    if syncing {
                        ProgressView()
                    } else {
                        Text("Sync now")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(syncing)

                if let lastSyncResult {
                    Text("Read \(lastSyncResult.readingsRead), ingested \(lastSyncResult.ingested), skipped \(lastSyncResult.skipped) (already synced).")
                        .font(.footnote)
                }
            }

            if let error {
                Text(error).foregroundColor(.red).font(.footnote)
            }

            Divider().padding(.vertical, 8)

            Text("Backend connection").font(.headline)
            Text(connectionStatus ?? "Checking...").font(.footnote)

            if isConnected {
                Button(role: .destructive) {
                    disconnect()
                } label: {
                    Text(disconnecting ? "Disconnecting…" : "Disconnect Apple Health")
                }
                .disabled(disconnecting)
            }

            Spacer()

            Button("Log out", role: .destructive, action: onLogout)
                .padding(.top, 24)
        }
        .padding(24)
        .task {
            await refreshConnection()
        }
    }

    private func requestAuthorization() {
        requestingAuth = true
        error = nil
        Task {
            do {
                try await healthKitManager.requestAuthorization()
                hasRequestedPermissions = true
            } catch {
                self.error = "Couldn't request HealthKit access: \(error.localizedDescription)"
            }
            requestingAuth = false
        }
    }

    private func syncNow() {
        syncing = true
        error = nil
        Task {
            do {
                lastSyncResult = try await syncManager.syncNow()
                await refreshConnection()
            } catch let apiError as ApiError {
                error = apiError.message
            } catch {
                self.error = "Sync failed: \(error.localizedDescription)"
            }
            syncing = false
        }
    }

    private func disconnect() {
        disconnecting = true
        error = nil
        Task {
            do {
                try await apiClient.disconnect(provider: providerId)
                syncManager.resetSyncState()
                lastSyncResult = nil
                await refreshConnection()
            } catch let apiError as ApiError {
                error = apiError.message
            } catch {
                self.error = "Couldn't disconnect: \(error.localizedDescription)"
            }
            disconnecting = false
        }
    }

    @MainActor
    private func refreshConnection() async {
        do {
            let connections = try await apiClient.listConnections().connections
            let connection = connections.first { $0.provider == providerId }
            isConnected = connection?.status == "CONNECTED"
            if let connection {
                connectionStatus = "\(connection.status) · last synced \(connection.lastSyncedAt ?? "never")"
            } else {
                connectionStatus = "Not connected yet"
            }
        } catch {
            connectionStatus = nil
        }
    }
}
