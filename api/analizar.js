const MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function getText(data) {
    return data?.candidates?.[0]?.content?.parts?.map(p => typeof p?.text === 'string' ? p.text : '').join('') || '';
}

function normalizeMime(mime) {
    const value = String(mime || '').toLowerCase().split(';')[0].trim();
    const allowed = ['image/jpeg','image/png','image/webp','image/heic','image/heif','audio/wav','audio/mp3','audio/mpeg','audio/ogg','audio/flac','audio/aac','audio/mp4','audio/webm','video/mp4','application/pdf'];
    return allowed.includes(value) ? value : value || 'application/octet-stream';
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Método no permitido. Usa POST.' });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok:false, error:'GEMINI_API_KEY no está configurada en Vercel.' });
    try {
        const body = req.body || {};
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        const textOnly = body.textOnly === true;
        const base64Data = typeof body.base64Data === 'string' ? body.base64Data : '';
        const mimeType = normalizeMime(body.mimeType);
        if (!prompt) return res.status(400).json({ ok:false, error:'Falta el prompt.' });
        if (!textOnly && !base64Data) return res.status(400).json({ ok:false, error:'Falta el archivo.' });
        if (base64Data.length > 5_500_000) return res.status(413).json({ ok:false, error:'Archivo demasiado grande. Usa una imagen/PDF/audio menor de 4 MB.' });
        const parts = [{ text: prompt }];
        if (!textOnly) {
            if (mimeType === 'application/octet-stream') return res.status(400).json({ ok:false, error:`Tipo de archivo no compatible: ${body.mimeType || 'desconocido'}` });
            parts.push({ inline_data:{ mime_type:mimeType, data:base64Data } });
        }
        const requestBody = { contents:[{ role:'user', parts }], generationConfig:{ temperature:0.15, maxOutputTokens:4096 } };
        if (/json|arreglo json|objetos \{/i.test(prompt)) requestBody.generationConfig.responseMimeType='application/json';
        const response = await fetch(GEMINI_URL, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey }, body:JSON.stringify(requestBody) });
        const data = await response.json().catch(()=>({}));
        if (!response.ok) {
            const message = data?.error?.message || `Gemini respondió HTTP ${response.status}.`;
            console.error('Gemini API error:',response.status,message);
            return res.status(response.status).json({ ok:false, error:message });
        }
        const text = getText(data);
        if (!text) return res.status(502).json({ ok:false, error:'Gemini no devolvió texto.', raw:data });
        return res.status(200).json({ ok:true, text, candidates:data.candidates });
    } catch(error) {
        console.error('TecnoDoc Pro AI:',error);
        return res.status(500).json({ ok:false, error:error?.message || 'Error interno de IA.' });
    }
};
