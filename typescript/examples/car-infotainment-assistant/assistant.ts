import { AudioDspEngine, AutoTuneResult, DspPresetName } from "./audio";
import { EmergencyAlertService } from "./alerts";
import { BluetoothManager } from "./bluetooth";
import { MusicLibrary, PlaybackController } from "./music";
import { NavigationService } from "./navigation";
import { ProfileManager } from "./profiles";
import { DriverState, GeoPoint } from "./types";
import { normalizeText } from "./utils";

export interface AssistantContext {
  bluetooth: BluetoothManager;
  audio: AudioDspEngine;
  music: PlaybackController;
  library: MusicLibrary;
  navigation: NavigationService;
  alerts: EmergencyAlertService;
  profiles: ProfileManager;
  autoTune: () => AutoTuneResult;
}

export interface AssistantResponse {
  speech: string;
  actions: string[];
  display?: string;
}

const PRESET_KEYWORDS: Array<{ preset: DspPresetName; keywords: string[] }> = [
  { preset: "concert", keywords: ["concert", "arena"] },
  { preset: "hall", keywords: ["hall", "theater"] },
  { preset: "live", keywords: ["live", "gig"] },
  { preset: "stadium", keywords: ["stadium", "festival"] },
  { preset: "studio", keywords: ["studio", "reference"] },
  { preset: "club", keywords: ["club", "dance"] },
  { preset: "driver_focus", keywords: ["driver", "focus"] },
  { preset: "night", keywords: ["night", "quiet"] },
];

export class DriverAssistant {
  constructor(private context: AssistantContext) {}

  handleRequest(text: string, driverState: DriverState, location: GeoPoint): AssistantResponse {
    const actions: string[] = [];
    const normalized = normalizeText(text);

    if (!normalized) {
      return { speech: "Say a command like play, navigate, or sound mode.", actions };
    }

    if (normalized.includes("auto tune") || normalized.includes("self tune")) {
      if (driverState.isMoving) {
        return {
          speech: "Auto-tune needs the cabin quiet. I can run it when you park.",
          actions,
        };
      }
      const result = this.context.autoTune();
      this.context.audio.applyAutoTune(result);
      actions.push("Applied auto-tune profile");
      return { speech: "Auto-tune complete. Sound profile updated.", actions };
    }

    if (normalized.startsWith("navigate to") || normalized.startsWith("directions to")) {
      const destination = normalized.split("to").slice(1).join(" ").trim();
      if (!destination) {
        return { speech: "Tell me the destination name.", actions };
      }
      try {
        const route = this.context.navigation.setDestinationByName(destination);
        actions.push(`Route to ${route.destinationName}`);
        return {
          speech: `Routing to ${route.destinationName}. ETA ${route.etaMinutes} minutes.`,
          actions,
        };
      } catch (error) {
        return { speech: `I don't know "${destination}". Try home, work, or airport.`, actions };
      }
    }

    if (normalized.startsWith("play ")) {
      const query = normalized.replace("play", "").trim();
      if (!query) {
        return { speech: "Tell me what you'd like to play.", actions };
      }
      const playlist = this.context.library.findPlaylistByName(query);
      if (playlist) {
        this.context.music.playPlaylist(playlist, this.context.library);
        actions.push(`Playing playlist ${playlist.name}`);
        return { speech: `Playing ${playlist.name}.`, actions };
      }
      const track = this.context.library.findTrackByQuery(query);
      if (track) {
        this.context.music.playTrack(track);
        actions.push(`Playing ${track.title}`);
        return { speech: `Playing ${track.title} by ${track.artist}.`, actions };
      }
      return { speech: `I couldn't find "${query}" in your library.`, actions };
    }

    if (normalized.includes("sound") || normalized.includes("preset") || normalized.includes("mode")) {
      const preset = findPreset(normalized);
      if (!preset) {
        return {
          speech: `Try a sound mode like ${AudioDspEngine.listPresets().join(", ")}.`,
          actions,
        };
      }
      this.context.audio.applyPreset(preset);
      actions.push(`Applied preset ${preset}`);
      return { speech: `Sound mode set to ${preset}.`, actions };
    }

    if (normalized.includes("alerts") || normalized.includes("warning")) {
      const alerts = this.context.alerts.getAlertsNear(location, 40);
      if (alerts.length === 0) {
        return { speech: "No active alerts nearby.", actions };
      }
      const summary = alerts.slice(0, 2).map(alert => alert.title).join(" and ");
      actions.push(`Announced ${alerts.length} alerts`);
      return { speech: `Alert: ${summary}. Say details for more.`, actions };
    }

    if (normalized.includes("connect") && normalized.includes("bluetooth")) {
      const paired = this.context.bluetooth.listPaired();
      if (paired.length === 0) {
        return { speech: "No paired Bluetooth devices available.", actions };
      }
      const device = paired[0];
      this.context.bluetooth.connect(device.id);
      actions.push(`Connected ${device.name}`);
      return { speech: `Connected to ${device.name}.`, actions };
    }

    if (normalized.includes("profile")) {
      const active = this.context.profiles.getActiveProfile();
      actions.push(`Active profile ${active.displayName}`);
      return { speech: `You're using the ${active.displayName} profile.`, actions };
    }

    if (normalized.includes("status")) {
      const audio = this.context.audio.describeCurrentProfile();
      const playback = this.context.music.describeState();
      return {
        speech: `Audio: ${audio}. ${playback}.`,
        actions,
      };
    }

    if (driverState.focusMode === "safety" && driverState.isMoving) {
      return {
        speech: "I can help with navigation, music, or alerts while you drive.",
        actions,
      };
    }

    return { speech: "Sorry, I didn't understand. Try 'play', 'navigate', or 'sound mode'.", actions };
  }
}

function findPreset(text: string): DspPresetName | undefined {
  for (const entry of PRESET_KEYWORDS) {
    if (entry.keywords.some(keyword => text.includes(keyword))) {
      return entry.preset;
    }
  }
  return undefined;
}
