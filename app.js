/* ============================================================
   RE:LIFE — 前端逻辑核心
   Herr 专属版本
   功能：
   - 语言系统（中/英）
   - index → loading → result 跳转
   - 调用 /api/generate
   - 渲染 A/B/C、Single、Chat
   - 自动评分雷达图
============================================================ */

/* ------------------------------------------------------------
   语言系统
------------------------------------------------------------ */
const LANG = {
    zh: {
        loading: "正在回环你的时间线，请稍候…",
        backHome: "返回首页",
        copy: "复制结果",
        exportPDF: "导出 PDF",
        routeA: "路线 A",
        routeB: "路线 B",
        routeC: "路线 C",
        singleRoute: "单路线",
        chatMode: "对话模式",
        summary: "总结",
        scoreTitle: "自动评分雷达图",
        scoreLabels: ["整体满意度", "稳定性", "成长性", "自由度", "关系质量"]
    },
    en: {
        loading: "Rewinding your timeline…",
        backHome: "Back to Home",
        copy: "Copy Result",
        exportPDF: "Export PDF",
        routeA: "Route A",
        routeB: "Route B",
        routeC: "Route C",
        singleRoute: "Single Route",
        chatMode: "Chat Mode",
        summary: "Summary",
        scoreTitle: "Auto Score Radar Chart",
        scoreLabels: ["Satisfaction", "Stability", "Growth", "Freedom", "Relationships"]
    }
};

function getLang() {
    return localStorage.getItem("lang") || "zh";
}

/* ------------------------------------------------------------
   index.html → 点击生成 → 跳转 loading.html
------------------------------------------------------------ */
function startSimulation() {
    const background = document.getElementById("field-background").value.trim();
    const basic = document.getElementById("field-basic").value.trim();
    const timeline = document.getElementById("field-timeline").value.trim();
    const target = document.getElementById("field-target").value.trim();
    const skills = document.getElementById("field-skills").value.trim();
    const mode = document.getElementById("field-mode").value;
    const lang = getLang();

    if (!background || !basic || !timeline || !target) {
        alert(lang === "zh"
            ? "请完整填写前四个字段。"
            : "Please fill in the first four fields.");
        return;
    }

    const payload = {
        background,
        basic,
        timeline,
        target,
        skills,
        mode,
        lang
    };

    localStorage.setItem("pendingPayload", JSON.stringify(payload));

    window.location.href = "loading.html";
}

/* ------------------------------------------------------------
   loading.html → 调用 API → 跳转 result.html
------------------------------------------------------------ */
async function runSimulation() {
    const lang = getLang();
    document.getElementById("loading-text").innerText = LANG[lang].loading;

    const payload = JSON.parse(localStorage.getItem("pendingPayload") || "{}");

    try {
        const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        const id = "run_" + Date.now();
        localStorage.setItem(id, JSON.stringify(data));

        window.location.href = "result.html?id=" + id;

    } catch (e) {
        alert("Error: " + e.message);
    }
}

/* ------------------------------------------------------------
   result.html → 渲染结果
------------------------------------------------------------ */
function loadResultPage() {
    const lang = getLang();
    const dict = LANG[lang];

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    const data = JSON.parse(localStorage.getItem(id) || "{}");

    if (!data || !data.mode) {
        document.getElementById("result-container").innerText =
            lang === "zh" ? "未找到结果。" : "No result found.";
        return;
    }

    renderResult(data, dict);
    renderRadarChart(data, dict);
}

/* ------------------------------------------------------------
   渲染结果内容
------------------------------------------------------------ */
function renderResult(data, dict) {
    const container = document.getElementById("result-container");
    container.innerHTML = "";

    /* A/B/C 模式 */
    if (data.mode === "abc") {
        container.appendChild(createRouteCard(dict.routeA, data.routes.A));
        container.appendChild(createRouteCard(dict.routeB, data.routes.B));
        container.appendChild(createRouteCard(dict.routeC, data.routes.C));
    }

    /* 单路线模式 */
    if (data.mode === "single") {
        container.appendChild(createRouteCard(dict.singleRoute, data.routes.single));
    }

    /* Chat 模式 */
    if (data.mode === "chat") {
        const chatBox = document.createElement("div");
        chatBox.className = "chat-box";

        data.chat.forEach(msg => {
            const bubble = document.createElement("div");
            bubble.className = msg.role === "user" ? "bubble user" : "bubble ai";
            bubble.innerText = msg.content;
            chatBox.appendChild(bubble);
        });

        container.appendChild(chatBox);
    }

    /* 总结 */
    container.appendChild(createRouteCard(dict.summary, data.summary));
}

/* ------------------------------------------------------------
   创建路线卡片
------------------------------------------------------------ */
function createRouteCard(title, text) {
    const card = document.createElement("div");
    card.className = "output-card";

    const header = document.createElement("div");
    header.className = "output-header";

    const h = document.createElement("div");
    h.className = "tag";
    h.innerText = title;

    header.appendChild(h);

    const body = document.createElement("div");
    body.innerText = text;

    card.appendChild(header);
    card.appendChild(body);

    return card;
}

/* ------------------------------------------------------------
   自动评分雷达图
------------------------------------------------------------ */
function renderRadarChart(data, dict) {
    const ctx = document.getElementById("radarChart").getContext("2d");

    const scores = data.scores;

    new Chart(ctx, {
        type: "radar",
        data: {
            labels: dict.scoreLabels,
            datasets: [{
                label: dict.scoreTitle,
                data: [
                    scores.satisfaction,
                    scores.stability,
                    scores.growth,
                    scores.freedom,
                    scores.relationship
                ],
                fill: true,
                backgroundColor: "rgba(56, 189, 248, 0.2)",
                borderColor: "#38bdf8",
                pointBackgroundColor: "#38bdf8"
            }]
        },
        options: {
            scales: {
                r: {
                    suggestedMin: 0,
                    suggestedMax: 10,
                    ticks: { stepSize: 2, color: "#94a3b8" },
                    grid: { color: "rgba(148,163,184,0.3)" },
                    angleLines: { color: "rgba(148,163,184,0.3)" },
                    pointLabels: { color: "#e2e8f0" }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

/* ------------------------------------------------------------
   复制结果
------------------------------------------------------------ */
function copyResult() {
    const text = document.getElementById("result-container").innerText;
    navigator.clipboard.writeText(text);
}

/* ------------------------------------------------------------
   导出 PDF
------------------------------------------------------------ */
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });

    const text = document.getElementById("result-container").innerText;
    const lines = pdf.splitTextToSize(text, 500);

    pdf.text(lines, 50, 50);
    pdf.save("relife_result.pdf");
}

/* ------------------------------------------------------------
   返回首页
------------------------------------------------------------ */
function goHome() {
    window.location.href = "index.html";
}
