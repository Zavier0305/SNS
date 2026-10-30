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
        versionCode = 3
        versionName = "0.2.1"
    }

    signingConfigs {
        // 実験版の署名鍵(誰でも見られる練習用の鍵)。毎回同じ鍵なので「上書きインストール」できる。
        // 鍵が公開されているので、他人もこの鍵で署名したアプリを作れてしまう。
        // そのため実験版は applicationId を「.exp」付きの別アプリにして、公開版を上書きできないようにしている。
        getByName("debug") {
            storeFile = file("tayori-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        // 公開版の署名鍵は、リポジトリに入れず、環境変数で渡す(本人だけが持つ)。
        // TAYORI_RELEASE_STORE_FILE / _STORE_PASSWORD / _KEY_ALIAS / _KEY_PASSWORD
        System.getenv("TAYORI_RELEASE_STORE_FILE")?.let { path ->
            create("release") {
                storeFile = file(path)
                storePassword = System.getenv("TAYORI_RELEASE_STORE_PASSWORD")
                keyAlias = System.getenv("TAYORI_RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("TAYORI_RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".exp"
            versionNameSuffix = "-exp"
        }
        release {
            isMinifyEnabled = false
            // 環境変数で鍵が渡されたときだけ署名する(渡されなければ未署名のまま=配布できない)
            signingConfig = signingConfigs.findByName("release")
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
    // 連絡先コードをQRコードの画像にするため(画像を作るだけで、カメラやネットは使わない)
    implementation("com.google.zxing:core:3.5.3")
}
