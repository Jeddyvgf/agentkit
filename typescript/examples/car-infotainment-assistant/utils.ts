import * as fs from "node:fs/promises";
import * as path from "node:path";

import { GeoPoint } from "./types";

const EARTH_RADIUS_KM = 6371;
const EXAMPLE_ROOT_DIR =
  path.basename(__dirname) === "dist" ? path.resolve(__dirname, "..") : __dirname;

/**
 * Clamp a numeric value to the inclusive range [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Format a duration in seconds as a short human-readable string.
 */
export function formatDuration(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format a distance (in km) with a sensible precision.
 */
export function formatKm(distanceKm: number): string {
  if (distanceKm >= 10) {
    return `${distanceKm.toFixed(1)} km`;
  }
  return `${distanceKm.toFixed(2)} km`;
}

/**
 * Normalize freeform input text for matching/search.
 */
export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Compute great-circle distance between two points using the haversine formula.
 */
export function haversineKm(start: GeoPoint, end: GeoPoint): number {
  const toRad = (value: number): number => (value * Math.PI) / 180;
  const latDelta = toRad(end.lat - start.lat);
  const lonDelta = toRad(end.lon - start.lon);
  const lat1 = toRad(start.lat);
  const lat2 = toRad(end.lat);

  const a =
    Math.sin(latDelta / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Load and parse a JSON file from disk.
 */
export async function loadJsonFile<T>(filePath: string): Promise<T> {
  const payload = await fs.readFile(filePath, "utf-8");
  return JSON.parse(payload) as T;
}

/**
 * Resolve a path relative to the example directory.
 *
 * This avoids reliance on `process.cwd()`, which can vary depending on how the
 * demo is launched.
 */
export function resolveDataPath(...parts: string[]): string {
  return path.resolve(EXAMPLE_ROOT_DIR, ...parts);
}
