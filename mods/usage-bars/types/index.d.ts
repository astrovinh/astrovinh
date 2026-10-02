export type Segment = { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' | 'deferred' }
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'usage-bars': {
      segments: Segment[]
      window: number
      contextPercent: number | null
      limits: Limit[]
    }
  }
}
