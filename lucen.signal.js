// LucenSignal.js — shared lightweight signal bus
(function(){
  const BUS_KEY = "lucen.bridge.state";
  window.LucenSignal = {
    read: () => {
      try { return JSON.parse(localStorage.getItem(BUS_KEY) || "{}"); }
      catch { return {}; }
    },
    write: (payload) => {
      try { localStorage.setItem(BUS_KEY, JSON.stringify(payload||{})); }
      catch(_) {}
      window.postMessage({ type: "lucenUpdate", payload }, "*");
    },
    returnToCore: (entry) => {
      window.postMessage({ type: "lucenReturn", payload: entry }, "*");
    }
  };
})();