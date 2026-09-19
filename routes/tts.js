import express from 'express';
import { synthesize, capabilities, MAX_TEXT_LENGTH } from '../services/ttsService.js';

const router = express.Router();

// GET /api/tts/voices — which languages the server can speak (client uses this to decide on browser fallback)
router.get('/voices', (req, res) => {
  res.json(capabilities());
});

// GET|POST /api/tts?text=...&lang=hi&rate=1 — returns audio/mpeg
const handle = async (req, res) => {
  const src = req.method === 'POST' ? req.body || {} : req.query;
  const text = String(src.text || '');
  const lang = String(src.lang || 'en').toLowerCase();
  const rate = src.rate;
  if (!text.trim()) return res.status(400).json({ error: 'text is required' });
  if (text.length > MAX_TEXT_LENGTH) return res.status(413).json({ error: `text exceeds ${MAX_TEXT_LENGTH} characters` });
  try {
    const { buffer, provider, voice, cached } = await synthesize(text, lang, { rate });
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=86400',
      'X-TTS-Provider': provider,
      'X-TTS-Voice': voice,
      'X-TTS-Cache': cached ? 'HIT' : 'MISS',
    });
    res.send(buffer);
  } catch (err) {
    const status = err.status || 502;
    if (status >= 500) console.error('[TTS] synthesis failed:', err.message);
    res.status(status).json({ error: err.message, code: err.code || 'TTS_FAILED' });
  }
};
router.get('/', handle);
router.post('/', handle);

export default router;
