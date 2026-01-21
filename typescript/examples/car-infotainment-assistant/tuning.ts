import { AutoTuneResult, EqBand } from "./audio";
import { clamp } from "./utils";

export interface FrequencySample {
  hz: number;
  db: number;
}

export interface CalibrationSnapshot {
  cabin: string;
  micPosition: string;
  ambientNoiseDb: number;
  samples: FrequencySample[];
}

export class AutoTuner {
  analyze(snapshot: CalibrationSnapshot): AutoTuneResult {
    const low = averageDb(snapshot.samples.filter(sample => sample.hz <= 200));
    const mid = averageDb(
      snapshot.samples.filter(sample => sample.hz > 200 && sample.hz <= 2000),
    );
    const high = averageDb(snapshot.samples.filter(sample => sample.hz > 2000));

    const eqAdjustments: EqBand[] = [
      { hz: 60, db: clamp(-low / 4, -6, 6), q: 1.1 },
      { hz: 250, db: clamp(-mid / 4, -4, 4), q: 1.2 },
      { hz: 4000, db: clamp(-high / 4, -4, 4), q: 1.0 },
    ];

    const surroundMix = clamp(0.35 + (snapshot.ambientNoiseDb - 40) / 100, 0.2, 0.7);
    const stageFocus = clamp(0.55 + (mid - low) / 40, 0.4, 0.8);
    const targetLoudness = clamp(78 + (45 - snapshot.ambientNoiseDb), 70, 88);

    const notes = [
      `Cabin: ${snapshot.cabin}, mic: ${snapshot.micPosition}`,
      `Low/Mid/High dB averages: ${low.toFixed(1)} / ${mid.toFixed(1)} / ${high.toFixed(1)}`,
      `Ambient noise: ${snapshot.ambientNoiseDb.toFixed(1)} dB`,
    ];

    return {
      eqAdjustments,
      targetLoudness,
      surroundMix,
      stageFocus,
      notes,
    };
  }

  summarize(result: AutoTuneResult): string {
    const eqSummary = result.eqAdjustments
      .map(band => `${band.hz}Hz ${band.db >= 0 ? "+" : ""}${band.db.toFixed(1)}dB`)
      .join(", ");
    return [
      `Auto-tune target loudness: ${result.targetLoudness.toFixed(0)} dB`,
      `EQ adjustments: ${eqSummary}`,
      `Surround mix: ${Math.round(result.surroundMix * 100)}%`,
      `Stage focus: ${Math.round(result.stageFocus * 100)}%`,
    ].join(" | ");
  }
}

function averageDb(samples: FrequencySample[]): number {
  if (samples.length === 0) {
    return 0;
  }
  const sum = samples.reduce((total, sample) => total + sample.db, 0);
  return sum / samples.length;
}
