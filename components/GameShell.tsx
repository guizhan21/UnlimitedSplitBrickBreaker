"use client";

import { useCallback, useRef, useState } from "react";
import { TOTAL_LEVELS } from "@/lib/game/constants";
import type { GameSnapshot } from "@/lib/game/types";
import { GameAudio } from "./GameAudio";
import { GameCanvas, type GameCanvasHandle } from "./GameCanvas";

const initialSnapshot: GameSnapshot = {
  level: 1,
  lives: 3,
  score: 0,
  bestScore: 0,
  highestUnlockedLevel: 1,
  status: "ready",
  stats: {
    fps: 0,
    balls: 0,
    breakableBricks: 0,
    metalBricks: 0,
    layoutType: "open_field",
    cageCount: 0,
    reachableCheck: true,
    collisionChecks: 0,
    pendingSpawns: 0,
    renderQuality: "full"
  }
};

export function GameShell() {
  const gameRef = useRef<GameCanvasHandle | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const lastLevelRef = useRef(1);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [levelInput, setLevelInput] = useState("1");
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("usb_audioMuted") === "true";
  });
  const handleSnapshot = useCallback((next: GameSnapshot) => {
    setSnapshot(next);
    if (next.level !== lastLevelRef.current) {
      lastLevelRef.current = next.level;
      setLevelInput(String(next.level));
    }
  }, []);

  function getAudio() {
    audioRef.current ??= new GameAudio();
    return audioRef.current;
  }

  function startAudio() {
    void getAudio().start();
  }

  const handleSound = useCallback((sound: "wall" | "paddle" | "brick" | "metal" | "power") => {
    audioRef.current?.play(sound);
  }, []);

  function launchGame() {
    startAudio();
    gameRef.current?.launch();
  }

  function toggleAudio() {
    const nextMuted = !muted;
    const audio = getAudio();
    audio.setMuted(nextMuted);
    setMuted(nextMuted);
    if (!nextMuted) void audio.start();
  }

  function jumpToLevel() {
    const level = Math.max(1, Math.min(TOTAL_LEVELS, Number(levelInput) || 1));
    gameRef.current?.setLevel(level);
  }

  return (
    <main className="game-page">
      <aside className="side-panel">
        <section className="brand">
          <h1>Unlimited Split Brick Breaker</h1>
          <p>108 dense levels, uncapped split balls, Canvas 2D.</p>
        </section>

        <section className="stats" aria-label="Game status">
          <div className="stat">
            <span>Level</span>
            <strong>
              {snapshot.level}/{TOTAL_LEVELS}
            </strong>
          </div>
          <div className="stat">
            <span>Status</span>
            <strong>{snapshot.status}</strong>
          </div>
          <div className="stat">
            <span>Score</span>
            <strong>{snapshot.score}</strong>
          </div>
          <div className="stat">
            <span>Best</span>
            <strong>{snapshot.bestScore}</strong>
          </div>
          <div className="stat">
            <span>Balls</span>
            <strong>{snapshot.stats.balls}</strong>
          </div>
          <div className="stat">
            <span>Bricks</span>
            <strong>{snapshot.stats.breakableBricks}</strong>
          </div>
        </section>

        <section className="controls" aria-label="Game controls">
          <button className="button primary" type="button" onClick={launchGame}>
            Start
          </button>
          <button className="button" type="button" onClick={toggleAudio}>
            {muted ? "Unmute" : "Mute"}
          </button>
          <button className="button" type="button" onClick={() => gameRef.current?.restart()}>
            Restart
          </button>
          <button className="button" type="button" onClick={() => gameRef.current?.previousLevel()}>
            Prev
          </button>
          <button className="button" type="button" onClick={() => gameRef.current?.nextLevel()}>
            Next
          </button>
          <input
            className="field"
            type="number"
            min={1}
            max={TOTAL_LEVELS}
            value={levelInput}
            onChange={(event) => setLevelInput(event.target.value)}
            aria-label="Debug level select"
          />
          <button className="button" type="button" onClick={jumpToLevel}>
            Go
          </button>
        </section>

        <section className="debug-panel" aria-label="Debug overlay values">
          <div>FPS: {snapshot.stats.fps}</div>
          <div>Active balls: {snapshot.stats.balls}</div>
          <div>Layout: {snapshot.stats.layoutType}</div>
          <div>Indestructible: {snapshot.stats.metalBricks}</div>
          <div>Cages/chambers: {snapshot.stats.cageCount}</div>
          <div>Reachable: {snapshot.stats.reachableCheck ? "yes" : "no"}</div>
          <div>Collision checks: {snapshot.stats.collisionChecks}</div>
          <div>Pending spawns: {snapshot.stats.pendingSpawns}</div>
          <div>Render quality: {snapshot.stats.renderQuality}</div>
          <div>Highest unlocked: {snapshot.highestUnlockedLevel}</div>
        </section>

        <p className="hint">Pointer or touch controls the paddle. Debug level select is intentionally always available.</p>
      </aside>

      <section className="canvas-wrap" aria-label="Game">
        <GameCanvas ref={gameRef} onSnapshot={handleSnapshot} onSound={handleSound} onUserStart={startAudio} />
      </section>
    </main>
  );
}
