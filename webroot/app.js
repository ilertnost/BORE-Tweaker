/* BORE Tweaker — app logic.
 *
 * Root access goes through the manager's WebUI exec API:
 *   Magisk  -> magisk.exec, magisk.MODDIR
 *   KernelSU-> ksu.exec, ksu.MODDIR
 *   NM      -> nm.exec, nm.MODDIR
 * The three are probed at runtime, and write access falls back to a clear
 * message rather than failing silently.
 */

const PROFILES = ['stock', 'balanced', 'battery', 'performance'];

const CONTROLS = [
  {
    group: 'ctrl-penalty',
    items: [
      { key: 'sched_burst_penalty_offset', min: 0, max: 64, step: 1,
        hint: 'Baseline penalty added to a bursty task.' },
      { key: 'sched_burst_penalty_scale', min: 256, max: 4096, step: 64,
        hint: 'How fast the penalty grows with burst time.' },
      { key: 'sched_burst_fork_atavistic', min: 0, max: 3, step: 1,
        hint: 'How much burst time a child inherits from its parent.' },
      { key: 'sched_burst_parity_threshold', min: 1, max: 4, step: 1,
        hint: 'Tasks above this parity are treated as bursty.' },
    ],
  },
  {
    group: 'ctrl-slice',
    items: [
      { key: 'min_base_slice_ns', min: 500000, max: 8000000, step: 250000,
        unit: 'ns', human: v => (v / 1e6).toFixed(2) + ' ms',
        hint: 'Minimum time a task keeps the CPU. Kernel default 2 ms.' },
    ],
  },
  {
    group: 'ctrl-cache',
    items: [
      { key: 'sched_burst_cache_lifetime', min: 15000000, max: 250000000,
        step: 5000000, human: v => (v / 1e6).toFixed(0) + ' ms',
        hint: 'How long burst state is remembered. Default 75 ms.' },
      { key: 'sched_burst_cache_stop_count', min: 8, max: 256, step: 8,
        hint: 'Consecutive sleeps after which the burst cache resets.' },
    ],
  },
  {
    group: 'ctrl-flags',
    switches: [
      { key: 'sched_bore', text: 'Enable BORE' },
      { key: 'sched_burst_exclude_kthreads',
        text: 'Do not penalise kernel threads' },
      { key: 'sched_burst_smoothness_long',
        text: 'Smooth the penalty over the long window' },
      { key: 'sched_burst_smoothness_short',
        text: 'Smooth the penalty over the short window' },
    ],
  },
];

const RUNTIME = (typeof magisk !== 'undefined' && magisk) ||
                (typeof ksu !== 'undefined' && ksu) ||
                (typeof nm !== 'undefined' && nm) ||
                null;

const CONF = RUNTIME && RUNTIME.MODDIR ? RUNTIME.MODDIR + '/profiles' : null;

/* ---------- helpers --------------------------------------------------- */

function setStatus(t) { document.getElementById('status').textContent = t; }

async function sh(cmd) {
  if (!RUNTIME || !RUNTIME.exec) return null;
  try {
    const r = await RUNTIME.exec(cmd);
    return (r && (r.stdout !== undefined ? r.stdout : r)) || '';
  } catch (e) {
    return null;
  }
}

function readPath(key) {
  return 'cat /proc/sys/kernel/' + key + ' 2>/dev/null || ' +
         'cat /sys/kernel/debug/sched/' + key + ' 2>/dev/null';
}

function warn(show, msg) {
  const el = document.getElementById('warn');
  if (!el) return;
  el.className = show ? 'warn show' : 'warn';
  if (show) el.textContent = msg;
}

/* ---------- rendering ------------------------------------------------- */

function slider(item) {
  const id = 'c_' + item.key;
  const wrap = document.createElement('div');
  wrap.className = 'ctl';
  wrap.innerHTML =
    '<div class="row"><span class="name">' + item.key + '</span>' +
    '<span class="val" id="' + id + '_v">…</span></div>' +
    '<input type="range" id="' + id + '" min="' + item.min +
    '" max="' + item.max + '" step="' + item.step + '">' +
    '<div class="hint">' + item.hint + '</div>';
  return wrap;
}

function toggle(item) {
  const id = 'c_' + item.key;
  const wrap = document.createElement('div');
  wrap.className = 'switch';
  wrap.innerHTML =
    '<span class="name">' + item.text + '</span>' +
    '<input type="checkbox" id="' + id + '">';
  return wrap;
}

/* ---------- main ------------------------------------------------------ */

async function refresh() {
  const out = {};
  for (const g of CONTROLS) {
    for (const it of (g.items || [])) {
      const v = await sh(readPath(it.key));
      const n = parseInt(String(v).trim(), 10);
      out[it.key] = Number.isFinite(n) ? n : null;
    }
    for (const it of (g.switches || [])) {
      const v = await sh(readPath(it.key));
      const n = parseInt(String(v).trim(), 10);
      out[it.key] = Number.isFinite(n) ? n : null;
    }
  }
  return out;
}

function paint(state) {
  CONTROLS.forEach(g => {
    const host = document.getElementById(g.group);
    host.innerHTML = '';
    (g.items || []).forEach(it => {
      host.appendChild(slider(it));
      const el = document.getElementById('c_' + it.key);
      const lab = document.getElementById('c_' + it.key + '_v');
      if (state[it.key] === null) {
        el.disabled = true; lab.textContent = 'n/a';
        return;
      }
      el.value = state[it.key];
      const show = it.human ? it.human : (v => v);
      lab.textContent = show(state[it.key]);
      el.oninput = () => { lab.textContent = show(+el.value); };
      el.onchange = async () => {
        const v = +el.value;
        warn(true, 'Writing ' + it.key + ' = ' + v + ' …');
        await sh('echo ' + v + ' > /proc/sys/kernel/' + it.key +
                 ' 2>/dev/null || echo ' + v +
                 ' > /sys/kernel/debug/sched/' + it.key);
        state[it.key] = v;
        warn(false);
      };
    });
    (g.switches || []).forEach(it => {
      host.appendChild(toggle(it));
      const el = document.getElementById('c_' + it.key);
      if (state[it.key] === null) { el.disabled = true; return; }
      el.checked = state[it.key] === 1;
      el.onchange = async () => {
        const v = el.checked ? 1 : 0;
        await sh('echo ' + v + ' > /proc/sys/kernel/' + it.key +
                 ' 2>/dev/null || echo ' + v +
                 ' > /sys/kernel/debug/sched/' + it.key);
        state[it.key] = v;
      };
    });
  });
}

async function paintProfiles() {
  const host = document.getElementById('profiles');
  host.innerHTML = '';
  let active = 'stock';
  const cur = await sh('cat /data/adb/BORE-Tweaker/profile 2>/dev/null');
  if (cur && cur.trim()) active = cur.trim();
  PROFILES.forEach(p => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = p;
    b.setAttribute('aria-pressed', p === active ? 'true' : 'false');
    b.onclick = async () => {
      await sh('echo "' + p + '" > /data/adb/BORE-Tweaker/profile');
      await sh('sh "$MODPATH/service.sh"'.replace('$MODPATH', RUNTIME.MODDIR || '.'));
      paintProfiles();
      paint(await refresh());
    };
    host.appendChild(b);
  });
}

(async () => {
  if (!RUNTIME || !RUNTIME.exec) {
    setStatus('no root API in this manager');
    warn(true, 'This module needs a manager that exposes the WebUI exec ' +
               'API (Magisk 27+, KernelSU, or NM).');
    return;
  }
  setStatus('connected');
  await paintProfiles();
  paint(await refresh());

  document.getElementById('reset').onclick = async () => {
    await sh('echo "stock" > /data/adb/BORE-Tweaker/profile');
    await sh('sh "' + RUNTIME.MODDIR + '/profiles/stock.sh"');
    paintProfiles();
    paint(await refresh());
  };
})();
