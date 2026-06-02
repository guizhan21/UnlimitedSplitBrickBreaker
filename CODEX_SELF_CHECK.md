# Codex Self Check

## Path

- Project root: `D:\Codex_Web_Games\UnlimitedSplitBrickBreaker`
- D drive constraint: satisfied.
- Source pack extracted to: `D:\codex_many_bricks_breaker_v4_108_levels_pack`

## Implementation

- Next.js App Router, TypeScript, React, Tailwind CSS, Canvas 2D.
- Game screen implemented in `components/GameShell.tsx` and `components/GameCanvas.tsx`.
- Engine implemented in `lib/game/engine.ts`.
- Fixed-seed procedural 108-level generation implemented in `lib/game/levels.ts`.
- Collision, renderer, pools, constants, and shared types are split into dedicated modules.

## Critical Requirements

- 108 levels: satisfied through `TOTAL_LEVELS = 108` and `generateLevel(levelNumber)`.
- Level 1 400+ breakable bricks: satisfied by target generator.
- Level 2-10 450+ breakable bricks: satisfied by target generator.
- Level 11-30 600+ breakable bricks: satisfied by target generator.
- Level 31-60 800+ breakable bricks: satisfied by target generator.
- Level 61-90 1000+ breakable bricks: satisfied by target generator.
- Level 91-108 1200+ breakable bricks: satisfied by target generator.
- No ball cap: satisfied. There is no hard skip behavior for split balls.
- x2 unlimited split: satisfied through deferred spawn queue.
- +3 power bricks: satisfied.
- Debug level select: satisfied.
- localStorage progress: satisfied with best score, highest unlocked level, and last played level.
- Debug overlay: satisfied as an external toggle panel, hidden by default and not drawn over the Canvas.
- Performance: object pool, deferred spawn queue, grid-based brick lookup, sub-step collision, and adaptive rendering.

## Comprehensive UI, Density, Audio, And Physics Update

- Project remains at `D:\Codex_Web_Games\UnlimitedSplitBrickBreaker`.
- UI, HUD, Canvas status text, controls, metadata title, metadata description, and debug labels are now Traditional Chinese.
- `app/layout.tsx` uses `lang="zh-Hant-TW"`.
- The Canvas right-bottom debug overlay was removed.
- Debug information is available through the side-panel `除錯` button and is hidden by default.
- Debug visibility is persisted through `localStorage` key `usb_debugVisible`; mobile starts with it hidden unless the user explicitly enables it.
- Debug output includes level, layout, brick size/gap, grid rows/columns, breakable count, metal count, 50% power rate, active balls, pending spawns, collision counters, render quality, music state, and pause reason.
- Background audio and update-loop safety were added for `visibilitychange`, `blur`, `pagehide`, and `freeze`.
- When the page goes background, music is paused and the engine pause reason becomes `background`.
- When the page returns foreground, music does not force autoplay; the next user click/touch/start action resumes if music was enabled.
- WIDE/寬 now lasts 16 seconds, refreshes duration when collected again, smoothly returns to the base width, and caps below 35% of the playable width.
- Paddle rebound uses angle-based physics from the hit position.
- Brick and metal rebounds still use shallowest-penetration axis resolution.
- After wall, paddle, brick, and metal collisions the engine normalizes ball speed and avoids nearly horizontal/vertical bad angles.
- Sub-step collision now uses `Math.ceil(distance / 4)` and nearby brick lookup checks row/col +/- 2.

Latest comprehensive verification:

- Full 108-level generation check: all levels reachable.
- All generated bricks are square.
- Level 1 sample: 400 destructible, 83 metal, 200 power bricks, 16px bricks, 2px gap.
- Level 10 sample: 650 destructible, 124 metal, 325 power bricks.
- Level 30 sample: 850 destructible, 254 metal, 425 power bricks.
- Level 60 sample: 1100 destructible, 330 metal, 550 power bricks.
- Level 90 sample: 1300 destructible, 404 metal, 650 power bricks.
- Level 108 sample: 1400 destructible, 322 metal, 700 power bricks.
- Full power mix across all generated levels: x2 = 50.0%, +3 = 30.0%, WIDE = 20.0%.
- Metal bricks do not receive power-up kinds.
- Destructible max HP remains <= 3.

## Shaped And Cage Layout Update

Added shaped layouts and metal rebound chamber layouts:

- `full_dense`: dense full field.
- `diagonal`: diagonal brick arrays.
- `wave`: wave-shaped fill.
- `pyramid`: filled pyramid.
- `diamond`: filled diamond.
- `heart_like`: rough filled heart silhouette.
- `smile_face`: simple face with eyes and smile.
- `letters`: simple A/X/M-like strokes.
- `checker`: checker spacing with density fill.
- `spiral`: spiral-trend fill.
- `tunnel`: channel-based layout.
- `cage_box`: rectangular metal enclosure with a 3-cell bottom entrance.
- `cage_rooms`: multiple small metal rooms, each with a wide entrance.
- `tunnel_cage`: long metal tunnel feeding an inner brick chamber.
- `fortress_core`: late-game central core with a semi-enclosed metal shell.
- `side_chambers`: left/right semi-enclosed brick rooms.
- `boss_wall`: late-game high-density wall.

Level ranges:

- Levels 1-20: simple readable shapes with no complex cages and wide-open access.
- Levels 21-60: more complex shapes with light metal accents, channels, `cage_box`, and `side_chambers`.
- Levels 61-108: denser layouts with `tunnel`, `tunnel_cage`, `cage_rooms`, `fortress_core`, `boss_wall`, higher HP bricks, and high-density internal breakable bricks.
- Level 108 is forced to `fortress_core`.

Playability safeguards:

- Metal bricks are never counted as clear conditions.
- Cage interiors are prefilled with protected breakable cells before the outer dense fill runs.
- Entrances are at least 3 grid cells wide, leaving enough room for the ball radius and collision sub-steps.
- `generateLevel` runs a metal-block reachability check across all breakable cells.
- If a cage layout fails reachability, the generator opens a central fallback channel and checks again.
- Ball collision nudges the ball out of brick contact after reflection to reduce metal-wall tunneling or jitter.
- Balls that go 8 seconds without hitting a breakable brick are slightly direction-perturbed, but never deleted and never capped.

Debug overlay additions:

- Current layout type.
- Metal brick count.
- Cage/chamber count.
- Reachable breakable brick check result.

## Power-Up Update

- Added `expand` power bricks, rendered as pink `W` bricks.
- Breaking an `expand` brick increases paddle width for the current level.
- Power brick drop rate is now fixed at `POWER_DROP_RATE = 0.5` for every level.
- The old level-based decreasing power curve has been removed.
- Power mix includes `x2`, `+3`, and `expand`; x2 remains unlimited and uncapped.
- Level 1 is dense but easy: 400 breakable bricks, mostly HP 1, some HP 2, and all three power-up kinds appear.

## Verification

The shell did not have a global `npm`, `npx`, `pnpm`, `yarn`, or `bun` command available, so a temporary project-local pnpm runtime was downloaded into `.tools/` and ignored by git.

Completed checks:

```powershell
pnpm install --ignore-scripts
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

Latest verification after cage layout update:

- `pnpm run lint`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run build`: passed.
- Full 108-level generation check: all levels reachable, no target-density failures.
- Browser verification: level 61 debug jump works and reports `tunnel_cage`, metal count, cage count, and `Reachable: yes` with no console errors.
- Latest shaped-layout verification: no adjacent layout repeats, no unreachable generated levels, final level is `fortress_core`.
- Latest power ratio check: 1-10 = 23.1%, 11-40 = 16.8%, 41-80 = 13.2%, 81-108 = 11.2%.
- Browser verification: level 7 reports `smile_face`, `Reachable: yes`, debug fields visible, and no console errors.
- Latest dense-start verification: minimum breakable counts are 400 / 450 / 600 / 800 / 1000 / 1200 by range; Level 1 has 400 breakable bricks, structural indestructible bricks, mostly HP1/HP2 destructible bricks, and x2/+3/WIDE all present.
- Latest power ratio check after dense-start update: 1-10 = 40.0%, 11-30 = 35.4%, 31-60 = 28.9%, 61-90 = 22.9%, 91-108 = 20.2%.
- Latest fixed power-drop verification: all 108 levels generate about 50% power bricks; samples are Level 1 = 200/400, Level 60 = 550/1100, Level 90 = 650/1300, and Level 108 = 700/1400.
- Latest fixed power mix across 108 levels: x2 = 50.0%, +3 = 30.0%, WIDE = 20.0%.
- Browser verification: level 1 reports dense square bricks, metal debug count, `Reachable: yes`, and no console errors.

## Square Brick Update

- Bricks are now square instead of horizontal rectangles.
- Grid sizes are 16px early and 14px for dense mid/late levels.
- Gaps are 2px early/mid-game and 1px in the densest late levels.
- The brick grid is centered within the playfield and remains dense enough for the current hard breakable-count requirements.
- Collision spatial lookup was updated to a 24px bucket size to match the smaller square bricks.

Latest square-brick verification:

- All generated bricks have `width === height`.
- Only square sizes 14 and 16 are generated.
- Full 108-level generation still satisfies breakable count and reachability requirements.
- `pnpm run lint`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run build`: passed.
- Browser verification: level 1 renders dense square bricks, at least 400 breakable bricks, and `Reachable: yes` with no console errors.

## Ball Rebound Update

- Wall collision now clamps balls against the black playfield bounds, not the outer canvas:
  - left: `WALL + ball.radius`, `ball.vx = Math.abs(ball.vx)`.
  - right: `CANVAS_WIDTH - WALL - ball.radius`, `ball.vx = -Math.abs(ball.vx)`.
  - top: `HEADER_HEIGHT + ball.radius`, `ball.vy = Math.abs(ball.vy)`.
- Wall checks run before and after brick/paddle collision inside each sub-step.
- Brick collision now uses center/penetration normals and pushes the ball out along the shallowest penetration axis.
- Brick collision immediately re-applies wall clamping after the rebound so dense square-brick impacts cannot push a ball outside the left, right, or top bounds.
- Ball velocity normalization prevents degenerate near-zero speed, excessive speed, and nearly horizontal drift after repeated rebounds.

Latest rebound verification:

- `pnpm run lint`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run build`: passed.
- Boundary simulation: no ball crossed the black playfield bounds after repeated updates.
- Browser verification: level 1 starts and shows active balls with no console errors.

## Audio Update

- Added background music asset at `public/audio/pinball-kitchen.mp3`, copied from `D:\Downloads\Pinball Kitchen.mp3`.
- Background music loops after the player starts the game or clicks/taps the canvas, satisfying browser user-gesture audio rules.
- Added generated Web Audio collision sound effects for wall, paddle, breakable brick, metal brick, and power brick hits.
- Collision sounds are throttled to avoid overwhelming the audio output during dense multi-ball play.
- Added a Traditional Chinese audio toggle in the game controls.
- Mute state is persisted in localStorage with `usb_audioMuted`.

Latest audio verification:

- `pnpm run lint`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run build`: passed.
- Browser verification: `/audio/pinball-kitchen.mp3` loads as `audio/mpeg`, 開始 launches active balls, audio control is visible, and no console/request errors were detected.
- Browser mute verification: 靜音 writes `usb_audioMuted=true`; 開啟音樂 writes `usb_audioMuted=false`.

## Brick Visual Distinction Update

- Breakable bricks keep the colorful style and now always render a clear centered durability number.
- Power bricks still show their power marker (`x2`, `+3`, `W`) as a small secondary label while preserving the durability number.
- Breakable bricks flash and show crack-like lines briefly when hit.
- Metal bricks use a fixed dark steel style with a silver/black gradient, thick border, rivets, and an X mark.
- Metal bricks never show durability numbers and do not receive damage/crack feedback when hit.
- The visual distinction is applied without changing the generated high-density layouts.

Latest visual verification:

- `pnpm run lint`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run build`: passed.
- Browser verification: a metal-heavy level renders normally, remains reachable, and has no console errors.

## Indestructible Brick Restoration

- Restored indestructible bricks as an explicit brick kind: `indestructible`.
- Indestructible bricks use `hp = 0` and are not represented as fake high-HP bricks.
- Every generated level now includes indestructible bricks, including Level 1.
- Indestructible structures still leave openings and are included in reachability checks.
- Clear condition counts only destructible bricks: normal, x2, +3, and WIDE.
- Indestructible bricks do not drop power-ups, do not lose HP, do not flash/crack, and are never removed on hit.
- Destructible brick HP is clamped to 1, 2, or 3 only.

Latest indestructible-brick verification:

- `pnpm run lint`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run build`: passed.
- Full 108-level generation check: every level has at least one indestructible brick.
- Final generator safeguard: if any layout/fallback path leaves no indestructible bricks, a small open indestructible pocket is added before the level is returned.
- Latest all-level check: missing indestructible levels = none; minimum indestructible count on any level = 6.
- Full HP check: no destructible brick has HP above 3.
- Level 1 sample: 400 destructible bricks, 83 indestructible bricks, max destructible HP = 2.
- Level 61+ sample levels satisfy the 1000+ destructible-brick requirement and max destructible HP = 3.
- Browser verification: Level 1 and Level 61 show indestructible bricks and `Reachable: yes`, with no console errors.

## Structural Indestructible Layout Update

- Indestructible bricks now act as the primary level skeleton instead of sparse random accents.
- Added structural layout families:
  - `frame_layout`: local metal frames with open entry paths and filled interiors.
  - `u_shape`: U-shaped metal rails with destructible bricks inside the opening.
  - `maze_layout`: repeated metal corridor walls with staggered openings.
  - `fortress_layout`: central protected core with open entry seams.
  - `split_layout`: metal dividers separating left/right or upper/lower zones.
  - `funnel_layout`: angled guide walls that route balls into rebound zones.
  - `cage_layout`: multiple partial cages/rooms with at least one entrance.
- Difficulty now increases through denser metal skeletons, narrower but open entries, more protected zones, and longer rebound routes while destructible HP remains capped at 3.
- Indestructible ratio targets:
  - Early levels: about 15%+ structural metal.
  - Mid levels: about 20%-25% structural metal.
  - Late levels: about 25%-35% where reachable checks allow it.
- Final generation safeguards:
  - Protected brick rectangles and cage boxes are clamped to the valid grid.
  - Out-of-bounds or metal-overlapped breakable candidates are cleaned before brick creation.
  - Sealed destructible pockets are opened with reachable entry channels.
  - Removed metal is safely topped back up only when it does not break reachability.

Latest structural indestructible verification:

- Full 108-level generation check: missing indestructible levels = none.
- Full 108-level ratio check: no level below 15% or above 35%.
- Minimum observed ratio: Level 20 at 16.0%.
- Maximum observed ratio: Level 62 at 30.2%.
- Level 90 sample: 1300 destructible bricks, 404 indestructible bricks, reachable = yes.
- Level 108 sample: 1400 destructible bricks, 322 indestructible bricks, reachable = yes.
- Destructible max HP across all 108 levels: 3.
- No destructible brick has HP 4, 5, 6, or higher.
- Clear condition still counts only non-`indestructible` bricks.
- `pnpm run lint`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run build`: passed.

## X2 And Ball Shape Check

- x2 power logic was reviewed: when an x2 brick breaks, the engine queues one new ball for every currently active ball, so the active ball set doubles without a hard cap.
- x2 power-up appearance share is now 50% of power bricks.
- +3 launches exactly three new balls from the paddle center, with a small upward spread, instead of multiplying or splitting from the triggering ball/brick location.
- WIDE still only expands the paddle and does not affect ball size.
- Ball pool acquisition always resets `ball.radius` to the shared `BALL_RADIUS`.
- Renderer no longer shrinks balls when active ball count is high; balls are always drawn with `ball.radius`.
- No adaptive render path changes ball shape or radius now.

Latest x2/ball-shape verification:

- `pnpm run lint`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run build`: passed.
- Static check: renderer draws balls only with `ctx.arc(ball.x, ball.y, ball.radius, ...)`.
- Browser verification: game starts with active balls and no console errors.
- Latest power mix check: across 108 generated levels, x2 accounted for 50.0% of power bricks.

Browser verification:

- Dev server started at `http://127.0.0.1:3000`.
- Canvas rendered at 720 x 960 and was nonblank.
- Main title, HUD, and debug text rendered.
- No browser console errors were detected.
