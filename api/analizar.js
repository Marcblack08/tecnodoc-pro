// Este código corre en el servidor de Vercel, NUNCA en el navegador del cliente
export default async function handler(req, res) {
    // 1. Validar que la petición venga de un usuario autenticado
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    const { base64Data, mimeType, prompt } = req.body;

    // 2. Usar la API Key leída de las variables de entorno de Vercel (Seguro)
    const apiKey = process.env.GEMINI_API_KEY;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: base64Data } }
                    ]
                }]
            })
        });

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
