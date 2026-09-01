module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { base64Data, mimeType, prompt, textOnly } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel' });
    }

    try {
        let parts = [{ text: prompt }];

        if (!textOnly && base64Data && mimeType) {
            parts.push({
                inline_data: { mime_type: mimeType, data: base64Data }
            });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }] })
        });

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Error interno en la IA: ' + error.message });
    }
};
