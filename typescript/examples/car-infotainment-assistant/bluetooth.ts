import { clamp } from "./utils";

export type BluetoothProfile = "A2DP" | "HFP" | "AVRCP";

export interface BluetoothDevice {
  id: string;
  name: string;
  profiles: BluetoothProfile[];
  batteryPercent?: number;
  signalStrength?: number;
}

export interface BluetoothConnection {
  device: BluetoothDevice;
  profile: BluetoothProfile;
  connectedAt: Date;
  streaming: boolean;
}

export interface BluetoothManagerOptions {
  scanResults?: BluetoothDevice[];
}

const DEFAULT_DEVICES: BluetoothDevice[] = [
  {
    id: "phone-01",
    name: "Atlas Pixel",
    profiles: ["A2DP", "HFP", "AVRCP"],
    batteryPercent: 82,
    signalStrength: 0.94,
  },
  {
    id: "phone-02",
    name: "Aurora Galaxy",
    profiles: ["A2DP", "HFP", "AVRCP"],
    batteryPercent: 64,
    signalStrength: 0.88,
  },
  {
    id: "tablet-01",
    name: "RoadPad Mini",
    profiles: ["A2DP", "AVRCP"],
    batteryPercent: 52,
    signalStrength: 0.76,
  },
];

export class BluetoothManager {
  private pairedDevices = new Map<string, BluetoothDevice>();
  private activeConnection: BluetoothConnection | null = null;
  private scanResults: BluetoothDevice[];

  constructor(options: BluetoothManagerOptions = {}) {
    this.scanResults = options.scanResults ?? DEFAULT_DEVICES;
    this.scanResults.forEach(device => this.pairedDevices.set(device.id, device));
  }

  scan(): BluetoothDevice[] {
    return [...this.scanResults];
  }

  pair(deviceId: string): BluetoothDevice {
    const device = this.scanResults.find(entry => entry.id === deviceId);
    if (!device) {
      throw new Error(`Bluetooth device not found: ${deviceId}`);
    }
    this.pairedDevices.set(device.id, device);
    return device;
  }

  connect(deviceId: string, profile: BluetoothProfile = "A2DP"): BluetoothConnection {
    const device = this.pairedDevices.get(deviceId);
    if (!device) {
      throw new Error(`Bluetooth device not paired: ${deviceId}`);
    }
    if (!device.profiles.includes(profile)) {
      throw new Error(`Device ${device.name} does not support ${profile}`);
    }

    this.activeConnection = {
      device,
      profile,
      connectedAt: new Date(),
      streaming: profile === "A2DP",
    };

    return this.activeConnection;
  }

  disconnect(): void {
    this.activeConnection = null;
  }

  setStreaming(isStreaming: boolean): void {
    if (this.activeConnection) {
      this.activeConnection.streaming = isStreaming;
    }
  }

  getStatus(): string {
    if (!this.activeConnection) {
      return "Bluetooth idle";
    }

    const { device, profile, streaming } = this.activeConnection;
    const battery = device.batteryPercent !== undefined ? `${device.batteryPercent}%` : "unknown";
    const signal = device.signalStrength !== undefined ? clamp(device.signalStrength * 100, 0, 100) : 0;
    const signalText = device.signalStrength !== undefined ? `${signal.toFixed(0)}%` : "unknown";
    const streamText = streaming ? "streaming audio" : "connected";

    return `${device.name} (${profile}) - ${streamText}, battery ${battery}, signal ${signalText}`;
  }

  listPaired(): BluetoothDevice[] {
    return [...this.pairedDevices.values()];
  }

  getActiveConnection(): BluetoothConnection | null {
    return this.activeConnection;
  }
}
