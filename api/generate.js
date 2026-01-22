export default async function handler(req, res) {
    // 仅允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { experience } = req.body;

    // 基础输入校验
    if (!experience || experience.length < 5) {
        return res.status(400).json({ error: '输入变量不足，无法初始化命运回路。' });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo', // 建议后期升级为 gpt-4o 以获得更强的逻辑推演
                messages: [
                    { 
                        role: 'system', 
                        content: `你是一个名为"RE:LIFE | 回环"的命运模拟引擎 v0.3。
                        你的任务是根据用户输入的生命节点信息，进行因果概率推演。
                        
                        写作风格要求：
                        1. 语气：冷静、理性、富有电影感。
                        2. 结构：先简述时空节点的转折，再展开一段具体的平行人生叙事。
                        3. 结尾：以一个"命运评价"结束（例如：因果值：85% | 复杂度：高）。
                        4. 禁忌：严禁使用算命或迷信措辞。` 
                    },
                    { role: 'user', content: `初始变量输入：${experience}` }
                ],
                temperature: 0.75, // 保持适度的随机性与创造力
                max_tokens: 1000,
            }),
        });

        const data = await response.json();

        // 错误处理：检查 OpenAI 或中转商返回的错误
        if (data.error) {
            console.error('OpenAI Error:', data.error);
            return res.status(500).json({ error: data.error.message });
        }

        // 提取推演结果并返回
        const aiResult = data.choices[0].message.content;
        
        // 确保返回的键名与前端 index.html 中的 data.story 匹配
        res.status(200).json({ story: aiResult });

    } catch (error) {
        console.error('Fetch Error:', error);
        res.status(500).json({ error: '时空隧道连接中断，请检查 API 配置。' });
    }
}
