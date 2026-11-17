plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "de.pablo.duelingbook"
    compileSdk = 35

    defaultConfig {
        applicationId = "de.pablo.duelingbook"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "1.2"
    }

    // Fester Schlüssel, damit neue Versionen als Update installierbar sind
    signingConfigs {
        create("fixed") {
            storeFile = file("duelingbook.keystore")
            storePassword = "duelingbook"
            keyAlias = "duelingbook"
            keyPassword = "duelingbook"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("fixed")
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("fixed")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
