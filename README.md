# JK Video Call

Family video calls, voice calls and chat. It runs as a web page, and as an installed app on
Android, iPhone and Windows.

## Getting the apps

| Device | What to install | Rings when closed? |
|---|---|---|
| **Android** | The `JK-Video-Call.apk` app. Open it on the phone and allow "install unknown apps". It runs on Chrome's engine, so the phone needs Google Chrome (almost all Android phones have it). | Yes. Turn on notifications when the app asks. |
| **iPhone** | Open the site in **Safari**, tap **Share → Add to Home Screen**, and use that icon. | Yes. Turn on notifications when the app asks (iOS 16.4 or newer). |
| **Windows** | The `JK-Video-Call-Windows` setup `.exe` from the Actions tab. If Windows warns about the publisher, choose **More info → Run anyway**. | Yes, while it's in the system tray. Closing the window keeps it there, and it starts with Windows. Choose **Quit** from the tray icon to stop it. |

The Windows app and an unsigned iPhone app (`.ipa`) are built on every change: open the **Actions** tab,
choose the latest **Build apps** run, and download from **Artifacts**. The sideloaded iPhone app can't
ring when closed (Apple only allows that for paid developer accounts), so use the Home Screen version.

### Android full screen and signing

The Android app is a Trusted Web Activity: Chrome shows the live site full screen as the app, and the
site's notifications ring the phone. Two things keep it full screen without an address bar:

- **The signing key.** Every build must be signed with the same key. It is saved privately in the
  owner's Google Drive as "JK Video Call - Android signing key (private).txt", which also says how to
  add it to GitHub as the `JK_KEYSTORE_B64` and `JK_KEYSTORE_PASSWORD` secrets. Without those
  secrets the workflow skips the Android build.
- **`assetlinks.json`.** Android checks `https://surajsajeev1988.github.io/.well-known/assetlinks.json`,
  which lives in a separate repository named `surajsajeev1988.github.io` (with a `.nojekyll` file).
  A copy is in `apps/android-twa/assetlinks.json`. Without it the app works but shows an address bar.

## Updates happen by themselves

The installed apps open the live site, https://surajsajeev1988.github.io/jk-video-call/, full screen.
Whatever is on the `main` branch is what every phone and computer shows the next time the app opens
(GitHub Pages can take up to about 10 minutes to pick a change up). There's no need to reinstall.

Reinstalling is only needed when the app shell itself changes: its icon, permissions, full-screen
behaviour, tray behaviour or the address it opens. Those changes live in `apps/`.

Without internet the apps show a "No internet" screen and open by themselves once the phone is
back online. Calls and messages need Wi-Fi or mobile data anyway.

## Building yourself

The app projects live in `apps/`. You need Node.js 22.

```sh
cd apps
npm install
npm run android          # Android app, in android-twa/app/build/outputs (needs Java 21, the Android SDK and the signing key)
npm run ios:sync         # then open ios/App/App.xcworkspace in Xcode   (Mac only)
npm run win              # Windows installer, in apps/dist             (run on Windows)
npm run desktop:start    # try the desktop app
```

`npm run www` copies `index.html`, the icons and PeerJS into `apps/www`, which every app is built from.
