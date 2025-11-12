/**
 * Lucen17-Inflo – Backend (lightweight)
 * API: health, gates, memory, tolls (Stripe-ready), guidance hooks
 */
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
let stripe = null;

dotenv.config();

const app = express();
app.use(cors({ origin: "*", methods: ["GET","POST"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

// ---------------- Persistence ----------------
const DATA_DIR = process.env.DATA_DIR || "./data";
const MEMORY_PATH = path.join(DATA_DIR, "memory.json");
const TOLLS_PATH  = path.join(DATA_DIR, "tolls.json");

function safeReadJSON(p, fallback) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; } }
function safeWriteJSON(p, obj) {
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }
  catch(_) {}
}

let memory = safeReadJSON(MEMORY_PATH, []);
let tolls  = safeReadJSON(TOLLS_PATH,  []);

// Minimal gates list (front-end also has placeholders)
const gates = [
  { key:"mindset",  name:"MindSetFree", toll:"free", blurb:"Mind rhythm tools." },
  { key:"planmore", name:"PlanMore",    toll:"free", blurb:"Plan resonance." },
  { key:"diet",     name:"DietDiary",   toll:"free", blurb:"Nutrition rhythm." },
  { key:"learn",    name:"LearnLume",   toll:"free", blurb:"Education flow." }
];

// Optional Postgres
let pool = null;
let dbReady = false;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pool.query(`CREATE TABLE IF NOT EXISTS reflections (
    id SERIAL PRIMARY KEY,
    text TEXT, tone TEXT, ts BIGINT, deviceId TEXT, division TEXT, location TEXT
  );`).then(()=>{ dbReady = true; console.log("DB ready ✅"); })
  .catch(err => console.error("DB init error:", err));
}

// Optional Stripe
if (process.env.STRIPE_SECRET_KEY) stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// ---------------- API ----------------
app.get("/health", (_req, res) => res.json({ ok:true, service:"lucen17-inflo", ts:Date.now(), db:!!dbReady, stripe:!!stripe }));
app.get("/gates", (_req, res) => res.json({ gates }));

app.get("/memory", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  try {
    if (pool && dbReady) {
      const r = await pool.query("SELECT text,tone,ts,deviceId,division,location FROM reflections ORDER BY ts DESC LIMIT $1", [limit]);
      return res.json({ items: r.rows });
    }
  } catch (e) { console.error("DB read error:", e.message); }
  const items = memory.slice(-limit);
  res.json({ items });
});

app.post("/memory", async (req, res) => {
  const { text, tone, ts, deviceId, division, location } = req.body || {};
  if (!text) return res.status(400).json({ error:"Missing text" });
  const entry = {
    text: String(text).slice(0,4000),
    tone: tone || inferTone(text),
    ts: ts || new Date().toISOString(),
    deviceId: deviceId || "web",
    division: division || null,
    location: location || null
  };

  try {
    if (pool && dbReady) {
      await pool.query(
        "INSERT INTO reflections (text,tone,ts,deviceId,division,location) VALUES ($1,$2,$3,$4,$5,$6)",
        [entry.text, entry.tone, entry.ts, entry.deviceId, entry.division, entry.location]
      );
      return res.json({ saved:true, entry, db:true });
    }
  } catch (e) { console.error("DB write error:", e.message); }

  memory.push(entry); if (memory.length > 5000) memory.splice(0, memory.length-5000);
  safeWriteJSON(MEMORY_PATH, memory);
  res.json({ saved:true, entry, db:false });
});

app.post("/tolls", (req, res) => {
  const { gate, amount, currency, deviceId } = req.body || {};
  if (!gate) return res.status(400).json({ error:"gate required" });
  const tx = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    gate, amount: Number(amount)||0, currency: currency||"GBP",
    ts: Date.now(), deviceId: deviceId||"web"
  };
  tolls.push(tx); if (tolls.length>5000) tolls.splice(0, tolls.length-5000);
  safeWriteJSON(TOLLS_PATH, tolls);
  res.json({ saved:true, tx });
});

app.post("/tolls/pay", async (req, res) => {
  const { gate, amount, currency="GBP", metadata={} } = req.body || {};
  if (!gate || !amount) return res.status(400).json({ error:"gate and amount required" });
  if (!stripe) return res.json({ ok:true, simulated:true, client_secret:"sim_"+Date.now() });
  try {
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: currency.toLowerCase(),
      metadata: { gate, ...metadata }
    });
    res.json({ ok:true, client_secret: pi.client_secret });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

function inferTone(text){
  const t = String(text).toLowerCase();
  if (/(do|today|plan|next|ship|build|fix|schedule|deploy|commit|merge)/.test(t)) return "Directive";
  if (/(idea|imagine|design|create|vision|dream|invent|sketch)/.test(t)) return "Creative";
  return "Reflective";
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[inflo] API listening on :${PORT}`));
