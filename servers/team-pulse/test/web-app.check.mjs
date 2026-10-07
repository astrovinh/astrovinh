import assert from 'node:assert/strict'
import vm from 'node:vm'
import { webApp } from '../src/web.ts'

// Execute the served script with a small DOM fixture and controlled requests/timers.
const ok = (now = 1000, work = 'First work') => ({ status: 200, html: `<section data-view data-snapshot-now="${now}"><article data-member="alice">${work}</article><article data-member="bob">Other work</article></section>` })
const run = async (responses, now = 1000, visible = true) => {
  let document
  class Element {
    constructor(dataset = {}) {
      this.dataset = dataset; this.children = []; this.hidden = false; this.attributes = {}; this.events = {}; this.text = ''; this.replacements = 0
      const classes = new Set()
      this.classList = { toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) }
    }
    get textContent() { return this.text + this.children.map(c => c.textContent).join('') }
    set textContent(value) { this.text = value; this.children = [] }
    replaceChildren(...items) { this.replacements++; this.text = ''; this.children = []; items.forEach(item => this.appendChild(item)) }
    appendChild(item) { item.parent = this; this.children.push(item) }
    addEventListener(event, action) { this.events[event] = action }
    setAttribute(name, value) { this.attributes[name] = value }
    getAttribute(name) { return this.attributes[name] ?? null }
    matches(selector) {
      if (selector === 'button') return this.tag === 'button'
      const match = /^\[data-([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector)
      if (!match) throw new Error('Unsupported fixture selector ' + selector)
      const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      return key in this.dataset && (match[2] === undefined || this.dataset[key] === match[2])
    }
    closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) ?? null }
    querySelectorAll(selector) { return this.children.flatMap(c => [...(c.matches(selector) ? [c] : []), ...c.querySelectorAll(selector)]) }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }
    contains(element) { return this === element || this.children.some(c => c.contains(element)) }
    focus() { document.activeElement = this }
  }
  const button = action => { const b = new Element({ action }); b.tag = 'button'; return b }
  const elements = Object.fromEntries(['connect', 'message', 'code', 'instruction', 'new-code', 'team-view', 'banner', 'members', 'signout'].map(id => [id, new Element()]))
  elements['team-view'].hidden = true; elements.banner.hidden = true; elements['new-code'].hidden = true
  const timers = new Map(); let timerId = 0
  const calls = []
  const settle = async () => { for (let n = 0; n < 80; n++) await Promise.resolve() }
  document = {
    visibilityState: visible ? 'visible' : 'hidden', activeElement: null, events: {},
    getElementById: id => elements[id], addEventListener(event, action) { this.events[event] = action },
    createElement(tag) {
      assert.equal(tag, 'template')
      const template = { content: {} }
      Object.defineProperty(template, 'innerHTML', { set(html) {
        const root = new Element({ view: '', snapshotNow: /data-snapshot-now="(\d+)"/.exec(html)[1] })
        root.appendChild(button('hide')); root.appendChild(button('signout')); root.appendChild(new Element({ cover: '' })); root.appendChild(new Element({ snapshotTime: '' }))
        for (const [, id, text] of html.matchAll(/data-member="([^"]+)">([^<]*)/g)) {
          const row = new Element({ member: id }); row.text = text
          const more = button('more'); more.text = 'More'; more.setAttribute('aria-expanded', 'false')
          const details = new Element({ details: '' }); details.hidden = true
          row.appendChild(more); row.appendChild(details); root.appendChild(row)
        }
        template.content.firstElementChild = root
      } })
      return template
    }
  }
  const context = {
    location: { pathname: '/web/abcdefghij/' }, document,
    Date: class extends Date { static now() { return now } }, Intl, AbortSignal,
    setTimeout: (action, delay) => { timers.set(++timerId, { action, delay, at: now + delay }); return timerId }, clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => {
      calls.push({ url, options })
      const response = responses.shift(); assert.ok(response, 'Unexpected request to ' + url)
      const result = typeof response === 'function' ? await response() : response
      if (result instanceof Error) throw result
      return { status: result.status, json: async () => result.body, text: async () => result.html }
    }
  }
  vm.runInNewContext(webApp, context); await settle()
  return {
    elements, calls, responses, timers, settle, setNow(value) { now = value },
    async tick() {
      const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0] ?? []
      assert.ok(timer, 'Expected a scheduled poll'); timers.delete(id); now = timer.at
      await timer.action(); await settle(); return timer.delay
    },
    async visibility(state) { document.visibilityState = state; await document.events.visibilitychange(); await settle() },
    async click(action, id) {
      const row = id ? elements['team-view'].querySelectorAll('[data-member]').find(r => r.dataset.member === id) : elements['team-view']
      const target = row.querySelector(`[data-action="${action}"]`); assert.ok(target, 'Missing button ' + action)
      target.focus(); await elements['team-view'].events.click({ target }); await settle(); return target
    },
    async newCode() { await elements['new-code'].events.click(); await settle() }, get activeElement() { return document.activeElement }
  }
}

const loaded = await run([ok()])
assert.equal(loaded.calls[0].url, '/web/abcdefghij/view', 'load reads the authenticated rendered view')
assert.equal(loaded.elements['team-view'].hidden, false); assert.equal(loaded.elements.connect.hidden, true)
assert.equal([...loaded.timers.values()][0].delay, 30000)
assert.equal(loaded.elements['team-view'].querySelector('[data-snapshot-time]').textContent, new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(1000))
const more = await loaded.click('more', 'alice'); assert.equal(more.getAttribute('aria-expanded'), 'true')
await loaded.click('hide'); loaded.responses.push(ok(31000, 'Updated work')); await loaded.tick()
assert.equal(loaded.elements['team-view'].querySelector('[data-member="alice"]').querySelector('[data-details]').hidden, false)
assert.equal(loaded.elements['team-view'].querySelector('[data-cover]').hidden, false)
assert.equal(loaded.elements['team-view'].querySelector('[data-action="hide"]').textContent, 'Show view')
await loaded.click('hide'); assert.equal(loaded.elements['team-view'].querySelector('[data-cover]').hidden, true)
await loaded.click('more', 'alice'); await loaded.click('more', 'alice')
loaded.responses.push(ok(61000, 'Next work')); await loaded.tick()
assert.equal(loaded.activeElement?.dataset.action, 'more', 'refresh preserves keyboard focus')
const replacements = loaded.elements['team-view'].replacements
loaded.responses.push(ok(61000, 'Next work')); await loaded.tick()
assert.equal(loaded.elements['team-view'].replacements, replacements, 'unchanged view is not replaced')
loaded.responses.push({ status: 429 }); assert.equal(await loaded.tick(), 30000)
assert.equal(loaded.elements.banner.hidden, true); assert.equal(loaded.elements['team-view'].replacements, replacements)
for (let n = 0; n < 5; n++) {
  loaded.responses.push(new Error('network lost')); await loaded.tick()
  assert.equal([...loaded.timers.values()][0].delay, [30000, 60000, 120000, 300000, 300000][n])
  assert.match(loaded.elements.banner.textContent, /^Offline \u00b7 showing the view from .+ \u00b7 retrying$/)
  assert.equal(loaded.elements['team-view'].replacements, replacements, 'network loss preserves rows and statuses')
}
loaded.responses.push(ok(999000, 'Recovered')); await loaded.tick()
assert.equal(loaded.elements.banner.hidden, true); assert.equal([...loaded.timers.values()][0].delay, 30000)

const visibility = await run([ok()]); await visibility.visibility('hidden'); assert.equal(visibility.timers.size, 0)
visibility.setNow(20000); await visibility.visibility('visible'); assert.equal(visibility.calls.length, 1)
assert.equal([...visibility.timers.values()][0].delay, 11000)
await visibility.visibility('hidden'); visibility.setNow(32001); visibility.responses.push(ok(32001)); await visibility.visibility('visible')
assert.equal(visibility.calls.length, 2, 'stale view refreshes once on becoming visible')
const hiddenLoad = await run([], 1000, false); assert.equal(hiddenLoad.calls.length, 0)
hiddenLoad.responses.push(ok()); await hiddenLoad.visibility('visible'); assert.equal(hiddenLoad.calls.length, 1)
let resolveView
const concurrent = await run([() => new Promise(resolve => { resolveView = resolve })])
await concurrent.visibility('hidden'); await concurrent.visibility('visible'); await concurrent.visibility('visible')
assert.equal(concurrent.calls.length, 1, 'never overlap requests'); resolveView(ok()); await concurrent.settle()
assert.equal(concurrent.elements['team-view'].hidden, false)

const signedOut = await run([ok()])
signedOut.responses.push({ status: 403 }, { status: 200, body: { code: 'ABC234', expiresAt: 601000 } }); await signedOut.tick()
assert.equal(signedOut.elements['team-view'].children.length, 0, '403 clears team DOM content')
assert.equal(signedOut.elements['team-view'].hidden, true); assert.equal(signedOut.elements.connect.hidden, false)
assert.equal(signedOut.elements.code.textContent, 'ABC234')
assert.equal(signedOut.elements.instruction.textContent, 'In Claude Code, type /team web ABC234')
assert.equal([...signedOut.timers.values()][0].delay, 3000)
signedOut.responses.push({ status: 202 }); await signedOut.tick(); assert.equal([...signedOut.timers.values()][0].delay, 3000)
signedOut.responses.push({ status: 200 }, ok(37000)); await signedOut.tick()
assert.equal(signedOut.elements.connect.hidden, true); assert.equal(signedOut.elements['team-view'].hidden, false)
signedOut.responses.push({ status: 200 }, { status: 200, body: { code: 'DEF234', expiresAt: 700000 } }); await signedOut.click('signout')
assert.equal(signedOut.elements['team-view'].children.length, 0); assert.equal(signedOut.elements.code.textContent, 'DEF234')
assert.equal(signedOut.calls.at(-2).url, '/web/abcdefghij/signout')
const expired = await run([{ status: 403 }, { status: 200, body: { code: 'ABC234', expiresAt: 2000 } }]); await expired.tick()
assert.equal(expired.calls.length, 2); assert.equal(expired.timers.size, 0)
assert.equal(expired.elements.message.textContent, 'That code has expired'); assert.equal(expired.elements['new-code'].hidden, false)
expired.responses.push({ status: 200, body: { code: 'DEF234', expiresAt: 602000 } }); await expired.newCode()
assert.equal(expired.elements.code.textContent, 'DEF234'); assert.equal(expired.elements['new-code'].hidden, true)

// A late view may not put team content back after the user clicks Sign out.
let resolveLate
const late = await run([ok()]); late.responses.push(() => new Promise(resolve => { resolveLate = resolve }))
const polling = late.tick(); await late.settle()
late.responses.push({ status: 200 }, { status: 200, body: { code: 'DEF234', expiresAt: 700000 } }); await late.click('signout')
assert.equal(late.elements['team-view'].children.length, 0); assert.equal(late.calls.length, 2, 'signout waits for the current request')
resolveLate(ok(31000, 'Must not return')); await polling; await late.settle()
assert.equal(late.elements['team-view'].children.length, 0); assert.equal(late.calls[2].url, '/web/abcdefghij/signout')
for (const app of [loaded, visibility, hiddenLoad, concurrent, signedOut, expired, late]) {
  for (const call of app.calls) {
    assert.equal(call.options.credentials, 'same-origin'); assert.equal(call.options.cache, 'no-store')
    assert.equal(call.options.headers, undefined, 'no member keys in the browser')
  }
}
console.log('PASS: served app, connect/exchange/expiry/signout, visibility, no overlap, backoff, 429, cleared DOM, late responses, open rows, hide cover, local time and focus')
