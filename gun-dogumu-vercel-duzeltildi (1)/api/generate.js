// POST /api/generate
// Body: { promptText: string, imageBase64?: string, maxTokens?: number, type?: string }
//
// This function holds the real Gemini API keys server-side (as Vercel
// environment variables) and is the ONLY place they ever touch the network.
// The client never sees, stores, or sends any API key.
//
// Load balancing: alternates between GEMINI_API_KEY_1 and GEMINI_API_KEY_2
// using a Redis counter (round robin). If the chosen key comes back with a
// quota/rate-limit error, it immediately retries once with the other key
// before giving up — this is what actually protects you from hitting a
// single key's free-tier ceiling.
//
// Usage stats: every successful call increments counters in Redis, broken
// down by `type` and by day, plus which key served the request. The admin
// panel (/api/admin) reads these back.

const { Redis } = require('@upstash/redis');

const TURKISH_ONLY = "MUTLAK KURAL: Yanıtının HER KELİMESİ Türkçe olmalı. İngilizce tek bir kelime, tek bir harf grubu bile kullanmayacaksın — JSON alan değerleri, SVG içindeki metin/text etiketleri, örnekler, ipucu ve çözüm metinleri dahil HER YERDE sadece Türkçe kullan. Girdi (fotoğraf, soru) İngilizce olsa bile SEN her zaman Türkçe yanıt vereceksin. Bu kural hiçbir istisna kabul etmez. STRICT RULE: Your entire response must be 100% Turkish language only, with absolutely zero English words anywhere, including inside JSON values and SVG text elements, no matter what language the source material is in.";

const GEMINI_MODEL = 'gemini-3.1-flash-lite';

function getRedis(){
  try{
    if(!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
    return Redis.fromEnv();
  }catch(e){
    return null;
  }
}

// Prefers keys set from the admin panel (stored in Redis) over the ones in
// Vercel's environment variables, so the owner can rotate keys without ever
// touching Vercel's env var screen again. Falls back to env vars if Redis
// isn't connected yet or has nothing stored.
async function getKeysAsync(redis){
  let k1 = process.env.GEMINI_API_KEY_1;
  let k2 = process.env.GEMINI_API_KEY_2;
  if(redis){
    try{
      const [rk1, rk2] = await Promise.all([
        redis.get('config:gemini_key_1'),
        redis.get('config:gemini_key_2')
      ]);
      if(rk1) k1 = rk1;
      if(rk2) k2 = rk2;
    }catch(e){
      // Redis read failed — just fall back to whatever the env vars have.
    }
  }
  return [k1, k2].filter(Boolean);
}

async function pickKeyIndex(redis, keyCount){
  if(keyCount<=1) return 0;
  if(!redis) return Math.floor(Math.random()*keyCount);
  try{
    const n = await redis.incr('gemini:rotation-counter');
    return n % keyCount;
  }catch(e){
    return Math.floor(Math.random()*keyCount);
  }
}

async function callGemini(key, promptText, imageBase64, maxTokens){
  const parts = [];
  if(imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });
  parts.push({ text: promptText });

  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: TURKISH_ONLY }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingLevel: 'minimal' }
      }
    })
  });
  const data = await resp.json();
  return { ok: resp.ok, data };
}

function isQuotaError(data){
  if(!data || !data.error) return false;
  const status = data.error.status || '';
  const msg = data.error.message || '';
  return status === 'RESOURCE_EXHAUSTED' || /quota/i.test(msg);
}

function extractRetrySeconds(data){
  let waitSeconds = 20;
  try{
    const details = (data.error && data.error.details) || [];
    const retryInfo = details.find(d => d['@type'] && d['@type'].includes('RetryInfo'));
    if(retryInfo && retryInfo.retryDelay){
      const parsed = parseFloat(retryInfo.retryDelay);
      if(!isNaN(parsed)) waitSeconds = Math.ceil(parsed);
    } else {
      const m = (data.error.message || '').match(/retry in ([\d.]+)s/i);
      if(m) waitSeconds = Math.ceil(parseFloat(m[1]));
    }
  }catch(e){}
  return waitSeconds;
}

async function recordStats(redis, type, keyIndex){
  if(!redis) return;
  try{
    const today = new Date().toISOString().slice(0,10);
    const p = redis.pipeline();
    p.incr('stats:total');
    p.incr(`stats:by_type:${type || 'general'}`);
    p.incr(`stats:by_day:${today}`);
    p.incr(`stats:by_key:key${keyIndex+1}`);
    await p.exec();
  }catch(e){
    // Stats are best-effort — never fail the actual request over this.
  }
}

module.exports = async (req, res) => {
  if(req.method !== 'POST'){
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const redis = getRedis();
  const keys = await getKeysAsync(redis);
  if(keys.length === 0){
    res.status(500).json({ error: 'Sunucuda Gemini API anahtarı tanımlı değil. Yönetici panelinden veya Vercel ortam değişkenlerinden ekleyebilirsin.' });
    return;
  }

  let body = req.body;
  if(typeof body === 'string'){
    try{ body = JSON.parse(body); }catch(e){ body = {}; }
  }
  const { promptText, imageBase64, maxTokens, type } = body || {};
  if(!promptText){
    res.status(400).json({ error: 'promptText gerekli.' });
    return;
  }

  const firstIndex = await pickKeyIndex(redis, keys.length);

  try{
    let { ok, data } = await callGemini(keys[firstIndex], promptText, imageBase64, maxTokens || 2048);

    if(!ok && isQuotaError(data) && keys.length > 1){
      const secondIndex = (firstIndex + 1) % keys.length;
      const retryResult = await callGemini(keys[secondIndex], promptText, imageBase64, maxTokens || 2048);
      ok = retryResult.ok;
      data = retryResult.data;
      if(ok){
        await recordStats(redis, type, secondIndex);
        res.status(200).json({ text: extractText(data) });
        return;
      }
    }

    if(!ok){
      if(isQuotaError(data)){
        res.status(429).json({ quota: true, waitSeconds: extractRetrySeconds(data) });
        return;
      }
      res.status(502).json({ error: (data.error && data.error.message) || 'Gemini API hatası' });
      return;
    }

    const text = extractText(data);
    if(!text){
      res.status(502).json({ error: 'Gemini boş yanıt döndürdü.' });
      return;
    }

    await recordStats(redis, type, firstIndex);
    res.status(200).json({ text });
  }catch(e){
    res.status(500).json({ error: 'Sunucu hatası: ' + (e.message || String(e)) });
  }
};

function extractText(data){
  const cand = data.candidates && data.candidates[0];
  if(!cand) return '';
  const parts = (cand.content && cand.content.parts) || [];
  return parts.map(p => p.text || '').join('\n').trim();
}
