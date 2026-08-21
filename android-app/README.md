# Patient Triage — Health Sync (Android)

A small companion app that reads Steps and Heart Rate from Android's **Health
Connect** and pushes them into the existing backend's shared health-data
ingest pipeline (`POST /api/health-data/connections/GOOGLE_HEALTH_CONNECT/ingest`),
the same endpoint and idempotency design already used in production for the
Demo provider.

This app was written without a local Android toolchain (no Android
Studio/SDK/Gradle/emulator in the dev environment it was authored in), so it
has **not been compiled or run yet**. Everything below is what's needed to
build, run, and verify it.

## What it does

1. Log in with an existing **patient** account (same credentials as the web
   app — `POST /api/auth/login`). Only `PATIENT`-role accounts can ingest
   health data; other roles will authenticate but get a 403 on sync.
2. Grant Health Connect permission for Steps and Heart Rate.
3. Tap **Sync now** to read Health Connect data since the last successful
   sync (or the last 7 days, on first run) and upload it.
4. The synced data shows up wherever the web app already displays
   `GOOGLE_HEALTH_CONNECT` health metrics (patient health-data timeline,
   admin/clinical dashboards) — no backend changes were needed for this app,
   since the shared ingest endpoint was already built and deployed.

Calories and other metric types are intentionally out of scope for this
first version — steps and heart rate only, per the agreed MVP scope.

## Requirements

- **Android Studio** (Koala/2024.1 or newer recommended — anything that
  bundles Gradle 8.5+/AGP 8.5+ compatible tooling).
- A test device or emulator running **Android 9 (API 28) or newer**, with
  the **Health Connect** app installed:
  - Physical device: install "Health Connect" from the Play Store.
  - Emulator: use a system image with Play Store (the emulator's own
    Health Connect isn't preinstalled on all images — a Play Store image
    lets you install it like a real device). Health Connect requires API 26+;
    this app targets 28+.
- A seeded **patient** account on the backend to log in with (any existing
  patient works — the same credentials used on the web app at
  `https://triage-app.vercel.app` or wherever the frontend is deployed).

## Build & run

1. Open the `android-app/` folder (not the repo root) directly in Android
   Studio: **File → Open**, select `android-app/`.
2. Let Gradle sync. First sync will download the Android Gradle Plugin,
   Kotlin, Compose, and the dependencies listed in `app/build.gradle.kts` —
   needs network access.
3. Select a device/emulator with Health Connect available (see above).
4. Run the `app` configuration (green ▶ in Android Studio, or
   `./gradlew installDebug` from `android-app/` once you have a device
   attached — use `gradlew.bat` on Windows PowerShell).

There is no `gradlew`/`gradlew.bat` wrapper script checked into this repo
yet — Android Studio will offer to generate one on first open ("Gradle
wrapper not found" prompt), or you can run `gradle wrapper` yourself if you
have a system Gradle install. Either way is fine; just don't skip it, since
a checked-in wrapper is what makes builds reproducible on another machine.

## Pointing at the right backend

`API_BASE_URL` is now set per **build type**, in
[`app/build.gradle.kts`](app/build.gradle.kts), via `buildConfigField`, and read
in [`ApiClient.kt`](app/src/main/java/com/patienttriage/healthsync/data/ApiClient.kt)
from the generated `BuildConfig.API_BASE_URL` — no source edit needed to
switch environments, just pick the build variant:

- **Debug build** (the default "Run ▶" variant in Android Studio) →
  `http://10.0.2.2:4000/api` — the Android emulator's alias for the host
  machine's own `localhost`. This is what you get automatically when
  testing against a locally running backend (`npm run dev` in `backend/`).
- **Release build** → `https://triage-backend-5r5c.onrender.com/api` —
  production.

**Testing on a physical device instead of the emulator:** `10.0.2.2` only
works on the emulator. For a real phone on the same Wi-Fi network as your
laptop, change the debug `buildConfigField` in `app/build.gradle.kts` to
your machine's LAN IP instead, e.g. `http://192.168.1.23:4000/api`, and
make sure the backend's `CORS_ORIGIN`/firewall don't block LAN connections
(the backend itself has no CORS restriction on non-browser clients like
this app, since OkHttp doesn't send an `Origin` header — only a browser
enforces CORS).

Never edit the release `buildConfigField` to point at anything other than
production without a very good reason — that's the variant used for any
build handed to someone else.

## Verifying it works

1. Build and install on a device/emulator with Health Connect set up and
   some Steps/Heart Rate data in it (Health Connect's own app lets you add
   test data manually under its "Data and access" screens if the device has
   none yet — Google Fit or a fitness tracker app writing into Health
   Connect also works).
2. Launch the app, log in with a seeded patient account.
3. Tap **Grant permissions**, accept Health Connect's consent screen for
   Steps and Heart Rate.
4. Tap **Sync now**. You should see a result like "Read N, ingested M,
   skipped K (already synced)."
5. Tap **Sync now** again immediately — expect "ingested 0" this time
   (everything already synced), since the same records now fail the
   backend's idempotency check by design, not by bug.
6. Confirm the data landed: log into the web app as the same patient and
   check the health-data timeline, or as an admin/clinician, check that
   patient's health-data card. New `GOOGLE_HEALTH_CONNECT` metric rows
   should appear.

## Known limitations (by design, for this MVP)

- **Steps and heart rate only.** No sleep, calories, blood pressure, SpO2,
  etc. yet — easy to add later by extending `HealthConnectManager.kt`
  (add the record type to `REQUIRED_PERMISSIONS` and a mapping block in
  `readSince()`) since the backend's `metricType` field is already an
  open whitelist, not a fixed enum.
- **Manual sync only**, no background sync/WorkManager job. Data only
  moves when the user opens the app and taps "Sync now."
- **No account creation in-app.** Patients must already have a web
  account; this app only logs in, it doesn't sign up.
- **No offline queue.** If a sync's network call fails partway through a
  batch, nothing is lost (the high-water mark only advances after a full
  success — see `SyncManager.kt`), but the user has to retry manually.
- **iOS/Apple Health is a separate future step**, not started — HealthKit
  has no web API and needs its own native Swift app.
