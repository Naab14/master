# Running the Master iOS app

The iOS app is a native SwiftUI client for the same backend the web app uses.
It needs a Mac with **Xcode 16 or newer** (the project uses filesystem-synced
groups, so any Swift file you drop into `Master/` is picked up automatically).

## 1. Start the backend

On your computer (Mac or anything with Node 18+):

```sh
node backend/server.js        # serves the API + web app on port 3000
```

Find your computer's LAN IP (macOS: System Settings → Wi-Fi → Details, or
`ipconfig getifaddr en0`).

## 2. Open and run the app

1. Open `apps/ios/Master.xcodeproj` in Xcode.
2. Select the *Master* target → Signing & Capabilities → pick your personal
   team (automatic signing).
3. Choose a simulator or your iPhone and hit **Run**.

## 3. Point the app at your server

In the app's **Settings** tab, enter `http://<your-LAN-IP>:3000` and tap
**Save & Test**. In the simulator, `http://localhost:3000` works as-is.

The app ships with an App Transport Security exception for **local
networking only** (`NSAllowsLocalNetworking`), matching the backend's
trusted-home-network model — it will not talk plain HTTP to the internet.

## Haptics

Haptics run through `Master/Haptics.swift` and fire on real devices only
(simulators don't vibrate):

- light tap: opening/editing, toggles
- selection tick: status menus, pickers, week stepper
- success: task completed, entry logged, vacation approved, sync OK
- warning: deletes
- error: server unreachable
