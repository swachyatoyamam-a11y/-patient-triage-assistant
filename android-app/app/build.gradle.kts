plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    kotlin("plugin.serialization") version "1.9.24"
}

android {
    namespace = "com.patienttriage.healthsync"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.patienttriage.healthsync"
        minSdk = 28 // Health Connect requires API 26+; 28 keeps the manifest simpler
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        debug {
            // 10.0.2.2 is the Android emulator's alias for the host
            // machine's own localhost. A physical device on the same
            // Wi-Fi network needs the host's real LAN IP instead — see
            // android-app/README.md.
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:4000/api\"")
        }
        release {
            isMinifyEnabled = false
            buildConfigField("String", "API_BASE_URL", "\"https://triage-backend-5r5c.onrender.com/api\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")

    // Compose — BOM pins every androidx.compose.* artifact to a mutually
    // compatible set, so individual libraries below don't declare versions.
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")

    // Health Connect — the on-device health data store this whole app exists to read from.
    implementation("androidx.health.connect:connect-client:1.1.0-alpha07")

    // Networking — plain OkHttp rather than Retrofit; this app only talks
    // to three endpoints, so a small hand-written client is simpler than
    // pulling in Retrofit's converter/adapter machinery for this scope.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    // Encrypted on-device storage for the auth token — Keystore-backed,
    // never plaintext.
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
