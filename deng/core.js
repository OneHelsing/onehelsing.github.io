// Lekla Stüdyo: saf mantık (DOM'suz). Tarayıcı ve Node testleri aynı dosyayı kullanır.
// SPEC 6.3. Değişiklikten sonra: node --test apps/anadil/studio/test/

/** "#k=..." parçasından anahtarı alır; yoksa null. */
export function parseKey(hash) {
  const m = /(?:^#|&)k=([A-Za-z0-9_-]{4,128})(?:&|$)/.exec(hash || '');
  return m ? m[1] : null;
}

/** SHA-256 onaltılık (küçük harf). Tarayıcıda ve Node 20+'da crypto.subtle var. */
export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * TTS eğitimi için normalleştirilmiş metin: küçük harf (Kurmancî: I→i, Î→î;
 * Türkçe i/İ kuralı uygulanmaz), noktalama yok, tek boşluk.
 */
export function normalizeText(s) {
  return String(s)
    .replace(/I/g, 'i')
    .replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/[.,!?;:"“”„«»()…–—]/g, ' ')
    .replace(/(^|\s)['’-]+|['’-]+(\s|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function concatChunks(chunks) {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Float32Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Mono PCM WAV (16 ya da 24 bit). Arşiv için varsayılan 24 bit. */
export function encodeWav(samples, sampleRate, bits = 24) {
  const bps = bits / 8;
  const dataLen = samples.length * bps;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataLen, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * bps, true);
  v.setUint16(32, bps, true);
  v.setUint16(34, bits, true);
  str(36, 'data');
  v.setUint32(40, dataLen, true);
  const max = bits === 24 ? 8388607 : 32767;
  let o = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const x = Math.round(s < 0 ? s * (max + 1) : s * max);
    if (bits === 24) {
      v.setUint8(o, x & 0xff);
      v.setUint8(o + 1, (x >> 8) & 0xff);
      v.setUint8(o + 2, (x >> 16) & 0xff);
    } else {
      v.setInt16(o, x, true);
    }
    o += bps;
  }
  return new Uint8Array(buf);
}

/** PCM WAV çözücü (8/16/24/32 bit tamsayı, 32 bit float). İlk kanalı döndürür. */
export function decodeWav(u8) {
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const tag = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('WAV değil');
  let o = 12;
  let fmt = null;
  while (o + 8 <= u8.length) {
    const id = tag(o);
    const len = v.getUint32(o + 4, true);
    const body = o + 8;
    if (id === 'fmt ') {
      fmt = {
        format: v.getUint16(body, true),
        channels: v.getUint16(body + 2, true),
        sampleRate: v.getUint32(body + 4, true),
        bits: v.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      if (!fmt) throw new Error('fmt yok');
      const bps = fmt.bits / 8;
      const frame = bps * fmt.channels;
      const n = Math.floor(Math.min(len, u8.length - body) / frame);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const p = body + i * frame;
        let x;
        if (fmt.format === 3) x = v.getFloat32(p, true);
        else if (fmt.bits === 16) x = v.getInt16(p, true) / 32768;
        else if (fmt.bits === 24) {
          let t = u8[p] | (u8[p + 1] << 8) | (u8[p + 2] << 16);
          if (t & 0x800000) t |= ~0xffffff;
          x = t / 8388608;
        } else if (fmt.bits === 32) x = v.getInt32(p, true) / 2147483648;
        else x = (u8[p] - 128) / 128;
        out[i] = x;
      }
      return { ...fmt, samples: out };
    }
    o = body + len + (len & 1);
  }
  throw new Error('data yok');
}

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -120);

/**
 * Kaydı ölçer: tepe, kırpılma, gürültü tabanı, konuşmanın başı/sonu, kırpma önerisi.
 * 20 ms'lik çerçeve enerjisiyle; eşik gürültü tabanının 15 dB üstü.
 */
export function analyze(samples, sampleRate) {
  const n = samples.length;
  const duration = n / sampleRate;
  let peak = 0;
  let clip = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
    if (a >= 0.999) clip++;
    sumSq += samples[i] * samples[i];
  }
  const fl = Math.max(1, Math.round(sampleRate * 0.02));
  const frames = [];
  for (let s = 0; s + fl <= n; s += fl) {
    let e = 0;
    for (let i = s; i < s + fl; i++) e += samples[i] * samples[i];
    frames.push(10 * Math.log10(e / fl + 1e-12));
  }
  const sorted = [...frames].sort((a, b) => a - b);
  const floorDb = sorted.length ? sorted[Math.floor(sorted.length * 0.1)] : -120;
  const thr = Math.max(floorDb + 15, -55);
  let first = -1;
  let last = -1;
  for (let i = 0; i + 1 < frames.length; i++) {
    if (frames[i] > thr && frames[i + 1] > thr) {
      if (first < 0) first = i;
      last = i + 1;
    }
  }
  const speechStart = first < 0 ? null : (first * fl) / sampleRate;
  const speechEnd = last < 0 ? null : ((last + 1) * fl) / sampleRate;
  const trimStart = speechStart == null ? 0 : Math.max(0, speechStart - 0.15);
  const trimEnd = speechEnd == null ? duration : Math.min(duration, speechEnd + 0.2);
  return {
    duration: round3(duration),
    peakDb: round1(db(peak)),
    rmsDb: round1(db(Math.sqrt(sumSq / Math.max(1, n)))),
    clipSamples: clip,
    floorDb: round1(floorDb),
    speechStart: speechStart == null ? null : round3(speechStart),
    speechEnd: speechEnd == null ? null : round3(speechEnd),
    trimStart: round3(trimStart),
    trimEnd: round3(trimEnd),
  };
}

const round1 = (x) => Math.round(x * 10) / 10;
const round3 = (x) => Math.round(x * 1000) / 1000;

/**
 * Kayıt uyarıları (kod listesi). Arayüz bunları iki dilde gösterir.
 * clip: ses çok yüksek; quiet: çok kısık; nospeech: konuşma yok;
 * cutstart: kayıt başlamadan konuşulmuş; cutend: konuşma bitmeden durdurulmuş;
 * noisy: ortam gürültülü.
 */
export function warnings(a) {
  const w = [];
  if (a.clipSamples >= 3) w.push('clip');
  if (a.speechStart == null) w.push(a.peakDb < -40 ? 'quiet' : 'nospeech');
  else {
    if (a.peakDb < -30) w.push('quiet');
    if (a.speechStart < 0.04) w.push('cutstart');
    if (a.duration - a.speechEnd < 0.06) w.push('cutend');
  }
  if (a.floorDb > -45) w.push('noisy');
  return w;
}

// --- İlerleme -------------------------------------------------------------
// done: {id: sürüm (1..35)}. Sunucuda sıkıştırılmış biçim (Storage özel
// meta verisi ≤ 8 KB): "kmr-1|s1:1100a…|s2:…"; her karakter oturumdaki sıraya
// göre bir öğenin son sürümü (36 tabanı, 0 = yok).

export function encodeProgress(script, done) {
  const parts = [script.version];
  for (const s of script.sessions) {
    const chars = s.items.map((it) => Math.min(35, done[it.id] || 0).toString(36)).join('');
    if (/[^0]/.test(chars)) parts.push(`${s.id}:${chars}`);
  }
  return parts.join('|');
}

export function decodeProgress(script, str) {
  const done = {};
  if (!str) return done;
  const [ver, ...parts] = String(str).split('|');
  if (ver !== script.version) return done;
  const byId = Object.fromEntries(script.sessions.map((s) => [s.id, s]));
  for (const p of parts) {
    const [sid, chars] = p.split(':');
    const s = byId[sid];
    if (!s || !chars) continue;
    for (let i = 0; i < Math.min(chars.length, s.items.length); i++) {
      const v = parseInt(chars[i], 36);
      if (v > 0) done[s.items[i].id] = v;
    }
  }
  return done;
}

export function mergeDone(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) out[k] = Math.max(out[k] || 0, v);
  return out;
}

export const nextVersion = (done, id) => (done[id] || 0) + 1;
export const takeName = (id, v) => `${id}.v${v}.wav`;

export function sessionStats(session, done, skipped = {}) {
  let ok = 0;
  let skip = 0;
  for (const it of session.items) {
    if (done[it.id]) ok++;
    else if (skipped[it.id]) skip++;
  }
  const total = session.items.length;
  return { ok, skip, total, left: total - ok - skip, complete: ok + skip === total };
}

/** Oturumda kaydedilmemiş ve atlanmamış ilk öğe; hepsi bittiyse -1. */
export function firstPending(session, done, skipped = {}) {
  return session.items.findIndex((it) => !done[it.id] && !skipped[it.id]);
}

/** Dakikayı "1 sa 05 dk" / "12 dk" yazar. */
export function fmtMinutes(min) {
  if (min < 60) return `${Math.round(min)} dk`;
  const h = Math.floor(min / 60);
  return `${h} sa ${String(Math.round(min - h * 60)).padStart(2, '0')} dk`;
}

/**
 * Konuşana açık oturumlar (izin kaydına göre).
 * - Çocuk (minor): yalnızca childOk oturumları (Lekla'nın kısa sözleri); cümle derlemi asla.
 * - Yetişkin: "app" izi seçildiyse uygulama oturumları; "tts" izi yalnızca B (openDataset) ile.
 */
export function visibleSessions(script, consent) {
  const c = consent || {};
  const tracks = c.tracks || ['app'];
  const all = script.sessions;
  if (c.minor) {
    return { app: all.filter((s) => s.group !== 'tts' && s.childOk), tts: [], ttsLocked: true };
  }
  const app = tracks.includes('app') ? all.filter((s) => s.group !== 'tts') : [];
  const ttsOk = !!c.openDataset && tracks.includes('tts');
  return { app, tts: ttsOk ? all.filter((s) => s.group === 'tts') : [], ttsLocked: !ttsOk };
}
