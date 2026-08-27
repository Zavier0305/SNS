import * as THREE from "three";

export type TeamId = "player" | "enemy";

const NEUTRAL_RGB: [number, number, number] = [0x2c, 0x30, 0x39];

/**
 * Owns the dynamic ink canvas painted onto the stage floor.
 *
 * World XZ maps to canvas pixels with `worldToCanvas`, and the same mapping
 * is used everywhere (painting, per-pixel sampling for "am I standing on my
 * own ink", and the coverage tally) so the visuals and the game logic never
 * disagree about where the ink actually is.
 */
export class PaintField {
  readonly size: number;
  readonly resolution: number;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;

  private teamColor: Record<TeamId, string> = {
    player: "#ff5a1f",
    enemy: "#a239ff",
  };
  private teamRgb: Record<TeamId, [number, number, number]> = {
    player: [0xff, 0x5a, 0x1f],
    enemy: [0xa2, 0x39, 0xff],
  };
  private dirty = false;

  constructor(size: number, resolution = 512) {
    this.size = size;
    this.resolution = resolution;
    this.canvas = document.createElement("canvas");
    this.canvas.width = resolution;
    this.canvas.height = resolution;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2D context unavailable for paint field");
    this.ctx = ctx;
    ctx.fillStyle = `rgb(${NEUTRAL_RGB.join(",")})`;
    ctx.fillRect(0, 0, resolution, resolution);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  worldToCanvas(x: number, z: number): [number, number] {
    const cx = (x / this.size + 0.5) * this.resolution;
    const cy = (z / this.size + 0.5) * this.resolution;
    return [cx, cy];
  }

  /** Paints an organic ink blot centered on a world-space point. */
  stamp(x: number, z: number, team: TeamId, radiusWorld: number, dir?: THREE.Vector2) {
    const [cx, cy] = this.worldToCanvas(x, z);
    const r = (radiusWorld / this.size) * this.resolution;
    const ctx = this.ctx;
    ctx.fillStyle = this.teamColor[team];
    ctx.globalAlpha = 0.96;

    // Directional streak leading into the splat, like a shot's paint trail.
    if (dir && (dir.x !== 0 || dir.y !== 0)) {
      const nd = dir.clone().normalize();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(nd.x, nd.y));
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.6, r * 0.55, r * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Central blob plus a handful of scattered droplets for an organic edge.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    const drops = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < drops; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = r * (0.5 + Math.random() * 0.9);
      const dr = r * (0.18 + Math.random() * 0.35);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, dr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.dirty = true;
  }

  /** Small dot used for the thin trail a low-flying shot leaves behind it. */
  stampTrail(x: number, z: number, team: TeamId) {
    const [cx, cy] = this.worldToCanvas(x, z);
    const r = (0.28 / this.size) * this.resolution;
    const ctx = this.ctx;
    ctx.fillStyle = this.teamColor[team];
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    this.dirty = true;
  }

  /** Returns which team owns the ink under a world point, or null if neutral. */
  teamAt(x: number, z: number): TeamId | null {
    const [cx, cy] = this.worldToCanvas(x, z);
    if (cx < 0 || cy < 0 || cx >= this.resolution || cy >= this.resolution) return null;
    const data = this.ctx.getImageData(Math.floor(cx), Math.floor(cy), 1, 1).data;
    return this.closestTeam(data[0], data[1], data[2]);
  }

  private closestTeam(r: number, g: number, b: number): TeamId | null {
    let best: TeamId | null = null;
    let bestDist = 60 * 60; // neutral tolerance radius in RGB space
    (Object.keys(this.teamRgb) as TeamId[]).forEach((team) => {
      const [tr, tg, tb] = this.teamRgb[team];
      const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = team;
      }
    });
    return best;
  }

  /** Samples the whole canvas at a coarse stride to estimate % coverage per team. */
  computeCoverage(stride = 4): { player: number; enemy: number; neutral: number } {
    const { resolution } = this;
    const data = this.ctx.getImageData(0, 0, resolution, resolution).data;
    let player = 0;
    let enemy = 0;
    let total = 0;
    for (let y = 0; y < resolution; y += stride) {
      for (let x = 0; x < resolution; x += stride) {
        const i = (y * resolution + x) * 4;
        const team = this.closestTeam(data[i], data[i + 1], data[i + 2]);
        if (team === "player") player++;
        else if (team === "enemy") enemy++;
        total++;
      }
    }
    if (total === 0) return { player: 0, enemy: 0, neutral: 100 };
    return {
      player: (player / total) * 100,
      enemy: (enemy / total) * 100,
      neutral: ((total - player - enemy) / total) * 100,
    };
  }

  /** Draws a downscaled copy plus marker dots onto a small HUD minimap canvas. */
  drawMinimap(
    target: CanvasRenderingContext2D,
    markers: { x: number; z: number; color: string }[],
  ) {
    const w = target.canvas.width;
    const h = target.canvas.height;
    target.clearRect(0, 0, w, h);
    target.drawImage(this.canvas, 0, 0, w, h);
    for (const m of markers) {
      const nx = (m.x / this.size + 0.5) * w;
      const nz = (m.z / this.size + 0.5) * h;
      target.beginPath();
      target.fillStyle = m.color;
      target.arc(nx, nz, 3.2, 0, Math.PI * 2);
      target.fill();
      target.lineWidth = 1;
      target.strokeStyle = "rgba(0,0,0,0.6)";
      target.stroke();
    }
  }

  update() {
    if (this.dirty) {
      this.texture.needsUpdate = true;
      this.dirty = false;
    }
  }
}
