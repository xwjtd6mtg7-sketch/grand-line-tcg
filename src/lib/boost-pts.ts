export const BP_MAX = 5;
export const BP_MS = 5 * 60 * 60 * 1000;

export type BoostState = {
  bp: number;
  bpStock: number;
  bpAt: number;
  bpDay: string;
  bpMade: number;
};

export function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function syncBoost(s: BoostState, now = Date.now()): BoostState {
  let bp = Math.max(0, Math.min(BP_MAX, s.bp || 0));
  let bpStock = Math.max(0, Math.min(BP_MAX, s.bpStock || 0));
  let bpAt = s.bpAt || now;
  let bpDay = s.bpDay || dayKey(now);
  let bpMade = s.bpMade || 0;
  let gained = false;
  const today = dayKey(now);
  if (bpDay !== today) {
    bpMade = 0;
    bpDay = today;
  }
  while (bpAt + BP_MS <= now && bpStock < BP_MAX && bpMade < BP_MAX) {
    bpAt += BP_MS;
    bpStock += 1;
    bpMade += 1;
    gained = true;
  }
  if (gained) bpAt = now;
  return { bp, bpStock, bpAt, bpDay, bpMade };
}

export function nextBoostIn(s: BoostState, now = Date.now()) {
  const t = syncBoost(s, now);
  if (t.bpStock >= BP_MAX || t.bpMade >= BP_MAX) return 0;
  return Math.max(0, t.bpAt + BP_MS - now);
}

export function fmtEta(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")} h ${String(m).padStart(2, "0")} min`;
}

export function chargeProgress(s: BoostState, now = Date.now()) {
  const t = syncBoost(s, now);
  if (t.bpStock >= BP_MAX || t.bpMade >= BP_MAX) return 0;
  const left = Math.max(0, t.bpAt + BP_MS - now);
  return Math.max(0, Math.min(1, 1 - left / BP_MS));
}
