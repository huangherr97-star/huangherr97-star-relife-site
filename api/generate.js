export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const { experience } = req.body;
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o', // 顶级模型能力
                messages: [
                    { role: 'system', content: '你是一个名为"RE:LIFE | 回环"的命运模拟引擎 v0.3。' },
                    { role: 'user', content: experience }
                ],
                temperature: 0.8
            })
        });
        const data = await response.json();
        res.status(200).json({ story: data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
