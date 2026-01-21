import * as readline from "node:readline";

import { AudioDspEngine, DspPresetName } from "./audio";
import { DriverAssistant } from "./assistant";
import { EmergencyAlertService } from "./alerts";
import { BluetoothManager } from "./bluetooth";
import { DiagnosticSnapshot, DiagnosticsService } from "./diagnostics";
import { MusicLibrary, PlaybackController } from "./music";
import { NavigationService } from "./navigation";
import { ProfileManager } from "./profiles";
import { AutoTuner, CalibrationSnapshot } from "./tuning";
import { DriverState, VehicleState } from "./types";
import { formatKm, loadJsonFile, resolveDataPath } from "./utils";

const SPEED_THRESHOLD_KPH = 5;

async function loadCalibration(): Promise<CalibrationSnapshot> {
  return loadJsonFile<CalibrationSnapshot>(resolveDataPath("data", "calibration.sample.json"));
}

async function loadLibrary(): Promise<MusicLibrary> {
  return MusicLibrary.loadFromFile(resolveDataPath("data", "library.sample.json"));
}

async function loadAlerts(): Promise<EmergencyAlertService> {
  return EmergencyAlertService.loadFromFile(resolveDataPath("data", "alerts.sample.json"));
}

async function loadDiagnostics(): Promise<DiagnosticsService> {
  return DiagnosticsService.loadFromFile(resolveDataPath("data", "diagnostics.sample.json"));
}

class InfotainmentSystem {
  private audio: AudioDspEngine;
  private bluetooth: BluetoothManager;
  private library: MusicLibrary;
  private music: PlaybackController;
  private navigation: NavigationService;
  private alerts: EmergencyAlertService;
  private diagnostics: DiagnosticsService;
  private tuner: AutoTuner;
  private calibration: CalibrationSnapshot;
  private profiles: ProfileManager;
  private assistant: DriverAssistant;
  private driverState: DriverState;
  private vehicleState: VehicleState;

  constructor(
    library: MusicLibrary,
    alerts: EmergencyAlertService,
    calibration: CalibrationSnapshot,
    diagnostics: DiagnosticsService,
  ) {
    this.audio = new AudioDspEngine("concert");
    this.bluetooth = new BluetoothManager();
    this.library = library;
    this.music = new PlaybackController();
    this.navigation = new NavigationService({ lat: 37.7749, lon: -122.4194 });
    this.alerts = alerts;
    this.diagnostics = diagnostics;
    this.tuner = new AutoTuner();
    this.calibration = calibration;
    this.profiles = new ProfileManager(ProfileManager.createDefaultProfiles());
    const profile = this.profiles.getActiveProfile();
    this.driverState = {
      driverName: profile.displayName,
      speedKph: 0,
      isMoving: false,
      focusMode: profile.focusMode,
    };
    this.vehicleState = {
      location: { lat: 37.7749, lon: -122.4194 },
      headingDeg: 0,
      speedKph: 0,
      outsideTempC: 22,
    };
    this.audio.applyPreset(profile.preferredPreset);
    this.audio.setVolume(profile.preferredVolume);
    this.assistant = new DriverAssistant({
      bluetooth: this.bluetooth,
      audio: this.audio,
      music: this.music,
      library: this.library,
      navigation: this.navigation,
      alerts: this.alerts,
      diagnostics: this.diagnostics,
      getDiagnosticSnapshot: () => this.buildDiagnosticSnapshot(),
      profiles: this.profiles,
      autoTune: () => this.tuner.analyze(this.calibration),
    });
  }

  printWelcome(): void {
    console.log("Car Infotainment Assistant");
    console.log("Type 'help' for commands, 'exit' to quit.");
    console.log(`Loaded ${this.library.listPlaylists().length} playlists.`);
  }

  printHelp(): void {
    console.log("Commands:");
    console.log("  status                         Show system status");
    console.log("  scan                           List Bluetooth devices");
    console.log("  connect <deviceId>             Connect to Bluetooth device");
    console.log("  disconnect                     Disconnect Bluetooth");
    console.log("  preset <name>                  Apply DSP preset");
    console.log("  volume <0-100>                 Set volume");
    console.log("  auto-tune                      Run cabin auto-tune");
    console.log("  play <track or playlist>       Play music");
    console.log("  pause | resume | next | prev    Control playback");
    console.log("  nav <destination>              Start navigation");
    console.log("  destinations                   List known destinations");
    console.log("  location <lat> <lon>           Update vehicle location");
    console.log("  speed <kph>                    Update vehicle speed");
    console.log("  alerts                         Show nearby alerts");
    console.log("  diagnostics                    Run AI diagnostics scan");
    console.log("  troubleshoot <symptom>         Troubleshoot an issue");
    console.log("  profile <id>                   Switch driver profile");
    console.log("  assistant <text>               Ask the AI assistant");
    console.log("  exit                           Quit");
  }

  showStatus(): void {
    console.log("Status:");
    console.log(`- Bluetooth: ${this.bluetooth.getStatus()}`);
    console.log(`- Audio: ${this.audio.describeCurrentProfile()}`);
    console.log(`- Volume: ${this.audio.getOutputState().volume}`);
    console.log(`- Playback: ${this.music.describeState()}`);
    console.log(`- Navigation: ${this.navigation.getSummary()}`);
    console.log(
      `- Location: ${this.vehicleState.location.lat.toFixed(4)}, ${this.vehicleState.location.lon.toFixed(4)}`,
    );
    console.log(`- Speed: ${this.driverState.speedKph} kph`);
  }

  async handleCommand(input: string): Promise<boolean> {
    const trimmed = input.trim();
    if (!trimmed) {
      return true;
    }
    const [command, ...args] = trimmed.split(" ");
    const argumentText = args.join(" ");
    const normalized = command.toLowerCase();

    try {
      switch (normalized) {
        case "help":
          this.printHelp();
          return true;
        case "status":
          this.showStatus();
          return true;
        case "scan": {
          const devices = this.bluetooth.scan();
          devices.forEach(device => {
            console.log(
              `${device.id} - ${device.name} (${device.profiles.join(", ")}) battery ${
                device.batteryPercent ?? "?"
              }%`,
            );
          });
          return true;
        }
        case "connect": {
          if (!argumentText) {
            console.log("Provide a device id from scan.");
            return true;
          }
          const connection = this.bluetooth.connect(argumentText);
          console.log(`Connected to ${connection.device.name} via ${connection.profile}.`);
          return true;
        }
        case "disconnect":
          this.bluetooth.disconnect();
          console.log("Bluetooth disconnected.");
          return true;
        case "preset": {
          const preset = argumentText.toLowerCase() as DspPresetName;
          if (!AudioDspEngine.listPresets().includes(preset)) {
            console.log(`Unknown preset. Options: ${AudioDspEngine.listPresets().join(", ")}`);
            return true;
          }
          this.audio.applyPreset(preset);
          console.log(`Preset applied: ${preset}`);
          return true;
        }
        case "volume": {
          const value = Number(argumentText);
          if (Number.isNaN(value)) {
            console.log("Volume must be a number.");
            return true;
          }
          this.audio.setVolume(value);
          console.log(`Volume set to ${this.audio.getOutputState().volume}`);
          return true;
        }
        case "auto-tune": {
          if (this.driverState.isMoving) {
            console.log("Auto-tune requires the vehicle to be stopped.");
            return true;
          }
          const result = this.tuner.analyze(this.calibration);
          this.audio.applyAutoTune(result);
          console.log(this.tuner.summarize(result));
          return true;
        }
        case "play": {
          if (!argumentText) {
            console.log("Provide a track or playlist name.");
            return true;
          }
          const playlist = this.library.findPlaylistByName(argumentText);
          if (playlist) {
            this.music.playPlaylist(playlist, this.library);
            console.log(`Playing playlist: ${playlist.name}`);
            return true;
          }
          const track = this.library.findTrackByQuery(argumentText);
          if (!track) {
            console.log(`Track not found: ${argumentText}`);
            return true;
          }
          this.music.playTrack(track);
          console.log(`Playing: ${track.title} - ${track.artist}`);
          return true;
        }
        case "pause":
          this.music.pause();
          console.log("Playback paused.");
          return true;
        case "resume":
          this.music.resume();
          console.log("Playback resumed.");
          return true;
        case "next":
          this.music.next();
          console.log(`Now playing: ${this.music.describeState()}`);
          return true;
        case "prev":
          this.music.previous();
          console.log(`Now playing: ${this.music.describeState()}`);
          return true;
        case "nav": {
          if (!argumentText) {
            console.log(`Provide a destination: ${this.navigation.listDestinations().join(", ")}`);
            return true;
          }
          const route = this.navigation.setDestinationByName(argumentText);
          console.log(`Route started: ${route.destinationName}, ${formatKm(route.distanceKm)}.`);
          return true;
        }
        case "destinations":
          console.log(this.navigation.listDestinations().join(", "));
          return true;
        case "location": {
          const [latText, lonText] = args;
          const lat = Number(latText);
          const lon = Number(lonText);
          if (Number.isNaN(lat) || Number.isNaN(lon)) {
            console.log("Provide latitude and longitude numbers.");
            return true;
          }
          this.vehicleState.location = { lat, lon };
          this.navigation.updateLocation(this.vehicleState.location, this.driverState.speedKph);
          console.log(`Location updated to ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
          return true;
        }
        case "speed": {
          const speed = Number(argumentText);
          if (Number.isNaN(speed)) {
            console.log("Provide a speed in kph.");
            return true;
          }
          this.driverState.speedKph = speed;
          this.driverState.isMoving = speed > SPEED_THRESHOLD_KPH;
          this.vehicleState.speedKph = speed;
          this.navigation.updateLocation(this.vehicleState.location, speed);
          console.log(`Speed updated to ${speed} kph`);
          return true;
        }
        case "alerts": {
          const nearby = this.alerts.getAlertsNear(this.vehicleState.location, 50);
          if (nearby.length === 0) {
            console.log("No active alerts nearby.");
            return true;
          }
          nearby.forEach(alert => console.log(`- ${this.alerts.summarize(alert)}`));
          console.log(`Feed timestamp: ${this.alerts.getFeedTimestamp()}`);
          return true;
        }
        case "diagnostics":
        case "diag": {
          const report = this.diagnostics.runAutoScan(this.buildDiagnosticSnapshot());
          this.diagnostics.formatReport(report).forEach(line => console.log(line));
          return true;
        }
        case "troubleshoot": {
          if (!argumentText) {
            console.log("Provide a symptom description.");
            return true;
          }
          const plan = this.diagnostics.troubleshoot(argumentText, this.buildDiagnosticSnapshot());
          this.diagnostics.formatPlan(plan).forEach(line => console.log(line));
          return true;
        }
        case "profile": {
          if (!argumentText) {
            this.profiles.listProfiles().forEach(profile =>
              console.log(`${profile.id} - ${profile.displayName}`),
            );
            return true;
          }
          const active = this.profiles.setActiveProfile(argumentText);
          this.audio.applyPreset(active.preferredPreset);
          this.audio.setVolume(active.preferredVolume);
          this.driverState.driverName = active.displayName;
          this.driverState.focusMode = active.focusMode;
          console.log(`Profile switched to ${active.displayName}.`);
          return true;
        }
        case "assistant": {
          const response = this.assistant.handleRequest(
            argumentText,
            this.driverState,
            this.vehicleState.location,
          );
          console.log(`Assistant: ${response.speech}`);
          if (response.actions.length > 0) {
            console.log(`Actions: ${response.actions.join(", ")}`);
          }
          return true;
        }
        case "exit":
        case "quit":
          return false;
        default:
          console.log("Unknown command. Type 'help' for a list.");
          return true;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log(`Error: ${error.message}`);
      } else {
        console.log("Unexpected error.");
      }
      return true;
    }
  }

  private buildDiagnosticSnapshot(): DiagnosticSnapshot {
    const connection = this.bluetooth.getActiveConnection();
    const alerts = this.alerts.getAlertsNear(this.vehicleState.location, 50);
    return {
      bluetoothConnected: Boolean(connection),
      bluetoothStreaming: connection?.streaming ?? false,
      connectedDevice: connection?.device.name,
      audioPreset: this.audio.getPresetName(),
      volume: this.audio.getOutputState().volume,
      playback: this.music.getState(),
      driverState: this.driverState,
      vehicleState: this.vehicleState,
      activeAlertCount: alerts.length,
    };
  }
}

async function main() {
  const [library, alerts, calibration, diagnostics] = await Promise.all([
    loadLibrary(),
    loadAlerts(),
    loadCalibration(),
    loadDiagnostics(),
  ]);

  const system = new InfotainmentSystem(library, alerts, calibration, diagnostics);
  system.printWelcome();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): Promise<string> => new Promise(resolve => rl.question("> ", resolve));

  try {
    let running = true;
    while (running) {
      const input = await prompt();
      running = await system.handleCommand(input);
    }
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  });
}
