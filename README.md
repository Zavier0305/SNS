# ターフウォーズ 3D

ブラウザで動く3Dインク陣取りシューター。Next.js (App Router) 上に [three.js](https://threejs.org/) で
書かれた自作ゲームエンジン (`src/game/engine.ts`) を載せて動かしています。外部アセットは一切使わず、
キャラクターやステージはすべてプロシージャルなジオメトリ、効果音も WebAudio でその場合成しています。

## 遊び方

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開き、「プレイ開始」でマウスがロックされます。

- `W A S D` : 移動（カメラ相対）
- マウス移動 : 視点操作・照準
- 左クリック : インクショットを発射（ホールドで連射）
- スペース : ジャンプ
- `Shift` : イカ⇔ヒト形態を切り替え

自分の色のインクの上でイカ状態になると高速で泳げ、インクタンクの回復も速くなります。敵のインクの上を
ヒト状態で歩くと逆に遅くなります。制限時間終了時にステージの塗り面積が多いチームの勝利です。

## 実装のポイント

- `src/game/paint-field.ts` — ステージを塗るための `<canvas>` ベースのインクフィールド。ワールド座標↔
  キャンバス座標の変換を一箇所に集約し、描画・自陣判定・陣地率の集計すべてが同じマッピングを使います。
- `src/game/engine.ts` — three.js のシーン構築、三人称カメラ、プレイヤー/CPU（2vs2）の移動・当たり判定・
  AI、インクの弾道と着弾ペイント、パーティクル、簡易水面シェーダー（GLSL）などを持つゲームループ。
- `src/game/sfx.ts` — WebAudio でショット・着弾・変身音をその場で合成するプロシージャルSE。
- `src/components/SplatoonGame.tsx` — キャンバスをマウントし、HUD（陣地バー・タイマー・ミニマップ・
  インクゲージ）を描画する React 側のラッパー。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
