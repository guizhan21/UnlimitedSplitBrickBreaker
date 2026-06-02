"use client";

import { STORAGE_KEYS } from "@/lib/game/constants";

type SoundKind = "wall" | "paddle" | "brick" | "metal" | "power";

const SOUND_PITCH: Record<SoundKind, number> = {
  wall: 420,
  paddle: 520,
  brick: 760,
  metal: 980,
  power: 1180
};

export class GameAudio {
  private music: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private muted = false;
  private lastSoundAt = 0;
  private wantsMusic = false;

  constructor() {
    if (typeof window === "undefined") return;
    this.muted = window.localStorage.getItem(STORAGE_KEYS.audioMuted) === "true";
    this.music = new Audio("/audio/pinball-kitchen.mp3");
    this.music.loop = true;
    this.music.volume = 0.34;
    this.music.muted = this.muted;
    this.music.preload = "auto";
  }

  async start() {
    if (this.muted) return;
    this.wantsMusic = true;
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
    await this.music?.play().catch(() => undefined);
  }

  async resumeMusicOnUserGesture() {
    if (!this.wantsMusic || this.muted) return;
    await this.start();
  }

  setMuted(nextMuted: boolean) {
    this.muted = nextMuted;
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEYS.audioMuted, String(nextMuted));
    if (this.music) this.music.muted = nextMuted;
    if (nextMuted) {
      this.wantsMusic = false;
      this.music?.pause();
    }
  }

  isMuted() {
    return this.muted;
  }

  isPlaying() {
    return !!this.music && !this.music.paused && !this.muted;
  }

  pauseAll() {
    this.music?.pause();
    void this.context?.suspend().catch(() => undefined);
  }

  dispose() {
    this.pauseAll();
    if (this.music) {
      this.music.pause();
      this.music.src = "";
      this.music.load();
    }
    void this.context?.close().catch(() => undefined);
    this.music = null;
    this.context = null;
  }

  play(sound: SoundKind) {
    if (this.muted || !this.context) return;
    const nowMs = performance.now();
    if (nowMs - this.lastSoundAt < 28) return;
    this.lastSoundAt = nowMs;

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = sound === "metal" ? "square" : "triangle";
    osc.frequency.setValueAtTime(SOUND_PITCH[sound], now);
    osc.frequency.exponentialRampToValueAtTime(SOUND_PITCH[sound] * 0.62, now + 0.055);
    gain.gain.setValueAtTime(sound === "power" ? 0.12 : 0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(this.context.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }
}
