#!/usr/bin/env bash
# Kézjegy - local Android TEST build of the client app (release build type, signed with the public DEBUG key).
# Package com.somosi.kezjegy. Same recipe as C:/Users/UpgradePC/kerti_doktor/apk/build-apk.sh.
# Run from Git Bash:  bash C:/Users/UpgradePC/konyvelo_app/apk/build-apk.sh
#                     PREBUILD=1 bash ...   (after app.config.ts / plugins changed)
# Environment variables are set only for this process; nothing persistent is changed.
# The app talks to https://api.45-94-65-74.sslip.io/api/v1 (override: EXPO_PUBLIC_API_URL=... bash build-apk.sh).
set -euo pipefail

APP=/c/Users/UpgradePC/konyvelo_app/kod/app
OUT=/c/Users/UpgradePC/konyvelo_app/apk

export ANDROID_HOME='D:\Atvitel\Android\Sdk'
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME='C:\Users\UpgradePC\jdk-17\jdk-17.0.12+7'
export PATH="/c/Users/UpgradePC/jdk-17/jdk-17.0.12+7/bin:$PATH"
# Gradle cache on D: (C: is tight on space)
export GRADLE_USER_HOME='D:\Atvitel\Android\gradle-home'
export KEZJEGY_CXX_ROOT='D:/Atvitel/Android/cxk'
export CI=1
export NODE_ENV=production

# Phones only: 64-bit and 32-bit ARM (older budget phones still run 32-bit Android).
ABIS="${ABIS:-arm64-v8a,armeabi-v7a}"

cd "$APP"
# brand.json, enums, fixtures + the legal texts into src/ (SPEC §3.2); app.config.ts reads the brand from there
npm run shared --silent

if [ ! -d android ]; then
  # generates android/ from app.config.ts (Continuous Native Generation)
  npx expo prebuild -p android --no-install
elif [ "${PREBUILD:-0}" = "1" ]; then
  # Even without --clean, expo prebuild silently DELETES android/ when it finds it "malformed".
  # House rule: nothing is deleted, so such a folder is moved into app/_regi/ first (same disk).
  if ! node -e 'const {AndroidConfig:{Paths:P}}=require("@expo/config-plugins");const r=process.argv[1];Promise.all([P.getAppBuildGradleAsync(r),P.getProjectBuildGradleAsync(r),P.getAndroidManifestAsync(r),P.getMainApplicationAsync(r)]).then(()=>process.exit(0),()=>process.exit(1));' "$PWD"; then
    mkdir -p "$APP/_regi"
    BAD="$APP/_regi/android_incomplete_$(date +%Y-%m-%d_%H%M)"
    mv android "$BAD"
    echo "android/ was incomplete: moved to $BAD, generating a fresh one"
  fi
  npx expo prebuild -p android --no-install
fi

cd android
# windows-path.init.gradle: shortens CMake object paths (Windows 260-character limit)
./gradlew assembleRelease \
  --init-script "$OUT/windows-path.init.gradle" \
  -PreactNativeArchitectures="$ABIS" \
  "-Dorg.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8" \
  --no-daemon --console=plain

cd "$APP"
VERSION=$(node -e "const s=require('fs').readFileSync('app.config.ts','utf8');const m=s.match(/version:\s*'([^']+)'/);process.stdout.write(m?m[1]:'0.0.0')")
SRC="$APP/android/app/build/outputs/apk/release/app-release.apk"
DST="$OUT/Kezjegy-$VERSION-test.apk"
mkdir -p "$OUT"
STAMP=$(date +%Y-%m-%d_%H%M)
if [ -f "$DST" ]; then
  mkdir -p "$OUT/_regi"
  mv "$DST" "$OUT/_regi/Kezjegy-$VERSION-test_$STAMP.apk"
  [ -f "$DST.sha256" ] && mv "$DST.sha256" "$OUT/_regi/Kezjegy-$VERSION-test_$STAMP.apk.sha256"
fi
cp "$SRC" "$DST"
cd "$OUT"
sha256sum "Kezjegy-$VERSION-test.apk" > "Kezjegy-$VERSION-test.apk.sha256"
ls -l "$DST"
cat "Kezjegy-$VERSION-test.apk.sha256"
