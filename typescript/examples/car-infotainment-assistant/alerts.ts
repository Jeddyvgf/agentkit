import { GeoPoint } from "./types";
import { haversineKm, loadJsonFile } from "./utils";

export type AlertSeverity = "info" | "watch" | "warning" | "emergency";

export interface AlertRegion {
  center: GeoPoint;
  radiusKm: number;
}

export interface EmergencyAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  regions: AlertRegion[];
  validFrom: string;
  validTo: string;
  source: string;
}

export interface AlertFeed {
  generatedAt: string;
  alerts: EmergencyAlert[];
}

export class EmergencyAlertService {
  private feed: AlertFeed;

  static async loadFromFile(filePath: string): Promise<EmergencyAlertService> {
    const feed = await loadJsonFile<AlertFeed>(filePath);
    return new EmergencyAlertService(feed);
  }

  constructor(feed: AlertFeed) {
    this.feed = feed;
  }

  refresh(feed: AlertFeed): void {
    this.feed = feed;
  }

  getActiveAlerts(at: Date = new Date()): EmergencyAlert[] {
    return this.feed.alerts.filter(alert => isAlertActive(alert, at));
  }

  getAlertsNear(
    location: GeoPoint,
    radiusKm = 30,
    at: Date = new Date(),
  ): EmergencyAlert[] {
    return this.getActiveAlerts(at).filter(alert =>
      alert.regions.some(region => haversineKm(location, region.center) <= region.radiusKm + radiusKm),
    );
  }

  summarize(alert: EmergencyAlert): string {
    return `${alert.title} (${alert.severity}) - ${alert.description} [${alert.source}]`;
  }

  getFeedTimestamp(): string {
    return this.feed.generatedAt;
  }
}

function isAlertActive(alert: EmergencyAlert, at: Date): boolean {
  const start = new Date(alert.validFrom).getTime();
  const end = new Date(alert.validTo).getTime();
  const time = at.getTime();
  return time >= start && time <= end;
}
