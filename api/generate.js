import OpenAI from "openai";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const {
        background,
        basic,
        timeline,
        target,
        skills,
        mode,
        lang
    } = req.body;

    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    // 语言模板
    const L = {
        zh: {
            system: "你是 RE:LIFE 回环人生模拟器。你必须严格输出 JSON，不得包含任何解释性文字。",
            scoreLabels: ["整体满意度", "稳定性", "成长性", "自由度", "关系质量"],
            routeA: "路线 A：",
            routeB: "路线 B：",
            routeC: "路线 C：",
            summary: "总结：",
            chat: "对话模式："
        },
        en: {
            system: "You are RE:LIFE, a rational life simulation engine. You must output STRICT JSON with no explanation.",
            scoreLabels: ["Satisfaction", "Stability", "Growth", "Freedom", "Relationships"],
            routeA: "Route A:",
            routeB: "Route B:",
            routeC: "Route C:",
            summary: "Summary:",
            chat: "Chat Mode:"
        }
    };

    const T = L[lang] || L.zh;

    // Prompt 构建
    const prompt = `
用户输入：
- 个人背景：${background}
- 年龄学历城市：${basic}
- 人生经历时间线：${timeline}
- 想回到的时间点：${target}
- 能力资源：${skills}
- 模式：${mode}

请根据模式输出严格 JSON：

{
  "language": "${lang}",
  "mode": "${mode}",

  "scores": {
    "satisfaction": 1-10 的整数,
    "stability": 1-10 的整数,
    "growth": 1-10 的整数,
    "freedom": 1-10 的整数,
    "relationship": 1-10 的整数
  },

  "routes": {
    "A": "仅在 abc 模式输出",
    "B": "仅在 abc 模式输出",
    "C": "仅在 abc 模式输出",
    "single": "仅在 single 模式输出"
  },

  "chat": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],

  "summary": "对整体模拟的总结"
}

要求：
- 必须是合法 JSON
- 不得包含任何额外解释
- 不得出现 markdown
- 不得出现多余文本
`;

    try {
        const completion = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: T.system },
                { role: "user", content: prompt }
            ],
            temperature: 0.7
        });

        const raw = completion.choices[0].message.content;

        // 解析 JSON
        let json;
        try {
            json = JSON.parse(raw);
        } catch (e) {
            return res.status(500).json({
                error: "模型返回的 JSON 无法解析",
                raw
            });
        }

        return res.status(200).json(json);

    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
}
