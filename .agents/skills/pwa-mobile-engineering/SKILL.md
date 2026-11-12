---
name: pwa-mobile-engineering
description: >-
  Advanced mobile PWA engineering standards for high-performance fitness applications.
  Covers iOS/Android standalone lifecycle, dynamic viewport units (100dvh), safe-area insets,
  virtual keyboard viewport protection, gesture collision prevention, background audio keepalive,
  and Capacitor native bridge compilation pathways.
---

# PWA Mobile Engineering for Fitness Apps

This skill provides architectural patterns, device-level workarounds, and best practices for building native-feel Progressive Web Apps (PWAs) in Next.js/React, specifically tuned for workout trackers, interval timers, and biometric telemetry.

---

## 1. Viewport & Dynamic Layout Architecture

### 1.1 Dynamic Viewport Units (`dvh` over `vh`)
Mobile browsers (Safari iOS, Chrome Mobile) dynamically show and hide URL address bars and navigation controls during scroll interactions.
- **Rule**: Never use `100vh` for full-screen application shells or modals. `100vh` calculates height based on the expanded viewport (under the browser bars), causing overflow and clipped buttons.
- **Implementation**: Always use `100dvh` (Dynamic Viewport Height) or fallback to `100vh` only on legacy engines:
  ```css
  /* Tailwind CSS */
  className="min-h-screen min-h-[100dvh] h-[100dvh]"
  ```

### 1.2 Safe Area Insets (iOS Notch & Dynamic Island)
Stand-alone PWA mode (`display: standalone`) renders content behind the status bar and bottom home bar.
- Always declare `viewport-fit=cover` in `meta[name="viewport"]`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
  ```
- **CSS Safe Area variables**:
  ```css
  padding-top: max(16px, env(safe-area-inset-top));
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  ```

### 1.3 Virtual Keyboard Shift Protection
When an `<input>` or `<textarea>` receives focus on iOS/Android, the virtual keyboard slides up.
- By default, browsers compress or push the viewport, causing sticky headers or bottom action bars to shift or obscure inputs.
- Add `interactive-widget=resizes-content` to the viewport meta tag to instruct Chromium/WebKit to shrink the layout viewport rather than pan the visual viewport.
- For bottom-sheet modals with inputs: Fix the container height to `h-[85dvh]` or `h-[90dvh]` with `flex flex-col` and place inputs in a non-shrinking header (`shrink-0`), with the scrollable suggestion list below in `flex-1 overflow-y-auto`. Never let the input container collapse to 0 height when results are empty.

---

## 2. Touch Gestures & Scroll Collisions

### 2.1 Eliminating Tap Delays & Overscroll Bounce
- **Touch Action**: Set `touch-action: manipulation` globally to eliminate the 300ms double-tap zoom delay on mobile browsers while preserving pinch-to-zoom if needed.
- **Overscroll Containment**: Apply `overscroll-behavior-y: contain` on scrollable modal lists to prevent rubber-banding of the underlying page.

### 2.2 Drag & Drop vs. Page Scroll Isolation
In routine builders or reorderable lists:
- Interactive drag handles must have `touch-action: none` to isolate drag gestures from parent container scrolling.
- Routine item rows must allow normal vertical scrolling (`touch-action: pan-y`) so the user can scroll the page freely when touching any area other than the dedicated drag handle.

---

## 3. Audio & Background Keep-Alive Mechanics

### 3.1 Web Audio API Ambient Policy (No Spotify/Music Interruption)
Fitness users frequently listen to music on Spotify, Apple Music, or YouTube Music while training.
- **Rule**: Never use `<audio>` tags with `audio.play()` for interval beeps or countdown sound effects, as this claims the OS audio focus and mutes or pauses the user's music.
- **Implementation**: Synthesize beeps directly through the **Web Audio API** using an `AudioContext` and `OscillatorNode` with short envelope ramps (attack/release: 0.01s - 0.08s). Web Audio mixes gracefully into ambient OS audio without taking exclusive focus.
- **AudioContext Lifecycle**: Mobile WebKit suspends any `AudioContext` created prior to a user gesture. Maintain an idempotent `unlockAudioContext()` method triggered on the first `touchstart` or click event in the app.

### 3.2 Background Timer Persistence
When the device screen locks or the user switches apps:
- `setTimeout` and `setInterval` are throttled by mobile OS power daemons to once every 1000ms or suspended entirely.
- **Mitigation Architecture**:
  1. Store the exact timestamp of expiration (`targetTimestamp = Date.now() + durationMs`).
  2. Run a dedicated **Web Worker** which operates on a separate thread with significantly lower throttling.
  3. Register with the **Media Session API** (`navigator.mediaSession`) with playback state `playing` during active timers to inform the OS that media playback is ongoing.
  4. On visibility change (`document.addEventListener('visibilitychange')`), immediately calculate delta: `remaining = Math.max(0, targetTimestamp - Date.now())` and resynchronize UI.

---

## 4. Offline-First & Native App Store Bridge Path

### 4.1 Local Storage & IndexedDB Fallbacks
- Store user active workouts, routine state, and logs locally in IndexedDB / LocalStorage with schema versioning.
- Perform optimistic UI mutations instantly; queue background sync operations to Supabase / REST endpoints.

### 4.2 Capacitor Bridge Integration
When packaging the PWA for the Apple App Store or Google Play Store:
- Wrap Next.js static or SSR build with `@capacitor/core`, `@capacitor/ios`, and `@capacitor/android`.
- For background timers, switch from Web Audio to `@capacitor/local-notifications` to trigger scheduled lockscreen notifications with sound even if the app process is terminated.
- For Bluetooth telemetry, connect `@capacitor-community/bluetooth-le` to access native CoreBluetooth without WebKit experimental flag hurdles.
