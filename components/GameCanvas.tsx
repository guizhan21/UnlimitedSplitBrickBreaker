"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/game/constants";
import { BrickBreakerEngine } from "@/lib/game/engine";
import type { GameSnapshot } from "@/lib/game/types";

export type GameCanvasHandle = {
  launch: () => void;
  restart: () => void;
  nextLevel: () => void;
  previousLevel: () => void;
  setLevel: (level: number) => void;
};

type Props = {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onSound: (sound: "wall" | "paddle" | "brick" | "metal" | "power") => void;
  onUserStart: () => void;
};

export const GameCanvas = forwardRef<GameCanvasHandle, Props>(function GameCanvas({ onSnapshot, onSound, onUserStart }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BrickBreakerEngine | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new BrickBreakerEngine(canvas, { onSnapshot, onSound });
    engineRef.current = engine;
    engine.start();
    setReady(true);
    onSnapshot(engine.getSnapshot());
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [onSnapshot, onSound]);

  useImperativeHandle(ref, () => ({
    launch: () => engineRef.current?.launch(),
    restart: () => engineRef.current?.restart(),
    nextLevel: () => engineRef.current?.nextLevel(),
    previousLevel: () => engineRef.current?.previousLevel(),
    setLevel: (level: number) => engineRef.current?.setLevel(level)
  }));

  function movePointer(clientX: number) {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    engine.setPaddleFromClientX(clientX, canvas.getBoundingClientRect());
  }

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      aria-label={ready ? "Unlimited Split Brick Breaker game canvas" : "Loading game canvas"}
      onMouseMove={(event) => movePointer(event.clientX)}
      onPointerDown={(event) => {
        movePointer(event.clientX);
        onUserStart();
        engineRef.current?.launch();
      }}
      onTouchMove={(event) => {
        const touch = event.touches[0];
        if (touch) movePointer(touch.clientX);
      }}
    />
  );
});
