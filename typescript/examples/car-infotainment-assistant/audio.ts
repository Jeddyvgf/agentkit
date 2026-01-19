import { clamp } from "./utils";

export type DspPresetName =
  | "reference"
  | "concert"
  | "hall"
  | "live"
  | "stadium"
  | "studio"
  | "club"
  | "driver_focus"
  | "night";

export type SurroundMode = "off" | "concert" | "hall" | "live" | "stadium" | "studio" | "club";

export interface EqBand {
  hz: number;
  db: number;
  q: number;
}

export interface SpatialSettings {
  width: number;
  depth: number;
  height: number;
}

export interface SurroundSettings {
  enabled: boolean;
  mode: SurroundMode;
  mix: number;
}

export interface DspSettings {
  eq: EqBand[];
  bassBoost: number;
  subLevel: number;
  loudness: number;
  clarity: number;
  reverb: number;
  limiter: number;
  surround: SurroundSettings;
  spatial: SpatialSettings;
  stageCenter: number;
  stageWidth: number;
  stageDepth: number;
}

export interface AudioOutputState {
  volume: number;
  balance: number;
  fader: number;
  mute: boolean;
}

export interface AutoTuneResult {
  eqAdjustments: EqBand[];
  targetLoudness: number;
  surroundMix: number;
  stageFocus: number;
  notes: string[];
}

const BASE_EQ: EqBand[] = [
  { hz: 60, db: 0, q: 1.1 },
  { hz: 125, db: 0, q: 1.1 },
  { hz: 250, db: 0, q: 1.2 },
  { hz: 1000, db: 0, q: 1.2 },
  { hz: 4000, db: 0, q: 1.1 },
  { hz: 8000, db: 0, q: 1.0 },
];

const DEFAULT_PRESETS: Record<DspPresetName, DspSettings> = {
  reference: {
    eq: BASE_EQ,
    bassBoost: 0,
    subLevel: 0,
    loudness: 0.35,
    clarity: 0.4,
    reverb: 0.1,
    limiter: 0.2,
    surround: { enabled: false, mode: "off", mix: 0 },
    spatial: { width: 0.4, depth: 0.35, height: 0.3 },
    stageCenter: 0.5,
    stageWidth: 0.45,
    stageDepth: 0.4,
  },
  concert: {
    eq: BASE_EQ,
    bassBoost: 0.2,
    subLevel: 0.3,
    loudness: 0.45,
    clarity: 0.5,
    reverb: 0.45,
    limiter: 0.3,
    surround: { enabled: true, mode: "concert", mix: 0.6 },
    spatial: { width: 0.8, depth: 0.7, height: 0.6 },
    stageCenter: 0.55,
    stageWidth: 0.75,
    stageDepth: 0.7,
  },
  hall: {
    eq: BASE_EQ,
    bassBoost: 0.15,
    subLevel: 0.2,
    loudness: 0.4,
    clarity: 0.55,
    reverb: 0.5,
    limiter: 0.25,
    surround: { enabled: true, mode: "hall", mix: 0.55 },
    spatial: { width: 0.75, depth: 0.8, height: 0.75 },
    stageCenter: 0.5,
    stageWidth: 0.7,
    stageDepth: 0.8,
  },
  live: {
    eq: BASE_EQ,
    bassBoost: 0.25,
    subLevel: 0.25,
    loudness: 0.5,
    clarity: 0.55,
    reverb: 0.35,
    limiter: 0.35,
    surround: { enabled: true, mode: "live", mix: 0.5 },
    spatial: { width: 0.7, depth: 0.6, height: 0.55 },
    stageCenter: 0.6,
    stageWidth: 0.65,
    stageDepth: 0.6,
  },
  stadium: {
    eq: BASE_EQ,
    bassBoost: 0.3,
    subLevel: 0.35,
    loudness: 0.55,
    clarity: 0.45,
    reverb: 0.6,
    limiter: 0.4,
    surround: { enabled: true, mode: "stadium", mix: 0.7 },
    spatial: { width: 0.9, depth: 0.85, height: 0.8 },
    stageCenter: 0.55,
    stageWidth: 0.85,
    stageDepth: 0.85,
  },
  studio: {
    eq: BASE_EQ,
    bassBoost: 0.05,
    subLevel: 0.1,
    loudness: 0.3,
    clarity: 0.65,
    reverb: 0.2,
    limiter: 0.25,
    surround: { enabled: true, mode: "studio", mix: 0.35 },
    spatial: { width: 0.55, depth: 0.45, height: 0.4 },
    stageCenter: 0.6,
    stageWidth: 0.55,
    stageDepth: 0.45,
  },
  club: {
    eq: BASE_EQ,
    bassBoost: 0.35,
    subLevel: 0.4,
    loudness: 0.6,
    clarity: 0.45,
    reverb: 0.35,
    limiter: 0.45,
    surround: { enabled: true, mode: "club", mix: 0.5 },
    spatial: { width: 0.7, depth: 0.6, height: 0.5 },
    stageCenter: 0.55,
    stageWidth: 0.6,
    stageDepth: 0.55,
  },
  driver_focus: {
    eq: BASE_EQ,
    bassBoost: 0.1,
    subLevel: 0.1,
    loudness: 0.35,
    clarity: 0.7,
    reverb: 0.1,
    limiter: 0.25,
    surround: { enabled: false, mode: "off", mix: 0 },
    spatial: { width: 0.35, depth: 0.25, height: 0.2 },
    stageCenter: 0.8,
    stageWidth: 0.4,
    stageDepth: 0.3,
  },
  night: {
    eq: BASE_EQ,
    bassBoost: 0.05,
    subLevel: 0,
    loudness: 0.2,
    clarity: 0.4,
    reverb: 0.05,
    limiter: 0.6,
    surround: { enabled: false, mode: "off", mix: 0 },
    spatial: { width: 0.3, depth: 0.2, height: 0.2 },
    stageCenter: 0.55,
    stageWidth: 0.35,
    stageDepth: 0.3,
  },
};

const DEFAULT_OUTPUT_STATE: AudioOutputState = {
  volume: 35,
  balance: 0,
  fader: 0,
  mute: false,
};

function cloneSettings(settings: DspSettings): DspSettings {
  return JSON.parse(JSON.stringify(settings)) as DspSettings;
}

export class AudioDspEngine {
  private presetName: DspPresetName;
  private settings: DspSettings;
  private output: AudioOutputState;

  constructor(preset: DspPresetName = "reference") {
    this.presetName = preset;
    this.settings = cloneSettings(DEFAULT_PRESETS[preset]);
    this.output = { ...DEFAULT_OUTPUT_STATE };
  }

  applyPreset(preset: DspPresetName): DspSettings {
    this.presetName = preset;
    this.settings = cloneSettings(DEFAULT_PRESETS[preset]);
    return cloneSettings(this.settings);
  }

  applyCustomSettings(patch: Partial<DspSettings>): DspSettings {
    this.settings = {
      ...this.settings,
      ...patch,
      surround: patch.surround
        ? { ...this.settings.surround, ...patch.surround }
        : this.settings.surround,
      spatial: patch.spatial
        ? { ...this.settings.spatial, ...patch.spatial }
        : this.settings.spatial,
      eq: patch.eq ?? this.settings.eq,
    };
    return cloneSettings(this.settings);
  }

  applyAutoTune(result: AutoTuneResult): DspSettings {
    const tunedEq = this.settings.eq.map(band => {
      const adjustment = result.eqAdjustments.find(entry => entry.hz === band.hz);
      if (!adjustment) {
        return band;
      }
      return { ...band, db: clamp(band.db + adjustment.db, -12, 12) };
    });

    this.settings = {
      ...this.settings,
      eq: tunedEq,
      surround: {
        ...this.settings.surround,
        enabled: result.surroundMix > 0.05,
        mix: clamp(result.surroundMix, 0, 1),
      },
      stageCenter: clamp(result.stageFocus, 0, 1),
    };

    return cloneSettings(this.settings);
  }

  setVolume(volume: number): void {
    this.output = { ...this.output, volume: clamp(volume, 0, 100) };
  }

  setBalance(balance: number): void {
    this.output = { ...this.output, balance: clamp(balance, -1, 1) };
  }

  setFader(fader: number): void {
    this.output = { ...this.output, fader: clamp(fader, -1, 1) };
  }

  toggleMute(): void {
    this.output = { ...this.output, mute: !this.output.mute };
  }

  getPresetName(): DspPresetName {
    return this.presetName;
  }

  getSettings(): DspSettings {
    return cloneSettings(this.settings);
  }

  getOutputState(): AudioOutputState {
    return { ...this.output };
  }

  describeCurrentProfile(): string {
    const surround = this.settings.surround.enabled
      ? `${this.settings.surround.mode} (${Math.round(this.settings.surround.mix * 100)}%)`
      : "off";
    return [
      `Preset: ${this.presetName}`,
      `Surround: ${surround}`,
      `Reverb: ${Math.round(this.settings.reverb * 100)}%`,
      `Stage: width ${Math.round(this.settings.stageWidth * 100)}%, depth ${Math.round(
        this.settings.stageDepth * 100,
      )}%`,
    ].join(" | ");
  }

  static listPresets(): DspPresetName[] {
    return Object.keys(DEFAULT_PRESETS) as DspPresetName[];
  }
}
