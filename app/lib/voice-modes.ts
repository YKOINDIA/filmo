export const FREE_VOICE_MODES = ['original', 'high', 'low'] as const
export const PREMIUM_VOICE_MODES = ['robot', 'telephone'] as const
export const ALL_VOICE_MODES = [...FREE_VOICE_MODES, ...PREMIUM_VOICE_MODES] as const

export type VoiceMode = (typeof ALL_VOICE_MODES)[number]

export type VoiceModeOption = {
  value: VoiceMode
  label: string
  description: string
}

const VOICE_MODE_DETAILS: Record<VoiceMode, VoiceModeOption> = {
  original: {
    value: 'original',
    label: '地声',
    description: 'そのままの声でレビューします。',
  },
  high: {
    value: 'high',
    label: '匿名ボイス 高',
    description: '少し高めで軽い印象の匿名ボイスです。',
  },
  low: {
    value: 'low',
    label: '匿名ボイス 低',
    description: '落ち着いた低めの匿名ボイスです。',
  },
  robot: {
    value: 'robot',
    label: 'ロボット',
    description: '機械っぽく加工した匿名ボイスです。',
  },
  telephone: {
    value: 'telephone',
    label: '通話風',
    description: '帯域を絞った電話っぽい匿名ボイスです。',
  },
}

export function getVoiceModeOptions(isPremium: boolean) {
  const values = isPremium ? ALL_VOICE_MODES : FREE_VOICE_MODES
  return values.map(value => VOICE_MODE_DETAILS[value])
}

export function isVoiceModeAllowed(value: string, isPremium: boolean): value is VoiceMode {
  return getVoiceModeOptions(isPremium).some(option => option.value === value)
}

export function getVoiceModeLabel(value: string) {
  return VOICE_MODE_DETAILS[value as VoiceMode]?.label ?? value
}
