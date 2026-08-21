import Foundation

/// Base URL for the existing backend — same API the web app and the
/// Android companion app call, reusing auth and the shared health-data
/// ingest endpoint (see backend/src/routes/health-data.routes.ts).
///
/// Switched by build configuration, same idea as Android's per-build-type
/// buildConfigField in app/build.gradle.kts:
///   - DEBUG builds (the default when running from Xcode on the simulator
///     or a device) point at a local dev backend.
///   - Release builds point at production.
///
/// The simulator can reach the Mac's own `localhost` directly (unlike the
/// Android emulator, which needs the 10.0.2.2 alias) — so DEBUG here is
/// just "http://localhost:4000/api". A **physical iPhone** cannot reach
/// your Mac's localhost at all; point at your Mac's LAN IP instead (e.g.
/// "http://192.168.1.23:4000/api") — see ios-app/README.md.
enum AppConfig {
    static let apiBaseURL: String = {
        #if DEBUG
        return "http://localhost:4000/api"
        #else
        return "https://triage-backend-5r5c.onrender.com/api"
        #endif
    }()
}
