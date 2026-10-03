export type Segment = { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' | 'deferred' }
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Spend = { week: number; today: number; sessionsToday: number; session: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-bars': {
      segments: Segment[]
      window: number
      contextPercent: number | null
      limits: Limit[]
      spend: Spend | null
    }
  }
}
