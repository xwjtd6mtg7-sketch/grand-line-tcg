const SRC = "/audio/we-are.mp3";
const BASE = 0.42;

let audio: HTMLAudioElement | null = null;
let started = false;
let paused = false;
let musicOn = true;
let musicVol = 0.8;

function node() {
  if (!audio) {
    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = BASE * musicVol;
  }
  return audio;
}

function play() {
  if (!started || paused || !musicOn || musicVol <= 0.02) return;
  const a = node();
  a.volume = BASE * musicVol;
  const p = a.play();
  if (p) void p.catch(() => {});
}

export function setMusicMix(on: boolean, vol: number) {
  musicOn = on;
  musicVol = Math.max(0, Math.min(1, vol));
  if (audio) audio.volume = BASE * musicVol;
  if (!on || musicVol <= 0.02) node().pause();
  else play();
}

export function startBgm() {
  started = true;
  play();
}

export function setBgmPaused(on: boolean) {
  paused = on;
  if (!audio && !started) return;
  if (on) node().pause();
  else play();
}

export function preloadBgm() {
  node();
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") node().pause();
    else play();
  });
}
