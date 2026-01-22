export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { experience } = req.body;

    // 验证 API 密钥
    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: '未在 Vercel 中检测到 OPENAI_API_KEY 环境变量' });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { 
                        role: 'system', 
                        content: '你是一个平行时空推演专家。用户会提供一段真实经历，请你为他改写一个充满希望、跌宕起伏的平行人生结局。字数 200-300 字。' 
                    },
                    { role: 'user', content: experience }
                ],
                temperature: 0.8,
            }),
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        // 提取 AI 生成的文本内容
        const aiResult = data.choices[0].message.content;

        // 核心：返回名为 story 的字段，确保与前端一致
        res.status(200).json({ story: aiResult });

    } catch (error) {
        console.error('Backend Error:', error);
        res.status(500).json({ error: '时空节点解析失败：' + error.message });
    }
}
