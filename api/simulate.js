import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success:false, error:"Method not allowed" });
  }

  try {
    const {
      persona,
      timeline,
      rewind_point,
      traits,
      history = []
    } = req.body;

    if (!persona || !timeline || !rewind_point) {
      return res.status(400).json({
        success:false,
        error:"缺少必要信息"
      });
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

    const content = completion.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return res.status(500).json({
        success:false,
        error:"AI 输出格式错误",
        raw: content
      });
    }

    return res.json({
      success:true,
      data: parsed
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success:false,
      error:"服务器错误"
    });
  }
}
