import { BRICK_BOTTOM, BRICK_TOP, CANVAS_WIDTH, TOTAL_LEVELS, WALL } from "./constants";
import type { Brick, BrickKind, Level, LevelLayoutType } from "./types";

type GridSpec = {
  columns: number;
  rows: number;
  gap: number;
  startX: number;
  width: number;
  height: number;
};

type CageBuild = {
  metal: Set<string>;
  protectedBreakables: Set<string>;
  cageCount: number;
};

const patterns = [
  "full_dense",
  "diagonal",
  "wave",
  "pyramid",
  "diamond",
  "heart_like",
  "smile_face",
  "letters",
  "checker",
  "spiral",
  "tunnel",
  "cage_box",
  "cage_rooms",
  "fortress_core",
  "side_chambers",
  "boss_wall"
] as const;

function key(row: number, col: number) {
  return `${row}:${col}`;
}

function parseKey(value: string) {
  const [row, col] = value.split(":").map(Number);
  return { row, col };
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function brickTarget(level: number) {
  if (level === 1) return 300;
  if (level <= 10) return 320 + Math.floor(((level - 2) / 8) * 100);
  if (level <= 30) return 400 + Math.floor(((level - 11) / 19) * 150);
  if (level <= 60) return 500 + Math.floor(((level - 31) / 29) * 200);
  if (level <= 90) return 650 + Math.floor(((level - 61) / 29) * 200);
  return 750 + Math.floor(((level - 91) / 17) * 200);
}

function breakableHp(level: number, rng: () => number) {
  if (level === 1) return rng() < 0.88 ? 1 : 2;
  if (level <= 10) return rng() < 0.76 ? 1 : 2;
  if (level <= 30) return Math.min(3, 1 + Math.floor(Math.pow(rng(), 1.6) * 3));
  return Math.min(3, 1 + Math.floor(rng() * 3));
}

function chooseLayout(level: number): LevelLayoutType {
  if (level === TOTAL_LEVELS) return "fortress_layout";
  const early: LevelLayoutType[] = [
    "frame_layout",
    "u_shape",
    "funnel_layout",
    "split_layout",
    "cage_layout",
    "frame_layout",
    "u_shape",
    "funnel_layout",
    "split_layout",
    "cage_layout"
  ];
  const mid: LevelLayoutType[] = [
    "u_shape",
    "maze_layout",
    "fortress_layout",
    "split_layout",
    "funnel_layout",
    "cage_layout",
    "frame_layout",
    "maze_layout",
    "fortress_layout",
    "split_layout"
  ];
  const late: LevelLayoutType[] = [
    "maze_layout",
    "fortress_layout",
    "cage_layout",
    "split_layout",
    "funnel_layout",
    "maze_layout",
    "fortress_layout",
    "cage_layout",
    "split_layout",
    "funnel_layout"
  ];
  const pool = level <= 20 ? early : level <= 60 ? mid : late;
  return pool[(level - 1) % pool.length];
}

function makeGrid(level: number): GridSpec {
  const size = level >= 61 ? 14 : level >= 11 ? 16 : 18;
  const gap = level >= 91 ? 2 : level >= 31 ? 2 : 3;
  const usableWidth = CANVAS_WIDTH - WALL * 2;
  const columns = Math.floor((usableWidth + gap) / (size + gap));
  const rows = Math.floor((BRICK_BOTTOM - BRICK_TOP + gap) / (size + gap));
  const gridWidth = columns * size + (columns - 1) * gap;
  const startX = WALL + (usableWidth - gridWidth) / 2;
  return { columns, rows, gap, startX, width: size, height: size };
}

function shapeWeight(layout: LevelLayoutType, row: number, col: number, rows: number, cols: number) {
  const x = (col - (cols - 1) / 2) / (cols / 2);
  const y = (row - (rows - 1) / 2) / (rows / 2);
  const distance = Math.sqrt(x * x + y * y);
  if (layout === "full_dense" || layout === "open_field" || layout === "simple_barriers") return 0.95;
  if (layout === "diagonal") return Math.abs(((row + col) % 7) - 3) <= 1 ? 0.98 : 0.45;
  if (layout === "wave") return Math.abs(row - (rows * 0.45 + Math.sin(col * 0.55) * rows * 0.18)) < rows * 0.2 ? 0.98 : 0.48;
  if (layout === "pyramid") return row > rows * 0.16 && Math.abs(x) < (row / rows) * 1.08 ? 0.98 : 0.38;
  if (layout === "diamond") return Math.abs(x) + Math.abs(y) < 1.15 ? 0.98 : 0.42;
  if (layout === "heart_like") {
    const hx = x * 1.25;
    const hy = y * 1.45 - 0.12;
    const v = Math.pow(hx * hx + hy * hy - 0.72, 3) - hx * hx * hy * hy * hy;
    return v < 0.08 ? 0.98 : 0.34;
  }
  if (layout === "smile_face") {
    const eye = (Math.abs(x - 0.35) < 0.12 || Math.abs(x + 0.35) < 0.12) && Math.abs(y + 0.3) < 0.14;
    const mouth = Math.abs(y - (0.22 + x * x * 0.55)) < 0.12 && Math.abs(x) < 0.68;
    return eye || mouth || distance < 0.88 ? 0.9 : 0.34;
  }
  if (layout === "letters") {
    const band = col % 9;
    const a = band === 1 || band === 7 || row === Math.floor(rows * 0.42) || (row < rows * 0.32 && Math.abs(band - 4) <= row % 3);
    const xMark = Math.abs((band - 4) / 4 - y) < 0.18 || Math.abs((band - 4) / 4 + y) < 0.18;
    return a || xMark ? 0.98 : 0.4;
  }
  if (layout === "checker") return (row + col) % 2 === 0 ? 0.98 : 0.5;
  if (layout === "spiral") {
    const angle = Math.atan2(y, x);
    const arm = Math.abs(((distance * 9 - angle * 1.7 + 12) % 3) - 1.5);
    return arm < 0.7 || distance < 0.28 ? 0.98 : 0.42;
  }
  if (layout === "tunnel" || layout === "tunnel_cage") {
    const centerTunnel = Math.abs(col - cols / 2) < 3 || Math.abs(row - rows * 0.55) < 3;
    return centerTunnel || row < rows * 0.72 ? 0.92 : 0.48;
  }
  if (layout === "boss_wall") return row > rows * 0.08 ? 0.98 : 0.55;
  if (layout === "frame_layout" || layout === "cage_layout") return distance < 1.05 ? 0.96 : 0.52;
  if (layout === "u_shape" || layout === "funnel_layout") return y > -0.72 || Math.abs(x) < 0.38 ? 0.94 : 0.5;
  if (layout === "maze_layout") return (row + Math.floor(col / 4)) % 3 === 0 ? 0.96 : 0.58;
  if (layout === "fortress_layout") return distance < 0.78 || row > rows * 0.38 ? 0.98 : 0.55;
  if (layout === "split_layout") return Math.abs(x) > 0.16 || row > rows * 0.32 ? 0.94 : 0.52;
  return distance < 1.05 ? 0.92 : 0.48;
}

function addBox(build: CageBuild, spec: GridSpec, left: number, top: number, width: number, height: number, entranceCols: number[]) {
  const right = left + width - 1;
  const bottom = top + height - 1;
  const entrances = new Set(entranceCols);
  for (let col = left; col <= right; col += 1) {
    addSolid(build, spec, top, col);
    if (!entrances.has(col)) addSolid(build, spec, bottom, col);
  }
  for (let row = top; row <= bottom; row += 1) {
    addSolid(build, spec, row, left);
    addSolid(build, spec, row, right);
  }
  for (let row = top + 1; row < bottom; row += 1) {
    for (let col = left + 1; col < right; col += 1) {
      if (clampCell(spec, row, col)) build.protectedBreakables.add(key(row, col));
    }
  }
  build.cageCount += 1;
}

function clampCell(spec: GridSpec, row: number, col: number) {
  return row >= 0 && row < spec.rows && col >= 0 && col < spec.columns;
}

function addSolid(build: CageBuild, spec: GridSpec, row: number, col: number) {
  if (clampCell(spec, row, col)) build.metal.add(key(row, col));
}

function addHLine(build: CageBuild, spec: GridSpec, row: number, left: number, right: number, gaps: number[] = []) {
  const gapSet = new Set(gaps);
  for (let col = left; col <= right; col += 1) {
    if (!gapSet.has(col)) addSolid(build, spec, row, col);
  }
}

function addVLine(build: CageBuild, spec: GridSpec, col: number, top: number, bottom: number, gaps: number[] = []) {
  const gapSet = new Set(gaps);
  for (let row = top; row <= bottom; row += 1) {
    if (!gapSet.has(row)) addSolid(build, spec, row, col);
  }
}

function indestructibleRatio(level: number) {
  if (level <= 20) return 0.16;
  if (level <= 60) return 0.23;
  return 0.3;
}

function targetIndestructibleCount(level: number, destructibleTarget: number) {
  const ratio = indestructibleRatio(level);
  return Math.ceil((destructibleTarget * ratio) / (1 - ratio));
}

function protectRect(build: CageBuild, spec: GridSpec, left: number, top: number, right: number, bottom: number) {
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (clampCell(spec, row, col)) build.protectedBreakables.add(key(row, col));
    }
  }
}

function addFrameLayout(build: CageBuild, spec: GridSpec, level: number) {
  const left = 2 + (level % 3);
  const right = spec.columns - 3 - (level % 2);
  const top = 3;
  const bottom = Math.min(spec.rows - 5, top + 13 + Math.floor(level / 30));
  const entranceStart = Math.floor((left + right) / 2) - (level > 60 ? 1 : 2);
  addHLine(build, spec, top, left, right);
  addHLine(build, spec, bottom, left, right, [entranceStart, entranceStart + 1, entranceStart + 2]);
  addVLine(build, spec, left, top, bottom);
  addVLine(build, spec, right, top, bottom);
  protectRect(build, spec, left + 1, top + 1, right - 1, bottom - 1);
  build.cageCount += 1;
}

function addUShapeLayout(build: CageBuild, spec: GridSpec, level: number) {
  const width = Math.floor(spec.columns * (level > 60 ? 0.62 : 0.7));
  const left = Math.floor((spec.columns - width) / 2);
  const right = left + width;
  const top = 4;
  const bottom = Math.min(spec.rows - 6, top + (level > 60 ? 16 : 13));
  addVLine(build, spec, left, top, bottom);
  addVLine(build, spec, right, top, bottom);
  addHLine(build, spec, top, left, right);
  protectRect(build, spec, left + 1, top + 1, right - 1, bottom - 1);
  if (level > 30) addHLine(build, spec, Math.floor((top + bottom) / 2), left + 3, right - 3, [left + 5, left + 6, right - 5, right - 6]);
  build.cageCount += 1;
}

function addMazeLayout(build: CageBuild, spec: GridSpec, level: number) {
  const leftGap = level > 60 ? 2 : 3;
  const rowStep = level > 60 ? 4 : 5;
  for (let row = 5; row < spec.rows - 5; row += rowStep) {
    const fromLeft = Math.floor(row / rowStep) % 2 === 0;
    const gapStart = fromLeft ? spec.columns - 7 : leftGap;
    addHLine(build, spec, row, 2, spec.columns - 3, [gapStart, gapStart + 1, gapStart + 2]);
  }
  for (let col = 6; col < spec.columns - 6; col += level > 60 ? 7 : 9) {
    addVLine(build, spec, col, 7, spec.rows - 8, [10, 11, 18, 19, 26, 27]);
  }
}

function addFortressLayout(build: CageBuild, spec: GridSpec, level: number) {
  const width = Math.floor(spec.columns * 0.5);
  const left = Math.floor((spec.columns - width) / 2);
  const right = left + width;
  const top = Math.floor(spec.rows * 0.22);
  const bottom = Math.min(spec.rows - 6, top + (level > 60 ? 18 : 14));
  const mid = Math.floor((left + right) / 2);
  addHLine(build, spec, top, left, right);
  addHLine(build, spec, bottom, left, right, [mid - 1, mid, mid + 1]);
  addVLine(build, spec, left, top, bottom, [top + 4, top + 5]);
  addVLine(build, spec, right, top, bottom, [bottom - 4, bottom - 3]);
  addHLine(build, spec, top + 4, left + 3, right - 3, [mid - 1, mid]);
  addHLine(build, spec, bottom - 4, left + 3, right - 3, [mid, mid + 1]);
  protectRect(build, spec, left + 1, top + 1, right - 1, bottom - 1);
  build.cageCount += 1;
}

function addSplitLayout(build: CageBuild, spec: GridSpec, level: number) {
  const mid = Math.floor(spec.columns / 2);
  const gapRows = level > 60 ? [9, 10, 20, 21, 31, 32] : [12, 13, 25, 26];
  addVLine(build, spec, mid, 3, spec.rows - 6, gapRows);
  if (level > 30) {
    addHLine(build, spec, Math.floor(spec.rows * 0.38), 2, spec.columns - 3, [mid - 2, mid - 1, mid, mid + 1, mid + 2]);
  }
}

function addFunnelLayout(build: CageBuild, spec: GridSpec, level: number) {
  const mid = Math.floor(spec.columns / 2);
  const top = 5;
  const length = level > 60 ? 18 : 14;
  for (let i = 0; i < length; i += 1) {
    const spread = Math.max(3, Math.floor(spec.columns * 0.32) - Math.floor(i * 0.65));
    addSolid(build, spec, top + i, mid - spread);
    addSolid(build, spec, top + i, mid + spread);
    if (level > 40 && i % 3 === 0) {
      addSolid(build, spec, top + i, mid - Math.floor(spread / 2));
      addSolid(build, spec, top + i, mid + Math.floor(spread / 2));
    }
  }
  protectRect(build, spec, mid - 4, top + length - 3, mid + 4, top + length + 4);
}

function addCageStructureLayout(build: CageBuild, spec: GridSpec, level: number) {
  const rooms = level > 60 ? 3 : 2;
  const roomWidth = Math.floor(spec.columns / (rooms + 1));
  for (let room = 0; room < rooms; room += 1) {
    const left = 2 + room * (roomWidth + 3);
    const width = Math.max(8, roomWidth);
    const top = 4 + (room % 2) * 5;
    const height = level > 60 ? 13 : 10;
    const entrance = left + Math.floor(width / 2);
    addBox(build, spec, left, top, width, height, [entrance, entrance + 1]);
  }
}

function topUpIndestructibleDensity(build: CageBuild, spec: GridSpec, targetCount: number) {
  const mid = Math.floor(spec.columns / 2);
  let pass = 0;
  while (build.metal.size < targetCount && pass < 5) {
    const stride = Math.max(3, 7 - pass);
    for (let row = 4 + pass; row < spec.rows - 5 && build.metal.size < targetCount; row += stride) {
      const gap = (row + pass) % 2 === 0 ? mid - 1 : mid + 1;
      addHLine(build, spec, row, 2, spec.columns - 3, [gap, gap + 1, gap + 2]);
    }
    for (let col = 4 + pass * 2; col < spec.columns - 4 && build.metal.size < targetCount; col += stride + 2) {
      addVLine(build, spec, col, 6, spec.rows - 8, [10 + pass, 11 + pass, 23 + pass, 24 + pass]);
    }
    pass += 1;
  }
}

function addOpenGuideDensity(build: CageBuild, spec: GridSpec, targetCount: number, level: number) {
  let pass = 0;
  while (build.metal.size < targetCount && pass < 8) {
    for (let row = 4 + pass; row < spec.rows - 4 && build.metal.size < targetCount; row += 5) {
      for (let col = 3 + ((row + pass) % 5); col < spec.columns - 4 && build.metal.size < targetCount; col += 8) {
        addSolid(build, spec, row, col);
        if (level > 20) addSolid(build, spec, row, col + 1);
        if (level > 60 && row + 1 < spec.rows - 4) addSolid(build, spec, row + 1, col);
      }
    }
    pass += 1;
  }
}

function rebuildAsOpenStructure(build: CageBuild, spec: GridSpec, targetCount: number, level: number) {
  build.metal.clear();
  build.protectedBreakables.clear();
  build.cageCount = 0;
  if (level <= 20) addFrameLayout(build, spec, level);
  else if (level <= 60) addSplitLayout(build, spec, level);
  else addMazeLayout(build, spec, level);
  openReachabilityChannels(build.metal, spec);
  addOpenGuideDensity(build, spec, targetCount, level);
}

function addStructuralIndestructibles(level: number, layout: LevelLayoutType, spec: GridSpec, targetDestructibles: number) {
  const build: CageBuild = { metal: new Set(), protectedBreakables: new Set(), cageCount: 0 };
  if (layout === "frame_layout") addFrameLayout(build, spec, level);
  else if (layout === "u_shape") addUShapeLayout(build, spec, level);
  else if (layout === "maze_layout") addMazeLayout(build, spec, level);
  else if (layout === "fortress_layout") addFortressLayout(build, spec, level);
  else if (layout === "split_layout") addSplitLayout(build, spec, level);
  else if (layout === "funnel_layout") addFunnelLayout(build, spec, level);
  else if (layout === "cage_layout") addCageStructureLayout(build, spec, level);
  else {
    const legacy = addCageLayout(layout, spec);
    for (const cell of legacy.metal) build.metal.add(cell);
    for (const cell of legacy.protectedBreakables) build.protectedBreakables.add(cell);
    build.cageCount = legacy.cageCount;
  }
  topUpIndestructibleDensity(build, spec, targetIndestructibleCount(level, targetDestructibles));
  return build;
}

function addCageLayout(layout: LevelLayoutType, spec: GridSpec): CageBuild {
  const build: CageBuild = { metal: new Set(), protectedBreakables: new Set(), cageCount: 0 };
  const mid = Math.floor(spec.columns / 2);
  const roomTop = Math.max(3, Math.floor(spec.rows * 0.18));

  if (layout === "simple_barriers") {
    for (let col = 5; col < spec.columns - 5; col += 3) build.metal.add(key(roomTop + 3, col));
    return build;
  }

  if (layout === "cage_box") {
    addBox(build, spec, 4, roomTop, spec.columns - 8, Math.min(15, spec.rows - roomTop - 4), [mid - 1, mid, mid + 1]);
    return build;
  }

  if (layout === "side_chambers") {
    addBox(build, spec, 2, roomTop + 2, Math.floor(spec.columns * 0.34), Math.min(14, spec.rows - roomTop - 6), [4, 5, 6]);
    addBox(
      build,
      spec,
      spec.columns - Math.floor(spec.columns * 0.34) - 2,
      roomTop + 2,
      Math.floor(spec.columns * 0.34),
      Math.min(14, spec.rows - roomTop - 6),
      [spec.columns - 7, spec.columns - 6, spec.columns - 5]
    );
    return build;
  }

  if (layout === "tunnel_cage") {
    const top = roomTop + 3;
    const left = 3;
    const right = spec.columns - 4;
    for (let col = left; col <= right; col += 1) {
      build.metal.add(key(top, col));
      build.metal.add(key(top + 4, col));
    }
    for (let col = left + 2; col <= right - 2; col += 1) {
      build.protectedBreakables.add(key(top + 1, col));
      build.protectedBreakables.add(key(top + 2, col));
      build.protectedBreakables.add(key(top + 3, col));
    }
    addBox(build, spec, 7, top + 6, spec.columns - 14, Math.min(13, spec.rows - top - 8), [mid - 2, mid - 1, mid, mid + 1]);
    build.cageCount += 1;
    return build;
  }

  if (layout === "cage_rooms") {
    const width = Math.floor(spec.columns / 3) - 2;
    addBox(build, spec, 2, roomTop + 1, width, 12, [4, 5, 6]);
    addBox(build, spec, mid - Math.floor(width / 2), roomTop + 5, width + 1, 13, [mid - 1, mid, mid + 1]);
    addBox(build, spec, spec.columns - width - 2, roomTop + 1, width, 12, [spec.columns - 7, spec.columns - 6, spec.columns - 5]);
    return build;
  }

  if (layout === "fortress_core") {
    const width = Math.floor(spec.columns * 0.62);
    const left = Math.floor((spec.columns - width) / 2);
    addBox(build, spec, left, roomTop + 2, width, Math.min(18, spec.rows - roomTop - 5), [mid - 2, mid - 1, mid, mid + 1]);
    for (let row = roomTop + 7; row < roomTop + 14; row += 2) {
      build.metal.add(key(row, left + 4));
      build.metal.add(key(row, left + width - 5));
    }
  }

  return build;
}

function addStarterIndestructiblePocket(spec: GridSpec, build: CageBuild) {
  if (build.metal.size > 0) return;
  const width = Math.max(9, Math.min(13, Math.floor(spec.columns * 0.28)));
  const height = 7;
  const left = Math.max(2, Math.floor((spec.columns - width) / 2));
  const top = 4;
  const mid = left + Math.floor(width / 2);
  addBox(build, spec, left, top, width, height, [mid - 1, mid, mid + 1]);
}

function openFallbackEntrances(metal: Set<string>, spec: GridSpec) {
  const mid = Math.floor(spec.columns / 2);
  for (let row = 0; row < spec.rows; row += 1) {
    for (let col = mid - 2; col <= mid + 2; col += 1) metal.delete(key(row, col));
  }
}

function openReachabilityChannels(metal: Set<string>, spec: GridSpec) {
  const columns = [
    Math.floor(spec.columns * 0.25),
    Math.floor(spec.columns * 0.5),
    Math.floor(spec.columns * 0.75)
  ];
  for (const center of columns) {
    for (let row = 0; row < spec.rows; row += 1) {
      for (let col = center - 1; col <= center + 1; col += 1) metal.delete(key(row, col));
    }
  }
  for (let row = 8; row < spec.rows - 4; row += 9) {
    for (let col = 0; col < spec.columns; col += 1) {
      if (col % 7 < 3) metal.delete(key(row, col));
    }
  }
}

function ensureIndestructibleStructure(spec: GridSpec, build: CageBuild) {
  if (build.metal.size > 0) return;
  addStarterIndestructiblePocket(spec, build);
}

function refillBreakables(target: number, metal: Set<string>, breakableCells: Set<string>, spec: GridSpec) {
  for (const cell of [...breakableCells]) {
    const { row, col } = parseKey(cell);
    if (metal.has(cell) || !clampCell(spec, row, col)) breakableCells.delete(cell);
  }
  for (let row = 0; row < spec.rows; row += 1) {
    for (let col = 0; col < spec.columns; col += 1) {
      if (breakableCells.size >= target) return;
      const cell = key(row, col);
      if (!metal.has(cell) && !breakableCells.has(cell)) breakableCells.add(cell);
    }
  }
}

function powerChance(level: number) {
  if (level <= 10) return 0.35 + ((level - 1) / 9) * 0.1;
  if (level <= 30) return 0.3 + ((level - 11) / 19) * 0.1;
  if (level <= 60) return 0.24 + ((level - 31) / 29) * 0.1;
  if (level <= 90) return 0.18 + ((level - 61) / 29) * 0.1;
  return 0.16 + ((level - 91) / 17) * 0.08;
}

function minPowerRatio(level: number) {
  if (level <= 10) return 0.35;
  if (level <= 30) return 0.3;
  if (level <= 60) return 0.24;
  if (level <= 90) return 0.18;
  return 0.16;
}

function maxPowerRatio(level: number) {
  if (level <= 10) return 0.45;
  if (level <= 30) return 0.4;
  if (level <= 60) return 0.34;
  if (level <= 90) return 0.28;
  return 0.24;
}

function choosePowerKind(rng: () => number): BrickKind {
  const roll = rng();
  if (roll < 0.347) return "x2";
  if (roll < 0.72) return "plus3";
  return "expand";
}

function reachableBreakables(metal: Set<string>, breakables: Set<string>, spec: GridSpec) {
  const visited = new Set<string>();
  const queue: Array<{ row: number; col: number }> = [];
  for (let col = 0; col < spec.columns; col += 1) {
    queue.push({ row: spec.rows - 1, col });
    queue.push({ row: 0, col });
  }
  for (let row = 0; row < spec.rows; row += 1) {
    queue.push({ row, col: 0 });
    queue.push({ row, col: spec.columns - 1 });
  }

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    if (current.row < 0 || current.row >= spec.rows || current.col < 0 || current.col >= spec.columns) continue;
    const currentKey = key(current.row, current.col);
    if (visited.has(currentKey) || metal.has(currentKey)) continue;
    visited.add(currentKey);
    queue.push(
      { row: current.row + 1, col: current.col },
      { row: current.row - 1, col: current.col },
      { row: current.row, col: current.col + 1 },
      { row: current.row, col: current.col - 1 }
    );
  }

  for (const brick of breakables) {
    if (!visited.has(brick)) return false;
  }
  return true;
}

function collectUnreachableBreakables(metal: Set<string>, breakables: Set<string>, spec: GridSpec) {
  const visited = new Set<string>();
  const queue: Array<{ row: number; col: number }> = [];
  for (let col = 0; col < spec.columns; col += 1) {
    queue.push({ row: spec.rows - 1, col });
    queue.push({ row: 0, col });
  }
  for (let row = 0; row < spec.rows; row += 1) {
    queue.push({ row, col: 0 });
    queue.push({ row, col: spec.columns - 1 });
  }

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    if (current.row < 0 || current.row >= spec.rows || current.col < 0 || current.col >= spec.columns) continue;
    const currentKey = key(current.row, current.col);
    if (visited.has(currentKey) || metal.has(currentKey)) continue;
    visited.add(currentKey);
    queue.push(
      { row: current.row + 1, col: current.col },
      { row: current.row - 1, col: current.col },
      { row: current.row, col: current.col + 1 },
      { row: current.row, col: current.col - 1 }
    );
  }

  return [...breakables].filter((cell) => {
    const { row, col } = parseKey(cell);
    return clampCell(spec, row, col) && !visited.has(cell);
  });
}

function openSealedBreakableEntrances(metal: Set<string>, breakables: Set<string>, spec: GridSpec) {
  for (let pass = 0; pass < 4; pass += 1) {
    const sealed = collectUnreachableBreakables(metal, breakables, spec);
    if (sealed.length === 0) return;
    for (const cell of sealed) {
      const { row, col } = parseKey(cell);
      const carveLeft = col < spec.columns / 2;
      const start = carveLeft ? 0 : col - 1;
      const end = carveLeft ? col + 1 : spec.columns - 1;
      for (let c = start; c <= end; c += 1) {
        metal.delete(key(row, c));
        metal.delete(key(row - 1, c));
        metal.delete(key(row + 1, c));
      }
    }
  }
}

function addReachableSafeDensity(
  metal: Set<string>,
  breakables: Set<string>,
  spec: GridSpec,
  targetCount: number,
  level: number
) {
  const candidates: string[] = [];
  const rowOffset = level % 5;
  for (let row = 4; row < spec.rows - 4; row += 1) {
    for (let col = 2; col < spec.columns - 2; col += 1) {
      const cell = key(row, col);
      if (metal.has(cell) || breakables.has(cell)) continue;
      const structural =
        row % 5 === rowOffset ||
        col % (level > 60 ? 6 : 8) === (level + row) % (level > 60 ? 6 : 8) ||
        Math.abs(col - spec.columns / 2) < (level > 60 ? 4 : 3);
      if (structural) candidates.push(cell);
    }
  }

  for (const cell of candidates) {
    if (metal.size >= targetCount) return;
    metal.add(cell);
    if (!reachableBreakables(metal, breakables, spec)) metal.delete(cell);
  }
}

function createBrick(
  id: number,
  row: number,
  col: number,
  spec: GridSpec,
  level: number,
  kind: BrickKind,
  rng: () => number
): Brick {
  const x = spec.startX + col * (spec.width + spec.gap);
  const y = BRICK_TOP + row * (spec.height + spec.gap);
  const hp = kind === "indestructible" ? 0 : breakableHp(level, rng);
  return { id, x, y, width: spec.width, height: spec.height, hp, maxHp: hp, kind, alive: true, hitFlash: 0 };
}

export function generateLevel(levelNumber: number): Level {
  const number = Math.max(1, Math.min(levelNumber, TOTAL_LEVELS));
  const seed = 23857 + number * 7919;
  const rng = mulberry32(seed);
  const layoutType = chooseLayout(number);
  const pattern = patterns[(number - 1) % patterns.length];
  const spec = makeGrid(number);
  const target = brickTarget(number);
  const cage = addStructuralIndestructibles(number, layoutType, spec, target);
  const breakableCells = new Set<string>();

  for (const cell of cage.protectedBreakables) {
    if (!cage.metal.has(cell)) breakableCells.add(cell);
  }

  for (let row = 0; row < spec.rows; row += 1) {
    for (let col = 0; col < spec.columns; col += 1) {
      if (breakableCells.size >= target) break;
      const cell = key(row, col);
      if (cage.metal.has(cell) || breakableCells.has(cell)) continue;
      if (rng() > shapeWeight(layoutType, row, col, spec.rows, spec.columns)) continue;
      breakableCells.add(cell);
    }
  }

  for (let row = 0; row < spec.rows; row += 1) {
    for (let col = 0; col < spec.columns; col += 1) {
      if (breakableCells.size >= target) break;
      const cell = key(row, col);
      if (!cage.metal.has(cell) && !breakableCells.has(cell)) breakableCells.add(cell);
    }
  }

  for (let row = 0; row < spec.rows; row += 1) {
    for (let col = 0; col < spec.columns; col += 1) {
      if (breakableCells.size >= target) break;
      const cell = key(row, col);
      if (cage.metal.has(cell) || breakableCells.has(cell)) continue;
      if (rng() > 0.72) continue;
      breakableCells.add(cell);
    }
  }

  if (!reachableBreakables(cage.metal, breakableCells, spec)) {
    openFallbackEntrances(cage.metal, spec);
  }
  if (!reachableBreakables(cage.metal, breakableCells, spec)) {
    openReachabilityChannels(cage.metal, spec);
  }
  if (!reachableBreakables(cage.metal, breakableCells, spec)) {
    rebuildAsOpenStructure(cage, spec, targetIndestructibleCount(number, target), number);
  }
  ensureIndestructibleStructure(spec, cage);
  const finalIndestructibleTarget = targetIndestructibleCount(number, target);
  if (cage.metal.size < finalIndestructibleTarget) {
    addOpenGuideDensity(cage, spec, finalIndestructibleTarget, number);
  }
  refillBreakables(target, cage.metal, breakableCells, spec);
  if (!reachableBreakables(cage.metal, breakableCells, spec)) {
    openReachabilityChannels(cage.metal, spec);
    refillBreakables(target, cage.metal, breakableCells, spec);
  }
  if (!reachableBreakables(cage.metal, breakableCells, spec)) {
    cage.metal.clear();
    cage.protectedBreakables.clear();
    cage.cageCount = 0;
    addOpenGuideDensity(cage, spec, finalIndestructibleTarget, number);
    refillBreakables(target, cage.metal, breakableCells, spec);
  }
  if (!reachableBreakables(cage.metal, breakableCells, spec)) {
    openSealedBreakableEntrances(cage.metal, breakableCells, spec);
    refillBreakables(target, cage.metal, breakableCells, spec);
  }
  if (cage.metal.size < finalIndestructibleTarget) {
    addReachableSafeDensity(cage.metal, breakableCells, spec, finalIndestructibleTarget, number);
  }
  if (!reachableBreakables(cage.metal, breakableCells, spec)) {
    openSealedBreakableEntrances(cage.metal, breakableCells, spec);
    refillBreakables(target, cage.metal, breakableCells, spec);
  }
  const reachableCheck = reachableBreakables(cage.metal, breakableCells, spec);

  const bricks: Brick[] = [];
  let id = 1;
  for (const cell of cage.metal) {
    const { row, col } = parseKey(cell);
    if (row < 0 || row >= spec.rows || col < 0 || col >= spec.columns) continue;
    bricks.push(createBrick(id, row, col, spec, number, "indestructible", rng));
    id += 1;
  }
  const powerKinds = new Map<string, BrickKind>();
  const breakableList = [...breakableCells];
  for (const cell of breakableList) {
    if (rng() < powerChance(number)) powerKinds.set(cell, choosePowerKind(rng));
  }
  const minPowerCount = Math.ceil(breakableList.length * minPowerRatio(number));
  const maxPowerCount = Math.floor(breakableList.length * maxPowerRatio(number));
  for (let index = breakableList.length - 1; index >= 0; index -= 1) {
    if (powerKinds.size <= maxPowerCount) break;
    powerKinds.delete(breakableList[index]);
  }
  for (const cell of breakableList) {
    if (powerKinds.size >= minPowerCount) break;
    if (!powerKinds.has(cell)) powerKinds.set(cell, choosePowerKind(rng));
  }
  if (number === 1 && breakableList.length >= 3) {
    powerKinds.set(breakableList[0], "x2");
    powerKinds.set(breakableList[1], "plus3");
    powerKinds.set(breakableList[2], "expand");
  }
  for (let index = breakableList.length - 1; index >= 3; index -= 1) {
    if (powerKinds.size <= maxPowerCount) break;
    powerKinds.delete(breakableList[index]);
  }

  for (const cell of breakableList) {
    const { row, col } = parseKey(cell);
    const kind = powerKinds.get(cell) ?? "normal";
    bricks.push(createBrick(id, row, col, spec, number, kind, rng));
    id += 1;
  }

  return { number, seed, pattern, layoutType, cageCount: cage.cageCount, reachableCheck, bricks };
}
