export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { name, current_status, time_point, history_context, user_intervention } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "你是一个名为 RE:LIFE 的高级因果模拟系统。你的目标是分析用户回溯时空的逻辑。你的评价必须：1. 客观且理性；2. 具有毒辣的冷幽默；3. 指出用户行为背后的代价。严禁使用肤浅的鼓励，要像一个看透命运的智者。"
          },
          {
            role: "user",
            content: `用户：${name}。现状：${current_status}。回溯点：${time_point}。
                     历史细节：${history_context}。
                     干预决策：${user_intervention}。
                     请给出：【判定结果】（成/败）、【因果真实度】（0-100%）、【深度理性判词】。`
          }
        ]
      })
    });

    const data = await response.json();
    res.status(200).json({ result: data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: "因果链路中断" });
  }
}
