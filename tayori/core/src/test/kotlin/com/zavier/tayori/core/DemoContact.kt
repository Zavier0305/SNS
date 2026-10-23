package com.zavier.tayori.core

import java.io.File

/** デモ動画用: 宛先「C」の連絡先コードを作ってファイルに書き出す(エミュレータで貼り付けるため)。 */
fun main(args: Array<String>) {
    val code = Identity.generate("C").contactCode()
    File(args.firstOrNull() ?: "c_code.txt").writeText(code)
    println(code)
}
