# Patient Triage — Health Sync (iOS)

The iPhone counterpart to [`android-app/`](../android-app) — reads Steps and
Heart Rate from Apple **HealthKit** and pushes them into the same backend
ingest pipeline the Android app and the web app's Demo provider already use
(`POST /api/health-data/connections/APPLE_HEALTH/ingest`). The backend side
of this (provider registry entry, validation, idempotency, the patient-facing
"Connect" UI) was already built and deployed in an earlier phase of this
project — this app is the missing native half that actually lets that
endpoint receive real data.

## Why there's no `.xcodeproj` checked in

Every other part of this project was written, compiled, tested, and verified
by directly running the toolchain. **This one is different: the environment
this code was written in is Windows, with no macOS and no Xcode — and unlike
Android (where at least the SDK can be installed on Windows), there is no
version of Xcode for any OS but macOS. It is not possible to compile, run,
lint, or even open this project outside of a Mac, under any circumstances.**

Rather than hand-write an Xcode project file (`.pbxproj`) that has never
actually been opened or built — a format that is easy to get subtly wrong and
hard to debug blind — this folder contains only genuine source: Swift files,
`Info.plist`, and an entitlements file. **Setup below has you create the
actual Xcode project in a few clicks and drag these files in.** That takes
about 5 minutes and guarantees you start from a project Xcode itself
generated correctly, rather than one assembled from outside it.

## What it does

Functionally identical to the Android app, mirrored file-for-file:

1. Log in with an existing **patient** account (same credentials as the web
   app and the Android app — `POST /api/auth/login`). Only `PATIENT`-role
   accounts can ingest health data.
2. Grant HealthKit permission for Steps and Heart Rate.
3. Tap **Sync now** to read HealthKit samples since the last successful sync
   (or the last 7 days, on first run) and upload them.
4. Data lands in the same `HealthMetric` table Android/Demo write to, tagged
   `source: APPLE_HEALTH` — shows up wherever the web app already displays
   health metrics (patient timeline, admin/clinical dashboards), no backend
   changes required.

Steps and Heart Rate only, matching the agreed MVP scope — no calories, sleep,
or other metric types yet.

## Requirements

- **A Mac.** There is no way around this — Xcode is macOS-only. If you don't
  have one, this half of the project is blocked until you do (a cloud Mac
  rental like MacStadium/GitHub Actions macOS runners is the only
  workaround, and isn't free — see Cost notes below).
- **Xcode** (15 or newer), free from the Mac App Store.
- **iOS 16+** target device or simulator. A recent Simulator does support
  HealthKit (with sample data you add manually via the Simulator's own
  Health app), but a **physical iPhone** is more reliable and is what you'll
  want for testing with your own real Steps/Heart Rate data.
- **No Apple Developer Program enrollment ($99/year) is required** just to
  build and run this on your own iPhone — Xcode lets you sign with a free
  Apple ID ("Personal Team"). The only catch: an app signed this way expires
  after 7 days and has to be reinstalled from Xcode. Paid enrollment is only
  needed if you later want TestFlight, App Store distribution, or an install
  that doesn't expire weekly. See Phase 14 cost notes in the final report.
- A seeded **patient** account on the backend to log in with.

## Create the Xcode project (one-time)

1. Open Xcode → **File → New → Project**.
2. Choose **iOS → App**, click Next.
3. Product Name: `PatientTriageHealthSync`. Interface: **SwiftUI**. Language:
   **Swift**. Uncheck "Use Core Data" and "Include Tests" (you can add tests
   later if you want them — not required for this MVP).
4. Save it **anywhere outside this repo** the first time (e.g. Desktop) —
   you'll move the generated project into `ios-app/` next, replacing its
   default files with the ones here.
5. In Finder, delete the placeholder files Xcode generated
   (`ContentView.swift`, the default `*App.swift`, `Assets.xcassets` you can
   keep) and copy this repo's `ios-app/PatientTriageHealthSync/` folder's
   contents into the new project's folder, replacing what's there. In Xcode,
   drag the folder structure (`Config/`, `Models/`, `Data/`, `Views/`, the
   two root `.swift`/`.plist`/`.entitlements` files) into the project
   navigator if they don't appear automatically — check "Copy items if
   needed" is **unchecked** (they're already in place) and that they're
   added to the `PatientTriageHealthSync` target.
6. Move the whole generated `.xcodeproj` (and its containing folder) into
   this repo's `ios-app/` directory, so the structure looks like:
   ```
   ios-app/
     PatientTriageHealthSync.xcodeproj
     PatientTriageHealthSync/
       PatientTriageHealthSyncApp.swift
       Info.plist
       PatientTriageHealthSync.entitlements
       Config/AppConfig.swift
       Models/ApiModels.swift
       Data/TokenStore.swift
       Data/ApiClient.swift
       Data/HealthKitManager.swift
       Data/SyncManager.swift
       Views/RootView.swift
       Views/LoginView.swift
       Views/MainView.swift
   ```

## Configure the project

1. **Info.plist**: Select the project → target → **Info** tab. Xcode 15+
   generates `Info.plist` content from this tab by default rather than a
   standalone file. Either:
   - Set the target's **Build Settings → Packaging → Info.plist File** to
     point at this repo's `PatientTriageHealthSync/Info.plist`, **or**
   - Add its one custom key manually in the Info tab: `NSHealthShareUsageDescription`
     with the string already written in the checked-in `Info.plist`.
2. **Entitlements — add the HealthKit capability**: select the target →
   **Signing & Capabilities** → **+ Capability** → **HealthKit**. Xcode
   generates its own `.entitlements` file when you do this — you can either
   let it, or point **Build Settings → Signing → Code Signing Entitlements**
   at the checked-in `PatientTriageHealthSync.entitlements`. Either path
   ends at the same result: `com.apple.developer.healthkit = true`.
3. **Signing**: Signing & Capabilities → **Team** → select your own Apple ID
   (Personal Team is fine, see Requirements above).
4. **Deployment target**: Build Settings → set iOS Deployment Target to
   **16.0** (this code uses Swift concurrency APIs — `async`/`await`,
   `HKHealthStore.requestAuthorization(toShare:read:)`'s async overload —
   that need 15+; 16 gives a safety margin).

## Pointing at the right backend

[`Config/AppConfig.swift`](PatientTriageHealthSync/Config/AppConfig.swift)
switches on Xcode's build configuration, mirroring how Android switches on
build type:

- **Debug** (the default when you hit Run ▶ in Xcode) →
  `http://localhost:4000/api` — the Simulator can reach your Mac's own
  `localhost` directly, no alias needed (unlike the Android emulator's
  `10.0.2.2`).
- **Release** → the production backend URL.

**Testing on a physical iPhone instead of the Simulator:** a real device
cannot reach your Mac's `localhost` at all. Change the Debug case in
`AppConfig.swift` to your Mac's LAN IP instead, e.g.
`http://192.168.1.23:4000/api`, with the backend running locally
(`npm run dev` in `backend/`) and both devices on the same Wi-Fi network.

## Verifying it works

1. Build and run (⌘R) on the Simulator or a real device.
2. If using the Simulator: open its **Health** app first and manually add a
   few Steps and Heart Rate entries (Health app → Browse → Activity/Heart →
   the metric → **Add Data**) — the Simulator has no real sensors, so it
   starts with zero HealthKit data.
3. Launch the app, log in with a seeded patient account.
4. Tap **Grant permissions** → iOS's HealthKit consent sheet appears for
   Steps and Heart Rate → allow both. (Unlike Android, iOS does not tell
   this app afterward whether you actually said yes — see the code comment
   in `MainView.swift`. If sync then returns zero readings, that either means
   there's genuinely no data in the window, or access was denied; check
   **Settings → Health → Data Access & Devices → Patient Triage Health Sync**
   on the device to confirm.)
5. Tap **Sync now** — expect "Read N, ingested M, skipped K."
6. Tap **Sync now** again immediately — expect "ingested 0" (idempotent
   resubmission, by design, not a bug).
7. Confirm the data landed: log into the web app as the same patient and
   check the health-data timeline, or as an admin/clinician, check that
   patient's health-data card. New `APPLE_HEALTH` metric rows should appear.

## Known limitations (by design, for this MVP)

Same list as [`android-app/README.md`](../android-app/README.md) — Steps and
Heart Rate only, manual sync only (no background delivery/HKObserverQuery),
no in-app account creation, no offline retry queue beyond the
already-safe high-water-mark design.

One iOS-specific limitation: HealthKit read-permission status is
intentionally opaque to apps (Apple's privacy design) — this app can never
positively confirm "yes, the user granted read access," only observe
whether syncs return data. This is expected HealthKit behavior, not a bug
in this app.
