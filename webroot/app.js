/* BORE Tweaker — app logic.
 *
 * Root access goes through the manager's WebUI exec API:
 *   Magisk   -> magisk.exec, magisk.MODDIR
 *   KernelSU -> ksu.exec, ksu.MODDIR
 *   NM       -> nm.exec, nm.MODDIR
 * The three are probed at runtime, and write access falls back to a clear
 * message rather than failing silently.
 *
 * Reading and writing prefer the kernel sysctl at /proc/sys/kernel/. v1.2
 * exposes every BORE knob there, min_base_slice_ns included, plus the
 * read-only base_slice_ns. The debugfs path of the same name is kept as a
 * fallback for kernels that only have it there.
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
      { key: 'min_base_slice_ns', min: 4000000, max: 16000000, step: 4000000,
        human: v => (v / 1e6).toFixed(0) + ' ms',
        hint: 'Requested minimum slice. Only whole ticks of 4 ms take effect, ' +
              'so the usable steps are 4, 8, 12 and 16 ms.' },
    ],
    /*
     * base_slice_ns is read-only in the kernel. It is shown, not offered, so
     * the requested value is never mistaken for the one in effect.
     */
    readouts: [
      { key: 'base_slice_ns', label: 'Effective base slice',
        human: v => (v / 1e6).toFixed(0) + ' ms' },
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

/* ---------- helpers --------------------------------------------------- */

function setStatus(t) { document.getElementById('status').textContent = t; }

function moddir() { return (RUNTIME && RUNTIME.MODDIR) || '.'; }

async function sh(cmd) {
  if (!RUNTIME || !RUNTIME.exec) return null;
  try {
    const r = await RUNTIME.exec(cmd);
    return (r && (r.stdout !== undefined ? r.stdout : r)) || '';
  } catch (e) {
    return null;
  }
}

function readCmd(key) {
  return 'cat /proc/sys/kernel/' + key + ' 2>/dev/null || ' +
         'cat /sys/kernel/debug/sched/' + key + ' 2>/dev/null';
}

function writeCmd(key, val) {
  return 'echo ' + val + ' > /proc/sys/kernel/' + key + ' 2>/dev/null || ' +
         'echo ' + val + ' > /sys/kernel/debug/sched/' + key;
}

function humanOf(item, v) {
  return (item.human ? item.human : (x => x))(v);
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

function readout(item) {
  const wrap = document.createElement('div');
  wrap.className = 'ro';
  wrap.id = 'ro_' + item.key;
  return wrap;
}

/* ---------- state ----------------------------------------------------- */

function keysOf() {
  const keys = [];
  CONTROLS.forEach(g => {
    (g.items || []).forEach(it => keys.push(it.key));
    (g.switches || []).forEach(it => keys.push(it.key));
    (g.readouts || []).forEach(it => keys.push(it.key));
  });
  return keys;
}

async function readState() {
  const out = {};
  for (const key of keysOf()) {
    const v = await sh(readCmd(key));
    const n = parseInt(String(v).trim(), 10);
    out[key] = Number.isFinite(n) ? n : null;
  }
  return out;
}

async function refreshReadouts(state) {
  for (const g of CONTROLS) {
    for (const it of (g.readouts || [])) {
      const v = await sh(readCmd(it.key));
      const n = parseInt(String(v).trim(), 10);
      state[it.key] = Number.isFinite(n) ? n : null;
    }
  }
  paintReadouts(state);
}

function paintReadouts(state) {
  CONTROLS.forEach(g => {
    (g.readouts || []).forEach(it => {
      const el = document.getElementById('ro_' + it.key);
      if (!el) return;
      el.textContent = it.label + ': ' +
        (state[it.key] === null ? 'n/a' : humanOf(it, state[it.key]));
    });
  });
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
      lab.textContent = humanOf(it, state[it.key]);
      el.oninput = () => { lab.textContent = humanOf(it, +el.value); };
      el.onchange = async () => {
        const v = +el.value;
        await sh(writeCmd(it.key, v));
        state[it.key] = v;
        lab.textContent = humanOf(it, v);
        /* A write to min_base_slice_ns can change base_slice_ns. */
        if (g.readouts && g.readouts.length) await refreshReadouts(state);
      };
    });

    (g.switches || []).forEach(it => {
      host.appendChild(toggle(it));
      const el = document.getElementById('c_' + it.key);
      if (state[it.key] === null) { el.disabled = true; return; }
      el.checked = state[it.key] === 1;
      el.onchange = async () => {
        const v = el.checked ? 1 : 0;
        await sh(writeCmd(it.key, v));
        state[it.key] = v;
      };
    });

    (g.readouts || []).forEach(it => host.appendChild(readout(it)));
  });
  paintReadouts(state);
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
      warn(true, 'Applying ' + p + ' …');
      await sh('echo "' + p + '" > /data/adb/BORE-Tweaker/profile');
      await sh('sh "' + moddir() + '/apply.sh" ' + p);
      await paintProfiles();
      paint(await readState());
      warn(false);
    };
    host.appendChild(b);
  });
}

/* ---------- boot ------------------------------------------------------ */

(async () => {
  if (!RUNTIME || !RUNTIME.exec) {
    setStatus('no root API in this manager');
    warn(true, 'This module needs a manager that exposes the WebUI exec ' +
               'API (Magisk 27+, KernelSU, or NM).');
    return;
  }
  setStatus('connected');
  await paintProfiles();
  paint(await readState());

  document.getElementById('reset').onclick = async () => {
    warn(true, 'Restoring defaults …');
    await sh('echo "stock" > /data/adb/BORE-Tweaker/profile');
    await sh('sh "' + moddir() + '/apply.sh" stock');
    await paintProfiles();
    paint(await readState());
    warn(false);
  };
})();
