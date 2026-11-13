/* LAN Watchdog web interface.
 *
 * Loaded by the tiny shell page that the Arduino Nano serves on http://<device-ip>/.
 * Everything visual lives here, so the design can change without reflashing the Nano.
 * Data comes from the Nano's JSON API on the same origin:
 *   GET /api                         status + settings
 *   GET /ts?n=&e=1&nm=&ip=&p=&h=     save device n   (&del=1 deletes)
 *   GET /g?a=&i=&f=                  save general settings
 *   GET /reboot
 * The Nano serves one request at a time, so requests here are strictly sequential.
 */
(function () {
  'use strict';

  var REFRESH_MS = 5000;
  var state = { data: null, error: null, busy: false, lastOk: 0, timer: null };

  // ---------- styles ----------
  var css = [
    // Dark theme only.
    ':root{color-scheme:dark;--bg:#0b0c0f;--card:#15171c;--text:#e6e8ec;--muted:#8b93a1;--line:#23262e;',
    '--up:#4ade80;--up-bg:#11291b;--down:#f87171;--down-bg:#341414;--off:#6b7280;--off-bg:#1e2128;',
    '--warn:#fbbf24;--warn-bg:#33270b;--accent:#60a5fa;--shadow:none}',
    '*{box-sizing:border-box}',
    'body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    '.wrap{max-width:880px;margin:0 auto;padding:20px 16px 40px}',
    'header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}',
    'h1{font-size:22px;margin:0;letter-spacing:-.2px}',
    '.sub{color:var(--muted);font-size:13px;margin-top:2px}',
    '.pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:13px;font-weight:600}',
    '.pill.up{background:var(--up-bg);color:var(--up)}.pill.down{background:var(--down-bg);color:var(--down)}',
    '.pill.off{background:var(--off-bg);color:var(--off)}.pill.warn{background:var(--warn-bg);color:var(--warn)}',
    '.dot{width:8px;height:8px;border-radius:50%;background:currentColor}',
    '.pill.down .dot{animation:pulse 1.2s infinite}@keyframes pulse{50%{opacity:.3}}',
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}',
    '.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;box-shadow:var(--shadow)}',
    '.dev{position:relative;border-left:4px solid var(--off);padding-bottom:40px}',
    '.dev.up{border-left-color:var(--up)}.dev.down{border-left-color:var(--down)}',
    '.dev h3{margin:0 0 2px;font-size:16px;display:flex;justify-content:space-between;align-items:center;gap:8px}',
    '.dev .addr{color:var(--muted);font-size:13px;font-family:ui-monospace,Menlo,monospace}',
    '.stats{display:flex;gap:16px;margin-top:12px;font-size:13px;color:var(--muted)}',
    '.stats b{display:block;color:var(--text);font-size:15px}',
    '.edit{position:absolute;right:10px;bottom:10px;border:0;background:none;color:var(--muted);cursor:pointer;font-size:13px;padding:4px 6px;border-radius:6px}',
    '.edit:hover{background:var(--off-bg);color:var(--text)}',
    '.add{display:flex;align-items:center;justify-content:center;min-height:118px;border:2px dashed var(--line);',
    'background:transparent;color:var(--muted);cursor:pointer;font-size:15px;border-radius:14px}',
    '.add:hover{border-color:var(--accent);color:var(--accent)}',
    'h2{font-size:14px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin:26px 0 10px}',
    '.kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}',
    '.kv div{font-size:13px;color:var(--muted)}.kv b{display:block;color:var(--text);font-size:15px}',
    '.banner{background:var(--down-bg);color:var(--down);padding:10px 14px;border-radius:10px;margin-bottom:14px;font-size:14px}',
    'label{display:block;font-size:13px;color:var(--muted);margin:12px 0 4px}',
    'input[type=text],input[type=number]{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;',
    'background:var(--bg);color:var(--text);font:14px ui-monospace,Menlo,monospace}',
    'input:focus{outline:2px solid var(--accent);outline-offset:-1px}',
    '.hint{font-size:12px;color:var(--muted);margin-top:4px}',
    '.row{display:flex;gap:10px}.row>*{flex:1}',
    '.btns{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap}',
    'button.b{border:0;border-radius:8px;padding:9px 16px;font-size:14px;font-weight:600;cursor:pointer}',
    '.b.primary{background:var(--accent);color:#fff}.b.ghost{background:var(--off-bg);color:var(--text)}',
    '.b.danger{background:var(--down-bg);color:var(--down)}.b:disabled{opacity:.5;cursor:default}',
    '.spacer{flex:1}',
    '.toggle{display:flex;align-items:center;gap:8px;margin-top:4px;font-size:14px;color:var(--text);cursor:pointer}',
    'dialog{border:0;border-radius:16px;padding:20px;width:min(440px,calc(100vw - 32px));background:var(--card);color:var(--text)}',
    'dialog::backdrop{background:rgba(0,0,0,.45)}',
    'dialog h3{margin:0 0 4px}',
    '.err{color:var(--down);font-size:13px;margin-top:10px;min-height:1em}',
    'footer{margin-top:28px;color:var(--muted);font-size:12px;text-align:center}',
    '.toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--text);color:var(--bg);',
    'padding:10px 16px;border-radius:10px;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none}',
    '.toast.show{opacity:1}'
  ].join('');

  // ---------- helpers ----------
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  function duration(sec) {
    sec = Math.max(0, Math.floor(sec));
    var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm';
    return sec + 's';
  }

  function hcText(code, configured) {
    if (!configured) return '—';
    if (code === 0) return 'pending';
    if (code === 200) return 'OK';
    if (code === -1) return 'no connection';
    if (code === -2) return 'DNS error';
    if (code === -3) return 'bad reply';
    return 'HTTP ' + code;
  }

  var toastEl;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  function request(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok && r.status !== 204) throw new Error('HTTP ' + r.status);
      return r;
    });
  }

  // ---------- data ----------
  function load() {
    if (state.busy) return Promise.resolve();
    state.busy = true;
    return request('/api').then(function (r) { return r.json(); }).then(function (d) {
      state.data = d; state.error = null; state.lastOk = Date.now();
    }).catch(function (e) {
      state.error = e.message || 'error';
    }).then(function () {
      state.busy = false;
      render();
    });
  }

  function schedule() {
    clearInterval(state.timer);
    state.timer = setInterval(function () { if (!document.hidden && !dialog.open) load(); }, REFRESH_MS);
  }

  // Run one write request, waiting for any refresh in progress (the Nano is single-threaded).
  function write(url) {
    function go() {
      if (state.busy) return new Promise(function (res) { setTimeout(res, 150); }).then(go);
      state.busy = true;
      return request(url).then(function () { state.busy = false; }, function (e) { state.busy = false; throw e; });
    }
    return go();
  }

  // ---------- rendering ----------
  var root, dialog;

  function deviceState(t) {
    if (!t.e) return { cls: 'off', label: 'disabled' };
    if (t.lo < 0) return { cls: 'off', label: 'checking…' };
    if (t.u) return { cls: 'up', label: 'UP' };
    return { cls: 'down', label: 'DOWN' };
  }

  function deviceCard(t, d) {
    var s = deviceState(t);
    var check = t.p ? 'TCP ' + t.p : 'ping';
    var last = t.lo < 0 ? '—' : (t.lo ? t.ms + ' ms' : 'no reply');
    var extra = s.cls === 'down' ? duration(t.ds) : (t.f ? t.f + '/' + d.ft : '0');
    return el('div', { class: 'card dev ' + s.cls }, [
      el('h3', null, [el('span', { text: t.n }), el('span', { class: 'pill ' + s.cls }, [el('span', { class: 'dot' }), s.label])]),
      el('div', { class: 'addr', text: t.ip + ' · ' + check }),
      el('div', { class: 'stats' }, [
        el('div', null, ['Response', el('b', { text: last })]),
        el('div', null, [s.cls === 'down' ? 'Down for' : 'Fails', el('b', { text: extra })]),
        el('div', null, ['Healthchecks', el('b', { text: hcText(t.hr, !!t.h) })])
      ]),
      el('button', { class: 'edit', text: 'Edit', onclick: function () { openDevice(t); } })
    ]);
  }

  function render() {
    var d = state.data;
    root.innerHTML = '';
    if (state.error) {
      root.appendChild(el('div', { class: 'banner', text: 'Cannot reach the watchdog (' + state.error + '). Retrying…' }));
    }
    if (!d) return;

    var devs = d.t || [];
    var active = devs.filter(function (t) { return t.e; });
    var down = active.filter(function (t) { return t.lo >= 0 && !t.u; });
    var aliveOk = !d.a || d.ar === 200 || d.ar === 0;
    var overall = down.length ? { cls: 'down', text: down.length === 1 ? '1 device DOWN' : down.length + ' devices DOWN' }
      : (!aliveOk ? { cls: 'warn', text: 'healthchecks unreachable' } : { cls: 'up', text: 'All systems up' });

    root.appendChild(el('header', null, [
      el('div', null, [
        el('h1', { text: 'LAN Watchdog' }),
        el('div', { class: 'sub', text: d.ip + ' · uptime ' + duration(d.up) + ' · check every ' + d.iv + ' s' })
      ]),
      el('span', { class: 'pill ' + overall.cls }, [el('span', { class: 'dot' }), overall.text])
    ]));

    var grid = el('div', { class: 'grid' });
    devs.forEach(function (t) { grid.appendChild(deviceCard(t, d)); });
    if (devs.length < d.mx) {
      grid.appendChild(el('button', { class: 'add', text: '+ Add device', onclick: function () { openDevice(null); } }));
    }
    root.appendChild(grid);

    root.appendChild(el('h2', { text: 'Internet & alerts' }));
    root.appendChild(el('div', { class: 'card kv' }, [
      el('div', null, ['Healthchecks (alive)', el('b', { text: hcText(d.ar, !!d.a) })]),
      el('div', null, ['Pings OK / failed', el('b', { text: d.ho + ' / ' + d.hf })]),
      el('div', null, ['Ethernet link', el('b', { text: d.lk ? 'up' : 'down' })]),
      el('div', null, ['Gateway', el('b', { text: d.gw })]),
      el('div', null, ['Net self-repairs', el('b', { text: d.nf + ' fixes / ' + d.rd + ' DHCP' })]),
      el('div', null, ['Check cycles', el('b', { text: String(d.cy) })])
    ]));

    root.appendChild(el('h2', { text: 'Settings' }));
    root.appendChild(settingsCard(d));

    root.appendChild(el('footer', {
      text: 'Updated ' + new Date(state.lastOk).toLocaleTimeString() + ' · LAN only (plain HTTP)'
    }));
  }

  function settingsCard(d) {
    var a = el('input', { type: 'text', maxlength: '36', value: d.a, placeholder: 'empty = disabled' });
    var iv = el('input', { type: 'number', min: '10', max: '3600', value: d.iv });
    var ft = el('input', { type: 'number', min: '1', max: '20', value: d.ft });
    var err = el('div', { class: 'err' });
    function save() {
      err.textContent = '';
      if (a.value && !/^[0-9a-fA-F-]{36}$/.test(a.value)) { err.textContent = 'UUID must be 36 characters.'; return; }
      var q = '/g?a=' + encodeURIComponent(a.value.trim()) + '&i=' + (+iv.value) + '&f=' + (+ft.value);
      write(q).then(function () { toast('Saved'); load(); }, function (e) { err.textContent = 'Error: ' + e.message; });
    }
    function reboot() {
      if (!confirm('Reboot the watchdog?')) return;
      write('/reboot').then(function () { toast('Rebooting…'); }, function () { toast('Rebooting…'); });
    }
    return el('div', { class: 'card' }, [
      el('label', { text: 'Healthchecks UUID — "alive" check' }), a,
      el('div', { class: 'row' }, [
        el('div', null, [el('label', { text: 'Check interval (seconds)' }), iv]),
        el('div', null, [el('label', { text: 'Fails before DOWN' }), ft])
      ]),
      err,
      el('div', { class: 'btns' }, [
        el('button', { class: 'b primary', text: 'Save', onclick: save }),
        el('span', { class: 'spacer' }),
        el('button', { class: 'b danger', text: 'Reboot', onclick: reboot })
      ])
    ]);
  }

  // ---------- add / edit dialog ----------
  function openDevice(t) {
    var d = state.data;
    var idx = t ? t.i : firstFreeSlot(d);
    if (idx < 0) { toast('No free slot'); return; }
    var en = el('input', { type: 'checkbox' }); en.checked = t ? !!t.e : true;
    var nm = el('input', { type: 'text', maxlength: '15', value: t ? t.n : '', placeholder: 'e.g. nas, printer' });
    var ip = el('input', { type: 'text', value: t ? t.ip : '', placeholder: '10.10.0.x' });
    var pt = el('input', { type: 'number', min: '0', max: '65535', value: t ? t.p : 0 });
    var hc = el('input', { type: 'text', maxlength: '36', value: t ? t.h : '', placeholder: 'optional' });
    var err = el('div', { class: 'err' });

    function save() {
      err.textContent = '';
      var name = nm.value.trim();
      if (!/^[A-Za-z0-9 ._-]{1,15}$/.test(name)) { err.textContent = 'Name: up to 15 chars — letters, digits, space, - _ .'; return; }
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip.value.trim()) || ip.value.split('.').some(function (x) { return +x > 255; })) {
        err.textContent = 'Invalid IP address.'; return;
      }
      var port = +pt.value;
      if (!(port >= 0 && port <= 65535)) { err.textContent = 'Port 0–65535 (0 = ping).'; return; }
      if (hc.value && !/^[0-9a-fA-F-]{36}$/.test(hc.value.trim())) { err.textContent = 'UUID must be 36 characters.'; return; }
      var q = '/ts?n=' + idx + (en.checked ? '&e=1' : '') + '&nm=' + encodeURIComponent(name) +
        '&ip=' + encodeURIComponent(ip.value.trim()) + '&p=' + port + '&h=' + encodeURIComponent(hc.value.trim());
      write(q).then(function () { dialog.close(); toast('Saved'); load(); }, function (e) { err.textContent = 'Error: ' + e.message; });
    }
    function del() {
      if (!confirm('Delete "' + t.n + '"?')) return;
      write('/ts?n=' + idx + '&del=1').then(function () { dialog.close(); toast('Deleted'); load(); },
        function (e) { err.textContent = 'Error: ' + e.message; });
    }

    dialog.innerHTML = '';
    dialog.appendChild(el('h3', { text: t ? 'Edit: ' + t.n : 'New device' }));
    dialog.appendChild(el('label', { class: 'toggle' }, [en, 'Enabled (being checked)']));
    dialog.appendChild(el('label', { text: 'Name' })); dialog.appendChild(nm);
    dialog.appendChild(el('div', { class: 'row' }, [
      el('div', null, [el('label', { text: 'IP address' }), ip]),
      el('div', null, [el('label', { text: 'TCP port' }), pt])
    ]));
    dialog.appendChild(el('div', { class: 'hint', text: 'Port 0 = plain ping. Prefer the port of the main service (e.g. 22, 80, 554, 8000).' }));
    dialog.appendChild(el('label', { text: 'Healthchecks UUID' })); dialog.appendChild(hc);
    dialog.appendChild(el('div', { class: 'hint', text: 'Tip: use a check with period 1 day and grace 1 day, so alerts only fire on a real outage.' }));
    dialog.appendChild(err);
    dialog.appendChild(el('div', { class: 'btns' }, [
      el('button', { class: 'b primary', text: 'Save', onclick: save }),
      el('button', { class: 'b ghost', text: 'Cancel', onclick: function () { dialog.close(); } }),
      el('span', { class: 'spacer' }),
      t ? el('button', { class: 'b danger', text: 'Delete', onclick: del }) : null
    ]));
    dialog.showModal();
    nm.focus();
  }

  function firstFreeSlot(d) {
    var used = {};
    (d.t || []).forEach(function (t) { used[t.i] = true; });
    for (var i = 0; i < d.mx; i++) if (!used[i]) return i;
    return -1;
  }

  // ---------- boot ----------
  function init() {
    window.LWUI = true;
    document.title = 'LAN Watchdog';
    var style = el('style'); style.textContent = css; document.head.appendChild(style);
    var fb = document.getElementById('lw-fallback'); if (fb) fb.remove();
    root = el('div', { class: 'wrap' });
    dialog = el('dialog');
    toastEl = el('div', { class: 'toast' });
    document.body.appendChild(root);
    document.body.appendChild(dialog);
    document.body.appendChild(toastEl);
    load().then(schedule);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
