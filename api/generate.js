// api/generate.js
// 引入 OpenAI API 库，但对于 Edge Function，我们通常直接使用 fetch API
// 如果想用官方库，需要确保其兼容 Edge 环境，或者使用轻量级替代品
// 这里为了示例简洁，直接用 fetch

export const config = { runtime: 'edge' };

export default async (req) => {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        const { experience } = await req.json();

        // 从 Vercel 环境变量中获取 API Key
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            return new Response(JSON.stringify({ error: 'OpenAI API Key not configured.' }), { status: 500 });
        }

        // 构造 OpenAI API 请求体
        const payload = {
            model: "gpt-3.5-turbo", // 你也可以尝试 gpt-4
            messages: [
                { role: "system", content: "你是一个专业的编剧和人生导师，善于根据用户的简短经历，生成一段富有哲理、启发性或戏剧性的生命剧本。风格是积极向上且富有想象力的。" },
                { role: "user", content: `请根据以下经历，为我生成一段引人入胜的生命剧本，包含时间点和转折："${experience}"。字数控制在150字左右。` }
            ],
            temperature: 0.7, // 创造性程度，0-1，越高越有创造性
            max_tokens: 200, // 最大生成 token 数
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        };

        // 发送请求到 OpenAI API
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            console.error("OpenAI API error:", errorData);
            return new Response(JSON.stringify({ error: `OpenAI API error: ${errorData.error.message || 'Unknown error'}` }), { status: openaiResponse.status });
        }

        const data = await openaiResponse.json();
        const generatedStory = data.choices[0].message.content;

        return new Response(JSON.stringify({ story: generatedStory }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Internal Server Error:", error);
        return new Response(JSON.stringify({ error: `Internal Server Error: ${error.message}` }), { status: 500 });
    }
};
