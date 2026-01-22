# Diffy

A Git diff viewer and code review tool built with Tauri, React, and TypeScript.

## Development

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri)

### Setup

```bash
bun install
```

### Run in Development

```bash
bun run tauri dev
```

## Building for Distribution

### Build the App

```bash
bun run tauri build
```

**Output location:** `src-tauri/target/release/bundle/`

| Platform | Files |
|----------|-------|
| macOS | `dmg/Diffy_<version>_<arch>.dmg`, `macos/Diffy.app` |
| Windows | `.msi` and `.exe` (NSIS installer) |
| Linux | `.deb` and `.AppImage` |

Note: You can only build for your current platform. Cross-compilation requires CI/CD.

### Distribute via GitHub Releases

1. Go to https://github.com/zsherman/diffy/releases
2. Click "Create a new release"
3. Tag: `v0.1.0` (match version in `src-tauri/tauri.conf.json`)
4. Upload the installer files from `src-tauri/target/release/bundle/`
5. Publish release

### macOS Notes

Without code signing, users will see an "unidentified developer" warning. They can bypass it by:
- Right-click the app → Open, or
- System Settings → Privacy & Security → Open Anyway
