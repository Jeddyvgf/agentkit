import { DspPresetName } from "./audio";
import { FocusMode } from "./types";

export interface DriverProfile {
  id: string;
  displayName: string;
  preferredPreset: DspPresetName;
  preferredVolume: number;
  voiceStyle: "concise" | "conversational";
  focusMode: FocusMode;
}

export class ProfileManager {
  private profiles: DriverProfile[];
  private activeProfile: DriverProfile;

  constructor(profiles: DriverProfile[]) {
    if (profiles.length === 0) {
      throw new Error("At least one profile is required");
    }
    this.profiles = profiles;
    this.activeProfile = profiles[0];
  }

  listProfiles(): DriverProfile[] {
    return [...this.profiles];
  }

  getActiveProfile(): DriverProfile {
    return this.activeProfile;
  }

  setActiveProfile(profileId: string): DriverProfile {
    const found = this.profiles.find(profile => profile.id === profileId);
    if (!found) {
      throw new Error(`Profile not found: ${profileId}`);
    }
    this.activeProfile = found;
    return found;
  }

  static createDefaultProfiles(): DriverProfile[] {
    return [
      {
        id: "driver-01",
        displayName: "Alex",
        preferredPreset: "concert",
        preferredVolume: 38,
        voiceStyle: "conversational",
        focusMode: "standard",
      },
      {
        id: "driver-02",
        displayName: "Riley",
        preferredPreset: "driver_focus",
        preferredVolume: 30,
        voiceStyle: "concise",
        focusMode: "safety",
      },
    ];
  }
}
