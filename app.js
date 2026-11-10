/* BP Club — Brownie Points leaderboard with power-ups.
   Everything runs in the browser and is saved to localStorage on the teacher's computer. */
(() => {
  'use strict';

  const STORE_KEY = 'bpclub.v1';
  const UNDO_KEY = 'bpclub.v1.undo';
  const SESSION_KEY = 'bpclub.teacher';
  const DAY = 86400000;
  const MAX_LOG = 400;
  const MAX_UNDO = 15;

  /* ------------------------------------------------------------------ defaults */

  const DEFAULT_POWERUPS = [
    { id: 'rage', name: 'Rage', art: '😤', cost: 8, days: 14, enabled: true,
      desc: (p) => `2× BP for ${p.days} days` },
    { id: 'fireball', name: 'Fireball', art: '🔥', cost: 20, enabled: true,
      desc: () => 'Target earns ½ BP for 1 lesson' },
    { id: 'minus', name: 'Minus Spell', art: '🔮', cost: 15, amount: 8, enabled: true,
      desc: (p) => `Target loses ${fmt(p.amount)} BP` },
    { id: 'wheel', name: 'Wheel of Fortune', art: '🎡', cost: 8, enabled: true,
      desc: () => 'Spin for a random prize or penalty' },
    { id: 'brownie', name: 'The Eternal Brownie', art: '🍫', cost: 40, enabled: true,
      desc: () => 'A brownie baked by your teacher' },
  ];

  const WHEEL_TYPES = {
    gain:     { label: 'Win BP', needsValue: true },
    lose:     { label: 'Lose BP', needsValue: true },
    doublebp: { label: 'Double BP (up to)', needsValue: true },
    question: { label: 'Question (prize)', needsValue: true },
    spin:     { label: 'Spin again', needsValue: false },
    target:   { label: 'Someone else loses BP', needsValue: true },
    steal:    { label: 'Steal BP', needsValue: true },
    rage:     { label: 'Free Rage', needsValue: false },
    nothing:  { label: 'Nothing', needsValue: false },
  };

  const DEFAULT_WHEEL = [
    { label: 'DOUBLE YOUR BP!', type: 'doublebp', value: 25 },
    { label: 'Lose 4 BP', type: 'lose', value: 4 },
    { label: 'Answer a question', type: 'question', value: 10 },
    { label: '+5 BP', type: 'gain', value: 5 },
    { label: 'Spin again', type: 'spin', value: 0 },
    { label: 'Make someone lose 5', type: 'target', value: 5 },
    { label: 'Lose 8 BP', type: 'lose', value: 8 },
    { label: 'Free Rage!', type: 'rage', value: 0 },
    { label: '+12 BP', type: 'gain', value: 12 },
    { label: 'Steal 4 BP', type: 'steal', value: 4 },
    { label: 'Nothing!', type: 'nothing', value: 0 },
    { label: '+8 BP (money back)', type: 'gain', value: 8 },
  ];

  const WHEEL_COLORS = ['#7a3e1d', '#e5b850', '#5b2f17', '#d08a4e', '#3f2414', '#f0d48a', '#8c4a22', '#b8862e'];

  const EXAMPLE_NAMES = ['Amira', 'Ben', 'Chloe', 'Dev', 'Ella', 'Finn', 'Grace', 'Harvey', 'Isla', 'Jamal', 'Kiara', 'Leo'];

  function freshState() {
    return {
      version: 1,
      clubName: 'BP Club',
      pin: '1234',
      pinChanged: false,
      lesson: 1,
      students: [],
      powerups: DEFAULT_POWERUPS.map(({ id, cost, days, amount, enabled }) => ({ id, cost, days, amount, enabled })),
      wheel: DEFAULT_WHEEL.map((s) => ({ ...s })),
      effects: [],
      brownies: [],
      log: [],
    };
  }

  /* ------------------------------------------------------------------ storage */

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function normalise(s) {
    const base = freshState();
    const out = { ...base, ...s };
    // keep power-up list in sync with the built-in set, preserving saved prices
    out.powerups = DEFAULT_POWERUPS.map((d) => {
      const saved = (s.powerups || []).find((p) => p.id === d.id) || {};
      return { id: d.id, cost: num(saved.cost, d.cost), days: num(saved.days, d.days), amount: num(saved.amount, d.amount), enabled: saved.enabled !== false };
    });
    if (!Array.isArray(out.wheel) || !out.wheel.length) out.wheel = DEFAULT_WHEEL.map((x) => ({ ...x }));
    ['students', 'effects', 'brownies', 'log'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
    out.students.forEach((st) => { st.bp = num(st.bp, 0); });
    return out;
  }

  let state = normalise(readJSON(STORE_KEY, freshState()));
  let undoStack = readJSON(UNDO_KEY, []);
  let saveOk = true;

  function save() {
    saveOk = writeJSON(STORE_KEY, state);
    // the undo history is a nice-to-have: drop the oldest steps if storage is full
    while (!writeJSON(UNDO_KEY, undoStack) && undoStack.length) undoStack.shift();
  }

  /** Run a change: snapshot for undo, mutate, save, re-render. */
  function commit(fn) {
    const before = JSON.stringify(state);
    const result = fn();
    if (result === false) return false;
    undoStack.push(before);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    if (state.log.length > MAX_LOG) state.log.length = MAX_LOG;
    save();
    render();
    return result;
  }

  function undo() {
    const prev = undoStack.pop();
    if (!prev) { toast('Nothing to undo'); return; }
    const last = state.log[0];
    state = normalise(JSON.parse(prev));
    save();
    render();
    toast(last ? `Undone: ${last.text}` : 'Undone');
  }

  /* ------------------------------------------------------------------ helpers */

  function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  const $ = (sel) => document.querySelector(sel);

  /** Tiny DOM builder: h('div', {class: 'x', onclick}, child, 'text') */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  /** Format BP, showing halves as ½. */
  function fmt(n) {
    const neg = n < 0;
    const a = Math.abs(n);
    const whole = Math.floor(a + 1e-9);
    const half = a - whole >= 0.25;
    return (neg ? '−' : '') + (whole === 0 && half ? '' : whole) + (half ? '½' : '');
  }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '' : '±') + fmt(n); }
  function roundHalf(n) { return Math.round(n * 2) / 2; }

  function student(id) { return state.students.find((s) => s.id === id); }
  function nameOf(id) { const s = student(id); return s ? s.name : 'someone (removed)'; }
  function pu(id) { return state.powerups.find((p) => p.id === id); }
  function puMeta(id) { return DEFAULT_POWERUPS.find((p) => p.id === id); }

  function log(text, extra) {
    state.log.unshift({ id: uid(), ts: Date.now(), text, ...extra });
  }

  /* ------------------------------------------------------------------ effects */

  function cleanEffects() {
    const now = Date.now();
    const before = state.effects.length;
    state.effects = state.effects.filter((e) =>
      (e.type === 'rage' && e.expiresAt > now) ||
      ((e.type === 'fireball' || e.type === 'minus') && e.lesson >= state.lesson));
    return before !== state.effects.length;
  }
  function rageOf(id) { return state.effects.find((e) => e.type === 'rage' && e.studentId === id && e.expiresAt > Date.now()); }
  function fireballOf(id) { return state.effects.find((e) => e.type === 'fireball' && e.studentId === id && e.lesson === state.lesson); }
  function fireballPending(id) { return state.effects.find((e) => e.type === 'fireball' && e.studentId === id && e.lesson > state.lesson); }
  function multiplier(id) { return (rageOf(id) ? 2 : 1) * (fireballOf(id) ? 0.5 : 1); }
  function minusHits(id) { return state.effects.filter((e) => e.type === 'minus' && e.studentId === id && e.lesson === state.lesson); }
  function browniesOwed(id) { return state.brownies.filter((b) => !b.done && b.studentId === id).length; }

  /** Words for whatever is changing this student's earnings right now. */
  function boostNote(id) {
    const r = rageOf(id), f = fireballOf(id);
    if (r && f) return 'Rage ×2 + Fireball ½';
    if (r) return 'Rage ×2';
    if (f) return 'Fireball ½';
    return '';
  }

  /** Apply Rage / Fireball to BP being earned. Every gain goes through here. */
  function boosted(id, amount) {
    if (amount <= 0) return { delta: amount, note: '' };
    const note = boostNote(id);
    return { delta: roundHalf(amount * multiplier(id)), note: note ? ` (${note})` : '' };
  }

  function fmtDate(ts) { return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); }
  function daysLeft(ts) { return Math.max(1, Math.ceil((ts - Date.now()) / DAY)); }

  function effectBadges(id) {
    const out = [];
    const r = rageOf(id);
    if (r) out.push(h('span', { class: 'fx rage', title: `Rage: earns 2× BP until ${fmtDate(r.expiresAt)}` }, `😤 ×2 · ${daysLeft(r.expiresAt)}d`));
    const f = fireballOf(id);
    if (f) out.push(h('span', { class: 'fx fire', title: `Fireball from ${nameOf(f.by)}: earns ½ BP this lesson` }, '🔥 ½ BP'));
    const fp = fireballPending(id);
    if (fp) out.push(h('span', { class: 'fx fire pending', title: `Fireball from ${nameOf(fp.by)}: earns ½ BP next lesson` }, '🔥 next lesson'));
    minusHits(id).forEach((m) => out.push(h('span', { class: 'fx minus', title: `Minus Spell from ${nameOf(m.by)}` }, `🔮 −${fmt(m.amount)}`)));
    const owed = browniesOwed(id);
    if (owed) out.push(h('span', { class: 'fx brownie', title: 'Eternal Brownie owed' }, `🍫 owed${owed > 1 ? ' ×' + owed : ''}`));
    return out.length ? h('span', { class: 'fx-wrap' }, out) : null;
  }

  function grantRage(id, reasonText) {
    const p = pu('rage');
    const existing = rageOf(id);
    if (existing) existing.expiresAt += p.days * DAY;
    else state.effects.push({ id: uid(), type: 'rage', studentId: id, expiresAt: Date.now() + p.days * DAY });
    log(`${nameOf(id)} ${reasonText} — 2× BP ${existing ? 'extended' : 'for ' + p.days + ' days'}`, { kind: 'power' });
  }

  /* ------------------------------------------------------------------ ranking */

  const TITLES = [
    { key: 'king', name: 'King' },
    { key: 'lord', name: 'Lord' },
    { key: 'knight', name: 'Knight' },
  ];

  /** Competition ranking (ties share a place). Titles need at least some BP. */
  function ranked() {
    const list = [...state.students].sort((a, b) => b.bp - a.bp || a.name.localeCompare(b.name));
    let lastBp = null, lastRank = 0;
    return list.map((s, i) => {
      const rank = s.bp === lastBp ? lastRank : i + 1;
      lastBp = s.bp; lastRank = rank;
      const t = s.bp > 0 && rank <= 3 ? TITLES[rank - 1] : { key: 'subject', name: 'Subject' };
      return { s, rank, title: t };
    });
  }

  /* ------------------------------------------------------------------ core actions */

  /** Award (or deduct) BP. Positive awards use Rage/Fireball multipliers. */
  function award(ids, amount, reason) {
    if (!ids.length || !amount) return;
    commit(() => {
      const parts = [];
      ids.forEach((id) => {
        const s = student(id);
        if (!s) return;
        let { delta, note } = boosted(id, amount);
        if (amount < 0) delta = Math.max(amount, -s.bp);
        s.bp = roundHalf(s.bp + delta);
        flash.add(id);
        log(`${s.name} ${delta >= 0 ? 'earned' : 'lost'} ${fmt(Math.abs(delta))} BP${note}${reason ? ' — ' + reason : ''}`, { kind: delta >= 0 ? 'up' : 'down', delta });
        parts.push({ text: `${s.name} ${signed(delta)}${note}`, boosted: !!note });
      });
      // For big groups, name only the students whose total was changed by a power-up.
      const many = parts.length > 3;
      const shown = (many ? parts.filter((x) => x.boosted) : parts).map((x) => x.text).join(', ');
      toast([many ? `${signed(amount)} BP to ${parts.length} students` : '', shown].filter(Boolean).join(' · '));
    });
  }

  function buy(buyerId, powerId, opts = {}) {
    const p = pu(powerId);
    const meta = puMeta(powerId);
    const buyer = student(buyerId);
    if (!buyer || !p) return false;
    if (buyer.bp < p.cost) { toast(`${buyer.name} needs ${fmt(p.cost)} BP but has ${fmt(buyer.bp)}`); return false; }
    return commit(() => {
      buyer.bp = roundHalf(buyer.bp - p.cost);
      flash.add(buyerId);
      const paid = `bought ${meta.name} for ${fmt(p.cost)} BP`;
      switch (powerId) {
        case 'rage':
          grantRage(buyerId, paid);
          toast(`😤 ${buyer.name} is raging: 2× BP!`);
          break;
        case 'fireball': {
          const target = student(opts.targetId);
          const lesson = opts.when === 'next' ? state.lesson + 1 : state.lesson;
          state.effects.push({ id: uid(), type: 'fireball', studentId: target.id, by: buyerId, lesson });
          flash.add(target.id);
          log(`${buyer.name} ${paid} and hit ${target.name} — ½ BP ${lesson === state.lesson ? 'this lesson' : 'next lesson'}`, { kind: 'power' });
          toast(`🔥 ${target.name} got fireballed!`);
          break;
        }
        case 'minus': {
          const target = student(opts.targetId);
          const lost = Math.min(p.amount, target.bp);
          target.bp = roundHalf(target.bp - lost);
          state.effects.push({ id: uid(), type: 'minus', studentId: target.id, by: buyerId, amount: lost, lesson: state.lesson });
          flash.add(target.id);
          log(`${buyer.name} ${paid} on ${target.name}, who lost ${fmt(lost)} BP`, { kind: 'power', delta: -lost });
          toast(`🔮 ${target.name} loses ${fmt(lost)} BP`);
          break;
        }
        case 'wheel':
          log(`${buyer.name} ${paid}`, { kind: 'power' });
          break;
        case 'brownie':
          state.brownies.push({ id: uid(), studentId: buyerId, name: buyer.name, ts: Date.now(), done: false });
          log(`${buyer.name} ${paid}! 🍫`, { kind: 'power' });
          toast(`🍫 ${buyer.name} bought the Eternal Brownie!`);
          break;
      }
      return true;
    });
  }

  function endLesson() {
    commit(() => {
      const ending = state.lesson;
      const fireballed = state.effects.filter((e) => e.type === 'fireball' && e.lesson === ending).map((e) => nameOf(e.studentId));
      state.lesson += 1;
      cleanEffects();
      log(`Lesson ${ending} ended${fireballed.length ? ` — Fireball wore off for ${fireballed.join(', ')}` : ''}`, { kind: 'lesson' });
      toast(`Lesson ${state.lesson} started`);
    });
  }

  /* ------------------------------------------------------------------ teacher mode */

  let teacher = (() => { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; } })();

  function setTeacher(on) {
    teacher = on;
    try { on ? sessionStorage.setItem(SESSION_KEY, '1') : sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    if (!on && document.querySelector('.tab.active.teacher-only')) showTab('board');
    render();
  }

  function askPin() {
    const input = h('input', { id: 'pinInput', class: 'pin-input', type: 'password', inputmode: 'numeric', autocomplete: 'current-password', 'aria-label': 'Teacher PIN' });
    const err = h('p', { class: 'error', hidden: true }, 'Wrong PIN');
    const tryIt = () => {
      if (input.value === String(state.pin)) { closeModal(); setTeacher(true); }
      else { err.hidden = false; input.select(); }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryIt(); });
    openModal({
      title: 'Teacher login',
      body: [input, err],
      actions: [{ label: 'Cancel' }, { label: 'Log in', kind: 'gold', keep: true, onClick: tryIt }],
      focus: input,
    });
  }

  /* ------------------------------------------------------------------ modal & toast */

  let modalOnClose = null;
  function openModal({ title, body, actions = [], wide = false, focus, closable = true, onClose }) {
    $('#modalTitle').textContent = title;
    const b = $('#modalBody'); b.replaceChildren(...[].concat(body).filter(Boolean));
    const a = $('#modalActions'); a.replaceChildren();
    actions.forEach((act) => {
      const btn = h('button', { type: 'button', class: `btn ${act.kind || 'ghost'}`, id: act.id, disabled: act.disabled }, act.label);
      btn.addEventListener('click', () => { if (act.onClick) act.onClick(btn); if (!act.keep) closeModal(); });
      a.append(btn);
    });
    $('#modal').querySelector('.modal').classList.toggle('wide', wide);
    $('#modalClose').hidden = !closable;
    $('#modal').dataset.closable = closable ? '1' : '';
    modalOnClose = onClose || null;
    $('#modal').hidden = false;
    setTimeout(() => (focus || a.querySelector('.btn.gold') || a.lastElementChild || $('#modalClose')).focus?.(), 30);
  }
  function closeModal() {
    $('#modal').hidden = true;
    const cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
  }
  function confirmBox(title, message, okLabel, onOk, danger) {
    openModal({ title, body: message ? h('p', null, message) : null, actions: [{ label: 'Cancel' }, { label: okLabel, kind: danger ? 'danger' : 'gold', onClick: onOk }] });
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  /* ------------------------------------------------------------------ rendering */

  const flash = new Set();

  function render() {
    if (cleanEffects()) save();
    document.body.classList.toggle('teacher', teacher);
    $('#clubName').textContent = state.clubName;
    document.title = state.clubName;
    $('#lockBtn').textContent = teacher ? 'Lock' : 'Teacher login';
    const pending = state.brownies.filter((b) => !b.done).length;
    $('#brownieCount').hidden = !pending;
    $('#brownieCount').textContent = pending;

    renderBoard();
    renderShop();
    renderHistory();
    if (teacher) {
      renderAward();
      renderStudents();
      renderSettings();
    }
    flash.clear();
  }

  function emblem(key) {
    const colors = { king: ['var(--gold-hi)', 'var(--gold)', 'var(--gold-deep)'], lord: ['#fff', 'var(--silver)', 'var(--silver-deep)'], knight: ['#f3c095', 'var(--bronze)', 'var(--bronze-deep)'] }[key];
    const [hi, mid, deep] = colors;
    const svgs = {
      // crown
      king: `<path d="M8 26 L20 38 L32 12 L44 38 L56 26 L51 50 H13 Z" fill="${mid}" stroke="${deep}" stroke-width="2.5" stroke-linejoin="round"/><rect x="13" y="50" width="38" height="7" rx="2" fill="${deep}"/><circle cx="32" cy="12" r="4.5" fill="${hi}"/><circle cx="8" cy="26" r="4" fill="${hi}"/><circle cx="56" cy="26" r="4" fill="${hi}"/><circle cx="32" cy="40" r="4" fill="#c0392b"/>`,
      // coronet / lord's cap
      lord: `<path d="M12 46 C12 28 20 18 32 18 C44 18 52 28 52 46 Z" fill="#6b2a3a" stroke="${deep}" stroke-width="2"/><rect x="9" y="44" width="46" height="10" rx="3" fill="${mid}" stroke="${deep}" stroke-width="2"/><circle cx="20" cy="49" r="2.5" fill="${hi}"/><circle cx="32" cy="49" r="2.5" fill="${hi}"/><circle cx="44" cy="49" r="2.5" fill="${hi}"/><circle cx="32" cy="15" r="4" fill="${mid}" stroke="${deep}" stroke-width="2"/>`,
      // shield and sword
      knight: `<path d="M32 8 L52 15 V32 C52 45 43 53 32 58 C21 53 12 45 12 32 V15 Z" fill="${mid}" stroke="${deep}" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 16 V50 M22 30 H42" stroke="${deep}" stroke-width="5" stroke-linecap="round"/>`,
    };
    return h('span', { class: 'emblem-wrap', 'aria-hidden': 'true', html: `<svg class="emblem" viewBox="0 0 64 64">${svgs[key]}</svg>` });
  }

  function quickButtons(id) {
    const plus = (n) => {
      const { delta, note } = boosted(id, n);
      return h('button', { type: 'button', class: `btn small amt plus${delta !== n ? ' boosted' : ''}`, title: delta !== n ? `Gives +${fmt(delta)}${note}` : `Give ${n} BP`, onclick: () => award([id], n, '') },
        `+${n}`, delta !== n ? h('small', null, `=${fmt(delta)}`) : null);
    };
    return h('span', { class: 'quick' }, plus(1), plus(5),
      h('button', { type: 'button', class: 'btn small amt minus', title: 'Take 1 BP', onclick: () => award([id], -1, '') }, '−1'));
  }

  function renderBoard() {
    const r = ranked();
    const empty = r.length === 0;
    $('#boardEmpty').hidden = !empty;
    $('#podium').hidden = empty;
    const places = [
      { cls: 'p1', key: 'king', name: 'King' },
      { cls: 'p2', key: 'lord', name: 'Lord' },
      { cls: 'p3', key: 'knight', name: 'Knight' },
    ];
    $('#podium').replaceChildren(...places.map((p, i) => {
      const entry = r[i];
      if (!entry || entry.title.key === 'subject') {
        return h('div', { class: `pod ${p.cls} ${p.key} vacant` },
          emblem(p.key), h('span', { class: 'title' }, p.name), h('span', { class: 'name muted' }, '—'));
      }
      const { s, title } = entry;
      return h('div', { class: `pod ${p.cls} ${title.key}${flash.has(s.id) ? ' bump' : ''}` },
        emblem(title.key),
        h('span', { class: 'title' }, title.name),
        h('span', { class: 'name' }, s.name),
        h('span', { class: 'bp' }, fmt(s.bp), h('small', null, 'BP')),
        effectBadges(s.id),
        quickButtons(s.id));
    }));

    const rest = r.filter((e, i) => i >= 3 || e.title.key === 'subject');
    $('#boardCard').hidden = rest.length === 0;
    $('#board').replaceChildren(...rest.map(({ s, rank, title }) =>
      h('li', { class: `row${flash.has(s.id) ? ' bump' : ''}` },
        h('span', { class: 'rank' }, rank),
        h('span', { class: 'rname' }, s.name,
          title.key !== 'subject' ? h('span', { class: `title-tag t-${title.key}` }, title.name) : null,
          effectBadges(s.id)),
        h('span', { class: 'rbp' }, fmt(s.bp), h('small', null, 'BP')),
        quickButtons(s.id))));
  }

  /* ---- Give BP tab */
  const selected = new Set();
  const PLUS = [1, 2, 3, 5, 10];
  const MINUS = [1, 2, 3, 5, 10];

  function renderAward() {
    [...selected].forEach((id) => { if (!student(id)) selected.delete(id); });
    const list = [...state.students].sort((a, b) => a.name.localeCompare(b.name));
    $('#awardChips').replaceChildren(...(list.length ? list.map((s) =>
      h('button', { type: 'button', class: 'chip', 'aria-pressed': selected.has(s.id) ? 'true' : 'false',
        onclick: () => { selected.has(s.id) ? selected.delete(s.id) : selected.add(s.id); renderAward(); } },
        s.name,
        rageOf(s.id) ? h('span', { class: 'tag rage', title: 'Rage: earns double' }, '×2') : null,
        fireballOf(s.id) ? h('span', { class: 'tag fire', title: 'Fireball: earns half this lesson' }, '½') : null,
        h('span', { class: 'cbp' }, fmt(s.bp)))) : [h('p', { class: 'muted' }, 'No students yet.')]));
    $('#selCount').textContent = selected.size ? `· ${selected.size}` : '';
    const disabled = selected.size === 0;
    document.querySelectorAll('#plusAmounts button, #minusAmounts button, #customForm button').forEach((b) => { b.disabled = disabled; });
  }

  function buildAmountButtons() {
    $('#plusAmounts').replaceChildren(...PLUS.map((n) => h('button', { type: 'button', class: 'btn amt plus', onclick: () => award([...selected], n, $('#awardReason').value.trim()) }, `+${n}`)));
    $('#minusAmounts').replaceChildren(...MINUS.map((n) => h('button', { type: 'button', class: 'btn amt minus', onclick: () => award([...selected], -n, $('#awardReason').value.trim()) }, `−${n}`)));
  }

  /* ---- Power-ups (plus the brownies still owed) */
  function renderShop() {
    $('#shop').replaceChildren(...DEFAULT_POWERUPS.map((meta) => {
      const p = pu(meta.id);
      return h('article', { class: `card item${p.enabled ? '' : ' off'}` },
        h('div', { class: 'item-head' },
          h('span', { class: 'art', 'aria-hidden': 'true' }, meta.art),
          h('h3', null, meta.name),
          h('span', { class: 'price' }, `${fmt(p.cost)} BP`)),
        h('p', null, p.enabled ? meta.desc(p) : 'Not available'),
        teacher && p.enabled ? h('button', { type: 'button', class: 'btn gold', onclick: () => openBuy(meta.id) }, meta.id === 'wheel' ? 'Buy a spin' : 'Buy') : null);
    }));

    const pending = state.brownies.filter((b) => !b.done).sort((a, b) => a.ts - b.ts);
    $('#brownieCard').hidden = pending.length === 0;
    $('#browniePending').replaceChildren(...pending.map((b) => {
      const who = student(b.studentId)?.name || b.name;
      return h('li', null,
        h('span', null, h('b', null, who), h('span', { class: 'muted' }, ` · ${fmtDate(b.ts)}`)),
        h('button', { type: 'button', class: 'btn small gold', onclick: () => commit(() => { b.done = true; b.doneTs = Date.now(); log(`🍫 Brownie handed to ${who}`, { kind: 'power' }); }) }, 'Handed over'));
    }));
  }

  function studentSelect(id, opts = {}) {
    const list = [...state.students].sort((a, b) => a.name.localeCompare(b.name)).filter((s) => !opts.exclude || s.id !== opts.exclude);
    return h('select', { id },
      h('option', { value: '' }, opts.placeholder || 'Choose a student'),
      list.map((s) => h('option', { value: s.id, disabled: opts.minBp != null && s.bp < opts.minBp }, `${s.name} — ${fmt(s.bp)} BP${opts.minBp != null && s.bp < opts.minBp ? ' (not enough)' : ''}`)));
  }

  function openBuy(powerId) {
    const meta = puMeta(powerId);
    const p = pu(powerId);
    if (!state.students.length) { toast('Add students first'); return; }
    const needsTarget = powerId === 'fireball' || powerId === 'minus';
    const buyerSel = studentSelect('buyBuyer', { minBp: p.cost, placeholder: 'Pick a buyer' });
    const targetWrap = h('div', { class: 'field' });
    const err = h('p', { class: 'error', hidden: true });
    let whenNow = true;
    const when = powerId === 'fireball' ? h('div', { class: 'field' }, h('span', null, 'When'),
      h('div', { class: 'radio-row' },
        h('label', null, h('input', { type: 'radio', name: 'fbWhen', value: 'now', checked: true, onchange: () => { whenNow = true; } }), 'This lesson'),
        h('label', null, h('input', { type: 'radio', name: 'fbWhen', value: 'next', onchange: () => { whenNow = false; } }), 'Next lesson'))) : null;

    const fillTarget = () => {
      if (!needsTarget) return;
      targetWrap.replaceChildren(h('span', null, 'Target'),
        studentSelect('buyTarget', { exclude: buyerSel.value, placeholder: 'Pick a target' }));
    };
    buyerSel.addEventListener('change', fillTarget);
    fillTarget();

    openModal({
      title: `${meta.art} ${meta.name} · ${fmt(p.cost)} BP`,
      body: [
        h('label', { class: 'field' }, h('span', null, 'Buyer'), buyerSel),
        needsTarget ? targetWrap : null,
        when,
        err,
      ],
      actions: [{ label: 'Cancel' }, {
        label: powerId === 'wheel' ? 'Pay & spin' : 'Buy', kind: 'gold', keep: true,
        onClick: () => {
          const buyerId = buyerSel.value;
          const targetId = needsTarget ? $('#buyTarget').value : null;
          if (!buyerId) { err.textContent = 'Pick a buyer'; err.hidden = false; return; }
          if (needsTarget && !targetId) { err.textContent = 'Pick a target'; err.hidden = false; return; }
          const ok = buy(buyerId, powerId, { targetId, when: whenNow ? 'now' : 'next' });
          if (!ok) return;
          closeModal();
          if (powerId === 'wheel') setTimeout(() => openWheel(buyerId), 60);
        },
      }],
    });
  }

  /* ---- Wheel of Fortune */
  let wheelRotation = 0;

  function drawWheel(canvas, slices) {
    const size = 840;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2, r = c - 10;
    const seg = (Math.PI * 2) / slices.length;
    ctx.clearRect(0, 0, size, size);
    slices.forEach((s, i) => {
      const a0 = -Math.PI / 2 + i * seg;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, r, a0, a0 + seg); ctx.closePath();
      const col = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = '#2a1a08'; ctx.lineWidth = 4; ctx.stroke();
      ctx.save();
      ctx.translate(c, c); ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const light = ['#e5b850', '#f0d48a', '#d08a4e', '#b8862e'].includes(col);
      ctx.fillStyle = light ? '#2a1a08' : '#f4e8d6';
      let fs = slices.length > 14 ? 24 : 30;
      ctx.font = `800 ${fs}px "Alegreya Sans", sans-serif`;
      let text = s.label;
      while (ctx.measureText(text).width > r * 0.68 && fs > 16) { fs -= 2; ctx.font = `800 ${fs}px "Alegreya Sans", sans-serif`; }
      while (ctx.measureText(text).width > r * 0.68 && text.length > 4) text = text.slice(0, -2) + '…';
      ctx.fillText(text, r - 26, 0);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.lineWidth = 12; ctx.strokeStyle = '#9a6e1c'; ctx.stroke();
    for (let i = 0; i < slices.length; i++) {
      const a = -Math.PI / 2 + i * seg;
      ctx.beginPath(); ctx.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 7, 0, Math.PI * 2); ctx.fillStyle = '#ffe39a'; ctx.fill();
    }
  }

  function openWheel(spinnerId) {
    const slices = state.wheel.filter((s) => s.label);
    const canvas = h('canvas', { 'aria-label': 'Wheel of Fortune' });
    const stage = h('div', { class: 'wheel-stage' }, h('div', { class: 'wheel-pointer' }), canvas, h('div', { class: 'wheel-hub' }));
    const result = h('div', { class: 'wheel-result', 'aria-live': 'polite' });
    const spinBtn = h('button', { type: 'button', class: 'btn gold', id: 'spinBtn' }, 'Spin');
    result.append(spinBtn);
    canvas.style.transition = 'none';
    canvas.style.transform = `rotate(${wheelRotation}deg)`;
    drawWheel(canvas, slices);

    const finish = (text) => {
      $('#modalClose').hidden = false;
      $('#modal').dataset.closable = '1';
      result.replaceChildren(h('p', { class: 'big' }, text), h('button', { type: 'button', class: 'btn gold', onclick: closeModal }, 'Done'));
    };

    const spin = () => {
      spinBtn.disabled = true;
      const n = slices.length;
      const segDeg = 360 / n;
      const idx = Math.floor(Math.random() * n);
      const jitter = (Math.random() - 0.5) * segDeg * 0.7;
      const target = ((360 - (idx + 0.5) * segDeg + jitter) % 360 + 360) % 360;
      const current = ((wheelRotation % 360) + 360) % 360;
      wheelRotation += 360 * 6 + ((target - current + 360) % 360);
      canvas.style.transition = '';
      void canvas.offsetWidth;
      canvas.style.transform = `rotate(${wheelRotation}deg)`;
      let done = false;
      const land = () => { if (done) return; done = true; applySlice(spinnerId, slices[idx], result, finish, spin); };
      canvas.addEventListener('transitionend', land, { once: true });
      setTimeout(land, 5200);
    };
    spinBtn.addEventListener('click', spin);

    openModal({
      title: `🎡 Wheel of Fortune · ${nameOf(spinnerId)}`,
      body: [stage, result],
      wide: true,
      closable: false,
    });
  }

  function applySlice(spinnerId, slice, result, finish, spinAgain) {
    const s = student(spinnerId);
    const v = num(slice.value, 0);
    const header = h('p', { class: 'big' }, slice.label);
    const name = s ? s.name : 'Spinner';
    const change = (id, delta, text) => {
      const st = student(id); if (!st) return 0;
      const real = delta < 0 ? -Math.min(-delta, st.bp) : delta;
      st.bp = roundHalf(st.bp + real);
      flash.add(id);
      log(text.replace('{n}', fmt(Math.abs(real))), { kind: real >= 0 ? 'up' : 'down', delta: real });
      return real;
    };

    switch (slice.type) {
      case 'gain': {
        const { delta, note } = boosted(spinnerId, v);
        commit(() => change(spinnerId, delta, `🎡 ${name} won {n} BP on the wheel${note}`));
        finish(`${slice.label} — ${name} +${fmt(delta)} BP${note}`);
        break;
      }
      case 'lose': {
        let lost = 0;
        commit(() => { lost = change(spinnerId, -v, `🎡 ${name} lost {n} BP on the wheel`); });
        finish(`${slice.label} — ${name} ${signed(lost)} BP`);
        break;
      }
      case 'doublebp': {
        const win = Math.min(s.bp, v || Infinity);
        commit(() => change(spinnerId, win, `🎡 ${name} doubled up on the wheel: +{n} BP`));
        finish(win > 0 ? `${name} doubles up: +${fmt(win)} BP!` : `${name} had 0 BP to double. Unlucky!`);
        break;
      }
      case 'spin':
        commit(() => log(`🎡 ${name} landed on "${slice.label}" — free spin`, { kind: 'power' }));
        result.replaceChildren(header, h('button', { type: 'button', class: 'btn gold', onclick: spinAgain }, 'Spin again'));
        break;
      case 'rage':
        commit(() => grantRage(spinnerId, 'won a free Rage on the wheel'));
        finish(`${name} wins a free Rage: 2× BP!`);
        break;
      case 'nothing':
        commit(() => log(`🎡 ${name} landed on "${slice.label}" — nothing happens`, { kind: 'power' }));
        finish('Nothing happens');
        break;
      case 'question':
        result.replaceChildren(header,
          h('p', null, `Ask ${name} a question. Correct: +${fmt(boosted(spinnerId, v).delta)} BP${boosted(spinnerId, v).note}`),
          h('div', { class: 'btn-row' },
            h('button', { type: 'button', class: 'btn good', onclick: () => { const { delta, note } = boosted(spinnerId, v); commit(() => change(spinnerId, delta, `🎡 ${name} answered the wheel question correctly: +{n} BP${note}`)); finish(`Correct! ${name} +${fmt(delta)} BP${note}`); } }, 'Correct'),
            h('button', { type: 'button', class: 'btn danger', onclick: () => { commit(() => log(`🎡 ${name} got the wheel question wrong`, { kind: 'power' })); finish('Wrong answer'); } }, 'Wrong')));
        break;
      case 'target':
      case 'steal': {
        const sel = studentSelect('wheelTarget', { exclude: spinnerId, placeholder: 'Pick someone' });
        const go = h('button', { type: 'button', class: 'btn gold', onclick: () => {
          if (!sel.value) { toast('Pick someone first'); return; }
          const victim = nameOf(sel.value);
          if (slice.type === 'target') {
            let lost = 0;
            commit(() => { lost = change(sel.value, -v, `🎡 ${name} spun the wheel and made ${victim} lose {n} BP`); });
            finish(`${victim} loses ${fmt(-lost)} BP!`);
          } else {
            let taken = 0;
            commit(() => {
              taken = -change(sel.value, -v, `🎡 ${name} stole {n} BP from ${victim}`);
              const st = student(spinnerId); if (st) { st.bp = roundHalf(st.bp + taken); flash.add(spinnerId); }
            });
            finish(`${name} steals ${fmt(taken)} BP from ${victim}!`);
          }
        } }, slice.type === 'target' ? `−${fmt(v)} BP` : 'Steal');
        result.replaceChildren(header,
          h('div', { class: 'inline-form' }, sel, go),
          h('button', { type: 'button', class: 'btn small ghost', onclick: () => { commit(() => log(`🎡 ${name} landed on "${slice.label}" but nobody was picked`, { kind: 'power' })); finish('Skipped'); } }, 'Skip'));
        break;
      }
      default:
        finish(slice.label);
    }
  }

  /* ---- Students */
  function renderStudents() {
    const list = [...state.students].sort((a, b) => a.name.localeCompare(b.name));
    $('#studentTotal').textContent = list.length ? `· ${list.length}` : '';
    $('#studentRows').replaceChildren(...(list.length ? list.map((s) => h('tr', null,
      h('td', null, h('input', { type: 'text', id: `name-${s.id}`, value: s.name, 'aria-label': `Name for ${s.name}`,
        onchange: (e) => { const v = e.target.value.trim(); if (!v || v === s.name) { e.target.value = s.name; return; } commit(() => { log(`${s.name} renamed to ${v}`, { kind: 'admin' }); s.name = v; }); } })),
      h('td', { class: 'num' }, h('input', { type: 'number', step: '0.5', min: '0', id: `bp-${s.id}`, value: s.bp, 'aria-label': `BP for ${s.name}`,
        onchange: (e) => { const v = Math.max(0, roundHalf(num(e.target.value, s.bp))); if (v === s.bp) return; commit(() => { log(`${s.name}'s BP set to ${fmt(v)} (was ${fmt(s.bp)})`, { kind: 'admin' }); s.bp = v; }); } })),
      h('td', { class: 'num' }, h('button', { type: 'button', class: 'btn small ghost', onclick: () => confirmBox('Remove student?', `Remove ${s.name} and their ${fmt(s.bp)} BP from the club?`, 'Remove', () => commit(() => {
        state.students = state.students.filter((x) => x.id !== s.id);
        state.effects = state.effects.filter((e) => e.studentId !== s.id);
        log(`${s.name} was removed from the club`, { kind: 'admin' });
      }), true) }, 'Remove'))))
      : [h('tr', null, h('td', { colspan: '3', class: 'muted' }, 'No students yet.'))]));
  }

  /* ---- History */
  function renderHistory() {
    const items = state.log.slice(0, 200);
    $('#log').replaceChildren(...(items.length ? items.map((l) => h('li', null,
      h('time', { datetime: new Date(l.ts).toISOString() }, new Date(l.ts).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
      h('span', null, l.text),
      l.delta ? h('span', { class: `delta ${l.delta > 0 ? 'up' : 'down'}` }, signed(l.delta)) : h('span')))
      : [h('li', { class: 'muted' }, h('span'), h('span', null, 'Nothing yet.'), h('span'))]));
    $('#undoBtn').disabled = undoStack.length === 0;
  }

  /* ---- Settings */
  function renderSettings() {
    const nameInput = $('#setName');
    if (document.activeElement !== nameInput) nameInput.value = state.clubName;

    const numInput = (id, value, min, step, label, apply) =>
      h('input', { type: 'number', id, min, step, value, 'aria-label': label, onchange: (e) => apply(e.target.value) });
    $('#setPowerups').replaceChildren(...DEFAULT_POWERUPS.flatMap((meta) => {
      const p = pu(meta.id);
      const rows = [h('tr', null,
        h('td', null, `${meta.art} ${meta.name}`),
        h('td', { class: 'num' }, numInput(`cost-${meta.id}`, p.cost, '0', '0.5', `${meta.name} price`, (val) => {
          const v = Math.max(0, roundHalf(num(val, p.cost)));
          commit(() => { log(`${meta.name} price changed to ${fmt(v)} BP`, { kind: 'admin' }); p.cost = v; });
        })),
        h('td', { class: 'num' }, h('input', { type: 'checkbox', id: `on-${meta.id}`, checked: p.enabled, 'aria-label': `${meta.name} available`,
          onchange: (e) => commit(() => { p.enabled = e.target.checked; log(`${meta.name} ${p.enabled ? 'switched on' : 'switched off'}`, { kind: 'admin' }); }) })))];
      if (meta.id === 'rage') rows.push(h('tr', { class: 'sub' }, h('td', null, 'Days'),
        h('td', { class: 'num' }, numInput('rage-days', p.days, '1', '1', 'Rage length in days', (val) => {
          const v = Math.max(1, Math.round(num(val, p.days)));
          commit(() => { p.days = v; log(`Rage now lasts ${v} days`, { kind: 'admin' }); });
        })), h('td')));
      if (meta.id === 'minus') rows.push(h('tr', { class: 'sub' }, h('td', null, 'BP taken'),
        h('td', { class: 'num' }, numInput('minus-amt', p.amount, '0', '0.5', 'Minus Spell amount', (val) => {
          const v = Math.max(0, roundHalf(num(val, p.amount)));
          commit(() => { p.amount = v; log(`Minus Spell now takes ${fmt(v)} BP`, { kind: 'admin' }); });
        })), h('td')));
      return rows;
    }));

    $('#wheelRows').replaceChildren(...state.wheel.map((sl, i) => h('tr', null,
      h('td', null, h('input', { type: 'text', id: `wl-${i}`, value: sl.label, maxlength: '28', 'aria-label': 'Slice label', onchange: (e) => commit(() => { sl.label = e.target.value.trim() || 'Slice'; }) })),
      h('td', null, h('select', { id: `wt-${i}`, 'aria-label': 'What happens', onchange: (e) => commit(() => { sl.type = e.target.value; }) },
        Object.entries(WHEEL_TYPES).map(([k, t]) => h('option', { value: k, selected: sl.type === k }, t.label)))),
      h('td', { class: 'num' }, WHEEL_TYPES[sl.type]?.needsValue
        ? h('input', { type: 'number', id: `wv-${i}`, min: '0', step: '0.5', value: sl.value, 'aria-label': 'Amount', onchange: (e) => commit(() => { sl.value = Math.max(0, roundHalf(num(e.target.value, sl.value))); }) })
        : h('span', { class: 'muted' }, '—')),
      h('td', { class: 'num' }, h('button', { type: 'button', class: 'btn small ghost', disabled: state.wheel.length <= 2, onclick: () => commit(() => { state.wheel.splice(i, 1); }) }, 'Remove')))));
  }

  /* ------------------------------------------------------------------ tabs */

  function showTab(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${name}`));
    try { sessionStorage.setItem('bpclub.tab', name); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ example class */

  function loadExample() {
    commit(() => {
      const pts = [34, 27, 22, 19, 15, 12, 11, 9, 7, 5, 3, 0];
      state.students = EXAMPLE_NAMES.map((n, i) => ({ id: uid(), name: n, bp: pts[i], createdAt: Date.now() }));
      state.effects.push({ id: uid(), type: 'rage', studentId: state.students[1].id, expiresAt: Date.now() + 9 * DAY });
      state.effects.push({ id: uid(), type: 'fireball', studentId: state.students[0].id, by: state.students[3].id, lesson: state.lesson });
      log('Example class loaded', { kind: 'admin' });
    });
  }

  /* ------------------------------------------------------------------ wiring */

  function wire() {
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

    $('#lockBtn').addEventListener('click', () => { if (teacher) setTeacher(false); else askPin(); });
    $('#endLessonBtn').addEventListener('click', () => {
      const fb = state.effects.filter((e) => e.type === 'fireball' && e.lesson === state.lesson).map((e) => nameOf(e.studentId));
      confirmBox(`End lesson ${state.lesson}?`, fb.length ? `Fireball wears off for ${fb.join(', ')}.` : '', 'End lesson', endLesson);
    });
    $('#emptyAdd').addEventListener('click', () => showTab('students'));
    $('#emptyExample').addEventListener('click', loadExample);

    $('#modalClose').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && $('#modal').dataset.closable) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#modal').hidden && $('#modal').dataset.closable) closeModal();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && teacher && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); undo(); }
    });

    // Give BP
    buildAmountButtons();
    $('#selAll').addEventListener('click', () => { state.students.forEach((s) => selected.add(s.id)); renderAward(); });
    $('#selNone').addEventListener('click', () => { selected.clear(); renderAward(); });
    $('#customForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = roundHalf(num($('#customAmount').value, 0));
      if (!v) { toast('Type an amount first'); return; }
      award([...selected], v, $('#awardReason').value.trim());
      $('#customAmount').value = '';
    });

    // Students
    $('#addForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const names = $('#addNames').value.split(/[\n,;\t]+/).map((s) => s.trim()).filter(Boolean);
      if (!names.length) { toast('Type at least one name'); return; }
      const existing = new Set(state.students.map((s) => s.name.toLowerCase()));
      const fresh = [...new Set(names)].filter((n) => !existing.has(n.toLowerCase()));
      if (!fresh.length) { toast('Those names are already in the club'); return; }
      commit(() => {
        fresh.forEach((n) => state.students.push({ id: uid(), name: n.slice(0, 40), bp: 0, createdAt: Date.now() }));
        log(`Added ${fresh.length} student${fresh.length > 1 ? 's' : ''}: ${fresh.join(', ')}`, { kind: 'admin' });
      });
      $('#addNames').value = '';
      toast(`Added ${fresh.length} student${fresh.length > 1 ? 's' : ''}`);
    });

    // History
    $('#undoBtn').addEventListener('click', undo);

    // Settings
    $('#setName').addEventListener('change', (e) => { const v = e.target.value.trim() || 'BP Club'; commit(() => { state.clubName = v; }); });
    $('#pinForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('#setPin').value.trim();
      if (v.length < 3) { toast('Use at least 3 characters for the PIN'); return; }
      state.pin = v; state.pinChanged = true; save();
      $('#setPin').value = '';
      toast('PIN changed');
    });
    $('#wheelAdd').addEventListener('click', () => commit(() => { state.wheel.push({ label: '+3 BP', type: 'gain', value: 3 }); }));
    $('#wheelReset').addEventListener('click', () => confirmBox('Reset wheel slices?', '', 'Reset', () => commit(() => { state.wheel = DEFAULT_WHEEL.map((s) => ({ ...s })); })));

    $('#exportBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `bp-club-backup-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Backup downloaded');
    });
    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.students)) throw new Error('bad');
          confirmBox('Restore this backup?', `${data.students.length} students. This replaces everything here.`, 'Restore', () => {
            commit(() => { state = normalise(data); log('Restored from backup', { kind: 'admin' }); });
            toast('Backup restored');
          });
        } catch (err) { toast('That file is not a BP Club backup'); }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
    $('#resetPointsBtn').addEventListener('click', () => confirmBox('Set all BP to 0?', 'Power-up effects are cleared too.', 'Set to 0', () => commit(() => {
      state.students.forEach((s) => { s.bp = 0; });
      state.effects = [];
      log('All BP reset to 0 for a fresh start', { kind: 'admin' });
    }), true));
    $('#wipeBtn').addEventListener('click', () => {
      const input = h('input', { type: 'text', id: 'wipeConfirm', placeholder: 'Type DELETE', autocomplete: 'off' });
      openModal({
        title: 'Delete everything?',
        body: [h('p', null, 'Removes all students, BP, history and settings.'), h('label', { class: 'field' }, h('span', null, 'Type DELETE to confirm'), input)],
        actions: [{ label: 'Cancel' }, { label: 'Delete everything', kind: 'danger', keep: true, onClick: () => {
          if (input.value.trim().toUpperCase() !== 'DELETE') { toast('Type DELETE to confirm'); return; }
          const pin = state.pin, pinChanged = state.pinChanged;
          state = freshState(); state.pin = pin; state.pinChanged = pinChanged;
          undoStack = [];
          save(); closeModal(); render();
        } }],
        focus: input,
      });
    });

    // Keep two open tabs on the same computer in sync
    window.addEventListener('storage', (e) => {
      if (e.key !== STORE_KEY || !e.newValue) return;
      try {
        const next = normalise(JSON.parse(e.newValue));
        const prev = new Map(state.students.map((s) => [s.id, s.bp]));
        next.students.forEach((s) => { if (prev.get(s.id) !== s.bp) flash.add(s.id); });
        state = next;
        undoStack = readJSON(UNDO_KEY, []);
        render();
      } catch (err) { /* ignore */ }
    });

    // Rage expiry is time-based: refresh now and then
    setInterval(() => { if ($('#modal').hidden) render(); }, 60000);
  }

  /* ------------------------------------------------------------------ boot */

  wire();
  const savedTab = (() => { try { return sessionStorage.getItem('bpclub.tab'); } catch (e) { return null; } })();
  const tabBtn = savedTab && document.querySelector(`.tab[data-tab="${savedTab}"]`);
  showTab(tabBtn && (teacher || !tabBtn.classList.contains('teacher-only')) ? savedTab : 'board');
  render();
  if (!saveOk) toast('This browser is blocking storage, so BP will not be saved. Try a normal (not private) window.');
})();
