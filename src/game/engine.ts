import * as THREE from "three";
import { PaintField, type TeamId } from "./paint-field";
import { SfxEngine } from "./sfx";

export type Phase = "idle" | "countdown" | "playing" | "result";

export interface HudState {
  phase: Phase;
  timeLeft: number;
  countdown: number | null;
  playerCoverage: number;
  enemyCoverage: number;
  ink: number;
  squid: boolean;
  grounded: boolean;
  onOwnInk: boolean;
  splatted: boolean;
  message: string | null;
  winner: TeamId | "draw" | null;
}

export interface EngineCallbacks {
  onHud: (state: HudState) => void;
}

const STAGE_HALF = 25; // paintable ground extends [-25, 25] on x/z
const GROUND_SIZE = STAGE_HALF * 2;
const WATER_HALF = STAGE_HALF + 1.2;
const PAINT_RES = 512;
const MATCH_SECONDS = 100;
const GRAVITY = 15.5;
const JUMP_SPEED = 6.6;
const WALK_SPEED = 5.4;
const SQUID_OWN_INK_SPEED = 9.2;
const SQUID_BASE_SPEED = 6.2;
const ENEMY_INK_SLOW = 3.4;
const SHOT_COOLDOWN = 0.14;
const SHOT_SPEED = 17;
const INK_PER_SHOT = 3.4;
const INK_REGEN = 9; // per second, standing normally
const INK_REGEN_SQUID_OWN = 34; // per second, squid form on own ink
const RESPAWN_SECONDS = 3;
const SPAWN_INVULN = 1.1;

type Platform = { x: number; z: number; hx: number; hz: number; topY: number };

const PLATFORMS: Platform[] = [
  { x: 0, z: 0, hx: 5, hz: 5, topY: 1.2 },
  { x: 17, z: 17, hx: 4, hz: 4, topY: 0.9 },
  { x: -17, z: 17, hx: 4, hz: 4, topY: 0.9 },
  { x: 17, z: -17, hx: 4, hz: 4, topY: 0.9 },
  { x: -17, z: -17, hx: 4, hz: 4, topY: 0.9 },
];

function groundHeightAt(x: number, z: number): number {
  let h = 0;
  for (const p of PLATFORMS) {
    if (Math.abs(x - p.x) <= p.hx && Math.abs(z - p.z) <= p.hz) {
      h = Math.max(h, p.topY);
    }
  }
  return h;
}

function inVoid(x: number, z: number): boolean {
  return Math.abs(x) > WATER_HALF || Math.abs(z) > WATER_HALF;
}

interface AiState {
  target: THREE.Vector2;
  retarget: number;
  fireTimer: number;
}

interface Entity {
  kind: "player" | "ally" | "enemy";
  team: TeamId;
  group: THREE.Group;
  body: THREE.Group; // humanoid form
  squidMesh: THREE.Mesh; // squid form
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  squid: boolean;
  ink: number;
  alive: boolean;
  respawnTimer: number;
  invuln: number;
  spawn: THREE.Vector3;
  shotCooldown: number;
  grounded: boolean;
  ai?: AiState;
}

function randRange(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function randomFieldPoint(): THREE.Vector2 {
  return new THREE.Vector2(randRange(-22, 22), randRange(-22, 22));
}

interface Projectile {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  team: TeamId;
  age: number;
  owner: Entity;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

export class SplatoonEngine {
  private canvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D | null = null;
  private callbacks: EngineCallbacks;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private paint: PaintField;
  private sfx = new SfxEngine();

  private player!: Entity;
  private bots: Entity[] = [];
  private allEntities: Entity[] = [];
  private projectiles: Projectile[] = [];
  private particlePool: Particle[] = [];

  private keys = new Set<string>();
  private mouseDown = false;
  private yaw = Math.PI;
  private pitch = -0.28;

  private phase: Phase = "idle";
  private timeLeft = MATCH_SECONDS;
  private countdown: number | null = null;
  private message: string | null = null;
  private winner: TeamId | "draw" | null = null;
  private lastHudPush = 0;
  private lastMinimapDraw = 0;

  private disposed = false;
  private rafId = 0;
  private lastTime = 0;

  private onPointerMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    this.yaw -= e.movementX * 0.0026;
    this.pitch -= e.movementY * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.0, 1.05);
  };
  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.toggleSquid();
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = true;
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
  };
  private onResize = () => this.resize();

  constructor(
    canvas: HTMLCanvasElement,
    minimapCanvas: HTMLCanvasElement | null,
    callbacks: EngineCallbacks,
  ) {
    this.canvas = canvas;
    this.minimapCtx = minimapCanvas?.getContext("2d") ?? null;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
    this.paint = new PaintField(GROUND_SIZE, PAINT_RES);

    this.buildScene();
    this.buildEntities();
    this.resize();

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onPointerMove);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);

    this.rafId = requestAnimationFrame(this.tick);
  }

  // ---------------------------------------------------------------- scene

  private buildScene() {
    this.scene.background = new THREE.Color("#8fd3ff");
    this.scene.fog = new THREE.Fog("#8fd3ff", 40, 95);

    const hemi = new THREE.HemisphereLight("#bfe8ff", "#3a3f2e", 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff4de", 2.1);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);

    // Ground plane, painted dynamically by PaintField.
    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.paint.texture,
      roughness: 0.92,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Water ring surrounding the stage: a custom shader with gentle vertex waves.
    const waterGeo = new THREE.RingGeometry(STAGE_HALF + 0.4, 120, 64, 8);
    const waterMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying float vDist;
        void main() {
          vec3 p = position;
          float d = length(p.xy);
          p.z += sin(d * 0.4 - uTime * 1.6) * 0.35;
          vDist = d;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vDist;
        void main() {
          float a = clamp(1.0 - (vDist - 26.0) / 90.0, 0.35, 0.92);
          vec3 deep = vec3(0.03, 0.22, 0.55);
          vec3 shallow = vec3(0.25, 0.62, 0.85);
          vec3 col = mix(shallow, deep, clamp((vDist - 26.0) / 30.0, 0.0, 1.0));
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.15;
    this.scene.add(water);
    this.waterMaterial = waterMat;

    // Boundary markers so players can see the paintable edge.
    const edgeGeo = new THREE.BoxGeometry(GROUND_SIZE + 0.4, 0.25, 0.25);
    const edgeMat = new THREE.MeshStandardMaterial({ color: "#eef1f5", roughness: 0.6 });
    for (const [rx, rz, rot] of [
      [0, STAGE_HALF, 0],
      [0, -STAGE_HALF, 0],
      [STAGE_HALF, 0, Math.PI / 2],
      [-STAGE_HALF, 0, Math.PI / 2],
    ] as const) {
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set(rx, 0.05, rz);
      edge.rotation.y = rot;
      edge.castShadow = true;
      this.scene.add(edge);
    }

    // Platforms.
    const platformMat = new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.85 });
    for (const p of PLATFORMS) {
      const geo = new THREE.BoxGeometry(p.hx * 2, p.topY, p.hz * 2);
      const mesh = new THREE.Mesh(geo, platformMat);
      mesh.position.set(p.x, p.topY / 2, p.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }
  private waterMaterial!: THREE.ShaderMaterial;

  private makeCharacterMeshes(team: TeamId): { group: THREE.Group; body: THREE.Group; squidMesh: THREE.Mesh } {
    const color = team === "player" ? 0xff5a1f : 0xa239ff;
    const group = new THREE.Group();

    const body = new THREE.Group();
    const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.55, 4, 10);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08 });
    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.y = 0.78;
    torso.castShadow = true;
    body.add(torso);
    const headGeo = new THREE.SphereGeometry(0.28, 16, 12);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.42;
    head.castShadow = true;
    body.add(head);
    // two small "tentacle" locks for an inkling silhouette
    for (const side of [-1, 1]) {
      const lock = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 6), mat);
      lock.position.set(side * 0.16, 1.72, -0.05);
      lock.rotation.z = side * 0.3;
      body.add(lock);
    }
    group.add(body);

    const squidMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.12 }),
    );
    squidMesh.scale.set(1, 0.62, 1.15);
    squidMesh.position.y = 0.28;
    squidMesh.castShadow = true;
    squidMesh.visible = false;
    group.add(squidMesh);

    this.scene.add(group);
    return { group, body, squidMesh };
  }

  private makeEntity(kind: Entity["kind"], team: TeamId, spawn: THREE.Vector2): Entity {
    const { group, body, squidMesh } = this.makeCharacterMeshes(team);
    const e: Entity = {
      kind,
      team,
      group,
      body,
      squidMesh,
      position: new THREE.Vector3(spawn.x, 0, spawn.y),
      velocity: new THREE.Vector3(),
      yaw: 0,
      squid: false,
      ink: 100,
      alive: true,
      respawnTimer: 0,
      invuln: SPAWN_INVULN,
      spawn: new THREE.Vector3(spawn.x, 0, spawn.y),
      shotCooldown: 0,
      grounded: true,
    };
    if (kind !== "player") {
      e.ai = { target: randomFieldPoint(), retarget: randRange(1, 2.5), fireTimer: randRange(0.3, 1) };
    }
    return e;
  }

  private buildEntities() {
    // Spawn near the center of each team's corner platform (which has a 4-unit
    // half-extent) so a fresh spawn isn't standing right at the ledge.
    this.player = this.makeEntity("player", "player", new THREE.Vector2(-18, -16));
    const ally = this.makeEntity("ally", "player", new THREE.Vector2(-16, -18));
    const enemy1 = this.makeEntity("enemy", "enemy", new THREE.Vector2(18, 16));
    const enemy2 = this.makeEntity("enemy", "enemy", new THREE.Vector2(16, 18));
    this.bots = [ally, enemy1, enemy2];
    this.allEntities = [this.player, ...this.bots];
  }

  // --------------------------------------------------------------- public

  start() {
    this.sfx.resume();
    this.phase = "countdown";
    this.countdown = 3;
    this.message = null;
    this.winner = null;
    this.timeLeft = MATCH_SECONDS;
    this.sfx.beep(660);
  }

  restart() {
    for (const e of this.allEntities) {
      e.position.set(e.spawn.x, 0, e.spawn.z);
      e.velocity.set(0, 0, 0);
      e.ink = 100;
      e.alive = true;
      e.respawnTimer = 0;
      e.invuln = SPAWN_INVULN;
      e.squid = false;
      e.body.visible = true;
      e.squidMesh.visible = false;
      e.group.visible = true;
      e.group.scale.set(1, 1, 1);
    }
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    this.paint.ctx.fillStyle = "#2c3039";
    this.paint.ctx.fillRect(0, 0, this.paint.resolution, this.paint.resolution);
    this.paint.texture.needsUpdate = true;
    this.yaw = Math.PI;
    this.pitch = -0.28;
    this.start();
  }

  requestPointerLock() {
    this.canvas.requestPointerLock?.();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onPointerMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.renderer.dispose();
  }

  // ----------------------------------------------------------------- loop

  private tick = (time: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, this.lastTime ? (time - this.lastTime) / 1000 : 0.016);
    this.lastTime = time;

    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private update(dt: number) {
    this.waterMaterial.uniforms.uTime.value += dt;

    if (this.phase === "countdown") {
      this.countdown = (this.countdown ?? 3) - dt;
      if (this.countdown <= 0) {
        this.phase = "playing";
        this.countdown = null;
        this.sfx.beep(1040);
      } else if (Math.ceil(this.countdown) !== Math.ceil(this.countdown + dt)) {
        this.sfx.beep(660);
      }
    }

    if (this.phase === "playing") {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endMatch();
      }
    }

    if (this.phase === "playing" || this.phase === "countdown") {
      this.updatePlayer(dt);
      for (const bot of this.bots) this.updateBot(bot, dt);
    }
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateCamera();
    this.paint.update();
    const now = performance.now();
    this.pushHud(now);
    this.drawMinimap(now);
  }

  private endMatch() {
    this.phase = "result";
    const cov = this.paint.computeCoverage();
    this.winner =
      cov.player > cov.enemy + 0.5 ? "player" : cov.enemy > cov.player + 0.5 ? "enemy" : "draw";
    document.exitPointerLock?.();
  }

  // --------------------------------------------------------------- player

  private lookDir(): THREE.Vector3 {
    return new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
  }

  private toggleSquid() {
    if (this.phase !== "playing" || !this.player.alive) return;
    this.player.squid = !this.player.squid;
    this.sfx.squid(this.player.squid);
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    if (!p.alive) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) this.respawn(p);
      return;
    }
    p.invuln = Math.max(0, p.invuln - dt);

    const look = this.lookDir();
    const flatForward = new THREE.Vector3(look.x, 0, look.z).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), flatForward);

    let mx = 0;
    let mz = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) {
      mx += flatForward.x;
      mz += flatForward.z;
    }
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) {
      mx -= flatForward.x;
      mz -= flatForward.z;
    }
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) {
      mx -= right.x;
      mz -= right.z;
    }
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) {
      mx += right.x;
      mz += right.z;
    }
    const moveLen = Math.hypot(mx, mz);
    if (moveLen > 0.001) {
      mx /= moveLen;
      mz /= moveLen;
      p.yaw = Math.atan2(mx, mz);
    }

    const onOwnInk = this.paint.teamAt(p.position.x, p.position.z) === p.team;
    const onEnemyInk = this.paint.teamAt(p.position.x, p.position.z) === this.opponent(p.team);
    const speed = p.squid
      ? onOwnInk
        ? SQUID_OWN_INK_SPEED
        : SQUID_BASE_SPEED
      : onEnemyInk
        ? ENEMY_INK_SLOW
        : WALK_SPEED;

    this.applyHorizontalMovement(p, mx * moveLen, mz * moveLen, speed, dt);
    this.applyVerticalPhysics(p, dt);

    if (!p.squid && (this.keys.has("Space") || this.keys.has("KeyJ"))) {
      if (p.grounded) {
        p.velocity.y = JUMP_SPEED;
        p.grounded = false;
      }
    }

    // Ink regen.
    const regen = p.squid && onOwnInk ? INK_REGEN_SQUID_OWN : INK_REGEN;
    p.ink = Math.min(100, p.ink + regen * dt);

    p.shotCooldown = Math.max(0, p.shotCooldown - dt);
    if (!p.squid && this.mouseDown && p.shotCooldown <= 0 && p.ink >= INK_PER_SHOT) {
      this.fireShot(p, look);
      p.shotCooldown = SHOT_COOLDOWN;
      p.ink -= INK_PER_SHOT;
    }

    this.syncEntityVisual(p, onOwnInk);
    this.checkVoidFall(p);
  }

  private opponent(team: TeamId): TeamId {
    return team === "player" ? "enemy" : "player";
  }

  private applyHorizontalMovement(e: Entity, dirX: number, dirZ: number, speed: number, dt: number) {
    const targetX = dirX * speed;
    const targetZ = dirZ * speed;
    const smoothing = 1 - Math.exp(-10 * dt);
    e.velocity.x = THREE.MathUtils.lerp(e.velocity.x, targetX, smoothing);
    e.velocity.z = THREE.MathUtils.lerp(e.velocity.z, targetZ, smoothing);
    e.position.x += e.velocity.x * dt;
    e.position.z += e.velocity.z * dt;
  }

  private applyVerticalPhysics(e: Entity, dt: number) {
    e.velocity.y -= GRAVITY * dt;
    e.position.y += e.velocity.y * dt;
    const void_ = inVoid(e.position.x, e.position.z);
    const ground = void_ ? -100 : groundHeightAt(e.position.x, e.position.z);
    if (e.position.y <= ground) {
      e.position.y = ground;
      e.velocity.y = 0;
      e.grounded = true;
    } else {
      e.grounded = false;
    }
  }

  private checkVoidFall(e: Entity) {
    if (e.alive && inVoid(e.position.x, e.position.z) && e.position.y < -3) {
      this.splat(e, null);
    }
  }

  private syncEntityVisual(e: Entity, onOwnInk: boolean) {
    e.group.position.copy(e.position);
    e.body.visible = !e.squid;
    e.squidMesh.visible = e.squid;
    if (e.squid) {
      e.squidMesh.rotation.y = e.yaw;
      const bob = onOwnInk ? Math.sin(performance.now() * 0.012) * 0.05 : 0;
      e.squidMesh.position.y = 0.28 + bob;
    } else {
      e.body.rotation.y = e.yaw;
    }
  }

  // ------------------------------------------------------------------ bots

  private updateBot(bot: Entity, dt: number) {
    if (!bot.alive) {
      bot.respawnTimer -= dt;
      if (bot.respawnTimer <= 0) this.respawn(bot);
      return;
    }
    bot.invuln = Math.max(0, bot.invuln - dt);
    const ai = bot.ai!;
    ai.retarget -= dt;
    const dx = ai.target.x - bot.position.x;
    const dz = ai.target.y - bot.position.z;
    const dist = Math.hypot(dx, dz);
    if (ai.retarget <= 0 || dist < 1.6) {
      ai.target = randomFieldPoint();
      ai.retarget = randRange(1.8, 3.6);
    }
    const dirX = dist > 0.01 ? dx / dist : 0;
    const dirZ = dist > 0.01 ? dz / dist : 0;
    if (dist > 0.05) bot.yaw = Math.atan2(dirX, dirZ);

    const onOwnInk = this.paint.teamAt(bot.position.x, bot.position.z) === bot.team;
    this.applyHorizontalMovement(bot, dirX, dirZ, onOwnInk ? WALK_SPEED * 1.05 : WALK_SPEED * 0.85, dt);
    this.applyVerticalPhysics(bot, dt);

    ai.fireTimer -= dt;
    if (ai.fireTimer <= 0) {
      const jitter = randRange(-0.35, 0.35);
      const look = new THREE.Vector3(
        Math.sin(bot.yaw + jitter) * 0.92,
        -0.18,
        Math.cos(bot.yaw + jitter) * 0.92,
      ).normalize();
      this.fireShot(bot, look);
      ai.fireTimer = randRange(0.5, 1.0);
    }

    this.syncEntityVisual(bot, onOwnInk);
    this.checkVoidFall(bot);
  }

  // ------------------------------------------------------------ shooting

  private fireShot(owner: Entity, dir: THREE.Vector3) {
    const geo = new THREE.SphereGeometry(0.14, 8, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: owner.team === "player" ? 0xff7a3f : 0xb85bff,
      emissive: owner.team === "player" ? 0x552200 : 0x330a55,
      roughness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    const spawnPos = owner.position
      .clone()
      .add(new THREE.Vector3(0, 1.15, 0))
      .add(dir.clone().multiplyScalar(0.6));
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      position: spawnPos,
      velocity: dir.clone().multiplyScalar(SHOT_SPEED).add(new THREE.Vector3(0, 3.4, 0)),
      team: owner.team,
      age: 0,
      owner,
    });
    this.sfx.shoot(owner.team === "player" ? 1 : 0.82);
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.age += dt;
      proj.velocity.y -= GRAVITY * 1.05 * dt;
      proj.position.addScaledVector(proj.velocity, dt);
      proj.mesh.position.copy(proj.position);

      const void_ = inVoid(proj.position.x, proj.position.z);
      const ground = void_ ? -1 : groundHeightAt(proj.position.x, proj.position.z);

      // Paint a thin trail while flying low over the ground.
      if (!void_ && proj.position.y - ground < 0.9 && proj.position.y - ground > 0) {
        this.paint.stampTrail(proj.position.x, proj.position.z, proj.team);
      }

      let dead = false;
      if (!void_ && proj.position.y <= ground) {
        this.paint.stamp(
          proj.position.x,
          proj.position.z,
          proj.team,
          1.5,
          new THREE.Vector2(proj.velocity.x, proj.velocity.z),
        );
        this.spawnSplash(proj.position, proj.team);
        this.sfx.splat();
        dead = true;
      } else if (void_ && proj.position.y < ground - 2) {
        dead = true;
      } else if (proj.age > 2.2) {
        dead = true;
      } else {
        // Entity collision.
        for (const target of this.allEntities) {
          if (target === proj.owner || !target.alive) continue;
          if (target.team === proj.team) continue;
          if (target.invuln > 0) continue;
          const dxp = target.position.x - proj.position.x;
          const dyp = target.position.y + 0.8 - proj.position.y;
          const dzp = target.position.z - proj.position.z;
          if (dxp * dxp + dyp * dyp + dzp * dzp < 0.55 * 0.55) {
            this.paint.stamp(target.position.x, target.position.z, proj.team, 1.3);
            this.splat(target, proj.team);
            dead = true;
            break;
          }
        }
      }

      if (dead) {
        this.scene.remove(proj.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private splat(target: Entity, byTeam: TeamId | null) {
    if (!target.alive) return;
    target.alive = false;
    target.respawnTimer = RESPAWN_SECONDS;
    target.group.visible = false;
    this.spawnSplash(target.position, byTeam ?? target.team);
    this.sfx.splat();
    if (target.kind === "player") {
      this.message = "やられた！";
    }
  }

  private respawn(e: Entity) {
    e.position.set(e.spawn.x, 0, e.spawn.z);
    e.velocity.set(0, 0, 0);
    e.alive = true;
    e.invuln = SPAWN_INVULN;
    e.group.visible = true;
    e.ink = Math.max(e.ink, 60);
    if (e.kind === "player") this.message = null;
  }

  // ---------------------------------------------------------------- fx

  private ensureParticlePool() {
    if (this.particlePool.length > 0) return;
    const geo = new THREE.SphereGeometry(0.06, 6, 6);
    for (let i = 0; i < 120; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlePool.push({ mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 0.5, active: false });
    }
  }

  private spawnSplash(pos: THREE.Vector3, team: TeamId) {
    this.ensureParticlePool();
    const color = team === "player" ? 0xff5a1f : 0xa239ff;
    let spawned = 0;
    for (const particle of this.particlePool) {
      if (particle.active) continue;
      particle.active = true;
      particle.life = particle.maxLife = randRange(0.35, 0.6);
      particle.mesh.visible = true;
      particle.mesh.position.copy(pos).add(new THREE.Vector3(0, 0.3, 0));
      (particle.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      const ang = Math.random() * Math.PI * 2;
      const spd = randRange(1.5, 4.5);
      particle.velocity.set(Math.cos(ang) * spd, randRange(2, 5), Math.sin(ang) * spd);
      spawned++;
      if (spawned >= 12) break;
    }
  }

  private updateParticles(dt: number) {
    for (const particle of this.particlePool) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        particle.mesh.visible = false;
        continue;
      }
      particle.velocity.y -= GRAVITY * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      const s = Math.max(0.05, particle.life / particle.maxLife);
      particle.mesh.scale.setScalar(s);
    }
  }

  // ------------------------------------------------------------- camera

  private updateCamera() {
    const p = this.player;
    const look = this.lookDir();
    const dist = p.squid ? 4.2 : 5.4;
    const eyeHeight = p.squid ? 0.9 : 1.55;
    const target = p.position.clone().add(new THREE.Vector3(0, eyeHeight, 0));
    const camPos = target.clone().addScaledVector(look, -dist);
    camPos.y += 0.4;
    const minY = groundHeightAt(camPos.x, camPos.z) + 0.6;
    if (camPos.y < minY) camPos.y = minY;
    this.camera.position.lerp(camPos, 1 - Math.exp(-14 * (1 / 60)));
    this.camera.lookAt(target.clone().addScaledVector(look, 3));
  }

  // -------------------------------------------------------------- hud/ui

  private drawMinimap(now: number) {
    if (!this.minimapCtx) return;
    if (now - this.lastMinimapDraw < 180) return;
    this.lastMinimapDraw = now;
    const markers = [
      { x: this.player.position.x, z: this.player.position.z, color: "#ffffff" },
      ...this.bots.map((b) => ({
        x: b.position.x,
        z: b.position.z,
        color: b.team === "player" ? "#ffb37a" : "#d9adff",
      })),
    ];
    this.paint.drawMinimap(this.minimapCtx, markers);
  }

  private pushHud(now: number) {
    if (now - this.lastHudPush < 120) return;
    this.lastHudPush = now;
    const cov =
      this.phase === "playing" || this.phase === "result"
        ? this.paint.computeCoverage(6)
        : { player: 0, enemy: 0, neutral: 100 };
    const onOwnInk = this.paint.teamAt(this.player.position.x, this.player.position.z) === "player";
    this.callbacks.onHud({
      phase: this.phase,
      timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
      countdown: this.countdown !== null ? Math.ceil(this.countdown) : null,
      playerCoverage: cov.player,
      enemyCoverage: cov.enemy,
      ink: this.player.ink,
      squid: this.player.squid,
      grounded: !!this.player.grounded,
      onOwnInk,
      splatted: !this.player.alive,
      message: this.message,
      winner: this.winner,
    });
  }
}
