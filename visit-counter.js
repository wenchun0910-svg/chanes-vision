/* 訪客計數器：由造島工坊產生。同一台裝置一天只算一次；連不上就不顯示，絕不放假數字。 */
(() => {
  const KEY = 'island-visit';
  const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  async function ask(endpoint, hit, vid) {
    if (/script\.google\.com/.test(endpoint)) {
      const r = await fetch(`${endpoint}?visit=${hit ? 'hit' : 'read'}`, { cache: 'no-store' });
      return r.json();
    }
    const r = hit
      ? await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vid }) })
      : await fetch(endpoint, { cache: 'no-store' });
    return r.json();
  }
  async function mount(opts = {}) {
    const o = { endpoint: '/api/visits', ...opts };
    const box = document.createElement('div');
    box.className = 'visit-pill'; box.hidden = true;
    document.body.append(box);
    const me = read(), day = today(), hit = me.day !== day, vid = me.vid || newId();
    try {
      const j = await ask(o.endpoint, hit, vid);
      if (!j || !j.ok || !Number.isFinite(j.total)) { box.remove(); return; }
      if (hit) write({ vid, day });
      box.textContent = `👣 累計 ${j.total.toLocaleString('zh-TW')} 人次・今天 ${Number(j.today || 0).toLocaleString('zh-TW')} 人`;
      box.hidden = false;
    } catch (e) { box.remove(); }
  }
  window.IslandVisits = { mount };
})();
