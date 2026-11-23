plugins {
    id("com.android.application")
}

android {
    namespace = "com.falakpat3l.anukalpa"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.falakpat3l.anukalpa"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "0.2.1-alpha"
    }
    // The app shows the same web page as the website: the files in ../docs are packed into the APK.
    sourceSets["main"].assets.srcDirs("../docs")
    // Play builds are signed with the upload key from GitHub secrets (UPLOAD_KEYSTORE_B64 and
    // UPLOAD_KEYSTORE_PASSWORD). Without them, for example before the key is set up, the debug key is used.
    val uploadKeystore: String? = System.getenv("UPLOAD_KEYSTORE")
    signingConfigs {
        create("upload") {
            if (uploadKeystore != null) {
                storeFile = file(uploadKeystore)
                storePassword = System.getenv("UPLOAD_KEYSTORE_PASSWORD")
                keyAlias = "upload"
                keyPassword = System.getenv("UPLOAD_KEYSTORE_PASSWORD")
            }
        }
    }
    // Release build: R8 removes unused library code and resources, so the APK stays small.
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName(if (uploadKeystore != null) "upload" else "debug")
        }
    }
    androidResources { localeFilters += "en" } // drop unused library translations
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
