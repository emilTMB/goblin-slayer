import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "../styles/Game.module.scss";
import useKeyboard from "./useKeyboard";

const asset = (p) => `${import.meta.env.BASE_URL}${p.replace(/^\//, "")}`;

/** === РАЗМЕРЫ КАДРОВ / ТАЙЛОВ ===
 * В исходных спрайтах кадр 16×24.
 */
const FRAME_SRC_W = 16;
const FRAME_SRC_H = 24;
const FRAME_W = FRAME_SRC_W;
const FRAME_H = FRAME_SRC_H;

const GOB_SRC_W = 16;
const GOB_SRC_H = 24;
const GOB_W = GOB_SRC_W;
const GOB_H = GOB_SRC_H;

const TILE = 32;

// Окно камеры (логический размер)
const VIEW_W = 320;
const VIEW_H = 240;

// Базовые константы
const BASE_PLAYER_SPEED = 85; // px/s
const ENEMY_SPEED = 45;
const ENEMY_ATTACK_TIME = 300; // ms
const INVULN_MS = 400;
const BASE_MAX_HP = 3;

// Взрыв фаербола
const STAFF_EXPLOSION_MS = 250; // сколько живёт эффект взрыва

// Порог для мобильного UI
const MOBILE_WIDTH = 1280;

// Плавность камеры (чем больше, тем быстрее догоняет)
const CAM_LERP = 10;

// Длительность нокбэка
const KNOCKBACK_DURATION_MS = 250;

// Как часто гоблины пересчитывают путь к игроку
const GOBLIN_REPATH_MS = 400;

// ==== ПУТИ К ИКОНКАМ ЛУТА / UI ====
const ICONS = {
  sword: asset("/assets/utils-png/sword-pixel-attack.png"),
  bow: asset("/assets/utils-png/bow-pixel-attack.png"),
  staff: asset("/assets/utils-png/staff-pixel-attack.png"),
  heart: asset("/assets/utils-png/heart-pixel.png"),
};

// ==== КЛАССЫ ПЕРСОНАЖА ====
const CLASS_CONFIG = {
  warrior: {
    name: "Воин",
    spriteSheet: asset("assets/player-animation/fiter/sprite_.png"),
    maxHp: 5,
    speed: BASE_PLAYER_SPEED - 40, // замедлили воина
    ability: "slam",
    abilityCooldownMs: 1500,
  },
  rogue: {
    name: "Разбойник",
    spriteSheet: asset("assets/player-animation/rouge/sprite_.png"),
    maxHp: BASE_MAX_HP,
    speed: BASE_PLAYER_SPEED * 1.5,
    ability: "trap",
    abilityCooldownMs: 1500,
  },
  wizard: {
    name: "Маг",
    spriteSheet: asset("assets/player-animation/wizard/sprite_.png"),
    maxHp: BASE_MAX_HP,
    speed: BASE_PLAYER_SPEED * 0.9,
    ability: "blink",
    abilityCooldownMs: 1000,
  },
};

// === АНИМАЦИИ ИГРОКА ===

// Базовые строки (без оружия, индексы по 0)
const PLAYER_ROWS_BASE = {
  idle: 0,
  run: 1,
  sleep: 36,
  die: 3,
};

const BLINK_ROW = 47; // строка анимации блинка

// DoT от стрелы
const ARROW_HIT_DAMAGE = 1; // урон при попадании
const ARROW_DOT_DAMAGE = 1; // урон за тик
const ARROW_DOT_TICKS = 3; // сколько тиков после первого удара
const ARROW_DOT_INTERVAL_MS = 600; // интервал между тиками

// Строки для оружия
const PLAYER_WEAPON_ROWS = {
  sword: {
    idle: 91,
    run: 97,
    attack: 112, // обычная атака
  },
  bow: {
    idle: 95,
    run: 101,
    attack: 104,
  },
  staff: {
    idle: 93,
    run: 99,
    attack: 113,
  },
};

// Строки для АБИЛОК
const PLAYER_ABILITY_ROWS = {
  // скилл воина (отбрасывание) — строка 115
  slam: 115,
};

// Кол-во кадров и FPS
const PLAYER_FRAMES = {
  idle: { cols: 4, fps: 6 },
  run: { cols: 4, fps: 10 },
  attack: { cols: 6, fps: 14 },
  die: { cols: 4, fps: 6 },
  sleep: { cols: 6, fps: 5 },
  blink: { cols: 6, fps: 14 },
};

const ATTACK_TOTAL_MS =
  (PLAYER_FRAMES.attack.cols / PLAYER_FRAMES.attack.fps) * 1000;
const BLINK_DURATION_MS =
  (PLAYER_FRAMES.blink.cols / PLAYER_FRAMES.blink.fps) * 1000;

// === СПРАЙТЫ ГОБЛИНА ===
const goblinSprites = {
  idle: { src: asset("assets/goblin/goblin-idle.png"), cols: 4, fps: 6 },
  run: { src: asset("assets/goblin/goblin-run.png"), cols: 4, fps: 10 },
  attack: { src: asset("assets/goblin/goblin-attack.png"), cols: 6, fps: 12 },
  die: { src: asset("assets/goblin/goblin-die.png"), cols: 4, fps: 8 },
};

// === МИРЫ / ЛОКАЦИИ ===
const WORLDS = {
  overworld: {
    name: "Поверхность",
    map: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
    defaultSpawn: { tx: 2, ty: 2 },
    spawnPoints: [
      { x: 8, y: 6 },
      { x: 9, y: 2 },
      { x: 2, y: 7 },
      { x: 10, y: 7 },
    ],
    weaponTiles: [
      { type: "sword", x: 3, y: 2, color: "#ffffff" },
      { type: "bow", x: 4, y: 2, color: "#00c853" },
      { type: "staff", x: 5, y: 2, color: "#ffeb3b" },
    ],
    exits: [
      {
        tx: 12,
        ty: 1,
        targetWorld: "dungeon1",
        targetSpawn: { tx: 1, ty: 1 },
      },
      {
        tx: 12,
        ty: 2,
        targetWorld: "dungeon1",
        targetSpawn: { tx: 1, ty: 2 },
      },
      {
        tx: 12,
        ty: 3,
        targetWorld: "dungeon1",
        targetSpawn: { tx: 1, ty: 3 },
      },
      {
        tx: 12,
        ty: 4,
        targetWorld: "dungeon1",
        targetSpawn: { tx: 1, ty: 4 },
      },
      {
        tx: 12,
        ty: 5,
        targetWorld: "dungeon1",
        targetSpawn: { tx: 1, ty: 5 },
      },
      {
        tx: 12,
        ty: 6,
        targetWorld: "dungeon1",
        targetSpawn: { tx: 1, ty: 6 },
      },
      {
        tx: 12,
        ty: 7,
        targetWorld: "dungeon1",
        targetSpawn: { tx: 1, ty: 7 },
      },
      {
        tx: 12,
        ty: 8,
        targetWorld: "dungeon1",
        targetSpawn: { tx: 1, ty: 8 },
      },
      {
        tx: 12,
        ty: 9,
        targetWorld: "dungeon1",
        targetSpawn: { tx: 1, ty: 9 },
      },
      {
        tx: 12,
        ty: 10,
        targetWorld: "dungeon1",
        targetSpawn: { tx: 1, ty: 10 },
      },
    ],
  },

  dungeon1: {
    name: "Данж 1",
    map: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
      [0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1],
      [0, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 1],
      [0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0, 1],
      [0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
      [0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
      [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
    defaultSpawn: { tx: 2, ty: 8 },
    spawnPoints: [{ x: 6, y: 5 }],
    weaponTiles: [],
    exits: [
      {
        tx: -1,
        ty: 1,
        targetWorld: "overworld",
        targetSpawn: { tx: 11, ty: 1 },
      },
      {
        tx: -1,
        ty: 2,
        targetWorld: "overworld",
        targetSpawn: { tx: 11, ty: 2 },
      },
      {
        tx: -1,
        ty: 3,
        targetWorld: "overworld",
        targetSpawn: { tx: 11, ty: 3 },
      },
      {
        tx: -1,
        ty: 4,
        targetWorld: "overworld",
        targetSpawn: { tx: 11, ty: 4 },
      },
      {
        tx: -1,
        ty: 5,
        targetWorld: "overworld",
        targetSpawn: { tx: 11, ty: 5 },
      },
      {
        tx: -1,
        ty: 6,
        targetWorld: "overworld",
        targetSpawn: { tx: 11, ty: 6 },
      },
      {
        tx: -1,
        ty: 7,
        targetWorld: "overworld",
        targetSpawn: { tx: 11, ty: 7 },
      },
      {
        tx: -1,
        ty: 8,
        targetWorld: "overworld",
        targetSpawn: { tx: 11, ty: 8 },
      },
      {
        tx: -1,
        ty: 9,
        targetWorld: "overworld",
        targetSpawn: { tx: 11, ty: 9 },
      },
      {
        tx: -1,
        ty: 10,
        targetWorld: "overworld",
        targetSpawn: { tx: 11, ty: 10 },
      },
    ],
  },
};

// Параметры сердец
const HEART_SIZE = TILE - 20;
const HEART_HEAL = 1;
const HEART_SPAWN_INTERVAL_MS = 5000;
const HEART_DESPAWN_MS = 12000;
const MAX_HEARTS = 2;

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

// sw/sh — размер кадра в спрайте, dw/dh — во сколько рисуем
function drawFlippable(
  ctx,
  img,
  sx,
  sy,
  sw,
  sh,
  dx,
  dy,
  dw,
  dh,
  flipX = false
) {
  dx = Math.round(dx);
  dy = Math.round(dy);
  dw = Math.round(dw);
  dh = Math.round(dh);

  if (!flipX) {
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }
  ctx.save();
  ctx.translate(dx + dw, dy);
  ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  ctx.restore();
}

/** =========================
 * Мобильный джойстик (D-pad + атака + способность)
 * ========================= */
function MobileJoystick({
  onDirKeysChange,
  onAttackDown,
  onAttackUp,
  onAbilityDown,
  onAbilityUp,
  attackIconSrc,
}) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const updateFromTouch = (touch) => {
    const el = baseRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;

    const dotRadius = 22;
    const maxR = rect.width / 2 - dotRadius;
    const r = Math.hypot(dx, dy);

    const dead = 14;
    const axisDead = 6;

    if (r > maxR) {
      dx = (dx / r) * maxR;
      dy = (dy / r) * maxR;
    }

    setKnob({ x: dx, y: dy });

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
    setKnob({ x: 0, y: 0 });
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
      <div className={styles.btnsMobile}>
        {/* Кнопка способности (Q) */}
        <button
          className={styles.attackBtn}
          style={{ width: 90, height: 90, marginRight: 8 }}
          onTouchStart={(e) => {
            e.preventDefault();
            onAbilityDown();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            onAbilityUp();
          }}
          onTouchCancel={(e) => {
            e.preventDefault();
            onAbilityUp();
          }}
        >
          <span style={{ pointerEvents: "none" }}>
            <img
              src="assets/utils-png/star.png"
              className={styles.swordBtn}
              alt="ability"
            />
          </span>
        </button>

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
          <img src={attackIconSrc} className={styles.swordBtn} alt="attack" />
        </button>
      </div>
    </div>
  );
}

export default function CanvasGame() {
  const canvasRef = useRef(null);
  const keys = useKeyboard();
  const [restartKey, setRestartKey] = useState(0);

  const [playerClass, setPlayerClass] = useState(null);

  // какая карта сейчас активна
  const [mapId, setMapId] = useState("overworld");

  // куда ставить игрока при входе на карту (в тайлах)
  const [spawnInfo, setSpawnInfo] = useState(null);

  // overlay
  const [gameOver, setGameOver] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [kills, setKills] = useState(0);
  const startRef = useRef(performance.now());

  // глобальные HP и оружие (сохраняются между переходами по картам)
  const hpRef = useRef(null);
  const weaponRef = useRef(null);

  // === PERSISTENT LOOT ===
  // храним инфу о собранных предметах между переходами по картам
  // структура: { [mapId]: { weapons: { [key]: true } } }
  const globalLootRef = useRef({});

  // HUD по оружию (для DOM-текста)
  const [weaponHud, setWeaponHud] = useState("нет");

  // масштаб игры (не даём спрайтам искажаться)
  const [scale, setScale] = useState(1);

  // мобильный порог
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_WIDTH : true
  );

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < MOBILE_WIDTH);

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const s = Math.floor(Math.min(vw / VIEW_W, vh / VIEW_H));
      setScale(s > 0 ? s : 1);
    };

    onResize();
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
  const pressAbility = () => virtualKeysRef.current.add("q");
  const releaseAbility = () => virtualKeysRef.current.delete("q");

  // текущая иконка для кнопки атаки (по оружию)
  const attackIconSrc = useMemo(() => {
    if (weaponHud === "sword") return ICONS.sword;
    if (weaponHud === "bow") return ICONS.bow;
    if (weaponHud === "staff") return ICONS.staff;
    return ICONS.sword;
  }, [weaponHud]);

  // загружаем только текущий класс + гоблинов + иконки лута
  const images = useMemo(() => {
    if (!playerClass) return {};
    const o = {};
    const cfg = CLASS_CONFIG[playerClass];
    o.player = loadImage(cfg.spriteSheet);
    for (const k in goblinSprites)
      o["g_" + k] = loadImage(goblinSprites[k].src);

    o.loot_sword = loadImage(ICONS.sword);
    o.loot_bow = loadImage(ICONS.bow);
    o.loot_staff = loadImage(ICONS.staff);
    o.loot_heart = loadImage(ICONS.heart);

    return o;
  }, [restartKey, playerClass]);

  useEffect(() => {
    if (!playerClass) return;

    const world = WORLDS[mapId];
    if (!world) return;

    const MAP = world.map;
    const SPAWN_POINTS = world.spawnPoints;
    const WEAPON_TILES = world.weaponTiles;
    const EXIT_TILES = world.exits;

    const cfg = CLASS_CONFIG[playerClass];
    const MAX_HP = cfg.maxHp;
    const PLAYER_SPEED = cfg.speed;

    const isPortalSpawn = spawnInfo && spawnInfo.mapId === mapId;

    if (!isPortalSpawn) {
      hpRef.current = MAX_HP;
      weaponRef.current = null;
    } else {
      if (hpRef.current == null) hpRef.current = MAX_HP;
    }

    setWeaponHud(weaponRef.current || "нет");

    startRef.current = performance.now();
    setGameOver(false);
    setElapsedMs(0);
    setKills(0);

    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    c.width = VIEW_W;
    c.height = VIEW_H;

    const solids = [];
    const floorTiles = [];
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[0].length; x++) {
        if (MAP[y][x] === 1)
          solids.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE });
        else floorTiles.push({ tx: x, ty: y });
      }
    }

    const MAP_H = MAP.length;
    const MAP_W = MAP[0].length;

    const isInsideMap = (tx, ty) =>
      tx >= 0 && ty >= 0 && ty < MAP_H && tx < MAP_W;

    const isWalkableTile = (tx, ty) => isInsideMap(tx, ty) && MAP[ty][tx] === 0;

    const worldToTile = (x, y) => ({
      tx: Math.floor(x / TILE),
      ty: Math.floor(y / TILE),
    });

    const tileToWorldCenter = (tx, ty) => ({
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
    });

    // === ПРОВЕРКА ЛИНИИ ВИДИМОСТИ (без стен) ===
    function hasLineOfSight(from, to) {
      const fromCenter = {
        x: from.x + from.w / 2,
        y: from.y + from.h / 2,
      };
      const toCenter = {
        x: to.x + to.w / 2,
        y: to.y + to.h / 2,
      };

      const dx = toCenter.x - fromCenter.x;
      const dy = toCenter.y - fromCenter.y;
      const dist = Math.hypot(dx, dy) || 1;

      // Чем больше шагов, тем точнее – берём примерно по 1/4 тайла
      const stepLen = TILE / 4;
      const steps = Math.max(1, Math.ceil(dist / stepLen));

      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = fromCenter.x + dx * t;
        const py = fromCenter.y + dy * t;

        const tx = Math.floor(px / TILE);
        const ty = Math.floor(py / TILE);

        // всё, что вне карты, считаем стеной
        if (!isInsideMap(tx, ty)) {
          return false;
        }

        if (MAP[ty][tx] === 1) {
          // Стена между мобом и игроком – LOS нет
          return false;
        }
      }

      return true;
    }

    // === ПОИСК ПУТИ (A* по тайлам, с диагоналями) ===
    function findPath(startTx, startTy, endTx, endTy) {
      if (!isWalkableTile(startTx, startTy)) return [];

      // если конечный тайл не проходим, ищем ближайший проходимый вокруг
      if (!isWalkableTile(endTx, endTy)) {
        let found = false;
        outer: for (let r = 1; r <= 2; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const nx = endTx + dx;
              const ny = endTy + dy;
              if (isWalkableTile(nx, ny)) {
                endTx = nx;
                endTy = ny;
                found = true;
                break outer;
              }
            }
          }
        }
        if (!found) return [];
      }

      const key = (x, y) => `${x},${y}`;
      const open = [];
      const gScore = {};
      const fScore = {};
      const cameFrom = {};
      const inOpen = new Set();

      const h = (x, y) => Math.hypot(x - endTx, y - endTy);

      const startKey = key(startTx, startTy);
      gScore[startKey] = 0;
      fScore[startKey] = h(startTx, startTy);
      open.push({ tx: startTx, ty: startTy, f: fScore[startKey] });
      inOpen.add(startKey);

      const dirs = [
        { dx: 1, dy: 0, cost: 1 },
        { dx: -1, dy: 0, cost: 1 },
        { dx: 0, dy: 1, cost: 1 },
        { dx: 0, dy: -1, cost: 1 },
        { dx: 1, dy: 1, cost: Math.SQRT2 },
        { dx: 1, dy: -1, cost: Math.SQRT2 },
        { dx: -1, dy: 1, cost: Math.SQRT2 },
        { dx: -1, dy: -1, cost: Math.SQRT2 },
      ];

      while (open.length > 0) {
        // достаём узел с минимальным f
        let bestIndex = 0;
        for (let i = 1; i < open.length; i++) {
          if (open[i].f < open[bestIndex].f) bestIndex = i;
        }
        const current = open.splice(bestIndex, 1)[0];
        const cKey = key(current.tx, current.ty);
        inOpen.delete(cKey);

        if (current.tx === endTx && current.ty === endTy) {
          // восстанавливаем путь
          const path = [];
          let k = cKey;
          while (k !== startKey) {
            const [cx, cy] = k.split(",").map(Number);
            path.push({ tx: cx, ty: cy });
            k = cameFrom[k];
          }
          path.reverse();
          return path;
        }

        for (const d of dirs) {
          const nx = current.tx + d.dx;
          const ny = current.ty + d.dy;
          if (!isWalkableTile(nx, ny)) continue;

          // запрет "срезать" угол по диагонали
          if (d.dx !== 0 && d.dy !== 0) {
            if (
              !isWalkableTile(current.tx + d.dx, current.ty) ||
              !isWalkableTile(current.tx, current.ty + d.dy)
            ) {
              continue;
            }
          }

          const nKey = key(nx, ny);
          const tentativeG = gScore[cKey] + d.cost;

          if (gScore[nKey] === undefined || tentativeG < gScore[nKey]) {
            cameFrom[nKey] = cKey;
            gScore[nKey] = tentativeG;
            fScore[nKey] = tentativeG + h(nx, ny);
            if (!inOpen.has(nKey)) {
              open.push({ tx: nx, ty: ny, f: fScore[nKey] });
              inOpen.add(nKey);
            }
          }
        }
      }

      return [];
    }

    // === PERSISTENT LOOT ===
    // читаем, какие оружия уже подобраны на этой карте
    const globalWeapons =
      (globalLootRef.current[mapId] && globalLootRef.current[mapId].weapons) ||
      {};

    const weaponPickups = WEAPON_TILES.map((w) => {
      const key = `${w.x},${w.y},${w.type}`;
      const picked = !!globalWeapons[key];
      return {
        key,
        type: w.type,
        color: w.color,
        x: w.x * TILE + TILE / 4,
        y: w.y * TILE + TILE / 4,
        w: TILE / 2,
        h: TILE / 2,
        picked,
      };
    });

    const spawn =
      spawnInfo && spawnInfo.mapId === mapId
        ? spawnInfo
        : { mapId, tx: world.defaultSpawn.tx, ty: world.defaultSpawn.ty };

    const startHp = Math.min(
      hpRef.current != null ? hpRef.current : MAX_HP,
      MAX_HP
    );

    const player = {
      x: spawn.tx * TILE,
      y: spawn.ty * TILE,
      w: FRAME_W,
      h: FRAME_H,
      dir: 1,
      state: "sleep",
      frame: 0,
      acc: 0,
      weapon: weaponRef.current,
      attackStartedAt: 0,
      hp: startHp,
      hurtAt: -9999,
      dead: false,
      dieStartedAt: 0,
      abilityType: cfg.ability,
      abilityLastUsedAt: -9999,
      abilityCooldownMs: cfg.abilityCooldownMs,
      blinkStartedAt: 0,
      blinkTargetX: null,
      abilityAnimStartedAt: 0,
    };

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
        stunnedUntil: 0,
        knockbackVx: 0,
        knockbackVy: 0,
        knockbackEndAt: 0,
        dotType: null,
        dotNextTickAt: 0,
        dotTicksLeft: 0,

        // === ИИ-поля ===
        hasSeenPlayer: false, // уже видел игрока?
        path: [], // путь в тайлах [{tx,ty}, ...]
        pathIndex: 0, // текущая цель в path
        lastPathfindAt: 0, // когда в последний раз считали путь
        pathTargetTx: null, // к какому тайлу игрока строили путь
        pathTargetTy: null,
      };
    }

    const goblins = [];
    if (SPAWN_POINTS && SPAWN_POINTS.length > 0) {
      goblins.push(makeGoblin(SPAWN_POINTS[0].x, SPAWN_POINTS[0].y));
    }
    let nextSpawnAt = performance.now() + 4000;

    const hearts = [];
    let nextHeartAt = performance.now() + HEART_SPAWN_INTERVAL_MS;

    const traps = [];
    const projectiles = [];
    const explosions = [];

    function spawnHeart(now) {
      if (hearts.length >= MAX_HEARTS) return;
      const tile = floorTiles[Math.floor(Math.random() * floorTiles.length)];
      const size = HEART_SIZE;
      const x = tile.tx * TILE + Math.round((TILE - size) / 2);
      const y = tile.ty * TILE + Math.round((TILE - size) / 2);
      const heartRect = { x, y, w: size, h: size };
      for (const s of solids) if (aabb(heartRect, s)) return;
      for (const w of weaponPickups)
        if (!w.picked && aabb(heartRect, w)) return;
      hearts.push({ x, y, w: size, h: size, createdAt: now });
      nextHeartAt =
        now + HEART_SPAWN_INTERVAL_MS + Math.floor(Math.random() * 2000);
    }

    const cam = { x: 0, y: 0 };

    {
      const worldW = MAP[0].length * TILE;
      const worldH = MAP.length * TILE;
      const maxCamX = worldW - VIEW_W;
      const maxCamY = worldH - VIEW_H;

      let initX = Math.floor(player.x + player.w / 2 - VIEW_W / 2);
      let initY = Math.floor(player.y + player.h / 2 - VIEW_H / 2);

      cam.x = Math.max(0, Math.min(initX, maxCamX));
      cam.y = Math.max(0, Math.min(initY, maxCamY));
    }

    let last = performance.now();
    let lastNow = performance.now();
    let running = true;
    let rafId = 0;

    const onKey = (e) => {
      if (e.key.toLowerCase() === "r") {
        running = false;
        setSpawnInfo(null);
        // === PERSISTENT LOOT RESET ON NEW RUN ===
        globalLootRef.current = {};
        setRestartKey((k) => k + 1);
      }
    };
    window.addEventListener("keydown", onKey, { passive: false });

    const hitsSolids = (rect) => {
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

    function tryMove(ent, dx, dy) {
      const full = { x: ent.x + dx, y: ent.y + dy, w: ent.w, h: ent.h };
      if (!hitsSolids(full)) {
        ent.x = full.x;
        ent.y = full.y;
        return;
      }

      const onlyX = { x: ent.x + dx, y: ent.y, w: ent.w, h: ent.h };
      if (!hitsSolids(onlyX)) {
        ent.x = onlyX.x;
      }

      const onlyY = { x: ent.x, y: ent.y + dy, w: ent.w, h: ent.h };
      if (!hitsSolids(onlyY)) {
        ent.y = onlyY.y;
      }
    }

    function getPlayerAnimMeta(p) {
      if (p.state === "sleep") return PLAYER_FRAMES.sleep;
      if (p.state === "die") return PLAYER_FRAMES.die;
      if (p.state === "blink") return PLAYER_FRAMES.blink;
      if (p.state === "attack") return PLAYER_FRAMES.attack;
      if (p.state === "ability") return PLAYER_FRAMES.attack;
      if (p.state === "run") return PLAYER_FRAMES.run;
      return PLAYER_FRAMES.idle;
    }

    function getPlayerRow(p) {
      if (p.state === "sleep") return PLAYER_ROWS_BASE.sleep;
      if (p.state === "die") return PLAYER_ROWS_BASE.die;
      if (p.state === "blink") return BLINK_ROW;

      const wRows = p.weapon ? PLAYER_WEAPON_ROWS[p.weapon] : null;

      if (p.state === "ability") {
        if (p.abilityType === "slam") {
          return PLAYER_ABILITY_ROWS.slam;
        }
        if (wRows) return wRows.attack;
        return PLAYER_ROWS_BASE.run;
      }

      if (p.state === "attack") {
        if (wRows) return wRows.attack;
        return PLAYER_ROWS_BASE.run;
      }

      if (p.state === "run") {
        if (wRows) return wRows.run;
        return PLAYER_ROWS_BASE.run;
      }

      if (wRows) return wRows.idle;
      return PLAYER_ROWS_BASE.idle;
    }

    function goblinSpriteKey(g) {
      if (g.dead) return null;
      if (g.state === "die") return "g_die";
      if (g.state === "attack") return "g_attack";
      if (g.state === "run") return "g_run";
      return "g_idle";
    }

    function attackHitbox(p) {
      const w = 14;
      const h = 12;
      const x = p.dir === 1 ? p.x + p.w - 4 : p.x - w + 4;
      const y = p.y + p.h / 2 - h / 2;
      return { x, y, w, h };
    }

    function goblinHitbox(g) {
      const w = 12;
      const h = 12;
      const x = g.dir === 1 ? g.x + g.w - 6 : g.x - w + 6;
      const y = g.y + g.h / 2 - h / 2;
      return { x, y, w, h };
    }

    function spawnGoblin(now) {
      if (goblins.length >= 3) return;
      if (!SPAWN_POINTS || SPAWN_POINTS.length === 0) return;
      const pt = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
      goblins.push(makeGoblin(pt.x, pt.y));
      nextSpawnAt = now + 4000;
    }

    function spawnProjectile(type) {
      const speed = type === "arrow" ? 260 : 200;
      const radius = type === "arrow" ? 6 : 10;
      const dirX = player.dir || 1;

      projectiles.push({
        type,
        x: player.x + player.w / 2,
        y: player.y + player.h / 2,
        vx: dirX * speed,
        vy: 0,
        radius,
      });
    }

    function damageGoblin(g, dmg, now) {
      if (g.dead || g.state === "die") return;
      g.hp -= dmg;
      g.hurtAt = now;
      if (g.hp <= 0) {
        g.state = "die";
        g.frame = 0;
        g.acc = 0;
        g.dead = false;
        setKills((k) => k + 1);
      }
    }

    function loop(now) {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      lastNow = now;
      update(dt, now);
      render();
      rafId = requestAnimationFrame(loop);
    }

    function update(dt, now) {
      const mergedKeys = new Set([...keys.current, ...virtualKeysRef.current]);

      if (player.state === "sleep") {
        if (mergedKeys.size > 0) {
          player.state = "idle";
          player.frame = 0;
          player.acc = 0;
        } else {
          const meta = PLAYER_FRAMES.sleep;
          player.acc += dt;
          if (player.acc >= 1 / meta.fps) {
            player.acc = 0;
            player.frame = (player.frame + 1) % meta.cols;
          }
          return;
        }
      }

      if (now >= nextSpawnAt) spawnGoblin(now);
      if (now >= nextHeartAt) spawnHeart(now);

      let mx = 0,
        my = 0;
      if (
        player.state !== "die" &&
        player.state !== "blink" &&
        player.state !== "ability"
      ) {
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

      const attackPressed =
        (mergedKeys.has(" ") || mergedKeys.has("enter")) &&
        player.state !== "attack" &&
        player.state !== "die" &&
        player.state !== "blink" &&
        player.state !== "ability" &&
        !!player.weapon;

      if (attackPressed) {
        player.state = "attack";
        player.frame = 0;
        player.acc = 0;
        player.attackStartedAt = now;

        if (player.weapon === "bow") {
          spawnProjectile("arrow");
        } else if (player.weapon === "staff") {
          spawnProjectile("staff");
        }
      }

      const len = Math.hypot(mx, my) || 1;
      if (
        player.state !== "attack" &&
        player.state !== "die" &&
        player.state !== "blink" &&
        player.state !== "ability" &&
        (mx || my)
      ) {
        tryMove(
          player,
          (mx / len) * PLAYER_SPEED * dt,
          (my / len) * PLAYER_SPEED * dt
        );
        player.state = "run";
      } else if (
        player.state !== "attack" &&
        player.state !== "die" &&
        player.state !== "blink" &&
        player.state !== "ability"
      ) {
        player.state = "idle";
      }

      // === ПРОВЕРКА ВЫХОДА НА ДРУГУЮ КАРТУ ===
      {
        const centerX = player.x + player.w / 2;
        const centerY = player.y + player.h / 2;
        const tileX = Math.floor(centerX / TILE);
        const tileY = Math.floor(centerY / TILE);

        const exit = EXIT_TILES.find((e) => e.tx === tileX && e.ty === tileY);

        if (exit) {
          running = false;
          setSpawnInfo({
            mapId: exit.targetWorld,
            tx: exit.targetSpawn.tx,
            ty: exit.targetSpawn.ty,
          });
          setMapId(exit.targetWorld);
          return;
        }
      }

      // ПОДБОР ОРУЖИЯ (с сохранением между картами)
      for (const w of weaponPickups) {
        if (!w.picked && aabb(player, w)) {
          w.picked = true;
          player.weapon = w.type;
          weaponRef.current = w.type;
          setWeaponHud(w.type);
          player.state = "idle";
          player.frame = 0;
          player.acc = 0;

          // === PERSISTENT LOOT: запоминаем, что этот предмет на этой карте подобран ===
          if (!globalLootRef.current[mapId]) {
            globalLootRef.current[mapId] = { weapons: {} };
          }
          globalLootRef.current[mapId].weapons[w.key] = true;
        }
      }

      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i];
        if (now - h.createdAt >= HEART_DESPAWN_MS) {
          hearts.splice(i, 1);
          continue;
        }
        if (!player.dead && aabb(player, h) && player.hp < MAX_HP) {
          player.hp = Math.min(MAX_HP, player.hp + HEART_HEAL);
          hpRef.current = player.hp;
          hearts.splice(i, 1);
        }
      }

      const animMeta = getPlayerAnimMeta(player);

      player.acc += dt;
      if (player.acc >= 1 / animMeta.fps) {
        player.acc = 0;

        if (player.state === "die") {
          if (player.frame < animMeta.cols - 1) {
            player.frame += 1;
          } else if (!player.dead) {
            player.dead = true;
            running = false;
            const ms = now - startRef.current;
            setElapsedMs(ms);
            setGameOver(true);
          }
        } else if (
          player.state !== "attack" &&
          player.state !== "blink" &&
          player.state !== "ability"
        ) {
          player.frame = (player.frame + 1) % animMeta.cols;
        }
      }

      if (player.state === "attack") {
        const t = now - player.attackStartedAt;
        const cols = PLAYER_FRAMES.attack.cols;
        const fps = PLAYER_FRAMES.attack.fps;
        const frameByTime = Math.min(cols - 1, Math.floor((t / 1000) * fps));
        player.frame = frameByTime;

        if (t >= ATTACK_TOTAL_MS) {
          player.state = "idle";
          player.frame = 0;
          player.acc = 0;
        }
      }

      if (player.state === "ability") {
        const t = now - player.abilityAnimStartedAt;
        const cols = PLAYER_FRAMES.attack.cols;
        const fps = PLAYER_FRAMES.attack.fps;
        const frameByTime = Math.min(cols - 1, Math.floor((t / 1000) * fps));
        player.frame = frameByTime;

        if (t >= ATTACK_TOTAL_MS) {
          player.state = "idle";
          player.frame = 0;
          player.acc = 0;
        }
      }

      if (player.state === "blink") {
        const t = now - player.blinkStartedAt;
        const cols = PLAYER_FRAMES.blink.cols;
        const fps = PLAYER_FRAMES.blink.fps;
        const frameByTime = Math.min(cols - 1, Math.floor((t / 1000) * fps));
        player.frame = frameByTime;

        if (t >= BLINK_DURATION_MS) {
          if (player.blinkTargetX !== null) {
            player.x = player.blinkTargetX;
          }
          player.blinkTargetX = null;
          player.state = "idle";
          player.frame = 0;
          player.acc = 0;
        }
      }

      const playerInvuln = now - player.hurtAt < INVULN_MS;

      const abilityPressed =
        (mergedKeys.has("q") || mergedKeys.has("й")) &&
        now - player.abilityLastUsedAt >= player.abilityCooldownMs &&
        !player.dead &&
        player.state !== "die" &&
        player.state !== "blink" &&
        player.state !== "attack" &&
        player.state !== "ability";

      if (abilityPressed) {
        if (player.abilityType === "blink") {
          const maxDist = TILE * 3;
          const step = TILE / 4;
          const dirX = player.dir || 1;
          let targetX = player.x;
          let traveled = 0;
          while (traveled < maxDist) {
            const nx = targetX + dirX * step;
            const rect = { x: nx, y: player.y, w: player.w, h: player.h };
            if (hitsSolids(rect)) break;
            targetX = nx;
            traveled += step;
          }

          player.blinkTargetX = targetX;
          player.state = "blink";
          player.frame = 0;
          player.acc = 0;
          player.blinkStartedAt = now;
        } else if (player.abilityType === "trap") {
          traps.push({
            x: player.x + player.w / 4,
            y: player.y + (player.h * 2) / 3,
            w: TILE / 2,
            h: TILE / 8,
            createdAt: now,
            durationMs: 6000,
          });
        } else if (player.abilityType === "slam") {
          const radius = TILE * 2.5;
          const kbDist = TILE * 2.5;
          const kbDurSec = KNOCKBACK_DURATION_MS / 1000;

          for (const g of goblins) {
            if (g.dead) continue;
            const dx = g.x + g.w / 2 - (player.x + player.w / 2);
            const dy = g.y + g.h / 2 - (player.y + player.h / 2);
            const dist = Math.hypot(dx, dy);

            if (dist <= radius) {
              damageGoblin(g, 1, now);
              const len = dist || 1;
              const speed = kbDist / kbDurSec;

              g.knockbackVx = (dx / len) * speed;
              g.knockbackVy = (dy / len) * speed;
              g.knockbackEndAt = now + KNOCKBACK_DURATION_MS;

              g.stunnedUntil = Math.max(
                g.stunnedUntil,
                now + KNOCKBACK_DURATION_MS
              );
            }
          }

          player.state = "ability";
          player.frame = 0;
          player.acc = 0;
          player.abilityAnimStartedAt = now;
        }
        player.abilityLastUsedAt = now;
      }

      // === ЛОГИКА ГОБЛИНОВ С LOS + PATHFINDING ===
      for (const g of goblins) {
        if (g.dead) continue;

        // DoT
        if (
          g.dotType === "arrow" &&
          g.dotTicksLeft > 0 &&
          now >= g.dotNextTickAt &&
          !g.dead &&
          g.state !== "die"
        ) {
          damageGoblin(g, ARROW_DOT_DAMAGE, now);
          g.dotTicksLeft -= 1;
          g.dotNextTickAt += ARROW_DOT_INTERVAL_MS;

          if (g.dotTicksLeft <= 0 || g.hp <= 0) {
            g.dotType = null;
          }
        }

        // Нокбэк
        if (g.knockbackEndAt && now < g.knockbackEndAt) {
          tryMove(g, g.knockbackVx * dt, g.knockbackVy * dt);
        } else {
          g.knockbackEndAt = 0;
          g.knockbackVx = 0;
          g.knockbackVy = 0;

          if (g.stunnedUntil && now < g.stunnedUntil) {
            // стоим оглушённые
          } else {
            // === ЛИНИЯ ВИДИМОСТИ + АГРО ===
            const dxToPlayer = player.x - g.x;
            const dyToPlayer = player.y - g.y;
            const distToPlayer = Math.hypot(dxToPlayer, dyToPlayer);
            g.dir = dxToPlayer >= 0 ? 1 : -1;

            if (!g.hasSeenPlayer) {
              if (hasLineOfSight(g, player)) {
                g.hasSeenPlayer = true;
              }
            }

            // === АТАКА, если уже видел игрока и подошёл достаточно близко ===
            if (g.hasSeenPlayer && g.state !== "die" && distToPlayer <= 22) {
              if (g.state !== "attack") {
                g.state = "attack";
                g.frame = 0;
                g.acc = 0;
                g.attackStartedAt = now;
              }
            } else if (g.state !== "die") {
              // === ПРЕСЛЕДОВАНИЕ ПО ПУТИ, если уже видел игрока ===
              if (g.hasSeenPlayer && g.state !== "attack") {
                const gobCenter = {
                  x: g.x + g.w / 2,
                  y: g.y + g.h / 2,
                };
                const gobTile = worldToTile(gobCenter.x, gobCenter.y);
                const playerCenter = {
                  x: player.x + player.w / 2,
                  y: player.y + player.h / 2,
                };
                const playerTile = worldToTile(playerCenter.x, playerCenter.y);

                const needRepath =
                  !g.path ||
                  g.path.length === 0 ||
                  g.pathTargetTx !== playerTile.tx ||
                  g.pathTargetTy !== playerTile.ty ||
                  now - g.lastPathfindAt > GOBLIN_REPATH_MS;

                if (needRepath) {
                  g.path = findPath(
                    gobTile.tx,
                    gobTile.ty,
                    playerTile.tx,
                    playerTile.ty
                  );
                  g.pathIndex = 0;
                  g.pathTargetTx = playerTile.tx;
                  g.pathTargetTy = playerTile.ty;
                  g.lastPathfindAt = now;
                }

                if (
                  g.path &&
                  g.path.length > 0 &&
                  g.pathIndex < g.path.length
                ) {
                  const node = g.path[g.pathIndex];
                  const targetPos = tileToWorldCenter(node.tx, node.ty);
                  const gx = gobCenter.x;
                  const gy = gobCenter.y;
                  const dx = targetPos.x - gx;
                  const dy = targetPos.y - gy;
                  const dist = Math.hypot(dx, dy);

                  if (dist < 2) {
                    // достигли текущего узла — идём к следующему
                    g.pathIndex++;
                  } else {
                    const len = dist || 1;
                    const vx = (dx / len) * ENEMY_SPEED;
                    const vy = (dy / len) * ENEMY_SPEED;
                    g.state = "run";
                    tryMove(g, vx * dt, vy * dt);
                  }
                } else {
                  // пути нет — простой "иди на игрока" как раньше
                  if (distToPlayer > 22 && g.state !== "attack") {
                    const glen = distToPlayer || 1;
                    g.state = "run";
                    tryMove(
                      g,
                      (dxToPlayer / glen) * ENEMY_SPEED * dt,
                      (dyToPlayer / glen) * ENEMY_SPEED * dt
                    );
                  } else {
                    g.state = "idle";
                  }
                }
              } else {
                // ещё не видел игрока — просто стоим
                g.state = "idle";
              }
            }
          }
        }

        // === АНИМАЦИЯ ГОБЛИНА ===
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

      // === РАЗЪЕЗЖАЕМСЯ, ЕСЛИ ГОБЛИНЫ СТОЯТ ДРУГ В ДРУГЕ ===
      for (let i = 0; i < goblins.length; i++) {
        const a = goblins[i];
        if (a.dead) continue;
        for (let j = i + 1; j < goblins.length; j++) {
          const b = goblins[j];
          if (b.dead) continue;

          if (aabb(a, b)) {
            const ax = a.x + a.w / 2;
            const ay = a.y + a.h / 2;
            const bx = b.x + b.w / 2;
            const by = b.y + b.h / 2;

            let dx = bx - ax;
            let dy = by - ay;
            let dist = Math.hypot(dx, dy);

            if (dist === 0) {
              // если вообще совпали — задаём произвольное направление
              dx = 1;
              dy = 0;
              dist = 1;
            }

            const minDist = (a.w + b.w) / 2; // желаемое расстояние
            const overlap = minDist - dist;

            if (overlap > 0) {
              const push = overlap / 2;
              const nx = dx / dist;
              const ny = dy / dist;

              const axPush = -nx * push;
              const ayPush = -ny * push;
              const bxPush = nx * push;
              const byPush = ny * push;

              // используем tryMove, чтобы не проталкивать их в стены
              tryMove(a, axPush, ayPush);
              tryMove(b, bxPush, byPush);
            }
          }
        }
      }

      // === ЛОВУШКИ ===
      for (let ti = traps.length - 1; ti >= 0; ti--) {
        const t = traps[ti];
        if (now - t.createdAt > t.durationMs) {
          traps.splice(ti, 1);
          continue;
        }
        for (const g of goblins) {
          if (g.dead) continue;
          const gobRect = {
            x: g.x + 4,
            y: g.y + 6,
            w: g.w - 8,
            h: g.h - 10,
          };
          if (aabb(gobRect, t)) {
            g.stunnedUntil = now + 1000;
            traps.splice(ti, 1);
            break;
          }
        }
      }

      if (player.state === "attack" && player.weapon === "sword") {
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
            damageGoblin(g, 1, now);
          }
        }
      }

      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const rect = {
          x: p.x - p.radius,
          y: p.y - p.radius,
          w: p.radius * 2,
          h: p.radius * 2,
        };

        let hitWall = false;
        for (const s of solids) {
          if (aabb(rect, s)) {
            hitWall = true;
            break;
          }
        }

        let hitEnemy = false;
        if (!hitWall) {
          for (const g of goblins) {
            if (g.dead || g.state === "die") continue;
            const gobRect = {
              x: g.x + 4,
              y: g.y + 6,
              w: g.w - 8,
              h: g.h - 10,
            };
            if (aabb(rect, gobRect)) {
              hitEnemy = true;

              if (p.type === "arrow") {
                damageGoblin(g, ARROW_HIT_DAMAGE, now);
                g.dotType = "arrow";
                g.dotTicksLeft = ARROW_DOT_TICKS;
                g.dotNextTickAt = now + ARROW_DOT_INTERVAL_MS;
              }
              break;
            }
          }
        }

        if (hitWall || hitEnemy) {
          if (p.type === "staff") {
            const aoeR = TILE;

            for (const g2 of goblins) {
              if (g2.dead || g2.state === "die") continue;
              const gx = g2.x + g2.w / 2;
              const gy = g2.y + g2.h / 2;
              const dist = Math.hypot(gx - p.x, gy - p.y);
              if (dist <= aoeR) {
                damageGoblin(g2, 1, now);
              }
            }

            explosions.push({
              x: p.x,
              y: p.y,
              r: aoeR,
              createdAt: now,
            });
          }

          projectiles.splice(i, 1);
        } else {
          if (
            p.x < -TILE ||
            p.y < -TILE ||
            p.x > MAP[0].length * TILE + TILE ||
            p.y > MAP.length * TILE + TILE
          ) {
            projectiles.splice(i, 1);
          }
        }
      }

      for (const g of goblins) {
        if (g.dead || g.state !== "attack" || player.dead) continue;
        const gb = goblinHitbox(g);
        if (!playerInvuln && aabb(gb, player)) {
          player.hp = Math.max(0, player.hp - 1);
          player.hurtAt = now;
          hpRef.current = player.hp;
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

      for (let i = goblins.length - 1; i >= 0; i--) {
        if (goblins[i].dead) goblins.splice(i, 1);
      }

      const worldW = MAP[0].length * TILE;
      const worldH = MAP.length * TILE;
      const maxCamX = worldW - VIEW_W;
      const maxCamY = worldH - VIEW_H;

      const rawTargetX = Math.floor(player.x + player.w / 2 - VIEW_W / 2);
      const rawTargetY = Math.floor(player.y + player.h / 2 - VIEW_H / 2);

      const targetX = Math.max(0, Math.min(rawTargetX, maxCamX));
      const targetY = Math.max(0, Math.min(rawTargetY, maxCamY));

      const lerpFactor = Math.min(1, CAM_LERP * dt);

      cam.x += (targetX - cam.x) * lerpFactor;
      cam.y += (targetY - cam.y) * lerpFactor;

      cam.x = Math.max(0, Math.min(cam.x, maxCamX));
      cam.y = Math.max(0, Math.min(cam.y, maxCamY));
    }

    function render() {
      const ctx = c.getContext("2d");

      const camX = Math.round(cam.x);
      const camY = Math.round(cam.y);

      ctx.fillStyle = "#223b27";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let y = 0; y < MAP.length; y++)
        for (let x = 0; x < MAP[0].length; x++) {
          const dx = x * TILE - camX;
          const dy = y * TILE - camY;
          ctx.fillStyle = MAP[y][x] === 1 ? "#2a2f38" : "#2e6b3c";
          ctx.fillRect(dx, dy, TILE, TILE);
        }
      ctx.strokeStyle = "rgba(0,0,0,.25)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-0.5, -0.5, VIEW_W + 1, VIEW_H + 1);

      for (const w of weaponPickups) {
        if (w.picked) continue;
        const dx = w.x - camX;
        const dy = w.y - camY;

        const iconKey = `loot_${w.type}`;
        const icon = images[iconKey];

        if (icon && icon.complete) {
          ctx.drawImage(icon, dx, dy, w.w, w.h);
        } else {
          ctx.fillStyle = w.color;
          ctx.fillRect(dx, dy, w.w, w.h);
        }
      }

      for (const h of hearts) {
        const dx = h.x - camX;
        const dy = h.y - camY;
        const heartImg = images.loot_heart;

        if (heartImg && heartImg.complete) {
          ctx.drawImage(heartImg, dx, dy, h.w, h.h);
        } else {
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillRect(dx + 2, dy + 3, h.w, h.h);
          ctx.fillStyle = "#e53935";
          ctx.fillRect(dx, dy, h.w, h.h);
          ctx.strokeStyle = "#7f1d1d";
          ctx.lineWidth = 2;
          ctx.strokeRect(dx + 0.5, dy + 0.5, h.w - 1, h.h - 1);
        }
      }

      for (const t of traps) {
        const dx = t.x - camX;
        const dy = t.y - camY;
        ctx.fillStyle = "#333";
        ctx.fillRect(dx, dy, t.w, t.h);
        ctx.strokeStyle = "#ff9800";
        ctx.strokeRect(dx, dy, t.w, t.h);
      }

      for (const p of projectiles) {
        const dx = p.x - camX;
        const dy = p.y - camY;

        if (p.type === "arrow") {
          const w = p.radius * 3;
          const h = 3;
          const x = dx - w / 2;
          const y = dy - h / 2;

          ctx.fillStyle = "#00e676";
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = "#000";
          ctx.strokeRect(x, y, w, h);
        } else {
          ctx.beginPath();
          ctx.arc(dx, dy, p.radius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fillStyle = "#ffeb3b";
          ctx.fill();
          ctx.strokeStyle = "#000";
          ctx.stroke();
        }
      }

      for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        const age = lastNow - ex.createdAt;
        if (age > STAFF_EXPLOSION_MS) {
          explosions.splice(i, 1);
          continue;
        }

        const t = age / STAFF_EXPLOSION_MS;
        const alpha = 1 - t;

        const dx = ex.x - camX;
        const dy = ex.y - camY;

        ctx.save();
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.arc(dx, dy, ex.r, 0, Math.PI * 2);
        ctx.fillStyle = "#ff9800";
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffcc80";
        ctx.stroke();

        ctx.restore();
      }

      for (const g of goblins) {
        const gkey = goblinSpriteKey(g);
        const gimg = gkey ? images[gkey] : null;
        if (gimg && gimg.complete) {
          const sx = g.frame * GOB_SRC_W;
          drawFlippable(
            ctx,
            gimg,
            sx,
            0,
            GOB_SRC_W,
            GOB_SRC_H,
            g.x - camX,
            g.y - camY,
            GOB_W,
            GOB_H,
            g.dir === -1
          );
        }
        if (!g.dead) {
          ctx.fillStyle = "#000";
          ctx.fillRect(g.x - camX + 2, g.y - camY - 6, 28, 4);
          ctx.fillStyle = "#5cdd58";
          ctx.fillRect(
            g.x - camX + 2,
            g.y - camY - 6,
            Math.max(0, (g.hp / 3) * 28),
            4
          );
        }
      }

      {
        const pimg = images.player;
        if (!pimg || !pimg.complete) return;

        const row = getPlayerRow(player);
        const sx = player.frame * FRAME_SRC_W;
        const sy = row * FRAME_SRC_H;

        if (!player.dead) {
          drawFlippable(
            ctx,
            pimg,
            sx,
            sy,
            FRAME_SRC_W,
            FRAME_SRC_H,
            player.x - camX,
            player.y - camY,
            FRAME_W,
            FRAME_H,
            player.dir === -1
          );
        }

        if (player.state === "attack" && player.weapon === "sword") {
          const hb = attackHitbox(player);
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = "#ffd34a";
          ctx.fillRect(hb.x - camX, hb.y - camY, hb.w, hb.h);
          ctx.globalAlpha = 1;
        }
      }

      ctx.fillStyle = "#000";
      ctx.fillRect(8, 8, 120, 10);
      ctx.fillStyle = "#f44";
      ctx.fillRect(8, 8, Math.max(0, (player.hp / MAX_HP) * 120), 10);
    }

    requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [images, keys, restartKey, playerClass, mapId, spawnInfo]);

  return (
    <div className={styles.canvasWrap}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{
          width: `${VIEW_W * scale}px`,
          height: `${VIEW_H * scale}px`,
        }}
      />

      {playerClass && (
        <div className={styles.classWrapper}>
          <div>Класс: {CLASS_CONFIG[playerClass].name}</div>
          <div>Оружие: {weaponHud || "нет"}</div>
          <div>Локация: {WORLDS[mapId]?.name}</div>
        </div>
      )}

      {isMobile && playerClass && (
        <MobileJoystick
          onDirKeysChange={setDirKeys}
          onAttackDown={pressAttack}
          onAttackUp={releaseAttack}
          onAbilityDown={pressAbility}
          onAbilityUp={releaseAbility}
          attackIconSrc={attackIconSrc}
        />
      )}

      {!playerClass && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2>Выберите класс</h2>
            <p>Перед началом игры выбери героя.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <div
                className={styles.btn}
                onClick={() => {
                  setMapId("overworld");
                  setSpawnInfo(null);
                  hpRef.current = null;
                  weaponRef.current = null;
                  globalLootRef.current = {}; // лут тоже очищаем
                  setWeaponHud("нет");
                  setPlayerClass("warrior");
                }}
              >
                Воин
              </div>
              <div
                className={styles.btn}
                onClick={() => {
                  setMapId("overworld");
                  setSpawnInfo(null);
                  hpRef.current = null;
                  weaponRef.current = null;
                  globalLootRef.current = {};
                  setWeaponHud("нет");
                  setPlayerClass("rogue");
                }}
              >
                Разбойник
              </div>
              <div
                className={styles.btn}
                onClick={() => {
                  setMapId("overworld");
                  setSpawnInfo(null);
                  hpRef.current = null;
                  weaponRef.current = null;
                  globalLootRef.current = {};
                  setWeaponHud("нет");
                  setPlayerClass("wizard");
                }}
              >
                Маг
              </div>
            </div>
          </div>
        </div>
      )}

      {gameOver && playerClass && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2>Игра окончена</h2>
            <p>Время: {(elapsedMs / 1000).toFixed(2)} сек.</p>
            <p>Убито гоблинов: {kills}</p>
            <div className={styles.btns}>
              <div
                className={styles.btn}
                onClick={() => {
                  setSpawnInfo(null);
                  globalLootRef.current = {}; // новый забег — новый лут
                  setRestartKey((k) => k + 1);
                }}
              >
                Играть снова (R)
              </div>
              <div
                className={styles.btn}
                onClick={() => {
                  setGameOver(false);
                  setPlayerClass(null);
                  setMapId("overworld");
                  setSpawnInfo(null);
                  hpRef.current = null;
                  weaponRef.current = null;
                  globalLootRef.current = {};
                  setWeaponHud("нет");
                }}
              >
                Выбрать класс
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
