"use client";

import { useEffect, useRef, useState } from "react";
import { SplatoonEngine, type HudState } from "@/game/engine";

const INITIAL_HUD: HudState = {
  phase: "idle",
  timeLeft: 100,
  countdown: null,
  playerCoverage: 0,
  enemyCoverage: 0,
  ink: 100,
  squid: false,
  grounded: true,
  onOwnInk: false,
  splatted: false,
  message: null,
  winner: null,
};

export function SplatoonGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SplatoonEngine | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new SplatoonEngine(canvas, minimapRef.current, {
      onHud: setHud,
    });
    engineRef.current = engine;

    const onLockChange = () => setLocked(document.pointerLockElement === canvas);
    document.addEventListener("pointerlockchange", onLockChange);

    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = () => {
    engineRef.current?.start();
    engineRef.current?.requestPointerLock();
  };

  const handleRestart = () => {
    engineRef.current?.restart();
    engineRef.current?.requestPointerLock();
  };

  const handleCanvasClick = () => {
    if (hud.phase === "playing" || hud.phase === "countdown") {
      engineRef.current?.requestPointerLock();
    }
  };

  const showBlockingOverlay = hud.phase === "idle" || hud.phase === "result";
  const needsClickToResume =
    !locked && (hud.phase === "playing" || hud.phase === "countdown") && !showBlockingOverlay;

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-black select-none">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="absolute inset-0 h-full w-full cursor-crosshair"
      />

      {/* crosshair */}
      {hud.phase === "playing" && !hud.splatted && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 shadow-[0_0_4px_rgba(0,0,0,0.6)]" />
      )}

      {/* top coverage bar */}
      {(hud.phase === "playing" || hud.phase === "countdown") && (
        <div className="pointer-events-none absolute left-1/2 top-4 w-[min(560px,86vw)] -translate-x-1/2">
          <div className="flex justify-between px-1 text-xs font-bold text-white drop-shadow">
            <span style={{ color: "#ff8447" }}>{hud.playerCoverage.toFixed(0)}%</span>
            <span className="text-white/90">{"⏱ " + formatTime(hud.timeLeft)}</span>
            <span style={{ color: "#c48bff" }}>{hud.enemyCoverage.toFixed(0)}%</span>
          </div>
          <div className="mt-1 flex h-3 w-full overflow-hidden rounded-full border border-white/40 bg-black/40">
            <div
              className="h-full bg-[#ff5a1f] transition-[width] duration-300"
              style={{ width: `${hud.playerCoverage}%` }}
            />
            <div className="h-full flex-1 bg-white/10" />
            <div
              className="h-full bg-[#a239ff] transition-[width] duration-300"
              style={{ width: `${hud.enemyCoverage}%` }}
            />
          </div>
        </div>
      )}

      {/* minimap: always mounted so the engine's ref is valid as soon as it's constructed,
          visibility is toggled with CSS instead of unmounting the canvas */}
      <div
        className={`pointer-events-none absolute left-4 top-4 rounded-md border-2 border-white/50 shadow-lg transition-opacity ${
          hud.phase === "playing" || hud.phase === "countdown" ? "opacity-100" : "opacity-0"
        }`}
      >
        <canvas ref={minimapRef} width={140} height={140} className="block rounded-[4px]" />
      </div>

      {/* ink gauge + squid indicator */}
      {(hud.phase === "playing" || hud.phase === "countdown") && (
        <div className="pointer-events-none absolute bottom-6 right-6 flex flex-col items-end gap-2">
          <div
            className={`rounded-full px-3 py-1 text-xs font-bold text-white shadow ${
              hud.squid ? "bg-emerald-600/90" : "bg-black/50"
            }`}
          >
            {hud.squid ? "🦑 イカ状態" : "🧑 ヒト状態"}
            {hud.onOwnInk && " ・自陣インク上"}
          </div>
          <div className="h-28 w-5 overflow-hidden rounded-full border border-white/50 bg-black/40">
            <div
              className="w-full bg-gradient-to-t from-[#ff5a1f] to-[#ffb37a] transition-[height] duration-150"
              style={{ height: `${hud.ink}%`, marginTop: `${100 - hud.ink}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-white/80">INK</span>
        </div>
      )}

      {/* splatted message */}
      {hud.splatted && hud.phase === "playing" && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/70 px-6 py-3 text-2xl font-black tracking-wider text-white">
          {hud.message ?? "やられた！"}
        </div>
      )}

      {/* click-to-resume hint */}
      {needsClickToResume && (
        <button
          onClick={handleCanvasClick}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-lg font-bold text-white"
        >
          クリックして操作を再開
        </button>
      )}

      {/* countdown */}
      {hud.phase === "countdown" && hud.countdown !== null && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
          {Math.max(1, hud.countdown)}
        </div>
      )}

      {/* start screen */}
      {hud.phase === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-sky-500 to-sky-700 px-6 text-center text-white">
          <h1 className="text-4xl font-black tracking-tight drop-shadow sm:text-6xl">
            ターフウォーズ 3D
          </h1>
          <p className="max-w-lg text-sm text-white/90 sm:text-base">
            2vs2でステージを自分の色のインクで塗りまくれ。制限時間が来たときに陣地の割合が多いチームの勝ち。
            <br />
            シフトでイカ状態に変身して自分のインクの中を高速で泳げるぞ。
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 rounded-lg bg-black/25 px-6 py-4 text-left text-sm">
            <span className="font-mono">W A S D</span>
            <span>移動</span>
            <span className="font-mono">マウス</span>
            <span>視点操作 / 狙い</span>
            <span className="font-mono">左クリック</span>
            <span>インクを撃つ</span>
            <span className="font-mono">スペース</span>
            <span>ジャンプ</span>
            <span className="font-mono">Shift</span>
            <span>イカ⇔ヒト 変身</span>
          </div>
          <button
            onClick={handleStart}
            className="rounded-full bg-white px-10 py-3 text-lg font-black text-sky-700 shadow-lg transition hover:scale-105"
          >
            プレイ開始
          </button>
          <p className="text-xs text-white/70">マウスがロックされます。PC + マウス推奨。</p>
        </div>
      )}

      {/* result screen */}
      {hud.phase === "result" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/80 px-6 text-center text-white">
          <h2 className="text-3xl font-black sm:text-5xl">
            {hud.winner === "player" && "勝利！ 🎉"}
            {hud.winner === "enemy" && "敗北…"}
            {hud.winner === "draw" && "引き分け"}
          </h2>
          <div className="flex items-center gap-6 text-xl font-bold">
            <span style={{ color: "#ff8447" }}>自チーム {hud.playerCoverage.toFixed(1)}%</span>
            <span className="text-white/50">vs</span>
            <span style={{ color: "#c48bff" }}>敵チーム {hud.enemyCoverage.toFixed(1)}%</span>
          </div>
          <button
            onClick={handleRestart}
            className="rounded-full bg-white px-10 py-3 text-lg font-black text-sky-700 shadow-lg transition hover:scale-105"
          >
            もう一度プレイ
          </button>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
