// api/myip.js  (Vercel serverless function)
//
// Open  https://YOUR-SITE/api/myip  in a browser.
// It shows the public internet address (IP) of the device that opened it.
// Use it to find out if the school's internet always shows the SAME address.

module.exports = (req, res) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  const ip =
    forwarded.split(",")[0].trim() ||
    String(req.headers["x-real-ip"] || "") ||
    "unknown";

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ip,
    note: "This is the public internet address of the device that opened this page.",
  });
};
