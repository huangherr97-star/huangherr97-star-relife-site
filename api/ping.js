export default function handler(req, res) {
  // CORS（你现在是同域，其实不必，但保留更稳）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();

  return res.status(200).json({
    ok: true,
    method: req.method,
    msg: "PING OK",
    time: new Date().toISOString(),
  });
}
