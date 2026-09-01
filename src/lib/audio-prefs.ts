import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { setMusicMix } from "@/lib/bgm";
import { setSfxMix } from "@/lib/sfx";
import { snapVol } from "@/components/gold-switch";

type AudioState = {
  musicOn: boolean;
  sfxOn: boolean;
  musicVol: number;
  sfxVol: number;
};

type AudioPrefs = AudioState & {
  setMusicOn: (v: boolean) => void;
  setSfxOn: (v: boolean) => void;
  setMusicVol: (v: number) => void;
  setSfxVol: (v: number) => void;
  resetAudio: () => void;
};

const DEFAULTS: AudioState = { musicOn: true, sfxOn: true, musicVol: 0.8, sfxVol: 0.8 };

function apply(p: AudioState) {
  setMusicMix(p.musicOn, p.musicVol);
  setSfxMix(p.sfxOn, p.sfxVol);
}

function loadSaved(): AudioState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem("gltcg-audio");
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as { state?: Partial<AudioState> } & Partial<AudioState>;
    const s = parsed.state ?? parsed;
    return {
      musicOn: s.musicOn !== false,
      sfxOn: s.sfxOn !== false,
      musicVol: snapVol(typeof s.musicVol === "number" ? s.musicVol : DEFAULTS.musicVol),
      sfxVol: snapVol(typeof s.sfxVol === "number" ? s.sfxVol : DEFAULTS.sfxVol),
    };
  } catch {
    return DEFAULTS;
  }
}

const INIT = loadSaved();
apply(INIT);

export const useAudio = create<AudioPrefs>()(
  persist(
    (set, get) => ({
      ...INIT,
      setMusicOn: (musicOn) => {
        const next = { ...get(), musicOn };
        set({ musicOn });
        apply(next);
      },
      setSfxOn: (sfxOn) => {
        const next = { ...get(), sfxOn };
        set({ sfxOn });
        apply(next);
      },
      setMusicVol: (musicVol) => {
        const v = snapVol(musicVol);
        const next = { ...get(), musicVol: v };
        set({ musicVol: v });
        apply(next);
      },
      setSfxVol: (sfxVol) => {
        const v = snapVol(sfxVol);
        const next = { ...get(), sfxVol: v };
        set({ sfxVol: v });
        apply(next);
      },
      resetAudio: () => {
        set({ ...DEFAULTS });
        apply(DEFAULTS);
      },
    }),
    {
      name: "gltcg-audio",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        musicOn: s.musicOn,
        sfxOn: s.sfxOn,
        musicVol: s.musicVol,
        sfxVol: s.sfxVol,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) apply(state);
      },
    },
  ),
);

export function hydrateAudio() {
  apply(useAudio.getState());
}
