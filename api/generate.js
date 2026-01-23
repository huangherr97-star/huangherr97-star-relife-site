export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { experience } = req.body;
    if (!experience) return res.status(400).json({ error: '缺失初始化变量' });

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o', // 启用顶级模型能力
                messages: [
                    { 
                        role: 'system', 
                        content: `你是一个名为"RE:LIFE | 回环"的命运模拟引擎 v0.3。
                        你的任务是根据用户输入的生命节点信息，进行严谨的因果概率推演。
                        视觉风格：深色、电影质感。要求输出：
                        1. 【推演正文】：一段充满细节的平行时空叙事。
                        2. 【命运报告】：包含[因果值]、[复杂度]、[维度稳定性]等KPI。` 
                    },
                    { role: 'user', content: experience }
                ],
                temperature: 0.8,
            }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        res.status(200).json({ story: data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: '推演回路故障: ' + error.message });
    }
}
