import { GeoPoint } from "./types";
import { formatKm, haversineKm } from "./utils";

export interface NavigationPreferences {
  avoidTolls: boolean;
  avoidHighways: boolean;
  voiceGuidance: boolean;
}

export interface RouteStep {
  instruction: string;
  distanceKm: number;
}

export interface RoutePlan {
  destinationName: string;
  destination: GeoPoint;
  distanceKm: number;
  etaMinutes: number;
  steps: RouteStep[];
}

const DESTINATIONS: Record<string, GeoPoint> = {
  home: { lat: 37.7749, lon: -122.4194 },
  work: { lat: 37.7895, lon: -122.3942 },
  airport: { lat: 37.6213, lon: -122.379 },
  downtown: { lat: 37.7936, lon: -122.3965 },
  stadium: { lat: 37.402, lon: -121.9703 },
};

const DEFAULT_PREFERENCES: NavigationPreferences = {
  avoidTolls: false,
  avoidHighways: false,
  voiceGuidance: true,
};

export class NavigationService {
  private currentLocation: GeoPoint;
  private destination: { name: string; location: GeoPoint } | null = null;
  private route: RoutePlan | null = null;
  private speedKph = 45;
  private preferences: NavigationPreferences;

  constructor(startLocation: GeoPoint, preferences: NavigationPreferences = DEFAULT_PREFERENCES) {
    this.currentLocation = startLocation;
    this.preferences = preferences;
  }

  setDestinationByName(name: string): RoutePlan {
    const key = name.toLowerCase();
    const destination = DESTINATIONS[key];
    if (!destination) {
      throw new Error(`Unknown destination: ${name}`);
    }
    return this.setDestination(name, destination);
  }

  setDestination(name: string, location: GeoPoint): RoutePlan {
    this.destination = { name, location };
    this.route = this.computeRoute();
    return this.route;
  }

  updateLocation(location: GeoPoint, speedKph: number): RoutePlan | null {
    this.currentLocation = location;
    this.speedKph = speedKph;
    if (!this.destination) {
      return null;
    }
    this.route = this.computeRoute();
    return this.route;
  }

  getRoute(): RoutePlan | null {
    return this.route;
  }

  getNextInstruction(): string {
    if (!this.route) {
      return "Navigation idle";
    }
    return this.route.steps[0]?.instruction ?? "Continue to destination";
  }

  getSummary(): string {
    if (!this.route) {
      return "No active route";
    }
    const { destinationName, distanceKm, etaMinutes } = this.route;
    const preferenceNote = this.preferences.avoidHighways ? "avoid highways" : "fastest route";
    return `Route to ${destinationName}: ${formatKm(distanceKm)}, ETA ${etaMinutes} min (${preferenceNote})`;
  }

  listDestinations(): string[] {
    return Object.keys(DESTINATIONS);
  }

  private computeRoute(): RoutePlan {
    if (!this.destination) {
      throw new Error("No destination selected");
    }
    const distanceKm = haversineKm(this.currentLocation, this.destination.location);
    const speed = Math.max(this.speedKph, 25);
    const etaMinutes = Math.max(1, Math.round((distanceKm / speed) * 60));

    return {
      destinationName: this.destination.name,
      destination: this.destination.location,
      distanceKm,
      etaMinutes,
      steps: [
        { instruction: `Head toward ${this.destination.name}`, distanceKm: distanceKm * 0.2 },
        { instruction: "Continue on main route", distanceKm: distanceKm * 0.7 },
        { instruction: `Arrive at ${this.destination.name}`, distanceKm: distanceKm * 0.1 },
      ],
    };
  }
}
