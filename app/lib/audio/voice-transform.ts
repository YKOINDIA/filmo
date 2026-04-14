import type { VoiceMode } from '../voice-modes'

function clampSample(value: number) {
  if (value > 1) return 1
  if (value < -1) return -1
  return value
}

function encodeWav(buffer: AudioBuffer) {
  const channelCount = buffer.numberOfChannels
  const sampleCount = buffer.length
  const bytesPerSample = 2
  const blockAlign = channelCount * bytesPerSample
  const dataSize = sampleCount * blockAlign
  const fileBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(fileBuffer)

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const channelData = buffer.getChannelData(channelIndex)
      const sample = clampSample(channelData[sampleIndex] ?? 0)
      const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, value, true)
      offset += bytesPerSample
    }
  }

  return new Blob([fileBuffer], { type: 'audio/wav' })
}

function applyHighMode(source: AudioBuffer, target: AudioBuffer) {
  for (let ch = 0; ch < target.numberOfChannels; ch++) {
    const src = source.getChannelData(ch)
    const dst = target.getChannelData(ch)
    for (let i = 0; i < target.length; i++) {
      dst[i] = src[Math.min(source.length - 1, Math.floor(i / 1.18))] ?? 0
    }
  }
}

function applyLowMode(source: AudioBuffer, target: AudioBuffer) {
  for (let ch = 0; ch < target.numberOfChannels; ch++) {
    const src = source.getChannelData(ch)
    const dst = target.getChannelData(ch)
    for (let i = 0; i < target.length; i++) {
      dst[i] = src[Math.min(source.length - 1, Math.floor(i * 1.12))] ?? 0
    }
  }
}

function applyRobotMode(source: AudioBuffer, target: AudioBuffer) {
  for (let ch = 0; ch < target.numberOfChannels; ch++) {
    const src = source.getChannelData(ch)
    const dst = target.getChannelData(ch)
    for (let i = 0; i < target.length; i++) {
      const sample = src[i] ?? 0
      const mod = Math.sin((2 * Math.PI * 90 * i) / target.sampleRate)
      dst[i] = clampSample(sample * 0.65 + sample * mod * 0.35)
    }
  }
}

async function applyTelephoneMode(source: AudioBuffer) {
  const renderer = new OfflineAudioContext(source.numberOfChannels, source.length, source.sampleRate)
  const bufferSource = renderer.createBufferSource()
  bufferSource.buffer = source

  const highpass = renderer.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 550

  const lowpass = renderer.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 2800

  bufferSource.connect(highpass)
  highpass.connect(lowpass)
  lowpass.connect(renderer.destination)
  bufferSource.start(0)

  return renderer.startRendering()
}

export async function transformVoiceBlob(blob: Blob, mode: VoiceMode) {
  if (mode === 'original') return blob

  const sourceContext = new AudioContext()
  try {
    const audioBuffer = await sourceContext.decodeAudioData(await blob.arrayBuffer())

    if (mode === 'telephone') {
      const rendered = await applyTelephoneMode(audioBuffer)
      return encodeWav(rendered)
    }

    const rendered = new AudioBuffer({
      length: audioBuffer.length,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
    })

    if (mode === 'high') {
      applyHighMode(audioBuffer, rendered)
      return encodeWav(rendered)
    }
    if (mode === 'low') {
      applyLowMode(audioBuffer, rendered)
      return encodeWav(rendered)
    }

    applyRobotMode(audioBuffer, rendered)
    return encodeWav(rendered)
  } finally {
    await sourceContext.close()
  }
}
