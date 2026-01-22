// RE:LIFE | 回环 — 产品化 v0.3（前后端完整示例）
// 目标：产品级体验（结构化结果 + UI + 多轮 + 限流 + 合规）
// 适配：Vercel（Serverless + Static）

/* =========================
   一、后端（Vercel API）
   路径：/api/simulate.js
========================= */

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 简易内存限流（单实例示例；生产可换 KV / Redis）
const rateMap = new Map();
const LIMIT = 5; // 每 IP 每日 5 次

function rateLimit(ip) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${ip}_${today}`;
  const used = rateMap.get(key) || 0;
  if (used >= LIMIT) return false;
  rateMap.set(key, used + 1);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: "Daily limit reached" });
  }

  const { persona, timeline, rewind_point, traits, history = [] } = req.body;
  if (!persona || !timeline || !rewind_point) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const system = `你是 RE:LIFE | 回环 的命运模拟引擎。\n规则：\n- 只基于现实因果与概率，不使用算命或迷信语言。\n- 输出必须结构化 JSON。\n- 明确不确定性与风险。\n- 不给人生保证。`;

  const user = `用户背景：${persona}
经历时间线：${timeline}
回到时间点：${rewind_point}
能力/资源：${traits || '未说明'}

请输出 JSON，结构如下：
{
  branches: [
    { title, key_choice, mid_result, long_term, probability, risks, why }
  ],
  overall_risks: [],
  summary: "理性复盘"
}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.6,
    messages: [
      { role: "system", content: system },
      ...history,
      { role: "user", content: user }
    ]
  });

  let json;
  try {
    json = JSON.parse(completion.choices[0].message.content);
  } catch {
    return res.status(500).json({ error: "Invalid AI output" });
  }

  res.json({ success: true, data: json });
}

/* =========================
   二、前端（产品级 Web App）
   路径：/index.html
========================= */

<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>RE:LIFE | 回环</title>
<style>
body{margin:0;background:#0B1220;color:#E6EAF2;font-family:system-ui}
main{max-width:900px;margin:0 auto;padding:24px}
.card{background:#0E1628;border:1px solid #1C2433;border-radius:14px;padding:16px;margin:12px 0}
input,textarea,button{width:100%;margin-top:8px;padding:10px;border-radius:10px;border:1px solid #1C2433;background:#0B1220;color:#fff}
button{background:#4C6FFF;font-weight:600;cursor:pointer}
.branch{border-left:4px solid #4C6FFF;padding-left:12px;margin:12px 0}
.small{color:#A7B0C0;font-size:13px}
</style>
</head>
<body>
<main>
<h1>RE:LIFE｜回环</h1>
<p class="small">理性人生模拟 · 非算命 · 非保证</p>

<div class="card">
<h3>你的信息</h3>
<input id="persona" placeholder="你的背景" />
<textarea id="timeline" placeholder="人生经历时间线"></textarea>
<input id="rewind" placeholder="想回到的时间点" />
<input id="traits" placeholder="能力 / 资源" />
<button onclick="simulate()">开始模拟</button>
</div>

<div id="result"></div>
</main>

<script>
let history = [];
async function simulate(){
  const res = await fetch('/api/simulate',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      persona:persona.value,
      timeline:timeline.value,
      rewind_point:rewind.value,
      traits:traits.value,
      history
    })
  });
  const data = await res.json();
  if(!data.success){ alert(data.error); return; }
  history.push({role:'assistant',content:JSON.stringify(data.data)});
  render(data.data);
}

function render(d){
  const box = document.getElementById('result');
  box.innerHTML = '';
  d.branches.forEach(b=>{
    box.innerHTML += `<div class="card branch">
      <h3>${b.title}</h3>
      <p><b>关键选择：</b>${b.key_choice}</p>
      <p><b>中期：</b>${b.mid_result}</p>
      <p><b>长期：</b>${b.long_term}</p>
      <p><b>概率：</b>${b.probability}</p>
      <p><b>风险：</b>${b.risks.join('、')}</p>
      <p class="small">因果解释：${b.why}</p>
    </div>`;
  });
  box.innerHTML += `<div class="card"><b>整体风险：</b>${d.overall_risks.join('、')}<br/><p>${d.summary}</p></div>`;
}
</script>
</body>
</html>

/* =========================
   三、合规与免责声明（App Store / Google Play）
========================= */
// 展示在页面底部或首次使用弹窗：
// “RE:LIFE 提供的是基于输入信息的情景推演与理性分析，
// 不构成任何现实建议、预测或保证，用户需对自身人生决策负责。”
