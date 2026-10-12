plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.falakpat3l.anukalpa"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.falakpat3l.anukalpa"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-alpha"
    }
    // The app shows the same web page as the website: the files in ../docs are packed into the APK.
    sourceSets["main"].assets.srcDirs("../docs")
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
