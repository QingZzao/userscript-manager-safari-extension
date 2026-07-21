# UserScript Manager Safari Extension

UserScript Manager Safari Extension is a lightweight macOS Safari userscript manager. It is built for people who want a simple local alternative after Tampermonkey Classic stopped being actively maintained for Safari.

This project is intentionally small: it focuses on installing, enabling, matching, injecting, and debugging trusted userscripts. It is not a full Tampermonkey clone.

Chinese documentation: [README.md](README.md)

Promo page: [promo/index.html](promo/index.html)

## Features

- Install a userscript from a raw `.user.js` URL.
- Install a userscript by pasting the full source.
- Parse common userscript metadata:
  - `@name`
  - `@version`
  - `@description`
  - `@match`
  - `@include`
  - `@exclude`
  - `@grant`
  - `@run-at`
  - `@require`
  - `@resource`
  - `@sandbox`
- Enable, disable, and delete installed scripts from the options page.
- Inject matched scripts into Safari pages.
- Cache `@require` dependencies during installation and inject them in order.
- Read and cache `@resource` text assets.
- Provide a lightweight `GM_*` / `GM.*` compatibility layer, including:
  - `GM_info`
  - `GM_addStyle`
  - `GM_getValue`
  - `GM_setValue`
  - `GM_deleteValue`
  - `GM_listValues`
  - `GM_xmlhttpRequest`
  - `GM_getResourceText`
  - `GM_getResourceURL`
  - `GM_getResourceUrl`
  - `GM_registerMenuCommand`
  - `GM_unregisterMenuCommand`
  - `GM_addValueChangeListener`
  - `GM_removeValueChangeListener`
  - `GM_openInTab`
  - `GM_notification`
  - `GM_setClipboard`
- Export and import a JSON backup of scripts, enabled states, GM values, cached resources, and recent error logs.
- Mirror installed scripts into IndexedDB and native extension storage to reduce data loss when Safari resets unsigned extension state.

## Project Layout

- `extension/`: readable Web Extension source files.
- `UserscriptManagerSafari/UserscriptManagerSafari.xcodeproj`: the Safari Web Extension Xcode project.
- `UserscriptManagerSafari/UserscriptManagerSafari Extension/Resources/`: resources copied into the Xcode app extension bundle. Keep this directory synchronized with `extension/` before packaging.

## Install From the DMG

Download the latest DMG from GitHub Releases:

- [Latest release](https://github.com/QingZzao/userscript-manager-safari-extension/releases/latest)

Install steps:

1. Download `UserScriptManagerSafari-*.dmg`.
2. Open the DMG and drag `UserScriptManagerSafari.app` into `Applications`.
3. Open the app from `/Applications`.
4. If macOS says the developer cannot be verified, right-click the app and choose `Open`, or allow it from `System Settings > Privacy & Security`.
5. Open Safari Settings and enable `UserScript Manager Safari` in the Extensions section.
6. Click the Safari toolbar extension button to open the manager page and install userscripts.

Important: the current DMG is unsigned and not notarized. It is intended as an early testing build and does not require a paid Apple Developer Program account. Safari may require `Allow unsigned extensions` to be enabled from the Developer menu, and Safari resets that setting after it quits.

## Temporary Extension Loading

If you only have a free Apple Developer account, or Safari does not keep showing the unsigned DMG extension, load the Web Extension source folder directly:

```text
/Users/qingzzao/Documents/个人/userscript-manager-safari-extension/extension
```

In Safari:

1. Enable the Developer menu.
2. Enable `Allow unsigned extensions`.
3. Choose `Add Temporary Extension...`.
4. Select this repository's `extension/` folder.
5. Enable the extension from Safari Settings.

Temporary extensions are removed when Safari quits, so you need to load the folder again in the next Safari session.

## Build From Source

Use the helper script to synchronize resources, build the app, install it to `/Applications`, and open it so Safari can register the extension:

```bash
cd userscript-manager-safari-extension
./scripts/build-and-install.sh
```

The script uses `/Applications/Xcode-beta.app` when it is available. If you set `DEVELOPER_DIR` yourself, your value is respected.

## Package a DMG

Maintainers can generate a local DMG with:

```bash
cd userscript-manager-safari-extension
./scripts/package-dmg.sh
```

The output is written to `dist/UserScriptManagerSafari-<version>.dmg`.

This package is not Developer ID signed and is not notarized. A smoother public distribution requires a paid Apple Developer Program account, Developer ID signing, and notarization.

## Install Userscripts

1. Click the `UserScript Manager Safari` toolbar button.
2. Open the manager page.
3. Paste a raw `.user.js` URL or the full userscript source.
4. Click install.
5. Refresh the target website and verify the script runs.

Scripts used for local acceptance testing:

- Zhihu enhancement: menu commands, GM storage, URL changes, and page-world injection.
- AC-baidu: `@require`, `@resource`, GM value synchronization, settings page, and search page behavior.

## Notes

- This is a lightweight personal tool, not a full userscript platform.
- The extension requests `<all_urls>` because a generic userscript manager needs to support unknown target sites.
- Only install scripts you trust.
- There is no script marketplace, cloud sync, subscription updater, or App Store release flow yet.

## License

MIT. See [LICENSE](LICENSE).
