# JK Video Call

Family video calls, voice calls and chat. It runs as a web page, and as an installed app on
Android, iPhone and Windows.

## Getting the apps

Every change pushed to GitHub builds the apps automatically. Open the **Actions** tab, choose the
latest **Build apps** run, and download from **Artifacts** at the bottom:

| File | Phone or computer | How to install |
|---|---|---|
| `JK-Video-Call-Android` (`.apk`) | Android | Open the file on the phone and allow "install unknown apps" when asked. |
| `JK-Video-Call-Windows` (`.exe`) | Windows | Run the setup `.exe`, or the `portable` one to use it without installing. Windows may warn that it doesn't know the publisher: choose **More info → Run anyway**. |
| `JK-Video-Call-iPhone-unsigned` (`.ipa`) | iPhone | It has to be signed first. On a computer, use a tool such as Sideloadly with your Apple ID to install it. With a free Apple ID the app stops opening after 7 days and must be installed again; a paid Apple developer account lifts that. |

The apps carry the whole page inside them, so nothing is downloaded when they open. Calls and
messages still need Wi-Fi or mobile data.

**Known limit:** when an app is fully closed, incoming calls can't ring it yet. Ringing a closed
app needs Firebase (Android) and Apple push (iPhone) to be set up. Keep the app open or in the
background to receive calls.

## Building yourself

The app projects live in `apps/`. You need Node.js 22.

```sh
cd apps
npm install
npm run android:sync     # then: cd android && ./gradlew assembleDebug   (needs Java 21 and the Android SDK)
npm run ios:sync         # then open ios/App/App.xcworkspace in Xcode   (Mac only)
npm run win              # Windows installer, in apps/dist             (run on Windows)
npm run desktop:start    # try the desktop app
```

`npm run www` copies `index.html`, the icons and PeerJS into `apps/www`, which every app is built from.
