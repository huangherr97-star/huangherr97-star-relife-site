import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 你也可以把 ALLOW_ORIGIN 改成固定域名：'https://resitelife.blog'
const ALLOW_ORIGIN = "*";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  setCors(res);

  // ✅ 预检请求：必须放行，否则就是你现在的 405
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ 健康检查：浏览器直接打开 /api/generate 不再看到 405
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "RE:LIFE API is alive" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { persona, timeline, rewind_point, traits, history = [] } = req.body || {};

    if (!persona || !timeline || !rewind_point) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const systemPrompt = `
你是 RE:LIFE｜回环 的人生模拟引擎。
规则：
- 不使用算命、玄学、迷信语言
- 基于现实因果与概率
- 允许不确定性
- 输出必须是 JSON
`;

    const userPrompt = `
用户背景：${persona}
人生经历：${timeline}
回到时间点：${rewind_point}
能力/资源：${traits || "未说明"}

请严格按以下 JSON 格式输出：
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

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userPrompt }
      ]
    });

    const content = completion.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ success: false, error: "AI output is not valid JSON", raw: content });
    }

    return res.status(200).json({ success: true, data: parsed });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
