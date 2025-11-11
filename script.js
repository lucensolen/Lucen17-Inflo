(() => {
  // === Unified keys ===
  const CORE_PREFIX = 'lucen.core.';
  const memoryKey = CORE_PREFIX + 'memory'; // array
  const apiKey    = CORE_PREFIX + 'api';
  const modeKey   = 'nucleos.mode';
  const rcKey     = CORE_PREFIX + 'dial.rc';
  const geKey     = CORE_PREFIX + 'dial.ge';
  const hashKey   = CORE_PREFIX + 'hash'; // lightweight checksum

  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // Unified packet (what flows through the system)
function mkPacket(partial) {
  return Object.assign({
    type: 'reflection',          // or 'image','note','metric'
    text: '',
    tone: 'Reflective',
    media: null,                 // { url, kind:'image'|'audio' } optional
    gate: null,                  // 'LearnLume','FarmOS', etc.
    division: null,              // 'educationFlow' etc.
    subject: null,               // e.g. 'Maths'
    store: 'Local',              // 'Local'|'Global'|'Both'|'None'
    show: 'None',                // gate key to visually notify or 'None'
    origin: { deviceId: 'lucen17-inflo' },
    ts: Date.now()
  }, partial || {});
}

// Read per-entry router config
function readEntryConfig(division, entry) {
  const key = `lucen.division.${division}.entries.${entry}`;
  const saved = JSON.parse(localStorage.getItem(key) || '{}');
  return {
    outMode:   saved.outMode   || 'None',
    outTarget: saved.outTarget || 'None',
    inMode:    saved.inMode    || 'None',
    inSource:  saved.inSource  || 'None'
  };
}

  // Tabs switching (legacy-safe)
var tabs = document.querySelectorAll('[data-tab]');
var panels = document.querySelectorAll('.panel');
for (var i = 0; i < tabs.length; i++) {
  tabs[i].addEventListener('click', function () {
    // remove active from all
    for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
    this.classList.add('active');
    var id = this.getAttribute('data-tab');
    for (var k = 0; k < panels.length; k++) {
      panels[k].classList.toggle('active', panels[k].id === id);
    }
  });
}

// --- storage primitives ---
function storeLocal(packet) {
  const k = 'lucen.core.memory';
  const arr = JSON.parse(localStorage.getItem(k) || '[]');
  arr.push({ text: packet.text, tone: packet.tone, ts: packet.ts,
             gate: packet.gate, division: packet.division, subject: packet.subject, type: packet.type });
  if (arr.length > 5000) arr.splice(0, arr.length - 5000);
  localStorage.setItem(k, JSON.stringify(arr));
}

async function storeGlobal(packet) {
  try {
    await fetch(`${apiBase()}/memory`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        text: packet.text,
        tone: packet.tone,
        ts: packet.ts,
        deviceId: packet.origin?.deviceId || 'web',
        division: packet.division,
        location: null
      })
    });
  } catch(e) { /* offline tolerated */ }
}

function notifyGate(packet, gateKey) {
  // UI/app notification – same-origin child apps or listening tabs
  window.postMessage({ type:'lucenRoute', payload: Object.assign({}, packet, { notify: gateKey }) }, '*');
}

// --- effect pulses ---
function pulseOutbound(division) {
  pulseDot(coreDot, 'green');
  pulseDot(getDivisionDot(division), 'green');
}
function pulseInbound(division) {
  pulseDot(coreDot, 'cyan');
  pulseDot(getDivisionDot(division), 'cyan');
}

// --- core dispatcher ---
async function dispatchPacket(packet, entryName) {
  // 1) store: Local / Global / Both / None
  if (packet.store === 'Local' || packet.store === 'Both') storeLocal(packet);
  if (packet.store === 'Global' || packet.store === 'Both') await storeGlobal(packet);

  // 2) visual delivery: specific gate or None
  if (packet.show && packet.show !== 'None') notifyGate(packet, packet.show);

  // 3) beam + pulses
  pulseOutbound(packet.division || 'educationFlow');
  updateFlowIndex();
}

// --- inbound acceptance based on entry config ---
async function acceptInbound(packet, division, entry) {
  const cfg = readEntryConfig(division, entry);
  const allowScope =
    cfg.inMode === 'Both' ||
    (cfg.inMode === 'Local'  && packet.origin?.deviceId === 'lucen17-inflo') ||
    (cfg.inMode === 'Global' && packet.origin?.deviceId !== 'lucen17-inflo');

  const allowSource =
    cfg.inSource === 'None' ? false :
    (cfg.inSource === 'Any' ? true  :
     (packet.gate === cfg.inSource));

  if (cfg.inMode === 'None') return;        // muted
  if (!allowScope || !allowSource) return;  // filtered out

  // Treat inbound like a store/show action but mark as inbound
  if (cfg.inMode === 'Local' || cfg.inMode === 'Both') storeLocal(packet);
  if (cfg.inMode === 'Global' || cfg.inMode === 'Both') await storeGlobal(packet);

  pulseInbound(division);
  updateFlowIndex();
}

  // UI refs
  const apiInput   = $('#apiBase');
  const saveApiBtn = $('#saveApi');
  const badge      = $('#onlineBadge');
  const coreDot    = $('#coreSyncDot');
  const flowNum    = $('#flowIndex');
  const logBtn     = $('#logBtn');
  const ta         = $('#visionInput');
  const list       = $('#memoryList');
  const gatesList  = $('#gatesList');
  const payBtn     = $('#payBtn');
  const payAmount  = $('#payAmount');
  const payGate    = $('#payGate');
  const divisionSelect = $('#divisionSelect');

  const dialRC       = $('#dialRC');
  const dialGE       = $('#dialGE');
  const modeCreation = $('#modeCreation');
  const modeGuidance = $('#modeGuidance');
  const beam         = $('#beam');

  // Mode + dial init (preserve legacy if present)
  dialRC.value = localStorage.getItem(rcKey) || localStorage.getItem('lucen.dial.rc') || "50";
  dialGE.value = localStorage.getItem(geKey) || localStorage.getItem('lucen.dial.ge') || "50";
  const savedMode = localStorage.getItem(modeKey) || 'Guidance';
  if (savedMode === 'Creation') {
    modeCreation.classList.add('active'); modeGuidance.classList.remove('active');
    if (beam) beam.style.animationDuration = '1.5s';
  } else {
    modeGuidance.classList.add('active'); modeCreation.classList.remove('active');
    if (beam) beam.style.animationDuration = '3s';
  }
  dialRC?.addEventListener('input', () => localStorage.setItem(rcKey, dialRC.value));
  dialGE?.addEventListener('input', () => localStorage.setItem(geKey, dialGE.value));
  modeCreation?.addEventListener('click', () => {
    localStorage.setItem(modeKey, 'Creation');
    modeCreation.classList.add('active'); modeGuidance.classList.remove('active');
    if (beam) beam.style.animationDuration = '1.5s';
  });
  modeGuidance?.addEventListener('click', () => {
    localStorage.setItem(modeKey, 'Guidance');
    modeGuidance.classList.add('active'); modeCreation.classList.remove('active');
    if (beam) beam.style.animationDuration = '3s';
  });

  // Helpers
  function apiBase() { return (localStorage.getItem(apiKey) || 'https://lucen17-backend.onrender.com'); }
  async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(url); return r.json(); }
  async function postJSON(url, data) {
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
    if (!r.ok) throw new Error('POST ' + url); return r.json();
  }
  function classifyTone(text) {
    const t = text.toLowerCase();
    if (/(do|today|plan|next|ship|build|fix|schedule|deploy|commit|merge)/.test(t)) return 'Directive';
    if (/(idea|imagine|design|create|vision|dream|invent|sketch)/.test(t)) return 'Creative';
    return 'Reflective';
  }
  function toneColor(t) { return t === 'Directive' ? 'orange' : (t === 'Creative' ? 'yellow' : 'blue'); }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // Division ↔ Gate mapping (Inflo)
  const divisionGateMap = {
    fieldOps: ['FarmOS','SovereignField'],
    selfSustain: ['PurchaseTracker','MaintenanceManager'],
    mindRhythm: ['MindSetFree','MindIron'],
    educationFlow: ['LearnLume','TeachEasy'],
    creativeOps: ['BrandBull','PlanMore'],
    socialResonance: ['CoachBuddy','BusinessPortal'],
    ecoSystems: ['FarmOS','RealStates'],
    businessLine: ['BusinessPortal','SingleSolutions']
  };

  // Gate registry (UI list)
  const lucenGates = [
    { name:'MindSetFree', key:'mindset', url:'https://placeholder.local/mindsetfree' },
    { name:'PlanMore',    key:'planmore', url:'https://placeholder.local/planmore' },
    { name:'DietDiary',   key:'diet',     url:'https://placeholder.local/dietdiary' },
    { name:'LearnLume',   key:'learn',    url:'https://placeholder.local/learnlume' }
  ];

  // Online badge + server memory
  const savedAPI = localStorage.getItem(apiKey);
  if (savedAPI && apiInput) apiInput.value = savedAPI;

  async function refreshOnline() {
    if (!badge) return;
    try {
      const h = await getJSON(`${apiBase()}/health`);
      if (h && h.ok) { badge.classList.add('online'); await refreshGates(); await pullServerMemory(); }
      else { badge.classList.remove('online'); }
    } catch { badge.classList.remove('online'); }
  }

  async function refreshGates() {
    if (!gatesList) return;
    try {
      const { gates } = await getJSON(`${apiBase()}/gates`);
      renderGatesUI(gates || []);
    } catch {
      renderGatesUI([]);
    }
  }

  function renderGatesUI(serverGates) {
    const wrap = document.getElementById("gatesList");
    if (!wrap) return;
    const gates = lucenGates; // client-predefined + server list in future
    wrap.innerHTML = gates.map(g => `
      <div class="card gate-card" data-gate="${g.key}">
        <div class="gate-meta">
          <span class="dot gate-dot idle" data-gate-dot="${g.key}">•</span>
          <b>${g.name}</b>
        </div>
        <button class="openGate" data-url="${g.url}">Open</button>
      </div>
    `).join('');
    wrap.querySelectorAll('.openGate').forEach(btn => btn.addEventListener('click', e => {
      const url = e.target.dataset.url; window.open(url, '_blank');
    }));
  }

  async function pullServerMemory() {
    if (!list) return;
    try {
      const res = await getJSON(`${apiBase()}/memory?limit=200`);
      const items = res.items || res; // support both shapes
      const html = (items || []).filter(i => i.text).sort((a,b)=>(b.ts||0)-(a.ts||0)).map(i => {
        const color = toneColor(i.tone || 'Reflective');
        const ts = i.ts ? new Date(i.ts) : new Date();
        return `<div class="card">
          <div class="tone">${i.tone || 'Reflective'}</div>
          <div class="ts">${ts.toLocaleString()}</div>
          <div class="txt">${escapeHtml(i.text || '')}</div>
          <div class="node ${color}"></div>
        </div>`;
      }).join('');
      list.innerHTML = html;
    } catch {}
  }

  // Local memory render
  function renderLocal() {
    const items = JSON.parse(localStorage.getItem(memoryKey) || '[]');
    const html = items.slice().reverse().map(i => {
      const color = toneColor(i.tone || 'Reflective');
      const ts = (i.ts ? new Date(i.ts) : new Date()).toLocaleString();
      return `<div class="card">
        <div class="tone">${i.tone || 'Reflective'}</div>
        <div class="ts">${ts}</div>
        <div class="txt">${escapeHtml(i.text || '')}</div>
        <div class="node ${color}"></div>
      </div>`;
    }).join('');
    if (list) list.innerHTML = html;
  }

// === Memory Mode Toggle ===
const memoryMode = document.getElementById('memoryMode');
if (memoryMode) {
  memoryMode.value = localStorage.getItem('lucen.memory.mode') || 'local';
  memoryMode.addEventListener('change', () => {
    localStorage.setItem('lucen.memory.mode', memoryMode.value);
    refreshMemory();
  });
}

// Unified refresh
async function refreshMemory() {
  const mode = localStorage.getItem('lucen.memory.mode') || 'local';
  if (mode === 'global') {
    await pullServerMemory();
  } else {
    renderLocal();
  }
}

  // Flow Index (0–99)
  function computeFlowIndex() {
    const arr = JSON.parse(localStorage.getItem(memoryKey) || '[]');
    if (!arr.length) return 0;
    const now = Date.now();
    const horizon = 60*60*1000; // 60m window
    const recent = arr.filter(e => (now - new Date(e.ts).getTime()) <= horizon);
    const freq = Math.min(1, recent.length / 30); // 30 reflections/hr = 100%
    const tones = new Set(recent.map(e => e.tone || 'Reflective')).size;
    const diversity = Math.min(1, tones / 3); // 3 tone classes
    const idx = Math.round((0.7*freq + 0.3*diversity) * 99);
    return idx;
  }
  function updateFlowIndex() {
    if (!flowNum) return;
    flowNum.textContent = String(computeFlowIndex()).padStart(2,'0');
  }

  // Pulse helpers
  function pulseDot(el, type='green') {
    if (!el) return;
    el.classList.remove('idle','green','cyan');
    if (type === 'green') { el.classList.add('green'); setTimeout(()=>el.classList.remove('green'), 900); }
    if (type === 'cyan')  { el.classList.add('cyan');  setTimeout(()=>el.classList.remove('cyan'), 1200); }
  }
  function getDivisionDot(name) { return document.querySelector(`[data-dot="${name}"]`); }
  function getGateDot(key) { return document.querySelector(`[data-gate-dot="${key}"]`); }

  // Map division -> gate dots keys
  function gateKeysForDivision(div) {
    const names = divisionGateMap[div] || [];
    // translate friendly names into gate keys where possible
    const map = { MindSetFree:'mindset', PlanMore:'planmore', DietDiary:'diet', LearnLume:'learn',
                  CoachBuddy:'coachbuddy', BusinessPortal:'business', TeachEasy:'teacheasy',
                  PurchaseTracker:'purchase', MaintenanceManager:'maintenance', RealStates:'realstates',
                  FarmOS:'farmos', MindIron:'mindiron', SovereignField:'sovereign' };
    return names.map(n => map[n]).filter(Boolean);
  }

  // Checksum
  function recalcHash() {
    try {
      const arr = JSON.parse(localStorage.getItem(memoryKey) || '[]');
      const h = arr.length + ':' + (arr[arr.length-1]?.ts || 0);
      localStorage.setItem(hashKey, h);
    } catch {}
  }

  // Log reflection with routing
  async function logReflection() {
    const text = (ta?.value || '').trim();
    if (!text) return alert('Enter a reflection first.');
    const division = (divisionSelect?.value || 'core');
    const tone  = classifyTone(text);
    const entry = {
      text, tone,
      ts: new Date().toISOString(),
      deviceId: "lucen17-inflo",
      division,
      location: null
    };

    // backend
    try {
      const res = await postJSON(`${apiBase()}/memory`, entry);
      if (!res.saved) console.warn('Backend save failed.');
      badge.classList.add('online'); // confirms contact
    } catch (e) {
      // offline is fine; bubble will remain grey
    }

    // local store (append)
    const arr = JSON.parse(localStorage.getItem(memoryKey) || '[]');
    arr.push(entry); if (arr.length > 5000) arr.splice(0, arr.length-5000);
    localStorage.setItem(memoryKey, JSON.stringify(arr));
    recalcHash();

    // UI reset
    if (ta) { ta.value=''; ta.placeholder='✨ Logged!'; setTimeout(()=>ta.placeholder='Type reflection...', 900); }
    renderLocal(); updateFlowIndex();

    // Pulses
    pulseDot(coreDot, 'green');
    pulseDot(getDivisionDot(division), 'green');
    gateKeysForDivision(division).forEach(k => pulseDot(getGateDot(k), 'green'));

    // Bridge broadcast to apps
    const beamColor = getComputedStyle(beam).backgroundColor || '#999';
    const bridgePayload = { beamColor, lastReflection:text, tone, division, ts: Date.now() };
    try { localStorage.setItem('lucen.bridge.state', JSON.stringify(bridgePayload)); } catch {}
    window.postMessage({ type:'lucenUpdate', payload: bridgePayload }, "*");

    // Guidance drift
    driftFromTone(tone);
    updateBeamTone();
  }

  // Listen for returns from apps
  window.addEventListener('message', ev => {
    if (!ev.data || ev.data.type !== 'lucenReturn') return;
    const entry = ev.data.payload || {};
    if (!entry.text) return;

    // Append to local memory
    const arr = JSON.parse(localStorage.getItem(memoryKey) || '[]');
    arr.push(entry); localStorage.setItem(memoryKey, JSON.stringify(arr)); recalcHash();
    renderLocal(); updateFlowIndex();

    // Cyan glow on core + division + gates (if division provided)
    pulseDot(coreDot, 'cyan');
    if (entry.division) pulseDot(getDivisionDot(entry.division), 'cyan');
    if (entry.gate) pulseDot(getGateDot(entry.gate), 'cyan');

    updateBeamTone();
  });

  // Passive breathing (Guidance) + periodic updates
  function driftFromTone(tone) {
    if ((localStorage.getItem(modeKey) || 'Guidance') !== 'Guidance') return;
    const rc = Number(localStorage.getItem(rcKey) || dialRC?.value || 50);
    const ge = Number(localStorage.getItem(geKey) || dialGE?.value || 50);
    let nrc = rc, nge = ge;
    if (tone === 'Creative')      { nrc = Math.min(100, rc + 3); nge = Math.min(100, ge + 2); }
    else if (tone === 'Directive'){ nrc = Math.max(0, rc - 2);  nge = Math.max(0, ge - 1); }
    else                          { nrc = Math.max(0, Math.min(100, rc + (Math.random()*2 - 1))); }
    if (dialRC) dialRC.value = String(nrc); if (dialGE) dialGE.value = String(nge);
    localStorage.setItem(rcKey, String(nrc)); localStorage.setItem(geKey, String(nge));
  }
  setInterval(() => {
    // server sync
    refreshOnline();
    // breathing
    if ((localStorage.getItem(modeKey) || 'Guidance') === 'Guidance') {
      const rc = Number(localStorage.getItem(rcKey) || dialRC?.value || 50);
      const ge = Number(localStorage.getItem(geKey) || dialGE?.value || 50);
      const nrc = Math.max(0, Math.min(100, rc + (Math.random()*2 - 1)));
      const nge = Math.max(0, Math.min(100, ge + (Math.random()*2 - 1)));
      if (dialRC) dialRC.value = String(nrc); if (dialGE) dialGE.value = String(nge);
      localStorage.setItem(rcKey, String(nrc)); localStorage.setItem(geKey, String(nge));
    }
    updateFlowIndex();
  }, 60000); // 60s

  // Save API + log + pay
  saveApiBtn?.addEventListener('click', () => {
    const v = (apiInput?.value || '').trim();
    if (!v) { alert('Enter API URL'); return; }
    localStorage.setItem(apiKey, v);
    refreshOnline();
    alert('API URL saved');
  });
  logBtn?.addEventListener('click', logReflection);

  payBtn?.addEventListener('click', async () => {
    const base = apiBase();
    if (!base) { alert('Save API first'); return; }
    const amt  = Number(payAmount?.value || 3);
    const gate = payGate?.value || 'core';
    try {
      const r = await postJSON(`${base}/tolls/pay`, { gate, amount: amt, currency: 'GBP' });
      if (r.simulated) alert('Simulated payment ok');
      else if (r.client_secret) alert('PaymentIntent created (test). Client confirm later.');
      else alert('Payment response received.');
    } catch { alert('Payment failed'); }
  });

  // Divisions persistence + beam tone
  const defaultDivisions = {
    fieldOps:{focusHours:'',wins:'',blockers:'',mood:''},
    selfSustain:{}, mindRhythm:{}, educationFlow:{}, creativeOps:{},
    socialResonance:{}, ecoSystems:{}, businessLine:{}
  };
  let lucenDivisions = JSON.parse(localStorage.getItem('lucen.divisions')) || defaultDivisions;
  function saveDivisions(){ try{ localStorage.setItem('lucen.divisions', JSON.stringify(lucenDivisions)); }catch(e){} }
  function initDivisions(){
    Object.keys(divisionGateMap).forEach(name => {
      const section = document.querySelector(`[data-division="${name}"]`);
      if (!section) return;
      ['focusHours','wins','blockers','mood'].forEach(key => {
        const input = section.querySelector(`[data-field="${key}"]`);
        if (input) {
          input.value = (lucenDivisions[name] && lucenDivisions[name][key]) || '';
          input.addEventListener('input', () => {
            lucenDivisions[name] = lucenDivisions[name] || {};
            lucenDivisions[name][key] = input.value;
            saveDivisions();
            if (key === 'mood') updateBeamTone();
          });
        }
      });
    });
  }
  window.addEventListener('DOMContentLoaded', initDivisions);

  const moodColors = { calm:"#4fc3f7", focused:"#81c784", tense:"#ffb74d", inspired:"#ba68c8", tired:"#e57373" };
  function updateBeamTone() {
    const el = document.getElementById('beam'); if (!el) return;
    const moods = Array.from(document.querySelectorAll('[data-field="mood"]')).map(i => (i.value||'').toLowerCase().trim()).filter(Boolean);
    let color = "#999";
    if (moods.length){
      const text = moods.join(' ');
      if (/(calm|peace|balance)/.test(text))            color = "#5aa7ff";
      else if (/(focus|clarity|discipline)/.test(text)) color = "#50fa7b";
      else if (/(inspired|creative|gold)/.test(text))   color = "#ffc857";
      else if (/(tired|low|drained)/.test(text))        color = "#9b9b9b";
      else if (/(energy|alive|vibrant)/.test(text))     color = "#ff6f61";
      else if (/(reflect|memory|depth)/.test(text))     color = "#6a5acd";
    }
    el.style.setProperty('--beam-color', color);
    el.style.background = color;
    el.style.boxShadow = `0 0 25px 6px ${color}`;
  }
  (function wireBeamTone(){
    const inputs = document.querySelectorAll('[data-field="mood"]');
    inputs.forEach(inp => { inp.removeEventListener('input', updateBeamTone); inp.addEventListener('input', updateBeamTone); });
    updateBeamTone();
    setInterval(updateBeamTone, 5000);
  })();

  // Init
  function initBadge(){
    // build cluster contents if missing (dot + number only)
    if (!coreDot) return;
    coreDot.classList.add('idle');
    updateFlowIndex();
  }

  (function init(){
    refreshMemory(); refreshOnline(); initBadge(); updateFlowIndex();
    // initial compute sooner than 60s
    setTimeout(updateFlowIndex, 3000);
  })();
})();
