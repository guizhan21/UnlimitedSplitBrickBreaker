export type BrickKind = "normal" | "indestructible" | "x2" | "plus3" | "expand";
export type LevelLayoutType =
  | "open_field"
  | "simple_barriers"
  | "full_dense"
  | "diagonal"
  | "wave"
  | "pyramid"
  | "diamond"
  | "heart_like"
  | "smile_face"
  | "letters"
  | "checker"
  | "spiral"
  | "tunnel"
  | "cage_box"
  | "cage_rooms"
  | "tunnel_cage"
  | "fortress_core"
  | "side_chambers"
  | "boss_wall"
  | "frame_layout"
  | "u_shape"
  | "maze_layout"
  | "fortress_layout"
  | "split_layout"
  | "funnel_layout"
  | "cage_layout";

export type Brick = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  kind: BrickKind;
  alive: boolean;
  hitFlash: number;
};

export type Ball = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  quietTime: number;
};

export type SpawnRequest = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  count: number;
};

export type Level = {
  number: number;
  seed: number;
  pattern: string;
  layoutType: LevelLayoutType;
  cageCount: number;
  reachableCheck: boolean;
  bricks: Brick[];
};

export type DebugStats = {
  fps: number;
  balls: number;
  breakableBricks: number;
  metalBricks: number;
  layoutType: LevelLayoutType;
  cageCount: number;
  reachableCheck: boolean;
  collisionChecks: number;
  pendingSpawns: number;
  renderQuality: string;
};

export type GameSnapshot = {
  level: number;
  lives: number;
  score: number;
  bestScore: number;
  highestUnlockedLevel: number;
  status: "ready" | "playing" | "level-clear" | "game-over" | "all-clear";
  stats: DebugStats;
};

export type GameCallbacks = {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onSound?: (sound: "wall" | "paddle" | "brick" | "metal" | "power") => void;
};
