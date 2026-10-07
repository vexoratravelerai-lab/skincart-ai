const { analyze } = require("../lib/youcam");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const body = req.body || {};
    const imageBuffer = body.imageBase64 ? Buffer.from(body.imageBase64, "base64") : null;
    if (imageBuffer && imageBuffer.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: "Use an image under 8 MB." });
    }
    const result = await analyze({
      key: process.env.YOUCAM_API_KEY,
      imageBuffer,
      imageUrl: body.imageUrl,
      fileName: body.fileName || "selfie.jpg",
      mimeType: body.mimeType || "image/jpeg"
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Analysis failed." });
  }
};
