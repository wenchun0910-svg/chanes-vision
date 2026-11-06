/* 訪客留名面板。訪客文字一律用 textContent 顯示，不用 innerHTML。 */
(function () {
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const rid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  let o, panel, listBox, statusBox, form, requestId = rid(), entries = [], total = 0, last;
  function say(text, bad) { statusBox.textContent = text; statusBox.classList.toggle('bad', !!bad); }
  function draw() {
    listBox.textContent = '';
    if (!entries.length) { listBox.append(el('p', 'gb-empty', '還沒有人留名，你可以當第一位。')); return; }
    entries.forEach(e => {
      const row = el('article', 'gb-row');
      row.append(el('b', null, e.name));
      if (e.message) row.append(el('span', null, e.message));
      row.append(el('small', null, [e.island, new Date(e.at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })].filter(Boolean).join('・')));
      listBox.append(row);
    });
  }
  async function load() {
    try {
      const r = await fetch(o.endpoint, { cache: 'no-store' }), j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.message || 'HTTP ' + r.status);
      entries = j.entries; total = j.total;
      form.elements.message.closest('label').hidden = j.askMessage === false;
      panel.querySelector('.gb-count').textContent = `已有 ${total} 位訪客留名`;
      draw();
      if (o.onEntries) o.onEntries(entries, total);
    } catch (e) {
      panel.querySelector('.gb-count').textContent = '';
      listBox.textContent = '';
      listBox.append(el('p', 'gb-empty', '留名服務暫時連不上，稍後再試。'));
    }
    return entries;
  }
  async function submit(ev) {
    ev.preventDefault();
    const btn = form.querySelector('button[type=submit]'), f = form.elements;
    btn.disabled = true; say('送出中…');
    try {
      /* Google Apps Script 不接受預檢請求，要用 text/plain */
      const gas = /script\.google\.com/.test(o.endpoint);
      const r = await fetch(o.endpoint, { method: 'POST', headers: { 'content-type': gas ? 'text/plain;charset=utf-8' : 'application/json' }, body: JSON.stringify({ name: f.name.value, message: f.message.value, island: f.island ? f.island.value : '', website: f.website.value, requestId }) });
      const j = await r.json();
      if (!r.ok || !j.ok) { say(j.message || '送不出去，請稍後再試', true); return; }
      requestId = rid(); form.reset();
      say(j.status === 'public' ? '留名成功，你的名字已經在島上了。' : '已送出，島主確認後就會出現在島上。');
      await load();
    } catch (e) { say('連不上留名服務，內容還在，可以再按一次。', true); } finally { btn.disabled = false; }
  }
  function open() { last = document.activeElement; panel.hidden = false; load(); form.elements.name.focus(); }
  function close() { panel.hidden = true; if (last && last.focus) last.focus(); }
  function mount(opts) {
    o = { endpoint: '/api/guestbook', title: '到此一遊', islands: [], button: true, ...opts };
    panel = el('section', 'gb-panel'); panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', o.title);
    const head = el('header', 'gb-head'); head.append(el('h2', null, o.title));
    const x = el('button', 'gb-close', '✕'); x.type = 'button'; x.setAttribute('aria-label', '關閉'); x.addEventListener('click', close); head.append(x);
    form = el('form', 'gb-form');
    const field = (label, name, max, ph) => { const l = el('label', null, label), i = el('input'); i.name = name; i.maxLength = max; i.placeholder = ph; i.autocomplete = 'off'; l.append(i); return l; };
    const nameBox = field('暱稱', 'name', 16, '請用暱稱，不要寫本名'); nameBox.querySelector('input').required = true;
    form.append(nameBox, field('想說的話（可不填）', 'message', 60, '最多 60 個字'));
    if (o.islands.length) { const l = el('label', null, '留在哪座島'), s = el('select'); s.name = 'island'; o.islands.forEach(n => s.append(new Option(n, n))); l.append(s); form.append(l); }
    const trap = el('input', 'gb-trap'); trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.setAttribute('aria-hidden', 'true'); form.append(trap);
    form.append(el('p', 'gb-note', '留名會公開給所有訪客看。不要寫本名、電話、地址或學校班級。'));
    const go = el('button', 'gb-send', '留下名字'); go.type = 'submit'; form.append(go);
    statusBox = el('p', 'gb-status'); statusBox.setAttribute('role', 'status'); form.append(statusBox);
    form.addEventListener('submit', submit);
    listBox = el('div', 'gb-list');
    panel.append(head, form, el('p', 'gb-count'), listBox);
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.body.append(panel);
    if (o.button) { const b = el('button', 'gb-open', '✍️ 留名'); b.type = 'button'; b.addEventListener('click', open); document.body.append(b); }
    return load();
  }
  window.IslandGuestbook = { mount, open, close, reload: () => load(), get entries() { return entries; } };
})();
