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

function safeText(x) {
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
          max_output_tokens: 1200,
        }),
        signal: ctrl.signal,
      });

      clearTimeout(t);

      const data = await r.json().catch(() => null);

      if (!r.ok) {
        const errMsg = data ? JSON.stringify(data) : `${r.status} ${r.statusText}`;
        const e = new Error(errMsg);
        e.status = r.status;
        e.data = data;
        throw e;
      }

      // 从 responses 结构中提取文本
      let text = "";
      if (data && Array.isArray(data.output)) {
        const first = data.output[0];
        if (first && Array.isArray(first.content)) {
          const c0 = first.content[0];
          if (c0 && typeof c0.text === "string") {
            text = c0.text;
          }
        }
      }
      if (!text && typeof data.output_text === "string") {
        text = data.output_text;
      }

      return { raw: data, text: text || "" };
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

  const commonRulesZh = `
你是“RE:LIFE | 回环”人生模拟器的理性分析引擎。
原则：
- 不算命、不预测确定结果、不保证。
- 只基于用户输入做“可解释的因果推演 + 可执行的计划”。
- 语言：中文，冷静中带点共情，少术语，结构清晰。
- 输出必须是严格的 JSON，便于前端解析。
`;

  const commonRulesEn = `
You are the reasoning engine of "RE:LIFE | Loop" life simulator.
Principles:
- No fortune-telling, no guaranteed outcomes.
- Only causal reasoning + actionable planning based on user input.
- Language: clear, calm, empathetic, low jargon.
- Output MUST be strict JSON, easy for frontend to parse.
`;

  const commonRules = isEn ? commonRulesEn : commonRulesZh;

  // chat 模式：追问
  if (mode === "chat") {
    const prompt = isEn
      ? `
${commonRules}

You will answer a follow-up question based on the user's background and previous result.

[User Background]
${background}

[Timeline]
${timeline}

[Target Point]
${target}

[Resources]
${resources || "(not provided)"}

[Previous Result]
${lastResult || "(none)"}

[User Question]
${question}

You MUST respond with a JSON object with the following shape:

{
  "text": "full natural language answer",
  "followups": ["question1", "question2", ...],
  "plan30d": ["week1 plan", "week2 plan", "week3 plan", "week4 plan"]
}

- "text": answer the question directly, with 1-sentence conclusion + 3-6 reasons + concrete actions.
- "followups": 2-4 good questions the user can think about next.
- "plan30d": a 30-day action plan split by weeks.

Do NOT include any extra keys. Do NOT include explanations outside JSON.
`.trim()
      : `
${commonRules}

你将基于用户的背景和上一次的完整结果，回答一个追问。

【用户背景】
${background}

【经历时间线】
${timeline}

【想回到的时间点】
${target}

【能力/资源】
${resources || "（未提供）"}

【上一次的完整结果】
${lastResult || "（无）"}

【用户追问】
${question}

你必须返回一个 JSON 对象，结构如下：

{
  "text": "完整自然语言回答",
  "followups": ["追问1", "追问2", ...],
  "plan30d": ["第 1 周计划", "第 2 周计划", "第 3 周计划", "第 4 周计划"]
}

- "text"：先给一句话结论，再给 3-6 条理由，最后给可执行的具体动作。
- "followups"：给出 2-4 个值得继续思考的追问。
- "plan30d"：给出 30 天行动计划，按周拆分。

不要返回 JSON 以外的解释或文字。
`.trim();

    return prompt;
  }

  // 非 chat 模式：A/B/C 路线 + 评分维度 + followups + 30 天计划
  const modeTextZh = mode === "single"
    ? "请给出一条最稳妥的单一路线（少而精）。"
    : "请给出 3 条路线 A/B/C 并对比（推荐/次选/备选）。";

  const modeTextEn = mode === "single"
    ? "Provide one most robust single route (concise but solid)."
    : "Provide 3 routes A/B/C and compare them (recommended / alternative / backup).";

  const modeText = isEn ? modeTextEn : modeTextZh;

  const prompt = isEn
    ? `
${commonRules}

The user wants to "go back to a certain point in life and choose differently".

You MUST respond with a JSON object with this shape:

{
  "text": "full natural language explanation",
  "routes": [
    {
      "id": "A",
      "title": "short name",
      "summary": "2-4 sentence summary",
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
  "followups": ["question1", "question2", ...],
  "plan30d": ["week1 plan", "week2 plan", "week3 plan", "week4 plan"]
}

Scoring dimensions:
- risk: 1 (very low) to 5 (very high)
- reward: 1 (low) to 5 (very high)
- timeCost: 1 (short) to 5 (very long)
- mentalCost: 1 (light) to 5 (heavy)

${modeText}

[User Background]
${background}

[Timeline]
${timeline}

[Target Point]
${target}

[Resources]
${resources || "(not provided)"}

Do NOT include any extra keys. Do NOT include explanations outside JSON.
`.trim()
    : `
${commonRules}

用户要“回到某个时间点重新选择”。

你必须返回一个 JSON 对象，结构如下：

{
  "text": "完整的自然语言说明",
  "routes": [
    {
      "id": "A",
      "title": "路线名称（简短）",
      "summary": "2-4 句总结",
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
  "followups": ["追问1", "追问2", ...],
  "plan30d": ["第 1 周计划", "第 2 周计划", "第 3 周计划", "第 4 周计划"]
}

评分维度：
- risk：风险（1 极低 ~ 5 极高）
- reward：收益（1 较低 ~ 5 极高）
- timeCost：时间成本（1 很短 ~ 5 很长）
- mentalCost：心理成本（1 负担很轻 ~ 5 负担很重）

${modeText}

【用户背景】
${background}

【经历时间线】
${timeline}

【想回到的时间点】
${target}

【能力/资源】
${resources || "（未提供）"}

不要返回 JSON 以外的解释或文字。
`.trim();

  return prompt;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      msg: "RE:LIFE generate endpoint is alive",
      hint: "Use POST with JSON: {background,timeline,target,resources,mode,language}",
      time: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 500, {
      ok: false,
      error: "Missing OPENAI_API_KEY in Vercel Environment Variables",
    });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const background = safeText(body.background);
  const timeline = safeText(body.timeline);
  const target = safeText(body.target);
  const resources = safeText(body.resources);
  const mode = safeText(body.mode) || "abc";
  const question = safeText(body.question);
  const lastResult = safeText(body.lastResult);
  const language = (safeText(body.language) || "zh").toLowerCase() === "en" ? "en" : "zh";

  const need = [];
  if (!background) need.push("background");
  if (!timeline) need.push("timeline");
  if (!target) need.push("target");

  if (mode !== "chat" && need.length) {
    return json(res, 400, { ok: false, error: "Missing required fields", need });
  }

  if (mode === "chat" && !question) {
    return json(res, 400, { ok: false, error: "Missing question for chat mode" });
  }

  const prompt = buildPrompt({ background, timeline, target, resources, mode, question, lastResult, language });

  try {
    const { text: rawText } = await callOpenAI({ apiKey, prompt, timeoutMs: 85000 });

    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { text: rawText };
    }

    return json(res, 200, {
      ok: true,
      text: parsed.text || rawText,
      routes: parsed.routes || [],
      followups: parsed.followups || [],
      plan30d: parsed.plan30d || [],
      meta: {
        mode,
        language,
        time: new Date().toISOString(),
      },
    });
  } catch (e) {
    const status = e.status || 500;
    return json(res, status, {
      ok: false,
      error: "OpenAI request failed",
      detail: e.message || String(e),
    });
  }
}
