/**
 * Inspects binary magic bytes first (and declared MIME type as fallback) so saved media filenames
 * and HTML `data:` URIs always match the true binary payload (e.g., JPEG `\xFF\xD8\xFF` -> `.jpg` / `image/jpeg`).
 */
export function detectMediaMimeAndExtension(
  buffer: Buffer,
  declaredMime?: string,
  fallbackKind: 'image' | 'audio' = 'image'
): { mimeType: string; ext: string } {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mimeType: 'image/jpeg', ext: '.jpg' };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: 'image/png', ext: '.png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', ext: '.webp' };
  }
  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return { mimeType: 'image/gif', ext: '.gif' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return { mimeType: 'audio/wav', ext: '.wav' };
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS') {
    return { mimeType: 'audio/ogg', ext: '.ogg' };
  }
  if (
    buffer.length >= 3 &&
    (buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
      (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))
  ) {
    return { mimeType: 'audio/mpeg', ext: '.mp3' };
  }

  const normMime = String(declaredMime || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (normMime === 'image/jpeg' || normMime === 'image/jpg') {
    return { mimeType: 'image/jpeg', ext: '.jpg' };
  }
  if (normMime === 'image/png') {
    return { mimeType: 'image/png', ext: '.png' };
  }
  if (normMime === 'image/webp') {
    return { mimeType: 'image/webp', ext: '.webp' };
  }
  if (normMime === 'image/gif') {
    return { mimeType: 'image/gif', ext: '.gif' };
  }
  if (normMime === 'audio/wav' || normMime === 'audio/x-wav' || normMime === 'audio/wave') {
    return { mimeType: 'audio/wav', ext: '.wav' };
  }
  if (normMime === 'audio/mp3' || normMime === 'audio/mpeg') {
    return { mimeType: 'audio/mpeg', ext: '.mp3' };
  }
  if (normMime === 'audio/ogg' || normMime === 'audio/ogg_opus' || normMime === 'audio/opus') {
    return { mimeType: 'audio/ogg', ext: '.ogg' };
  }
  if (normMime === 'audio/l16' || normMime === 'audio/pcm') {
    return { mimeType: 'audio/l16', ext: '.pcm' };
  }

  return fallbackKind === 'audio'
    ? { mimeType: 'audio/wav', ext: '.wav' }
    : { mimeType: 'image/jpeg', ext: '.jpg' };
}

/**
 * Wraps raw 16-bit little-endian mono PCM bytes (`audio/l16`) in a standard 44-byte RIFF WAVE header
 * so HTML5 `<audio>` elements can play raw PCM responses natively without external codecs.
 */
export function wrapPcm16InWavHeader(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  numChannels: number = 1
): Buffer {
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM = 1
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

export interface WavAudioMetadata {
  isWav: boolean;
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataBytes: number;
  durationSeconds: number;
}

/**
 * Parses RIFF/WAVE sub-chunks (`fmt ` and `data`, safely skipping auxiliary chunks such as `LIST` or `INFO`)
 * to extract exact sample rate, channel count, bit depth, PCM payload offset/size, and duration in seconds.
 */
export function parseWavMetadata(wavBuffer: Buffer): WavAudioMetadata {
  const empty: WavAudioMetadata = {
    isWav: false,
    audioFormat: 0,
    channels: 0,
    sampleRate: 0,
    bitsPerSample: 0,
    dataOffset: 0,
    dataBytes: 0,
    durationSeconds: 0,
  };
  if (
    !Buffer.isBuffer(wavBuffer) ||
    wavBuffer.length < 44 ||
    wavBuffer.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    wavBuffer.subarray(8, 12).toString('ascii') !== 'WAVE'
  ) {
    return empty;
  }

  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataBytes = 0;
  let offset = 12;

  while (offset + 8 <= wavBuffer.length) {
    const chunkId = wavBuffer.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;

    if (chunkId === 'fmt ' && payloadOffset + 16 <= wavBuffer.length) {
      audioFormat = wavBuffer.readUInt16LE(payloadOffset);
      channels = wavBuffer.readUInt16LE(payloadOffset + 2);
      sampleRate = wavBuffer.readUInt32LE(payloadOffset + 4);
      bitsPerSample = wavBuffer.readUInt16LE(payloadOffset + 14);
    } else if (chunkId === 'data') {
      dataOffset = payloadOffset;
      dataBytes = Math.max(0, Math.min(chunkSize, wavBuffer.length - payloadOffset));
    }

    if (sampleRate > 0 && dataOffset > 0) break;
    const step = 8 + chunkSize + (chunkSize % 2);
    if (step < 8 || offset + step <= offset) break;
    offset += step;
  }

  if (sampleRate <= 0 || channels <= 0 || bitsPerSample <= 0 || dataOffset <= 0) {
    return empty;
  }

  const bytesPerSec = sampleRate * channels * (bitsPerSample / 8);
  const durationSeconds =
    bytesPerSec > 0 && dataBytes > 0 ? Number((dataBytes / bytesPerSec).toFixed(2)) : 0;

  return {
    isWav: true,
    audioFormat,
    channels,
    sampleRate,
    bitsPerSample,
    dataOffset,
    dataBytes,
    durationSeconds,
  };
}

/**
 * Downsamples a 16-bit PCM RIFF/WAVE buffer (e.g. `24 kHz -> 12 kHz` mono) using a 5-tap binomial
 * anti-aliasing FIR low-pass filter (`[1, 4, 6, 4, 1] / 16`) for compact HTML `data:audio/wav;base64,...`
 * embedding while keeping lossless 24 kHz `.wav` master files untouched on disk.
 */
export function resampleWav16BitMono(
  wavBuffer: Buffer,
  targetSampleRate: number = 12000
): Buffer {
  const meta = parseWavMetadata(wavBuffer);
  if (
    !meta.isWav ||
    meta.audioFormat !== 1 ||
    meta.bitsPerSample !== 16 ||
    meta.channels < 1 ||
    meta.sampleRate <= targetSampleRate ||
    meta.dataBytes < 4 ||
    targetSampleRate < 4000
  ) {
    return wavBuffer;
  }

  const bytesPerFrame = meta.channels * 2;
  const inFrames = Math.floor(meta.dataBytes / bytesPerFrame);
  if (inFrames < 2) return wavBuffer;

  const readMonoSample = (frameIdx: number): number => {
    const clamped = frameIdx < 0 ? 0 : frameIdx >= inFrames ? inFrames - 1 : frameIdx;
    const base = meta.dataOffset + clamped * bytesPerFrame;
    if (meta.channels === 1) {
      return wavBuffer.readInt16LE(base);
    }
    let sum = 0;
    for (let ch = 0; ch < meta.channels; ch++) {
      sum += wavBuffer.readInt16LE(base + ch * 2);
    }
    return Math.round(sum / meta.channels);
  };

  const filterSample = (k: number): number =>
    (readMonoSample(k - 2) +
      4 * readMonoSample(k - 1) +
      6 * readMonoSample(k) +
      4 * readMonoSample(k + 1) +
      readMonoSample(k + 2)) /
    16;

  const ratio = meta.sampleRate / targetSampleRate;
  const outFrames = Math.max(1, Math.floor(inFrames / ratio));
  const outPcm: Buffer = Buffer.allocUnsafe(outFrames * 2);
  const isExactHalf = Math.abs(ratio - 2) < 1e-6;

  for (let i = 0; i < outFrames; i++) {
    let val: number;
    if (isExactHalf) {
      val = Math.round(filterSample(i * 2));
    } else {
      const srcPos = i * ratio;
      const idx0 = Math.floor(srcPos);
      const frac = srcPos - idx0;
      val = Math.round(filterSample(idx0) * (1 - frac) + filterSample(idx0 + 1) * frac);
    }
    const clampedVal = val < -32768 ? -32768 : val > 32767 ? 32767 : val;
    outPcm.writeInt16LE(clampedVal, i * 2);
  }

  return wrapPcm16InWavHeader(outPcm, targetSampleRate, 1);
}

/**
 * Extracts normalized 16-bit little-endian mono PCM bytes from any standard RIFF/WAVE buffer
 * (supporting 8/16/24/32-bit integer PCM `audioFormat=1` and 32-bit IEEE float `audioFormat=3`,
 * stereo/multi-channel downmixing, and optional anti-aliased downsampling or linear upsampling to `targetSampleRate`).
 */
export function extractNormalizedMono16PcmFromWav(
  wavBuffer: Buffer,
  targetSampleRate?: number
): { pcm: Buffer; sampleRate: number } | null {
  const meta = parseWavMetadata(wavBuffer);
  if (
    !meta.isWav ||
    (meta.audioFormat !== 1 && meta.audioFormat !== 3) ||
    meta.channels < 1 ||
    meta.sampleRate < 4000 ||
    meta.dataBytes < 2
  ) {
    return null;
  }

  const outRate =
    targetSampleRate && targetSampleRate >= 4000 ? Math.round(targetSampleRate) : meta.sampleRate;

  // Fast zero-copy path for already-normalized 16-bit mono PCM at the target sample rate
  if (
    meta.audioFormat === 1 &&
    meta.bitsPerSample === 16 &&
    meta.channels === 1 &&
    outRate === meta.sampleRate
  ) {
    const evenBytes = meta.dataBytes - (meta.dataBytes % 2);
    return {
      pcm: wavBuffer.subarray(meta.dataOffset, meta.dataOffset + evenBytes),
      sampleRate: meta.sampleRate,
    };
  }

  const bytesPerSample = Math.floor(meta.bitsPerSample / 8);
  if (bytesPerSample < 1) return null;
  const bytesPerFrame = meta.channels * bytesPerSample;
  const inFrames = Math.floor(meta.dataBytes / bytesPerFrame);
  if (inFrames < 1) return null;

  const readChannelAsInt16 = (bytePos: number): number => {
    if (meta.audioFormat === 3 && meta.bitsPerSample === 32) {
      const f = wavBuffer.readFloatLE(bytePos);
      if (!Number.isFinite(f)) return 0;
      const scaled = Math.round(f * 32767);
      return scaled < -32768 ? -32768 : scaled > 32767 ? 32767 : scaled;
    }
    if (meta.bitsPerSample === 16) {
      return wavBuffer.readInt16LE(bytePos);
    }
    if (meta.bitsPerSample === 8) {
      return (wavBuffer.readUInt8(bytePos) - 128) << 8;
    }
    if (meta.bitsPerSample === 24) {
      const b0 = wavBuffer.readUInt8(bytePos);
      const b1 = wavBuffer.readUInt8(bytePos + 1);
      const b2 = wavBuffer.readInt8(bytePos + 2);
      const v24 = (b2 << 16) | (b1 << 8) | b0;
      return v24 >> 8;
    }
    if (meta.bitsPerSample === 32) {
      return wavBuffer.readInt32LE(bytePos) >> 16;
    }
    return 0;
  };

  const readMonoFrame = (frameIdx: number): number => {
    const clamped = frameIdx < 0 ? 0 : frameIdx >= inFrames ? inFrames - 1 : frameIdx;
    const base = meta.dataOffset + clamped * bytesPerFrame;
    if (meta.channels === 1) {
      return readChannelAsInt16(base);
    }
    let sum = 0;
    for (let ch = 0; ch < meta.channels; ch++) {
      sum += readChannelAsInt16(base + ch * bytesPerSample);
    }
    return Math.round(sum / meta.channels);
  };

  if (outRate === meta.sampleRate) {
    const outPcm = Buffer.allocUnsafe(inFrames * 2);
    for (let i = 0; i < inFrames; i++) {
      outPcm.writeInt16LE(readMonoFrame(i), i * 2);
    }
    return { pcm: outPcm, sampleRate: outRate };
  }

  const ratio = meta.sampleRate / outRate;
  const outFrames = Math.max(1, Math.round(inFrames / ratio));
  const outPcm = Buffer.allocUnsafe(outFrames * 2);
  const useLowPass = ratio > 1.001;
  const sampleAt = (k: number): number =>
    useLowPass
      ? (readMonoFrame(k - 2) +
          4 * readMonoFrame(k - 1) +
          6 * readMonoFrame(k) +
          4 * readMonoFrame(k + 1) +
          readMonoFrame(k + 2)) /
        16
      : readMonoFrame(k);

  for (let i = 0; i < outFrames; i++) {
    const srcPos = i * ratio;
    const idx0 = Math.floor(srcPos);
    const frac = srcPos - idx0;
    const val = Math.round(sampleAt(idx0) * (1 - frac) + sampleAt(idx0 + 1) * frac);
    const clampedVal = val < -32768 ? -32768 : val > 32767 ? 32767 : val;
    outPcm.writeInt16LE(clampedVal, i * 2);
  }

  return { pcm: outPcm, sampleRate: outRate };
}
