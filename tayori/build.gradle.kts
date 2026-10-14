plugins {
    // Android Gradle Plugin のバージョンは app/build.gradle.kts 側で指定している
    // (SDKのない環境で :core だけビルドするとき、AGPをダウンロードしなくて済むように)
    id("org.jetbrains.kotlin.android") version "2.2.21" apply false
    id("org.jetbrains.kotlin.jvm") version "2.2.21" apply false
}
