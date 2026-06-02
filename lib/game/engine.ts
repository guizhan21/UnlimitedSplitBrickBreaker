import {
  BALL_RADIUS,
  BALL_SPEED,
  CANVAS_WIDTH,
  INITIAL_LIVES,
  MAX_PADDLE_WIDTH_RATIO,
  PADDLE_WIDTH,
  PADDLE_Y,
  POWER_DROP_RATE,
  STORAGE_KEYS,
  TOTAL_LEVELS,
  WIDE_DURATION,
  WIDE_WIDTH_MULTIPLIER,
  WALL
} from "./constants";
import { avoidBadAngles, collideBrick, hitPaddle, hitWalls, isOut, normalizeBallSpeed } from "./collision";
import { generateLevel } from "./levels";
import { BallPool } from "./pools";
import { renderGame } from "./renderer";
import type { Ball, Brick, GameCallbacks, GameSnapshot, LevelLayoutType, SpawnRequest } from "./types";

const BRICK_BUCKET_SIZE = 24;
const LEVEL_CLEAR_COUNTDOWN = 8;
function readNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function writeNumber(key: string, value: number) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, String(value));
}

export class BrickBreakerEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameCallbacks;
  private pool = new BallPool();
  private balls: Ball[] = [];
  private spawnQueue: SpawnRequest[] = [];
  private bricks: Brick[] = [];
  private brickGrid = new Map<string, Brick[]>();
  private layoutType: LevelLayoutType = "open_field";
  private cageCount = 0;
  private reachableCheck = true;
  private brickSize = 16;
  private brickGap = 2;
  private gridRows = 0;
  private gridColumns = 0;
  private paddleX = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
  private paddleWidth = PADDLE_WIDTH;
  private wideTimer = 0;
  private level = 1;
  private lives = INITIAL_LIVES;
  private score = 0;
  private levelStartScore = 0;
  private bonusScore = 0;
  private levelClearTimer = 0;
  private lastClearCountdown = 0;
  private bestScore = 0;
  private highestUnlockedLevel = 1;
  private status: GameSnapshot["status"] = "ready";
  private raf = 0;
  private last = 0;
  private fps = 0;
  private frameCounter = 0;
  private fpsTimer = 0;
  private collisionChecks = 0;
  private outOfBoundsCorrections = 0;
  private wallCollisions = 0;
  private paddleCollisions = 0;
  private brickCollisions = 0;
  private metalCollisions = 0;
  private subSteps = 0;
  private pauseReason: GameSnapshot["pauseReason"] = null;
  private musicState: GameSnapshot["stats"]["musicState"] = "paused";

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is unavailable.");
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.bestScore = readNumber(STORAGE_KEYS.bestScore, 0);
    this.highestUnlockedLevel = readNumber(STORAGE_KEYS.highestUnlockedLevel, 1);
    this.level = readNumber(STORAGE_KEYS.lastPlayedLevel, 1);
    this.loadLevel(this.level);
  }

  start() {
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  launch() {
    if (this.status === "all-clear") this.loadLevel(1);
    if (this.status === "game-over") this.loadLevel(this.level);
    if (this.status === "level-clear") this.loadLevel(Math.min(TOTAL_LEVELS, this.level + 1));
    this.status = "playing";
    if (this.balls.length === 0) this.addBall(CANVAS_WIDTH / 2, PADDLE_Y - 18, -BALL_SPEED * 0.28, -BALL_SPEED);
    this.emit();
  }

  restart() {
    this.loadLevel(this.level);
    this.status = "ready";
    this.emit();
  }

  nextLevel() {
    this.loadLevel(Math.min(TOTAL_LEVELS, this.level + 1));
    this.status = "ready";
    this.emit();
  }

  previousLevel() {
    this.loadLevel(Math.max(1, this.level - 1));
    this.status = "ready";
    this.emit();
  }

  setLevel(level: number) {
    this.loadLevel(Math.max(1, Math.min(TOTAL_LEVELS, level)));
    this.status = "ready";
    this.emit();
  }

  setPaddleFromClientX(clientX: number, rect: DOMRect) {
    const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    this.paddleX = Math.max(WALL, Math.min(CANVAS_WIDTH - WALL - this.paddleWidth, x - this.paddleWidth / 2));
  }

  setBackgroundPaused(paused: boolean) {
    this.pauseReason = paused ? "background" : null;
    this.emit();
  }

  setMusicState(musicState: GameSnapshot["stats"]["musicState"]) {
    this.musicState = musicState;
    this.emit();
  }

  getSnapshot(): GameSnapshot {
    const breakableBricks = this.bricks.filter((brick) => brick.alive && brick.kind !== "indestructible").length;
    const metalBricks = this.bricks.filter((brick) => brick.alive && brick.kind === "indestructible").length;
    const balls = this.balls.length;
    return {
      level: this.level,
      lives: this.lives,
      score: this.score,
      levelScore: Math.max(0, this.score - this.levelStartScore - this.bonusScore),
      bonusScore: this.bonusScore,
      levelClearCountdown: Math.ceil(this.levelClearTimer),
      bestScore: this.bestScore,
      highestUnlockedLevel: this.highestUnlockedLevel,
      status: this.status,
      pauseReason: this.pauseReason,
      stats: {
        fps: this.fps,
        balls,
        breakableBricks,
        metalBricks,
        powerDropRate: POWER_DROP_RATE,
        brickSize: this.brickSize,
        brickGap: this.brickGap,
        gridRows: this.gridRows,
        gridColumns: this.gridColumns,
        layoutType: this.layoutType,
        cageCount: this.cageCount,
        reachableCheck: this.reachableCheck,
        collisionChecks: this.collisionChecks,
        outOfBoundsCorrections: this.outOfBoundsCorrections,
        wallCollisions: this.wallCollisions,
        paddleCollisions: this.paddleCollisions,
        brickCollisions: this.brickCollisions,
        metalCollisions: this.metalCollisions,
        subSteps: this.subSteps,
        pendingSpawns: this.spawnQueue.length,
        renderQuality: balls > 2048 ? "ultra" : balls > 512 ? "dot" : balls > 128 ? "simple" : "full",
        musicState: this.musicState,
        pauseReason: this.pauseReason,
        wideSeconds: Math.ceil(this.wideTimer)
      }
    };
  }

  private loadLevel(level: number) {
    const generated = generateLevel(level);
    this.level = generated.number;
    this.bricks = generated.bricks;
    this.layoutType = generated.layoutType;
    this.cageCount = generated.cageCount;
    this.reachableCheck = generated.reachableCheck;
    this.brickSize = generated.brickSize;
    this.brickGap = generated.brickGap;
    this.gridRows = generated.gridRows;
    this.gridColumns = generated.gridColumns;
    this.rebuildBrickGrid();
    this.balls.forEach((ball) => this.pool.release(ball));
    this.balls = [];
    this.spawnQueue = [];
    this.lives = INITIAL_LIVES;
    this.paddleWidth = PADDLE_WIDTH;
    this.wideTimer = 0;
    this.bonusScore = 0;
    this.levelClearTimer = 0;
    this.lastClearCountdown = 0;
    this.levelStartScore = this.score;
    this.paddleX = CANVAS_WIDTH / 2 - this.paddleWidth / 2;
    writeNumber(STORAGE_KEYS.lastPlayedLevel, this.level);
    this.render();
  }

  private loop = (time: number) => {
    const dt = Math.min(0.033, (time - this.last) / 1000);
    this.last = time;
    this.frameCounter += 1;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frameCounter / this.fpsTimer);
      this.frameCounter = 0;
      this.fpsTimer = 0;
      this.emit();
    }
    if (this.status === "level-clear" && this.pauseReason !== "background") this.updateLevelClear(dt);
    if (this.status === "playing" && this.pauseReason !== "background") this.update(dt);
    this.decayBrickFeedback(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.collisionChecks = 0;
    this.outOfBoundsCorrections = 0;
    this.wallCollisions = 0;
    this.paddleCollisions = 0;
    this.brickCollisions = 0;
    this.metalCollisions = 0;
    this.subSteps = 0;
    this.updatePaddleWidth(dt);
    this.flushSpawns();
    for (const ball of [...this.balls]) {
      ball.quietTime += dt;
      const distance = Math.hypot(ball.vx, ball.vy) * dt;
      const steps = Math.max(1, Math.ceil(distance / 4));
      this.subSteps += steps;
      for (let i = 0; i < steps; i += 1) {
        ball.x += (ball.vx * dt) / steps;
        ball.y += (ball.vy * dt) / steps;
        if (hitWalls(ball)) {
          this.wallCollisions += 1;
          this.outOfBoundsCorrections += 1;
          this.normalizeBallVelocity(ball);
          this.callbacks.onSound?.("wall");
        }
        if (hitPaddle(ball, this.paddleX, this.paddleWidth)) {
          this.paddleCollisions += 1;
          this.normalizeBallVelocity(ball);
          this.callbacks.onSound?.("paddle");
        }
        this.hitBricks(ball);
        if (hitWalls(ball)) {
          this.wallCollisions += 1;
          this.outOfBoundsCorrections += 1;
          this.normalizeBallVelocity(ball);
          this.callbacks.onSound?.("wall");
        }
        this.normalizeBallVelocity(ball);
      }
      this.nudgeQuietBall(ball);
      if (isOut(ball)) this.removeBall(ball);
    }
    if (this.balls.length === 0) {
      this.lives -= 1;
      if (this.lives <= 0) this.status = "game-over";
      else this.addBall(this.paddleX + this.paddleWidth / 2, PADDLE_Y - 18, BALL_SPEED * 0.25, -BALL_SPEED);
      this.emit();
    }
    if (this.bricks.every((brick) => brick.kind === "indestructible" || !brick.alive)) this.clearLevel();
  }

  private updateLevelClear(dt: number) {
    if (this.levelClearTimer <= 0) return;
    this.levelClearTimer = Math.max(0, this.levelClearTimer - dt);
    if (this.levelClearTimer === 0) {
      this.nextLevel();
      return;
    }
    const countdown = Math.ceil(this.levelClearTimer);
    if (countdown !== this.lastClearCountdown) {
      this.lastClearCountdown = countdown;
      this.emit();
    }
  }

  private hitBricks(ball: Ball) {
    for (const brick of this.nearbyBricks(ball)) {
      this.collisionChecks += 1;
      if (!collideBrick(ball, brick)) continue;
      this.callbacks.onSound?.(brick.kind === "indestructible" ? "metal" : brick.kind === "normal" ? "brick" : "power");
      if (brick.kind === "indestructible") this.metalCollisions += 1;
      else this.brickCollisions += 1;
      this.normalizeBallVelocity(ball);
      if (brick.kind !== "indestructible") {
        ball.quietTime = 0;
        brick.hitFlash = 1;
        brick.hp -= 1;
        if (brick.hp <= 0) this.breakBrick(brick);
      }
      break;
    }
  }

  private rebuildBrickGrid() {
    this.brickGrid.clear();
    for (const brick of this.bricks) {
      const startCol = Math.floor(brick.x / BRICK_BUCKET_SIZE);
      const endCol = Math.floor((brick.x + brick.width) / BRICK_BUCKET_SIZE);
      const startRow = Math.floor(brick.y / BRICK_BUCKET_SIZE);
      const endRow = Math.floor((brick.y + brick.height) / BRICK_BUCKET_SIZE);
      for (let row = startRow; row <= endRow; row += 1) {
        for (let col = startCol; col <= endCol; col += 1) {
          const key = `${row}:${col}`;
          const bucket = this.brickGrid.get(key);
          if (bucket) bucket.push(brick);
          else this.brickGrid.set(key, [brick]);
        }
      }
    }
  }

  private nearbyBricks(ball: Ball) {
    const row = Math.floor(ball.y / BRICK_BUCKET_SIZE);
    const col = Math.floor(ball.x / BRICK_BUCKET_SIZE);
    const seen = new Set<number>();
    const bricks: Brick[] = [];
    for (let y = row - 2; y <= row + 2; y += 1) {
      for (let x = col - 2; x <= col + 2; x += 1) {
        const bucket = this.brickGrid.get(`${y}:${x}`);
        if (!bucket) continue;
        for (const brick of bucket) {
          if (seen.has(brick.id)) continue;
          seen.add(brick.id);
          bricks.push(brick);
        }
      }
    }
    return bricks;
  }

  private breakBrick(brick: Brick) {
    brick.alive = false;
    this.score += 10 + brick.maxHp * 4;
    if (brick.kind === "x2") {
      const active = this.balls.filter((item) => item.active);
      for (const source of active) this.spawnQueue.push({ x: source.x, y: source.y, vx: source.vx, vy: source.vy, count: 1 });
    }
    if (brick.kind === "plus3") {
      this.spawnQueue.push({
        x: this.paddleX + this.paddleWidth / 2,
        y: PADDLE_Y - BALL_RADIUS - 4,
        vx: 0,
        vy: -BALL_SPEED,
        count: 3
      });
    }
    if (brick.kind === "expand") {
      this.wideTimer = WIDE_DURATION;
    }
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      writeNumber(STORAGE_KEYS.bestScore, this.bestScore);
    }
  }

  private flushSpawns() {
    const batch = this.spawnQueue.splice(0, Math.min(64, this.spawnQueue.length));
    for (const request of batch) {
      for (let i = 0; i < request.count; i += 1) {
        const spread = request.count === 3 ? (i - 1) * 0.34 : (Math.random() - 0.5) * 0.9;
        const angle = Math.atan2(request.vy, request.vx) + spread;
        this.addBall(request.x, request.y, Math.cos(angle) * BALL_SPEED, Math.sin(angle) * BALL_SPEED);
      }
    }
  }

  private addBall(x: number, y: number, vx: number, vy: number) {
    this.balls.push(this.pool.acquire(x, y, vx, vy, BALL_RADIUS));
  }

  private decayBrickFeedback(dt: number) {
    for (const brick of this.bricks) {
      if (brick.hitFlash > 0) brick.hitFlash = Math.max(0, brick.hitFlash - dt * 7.5);
    }
  }

  private updatePaddleWidth(dt: number) {
    if (this.wideTimer > 0) this.wideTimer = Math.max(0, this.wideTimer - dt);
    const maxWidth = (CANVAS_WIDTH - WALL * 2) * MAX_PADDLE_WIDTH_RATIO;
    const wideWidth = Math.min(PADDLE_WIDTH * WIDE_WIDTH_MULTIPLIER, maxWidth);
    const targetWidth = this.wideTimer > 0 ? wideWidth : PADDLE_WIDTH;
    this.paddleWidth += (targetWidth - this.paddleWidth) * Math.min(1, dt * 10);
    this.paddleX = Math.max(WALL, Math.min(CANVAS_WIDTH - WALL - this.paddleWidth, this.paddleX));
  }

  private nudgeQuietBall(ball: Ball) {
    if (ball.quietTime < 8) return;
    const speed = Math.max(BALL_SPEED * 0.8, Math.hypot(ball.vx, ball.vy));
    const angle = Math.atan2(ball.vy, ball.vx) + (Math.random() > 0.5 ? 0.28 : -0.28);
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    if (Math.abs(ball.vy) < BALL_SPEED * 0.22) ball.vy += ball.vy >= 0 ? BALL_SPEED * 0.22 : -BALL_SPEED * 0.22;
    ball.quietTime = 0;
  }

  private normalizeBallVelocity(ball: Ball) {
    normalizeBallSpeed(ball, BALL_SPEED);
    avoidBadAngles(ball, BALL_SPEED);
  }

  private removeBall(ball: Ball) {
    this.pool.release(ball);
    this.balls = this.balls.filter((item) => item !== ball);
  }

  private clearLevel() {
    if (this.status === "level-clear" || this.status === "all-clear") return;
    this.balls.forEach((ball) => this.pool.release(ball));
    this.balls = [];
    this.spawnQueue = [];
    this.wideTimer = 0;
    this.bonusScore = this.level * 100 + this.lives * 250;
    this.score += this.bonusScore;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      writeNumber(STORAGE_KEYS.bestScore, this.bestScore);
    }
    this.levelClearTimer = this.level >= TOTAL_LEVELS ? 0 : LEVEL_CLEAR_COUNTDOWN;
    this.lastClearCountdown = Math.ceil(this.levelClearTimer);
    if (this.level >= TOTAL_LEVELS) {
      this.status = "all-clear";
      this.highestUnlockedLevel = TOTAL_LEVELS;
    } else {
      this.status = "level-clear";
      this.highestUnlockedLevel = Math.max(this.highestUnlockedLevel, this.level + 1);
    }
    writeNumber(STORAGE_KEYS.highestUnlockedLevel, this.highestUnlockedLevel);
    this.emit();
  }

  private emit() {
    this.callbacks.onSnapshot(this.getSnapshot());
  }

  private render() {
    renderGame(this.ctx, this.bricks, this.balls, this.paddleX, this.paddleWidth, this.getSnapshot());
  }
}
