import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_Y,
  TOTAL_LEVELS,
  WALL
} from "./constants";
import type { Ball, Brick, GameSnapshot } from "./types";

function brickColor(brick: Brick) {
  if (brick.kind === "x2") return "#65e5b5";
  if (brick.kind === "plus3") return "#72b7ff";
  if (brick.kind === "expand") return "#f28bd4";
  const ratio = brick.hp / Math.max(1, brick.maxHp);
  if (ratio > 0.72) return "#ff7c70";
  if (ratio > 0.42) return "#f5c35b";
  return "#f2f7fa";
}

function drawBreakableBrick(ctx: CanvasRenderingContext2D, brick: Brick) {
  const flash = brick.hitFlash;
  ctx.fillStyle = flash > 0 ? "#fff7d6" : brickColor(brick);
  ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

  ctx.strokeStyle = flash > 0 ? "#ffffff" : "rgba(255, 255, 255, 0.34)";
  ctx.lineWidth = 1;
  ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.width - 1, brick.height - 1);

  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.fillRect(brick.x + 2, brick.y + 2, Math.max(2, brick.width - 4), 2);

  if (flash > 0) {
    ctx.strokeStyle = "rgba(7, 16, 20, 0.42)";
    ctx.beginPath();
    ctx.moveTo(brick.x + 3, brick.y + brick.height - 3);
    ctx.lineTo(brick.x + brick.width - 4, brick.y + 3);
    ctx.moveTo(brick.x + brick.width * 0.35, brick.y + 3);
    ctx.lineTo(brick.x + brick.width - 3, brick.y + brick.height * 0.62);
    ctx.stroke();
  }

  ctx.fillStyle = "#081015";
  ctx.font = brick.width <= 14 ? "800 8px Arial" : "800 10px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(brick.hp), brick.x + brick.width / 2, brick.y + brick.height / 2 + 0.5);

  if (brick.kind !== "normal") {
    const label = brick.kind === "x2" ? "x2" : brick.kind === "plus3" ? "+3" : "寬";
    ctx.fillStyle = "rgba(8, 16, 21, 0.72)";
    ctx.font = brick.width <= 14 ? "700 5px Arial" : "700 6px Arial";
    ctx.fillText(label, brick.x + brick.width / 2, brick.y + brick.height - 3);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawMetalBrick(ctx: CanvasRenderingContext2D, brick: Brick) {
  const gradient = ctx.createLinearGradient(brick.x, brick.y, brick.x + brick.width, brick.y + brick.height);
  gradient.addColorStop(0, "#20272d");
  gradient.addColorStop(0.48, "#6f7a82");
  gradient.addColorStop(1, "#12171b");
  ctx.fillStyle = gradient;
  ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

  ctx.strokeStyle = "#05080a";
  ctx.lineWidth = 2;
  ctx.strokeRect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2);
  ctx.strokeStyle = "rgba(225, 235, 240, 0.44)";
  ctx.lineWidth = 1;
  ctx.strokeRect(brick.x + 2.5, brick.y + 2.5, brick.width - 5, brick.height - 5);

  ctx.fillStyle = "#11161a";
  const rivet = brick.width <= 14 ? 1.2 : 1.6;
  for (const [rx, ry] of [
    [brick.x + 3, brick.y + 3],
    [brick.x + brick.width - 3, brick.y + 3],
    [brick.x + 3, brick.y + brick.height - 3],
    [brick.x + brick.width - 3, brick.y + brick.height - 3]
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, rivet, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "#d7e0e5";
  ctx.lineWidth = brick.width <= 14 ? 1.2 : 1.6;
  ctx.beginPath();
  ctx.moveTo(brick.x + 5, brick.y + 5);
  ctx.lineTo(brick.x + brick.width - 5, brick.y + brick.height - 5);
  ctx.moveTo(brick.x + brick.width - 5, brick.y + 5);
  ctx.lineTo(brick.x + 5, brick.y + brick.height - 5);
  ctx.stroke();
}

function drawFireworks(ctx: CanvasRenderingContext2D, time: number) {
  const bursts = [
    { x: 160, y: 190, color: "#f5c35b", delay: 0 },
    { x: 360, y: 150, color: "#65e5b5", delay: 0.35 },
    { x: 555, y: 210, color: "#f28bd4", delay: 0.7 },
    { x: 250, y: 255, color: "#72b7ff", delay: 1.05 },
    { x: 470, y: 285, color: "#ff7c70", delay: 1.4 }
  ];

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const burst of bursts) {
    const phase = ((time + burst.delay) % 1.8) / 1.8;
    const radius = 16 + phase * 74;
    const alpha = 1 - phase;
    for (let i = 0; i < 18; i += 1) {
      const angle = (Math.PI * 2 * i) / 18 + burst.delay;
      const x = burst.x + Math.cos(angle) * radius;
      const y = burst.y + Math.sin(angle) * radius;
      ctx.fillStyle = burst.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, 2.2 + alpha * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawLevelClearOverlay(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot) {
  const time = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  drawFireworks(ctx, time);

  ctx.fillStyle = "rgba(5, 9, 12, 0.78)";
  ctx.fillRect(WALL + 34, 300, CANVAS_WIDTH - WALL * 2 - 68, 260);
  ctx.strokeStyle = "rgba(245, 195, 91, 0.75)";
  ctx.lineWidth = 2;
  ctx.strokeRect(WALL + 34.5, 300.5, CANVAS_WIDTH - WALL * 2 - 69, 259);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f5c35b";
  ctx.font = "800 34px Arial";
  ctx.fillText(snapshot.status === "all-clear" ? "全部關卡完成！" : "關卡完成！", CANVAS_WIDTH / 2, 350);

  ctx.fillStyle = "#eef6fb";
  ctx.font = "700 19px Arial";
  ctx.fillText(`第 ${snapshot.level} 關已通關`, CANVAS_WIDTH / 2, 388);

  ctx.font = "15px Arial";
  ctx.fillStyle = "#b8c8d3";
  ctx.fillText(`本關分數：${snapshot.levelScore}`, CANVAS_WIDTH / 2, 426);
  ctx.fillText(`獎勵分數：${snapshot.bonusScore}`, CANVAS_WIDTH / 2, 454);
  ctx.fillText(`目前總分：${snapshot.score}`, CANVAS_WIDTH / 2, 482);

  ctx.fillStyle = "#65e5b5";
  ctx.font = "700 16px Arial";
  const nextText =
    snapshot.status === "all-clear"
      ? "已通關全部關卡，可按「重新開始」再挑戰"
      : `按「下一關」繼續，或 ${snapshot.levelClearCountdown}s 後自動進入下一關`;
  ctx.fillText(nextText, CANVAS_WIDTH / 2, 520);

  ctx.fillStyle = "#8fa5b3";
  ctx.font = "13px Arial";
  ctx.fillText("也可以按「重新挑戰」重新挑戰本關", CANVAS_WIDTH / 2, 542);
  ctx.textAlign = "left";
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  bricks: Brick[],
  balls: Ball[],
  paddleX: number,
  paddleWidth: number,
  snapshot: GameSnapshot
) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#05090c";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "#101820";
  ctx.fillRect(0, 0, CANVAS_WIDTH, 76);
  ctx.fillRect(0, 0, WALL, CANVAS_HEIGHT);
  ctx.fillRect(CANVAS_WIDTH - WALL, 0, WALL, CANVAS_HEIGHT);

  ctx.fillStyle = "#eef6fb";
  ctx.font = "700 22px Arial";
  ctx.fillText(`關卡 ${snapshot.level} / ${TOTAL_LEVELS}`, 34, 32);
  ctx.font = "14px Arial";
  ctx.fillStyle = "#8fa5b3";
  const wide = snapshot.stats.wideSeconds > 0 ? `   變寬 ${snapshot.stats.wideSeconds}s` : "";
  ctx.fillText(`分數 ${snapshot.score}   生命 ${snapshot.lives}   最高分 ${snapshot.bestScore}${wide}`, 34, 56);

  for (const brick of bricks) {
    if (!brick.alive) continue;
    if (brick.kind === "indestructible") drawMetalBrick(ctx, brick);
    else drawBreakableBrick(ctx, brick);
  }

  ctx.fillStyle = "#f2f7fa";
  ctx.fillRect(paddleX, PADDLE_Y, paddleWidth, PADDLE_HEIGHT);
  ctx.fillStyle = "#65e5b5";
  ctx.fillRect(paddleX + 6, PADDLE_Y + 3, paddleWidth - 12, 3);

  ctx.fillStyle = balls.length > 128 ? "#ffffff" : "#f5c35b";
  for (const ball of balls) {
    if (!ball.active) continue;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (snapshot.status === "level-clear" || snapshot.status === "all-clear") {
    drawLevelClearOverlay(ctx, snapshot);
  } else if (snapshot.status !== "playing") {
    ctx.fillStyle = "rgba(5, 9, 12, 0.72)";
    ctx.fillRect(WALL, 300, CANVAS_WIDTH - WALL * 2, 160);
    ctx.fillStyle = "#eef6fb";
    ctx.font = "700 30px Arial";
    ctx.textAlign = "center";
    const label = snapshot.status === "game-over" ? "遊戲結束" : "點擊開始";
    ctx.fillText(label, CANVAS_WIDTH / 2, 376);
    ctx.font = "15px Arial";
    ctx.fillStyle = "#8fa5b3";
    ctx.fillText("使用滑鼠或觸控移動擋板。分裂道具沒有小球上限。", CANVAS_WIDTH / 2, 408);
    ctx.textAlign = "left";
  }
}
