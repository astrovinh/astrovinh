import assert from 'node:assert/strict'
import vm from 'node:vm'
import { webApp } from '../src/web.ts'

const run = async (responses, now = 1000) => {
  const elements = Object.fromEntries(['message', 'members', 'signout'].map(id => [id, {
    textContent: '', children: [], hidden: true,
    replaceChildren() { this.children = [] },
    appendChild(item) { this.children.push(item) },
    addEventListener(event, action) { this[event] = action }
  }]))
  const calls = []
  const timers = []
  const context = {
    location: { pathname: '/web/abcdefghij/' },
    document: { getElementById: id => elements[id], createElement: () => ({ textContent: '' }) },
    Date: { now: () => now },
    setTimeout: (action, delay) => { timers.push({ action, delay }); return timers.length },
    clearTimeout: () => {},
    fetch: async (url, options) => {
      calls.push({ url, options })
      const response = responses.shift()
      assert.ok(response, 'Unexpected request')
      return { status: response.status, json: async () => response.body }
    }
  }
  const settle = async () => { for (let n = 0; n < 20; n++) await Promise.resolve() }
  vm.runInNewContext(webApp, context)
  await settle()
  return { elements, calls, timers, settle, setNow: value => { now = value } }
}

// Timers are manual so polling can be checked without waiting.
const waiting = await run([
  { status: 403, body: {} },
  { status: 200, body: { code: 'ABC234', expiresAt: 601000 } },
  { status: 202, body: { waiting: true } },
  { status: 200, body: { ok: true } },
  { status: 200, body: { members: [{ name: '<script>plain text</script>' }, { name: 'Linh' }] } },
  { status: 200, body: { ok: true } }
])
await waiting.timers.shift().action()
await waiting.settle()
assert.equal(waiting.elements.signout.hidden, true)
const next = waiting.timers.shift()
assert.equal(next.delay, 3000)
await next.action()
await waiting.settle()
assert.equal(waiting.elements.signout.hidden, false)
assert.deepEqual(waiting.elements.members.children.map(item => item.textContent), ['<script>plain text</script>', 'Linh'])
await waiting.elements.signout.click()
assert.equal(waiting.elements.signout.hidden, true)
assert.equal(waiting.elements.members.children.length, 0)
assert.deepEqual(waiting.calls.map(call => call.url), [
  '/web/abcdefghij/snapshot', '/web/abcdefghij/challenge', '/web/abcdefghij/exchange',
  '/web/abcdefghij/exchange', '/web/abcdefghij/snapshot', '/web/abcdefghij/signout'
])
for (const call of waiting.calls) {
  assert.equal(call.options.credentials, 'same-origin')
  assert.equal(call.options.cache, 'no-store')
  assert.equal(call.options.headers, undefined)
}
const signedIn = await run([{ status: 200, body: { members: [{ name: 'Astro' }] } }])
assert.equal(signedIn.calls.length, 1)
assert.equal(signedIn.elements.signout.hidden, false)
const expired = await run([
  { status: 403, body: {} },
  { status: 200, body: { code: 'ABC234', expiresAt: 2000 } }
])
expired.setNow(2000)
await expired.timers.shift().action()
await expired.settle()
assert.equal(expired.calls.length, 2)
assert.equal(expired.timers.length, 0)
assert.match(expired.elements.message.textContent, /expired/)
console.log('PASS: executable placeholder, challenge/poll/snapshot/signout, existing session, expiry, safe names and cookie-only fetches')
