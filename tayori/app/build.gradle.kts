plugins {
    id("com.android.application") version "8.13.0"
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.zavier.tayori"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.zavier.tayori"
        // Android 8.0 以上。connectGatt に Handler を渡すAPIなど、BLEの安定動作に必要な機能が揃う版
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-phase1"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(project(":core"))
}
