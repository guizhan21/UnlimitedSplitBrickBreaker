# Unlimited Split Brick Breaker

Next.js + TypeScript + Canvas 2D implementation of a dense Many Bricks Breaker-style game.

## Features

- 108 fixed-seed procedural levels.
- Level 1 starts with 80+ breakable bricks; levels 91-108 target 450-700 breakable bricks.
- Unlimited x2 split behavior with no hard ball cap.
- +3 power bricks, metal bricks, HP bricks, lives, score, best score.
- Debug level select, previous/next level controls, and restart.
- `localStorage` progress for best score, highest unlocked level, and last played level.
- Canvas debug overlay with FPS, active balls, bricks, collision checks, pending spawns, and render quality.
- Vercel-ready Next.js App Router project.

## Run

```powershell
cd D:\Codex_Web_Games\UnlimitedSplitBrickBreaker
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Verify

```powershell
npm run lint
npm run build
```

## Controls

Move the paddle with mouse or touch. Press Start or tap/click the canvas to launch.
