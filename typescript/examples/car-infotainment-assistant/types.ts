export interface GeoPoint {
  lat: number;
  lon: number;
}

export type FocusMode = "standard" | "safety";

export interface DriverState {
  driverName: string;
  speedKph: number;
  isMoving: boolean;
  focusMode: FocusMode;
}

export interface VehicleState {
  location: GeoPoint;
  headingDeg: number;
  speedKph: number;
  outsideTempC: number;
}
