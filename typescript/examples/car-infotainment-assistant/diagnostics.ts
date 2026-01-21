import { DspPresetName } from "./audio";
import { PlaybackState } from "./music";
import { DriverState, VehicleState } from "./types";
import { loadJsonFile, normalizeText } from "./utils";

export type IssueSeverity = "info" | "warning" | "critical";
export type IssueCategory = "audio" | "bluetooth" | "navigation" | "alerts" | "safety" | "system";

export interface DiagnosticIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  suspectedCause: string;
  recommendedSteps: string[];
  confidence: number;
}

export interface DiagnosticReport {
  generatedAt: string;
  overallHealth: "good" | "attention" | "critical";
  issues: DiagnosticIssue[];
  notes: string[];
}

export interface TroubleshootingPlan {
  summary: string;
  matchedIssues: DiagnosticIssue[];
  steps: string[];
  followUps: string[];
}

export interface DiagnosticSnapshot {
  bluetoothConnected: boolean;
  bluetoothStreaming: boolean;
  connectedDevice?: string;
  audioPreset: DspPresetName;
  volume: number;
  playback: PlaybackState;
  driverState: DriverState;
  vehicleState: VehicleState;
  activeAlertCount: number;
}

export interface KnowledgeEntry {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  suspectedCause: string;
  keywords: string[];
  recommendedSteps: string[];
}

export interface DiagnosticsKnowledgeBase {
  version: string;
  entries: KnowledgeEntry[];
}

export class DiagnosticsService {
  private knowledge: DiagnosticsKnowledgeBase;
  private lastReport: DiagnosticReport | null = null;

  static async loadFromFile(filePath: string): Promise<DiagnosticsService> {
    const knowledge = await loadJsonFile<DiagnosticsKnowledgeBase>(filePath);
    return new DiagnosticsService(knowledge);
  }

  constructor(knowledge: DiagnosticsKnowledgeBase) {
    this.knowledge = knowledge;
  }

  runAutoScan(snapshot: DiagnosticSnapshot): DiagnosticReport {
    const issues: DiagnosticIssue[] = [];

    if (!snapshot.bluetoothConnected && snapshot.playback.isPlaying) {
      issues.push({
        id: "BT-101",
        category: "bluetooth",
        severity: "warning",
        title: "Playback active without Bluetooth audio",
        description: "Playback is running, but no Bluetooth audio device is connected.",
        suspectedCause: "Bluetooth connection dropped or device is not paired.",
        recommendedSteps: [
          "Run Bluetooth scan and reconnect the primary phone.",
          "Verify the phone is paired and set to media audio.",
        ],
        confidence: 0.74,
      });
    }

    if (snapshot.bluetoothConnected && !snapshot.bluetoothStreaming && snapshot.playback.isPlaying) {
      issues.push({
        id: "BT-102",
        category: "bluetooth",
        severity: "info",
        title: "Bluetooth connected but not streaming",
        description: "A Bluetooth device is connected, but audio streaming is idle.",
        suspectedCause: "Playback paused on the phone or the audio source is muted.",
        recommendedSteps: ["Resume playback on the phone.", "Confirm media volume is above zero."],
        confidence: 0.62,
      });
    }

    if (snapshot.playback.isPlaying && snapshot.volume < 8) {
      issues.push({
        id: "AUD-201",
        category: "audio",
        severity: "info",
        title: "Volume set very low",
        description: "Audio playback is active but volume is set below 8.",
        suspectedCause: "Volume lowered by user or safety limiter.",
        recommendedSteps: ["Raise volume to a comfortable level.", "Check mute state."],
        confidence: 0.5,
      });
    }

    if (snapshot.driverState.isMoving && snapshot.volume > 85) {
      issues.push({
        id: "SAFE-301",
        category: "safety",
        severity: "warning",
        title: "High volume while driving",
        description: "Volume is above 85 while the vehicle is moving.",
        suspectedCause: "High output may mask warning sounds and alerts.",
        recommendedSteps: ["Lower volume to improve situational awareness."],
        confidence: 0.68,
      });
    }

    if (snapshot.driverState.focusMode === "safety" && snapshot.audioPreset !== "driver_focus") {
      issues.push({
        id: "AUD-202",
        category: "audio",
        severity: "info",
        title: "Safety mode prefers driver focus preset",
        description: "Driver focus mode recommends the driver_focus DSP preset.",
        suspectedCause: "Profile mismatch or manual preset override.",
        recommendedSteps: ["Switch to driver_focus preset for clearer staging."],
        confidence: 0.46,
      });
    }

    if (snapshot.activeAlertCount > 0) {
      issues.push({
        id: "ALERT-401",
        category: "alerts",
        severity: "info",
        title: "Active emergency alerts nearby",
        description: `There are ${snapshot.activeAlertCount} alerts near your route.`,
        suspectedCause: "Live alert feed indicates a local advisory.",
        recommendedSteps: ["Review alert details and adjust route if needed."],
        confidence: 0.6,
      });
    }

    const report: DiagnosticReport = {
      generatedAt: new Date().toISOString(),
      overallHealth: determineHealth(issues),
      issues,
      notes: [
        "Auto scan uses simulated signals. Replace with real sensor data for production.",
      ],
    };

    this.lastReport = report;
    return report;
  }

  troubleshoot(symptom: string, snapshot: DiagnosticSnapshot): TroubleshootingPlan {
    const normalized = normalizeText(symptom);
    const matches = this.knowledge.entries.filter(entry =>
      entry.keywords.some(keyword => normalized.includes(keyword)),
    );

    const matchedIssues = matches.map(entry => ({
      id: entry.id,
      category: entry.category,
      severity: entry.severity,
      title: entry.title,
      description: entry.description,
      suspectedCause: entry.suspectedCause,
      recommendedSteps: entry.recommendedSteps,
      confidence: 0.7,
    }));

    const steps = matchedIssues.flatMap(issue => issue.recommendedSteps);
    const followUps = buildFollowUps(snapshot);

    if (matchedIssues.length === 0) {
      const fallback = this.lastReport ?? this.runAutoScan(snapshot);
      return {
        summary: "No direct match found. Running a quick system scan instead.",
        matchedIssues: fallback.issues,
        steps: fallback.issues.flatMap(issue => issue.recommendedSteps).slice(0, 5),
        followUps,
      };
    }

    return {
      summary: `AI tech specialist matched ${matchedIssues.length} possible issue(s).`,
      matchedIssues,
      steps,
      followUps,
    };
  }

  summarizeReport(report: DiagnosticReport, concise = false): string {
    if (report.issues.length === 0) {
      return "Diagnostics complete. All systems nominal.";
    }
    const topIssue = report.issues[0];
    if (concise) {
      return `Diagnostics: ${report.overallHealth}. ${topIssue.title}.`;
    }
    return `Diagnostics: ${report.overallHealth}. Top issue: ${topIssue.title}.`;
  }

  summarizePlan(plan: TroubleshootingPlan, concise = false): string {
    if (concise) {
      return plan.summary;
    }
    const issueTitles = plan.matchedIssues.map(issue => issue.title).join(", ");
    if (issueTitles) {
      return `${plan.summary} Likely: ${issueTitles}.`;
    }
    return plan.summary;
  }

  formatReport(report: DiagnosticReport): string[] {
    const lines: string[] = [];
    lines.push(`Diagnostic health: ${report.overallHealth}`);
    if (report.issues.length === 0) {
      lines.push("No issues detected.");
      return lines;
    }

    report.issues.forEach(issue => {
      lines.push(`- [${issue.severity}] ${issue.title} (${issue.id})`);
      lines.push(`  Cause: ${issue.suspectedCause}`);
      issue.recommendedSteps.forEach(step => lines.push(`  Step: ${step}`));
    });
    return lines;
  }

  formatPlan(plan: TroubleshootingPlan): string[] {
    const lines: string[] = [];
    lines.push(`Tech specialist summary: ${plan.summary}`);
    if (plan.matchedIssues.length > 0) {
      plan.matchedIssues.forEach(issue => {
        lines.push(`- [${issue.severity}] ${issue.title} (${issue.id})`);
      });
    }
    if (plan.steps.length > 0) {
      lines.push("Recommended steps:");
      plan.steps.forEach(step => lines.push(`- ${step}`));
    }
    if (plan.followUps.length > 0) {
      lines.push("Follow-up checks:");
      plan.followUps.forEach(step => lines.push(`- ${step}`));
    }
    return lines;
  }
}

function determineHealth(issues: DiagnosticIssue[]): DiagnosticReport["overallHealth"] {
  if (issues.some(issue => issue.severity === "critical")) {
    return "critical";
  }
  if (issues.some(issue => issue.severity === "warning")) {
    return "attention";
  }
  return "good";
}

function buildFollowUps(snapshot: DiagnosticSnapshot): string[] {
  const followUps: string[] = [
    `Confirm Bluetooth device: ${snapshot.connectedDevice ?? "none"}.`,
    `Current preset: ${snapshot.audioPreset}.`,
  ];
  if (!snapshot.playback.isPlaying) {
    followUps.push("Start playback and confirm audio output.");
  }
  if (snapshot.driverState.isMoving) {
    followUps.push("Re-run diagnostics when parked for full calibration.");
  }
  return followUps;
}
