plugins {
    id("com.android.application") version "8.13.0"
    id("org.jetbrains.kotlin.android") version "2.2.21"
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

    // 実験用の固定の署名鍵(公開してよい練習用の鍵)。
    // 毎回同じ鍵で署名するので、新しい版を「上書きインストール」できる(アンインストール不要)。
    signingConfigs {
        getByName("debug") {
            storeFile = file("tayori-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
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
