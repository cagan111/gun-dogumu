// GET  /api/admin   (header: x-admin-password)                -> usage stats + key status
// POST /api/admin   (header: x-admin-password, body: {geminiKey1?, geminiKey2?}) -> update Gemini keys
//
// Password is a fixed value right here in the code (server-side only, never
// sent to the browser) — no Vercel environment variable needed, so there's
// nothing to misconfigure. To change it later: edit the line below and
// redeploy.
//
// Gemini keys set from the admin panel are stored in Redis (config:gemini_key_1/2)
// and take priority over the GEMINI_API_KEY_1/2 environment variables — see
// api/generate.js. This means once Redis is connected, you never have to
// touch Vercel's Environment Variables screen again to rotate keys.

const ADMIN_PASSWORD = "159951cagan";

const { Redis } = require('@upstash/redis');

function getRedis(){
  try{
    if(!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
    return Redis.fromEnv();
  }catch(e){
    return null;
  }
}

module.exports = async (req, res) => {
  const suppliedPassword = req.headers['x-admin-password'] || '';
  if(suppliedPassword !== ADMIN_PASSWORD){
    res.status(401).json({ error: 'Yanlış şifre.' });
    return;
  }

  const redis = getRedis();

  if(req.method === 'POST'){
    if(!redis){
      res.status(500).json({ error: 'Redis bağlı değil, anahtarları buradan değiştiremezsin. Önce Vercel > Storage üzerinden Upstash Redis kurman gerekiyor (README 3. adım).' });
      return;
    }
    let body = req.body;
    if(typeof body === 'string'){
      try{ body = JSON.parse(body); }catch(e){ body = {}; }
    }
    const { geminiKey1, geminiKey2 } = body || {};
    if(!geminiKey1 && !geminiKey2){
      res.status(400).json({ error: 'En az bir anahtar gönder.' });
      return;
    }
    try{
      if(geminiKey1) await redis.set('config:gemini_key_1', String(geminiKey1).trim());
      if(geminiKey2) await redis.set('config:gemini_key_2', String(geminiKey2).trim());
      res.status(200).json({ ok: true });
    }catch(e){
      res.status(500).json({ error: 'Kaydedilemedi: ' + (e.message || String(e)) });
    }
    return;
  }

  if(req.method !== 'GET'){
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if(!redis){
    const keyStatus = {
      key1: !!process.env.GEMINI_API_KEY_1,
      key2: !!process.env.GEMINI_API_KEY_2
    };
    res.status(200).json({ total: 0, byType: {}, last7Days: [], keyUsage: {}, keyStatus, note: 'Redis bağlı değil, istatistikler henüz kaydedilmiyor ve anahtarlar panelden değiştirilemiyor.' });
    return;
  }

  try{
    const types = ['soru_coz', 'ikiz_soru', 'gunluk_kocluk', 'gun_sonu_degerlendirme', 'general'];
    const p = redis.pipeline();
    p.get('stats:total');
    types.forEach(t => p.get(`stats:by_type:${t}`));
    p.get('stats:by_key:key1');
    p.get('stats:by_key:key2');
    p.get('config:gemini_key_1');
    p.get('config:gemini_key_2');

    const last7 = [];
    for(let i=6;i>=0;i--){
      const d = new Date();
      d.setDate(d.getDate()-i);
      last7.push(d.toISOString().slice(0,10));
    }
    last7.forEach(day => p.get(`stats:by_day:${day}`));

    const results = await p.exec();
    let idx = 0;
    const total = Number(results[idx++]) || 0;
    const byType = {};
    types.forEach(t => { byType[t] = Number(results[idx++]) || 0; });
    const key1Count = Number(results[idx++]) || 0;
    const key2Count = Number(results[idx++]) || 0;
    const storedKey1 = results[idx++];
    const storedKey2 = results[idx++];
    const last7Days = last7.map(day => ({ date: day, count: Number(results[idx++]) || 0 }));

    const keyStatus = {
      key1: !!storedKey1 || !!process.env.GEMINI_API_KEY_1,
      key2: !!storedKey2 || !!process.env.GEMINI_API_KEY_2
    };

    res.status(200).json({
      total,
      byType,
      last7Days,
      keyUsage: { key1: key1Count, key2: key2Count },
      keyStatus
    });
  }catch(e){
    res.status(500).json({ error: 'İstatistikler okunamadı: ' + (e.message || String(e)) });
  }
};
