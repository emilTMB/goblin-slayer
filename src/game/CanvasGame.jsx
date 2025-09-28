import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "../styles/Game.module.scss";
import useKeyboard from "./useKeyboard";

const asset = (p) => `${import.meta.env.BASE_URL}${p.replace(/^\//, "")}`;
/** === МЕТА ПОД СПРАЙТЫ ===
 * Все листы — один ряд, вправо. Кадр 16×24.
 */
const FRAME_W = 16;
const FRAME_H = 24;
const TILE = 32;

const VIEW_W = 320;
const VIEW_H = 240;

const PLAYER_SPEED = 85; // px/s
const ENEMY_SPEED = 45;
const ENEMY_ATTACK_TIME = 300; // ms (удар гоблина)
const INVULN_MS = 400; // неуязвимость после урона
const MAX_HP = 3;

// Порог для мобильного UI
const MOBILE_WIDTH = 1280;

const sprites = {
  idle: { src: asset("assets/idle.png"), cols: 4, fps: 6 },
  run: { src: asset("assets/run.png"), cols: 4, fps: 10 },
  die: { src: asset("assets/die.png"), cols: 4, fps: 6 },
  sleep: { src: asset("assets/sleep.png"), cols: 6, fps: 5 },
  idleSword: { src: asset("assets/idle-sword.png"), cols: 4, fps: 6 },
  runSword: { src: asset("assets/run-sword.png"), cols: 4, fps: 10 },
  attackSword: { src: asset("assets/attack-sword.png"), cols: 6, fps: 14 },
};

// === СПРАЙТЫ ГОБЛИНА ===
const GOB_W = 16,
  GOB_H = 24;
const goblinSprites = {
  idle: { src: asset("assets/goblin/goblin-idle.png"), cols: 4, fps: 6 },
  run: { src: asset("assets/goblin/goblin-run.png"), cols: 4, fps: 10 },
  attack: { src: asset("assets/goblin/goblin-attack.png"), cols: 6, fps: 12 },
  die: { src: asset("assets/goblin/goblin-die.png"), cols: 4, fps: 8 },
};

// карта: 0 — трава, 1 — стена
const MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

// Точки спавна гоблинов (в тайлах)
const SPAWN_POINTS = [
  { x: 8, y: 6 },
  { x: 9, y: 2 },
  { x: 2, y: 7 },
  { x: 10, y: 7 },
];

// Параметры респауна гоблинов
const MAX_GOBLINS = 3;
const SPAWN_INTERVAL_MS = 4000;
const REQUIRE_SWORD_TO_SPAWN = false;

// Параметры сердец (хил-объектов)
const HEART_SIZE = TILE - 20; // визуальный размер
const HEART_HEAL = 1; // сколько HP восполняет
const HEART_SPAWN_INTERVAL_MS = 5000; // интервал спавна
const HEART_DESPAWN_MS = 12000; // через сколько исчезает
const MAX_HEARTS = 2; // максимум одновременно

// ячейка с мечом
const SWORD_TILE = { x: 3, y: 2 };

// utils
function loadImage(src) {
  const i = new Image();
  i.src = src;
  i.decoding = "async";
  i.crossOrigin = "anonymous";
  return i;
}
function aabb(a, b) {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}
function drawFlippable(ctx, img, sx, sy, sw, sh, dx, dy, flipX = false) {
  if (!flipX) {
    ctx.drawImage(img, sx, sy, sw, sh, Math.round(dx), Math.round(dy), sw, sh);
    return;
  }
  ctx.save();
  ctx.translate(Math.round(dx) + sw, Math.round(dy));
  ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.restore();
}

/** =========================
 * Мобильный джойстик (D-pad + кнопка атаки)
 * ========================= */
function MobileJoystick({ onDirKeysChange, onAttackDown, onAttackUp }) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 }); // смещение «шляпки» в px

  const updateFromTouch = (touch) => {
    const el = baseRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // вектор пальца относительно центра
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;

    // ограничения круга (радиус базы минус радиус «шляпки»)
    const dotRadius = 22; // из CSS (44px / 2)
    const maxR = rect.width / 2 - dotRadius;
    const r = Math.hypot(dx, dy);

    // мёртвая зона и осевой порог
    const dead = 14; // круговая мёртвая зона
    const axisDead = 6; // порог по осям для устранения дрожи

    // ограничиваем позицию «шляпки» кругом
    if (r > maxR) {
      dx = (dx / r) * maxR;
      dy = (dy / r) * maxR;
    }

    // визуально двигаем «шляпку»
    setKnob({ x: dx, y: dy });

    // логика направлений (можно по диагонали)
    const keys = new Set();
    if (r > dead) {
      if (dx > axisDead) keys.add("arrowright");
      if (dx < -axisDead) keys.add("arrowleft");
      if (dy > axisDead) keys.add("arrowdown");
      if (dy < -axisDead) keys.add("arrowup");
    }
    onDirKeysChange(keys);
  };

  const clearDir = () => {
    onDirKeysChange(new Set());
    setKnob({ x: 0, y: 0 }); // вернуть «шляпку» в центр
  };

  return (
    <div className={styles.mobileUI}>
      {/* D-pad */}
      <div
        className={styles.joystick}
        ref={baseRef}
        onTouchStart={(e) => {
          e.preventDefault();
          updateFromTouch(e.touches[0]);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          updateFromTouch(e.touches[0]);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          clearDir();
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          clearDir();
        }}
      >
        <div
          className={styles.joystickDot}
          style={{
            transform: `translate(calc(0% + ${Math.round(
              knob.x
            )}px), calc(0% + ${Math.round(knob.y)}px))`,
          }}
        />
      </div>

      {/* Attack (SPACE) */}
      <button
        className={styles.attackBtn}
        onTouchStart={(e) => {
          e.preventDefault();
          onAttackDown();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onAttackUp();
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          onAttackUp();
        }}
      >
        <img
          src={asset("/assets/sword-pixel-attack.png")}
          className={styles.swordBtn}
          alt="attack"
        />
      </button>
    </div>
  );
}

export default function CanvasGame() {
  const canvasRef = useRef(null);
  const keys = useKeyboard();
  const [restartKey, setRestartKey] = useState(0);

  // overlay
  const [gameOver, setGameOver] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [kills, setKills] = useState(0);
  const startRef = useRef(performance.now());

  // мобильный порог
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_WIDTH : true
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_WIDTH);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Виртуальные «клавиши» от джойстика
  const virtualKeysRef = useRef(new Set());
  const setDirKeys = (setOfArrowKeys) => {
    ["arrowleft", "arrowright", "arrowup", "arrowdown"].forEach((k) =>
      virtualKeysRef.current.delete(k)
    );
    setOfArrowKeys.forEach((k) => virtualKeysRef.current.add(k));
  };
  const pressAttack = () => virtualKeysRef.current.add(" ");
  const releaseAttack = () => virtualKeysRef.current.delete(" ");

  const DIE_DURATION_MS = (sprites.die.cols / sprites.die.fps) * 1000;
  const ATTACK_TOTAL_MS =
    (sprites.attackSword.cols / sprites.attackSword.fps) * 1000;

  const images = useMemo(() => {
    const o = {};
    for (const k in sprites) o[k] = loadImage(sprites[k].src);
    for (const k in goblinSprites)
      o["g_" + k] = loadImage(goblinSprites[k].src);
    return o;
  }, [restartKey]);

  useEffect(() => {
    startRef.current = performance.now();
    setGameOver(false);
    setElapsedMs(0);
    setKills(0); // сброс убийств

    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    c.width = VIEW_W;
    c.height = VIEW_H;

    // препятствия
    const solids = [];
    const floorTiles = [];
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[0].length; x++) {
        if (MAP[y][x] === 1)
          solids.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE });
        else floorTiles.push({ tx: x, ty: y });
      }
    }

    // предмет «меч»
    const swordPickup = {
      x: SWORD_TILE.x * TILE + 8,
      y: SWORD_TILE.y * TILE + 8,
      w: TILE - 16,
      h: TILE - 16,
      picked: false,
    };

    const player = {
      x: TILE * 2,
      y: TILE * 2,
      w: FRAME_W,
      h: FRAME_H,
      dir: 1,
      state: "sleep",
      frame: 0,
      acc: 0,
      hasSword: false,
      attackStartedAt: 0,
      hp: MAX_HP,
      hurtAt: -9999,
      dead: false,
      dieStartedAt: 0,
    };

    // === Гоблины ===
    function makeGoblin(tileX, tileY) {
      return {
        x: tileX * TILE,
        y: tileY * TILE,
        w: GOB_W,
        h: GOB_H,
        dir: -1,
        state: "idle",
        frame: 0,
        acc: 0,
        attackStartedAt: 0,
        hp: 3,
        hurtAt: -9999,
        dead: false,
      };
    }
    const goblins = [];
    goblins.push(makeGoblin(SPAWN_POINTS[0].x, SPAWN_POINTS[0].y));
    let nextSpawnAt = performance.now() + SPAWN_INTERVAL_MS;

    // === Сердца (хил) ===
    const hearts = []; // {x,y,w,h,createdAt}
    let nextHeartAt = performance.now() + HEART_SPAWN_INTERVAL_MS;

    function spawnHeart(now) {
      if (hearts.length >= MAX_HEARTS) return;
      const tile = floorTiles[Math.floor(Math.random() * floorTiles.length)];
      const size = HEART_SIZE;
      const x = tile.tx * TILE + Math.round((TILE - size) / 2);
      const y = tile.ty * TILE + Math.round((TILE - size) / 2);
      const heartRect = { x, y, w: size, h: size };
      for (const s of solids) if (aabb(heartRect, s)) return;
      if (!swordPickup.picked && aabb(heartRect, swordPickup)) return;
      hearts.push({ x, y, w: size, h: size, createdAt: now });
      nextHeartAt =
        now + HEART_SPAWN_INTERVAL_MS + Math.floor(Math.random() * 2000);
    }

    const cam = { x: 0, y: 0 };
    let last = performance.now();
    let running = true;
    let rafId = 0;

    const onKey = (e) => {
      if (e.key.toLowerCase() === "r") {
        running = false;
        setRestartKey((k) => k + 1);
      }
    };
    window.addEventListener("keydown", onKey, { passive: false });

    // скользящее перемещение по препятствиям (диагональ → X → Y)
    function tryMove(ent, dx, dy) {
      const hits = (rect) => {
        for (const s of solids) {
          if (
            !(
              rect.x + rect.w <= s.x ||
              s.x + s.w <= rect.x ||
              rect.y + rect.h <= s.y ||
              s.y + s.h <= rect.y
            )
          ) {
            return true;
          }
        }
        return false;
      };

      const full = { x: ent.x + dx, y: ent.y + dy, w: ent.w, h: ent.h };
      if (!hits(full)) {
        ent.x = full.x;
        ent.y = full.y;
        return;
      }

      const onlyX = { x: ent.x + dx, y: ent.y, w: ent.w, h: ent.h };
      if (!hits(onlyX)) {
        ent.x = onlyX.x;
      }

      const onlyY = { x: ent.x, y: ent.y + dy, w: ent.w, h: ent.h };
      if (!hits(onlyY)) {
        ent.y = onlyY.y;
      }
    }

    function spriteKey(p) {
      if (p.state === "sleep") return "sleep";
      if (p.state === "die") return "die";
      if (p.hasSword) {
        if (p.state === "attack") return "attackSword";
        if (p.state === "run") return "runSword";
        return "idleSword";
      } else {
        if (p.state === "run") return "run";
        return "idle";
      }
    }
    function goblinSpriteKey(g) {
      if (g.dead) return null;
      if (g.state === "die") return "g_die";
      if (g.state === "attack") return "g_attack";
      if (g.state === "run") return "g_run";
      return "g_idle";
    }

    function attackHitbox(p) {
      const w = 14,
        h = 12;
      const x = p.dir === 1 ? p.x + p.w - 4 : p.x - w + 4;
      const y = p.y + p.h / 2 - h / 2;
      return { x, y, w, h };
    }
    function goblinHitbox(g) {
      const w = 12,
        h = 12;
      const x = g.dir === 1 ? g.x + g.w - 6 : g.x - w + 6;
      const y = g.y + g.h / 2 - h / 2;
      return { x, y, w, h };
    }

    function spawnGoblin(now) {
      if (goblins.length >= MAX_GOBLINS) return;
      if (REQUIRE_SWORD_TO_SPAWN && !player.hasSword) return;
      const pt = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
      goblins.push(makeGoblin(pt.x, pt.y));
      nextSpawnAt = now + SPAWN_INTERVAL_MS;
    }

    function loop(now) {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      update(dt, now);
      render();
      rafId = requestAnimationFrame(loop);
    }

    function update(dt, now) {
      // склеиваем реальные и виртуальные нажатия
      const mergedKeys = new Set([...keys.current, ...virtualKeysRef.current]);

      // сон до первого ввода
      if (player.state === "sleep") {
        if (mergedKeys.size > 0) {
          player.state = "idle";
          player.frame = 0;
          player.acc = 0;
        } else {
          const meta = sprites.sleep;
          player.acc += dt;
          if (player.acc >= 1 / meta.fps) {
            player.acc = 0;
            player.frame = (player.frame + 1) % meta.cols;
          }
          return;
        }
      }

      // спавны по таймеру
      if (now >= nextSpawnAt) spawnGoblin(now);
      if (now >= nextHeartAt) spawnHeart(now);

      // ввод (если персонаж жив)
      let mx = 0,
        my = 0;
      if (player.state !== "die") {
        if (mergedKeys.has("arrowleft") || mergedKeys.has("a")) {
          mx -= 1;
          player.dir = -1;
        }
        if (mergedKeys.has("arrowright") || mergedKeys.has("d")) {
          mx += 1;
          player.dir = 1;
        }
        if (mergedKeys.has("arrowup") || mergedKeys.has("w")) my -= 1;
        if (mergedKeys.has("arrowdown") || mergedKeys.has("s")) my += 1;
      }

      // атака игрока (старт)
      if (
        player.hasSword &&
        (mergedKeys.has(" ") || mergedKeys.has("enter")) &&
        player.state !== "attack" &&
        player.state !== "die"
      ) {
        player.state = "attack";
        player.frame = 0;
        player.acc = 0;
        player.attackStartedAt = now;
      }

      // движение игрока
      const len = Math.hypot(mx, my) || 1;
      if (player.state !== "attack" && player.state !== "die" && (mx || my)) {
        tryMove(
          player,
          (mx / len) * PLAYER_SPEED * dt,
          (my / len) * PLAYER_SPEED * dt
        );
        player.state = "run";
      } else if (player.state !== "attack" && player.state !== "die") {
        player.state = "idle";
      }

      // подбор меча
      if (!player.hasSword && aabb(player, swordPickup)) {
        swordPickup.picked = true;
        player.hasSword = true;
        player.state = "idle";
        player.frame = 0;
        player.acc = 0;
      }

      // ПОДБОР СЕРДЕЦ
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i];
        if (now - h.createdAt >= HEART_DESPAWN_MS) {
          hearts.splice(i, 1);
          continue;
        }
        if (!player.dead && aabb(player, h) && player.hp < MAX_HP) {
          player.hp = Math.min(MAX_HP, player.hp + HEART_HEAL);
          hearts.splice(i, 1);
        }
      }

      // === АНИМАЦИИ И СОСТОЯНИЯ ИГРОКА ===
      const pm =
        sprites[
          player.state === "die"
            ? "die"
            : player.hasSword
            ? player.state === "attack"
              ? "attackSword"
              : player.state === "run"
              ? "runSword"
              : "idleSword"
            : player.state === "run"
            ? "run"
            : "idle"
        ];

      // тикаем кадры только для НЕ attack (attack управляется временем)
      player.acc += dt;
      if (player.acc >= 1 / pm.fps) {
        player.acc = 0;

        if (player.state === "die") {
          if (player.frame < pm.cols - 1) {
            player.frame += 1;
          } else if (!player.dead) {
            player.dead = true;
            running = false;
            const ms = now - startRef.current;
            setElapsedMs(ms);
            setGameOver(true);
          }
        } else if (player.state !== "attack") {
          player.frame = (player.frame + 1) % pm.cols;
        }
      }

      // Атака по времени: от 0-го до последнего кадра без зацикливания
      if (player.state === "attack") {
        const t = now - player.attackStartedAt;
        const cols = sprites.attackSword.cols;
        const fps = sprites.attackSword.fps;
        const frameByTime = Math.min(cols - 1, Math.floor((t / 1000) * fps));
        player.frame = frameByTime;

        if (t >= ATTACK_TOTAL_MS) {
          player.state = "idle";
          player.frame = 0;
          player.acc = 0;
        }
      }

      // страховка: смерть по таймеру
      if (player.state === "die") {
        if (player.dieStartedAt === 0) player.dieStartedAt = now;
        if (!player.dead && now - player.dieStartedAt >= DIE_DURATION_MS - 10) {
          player.dead = true;
          running = false;
          const ms = now - startRef.current;
          setElapsedMs(ms);
          setGameOver(true);
        }
      }

      // неуязвимость игрока после урона
      const playerInvuln = now - player.hurtAt < INVULN_MS;

      // === ИИ и анимации всех гоблинов ===
      for (const g of goblins) {
        if (g.dead) continue;

        const dx = player.x - g.x;
        const dy = player.y - g.y;
        const dist = Math.hypot(dx, dy);
        g.dir = dx >= 0 ? 1 : -1;

        if (g.state !== "die" && dist > 22) {
          if (g.state !== "attack") {
            g.state = "run";
            const glen = dist || 1;
            tryMove(
              g,
              (dx / glen) * ENEMY_SPEED * dt,
              (dy / glen) * ENEMY_SPEED * dt
            );
          }
        } else if (g.state !== "die") {
          if (g.state !== "attack") {
            g.state = "attack";
            g.frame = 0;
            g.acc = 0;
            g.attackStartedAt = now;
          }
        }

        const gm =
          goblinSprites[
            g.state === "die"
              ? "die"
              : g.state === "attack"
              ? "attack"
              : g.state === "run"
              ? "run"
              : "idle"
          ];
        g.acc += dt;
        if (g.acc >= 1 / gm.fps) {
          g.acc = 0;
          if (g.state === "die") {
            if (g.frame < gm.cols - 1) g.frame += 1;
            else g.dead = true;
          } else {
            g.frame = (g.frame + 1) % gm.cols;
          }
        }
      }

      // урон гоблинам от атаки игрока
      if (player.state === "attack") {
        const hb = attackHitbox(player);
        for (const g of goblins) {
          if (g.dead || g.state === "die") continue;
          const gobRect = {
            x: g.x + 4,
            y: g.y + 6,
            w: g.w - 8,
            h: g.h - 10,
          };
          if (aabb(hb, gobRect) && now - g.hurtAt > 200) {
            g.hp -= 1;
            g.hurtAt = now;
            if (g.hp <= 0) {
              g.state = "die";
              g.frame = 0;
              g.acc = 0;
              setKills((k) => k + 1); // считаем убийство
            }
          }
        }
      }

      // урон игроку от атакующих гоблинов
      for (const g of goblins) {
        if (g.dead || g.state !== "attack" || player.dead) continue;
        const gb = goblinHitbox(g);
        if (!playerInvuln && aabb(gb, player)) {
          player.hp = Math.max(0, player.hp - 1);
          player.hurtAt = now;
          if (player.hp <= 0 && player.state !== "die") {
            player.state = "die";
            player.frame = 0;
            player.acc = 0;
            player.dieStartedAt = now;
          }
        }
        if (now - g.attackStartedAt > ENEMY_ATTACK_TIME) {
          g.state = "idle";
        }
      }

      // подчистка мёртвых гоблинов
      for (let i = goblins.length - 1; i >= 0; i--) {
        if (goblins[i].dead) goblins.splice(i, 1);
      }

      // камера
      cam.x = Math.floor(player.x + player.w / 2 - VIEW_W / 2);
      cam.y = Math.floor(player.y + player.h / 2 - VIEW_H / 2);
      cam.x = Math.max(0, Math.min(cam.x, MAP[0].length * TILE - VIEW_W));
      cam.y = Math.max(0, Math.min(cam.y, MAP.length * TILE - VIEW_H));
    }

    function render() {
      // фон
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#223b27";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let y = 0; y < MAP.length; y++)
        for (let x = 0; x < MAP[0].length; x++) {
          const dx = x * TILE - cam.x,
            dy = y * TILE - cam.y;
          ctx.fillStyle = MAP[y][x] === 1 ? "#2a2f38" : "#2e6b3c";
          ctx.fillRect(dx, dy, TILE, TILE);
        }
      ctx.strokeStyle = "rgba(0,0,0,.25)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-0.5, -0.5, VIEW_W + 1, VIEW_H + 1);

      // меч
      if (!swordPickup.picked) {
        const dx = swordPickup.x - cam.x,
          dy = swordPickup.y - cam.y;
        ctx.fillStyle = "#e7e7e7";
        ctx.fillRect(dx, dy, swordPickup.w, swordPickup.h);
        ctx.fillStyle = "#444";
        ctx.fillRect(dx + 2, dy + 2, swordPickup.w - 4, swordPickup.h - 4);
      }

      // СЕРДЦА
      for (const h of hearts) {
        const dx = h.x - cam.x;
        const dy = h.y - cam.y;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(dx + 2, dy + 3, h.w, h.h);
        ctx.fillStyle = "#e53935";
        ctx.fillRect(dx, dy, h.w, h.h);
        ctx.strokeStyle = "#7f1d1d";
        ctx.lineWidth = 2;
        ctx.strokeRect(dx + 0.5, dy + 0.5, h.w - 1, h.h - 1);
      }

      // гоблины
      for (const g of goblins) {
        const gkey = goblinSpriteKey(g);
        const gimg = gkey ? images[gkey] : null;
        if (gimg && gimg.complete) {
          const sx = g.frame * GOB_W;
          drawFlippable(
            ctx,
            gimg,
            sx,
            0,
            GOB_W,
            GOB_H,
            g.x - cam.x,
            g.y - cam.y,
            g.dir === -1
          );
        }
        if (!g.dead) {
          ctx.fillStyle = "#000";
          ctx.fillRect(g.x - cam.x + 2, g.y - cam.y - 4, 14, 3);
          ctx.fillStyle = "#5cdd58";
          ctx.fillRect(
            g.x - cam.x + 2,
            g.y - cam.y - 4,
            Math.max(0, g.hp / 3) * 14,
            3
          );
        }
      }

      // игрок
      {
        const pkey = spriteKey(player);
        const pimg = images[pkey];
        if (!player.dead && pimg && pimg.complete) {
          const sx = player.frame * FRAME_W;
          drawFlippable(
            ctx,
            pimg,
            sx,
            0,
            FRAME_W,
            FRAME_H,
            player.x - cam.x,
            player.y - cam.y,
            player.dir === -1
          );
        }
        if (player.state === "attack") {
          const hb = attackHitbox(player);
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = "#ffd34a";
          ctx.fillRect(hb.x - cam.x, hb.y - cam.y, hb.w, hb.h);
          ctx.globalAlpha = 1;
        }
      }

      // UI HP
      ctx.fillStyle = "#000";
      ctx.fillRect(8, 8, 60, 6);
      ctx.fillStyle = "#f44";
      ctx.fillRect(8, 8, Math.max(0, player.hp / MAX_HP) * 60, 6);
    }

    requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [images, keys, restartKey]);

  return (
    <div className={styles.canvasWrap}>
      <canvas ref={canvasRef} className={styles.canvas} />

      {/* Мобильный UI при ширине < 1280 */}
      {isMobile && (
        <MobileJoystick
          onDirKeysChange={setDirKeys}
          onAttackDown={pressAttack}
          onAttackUp={releaseAttack}
        />
      )}

      {gameOver && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2>Игра окончена</h2>
            <p>Время: {(elapsedMs / 1000).toFixed(2)} сек.</p>
            <p>Убито гоблинов: {kills}</p>
            <div
              className={styles.btn}
              onClick={() => setRestartKey((k) => k + 1)}
            >
              Играть снова (R)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
