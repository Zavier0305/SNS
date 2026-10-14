pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "tayori"

// 中継ロジック(Androidに依存しない純Kotlin)。PCだけでテストできる。
include(":core")

// Androidアプリ本体。Android SDK がある環境(Android Studio など)でだけ読み込む。
// SDK のない環境(CI・クラウド)でも `./gradlew :core:test` が動くようにするため。
val localProps = java.util.Properties().apply {
    val f = file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val hasAndroidSdk = localProps.getProperty("sdk.dir") != null ||
    System.getenv("ANDROID_HOME") != null ||
    System.getenv("ANDROID_SDK_ROOT") != null
if (hasAndroidSdk) {
    include(":app")
} else {
    logger.lifecycle("Android SDK が見つからないため :app は読み込みません(:core のみ)")
}
