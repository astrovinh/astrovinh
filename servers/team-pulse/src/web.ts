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

export const webPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Team Pulse</title>
<script src="/web/assets/app.js" defer></script></head>
<body><main><h1>Team Pulse</h1><p id="message">Connecting...</p><ul id="members"></ul><button id="signout" hidden>Sign out</button></main></body></html>`

// Same-origin external script: credentials stay in HttpOnly cookies, and names use textContent.
export const webApp = `(() => {
  const base = location.pathname.replace(/\\/$/, '');
  const message = document.getElementById('message');
  const members = document.getElementById('members');
  const signout = document.getElementById('signout');
  let timer;
  const request = async (path, method = 'GET') => {
    const response = await fetch(base + path, { method, credentials: 'same-origin', cache: 'no-store' });
    return { status: response.status, body: await response.json() };
  };
  const show = (body) => {
    members.replaceChildren();
    for (const member of body.members) {
      const item = document.createElement('li');
      item.textContent = member.name;
      members.appendChild(item);
    }
    message.textContent = 'Connected for 30 days.';
    signout.hidden = false;
  };
  const problem = (error) => { message.textContent = error.message || 'Could not connect. Refresh the page to try again.'; };
  const start = async () => {
    const current = await request('/snapshot');
    if (current.status === 200) { show(current.body); return; }
    if (current.status !== 403) throw new Error(current.body.error);
    const challenge = await request('/challenge', 'POST');
    if (challenge.status !== 200) throw new Error(challenge.body.error);
    const { code, expiresAt } = challenge.body;
    message.textContent = code + ' - In Claude Code, type /team web ' + code;
    const poll = async () => {
      if (Date.now() >= expiresAt) { message.textContent = 'That code has expired. Refresh the page for a new one.'; return; }
      const result = await request('/exchange', 'POST');
      if (result.status === 202) { timer = setTimeout(() => poll().catch(problem), Math.min(3000, Math.max(0, expiresAt - Date.now()))); return; }
      if (result.status !== 200) throw new Error(result.body.error);
      const snapshot = await request('/snapshot');
      if (snapshot.status !== 200) throw new Error(snapshot.body.error);
      show(snapshot.body);
    };
    timer = setTimeout(() => poll().catch(problem), 3000);
  };
  signout.addEventListener('click', async () => {
    clearTimeout(timer);
    try {
      const result = await request('/signout', 'POST');
      if (result.status !== 200) throw new Error(result.body.error);
      members.replaceChildren();
      signout.hidden = true;
      message.textContent = 'Signed out. Refresh the page to connect again.';
    } catch (error) { problem(error); }
  });
  start().catch(problem);
})();`
