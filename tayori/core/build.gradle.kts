plugins {
    id("org.jetbrains.kotlin.jvm") version "2.2.21"
}

// Androidアプリからも使うので、バイトコードは Java 17 相当に揃える(JDK 17以上ならどれでもビルド可)
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}

// デモ動画用の連絡先コードを作る(CIのエミュレータ撮影で使う)
tasks.register<JavaExec>("demoContactCode") {
    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("com.zavier.tayori.core.DemoContactKt")
    args(project.findProperty("out")?.toString() ?: "c_code.txt")
}
