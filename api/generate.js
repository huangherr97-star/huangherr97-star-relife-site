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

    const prompt = `
你是 RE:LIFE 人生回环模拟器，请根据以下用户信息生成结构化 JSON：

用户输入：
- 个人背景：${background}
- 年龄学历城市：${basic}
- 人生经历时间线：${timeline}
- 想回到的时间点：${target}
- 能力资源：${skills}
- 模式：${mode}
- 语言：${lang}

请输出以下结构：

{
  "language": "${lang}",
  "mode": "${mode}",

  "scores": {
    "satisfaction": 整数 1-10,
    "stability": 整数 1-10,
    "growth": 整数 1-10,
    "freedom": 整数 1-10,
    "relationship": 整数 1-10
  },

  "routes": {
    "A": "仅 abc 模式输出",
    "B": "仅 abc 模式输出",
    "C": "仅 abc 模式输出",
    "single": "仅 single 模式输出"
  },

  "chat": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],

  "summary": "对整体模拟的总结"
}

要求：
- 必须是合法 JSON
- 不得包含 markdown 或解释性文字
- 不得输出多余文本
`;

    try {
        const completion = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "你是 RE:LIFE 人生回环模拟器，必须严格输出 JSON。" },
                { role: "user", content: prompt }
            ],
            temperature: 0.7
        });

        const raw = completion.choices[0].message.content || "";
        console.log("模型返回内容：", raw);

        // ---- 清理模型输出（去掉 markdown、空行）----
        const cleaned = raw
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        let json;
        try {
            json = JSON.parse(cleaned);
        } catch (e) {
            console.error("解析失败：", e.message);
            return res.status(200).json({
                error: true,
                message: "模型返回的内容不是合法 JSON",
                raw: cleaned
            });
        }

        return res.status(200).json(json);

    } catch (err) {
        console.error("OpenAI 请求失败：", err);

        // ---- 永远返回 JSON ----
        return res.status(200).json({
            error: true,
            message: "OpenAI 请求失败",
            detail: err.message || String(err)
        });
    }
}
