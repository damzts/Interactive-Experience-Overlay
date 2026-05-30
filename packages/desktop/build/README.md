# Build Resources

This directory contains build resources for electron-builder.

## Icons

Replace the placeholder icon files with actual application icons before production builds:

- `icon.ico` — Windows icon (256x256, multi-size ICO format)
- `icon.icns` — macOS icon (512x512@2x ICNS format)
- `icons/` — Linux icons (PNG files at various sizes: 16x16 through 512x512)

### Generating Icons

Use a tool like [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder) to generate all formats from a single 1024x1024 PNG source:

```bash
npx electron-icon-builder --input=source-icon.png --output=build/
```

## Entitlements

- `entitlements.mac.plist` — macOS entitlements for hardened runtime (code signing)

## Installer

- `installer.nsh` — Custom NSIS script for Windows protocol registration
