export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).json({
    ok: true,
    msg: "RE:LIFE API is running",
    time: new Date().toISOString(),
    endpoints: ["/api/ping", "/api/generate", "/api/status"],
  });
}
