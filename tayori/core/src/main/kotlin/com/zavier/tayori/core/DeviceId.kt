package com.zavier.tayori.core

import kotlin.random.Random

/**
 * 端末ID。実験では "A" "B" "C" のように手で付け直せるようにする。
 *
 * BLEの広告(スキャン応答)に載せるため、ASCII英数字と - _ の1〜8文字に制限している。
 * (広告パケットは最大31バイトしかなく、128bitのサービスUUIDで18バイト使うため)
 */
object DeviceId {
    const val MAX_LENGTH = 8
    private val PATTERN = Regex("^[A-Za-z0-9_-]{1,$MAX_LENGTH}$")
    private const val CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

    fun isValid(id: String): Boolean = PATTERN.matches(id)

    fun random(random: Random = Random.Default): String =
        (1..4).map { CHARS[random.nextInt(CHARS.length)] }.joinToString("")
}
