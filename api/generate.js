export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { background, timeline, target, resources } = req.body || {};
    if (!background || !timeline || !target) {
      return res.status(400).json({ error: "Missing required fields: background, timeline, target" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server missing OPENAI_API_KEY env var" });
    }

    const prompt =
`你是“理性但带点共情”的人生推演助手。你不算命，不保证结果，只做基于输入的合理推演与建议。

【个人背景】
${background}

【人生经历时间线】
${timeline}

【想回到的时间点】
${target}

【能力/资源（可选）】
${resources || "无"}

请输出（用清晰小标题）：
1）关键信息提炼（3-6条）
2）回到该时间点后，最可能的3条路径（每条分：短期/中期/长期）
3）每条路径的关键风险与“可行动的规避策略”
4）最建议的1条主线 + 2个备选（解释原因）
5）下一步的5个具体行动（可在一周内开始）
语言：中文，尽量通俗，避免过度术语。`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "你是理性、克制、可执行的人生推演助手。不要神秘化，不要绝对化结论。" },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      return res.status(500).json({ error: "OpenAI API error: " + msg });
    }

    const result = data?.choices?.[0]?.message?.content || "";
    return res.status(200).json({ result });
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
