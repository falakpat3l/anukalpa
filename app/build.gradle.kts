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
        versionCode = 2
        versionName = "0.2.0-alpha"
        resourceConfigurations += "en" // drop unused library translations
    }
    // The app shows the same web page as the website: the files in ../docs are packed into the APK.
    sourceSets["main"].assets.srcDirs("../docs")
    // Release build: R8 removes unused library code and resources, so the APK stays small.
    // Test builds are signed with the debug key (no secrets needed); Play Store builds will need a real key.
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName("debug")
        }
    }
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
