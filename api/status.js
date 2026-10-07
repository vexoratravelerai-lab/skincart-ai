module.exports = async function handler(req, res) {
  res.status(200).json({
    ok: true,
    project: "SkinCart AI",
    youcamConfigured: Boolean(process.env.YOUCAM_API_KEY)
  });
};
