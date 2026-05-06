# PeerMetrics SDK examples

Static HTML pages that load the browser bundle from `../dist/browser.js`. Serve the **repository root** (not this folder alone) so those paths resolve.

## Run locally

From the repo root:

1. **Install dependencies** (once): `npm install`
2. **Build the SDK** (required for `dist/browser.js`): `npm run build`
3. **Start a static server** and open the examples index:

   ```bash
   npm run serve
   ```

   This runs [http-server](https://www.npmjs.com/package/http-server) on port **3000** and opens `/examples` in your browser (`http://127.0.0.1:3000/examples/`).

If you prefer another tool, serve the **project root** on any port, for example:

```bash
npx http-server . -p 3000
```

Then open `http://localhost:3000/examples/`.

Opening the HTML files directly (`file://`) is not recommended: `getUserMedia` and some WebRTC flows expect a secure context or `localhost`, and the scripts load `../dist/browser.js` relative to the repo layout.

## What to edit

| File | Purpose | Typical changes |
|------|---------|------------------|
| [`index.html`](index.html) | Links to the other examples | Usually none; add a card if you add a new demo. |
| [`basic-webrtc.html`](basic-webrtc.html) | Minimal two-peer `RTCPeerConnection` + PeerMetrics | **`PeerMetrics` options** in the script: `apiRoot` (must end with `/v1`), `apiKey`, `mockRequests`, etc. Random `userId` / `userName` / `conferenceId` / `meta.recordingId` are generated on each **Start Call**; **Hang Up** runs `endCall()` before the next call. |
| [`jitsi.html`](jitsi.html) | Jitsi Meet SDK (`lib-jitsi-meet`) + PeerMetrics | **`initPeerMetrics`**: `apiKey`, `mockRequests`, `wrapPeerConnection`. **Room name** in the page input (lowercase, alphanumeric). Jitsi loads `https://meet.jit.si/config.js` in `<head>`; use your own deployment’s `config.js` for production. |
| [`livekit.html`](livekit.html) | LiveKit client + PeerMetrics | **LiveKit URL and token** in the form (get credentials from [LiveKit Cloud](https://cloud.livekit.io) or your server). **`initPeerMetrics`**: `apiKey`, `mockRequests`, and related identity fields. |

Replace placeholder API keys and endpoints with your PeerMetrics project values before sending real analytics traffic. Check each example's `mockRequests` setting and toggle it based on whether you want real API traffic or local dry-run behavior.

## Watch mode during development

If you are changing SDK source and rebuilding often, run `npm run watch` in one terminal and keep `npm run serve` (or another static server) in another so `dist/browser.js` stays up to date when you refresh the browser.
