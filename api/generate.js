// api/generate.js
export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // --- Health check ---
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, msg: "RE:LIFE API alive", method: "GET" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", allow: ["POST"] });
  }

  // --- Parse body safely ---
  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { background, timeline, target, resources = "", mode = "normal", compare = true } = body;
  const messages = Array.isArray(body.messages) ? body.messages : null; // for chat mode

  // If chat mode: require messages
  if (messages && messages.length > 0) {
    return await runChat({ req, res, messages });
  }

  // Form mode: require background/timeline/target
  const need = [];
  if (!background) need.push("background");
  if (!timeline) need.push("timeline");
  if (!target) need.push("target");

  if (need.length) {
    return res.status(400).json({ error: "Missing required fields", need });
  }

  // If too short -> ask followups (auto-question mode)
  const followups = buildFollowups({ background, timeline, target, resources });
  // still generate even if short, but we’ll include followups to guide user

  const variants = compare
    ? [
        { key: "A", title: "A｜理性推演（克制）", style: "dry" },
        { key: "B", title: "B｜平衡（默认）", style: "normal" },
        { key: "C", title: "C｜共情+行动（温和）", style: "warm" },
      ]
    : [{ key: "ONE", title: "结果", style: mode || "normal" }];

  const out = [];
  for (const v of variants) {
    const text = await callOpenAI({
      prompt: buildPrompt({
        background,
        timeline,
        target,
        resources,
        mode: v.style,
      }),
    });
    out.push({ key: v.key, title: v.title, text });
  }

  return res.status(200).json({
    ok: true,
    type: "compare",
    variants: out,
    followups,
  });
}

// ---------------- helpers ----------------

function buildFollowups({ background, timeline, target, resources }) {
  const len = (s) => (s || "").trim().length;
  const qs = [];

  if (len(background) < 20) {
    qs.push("你的当前状态：主要压力/困扰是什么？（经济/家庭/健康/职业/关系）");
  }
  if (len(timeline) < 60) {
    qs.push("从目标时间点到现在，发生过 3 个关键转折事件分别是什么？");
  }
  if (len(target) < 6) {
    qs.push("你想回到的具体节点是什么？那时你面临的“选择题”是什么？");
  }
  if (len(resources) < 10) {
    qs.push("你现在手里能用的资源：时间、钱、人脉、技能、城市/户口等分别怎样？");
  }
  qs.push("你最在意的结果指标是什么？（收入/自由/稳定/成就/关系/健康）按优先级排序。");

  // return 3~5
  return qs.slice(0, 5);
}

function buildPrompt({ background, timeline, target, resources, mode }) {
  const tone =
    mode === "dry"
      ? "语气极度理性、克制，不安慰不鸡汤，用概率/风险/成本思维。"
      : mode === "warm"
      ? "语气冷静但带共情，既承认情绪也给可执行路线，避免空话。"
      : "语气理性、清晰、易懂，少术语。";

  const structure = `
请严格按以下结构输出（必须有标题）：
1) 关键信息提炼（5-8条，短句）
2) 回到【${target}】后，最可能的3条路线（每条：短期/中期/长期）
3) 每条路线的关键风险与“可行动的规避策略”（具体到动作）
4) 最小可行行动清单（7天、30天、90天）
5) 免责声明（1-2句：非保证、非建议）
`;

  return `
你是“人生模拟器 RE:LIFE”的推演引擎。${tone}
要求：不算命、不保证、不编造事实；用“如果…那么…”的因果逻辑；尽量给出可执行动作。

【用户背景】
${background}

【人生经历时间线】
${timeline}

【想回到的时间点】
${target}

【能力/资源（可选）】
${resources || "（未提供）"}

${structure}
`.trim();
}

async function callOpenAI({ prompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "ERROR: Missing OPENAI_API_KEY in Vercel Environment Variables.";

  // 兼容性：用 chat.completions 风格接口（更通用）
  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You output Chinese unless user asks otherwise." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const txt = await r.text();
  if (!r.ok) return `OpenAI API Error (${r.status}): ${txt}`;

  const json = JSON.parse(txt);
  return (json.choices?.[0]?.message?.content || "").trim() || "（空响应）";
}

async function runChat({ req, res, messages }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

  // 这里的 messages 由前端传入（包含上下文）
  // 你可以把前端保存的表单信息也塞进 messages 的 system 里（前端已做）
  const payload = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "你是 RE:LIFE 人生推演助手。冷静中带共情；不算命、不保证；用因果逻辑；输出尽量结构化，少术语。",
      },
      ...messages,
    ],
    temperature: 0.7,
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });

  const txt = await r.text();
  if (!r.ok) return res.status(r.status).json({ error: "OpenAI API error", detail: txt });

  const json = JSON.parse(txt);
  const answer = (json.choices?.[0]?.message?.content || "").trim();
  return res.status(200).json({ ok: true, type: "chat", answer });
}
