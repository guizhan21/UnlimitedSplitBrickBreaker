import type { Ball } from "./types";

export class BallPool {
  private pool: Ball[] = [];

  acquire(x: number, y: number, vx: number, vy: number, radius: number): Ball {
    const ball = this.pool.pop() ?? { active: false, x: 0, y: 0, vx: 0, vy: 0, radius, quietTime: 0 };
    ball.active = true;
    ball.x = x;
    ball.y = y;
    ball.vx = vx;
    ball.vy = vy;
    ball.radius = radius;
    ball.quietTime = 0;
    return ball;
  }

  release(ball: Ball) {
    ball.active = false;
    this.pool.push(ball);
  }
}
