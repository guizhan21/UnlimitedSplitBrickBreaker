"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS, TOTAL_LEVELS } from "@/lib/game/constants";
import type { GameSnapshot } from "@/lib/game/types";
import { GameAudio } from "./GameAudio";
import { GameCanvas, type GameCanvasHandle } from "./GameCanvas";

const initialSnapshot: GameSnapshot = {
  level: 1,
  lives: 3,
  score: 0,
  levelScore: 0,
  bonusScore: 0,
  levelClearCountdown: 0,
  bestScore: 0,
  highestUnlockedLevel: 1,
  status: "ready",
  stats: {
    fps: 0,
    balls: 0,
    breakableBricks: 0,
    metalBricks: 0,
    powerDropRate: 0.5,
    brickSize: 16,
    brickGap: 2,
    gridRows: 0,
    gridColumns: 0,
    layoutType: "open_field",
    cageCount: 0,
    reachableCheck: true,
    collisionChecks: 0,
    outOfBoundsCorrections: 0,
    wallCollisions: 0,
    paddleCollisions: 0,
    brickCollisions: 0,
    metalCollisions: 0,
    subSteps: 0,
    pendingSpawns: 0,
    renderQuality: "full",
    musicState: "paused",
    pauseReason: null,
    wideSeconds: 0
  },
  pauseReason: null
};

const statusText: Record<GameSnapshot["status"], string> = {
  ready: "準備",
  playing: "遊玩中",
  "level-clear": "關卡完成",
  "game-over": "遊戲結束",
  "all-clear": "已通關全部關卡"
};

const musicText: Record<GameSnapshot["stats"]["musicState"], string> = {
  muted: "靜音",
  playing: "播放中",
  paused: "已暫停"
};

const pauseReasonText: Record<NonNullable<GameSnapshot["pauseReason"]>, string> = {
  user: "玩家",
  background: "背景"
};

export function GameShell() {
  const gameRef = useRef<GameCanvasHandle | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const lastLevelRef = useRef(1);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [levelInput, setLevelInput] = useState("1");
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEYS.audioMuted) === "true";
  });
  const [debugVisible, setDebugVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEYS.debugVisible) === "true";
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

  function setEngineMusicState() {
    const audio = audioRef.current;
    gameRef.current?.setMusicState(!audio || audio.isMuted() ? "muted" : audio.isPlaying() ? "playing" : "paused");
  }

  function startAudio() {
    const audio = getAudio();
    void audio.start().then(() => setEngineMusicState());
    if (typeof document !== "undefined" && document.visibilityState === "visible") gameRef.current?.setBackgroundPaused(false);
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
    if (!nextMuted) void audio.start().then(() => setEngineMusicState());
    else setEngineMusicState();
  }

  function toggleDebug() {
    const next = !debugVisible;
    setDebugVisible(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEYS.debugVisible, String(next));
  }

  function jumpToLevel() {
    const level = Math.max(1, Math.min(TOTAL_LEVELS, Number(levelInput) || 1));
    gameRef.current?.setLevel(level);
  }

  useEffect(() => {
    return () => audioRef.current?.dispose();
  }, []);

  useEffect(() => {
    function pauseForBackground() {
      audioRef.current?.pauseAll();
      gameRef.current?.setBackgroundPaused(true);
      setEngineMusicState();
    }

    function resumeFromBackground() {
      gameRef.current?.setBackgroundPaused(false);
      setEngineMusicState();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") pauseForBackground();
      else resumeFromBackground();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", pauseForBackground);
    window.addEventListener("pagehide", pauseForBackground);
    window.addEventListener("freeze", pauseForBackground);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", pauseForBackground);
      window.removeEventListener("pagehide", pauseForBackground);
      window.removeEventListener("freeze", pauseForBackground);
    };
  }, []);

  return (
    <main className="game-page">
      <aside className="side-panel">
        <section className="brand">
          <h1>無限分裂打磚塊</h1>
          <p>108 關高密度小方塊，無上限分裂，多球連鎖清場。</p>
        </section>

        <section className="stats" aria-label="遊戲狀態">
          <div className="stat">
            <span>關卡</span>
            <strong>
              {snapshot.level}/{TOTAL_LEVELS}
            </strong>
          </div>
          <div className="stat">
            <span>狀態</span>
            <strong>{statusText[snapshot.status]}</strong>
          </div>
          <div className="stat">
            <span>分數</span>
            <strong>{snapshot.score}</strong>
          </div>
          <div className="stat">
            <span>最高分</span>
            <strong>{snapshot.bestScore}</strong>
          </div>
          <div className="stat">
            <span>小球</span>
            <strong>{snapshot.stats.balls}</strong>
          </div>
          <div className="stat">
            <span>可破壞磚塊</span>
            <strong>{snapshot.stats.breakableBricks}</strong>
          </div>
          <div className="stat">
            <span>道具機率</span>
            <strong>{Math.round(snapshot.stats.powerDropRate * 100)}%</strong>
          </div>
          <div className="stat">
            <span>變寬</span>
            <strong>{snapshot.stats.wideSeconds > 0 ? `${snapshot.stats.wideSeconds}s` : "無"}</strong>
          </div>
          {snapshot.status === "level-clear" || snapshot.status === "all-clear" ? (
            <>
              <div className="stat">
                <span>本關分數</span>
                <strong>{snapshot.levelScore}</strong>
              </div>
              <div className="stat">
                <span>獎勵分數</span>
                <strong>{snapshot.bonusScore}</strong>
              </div>
              <div className="stat">
                <span>倒數</span>
                <strong>{snapshot.levelClearCountdown > 0 ? `${snapshot.levelClearCountdown}s` : "完成"}</strong>
              </div>
            </>
          ) : null}
        </section>

        <section className="controls" aria-label="遊戲控制">
          <button className="button primary" type="button" onClick={launchGame}>
            開始
          </button>
          <button className="button" type="button" onClick={toggleAudio}>
            {muted ? "開啟音樂" : "靜音"}
          </button>
          <button className="button" type="button" onClick={() => gameRef.current?.restart()}>
            重新挑戰
          </button>
          <button className="button" type="button" onClick={() => gameRef.current?.previousLevel()}>
            上一關
          </button>
          <button className="button" type="button" onClick={() => gameRef.current?.nextLevel()}>
            下一關
          </button>
          <input
            className="field"
            type="number"
            min={1}
            max={TOTAL_LEVELS}
            value={levelInput}
            onChange={(event) => setLevelInput(event.target.value)}
            aria-label="選擇關卡"
          />
          <button className="button" type="button" onClick={jumpToLevel}>
            前往
          </button>
          <button className="button" type="button" onClick={toggleDebug}>
            {debugVisible ? "隱藏除錯" : "除錯"}
          </button>
        </section>

        {debugVisible ? (
          <section className="debug-panel" aria-label="除錯資訊">
            <div>FPS: {snapshot.stats.fps}</div>
            <div>關卡: {snapshot.level}</div>
            <div>版型: {snapshot.stats.layoutType}</div>
            <div>磚塊大小: {snapshot.stats.brickSize}</div>
            <div>磚塊間距: {snapshot.stats.brickGap}</div>
            <div>grid rows: {snapshot.stats.gridRows}</div>
            <div>grid cols: {snapshot.stats.gridColumns}</div>
            <div>可破壞磚塊: {snapshot.stats.breakableBricks}</div>
            <div>金屬磚塊: {snapshot.stats.metalBricks}</div>
            <div>道具機率: {Math.round(snapshot.stats.powerDropRate * 100)}%</div>
            <div>目前小球: {snapshot.stats.balls}</div>
            <div>待生成小球: {snapshot.stats.pendingSpawns}</div>
            <div>碰撞檢查: {snapshot.stats.collisionChecks}</div>
            <div>邊界修正: {snapshot.stats.outOfBoundsCorrections}</div>
            <div>牆壁碰撞: {snapshot.stats.wallCollisions}</div>
            <div>擋板碰撞: {snapshot.stats.paddleCollisions}</div>
            <div>磚塊碰撞: {snapshot.stats.brickCollisions}</div>
            <div>金屬碰撞: {snapshot.stats.metalCollisions}</div>
            <div>subSteps/frame: {snapshot.stats.subSteps}</div>
            <div>渲染品質: {snapshot.stats.renderQuality}</div>
            <div>音樂狀態: {musicText[snapshot.stats.musicState]}</div>
            <div>暫停原因: {snapshot.pauseReason ? pauseReasonText[snapshot.pauseReason] : "無"}</div>
            <div>可達檢查: {snapshot.stats.reachableCheck ? "通過" : "失敗"}</div>
            <div>最高解鎖: {snapshot.highestUnlockedLevel}</div>
          </section>
        ) : null}

        <p className="hint">滑鼠或觸控可控制底部擋板。除錯資訊預設隱藏，不會覆蓋遊戲畫面。</p>
      </aside>

      <section className="canvas-wrap" aria-label="遊戲">
        <GameCanvas ref={gameRef} onSnapshot={handleSnapshot} onSound={handleSound} onUserStart={startAudio} />
      </section>
    </main>
  );
}
