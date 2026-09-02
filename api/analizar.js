const MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function detectMimeType(base64Data, suppliedMimeType = '') {
    const mime = String(suppliedMimeType || '').toLowerCase();
    const sample = String(base64Data || '').slice(0, 64);

    // MediaRecorder on Chrome/Edge normally produces WebM/Opus.
    // The old frontend mislabeled that data as audio/mp3.
    if (mime === 'audio/mp3' || mime === 'audio/mpeg') {
        if (sample.startsWith('GkXf')) return 'audio/webm';
        if (sample.startsWith('T2dn')) return 'audio/ogg';
        if (sample.startsWith('UklG')) return 'audio/wav';
    }

    return suppliedMimeType || 'application/octet-stream';
}

function getTextFromGemini(data) {
    return data?.candidates?.[0]?.content?.parts
        ?.map(part => part?.text || '')
        .filter(Boolean)
        .join('') || '';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            ok: false,
            error: 'Método no permitido. Usa POST.'
        });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({
            ok: false,
            error: 'Falta configurar GEMINI_API_KEY en las variables de entorno de Vercel.'
        });
    }

    try {
        const body = req.body || {};
        const base64Data = typeof body.base64Data === 'string' ? body.base64Data : '';
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        const textOnly = body.textOnly === true;
        const mimeType = detectMimeType(base64Data, body.mimeType);

        if (!prompt) {
            return res.status(400).json({ ok: false, error: 'El prompt es obligatorio.' });
        }

        if (!textOnly && !base64Data) {
            return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo para analizar.' });
        }

        // Prevent accidentally sending enormous browser payloads to Gemini.
        if (base64Data.length > 28_000_000) {
            return res.status(413).json({
                ok: false,
                error: 'El archivo es demasiado grande. Reduce el tamaño antes de enviarlo.'
            });
        }

        const parts = [{ text: prompt }];

        if (!textOnly) {
            parts.push({
                inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                }
            });
        }

        const wantsJson = /json/i.test(prompt);
        const requestBody = {
            contents: [{
                role: 'user',
                parts
            }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096
            }
        };

        // Gemini structured JSON output prevents Markdown fences and invalid JSON
        // for the photo/audio/inventory extraction functions.
        if (wantsJson) {
            requestBody.generationConfig.responseMimeType = 'application/json';
        }

        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json().catch(() => ({
            error: { message: 'Gemini devolvió una respuesta no válida.' }
        }));

        if (!response.ok) {
            const message = data?.error?.message || `Error de Gemini HTTP ${response.status}`;
            return res.status(response.status).json({
                ok: false,
                error: message,
                status: response.status,
                details: data?.error || data
            });
        }

        const text = getTextFromGemini(data);

        if (!text) {
            return res.status(502).json({
                ok: false,
                error: 'Gemini no devolvió contenido utilizable.',
                details: data
            });
        }

        // Keep the original Gemini response shape for compatibility with the
        // current frontend, while also exposing a simple `text` property.
        return res.status(200).json({
            ...data,
            ok: true,
            text,
            mimeTypeUsed: mimeType
        });
    } catch (error) {
        console.error('TecnoDoc Pro /api/analizar:', error);
        return res.status(500).json({
            ok: false,
            error: 'Error interno en la IA: ' + (error?.message || 'Error desconocido')
        });
    }
}
