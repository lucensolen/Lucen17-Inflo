# Lucen17-Inflo (v4.6–v4.9)
Cockpit + lightweight backend aligned to the Inflo spec.

## What’s new
- Vision Lens **division routing** (select where reflections flow).
- **Pulse cluster** (top-right): bubble color (grey=offline, green=online), core dot (green outgoing, cyan incoming), **Flow Index** number (no label).
- **Division & Gate dots**: green pulse for outbound, cyan glow for inbound.
- Beam color still reflects **incoming mood/tone**.
- App bridge via `postMessage` + `lucen.bridge.state`, shared helper `lucen.signal.js`.

## Deploy
### Backend (Render/Railway/Fly/self-host)
1. Create a new repo with `server.js`, `package.json`.
2. Deploy as a Node service; start: `npm start`.
3. Optional: set `DATABASE_URL`, `STRIPE_SECRET_KEY`.

### Frontend (GitHub Pages)
Host `index.html`, `style.css`, `script.js`, `lucen.signal.js`.
- Open Gates tab → paste your backend URL → **Save**.

## App Integration
Child apps can:
```js
// Read core state
const state = JSON.parse(localStorage.getItem('lucen.bridge.state')||'{}');

// Receive broadcasts
window.addEventListener('message', ev => {
  if (ev.data?.type === 'lucenUpdate') {
    // sync UI / tone here
  }
});

// Send reflection back to core
window.postMessage({ type:'lucenReturn', payload:{
  text:'child reflection', tone:'Reflective', division:'educationFlow', gate:'learn', ts: Date.now()
}}, '*');
```
