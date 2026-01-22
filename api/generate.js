export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { experience } = req.body;

  // 检查 API Key 是否配置
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: '未配置 OpenAI API Key，请在 Vercel 后台设置' });
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
            content: '你是一个平行时空推演专家。请根据用户提供的真实经历，撰写一个跌宕起伏的平行人生故事。要求：语言优美，富有哲理，字数在 300 字左右。' 
          },
          { role: 'user', content: experience }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    // 提取 AI 生成的文本
    const aiContent = data.choices[0].message.content;

    // 关键：返回的键名必须叫 story，与前端 index.html 匹配
    res.status(200).json({ story: aiContent });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: '时空隧道发生波动：' + error.message });
  }
}
