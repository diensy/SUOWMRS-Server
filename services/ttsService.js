/**
 * Server-side neural Text-to-Speech for the 6 platform languages.
 *
 * Provider chain (first that supports the language wins):
 *   1. Azure Cognitive Services Speech  — set AZURE_SPEECH_KEY + AZURE_SPEECH_REGION in .env.
 *      Covers all six languages including Odia (or-IN-SubhasiniNeural / or-IN-SukantNeural).
 *   2. Microsoft Edge "Read Aloud" neural voices via `msedge-tts` — free, no key needed.
 *      Covers en-IN, hi-IN, te-IN, ta-IN, bn-IN (no Odia).
 *
 * Results are cached on disk (server/cache/tts/<sha1>.mp3) so repeated phrases are instant.
 */
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', 'cache', 'tts');
fs.mkdirSync(CACHE_DIR, { recursive: true });

export const MAX_TEXT_LENGTH = 1200;

// Default voice per language. Override with TTS_VOICE_<LANG>=<ShortName> in .env (e.g. TTS_VOICE_HI=hi-IN-MadhurNeural)
const DEFAULT_VOICES = {
  en: { edge: 'en-IN-NeerjaNeural', azure: 'en-IN-NeerjaNeural', locale: 'en-IN' },
  hi: { edge: 'hi-IN-SwaraNeural', azure: 'hi-IN-SwaraNeural', locale: 'hi-IN' },
  or: { edge: null, azure: 'or-IN-SubhasiniNeural', locale: 'or-IN' },
  te: { edge: 'te-IN-ShrutiNeural', azure: 'te-IN-ShrutiNeural', locale: 'te-IN' },
  ta: { edge: 'ta-IN-PallaviNeural', azure: 'ta-IN-PallaviNeural', locale: 'ta-IN' },
  bn: { edge: 'bn-IN-TanishaaNeural', azure: 'bn-IN-TanishaaNeural', locale: 'bn-IN' },
};

const voiceFor = (lang, provider) =>
  process.env[`TTS_VOICE_${lang.toUpperCase()}`] || DEFAULT_VOICES[lang]?.[provider] || null;

const azureConfigured = () => Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);

/** Which provider will handle a language right now (null = not available server-side). */
export function providerFor(lang) {
  if (!DEFAULT_VOICES[lang]) return null;
  if (azureConfigured() && voiceFor(lang, 'azure')) return 'azure';
  if (voiceFor(lang, 'edge')) return 'edge';
  return null;
}

export function capabilities() {
  const languages = {};
  for (const lang of Object.keys(DEFAULT_VOICES)) {
    const provider = providerFor(lang);
    languages[lang] = { supported: Boolean(provider), provider, voice: provider ? voiceFor(lang, provider) : null };
  }
  return { azureConfigured: azureConfigured(), languages };
}

// ─────────────────────────── helpers ───────────────────────────
// Indic-script digits → ASCII (neural engines return empty audio for some native digit runs)
const NATIVE_DIGITS = /[०-९୦-୯০-৯౦-౯௦-௯]/g;
const DIGIT_BASES = [0x0966, 0x0b66, 0x09e6, 0x0c66, 0x0be6];
const toAsciiDigit = (ch) => { const c = ch.charCodeAt(0); for (const b of DIGIT_BASES) if (c >= b && c <= b + 9) return String(c - b); return ch; };

const escapeXml = (s) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

function normalizeText(text) {
  return String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[•●▪■◆|—–_*#`]/g, ' ')
    .replace(NATIVE_DIGITS, toAsciiDigit)
    .replace(/(\d)\s*%/g, '$1 percent')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function cacheKey(text, lang, voice, rate) {
  return crypto.createHash('sha1').update(`${lang}|${voice}|${rate}|${text}`).digest('hex');
}

const streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

// ─────────────────────────── providers ───────────────────────────
async function synthesizeEdge(text, voice, rate) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, { rate });
    const buf = await streamToBuffer(audioStream);
    if (!buf.length) throw new Error('Edge TTS returned empty audio');
    return buf;
  } finally {
    try { tts.close(); } catch { /* ignore */ }
  }
}

async function synthesizeAzure(text, voice, locale, rate) {
  const region = process.env.AZURE_SPEECH_REGION;
  const ratePct = `${Math.round((rate - 1) * 100)}%`;
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${voice}"><prosody rate="${ratePct}">${escapeXml(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'SUOWMRS-TTS',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

// In-flight de-duplication so two clicks on the same phrase only synthesize once
const inflight = new Map();

/**
 * Synthesize speech. Returns { buffer, provider, voice, cached } or throws if the language
 * is not supported by any configured provider.
 */
export async function synthesize(rawText, lang = 'en', { rate = 1 } = {}) {
  const text = normalizeText(rawText);
  if (!text) throw Object.assign(new Error('Empty text'), { status: 400 });
  const provider = providerFor(lang);
  if (!provider) throw Object.assign(new Error(`No server voice available for language "${lang}"`), { status: 422, code: 'LANG_UNSUPPORTED' });
  const voice = voiceFor(lang, provider);
  const safeRate = Math.min(1.5, Math.max(0.6, Number(rate) || 1));

  const key = cacheKey(text, lang, voice, safeRate);
  const file = path.join(CACHE_DIR, `${key}.mp3`);
  if (fs.existsSync(file)) {
    return { buffer: fs.readFileSync(file), provider, voice, cached: true };
  }
  if (inflight.has(key)) return inflight.get(key);

  const job = (async () => {
    const run = () =>
      provider === 'azure'
        ? synthesizeAzure(text, voice, DEFAULT_VOICES[lang].locale, safeRate)
        : synthesizeEdge(text, voice, safeRate);
    let buffer;
    try { buffer = await run(); } catch (firstErr) { console.warn('[TTS] retrying after:', firstErr.message); buffer = await run(); }
    try { fs.writeFileSync(file, buffer); } catch (e) { console.warn('[TTS] cache write failed:', e.message); }
    return { buffer, provider, voice, cached: false };
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}
