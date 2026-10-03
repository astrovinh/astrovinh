// The "working on" line: written on this Mac by a small model from the latest prompt.

import { LINE_EVERY_MS } from './config'
import { cap, LIMITS } from './share'

const SYSTEM =
  'Summarize what this developer is working on in 4 to 8 plain words, sentence case, no ending punctuation, no quotes. ' +
  'Never include names, secrets, file contents or code. If the message does not describe any work (a greeting, a test message, a question about you, or too little to tell), reply with exactly NONE. Reply with the summary or NONE only.'

export function lineDue(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= LINE_EVERY_MS
}

export function lineRequest(prompt: string) {
  return { model: 'haiku', system: SYSTEM, prompt: prompt.slice(0, 2000), maxTokens: 30 }
}

export function cleanLine(text: string): string | null {
  const first = (text.split('\n').find(l => l.trim()) ?? '').trim()
  const bare = first.replace(/^["'\u201c\u201d\u2018\u2019`]+|["'\u201c\u201d\u2018\u2019`]+$/g, '').replace(/[.!?;:,]+$/, '').trim()
  return bare && !/^none\b/i.test(bare) ? cap(bare, LIMITS.line) : null
}

export function fallbackLine(project: string, branch: string): string {
  return branch ? `${project} \u00b7 ${branch}` : project
}
