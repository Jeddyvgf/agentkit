# Car Infotainment Assistant (Reference Implementation)

This example is a modular software blueprint for a car stereo system that connects to a phone via Bluetooth and provides high-quality DSP audio modes (concert, hall, live, stadium), music library management, self-tuning, navigation support, and GPS-aware emergency alerts. It also includes a built-in AI-style assistant (rule-based) to coordinate driver requests safely.

This is a reference architecture and simulation. It does not integrate with real vehicle hardware, Bluetooth stacks, microphones, or DSP chips. Use the modules here as a starting point for those integrations.

## Included features

- Bluetooth pairing/connection simulation (A2DP/HFP/AVRCP).
- DSP engine with surround presets inspired by premium systems.
- Self-tuning pipeline using a cabin calibration snapshot.
- Music library search, smart playlists, and playback controller.
- Navigation routing with ETA and step guidance.
- GPS-aware emergency alert feed filtering.
- Driver profiles and safety-focused assistant behavior.
- AI-style diagnostics, self-checks, and troubleshooting guidance.
- CLI demo for trying commands and flows.

## Quickstart

1. Install workspace dependencies:
   - `pnpm -C typescript install`
2. Build this example:
   - `pnpm -C typescript --filter @coinbase/car-infotainment-assistant-example build`
3. Run the demo from this directory:
   - `node dist/infotainment.js`

Note: run the demo from `typescript/examples/car-infotainment-assistant` so the sample data files resolve correctly.

## Commands

- `status` - Show system status.
- `scan` - List nearby Bluetooth devices.
- `connect <deviceId>` - Connect to a Bluetooth device.
- `preset <name>` - Apply a DSP preset (concert, hall, live, stadium, studio, club, driver_focus, night).
- `auto-tune` - Run the self-tuning routine (only while stopped).
- `play <track or playlist>` - Play music from the library.
- `nav <destination>` - Start navigation (home, work, airport, downtown, stadium).
- `alerts` - Show active alerts near current location.
- `diagnostics` - Run the AI diagnostics scan.
- `troubleshoot <symptom>` - Get troubleshooting steps.
- `assistant <text>` - Ask the AI assistant to perform a task.

## Architecture highlights

- `audio.ts` defines DSP presets and applies auto-tune adjustments.
- `tuning.ts` analyzes a cabin snapshot and computes EQ targets.
- `bluetooth.ts` models pairing, connection, and profile status.
- `music.ts` manages tracks, playlists, and playback state.
- `navigation.ts` computes simple routes and ETA updates.
- `alerts.ts` filters emergency alerts by GPS range and time.
- `diagnostics.ts` generates AI-style health checks and troubleshooting steps.
- `assistant.ts` routes driver requests across modules with safety gating.
- `infotainment.ts` orchestrates the system and provides the CLI.

## Extending to production hardware

- Swap the Bluetooth manager with an OS or head-unit Bluetooth stack.
- Replace the DSP engine with a real-time DSP pipeline (FFT, FIR/IIR, room correction).
- Feed live alerts from official feeds (NOAA, CAP, DOT) and integrate real GPS.
- Connect the assistant to on-device or cloud LLMs with wake-word and TTS.
- Integrate microphone arrays for accurate in-cabin calibration.

## Safety note

Driver focus is critical. The assistant shortens responses in safety mode and blocks complex auto-tune actions while moving. Expand this gating and ensure compliance with local regulations.
