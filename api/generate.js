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
            content: `
你是 RE:LIFE 的因果推演引擎。请输出严格 JSON，不要任何解释。

结构如下：
{
  "verdict_text": "终局判词（冷幽默、理性、残酷）",
  "scores": {
    "logic": 0-100,
    "character": 0-100,
    "emotion": 0-100,
    "resource": 0-100,
    "feasibility": 0-100
  },
  "compare": {
    "expected": 0-100,
    "reality": 0-100
  },
  "gravity": 0-100
}

gravity 越高表示“真实度冲突越强”，请根据用户性格、资源、行为逻辑判断。
`
          },
          {
            role: "user",
            content: `
受访者：${name}
现状：${current_status}
历史细节：${history_context}
干预决策：${user_intervention}
特殊能力：${ability}

请生成结构化终局判定。
`
          }
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const parsed = JSON.parse(data.choices[0].message.content);

    res.status(200).json(parsed);

  } catch (error) {
    res.status(500).json({ error: "API 调用失败: " + error.message });
  }
}
