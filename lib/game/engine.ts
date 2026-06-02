import {
  BALL_RADIUS,
  BALL_SPEED,
  CANVAS_WIDTH,
  INITIAL_LIVES,
  PADDLE_WIDTH,
  PADDLE_Y,
  STORAGE_KEYS,
  TOTAL_LEVELS,
  WALL
} from "./constants";
import { collideBrick, hitPaddle, hitWalls, isOut } from "./collision";
import { generateLevel } from "./levels";
import { BallPool } from "./pools";
import { renderGame } from "./renderer";
import type { Ball, Brick, GameCallbacks, GameSnapshot, LevelLayoutType, SpawnRequest } from "./types";

const BRICK_BUCKET_SIZE = 24;
const MIN_BALL_SPEED = BALL_SPEED * 0.72;
const MAX_BALL_SPEED = BALL_SPEED * 1.45;

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
  private paddleX = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
  private paddleWidth = PADDLE_WIDTH;
  private level = 1;
  private lives = INITIAL_LIVES;
  private score = 0;
  private bestScore = 0;
  private highestUnlockedLevel = 1;
  private status: GameSnapshot["status"] = "ready";
  private raf = 0;
  private last = 0;
  private fps = 0;
  private frameCounter = 0;
  private fpsTimer = 0;
  private collisionChecks = 0;

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

  getSnapshot(): GameSnapshot {
    const breakableBricks = this.bricks.filter((brick) => brick.alive && brick.kind !== "indestructible").length;
    const metalBricks = this.bricks.filter((brick) => brick.alive && brick.kind === "indestructible").length;
    const balls = this.balls.length;
    return {
      level: this.level,
      lives: this.lives,
      score: this.score,
      bestScore: this.bestScore,
      highestUnlockedLevel: this.highestUnlockedLevel,
      status: this.status,
      stats: {
        fps: this.fps,
        balls,
        breakableBricks,
        metalBricks,
        layoutType: this.layoutType,
        cageCount: this.cageCount,
        reachableCheck: this.reachableCheck,
        collisionChecks: this.collisionChecks,
        pendingSpawns: this.spawnQueue.length,
        renderQuality: balls > 2048 ? "ultra" : balls > 512 ? "dot" : balls > 128 ? "simple" : "full"
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
    this.rebuildBrickGrid();
    this.balls.forEach((ball) => this.pool.release(ball));
    this.balls = [];
    this.spawnQueue = [];
    this.lives = INITIAL_LIVES;
    this.paddleWidth = PADDLE_WIDTH;
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
    if (this.status === "playing") this.update(dt);
    this.decayBrickFeedback(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.collisionChecks = 0;
    this.flushSpawns();
    for (const ball of [...this.balls]) {
      ball.quietTime += dt;
      const distance = Math.hypot(ball.vx, ball.vy) * dt;
      const steps = Math.max(1, Math.ceil(distance / 6));
      for (let i = 0; i < steps; i += 1) {
        ball.x += (ball.vx * dt) / steps;
        ball.y += (ball.vy * dt) / steps;
        if (hitWalls(ball)) this.callbacks.onSound?.("wall");
        if (hitPaddle(ball, this.paddleX, this.paddleWidth)) this.callbacks.onSound?.("paddle");
        this.hitBricks(ball);
        if (hitWalls(ball)) this.callbacks.onSound?.("wall");
        this.normalizeBallVelocity(ball);
      }
      this.nudgeQuietBall(ball);
      if (isOut(ball)) this.removeBall(ball);
    }
    if (this.balls.length === 0) {
      this.lives -= 1;
      if (this.lives <= 0) this.status = "game-over";
      else this.addBall(this.paddleX + PADDLE_WIDTH / 2, PADDLE_Y - 18, BALL_SPEED * 0.25, -BALL_SPEED);
      this.emit();
    }
    if (this.bricks.every((brick) => brick.kind === "indestructible" || !brick.alive)) this.clearLevel();
  }

  private hitBricks(ball: Ball) {
    for (const brick of this.nearbyBricks(ball)) {
      this.collisionChecks += 1;
      if (!collideBrick(ball, brick)) continue;
      this.callbacks.onSound?.(brick.kind === "indestructible" ? "metal" : brick.kind === "normal" ? "brick" : "power");
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
    for (let y = row - 1; y <= row + 1; y += 1) {
      for (let x = col - 1; x <= col + 1; x += 1) {
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
      this.paddleWidth = Math.min(230, this.paddleWidth + 32);
      this.paddleX = Math.max(WALL, Math.min(CANVAS_WIDTH - WALL - this.paddleWidth, this.paddleX - 16));
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
    const speed = Math.hypot(ball.vx, ball.vy);
    if (!Number.isFinite(speed) || speed < 1) {
      ball.vx = BALL_SPEED * 0.25;
      ball.vy = -BALL_SPEED;
      return;
    }
    if (speed < MIN_BALL_SPEED || speed > MAX_BALL_SPEED) {
      const target = Math.max(MIN_BALL_SPEED, Math.min(MAX_BALL_SPEED, speed));
      ball.vx = (ball.vx / speed) * target;
      ball.vy = (ball.vy / speed) * target;
    }
    if (Math.abs(ball.vy) < MIN_BALL_SPEED * 0.16) {
      ball.vy = ball.vy >= 0 ? MIN_BALL_SPEED * 0.16 : -MIN_BALL_SPEED * 0.16;
    }
  }

  private removeBall(ball: Ball) {
    this.pool.release(ball);
    this.balls = this.balls.filter((item) => item !== ball);
  }

  private clearLevel() {
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
