#!/usr/bin/env bash
# エミュレータにAPKを入れ、実際の使い方の流れで操作して、動画とスクリーンショットを撮る(GitHub Actions 用)。
# Bluetoothの実通信はエミュレータ1台では確認できないので、画面と操作の流れの確認が目的。
set -u
PKG=com.zavier.tayori.exp
OUT=ci-out
mkdir -p "$OUT"
C_CODE=$(cat "$OUT/c_code.txt")

shot() { sleep 1; adb exec-out screencap -p > "$OUT/$1.png"; echo "shot: $1"; }
dump() { adb shell uiautomator dump /sdcard/ui.xml > /dev/null; adb pull /sdcard/ui.xml "$OUT/ui.xml" > /dev/null; }
# 画面内に見つかるまで上下にスクロールしてからタップする
tap() {
  local target=$1 dir=${2:-down} xy
  for i in $(seq 1 8); do
    dump
    if xy=$(python3 ci/ui_find.py "$OUT/ui.xml" "$target" 2>/dev/null); then adb shell input tap $xy; sleep 1; return 0; fi
    if [ "$dir" = down ]; then adb shell input swipe 160 500 160 250 400; else adb shell input swipe 160 250 160 500 400; fi
    sleep 1
  done
  echo "tap failed: $target"; return 1
}
type_text() { adb shell input text "$1"; sleep 1; adb shell input keyevent 111; sleep 1; }
scroll_to() { tap "$1" "${2:-down}" > /dev/null 2>&1 || true; }

adb install -r app/build/outputs/apk/debug/app-debug.apk
for p in BLUETOOTH_SCAN BLUETOOTH_CONNECT BLUETOOTH_ADVERTISE POST_NOTIFICATIONS; do
  adb shell pm grant $PKG android.permission.$p || true
done
adb shell cmd bluetooth_manager enable || adb shell svc bluetooth enable || true
sleep 3
adb logcat -c

adb shell screenrecord --bit-rate 3000000 --time-limit 180 /sdcard/demo.mp4 &
REC=$!
sleep 1
adb shell am start -n $PKG/com.zavier.tayori.app.MainActivity
sleep 5
shot 01-first-run

# 記録タブで端末IDを A にする
tap "text:記録"
tap "edit:0"
adb shell input keyevent KEYCODE_MOVE_END
for i in $(seq 1 10); do adb shell input keyevent KEYCODE_DEL; done
type_text A
tap "text:端末IDを保存"
sleep 2
shot 02-record

# 連絡先タブで C のコードを登録し、名前を付ける
tap "text:連絡先"
sleep 2
shot 03-my-code
tap "edit:0"
type_text "$C_CODE"
tap "edit:1"
type_text "Grandma"
tap "text:登録する"
sleep 2
shot 04-contact-added

# 安否タブ(中継前)
tap "text:安否"
sleep 2
shot 05-safety-stopped

# 中継を開始
tap "text:中継を開始する"
sleep 6
shot 06-safety-running

# ワンタップで無事を伝える
tap "text:自分は無事と伝える"
sleep 2
shot 07-sent-safe

# 要救助をひとこと付きで伝える
tap "text:要救助を伝える"
sleep 1
tap "edit:0"
type_text "2F-west"
tap "text:伝える"
sleep 2
shot 08-sent-sos

# 記録タブで送った安否を確認
tap "text:記録"
sleep 2
shot 09-record-sent
sleep 2

adb shell pkill -INT screenrecord || true
wait $REC 2>/dev/null || true
sleep 3
adb pull /sdcard/demo.mp4 "$OUT/demo.mp4" || true

adb shell run-as $PKG cat files/tayori_log.csv > "$OUT/tayori_log.csv" || true
adb logcat -d > "$OUT/logcat.txt"
grep -E "TayoriBle|AndroidRuntime: FATAL|FATAL EXCEPTION" "$OUT/logcat.txt" | tail -30 || true
echo "===CSV-BEGIN==="; cat "$OUT/tayori_log.csv" 2>/dev/null; echo "===CSV-END==="
exit 0
