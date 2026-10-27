/* BORE Tweaker - app logic.
 *
 * Root access goes through the manager's WebUI exec API:
 *   Magisk   -> magisk.exec, magisk.MODDIR
 *   KernelSU -> ksu.exec, ksu.MODDIR
 *   NM       -> nm.exec, nm.MODDIR
 * The three are probed at runtime, and write access falls back to a clear
 * message rather than failing silently.
 *
 * Reading and writing prefer the kernel sysctl at /proc/sys/kernel/. The
 * APEX-Foundry kernel has every BORE knob there, min_base_slice_ns included,
 * plus the read-only base_slice_ns. The debugfs path of the same name is kept
 * as a fallback for kernels that only have it there.
 */

const PROFILES = ['stock', 'balanced', 'battery', 'performance'];

const PROFILE_META = {
  stock: {
    label: 'Stock', icon: 'chip',
    desc: 'Kernel defaults, nothing moved.',
    long: 'The kernel\'s own values. Nothing moved.',
  },
  balanced: {
    label: 'Balanced', icon: 'balance',
    desc: 'A touch snappier than stock.',
    long: 'Stock with a softer offset, a faster penalty and a longer burst ' +
          'cache, so short sleeps keep their credit.',
  },
  battery: {
    label: 'Battery', icon: 'battery',
    desc: 'Fewer preemptions, more latency.',
    long: 'Fewer preemptions and a calmer penalty, at the cost of latency.',
  },
  performance: {
    label: 'Performance', icon: 'bolt',
    desc: 'Hard demotion, short memory.',
    long: 'Foreground wins: hard demotion and a short burst memory.',
  },
};

const ICONS = {
  chip:
    '<rect x="4" y="4" width="16" height="16" rx="4"/>' +
    '<rect x="9" y="9" width="6" height="6" rx="1.5"/>' +
    '<path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
  balance:
    '<path d="M12 3v18M6 7h12M8 21h8"/>' +
    '<path d="M6 7 3 14h6L6 7Z"/><path d="M18 7l-3 7h6l-3-7Z"/>',
  battery:
    '<rect x="2" y="7" width="16" height="10" rx="3"/>' +
    '<path d="M21 10.5v3M5.5 10.5v3"/>',
  bolt: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"/>',
  sliders:
    '<path d="M4 6h16M4 12h16M4 18h16"/>' +
    '<circle cx="9" cy="6" r="2.2" fill="currentColor" stroke="none"/>' +
    '<circle cx="15" cy="12" r="2.2" fill="currentColor" stroke="none"/>' +
    '<circle cx="8" cy="18" r="2.2" fill="currentColor" stroke="none"/>',
  gauge:
    '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 14 4-4"/>' +
    '<circle cx="12" cy="14" r="1.6" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.4 2"/>',
  toggle:
    '<rect x="2.5" y="7" width="19" height="10" rx="5"/>' +
    '<circle cx="8" cy="12" r="3"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
};

const ms = v => (v / 1e6).toFixed(0) + ' ms';

const GROUPS = [
  {
    title: 'Burst penalty', icon: 'sliders',
    blurb: 'How hard a busy task is demoted, and how fast that penalty grows ' +
           'with its run time.',
    items: [
      { key: 'sched_burst_penalty_offset', label: 'Penalty offset',
        min: 0, max: 64, step: 1,
        hint: 'Baseline penalty added to a bursty task.' },
      { key: 'sched_burst_penalty_scale', label: 'Penalty scale',
        min: 256, max: 4096, step: 64,
        hint: 'How fast the penalty grows with burst time.' },
      { key: 'sched_burst_fork_atavistic', label: 'Fork inheritance',
        min: 0, max: 3, step: 1,
        hint: 'How much burst time a child inherits from its parent.' },
      { key: 'sched_burst_parity_threshold', label: 'Parity threshold',
        min: 1, max: 4, step: 1,
        hint: 'Tasks above this parity are treated as bursty.' },
    ],
  },
  {
    title: 'Preemption', icon: 'gauge',
    blurb: 'The shortest time a task may hold a CPU. The kernel rounds the ' +
           'request up to a whole 4 ms tick.',
    items: [
      { key: 'min_base_slice_ns', label: 'Minimum slice',
        min: 4000000, max: 16000000, step: 4000000, human: ms,
        hint: 'Only 4, 8, 12 and 16 ms change anything.' },
    ],
    readouts: [
      { key: 'base_slice_ns', label: 'In effect', unit: 'ms',
        human: v => (v / 1e6).toFixed(0),
        note: 'What the scheduler actually uses after rounding.' },
    ],
  },
  {
    title: 'Burst cache', icon: 'clock',
    blurb: 'How long a task is remembered after it sleeps, and when that ' +
           'memory is dropped.',
    items: [
      { key: 'sched_burst_cache_lifetime', label: 'Memory lifetime',
        min: 15000000, max: 250000000, step: 5000000, human: ms,
        hint: 'How long burst state survives a sleep. Stock is 75 ms.' },
      { key: 'sched_burst_cache_stop_count', label: 'Reset after',
        min: 8, max: 256, step: 8,
        hint: 'Consecutive sleeps that drop the cached burst state.' },
    ],
  },
  {
    title: 'Switches', icon: 'toggle',
    blurb: 'BORE itself and the filters that shape how its penalty is applied.',
    switches: [
      { key: 'sched_bore', label: 'Enable BORE' },
      { key: 'sched_burst_exclude_kthreads', label: 'Skip kernel threads' },
      { key: 'sched_burst_smoothness_long', label: 'Long-window smoothing' },
      { key: 'sched_burst_smoothness_short', label: 'Short-window smoothing' },
    ],
  },
];

const RUNTIME = (typeof magisk !== 'undefined' && magisk) ||
                (typeof ksu !== 'undefined' && ksu) ||
                (typeof nm !== 'undefined' && nm) ||
                null;

const MODULE_ID = 'BORE-Tweaker';
const CONF = '/data/adb/BORE-Tweaker';

/* ---------- helpers --------------------------------------------------- */

function svg(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
         'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
         'aria-hidden="true">' + ICONS[name] + '</svg>';
}

function setStatus(text, kind) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.dataset.kind = kind || '';
}

let snackTimer = null;
function snack(text, isError) {
  const el = document.getElementById('snackbar');
  el.textContent = text;
  el.className = 'snackbar show' + (isError ? ' error' : '');
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => { el.className = 'snackbar'; }, 3200);
}

/*
 * The module directory, needed to run apply.sh.
 *
 * Magisk/MMRL hand it over as MODDIR. KernelSU does not: its WebUI bridge
 * exposes no such property, and exec() runs the command from /, so a relative
 * "./apply.sh" never resolves. The path comes from ksu.moduleInfo(), which
 * returns an object with moduleDir in it. The fixed install path is the last
 * resort.
 */
let _moddir = '';
function moddir() {
  if (_moddir) return _moddir;
  if (RUNTIME && RUNTIME.MODDIR) { _moddir = RUNTIME.MODDIR; return _moddir; }
  try {
    if (RUNTIME && typeof RUNTIME.moduleInfo === 'function') {
      const info = JSON.parse(RUNTIME.moduleInfo());
      if (info && info.moduleDir) { _moddir = info.moduleDir; return _moddir; }
    }
  } catch (e) { /* not a manager that has moduleInfo */ }
  _moddir = '/data/adb/modules/' + MODULE_ID;
  return _moddir;
}

/*
 * Run a command and return its answer.
 *
 * Every command here is written so that what it wants to say is on its LAST
 * line, and this returns exactly that line. KernelSU's one-argument exec is
 * libsu's fastCmd, which returns only the last line of stdout and drops stderr
 * entirely; a plain multi-line command comes back truncated to its tail.
 */
async function sh(cmd) {
  if (!RUNTIME || !RUNTIME.exec) return null;
  try {
    const r = await RUNTIME.exec(cmd);
    const out = (r && r.stdout !== undefined) ? r.stdout : r;
    if (out === null || out === undefined) return '';
    const lines = String(out).replace(/\s+$/, '').split('\n');
    return lines[lines.length - 1];
  } catch (e) {
    return null;
  }
}

/*
 * Apply a profile and, only if it actually took, remember it for the next
 * boot. apply.sh is the same path service.sh uses, so the GUI and boot cannot
 * drift apart.
 *
 * apply.sh's output is redirected to a log so the only thing left on stdout -
 * and so the only line the manager hands back - is the exit status. On failure
 * the reason is fetched separately, because only its last line would survive a
 * direct read.
 */
async function applyProfile(name) {
  const log = CONF + '/last-apply.log';
  const rc = await sh('sh "' + moddir() + '/apply.sh" ' + name +
                      ' >' + log + ' 2>&1; echo $?');
  const code = parseInt(String(rc).trim(), 10);
  if (code === 0) {
    await sh('echo "' + name + '" > ' + CONF + '/profile');
    return { ok: true };
  }
  const why = await sh('grep -m1 "could not write" ' + log + ' 2>/dev/null');
  return {
    ok: false,
    detail: (why || '').trim() || ('exit ' + (isNaN(code) ? '?' : code)),
  };
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

function keysOf() {
  const keys = [];
  GROUPS.forEach(g => {
    (g.items || []).forEach(it => keys.push(it.key));
    (g.switches || []).forEach(it => keys.push(it.key));
    (g.readouts || []).forEach(it => keys.push(it.key));
  });
  return keys;
}

/*
 * One exec for the whole state instead of one per knob: the loop prints every
 * value on a single line as key=value; and that single line is exactly what a
 * manager that keeps only the last line of stdout still hands back.
 */
function batchReadCmd(keys) {
  return 'for k in ' + keys.join(' ') + '; do v=$(cat /proc/sys/kernel/$k ' +
         '2>/dev/null || cat /sys/kernel/debug/sched/$k 2>/dev/null); ' +
         'printf "%s=%s;" "$k" "$v"; done; echo';
}

async function readState() {
  const keys = keysOf();
  const out = {};
  const line = await sh(batchReadCmd(keys));
  let parsed = 0;
  if (line && line.indexOf('=') !== -1) {
    line.split(';').forEach(tok => {
      const i = tok.indexOf('=');
      if (i < 1) return;
      const k = tok.slice(0, i).trim();
      const v = tok.slice(i + 1).trim();
      if (!k) return;
      const n = parseInt(v, 10);
      out[k] = Number.isFinite(n) ? n : null;
      parsed++;
    });
  }
  /* Fallback for a manager that mangles the one-line form. */
  if (parsed < keys.length) {
    for (const k of keys) {
      if (k in out) continue;
      const v = await sh(readCmd(k));
      const n = parseInt(String(v).trim(), 10);
      out[k] = Number.isFinite(n) ? n : null;
    }
  }
  return out;
}

/* ---------- rendering ------------------------------------------------- */

let active = 'stock';
let applying = false;

function profileTile(name) {
  const meta = PROFILE_META[name];
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'profile profile-' + name;
  b.dataset.profile = name;
  b.setAttribute('aria-pressed', 'false');
  b.innerHTML =
    '<span class="p-icon">' + svg(meta.icon) + '</span>' +
    '<span class="p-body">' +
      '<span class="p-name">' + meta.label + '</span>' +
      '<span class="p-desc">' + meta.desc + '</span>' +
    '</span>';
  b.addEventListener('click', () => selectProfile(name));
  return b;
}

function renderProfiles() {
  const host = document.getElementById('profiles');
  host.innerHTML = '';
  PROFILES.forEach(p => host.appendChild(profileTile(p)));
}

function paintProfiles(name) {
  const next = PROFILES.includes(name) ? name : 'stock';
  const changed = next !== active;
  active = next;

  document.querySelectorAll('.profile').forEach(el => {
    el.setAttribute('aria-pressed', String(el.dataset.profile === active));
  });

  const tile = document.querySelector('.profile[aria-pressed="true"]');
  if (tile) {
    const accent = getComputedStyle(tile).getPropertyValue('--accent').trim();
    if (accent) document.getElementById('hero').style.setProperty('--hero-accent', accent);
  }

  const meta = PROFILE_META[active];
  const title = document.getElementById('active-name');
  title.textContent = meta.label;
  document.getElementById('active-desc').textContent = meta.long;

  if (changed) {
    title.classList.remove('pop');
    void title.offsetWidth;
    title.classList.add('pop');
  }
}

function slider(item) {
  const wrap = document.createElement('div');
  wrap.className = 'ctl';

  const steps = Math.round((item.max - item.min) / item.step);
  let ticks = '';
  if (steps > 0 && steps <= 5) {
    ticks = '<div class="ticks" aria-hidden="true">';
    for (let i = 0; i <= steps; i++) {
      const at = (i / steps) * 100;
      ticks += '<span class="tick" style="left:' + at + '%"></span>';
    }
    ticks += '</div>';
  }

  wrap.innerHTML =
    '<div class="ctl-head">' +
      '<label class="ctl-name" for="c_' + item.key + '">' + item.label + '</label>' +
      '<output class="ctl-val" id="c_' + item.key + '_v" ' +
        'for="c_' + item.key + '">&hellip;</output>' +
    '</div>' +
    '<input class="slider" type="range" id="c_' + item.key + '" ' +
      'min="' + item.min + '" max="' + item.max + '" step="' + item.step + '">' +
    ticks +
    '<p class="ctl-hint">' + item.hint + ' <code>' + item.key + '</code></p>';
  return wrap;
}

function toggle(item) {
  const wrap = document.createElement('label');
  wrap.className = 'switch';
  wrap.innerHTML =
    '<span class="sw-text">' +
      '<span class="sw-name">' + item.label + '</span>' +
      '<code class="sw-key">' + item.key + '</code>' +
    '</span>' +
    '<input class="sw-input" type="checkbox" id="c_' + item.key + '" ' +
      'aria-label="' + item.label + '">' +
    '<span class="sw-track" aria-hidden="true"><span class="sw-thumb">&#10003;</span></span>';
  return wrap;
}

function readout(item) {
  const wrap = document.createElement('div');
  wrap.className = 'stat';
  wrap.id = 'ro_' + item.key;
  wrap.innerHTML =
    '<div class="stat-main">' +
      '<span class="stat-value" id="ro_' + item.key + '_v">&ndash;</span>' +
      '<span class="stat-unit" id="ro_' + item.key + '_u"></span>' +
    '</div>' +
    '<div><div class="stat-label">' + item.label + '</div>' +
      '<p class="stat-note">' + item.note + '</p></div>';
  return wrap;
}

function renderGroups() {
  const host = document.getElementById('groups');
  host.innerHTML = '';
  GROUPS.forEach((g, gi) => {
    const card = document.createElement('section');
    card.className = 'card';
    card.style.setProperty('--i', gi + 1);
    card.innerHTML =
      '<div class="card-head">' +
        '<span class="card-icon">' + svg(g.icon) + '</span>' +
        '<div><h2>' + g.title + '</h2><p class="blurb">' + g.blurb + '</p></div>' +
      '</div>';
    const body = document.createElement('div');
    (g.items || []).forEach(it => body.appendChild(slider(it)));
    (g.switches || []).forEach(it => body.appendChild(toggle(it)));
    (g.readouts || []).forEach(it => body.appendChild(readout(it)));
    card.appendChild(body);
    host.appendChild(card);
  });
}

function setFill(el) {
  const min = +el.min, max = +el.max;
  const pct = max > min ? ((+el.value - min) / (max - min)) * 100 : 0;
  el.style.setProperty('--pct', pct.toFixed(2) + '%');
  const ticks = el.parentNode.querySelectorAll('.tick');
  if (ticks.length) {
    const steps = ticks.length - 1;
    const idx = Math.round(((+el.value - min) / (max - min)) * steps);
    ticks.forEach((t, i) => t.classList.toggle('on', i <= idx));
  }
}

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function paintReadouts(state) {
  GROUPS.forEach(g => {
    (g.readouts || []).forEach(it => {
      const v = state[it.key];
      const host = document.getElementById('ro_' + it.key);
      if (!host) return;
      const val = document.getElementById('ro_' + it.key + '_v');
      const unit = document.getElementById('ro_' + it.key + '_u');
      if (v === null || v === undefined) {
        val.textContent = 'n/a';
        unit.textContent = '';
        return;
      }
      val.textContent = it.human ? it.human(v) : v;
      unit.textContent = it.unit || '';
    });
  });
}

function paint(state) {
  GROUPS.forEach(g => {
    (g.items || []).forEach(it => {
      const el = document.getElementById('c_' + it.key);
      const lab = document.getElementById('c_' + it.key + '_v');
      if (!el) return;
      if (state[it.key] === null || state[it.key] === undefined) {
        el.disabled = true;
        lab.textContent = 'n/a';
        return;
      }
      el.disabled = false;
      el.value = state[it.key];
      el.setAttribute('aria-valuetext', humanOf(it, state[it.key]));
      lab.textContent = humanOf(it, state[it.key]);
      setFill(el);

      el.oninput = () => {
        lab.textContent = humanOf(it, +el.value);
        el.setAttribute('aria-valuetext', humanOf(it, +el.value));
        setFill(el);
      };
      el.onchange = async () => {
        const v = +el.value;
        await sh(writeCmd(it.key, v));
        state[it.key] = v;
        bump(lab);
        if (g.readouts && g.readouts.length) {
          for (const ro of g.readouts) {
            const raw = await sh(readCmd(ro.key));
            const n = parseInt(String(raw).trim(), 10);
            state[ro.key] = Number.isFinite(n) ? n : null;
          }
          paintReadouts(state);
        }
      };
    });

    (g.switches || []).forEach(it => {
      const el = document.getElementById('c_' + it.key);
      if (!el) return;
      if (state[it.key] === null || state[it.key] === undefined) {
        el.disabled = true;
        return;
      }
      el.disabled = false;
      el.checked = state[it.key] === 1;
      el.onchange = async () => {
        const v = el.checked ? 1 : 0;
        await sh(writeCmd(it.key, v));
        state[it.key] = v;
        snack(it.label + (v ? ' on' : ' off') + ' - live, not saved to a profile.');
      };
    });
  });
  paintReadouts(state);
}

/* ---------- actions --------------------------------------------------- */

async function selectProfile(name) {
  if (applying || name === active) return;
  applying = true;
  snack('Applying ' + PROFILE_META[name].label + '…');
  const res = await applyProfile(name);
  applying = false;
  if (!res.ok) {
    snack('Could not apply ' + PROFILE_META[name].label + ': ' + res.detail, true);
    return;
  }
  paintProfiles(name);
  paint(await readState());
  snack(PROFILE_META[name].label + ' applied and saved for boot.');
}

function disarmReset() {
  const btn = document.getElementById('reset');
  btn.classList.remove('armed');
  btn.textContent = 'Restore defaults';
}

/* Nothing can be read or written without the exec API: show it, do not
   pretend the knobs have values. */
function paintUnavailable() {
  document.querySelectorAll('.slider').forEach(el => { el.disabled = true; });
  document.querySelectorAll('.sw-input').forEach(el => { el.disabled = true; });
  document.querySelectorAll('.profile').forEach(el => { el.disabled = true; });
  document.getElementById('reset').disabled = true;
  GROUPS.forEach(g => {
    (g.items || []).forEach(it => {
      const lab = document.getElementById('c_' + it.key + '_v');
      if (lab) lab.textContent = 'n/a';
    });
    (g.readouts || []).forEach(it => {
      const val = document.getElementById('ro_' + it.key + '_v');
      if (val) val.textContent = 'n/a';
    });
  });
}

function armReset() {
  const btn = document.getElementById('reset');
  if (btn.classList.contains('armed')) return true;
  btn.classList.add('armed');
  btn.textContent = 'Tap again to confirm';
  setTimeout(disarmReset, 4000);
  return false;
}

/* ---------- boot ------------------------------------------------------ */

(async () => {
  renderProfiles();
  renderGroups();

  const appbar = document.getElementById('appbar');
  addEventListener('scroll', () => {
    appbar.classList.toggle('compact', scrollY > 8);
  }, { passive: true });

  document.getElementById('refresh').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.classList.remove('spin');
    void b.offsetWidth;
    b.classList.add('spin');
    if (!RUNTIME || !RUNTIME.exec) return;
    await paintProfiles();
    paint(await readState());
    snack('Values refreshed from the kernel.');
  });

  document.getElementById('reset').addEventListener('click', async () => {
    if (!armReset()) return;
    disarmReset();
    const res = await applyProfile('stock');
    if (!res.ok) { snack('Could not restore defaults: ' + res.detail, true); return; }
    paintProfiles('stock');
    paint(await readState());
    snack('Kernel defaults restored.');
  });

  if (!RUNTIME || !RUNTIME.exec) {
    setStatus('No root API in this manager', 'error');
    paintUnavailable();
    snack('This module needs a manager that exposes the WebUI exec API ' +
          '(Magisk 27+, KernelSU, or NM).', true);
    return;
  }

  setStatus('Connected', 'live');
  const cur = await sh('cat ' + CONF + '/profile 2>/dev/null');
  paintProfiles(cur && cur.trim() ? cur.trim() : 'stock');
  paint(await readState());
})();
