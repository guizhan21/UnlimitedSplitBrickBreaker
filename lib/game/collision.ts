import { CANVAS_HEIGHT, CANVAS_WIDTH, HEADER_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, PADDLE_Y, WALL } from "./constants";
import type { Ball, Brick } from "./types";

const PLAYFIELD_LEFT = WALL;
const PLAYFIELD_RIGHT = CANVAS_WIDTH - WALL;
const PLAYFIELD_TOP = HEADER_HEIGHT;

export function normalizeBallSpeed(ball: Ball, targetSpeed: number) {
  const len = Math.hypot(ball.vx, ball.vy);
  if (!Number.isFinite(len) || len <= 0.0001) {
    ball.vx = targetSpeed * 0.5;
    ball.vy = -targetSpeed * 0.866;
    return;
  }
  ball.vx = (ball.vx / len) * targetSpeed;
  ball.vy = (ball.vy / len) * targetSpeed;
}

export function avoidBadAngles(ball: Ball, targetSpeed: number) {
  const minVertical = targetSpeed * 0.18;
  if (Math.abs(ball.vy) < minVertical) {
    ball.vy = ball.vy < 0 ? -minVertical : minVertical;
    normalizeBallSpeed(ball, targetSpeed);
  }

  const minHorizontal = targetSpeed * 0.04;
  if (Math.abs(ball.vx) < minHorizontal) {
    ball.vx = ball.vx < 0 ? -minHorizontal : minHorizontal;
    normalizeBallSpeed(ball, targetSpeed);
  }
}

export function hitPaddle(ball: Ball, paddleX: number, paddleWidth = PADDLE_WIDTH) {
  const withinX = ball.x + ball.radius > paddleX && ball.x - ball.radius < paddleX + paddleWidth;
  const withinY = ball.y + ball.radius > PADDLE_Y && ball.y - ball.radius < PADDLE_Y + PADDLE_HEIGHT;
  if (!withinX || !withinY || ball.vy <= 0) return false;
  const speed = Math.hypot(ball.vx, ball.vy);
  const hit = (ball.x - (paddleX + paddleWidth / 2)) / (paddleWidth / 2);
  const clamped = Math.max(-1, Math.min(1, hit));
  const maxAngle = Math.PI * 0.38;
  const angle = -Math.PI / 2 + clamped * maxAngle;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.y = PADDLE_Y - ball.radius - 0.5;
  return true;
}

export function hitWalls(ball: Ball) {
  let bounced = false;
  if (ball.x - ball.radius < PLAYFIELD_LEFT) {
    ball.x = PLAYFIELD_LEFT + ball.radius;
    ball.vx = Math.abs(ball.vx);
    bounced = true;
  }
  if (ball.x + ball.radius > PLAYFIELD_RIGHT) {
    ball.x = PLAYFIELD_RIGHT - ball.radius;
    ball.vx = -Math.abs(ball.vx);
    bounced = true;
  }
  if (ball.y - ball.radius < PLAYFIELD_TOP) {
    ball.y = PLAYFIELD_TOP + ball.radius;
    ball.vy = Math.abs(ball.vy);
    bounced = true;
  }
  return bounced;
}

export function isOut(ball: Ball) {
  return ball.y - ball.radius > CANVAS_HEIGHT;
}

export function collideBrick(ball: Ball, brick: Brick) {
  if (!brick.alive) return false;
  const nearestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
  const nearestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  if (dx * dx + dy * dy > ball.radius * ball.radius) return false;

  const brickCenterX = brick.x + brick.width / 2;
  const brickCenterY = brick.y + brick.height / 2;
  const deltaX = ball.x - brickCenterX;
  const deltaY = ball.y - brickCenterY;
  const overlapX = brick.width / 2 + ball.radius - Math.abs(deltaX);
  const overlapY = brick.height / 2 + ball.radius - Math.abs(deltaY);

  if (overlapX < overlapY) {
    const direction = deltaX < 0 ? -1 : 1;
    ball.x += direction * (overlapX + 0.1);
    ball.vx = direction * Math.abs(ball.vx);
  } else {
    const direction = deltaY < 0 ? -1 : 1;
    ball.y += direction * (overlapY + 0.1);
    ball.vy = direction * Math.abs(ball.vy);
  }
  hitWalls(ball);
  return true;
}
