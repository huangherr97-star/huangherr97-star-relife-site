// api/generate.js
// RE:LIFE | 回环 — Vercel Serverless (Zero-dependency)
// Route: /api/generate
//
// Requires Vercel env var:
//   OPENAI_API_KEY = sk-xxxxx

function setCors(res) {
  // 如果你只允许本站访问，可以改成：https://resitelife.blog
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function safeParseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

module.exports = async (req, res) => {
  setCors(res);

  // ✅ OPTIONS 预检必须放行（否则经常 405）
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ GET 用于健康检查（浏览器直接打开 /api/generate 看是否正常）
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "RE:LIFE API is alive",
      method: req.method,
      ts: new Date().toISOString(),
    });
  }

  // ✅ 只允许 POST 进行推演
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Missing OPENAI_API_KEY in Vercel env",
      });
    }

    // Vercel 会自动解析 JSON body，但我们兼容一下字符串情况
    let body = req.body;
    if (typeof body === "string") body = safeParseJson(body);
    if (!isObject(body)) body = {};

    const { persona, timeline, rewind_point, traits, history } = body;

    if (!persona || !timeline || !rewind_point) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: persona / timeline / rewind_point",
      });
    }

    // history 允许为空；但必须是 messages 数组
    const prior = Array.isArray(history) ? history : [];

    // ✅ 强约束：只输出 JSON
    const systemPrompt = `
你是「RE:LIFE｜回环」命运模拟引擎。
硬规则：
- 不使用算命、玄学、迷信语言
- 基于现实因果与概率
- 明确不确定性来源
- 不承诺成功/不提供保证
- 最终输出必须是严格 JSON（不能带 Markdown 代码块）
`;

    const userPrompt = `
【用户背景】
${persona}

【已发生时间线】
${timeline}

【回到的时间点】
${rewind_point}

【能力 / 资源】
${traits || "未说明"}

请严格输出以下 JSON 结构（不要多任何字段，不要用代码块）：
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
    },
    {
      "title":"",
      "key_choice":"",
      "mid_result":"",
      "long_term":"",
      "probability":"",
      "risks":[],
      "why":""
    },
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

    const messages = [
      { role: "system", content: systemPrompt },
      ...prior,
      { role: "user", content: userPrompt },
    ];

    // ✅ 直接调用 OpenAI HTTP API（无需 npm 依赖）
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.6,
        messages,
      }),
    });

    const rawText = await r.text();
    const json = safeParseJson(rawText);

    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        error: "OpenAI API error",
        detail: json || rawText,
      });
    }

    const content = json?.choices?.[0]?.message?.content || "";
    const parsed = safeParseJson(content);

    if (!parsed) {
      return res.status(500).json({
        success: false,
        error: "AI output is not valid JSON",
        raw: content,
      });
    }

    return res.status(200).json({
      success: true,
      data: parsed,
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({
      success: false,
      error: "Server error",
      detail: String(e?.message || e),
    });
  }
};
