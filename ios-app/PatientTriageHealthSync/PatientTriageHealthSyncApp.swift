import SwiftUI

/// Single-screen-graph app. Dependencies are constructed once here and
/// passed down as plain parameters — matches Android's MainActivity.kt
/// (no DI framework; a two-screen MVP doesn't justify one).
@main
struct PatientTriageHealthSyncApp: App {
    private let tokenStore = TokenStore()
    private let healthKitManager = HealthKitManager()
    private let apiClient: ApiClient
    private let syncManager: SyncManager

    init() {
        let tokenStore = self.tokenStore
        let healthKitManager = self.healthKitManager
        let apiClient = ApiClient(tokenStore: tokenStore)
        self.apiClient = apiClient
        self.syncManager = SyncManager(healthKitManager: healthKitManager, apiClient: apiClient, tokenStore: tokenStore)
    }

    var body: some Scene {
        WindowGroup {
            RootView(
                tokenStore: tokenStore,
                apiClient: apiClient,
                healthKitManager: healthKitManager,
                syncManager: syncManager
            )
        }
    }
}
