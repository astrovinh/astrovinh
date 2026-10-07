import type { Res } from './util'

export type WebRes = Res & { cookies?: string[] }
export const WEB_LIFE_SECONDS = 30 * 86_400

export const webCookie = (name: string, token: string, maxAge: number) =>
  `${name}=${token}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`

/** Read only the exact team cookie; ambiguous duplicate cookies are refused. */
export function cookie(req: Request, name: string): string {
  const values = (req.headers.get('cookie') ?? '').split(';').map(c => c.trim()).filter(c => c.startsWith(`${name}=`))
  return values.length === 1 ? values[0]!.slice(name.length + 1) : ''
}

export const WEB_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
}
export const WEB_CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

// These pure policies are also emitted into the external script, so tests exercise the served logic.
export function retryDelay(failures: number): number {
  return [30_000, 60_000, 120_000][Math.max(0, failures - 1)] ?? 300_000
}

export function refreshOnVisible(lastSuccess: number | null, now: number): boolean {
  return lastSuccess === null || now - lastSuccess > 30_000
}

export const webPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Team Pulse</title>
<style>
:root{color-scheme:dark;--bg:#20201F;--ink:#F0EFE9;--secondary:#C3C0B7;--quiet:#AAA69A;--line:#34332F;--raise:#2A2A28;--working:#8CC9A1;--idle:#D6BA7B;--active:#94B7E8;--offline:#7B776C;--bubble:#34332E;--edge:#45433D;--mono:ui-monospace,"SF Mono",Menlo,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-size:13px;line-height:1.5}p,h1{margin:0}button{font:inherit;cursor:pointer}button:focus-visible{outline:2px solid var(--active);outline-offset:3px}[hidden]{display:none!important}.quiet{color:var(--quiet)}
.top{padding:12px 16px 8px;border-bottom:1px solid var(--line)}.heading{display:flex;justify-content:space-between;align-items:baseline;gap:8px}h1{font-size:15px;font-weight:600;overflow-wrap:anywhere}nav{display:flex;gap:12px;flex-shrink:0}nav button{border:0;background:transparent;padding:0;color:var(--quiet);font-size:12px}.working{color:var(--secondary);font-size:12.5px;margin-top:4px;overflow-wrap:anywhere}
.view-body{position:relative;display:grid;grid-template-columns:minmax(0,1fr)}.side,.roster{min-width:0}.card{margin:12px 16px 4px;border:1px solid var(--edge);background:var(--raise);border-radius:12px;padding:8px 12px;display:grid;gap:4px;overflow-wrap:anywhere}.card-heading{font-family:var(--mono);font-size:11px;color:var(--secondary);letter-spacing:.03em}.how{font-size:12px;color:var(--quiet)}.overflow{margin:4px 16px}.shelf{margin:8px 16px 12px;display:flex;gap:8px;align-items:baseline;color:var(--secondary);font-size:12px;overflow-wrap:anywhere}.shelf-label{font:11px var(--mono);color:var(--quiet);flex-shrink:0}
.row{display:grid;grid-template-columns:30px minmax(0,1fr);gap:12px;padding:12px 16px}.row+.row{border-top:1px solid var(--line)}.avatar{display:block}.row-main{min-width:0;display:grid;gap:4px}.name-line{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.name{font-size:13px;overflow-wrap:anywhere}.you,.wave-label{font-weight:400;color:var(--quiet)}.wave-label{font-size:12px}.clock{font:11px var(--mono);color:var(--quiet);white-space:nowrap}.clock{text-align:right}.status-text{display:block;margin-top:4px}.work{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.note{margin:4px 0 0;max-width:100%}.note svg{display:block;max-width:100%;height:auto}.sub{display:flex;align-items:center;gap:8px}.strip{flex:1;min-width:0}.strip svg{display:block;width:auto;max-width:100%;height:16px}.more{font-size:11.5px;color:var(--secondary);border:1px solid var(--line);border-radius:4px;padding:0 8px;background:transparent;white-space:nowrap}.details{color:var(--quiet);font-size:12px;display:grid;gap:4px;overflow-wrap:anywhere}.bars svg{display:block;max-width:100%;height:auto}
footer{border-top:1px solid var(--line);padding:8px 16px;display:flex;justify-content:space-between;gap:8px;color:var(--quiet);font-size:12px}.banner{margin:12px 16px 0;padding:8px 12px;border-radius:8px;background:#2C2A24;border:1px solid #4A4434;color:var(--idle);font-size:12px}.connect{padding:28px 20px;display:grid;gap:12px;max-width:480px}.connect h1{font-size:15px}.code{font:22px var(--mono);letter-spacing:.12em;color:var(--ink);background:var(--raise);border:1px solid var(--edge);border-radius:12px;padding:8px 12px;width:fit-content}.connect p{color:var(--quiet);font-size:12px}.connect button{width:fit-content;background:var(--raise);border:1px solid var(--edge);border-radius:8px;padding:8px 12px;color:var(--ink)}
.cover{position:absolute;inset:0;display:grid;place-items:center;background:var(--bg);color:var(--quiet)}.covered .roster,.covered .side{visibility:hidden}
@media(min-width:720px){.view-body{grid-template-columns:minmax(0,1fr) 260px}.roster{grid-column:1;grid-row:1}.side{grid-column:2;grid-row:1;border-left:1px solid var(--line);padding-bottom:12px}}
</style><script src="/web/assets/app.js" defer></script></head>
<body><p id="banner" class="banner" role="status" hidden></p><main id="team-view" hidden></main>
<section id="connect" class="connect" aria-label="Connect this browser"><h1>Connect this browser to Murror</h1><p id="message" role="status">Connecting...</p><div id="code" class="code" hidden></div><p id="instruction" hidden></p><p>The code works once, for 10 minutes, and only for this browser.</p><button id="new-code" hidden>Get a new code</button></section></body></html>`

// Only same-origin HTML from the authenticated, escaped renderer is parsed. No key or cookie is read by JS.
export const webApp = String.raw`(() => {
  const retryDelay = ${retryDelay.toString()};
  const refreshOnVisible = ${refreshOnVisible.toString()};
  const base = location.pathname.replace(/\/$/, '');
  const view = document.getElementById('team-view');
  const connect = document.getElementById('connect');
  const message = document.getElementById('message');
  const code = document.getElementById('code');
  const instruction = document.getElementById('instruction');
  const newCode = document.getElementById('new-code');
  const banner = document.getElementById('banner');
  const expanded = new Set();
  const paths = { view: '/view', challenge: '/challenge', exchange: '/exchange', signout: '/signout' };
  const localTime = (now) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(now);
  let mode = 'view';
  let inFlight = false;
  let timer;
  let failures = 0;
  let lastSuccess = null;
  let snapshotTime = '';
  let lastHtml = '';
  let expiresAt = 0;
  let covered = false;

  const schedule = (delay) => {
    clearTimeout(timer);
    if (document.visibilityState === 'visible' && mode !== 'expired') timer = setTimeout(run, delay);
  };
  const clearTeam = () => {
    view.replaceChildren();
    view.hidden = true;
    connect.hidden = false;
    banner.hidden = true;
    banner.textContent = '';
    expanded.clear();
    lastHtml = '';
    snapshotTime = '';
    lastSuccess = null;
    code.textContent = '';
    code.hidden = true;
    instruction.textContent = '';
    instruction.hidden = true;
    newCode.hidden = true;
    message.textContent = 'Connecting...';
    failures = 0;
  };
  const expired = () => {
    mode = 'expired';
    clearTimeout(timer);
    message.textContent = 'That code has expired';
    code.textContent = '';
    code.hidden = true;
    instruction.textContent = '';
    instruction.hidden = true;
    newCode.hidden = false;
  };
  const applyCover = () => {
    view.classList.toggle('covered', covered);
    const cover = view.querySelector('[data-cover]');
    if (cover) cover.hidden = !covered;
    const toggle = view.querySelector('[data-action="hide"]');
    if (toggle) {
      toggle.textContent = covered ? 'Show view' : 'Hide view';
      toggle.setAttribute('aria-pressed', String(covered));
    }
  };
  const expandRow = (row) => {
    const open = expanded.has(row.dataset.member);
    row.querySelector('[data-details]').hidden = !open;
    const toggle = row.querySelector('[data-action="more"]');
    toggle.textContent = open ? 'Less' : 'More';
    toggle.setAttribute('aria-expanded', String(open));
  };
  const show = (html) => {
    if (html !== lastHtml) {
      const active = document.activeElement;
      const focusAction = view.contains(active) ? active.dataset.action : null;
      const focusMember = active && active.closest('[data-member]');
      const memberId = focusMember ? focusMember.dataset.member : null;
      const template = document.createElement('template');
      template.innerHTML = html;
      const next = template.content.firstElementChild;
      snapshotTime = localTime(Number(next.dataset.snapshotNow));
      next.querySelector('[data-snapshot-time]').textContent = snapshotTime;
      for (const row of next.querySelectorAll('[data-member]')) expandRow(row);
      // One synchronous swap, with expanded state already restored; no empty intermediate view.
      view.replaceChildren(next);
      lastHtml = html;
      applyCover();
      if (focusAction) {
        const row = memberId ? Array.from(view.querySelectorAll('[data-member]')).find(r => r.dataset.member === memberId) : view;
        const target = row && row.querySelector('[data-action="' + focusAction + '"]');
        if (target) target.focus({ preventScroll: true });
      }
    }
    view.hidden = false;
    connect.hidden = true;
    code.textContent = '';
    instruction.textContent = '';
    banner.hidden = true;
    banner.textContent = '';
    lastSuccess = Date.now();
    failures = 0;
  };
  const request = (path, method = 'GET') => fetch(base + path, {
    method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000)
  });
  async function run() {
    if (inFlight || mode === 'expired' || document.visibilityState !== 'visible') return;
    clearTimeout(timer);
    inFlight = true;
    const action = mode;
    try {
      if (action === 'exchange' && Date.now() >= expiresAt) { expired(); return; }
      const response = await request(paths[action], action === 'view' ? 'GET' : 'POST');
      // A local signout during a pending read must not be undone by its late response.
      if (mode !== action) return;
      if (response.status === 429) { schedule(action === 'exchange' ? Math.min(3000, Math.max(0, expiresAt - Date.now())) : 30000); return; }
      if (action === 'view') {
        if (response.status === 403) { clearTeam(); mode = 'challenge'; return; }
        if (response.status !== 200) throw new Error('View unavailable');
        const html = await response.text();
        if (mode !== action) return;
        show(html);
        schedule(30000);
      } else if (action === 'challenge') {
        if (response.status !== 200) throw new Error('Code unavailable');
        const body = await response.json();
        if (mode !== action) return;
        expiresAt = body.expiresAt;
        code.textContent = body.code;
        code.hidden = false;
        instruction.textContent = 'In Claude Code, type /team web ' + body.code;
        instruction.hidden = false;
        message.textContent = '';
        newCode.hidden = true;
        banner.hidden = true;
        failures = 0;
        mode = 'exchange';
        schedule(Math.min(3000, Math.max(0, expiresAt - Date.now())));
      } else if (action === 'exchange') {
        if (response.status === 403) { expired(); return; }
        if (response.status === 202) { failures = 0; schedule(Math.min(3000, Math.max(0, expiresAt - Date.now()))); return; }
        if (response.status !== 200) throw new Error('Exchange unavailable');
        mode = 'view';
      } else if (action === 'signout') {
        if (response.status !== 200 && response.status !== 403) throw new Error('Signout unavailable');
        clearTeam();
        mode = 'challenge';
      }
    } catch {
      if (mode !== action) return;
      failures++;
      if (snapshotTime) {
        banner.textContent = 'Offline \u00b7 showing the view from ' + snapshotTime + ' \u00b7 retrying';
        banner.hidden = false;
      } else {
        message.textContent = action === 'signout' ? 'Could not sign out. Retrying...' : 'Offline \u00b7 retrying';
      }
      schedule(retryDelay(failures));
    } finally {
      inFlight = false;
      // Challenge -> exchange waits three seconds. Other mode changes continue immediately.
      if (mode !== action && mode !== 'expired' && !(action === 'challenge' && mode === 'exchange')) void run();
    }
  }
  view.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.action === 'more') {
      const row = target.closest('[data-member]');
      const id = row.dataset.member;
      if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
      expandRow(row);
    } else if (target.dataset.action === 'hide') {
      covered = !covered;
      applyCover();
    } else if (target.dataset.action === 'signout') {
      clearTimeout(timer);
      clearTeam();
      mode = 'signout';
      void run();
    }
  });
  newCode.addEventListener('click', () => { clearTeam(); mode = 'challenge'; void run(); });
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (document.visibilityState !== 'visible') return;
    if (mode !== 'view' || refreshOnVisible(lastSuccess, Date.now())) void run();
    else schedule(Math.max(0, lastSuccess + 30000 - Date.now()));
  });
  void run();
})();`
