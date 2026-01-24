export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  const { name, current_status, history_context, user_intervention, ability } = req.body;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "你是一个名为 RE:LIFE 的因果推演系统。风格：极度理性、冷幽默、拒绝鸡汤。根据受访者的性格缺陷和干预行为，判定其回溯后的成败。"
          },
          {
            role: "user",
            content: `受访者：${name}。现状：${current_status}。历史细节：${history_context}。干预决策：${user_intervention}。注入能力：${ability}。请给出：成败判定、因果真实度评估、深度理性批判。`
          }
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    res.status(200).json({ result: data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: "API 调用失败: " + error.message });
  }
}
