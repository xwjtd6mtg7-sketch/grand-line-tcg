let ctx: AudioContext | null = null;
let sfxMuted = false;
let sfxGain = 1;

export function setSfxMix(on: boolean, vol: number) {
  sfxMuted = !on;
  sfxGain = Math.max(0, Math.min(1, vol));
}

export function unlockSfx() {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function paperRip() {
  if (!ctx) return;
  const dur = 0.28;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = 1 - i / data.length;
    data[i] = (Math.random() * 2 - 1) * env * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.07 * sfxGain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start();
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.06, slide?: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
  g.gain.setValueAtTime(gain * sfxGain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export type SfxKind = "ui" | "play" | "don" | "attack" | "hit" | "block" | "pack" | "win" | "lose" | "draw";

export function sfx(kind: SfxKind) {
  if (sfxMuted || sfxGain <= 0.02 || !ctx || ctx.state !== "running") return;
  const r = () => 0.94 + Math.random() * 0.12;
  switch (kind) {
    case "ui":
      tone(520 * r(), 0.06, "triangle", 0.03);
      break;
    case "play":
      tone(220 * r(), 0.12, "square", 0.05, 140);
      tone(880 * r(), 0.08, "sine", 0.03);
      break;
    case "don":
      tone(392 * r(), 0.1, "triangle", 0.05);
      tone(588 * r(), 0.14, "sine", 0.03);
      break;
    case "attack":
      tone(140 * r(), 0.16, "sawtooth", 0.05, 70);
      break;
    case "hit":
      tone(90 * r(), 0.18, "square", 0.07, 50);
      tone(240 * r(), 0.1, "sawtooth", 0.04);
      break;
    case "block":
      tone(300 * r(), 0.1, "triangle", 0.05, 180);
      break;
    case "pack":
      tone(180 * r(), 0.2, "sawtooth", 0.05, 90);
      tone(720 * r(), 0.12, "sine", 0.04);
      paperRip();
      break;
    case "draw":
      tone(640 * r(), 0.07, "sine", 0.03);
      break;
    case "win":
      tone(523, 0.18, "triangle", 0.05);
      tone(659, 0.22, "triangle", 0.04);
      tone(784, 0.28, "sine", 0.05);
      break;
    case "lose":
      tone(220, 0.28, "sawtooth", 0.05, 80);
      break;
    default:
      break;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlockSfx, { once: true });
  window.addEventListener("keydown", unlockSfx, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockSfx();
  });
}
