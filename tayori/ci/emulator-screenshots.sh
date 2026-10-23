#!/usr/bin/env bash
# エミュレータにAPKを入れ、画面を操作してスクリーンショットを撮る(GitHub Actions 用)。
# Bluetoothの実通信はエミュレータでは確認できないので、画面と操作の流れの確認が目的。
set -u
PKG=com.zavier.tayori.exp
OUT=ci-out
mkdir -p "$OUT"

shot() { sleep 2; adb exec-out screencap -p > "$OUT/$1.png"; echo "shot: $1"; }
tap() {
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null
  adb pull /sdcard/ui.xml "$OUT/ui.xml" > /dev/null
  local xy
  xy=$(python3 ci/ui_find.py "$OUT/ui.xml" "$1") || { echo "tap failed: $1"; return 1; }
  adb shell input tap $xy
  sleep 1
}
hide_keyboard() { adb shell input keyevent 111; sleep 1; }

adb install -r app/build/outputs/apk/debug/app-debug.apk
for p in BLUETOOTH_SCAN BLUETOOTH_CONNECT BLUETOOTH_ADVERTISE POST_NOTIFICATIONS; do
  adb shell pm grant $PKG android.permission.$p || true
done
adb shell cmd bluetooth_manager enable || adb shell svc bluetooth enable || true
sleep 3
adb logcat -c

# 操作の様子を動画でも撮る(最大3分)
adb shell screenrecord --bit-rate 2000000 /sdcard/demo.mp4 &
REC=$!
sleep 1
adb shell am start -n $PKG/com.zavier.tayori.app.MainActivity
sleep 5
shot 01-launch

# 端末IDを A にする
tap "edit:0"
adb shell input keyevent KEYCODE_MOVE_END
for i in $(seq 1 10); do adb shell input keyevent KEYCODE_DEL; done
adb shell input text A
hide_keyboard
tap "text:IDを保存"
shot 02-id-saved

tap "text:中継を開始"
sleep 6
shot 03-started

# C 宛てに送信(adb では日本語を入力できないので英数字で)
tap "edit:1"; adb shell input text C; hide_keyboard
tap "text:要救助"
tap "edit:2"; adb shell input text "help-from-emulator"; hide_keyboard
tap "text:送信"
shot 04-sent

adb shell input swipe 160 560 160 140 600
shot 05-scrolled
sleep 2
adb shell input swipe 160 560 160 140 600
sleep 3
adb shell pkill -INT screenrecord || true
wait $REC 2>/dev/null || true
sleep 3
adb pull /sdcard/demo.mp4 "$OUT/demo.mp4" || true

adb shell run-as $PKG cat files/tayori_log.csv > "$OUT/tayori_log.csv" || true
adb logcat -d > "$OUT/logcat.txt"
grep -E "TayoriBle|AndroidRuntime|FATAL" "$OUT/logcat.txt" | tail -50 || true
echo "===CSV-BEGIN==="; cat "$OUT/tayori_log.csv" 2>/dev/null; echo "===CSV-END==="
exit 0
