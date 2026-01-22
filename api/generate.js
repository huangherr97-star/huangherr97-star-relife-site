function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");
}

function json(res, code, obj) {
  res.status(code).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function safe(x) {
  return (x ?? "").toString().trim();
}

async function callOpenAI({ apiKey, prompt, timeoutMs = 85000, retries = 2 }) {
  const url = "https://api.openai.com/v1/responses";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: [
            {
              role: "user",
              content: [{ type: "input_text", text: prompt }],
            },
          ],
          max_output_tokens: 1500,
        }),
        signal: ctrl.signal,
      });

      clearTimeout(t);

      const data = await r.json().catch(() => null);

      if (!r.ok) {
        const msg = data ? JSON.stringify(data) : `${r.status} ${r.statusText}`;
        const e = new Error(msg);
        e.status = r.status;
        throw e;
      }

      // 提取文本
      let text = "";
      if (data?.output?.[0]?.content?.[0]?.text) {
        text = data.output[0].content[0].text;
      } else if (typeof data.output_text === "string") {
        text = data.output_text;
      }

      return { raw: data, text };
    } catch (e) {
      clearTimeout(t);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

function buildPrompt({ background, timeline, target, resources, mode, question, lastResult, language }) {
  const isEn = language === "en";

  const rulesZh = `
你是“RE:LIFE | 回环”人生模拟器的理性分析引擎。
必须输出严格 JSON，不要输出 JSON 外的文字。
`;

  const rulesEn = `
You are the reasoning engine of "RE:LIFE | Loop".
You MUST output strict JSON only.
`;

  const rules = isEn ? rulesEn : rulesZh;

  // chat 模式
  if (mode === "chat") {
    return `
${rules}

You will answer a follow-up question.

Return JSON:
{
  "text": "...",
  "followups": ["...", "..."],
  "plan30d": ["week1", "week2", "week3", "week4"]
}

Background: ${background}
Timeline: ${timeline}
Target: ${target}
Resources: ${resources}
LastResult: ${lastResult}
Question: ${question}
`.trim();
  }

  // A/B/C 模式
  return `
${rules}

Return JSON:
{
  "text": "...",
  "routes": [
    {
      "id": "A",
      "title": "...",
      "summary": "...",
      "score": {
        "risk": 1-5,
        "reward": 1-5,
        "timeCost": 1-5,
        "mentalCost": 1-5
      }
    },
    {
      "id": "B",
      "title": "...",
      "summary": "...",
      "score": { ... }
    },
    {
      "id": "C",
      "title": "...",
      "summary": "...",
      "score": { ... }
    }
  ],
  "followups": ["...", "..."],
  "plan30d": ["week1", "week2", "week3", "week4"]
}

Background: ${background}
Timeline: ${timeline}
Target: ${target}
Resources: ${resources}
Language: ${language}
`.trim();
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      msg: "RE:LIFE generate endpoint alive",
      time: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 500, { ok: false, error: "Missing OPENAI_API_KEY" });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const background = safe(body.background);
  const timeline = safe(body.timeline);
  const target = safe(body.target);
  const resources = safe(body.resources);
  const mode = safe(body.mode) || "abc";
  const question = safe(body.question);
  const lastResult = safe(body.lastResult);
  const language = safe(body.language) === "en" ? "en" : "zh";

  if (mode !== "chat") {
    if (!background || !timeline || !target) {
      return json(res, 400, {
        ok: false,
        error: "Missing required fields",
        need: ["background", "timeline", "target"],
      });
    }
  }

  if (mode === "chat" && !question) {
    return json(res, 400, { ok: false, error: "Missing question for chat mode" });
  }

  const prompt = buildPrompt({
    background, timeline, target, resources, mode, question, lastResult, language
  });

  try {
    const { text } = await callOpenAI({ apiKey, prompt });

    let parsed = null;
    try { parsed = JSON.parse(text); }
    catch { parsed = { text }; }

    return json(res, 200, {
      ok: true,
      text: parsed.text || "",
      routes: parsed.routes || [],
      followups: parsed.followups || [],
      plan30d: parsed.plan30d || [],
      meta: { mode, language, time: new Date().toISOString() },
    });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: "OpenAI request failed",
      detail: e.message,
    });
  }
}
