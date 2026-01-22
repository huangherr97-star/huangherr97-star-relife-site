export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "RE:LIFE API is alive"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Missing OPENAI_API_KEY"
      });
    }

    const { persona, timeline, rewind_point, traits, history = [] } = req.body || {};

    if (!persona || !timeline || !rewind_point) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    const systemPrompt = `
你是「RE:LIFE｜回环」命运模拟引擎。
规则：
- 不使用算命、玄学、迷信语言
- 基于现实因果
- 输出必须是 JSON
`;

    const userPrompt = `
用户背景：${persona}
人生经历：${timeline}
回到时间点：${rewind_point}
能力资源：${traits || "未说明"}

请输出 JSON：
{
  "branches":[
    {
      "title":"",
      "key_choice":"",
      "mid_result":"",
      "long_term":"",
      "probability":"",
      "risks":[],
      "why":""
    }
  ],
  "overall_risks":[],
  "summary":""
}
`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: userPrompt }
        ]
      })
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {}

    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        error: "OpenAI API error",
        detail: data || text
      });
    }

    const content = data?.choices?.[0]?.message?.content || "";
    let parsed;
    try { parsed = JSON.parse(content); } catch {}

    if (!parsed) {
      return res.status(500).json({
        success: false,
        error: "AI output is not valid JSON",
        raw: content
      });
    }

    return res.status(200).json({
      success: true,
      data: parsed
    });

  } catch (e) {
    return res.status(500).json({
      success: false,
      error: "Server error",
      detail: String(e?.message || e)
    });
  }
}
