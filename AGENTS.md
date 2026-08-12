# AGENTS.md

## Overview
ChromeNeedle — Chrome MV3 extension that runs a local LLM (Needle 2) in WASM inside the browser. No build step, no bundler, no package manager, no tests. Loaded as an unpacked extension directly into Chrome.

## Key files
- `manifest.json` — MV3 manifest, permissions, CSP (`wasm-unsafe-eval`, `connect-src *`)
- `js/sidepanel.js` — main app entry point: UI, agent loop, init
- `js/needle-agent.js` — WASM model loading + inference
- `background.js` — Service Worker, routes all tool commands via `chrome.runtime.onMessage`
- `content.js` — Content script for DOM inspection/highlighting (not a module)
- `lib/needle.js` + `lib/needle.wasm` + `lib/needle2.cact` — pre-built Emscripten engine + model weights (~13MB)

## Module system
- `sidepanel.html` loads scripts with `type="module"` → `sidepanel.js` uses `import`/`export`
- `background.js` and `content.js` are **plain scripts**, NOT ES modules — do not add imports to them
- `tools-builtin.js` is imported as a module dependency of `sidepanel.js`, not standalone

## WASM memory critical
`needle-agent.js` keeps a persistent `weightsPtr` — the WASM engine holds a reference to the weights buffer for the session lifetime (does NOT copy). **Do not free it** — freeing corrupts the model. This is deliberate and documented in the source.

## Clipboard tools
`clipboard_read` and `clipboard_write` must run from the side panel (direct `navigator.clipboard`), NOT from `background.js`. The background Service Worker returns an error for these.

## Translation
`translator.js` uses a hardcoded iciba API URL with embedded key/timestamp/signature. The system prompt forces `locale: en-US` to prevent decoder rambling with non-English locales.

## Development workflow
- No build/lint/test commands exist
- Load `chrome://extensions` → "Load unpacked" → select repo root
- Errors surface via the side panel's `window.onerror` handler + browser console
- All `console.log` logging is intentional debugging output — keep it or improve it, but don't strip blindly
