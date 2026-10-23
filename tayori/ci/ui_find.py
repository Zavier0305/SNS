"""uiautomator のダンプ(画面部品の一覧XML)から、指定した部品の中心座標を出す。
使い方: ui_find.py ui.xml "text:中継を開始"  /  ui_find.py ui.xml "edit:0"(0番目の入力欄)"""
import re
import sys
import xml.etree.ElementTree as ET

root = ET.parse(sys.argv[1]).getroot()
kind, _, value = sys.argv[2].partition(":")
nodes = list(root.iter("node"))
if kind == "text":
    # 空の入力欄は、端末によって text か hint のどちらかに案内文が入るので両方見る
    hits = [n for n in nodes if n.get("text") == value or n.get("hint") == value]
else:
    hits = [n for n in nodes if n.get("class") == "android.widget.EditText"][int(value):int(value) + 1]
if not hits:
    sys.exit(f"not found: {sys.argv[2]}")
x1, y1, x2, y2 = map(int, re.findall(r"\d+", hits[0].get("bounds")))
print((x1 + x2) // 2, (y1 + y2) // 2)
