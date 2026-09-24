/**
 * Road to One Piece — data + rules.
 * Add a region or a destination here. Do not scatter thresholds in the UI.
 */

export const ROAD_CONFIG = {
  points: { win: 30, draw: 5, loss: -10 },
  /** Bonus for the current win streak. 7+ stays at the last tier. */
  streak: [
    { at: 3, bonus: 5 },
    { at: 4, bonus: 10 },
    { at: 5, bonus: 15 },
    { at: 6, bonus: 20 },
    { at: 7, bonus: 20 },
  ],
  regions: [
    {
      id: "east_blue",
      name: "East Blue",
      tagline: "Le début de votre aventure",
      order: 1,
      destinations: [
        {
          id: "foosha",
          name: "Village de Fuchsia",
          order: 1,
          requiredPoints: 0,
          image: "/road/foosha.png",
          description: "Le port où tout commence. Le Log Pose s’éveille.",
          rewards: [{ id: "foosha_berries", kind: "berries", amount: 150, label: "150 Berries" }],
        },
        {
          id: "alvida",
          name: "Repaire d’Alvida",
          order: 2,
          requiredPoints: 200,
          image: "/road/alvida.png",
          description: "La crique d’Alvida. Le voyage quitte le rivage.",
          rewards: [{ id: "alvida_berries", kind: "berries", amount: 300, label: "300 Berries" }],
        },
        {
          id: "shells",
          name: "Ville de Shell",
          order: 3,
          requiredPoints: 500,
          image: "/road/shell.png",
          description: "La base marine de Shell. Le Log Pose pointe plus loin.",
          rewards: [{ id: "shell_berries", kind: "berries", amount: 500, label: "500 Berries" }],
        },
        {
          id: "orange",
          name: "Village d’Orange",
          order: 4,
          requiredPoints: 900,
          image: "/road/orange.png",
          description: "La grand-rue de Boodle. Le clown tient encore le port.",
          rewards: [{ id: "orange_berries", kind: "berries", amount: 700, label: "700 Berries" }],
        },
        {
          id: "syrup",
          name: "Village de Sirop",
          order: 5,
          requiredPoints: 1400,
          image: "/road/syrup.png",
          description: "La colline de Kaya. Usopp veille sur le village.",
          rewards: [{ id: "syrup_berries", kind: "berries", amount: 900, label: "900 Berries" }],
        },
        {
          id: "baratie",
          name: "Le Baratie",
          order: 6,
          requiredPoints: 2000,
          image: "/road/baratie.png",
          description: "Le restaurant flottant. Zeff règne en cuisine.",
          rewards: [{ id: "baratie_berries", kind: "berries", amount: 1200, label: "1200 Berries" }],
        },
        {
          id: "arlong",
          name: "Arlong Park",
          order: 7,
          requiredPoints: 2800,
          image: "/road/arlong.png",
          description: "Le parc d’Arlong. Cocoyasi retient son souffle.",
          rewards: [{ id: "arlong_berries", kind: "berries", amount: 1600, label: "1600 Berries" }],
        },
        {
          id: "loguetown",
          name: "Logue Town",
          order: 8,
          requiredPoints: 3800,
          image: "/road/loguetown.png",
          description: "La ville du début et de la fin. Dernière escale d’East Blue.",
          rewards: [{ id: "loguetown_berries", kind: "berries", amount: 2200, label: "2200 Berries" }],
        },
      ],
    },
    {
      id: "grand_line_entrance",
      name: "Entrée de Grand Line",
      tagline: "Là où la mer se redresse",
      order: 2,
      destinations: [
        {
          id: "twins",
          name: "Cap des Jumeaux",
          order: 1,
          requiredPoints: 5000,
          image: "/road/twins.png",
          description: "Le cap de Laboon. Ici commence vraiment Grand Line.",
          rewards: [{ id: "twins_berries", kind: "berries", amount: 2800, label: "2800 Berries" }],
        },
      ],
    },
  ],
  /** Optional stops between destinations. Empty until you add them. */
  milestones: [],
};

export function blankRoad() {
  return {
    points: 0,
    highestPoints: 0,
    winStreak: 0,
    bestStreak: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    claimed: {},
    settled: [],
    introSeen: false,
  };
}

export function allDestinations(config = ROAD_CONFIG) {
  const list = [];
  const regions = [...(config.regions || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const region of regions) {
    const dests = [...(region.destinations || [])].sort((a, b) => (a.order || 0) - (b.order || 0) || a.requiredPoints - b.requiredPoints);
    for (const d of dests) list.push({ ...d, regionId: region.id, regionName: region.name });
  }
  return list;
}

export function getRegionById(id, config = ROAD_CONFIG) {
  return (config.regions || []).find((r) => r.id === id) || null;
}

export function checkpointFloor(highestPoints, config = ROAD_CONFIG) {
  let floor = 0;
  for (const d of allDestinations(config)) {
    if ((Number(highestPoints) || 0) >= d.requiredPoints) floor = d.requiredPoints;
  }
  return floor;
}

export function streakBonus(streak, config = ROAD_CONFIG) {
  const n = Number(streak) || 0;
  let bonus = 0;
  for (const tier of config.streak || []) {
    if (n >= tier.at) bonus = tier.bonus;
  }
  return bonus;
}

export function normalizeRoad(raw) {
  const base = blankRoad();
  if (!raw || typeof raw !== "object") return base;
  base.points = Math.max(0, Math.floor(Number(raw.points) || 0));
  base.highestPoints = Math.max(base.points, Math.floor(Number(raw.highestPoints) || 0));
  base.winStreak = Math.max(0, Math.floor(Number(raw.winStreak) || 0));
  base.bestStreak = Math.max(base.winStreak, Math.floor(Number(raw.bestStreak) || 0));
  base.wins = Math.max(0, Math.floor(Number(raw.wins) || 0));
  base.losses = Math.max(0, Math.floor(Number(raw.losses) || 0));
  base.draws = Math.max(0, Math.floor(Number(raw.draws) || 0));
  base.introSeen = !!raw.introSeen;
  const claimed = {};
  if (raw.claimed && typeof raw.claimed === "object") {
    for (const [k, v] of Object.entries(raw.claimed)) {
      if (v) claimed[String(k).slice(0, 40)] = true;
    }
  }
  base.claimed = claimed;
  base.settled = Array.isArray(raw.settled)
    ? raw.settled.map((id) => String(id).slice(0, 16)).filter(Boolean).slice(-40)
    : [];
  const floor = checkpointFloor(base.highestPoints);
  if (base.points < floor) base.points = floor;
  return base;
}

export function getCurrentDestination(points, config = ROAD_CONFIG) {
  const list = allDestinations(config);
  let current = list[0] || null;
  const p = Number(points) || 0;
  for (const d of list) {
    if (p >= d.requiredPoints) current = d;
  }
  return current;
}

export function getNextDestination(points, config = ROAD_CONFIG) {
  const list = allDestinations(config);
  const p = Number(points) || 0;
  return list.find((d) => d.requiredPoints > p) || null;
}

export function getCurrentRegion(points, config = ROAD_CONFIG) {
  const dest = getCurrentDestination(points, config);
  if (!dest) return null;
  return getRegionById(dest.regionId, config);
}

export function destinationProgress(points, config = ROAD_CONFIG) {
  const current = getCurrentDestination(points, config);
  const next = getNextDestination(points, config);
  const p = Number(points) || 0;
  if (!current) return { ratio: 0, current: null, next: null, label: "" };
  if (!next) {
    return { ratio: 1, current, next: null, label: "Dernière destination disponible" };
  }
  const span = Math.max(1, next.requiredPoints - current.requiredPoints);
  const ratio = Math.max(0, Math.min(1, (p - current.requiredPoints) / span));
  const left = Math.max(0, next.requiredPoints - p);
  return {
    ratio,
    current,
    next,
    label: left + " Points avant " + next.name,
  };
}

export function unlockedDestinations(highestPoints, config = ROAD_CONFIG) {
  const p = Number(highestPoints) || 0;
  return allDestinations(config).filter((d) => p >= d.requiredPoints);
}

export function destinationState(dest, road, config = ROAD_CONFIG) {
  const state = normalizeRoad(road);
  const current = getCurrentDestination(state.points, config);
  const unlocked = state.highestPoints >= dest.requiredPoints;
  if (!unlocked) return "locked";
  if (current && current.id === dest.id) return "current";
  if ((Number(state.points) || 0) >= dest.requiredPoints) return "completed";
  return "unlocked";
}

export function applyRoadResult(road, outcome, matchId, config = ROAD_CONFIG) {
  const state = normalizeRoad(road);
  const id = String(matchId || "").slice(0, 16);
  if (!id) return { state, applied: false, reason: "match" };
  if (state.settled.includes(id)) return { state, applied: false, reason: "duplicate" };
  if (outcome !== "win" && outcome !== "loss" && outcome !== "draw") {
    return { state, applied: false, reason: "skip" };
  }
  const before = state.points;
  const beforeHighest = state.highestPoints;
  let bonus = 0;
  if (outcome === "win") {
    state.winStreak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.winStreak);
    state.wins += 1;
    bonus = streakBonus(state.winStreak, config);
  } else if (outcome === "loss") {
    state.winStreak = 0;
    state.losses += 1;
  } else {
    state.draws += 1;
  }
  const base = config.points[outcome] || 0;
  const raw = state.points + base + bonus;
  state.highestPoints = Math.max(state.highestPoints, raw);
  const floor = checkpointFloor(state.highestPoints, config);
  state.points = Math.max(floor, raw);
  state.settled = [...state.settled, id].slice(-40);
  const newly = unlockedDestinations(state.highestPoints, config)
    .filter((d) => beforeHighest < d.requiredPoints && state.highestPoints >= d.requiredPoints)
    .map((d) => d.id);
  return {
    state,
    applied: true,
    outcome,
    base,
    bonus,
    total: base + bonus,
    before,
    after: state.points,
    newly,
  };
}

export function rewardCatalog(config = ROAD_CONFIG) {
  const list = [];
  for (const d of allDestinations(config)) {
    for (const r of d.rewards || []) {
      list.push({ ...r, destinationId: d.id, requiredPoints: d.requiredPoints, place: d.name });
    }
  }
  for (const m of config.milestones || []) {
    for (const r of m.rewards || []) {
      list.push({ ...r, destinationId: m.id, requiredPoints: m.requiredPoints, place: m.label || "Escale" });
    }
  }
  return list;
}

export function rewardStatus(reward, road, config = ROAD_CONFIG) {
  const state = normalizeRoad(road);
  if (state.claimed[reward.id]) return "claimed";
  const dest = allDestinations(config).find((d) => (d.rewards || []).some((r) => r.id === reward.id));
  if (!dest) {
    if (state.highestPoints >= reward.requiredPoints) return "available";
    return "locked";
  }
  const status = destinationState(dest, state, config);
  const later = allDestinations(config).some((d) => d.requiredPoints > dest.requiredPoints);
  const finished = status === "completed" || (!later && (status === "current" || status === "completed"));
  return finished ? "available" : "locked";
}

export function claimReward(road, rewardId, config = ROAD_CONFIG) {
  const state = normalizeRoad(road);
  const reward = rewardCatalog(config).find((r) => r.id === rewardId);
  if (!reward) return { state, ok: false, reason: "unknown" };
  const status = rewardStatus(reward, state, config);
  if (status === "claimed") return { state, ok: false, reason: "claimed", reward };
  if (status !== "available") return { state, ok: false, reason: "locked", reward };
  state.claimed = { ...state.claimed, [reward.id]: true };
  return { state, ok: true, reward };
}

export function publicConfig(config = ROAD_CONFIG) {
  return {
    points: config.points,
    streak: config.streak,
    regions: (config.regions || []).map((region) => ({
      id: region.id,
      name: region.name,
      tagline: region.tagline || "",
      order: region.order || 0,
      destinations: [...(region.destinations || [])]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((d) => ({
          id: d.id,
          name: d.name,
          order: d.order || 0,
          requiredPoints: d.requiredPoints,
          image: d.image || "",
          description: d.description || "",
          rewards: (d.rewards || []).map((r) => ({ id: r.id, kind: r.kind, amount: r.amount, label: r.label })),
        })),
    })),
    milestones: (config.milestones || []).map((m) => ({
      id: m.id,
      requiredPoints: m.requiredPoints,
      label: m.label || "",
      rewards: m.rewards || [],
    })),
  };
}

export function viewModel(road, config = ROAD_CONFIG) {
  const state = normalizeRoad(road);
  const progress = destinationProgress(state.points, config);
  const current = progress.current;
  const next = progress.next;
  const regions = (config.regions || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((region) => ({
      id: region.id,
      name: region.name,
      tagline: region.tagline || "",
      destinations: [...(region.destinations || [])]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((d) => ({
          ...d,
          regionId: region.id,
          status: destinationState({ ...d, regionId: region.id }, state, config),
          rewards: (d.rewards || []).map((r) => ({
            ...r,
            status: rewardStatus({ ...r, requiredPoints: d.requiredPoints }, state, config),
          })),
        })),
    }));
  return {
    state,
    current,
    next,
    progress,
    regions,
    atEnd: !next,
  };
}
