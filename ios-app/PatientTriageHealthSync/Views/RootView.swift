import SwiftUI

/// Two screens, switched on whether a token is already stored — no
/// navigation stack needed for something this small. Mirrors Android's
/// TriageApp.kt exactly.
struct RootView: View {
    let tokenStore: TokenStore
    let apiClient: ApiClient
    let healthKitManager: HealthKitManager
    let syncManager: SyncManager

    @State private var loggedIn: Bool

    init(tokenStore: TokenStore, apiClient: ApiClient, healthKitManager: HealthKitManager, syncManager: SyncManager) {
        self.tokenStore = tokenStore
        self.apiClient = apiClient
        self.healthKitManager = healthKitManager
        self.syncManager = syncManager
        _loggedIn = State(initialValue: tokenStore.token != nil)
    }

    var body: some View {
        if loggedIn {
            MainView(
                healthKitManager: healthKitManager,
                syncManager: syncManager,
                apiClient: apiClient,
                onLogout: {
                    tokenStore.clear()
                    loggedIn = false
                }
            )
        } else {
            LoginView(
                apiClient: apiClient,
                onLoginSuccess: { token in
                    tokenStore.token = token
                    loggedIn = true
                }
            )
        }
    }
}
