import type { PartySettings, PartySize } from '../types'

export const DEFAULT_SETTINGS: PartySettings = { motion: true, size: 'small' }
export const SIZE_PX: Record<PartySize, number> = { tiny: 24, small: 36, medium: 48 }
export const COMMANDS = '/party: open or close the panel in all sessions\n/party motion on|off: turn animation on or off\n/party size tiny|small|medium: choose animal size\n/party help: show these commands'
