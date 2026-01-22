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

function extractOutputText(respJson) {
  // 兼容不同返回结构：尽量把 output_text 拼出来
  if (!respJson) return "";

  if (typeof respJson.output_text === "string" && respJson.output_text.trim()) {
    return respJson.output_text.trim();
  }

  const out = respJson.output;
  if (!Array.isArray(out)) return "";

  let chunks = [];
  for (const item of out) {
    const content = item && item.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (!c) continue;
      if (c.type === "output_text" && typeof c.text === "string") {
        chunks.push(c.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

async function callOpenAI({ apiKey, prompt, timeoutMs = 85000 }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
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
        max_output_tokens: 900,
      }),
      signal: ctrl.signal,
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      const errMsg = data ? JSON.stringify(data) : `${r.status} ${r.statusText}`;
      const e = new Error(errMsg);
      e.status = r.status;
      e.data = data;
      throw e;
    }

    const text = extractOutputText(data);
    return { raw: data, text };
  } finally {
    clearTimeout(t);
  }
}

function buildPrompt({ background, timeline, target, resources, mode, question, lastResult }) {
  const commonRules = `
你是“RE:LIFE | 回环”人生模拟器的理性分析引擎。
原则：
- 不算命、不预测确定结果、不保证。
- 只基于用户输入做“可解释的因果推演 + 可执行的计划”。
- 语言：中文，冷静中带点共情，少术语，结构清晰。
- 输出尽量用小标题 + 项目符号，给出可落地步骤。
`;

  if (mode === "chat") {
    return `
${commonRules}

【用户背景】
${background}

【经历时间线】
${timeline}

【想回到的时间点】
${target}

【能力/资源】
${resources || "（未提供）"}

【你上次给出的结果（供参考）】
${lastResult || "（无）"}

【用户追问】
${question}

请直接回答追问：
- 先给“结论一句话”
- 再给“理由（3-6条）”
- 最后给“最小可行动作（今天/本周/本月）”
`.trim();
  }

  const modeText = mode === "single"
    ? "请给出一条最稳妥的单一路线（少而精）。"
    : "请给出 3 条路线 A/B/C 并对比（推荐/次选/备选）。";

  return `
${commonRules}

用户要“回到某个时间点重新选择”，请输出：

1）关键信息提炼（5-8条）
2）回到“${target}”后，${modeText}
3）每条路线包含：
- 短期（1-3个月）
- 中期（1-2年）
- 长期（3-5年）
- 关键风险 & 规避策略
- 最小行动清单（今天就能做的 3 件事）
4）最后给一个“最小风险方案”（不赌运气版）

【用户背景】
${background}

【经历时间线】
${timeline}

【能力/资源】
${resources || "（未提供）"}
`.trim();
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  // 允许 GET 用来快速自检（不会调用 OpenAI）
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      msg: "RE:LIFE generate endpoint is alive",
      hint: "Use POST with JSON: {background,timeline,target,resources,mode}",
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
  // 兼容某些情况下 body 是字符串
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

  const need = [];
  if (!background) need.push("background");
  if (!timeline) need.push("timeline");
  if (!target) need.push("target");

  if (need.length) {
    return json(res, 400, { ok: false, error: "Missing required fields", need });
  }

  const prompt = buildPrompt({ background, timeline, target, resources, mode, question, lastResult });

  try {
    const { text } = await callOpenAI({ apiKey, prompt, timeoutMs: 85000 });

    return json(res, 200, {
      ok: true,
      text: text || "（模型返回为空，请稍后重试或缩短输入）",
      meta: {
        mode,
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
