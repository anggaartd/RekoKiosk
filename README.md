# RekoKiosk

**Tablet Management System untuk Rekosistem**

Custom Android kiosk platform berbasis [FreeKiosk](https://github.com/RushB-fr/freekiosk) (MIT License) dengan branding dan fitur tambahan untuk kebutuhan operasional Rekosistem.

---

## Fitur

### Kiosk Mode
- 🔒 Multi-App mode (whitelist app tertentu)
- 🏠 Custom home screen dengan header Rekosistem, jam, tanggal, battery, WiFi
- 🔄 Auto-start setelah boot (Device Owner)
- 🚫 Block akses Settings, Play Store, browser bebas
- 📱 Support Chrome, Galeri, File Manager

### DNS Filtering
- 🌐 Block semua website kecuali rekosistem.com
- 🔗 Via Tailscale DNS + NextDNS
- ✅ Whitelist: `*.rekosistem.com`, `*.amazonaws.com`

### Remote Management
- 📊 REST API (40+ endpoints) untuk monitoring & kontrol
- 🌍 Remote access lintas kota via Tailscale VPN
- 🔋 Monitor battery, WiFi, memory, storage, uptime
- 📍 GPS location tracking
- 📸 Remote screenshot & camera photo
- 🔄 Remote reboot, screen on/off, brightness, volume
- 📢 Toast & TTS (kirim pesan ke layar/speaker)
- 🔒 Remote enable/disable kiosk mode
- 🚀 OTA Update (push APK remote)

### Admin Panel
- 🖥️ Web dashboard (Node.js + Express)
- 📱 Device management (add/edit/delete)
- 🎮 Full remote control dari browser
- 📍 Live location + Google Maps embed
- 📷 Camera capture (front/back)
- 🔔 Custom notifications

### Custom Branding
- 🎨 Logo Rekosistem di home screen & boot
- ⏰ Header: logo + jam + tanggal + battery + WiFi
- 🏷️ App name: RekoKiosk

---

## Quick Start

### Download APK
Download APK terbaru dari [Releases](https://github.com/anggaartd/RekoKiosk/releases).

### Setup Tablet
```bash
# Install APK
adb install -r RekoKiosk-latest.apk

# Set Device Owner
adb shell dpm set-device-owner com.freekiosk/.DeviceAdminReceiver

# Konfigurasi kiosk
adb shell "am start -n com.freekiosk/.MainActivity --es pin '12345' --es config '{...}'"
```

Panduan lengkap: lihat `docs/REKOKIOSK-FULL-DOCUMENTATION.md`

---

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Mobile App | React Native + TypeScript + Kotlin |
| Admin Panel | Node.js + Express + SQLite |
| VPN | Tailscale |
| DNS Filter | NextDNS via Tailscale DNS |
| CI/CD | GitHub Actions |
| Remote Access | REST API + ADB over Tailscale |

---

## Build

APK di-build otomatis via GitHub Actions setiap push ke `main`.

Manual build:
```bash
cd android && ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## Project Structure

```
├── android/                    # Native Android (Kotlin)
├── src/
│   ├── components/             # React Native UI
│   │   ├── ExternalAppOverlay.tsx  # Home screen (custom header)
│   │   └── WebViewComponent.tsx    # Welcome screen
│   ├── assets/images/          # Logo Rekosistem
│   └── screens/                # Settings, Kiosk, PIN screens
├── .github/workflows/          # CI/CD (auto-build APK)
├── docs/                       # Documentation
└── patches/                    # Dependency patches
```

---

## Credits

- Based on [FreeKiosk](https://github.com/RushB-fr/freekiosk) by [RushB](https://rushb.fr) (MIT License)
- Custom branding & features by **ARTD** for Rekosistem
- Tailscale for VPN connectivity
- NextDNS for DNS filtering

---

## License

Based on FreeKiosk (MIT License). Custom modifications for internal use by Rekosistem.
