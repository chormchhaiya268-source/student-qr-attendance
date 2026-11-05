// api/telegram.js  (Vercel serverless function)
//
// Telegram calls this file every time someone writes to your bot.
// When a parent opens  t.me/teppranam_checkin_bot?start=CODE  and presses Start,
// we look up CODE, find which student it belongs to, and save the parent's chat ID.
//
// Vercel environment variables needed:
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_WEBHOOK_SECRET   (a password you invent, letters/numbers/_/- only)
//   FIREBASE_SERVICE_ACCOUNT
//
// Firestore (created automatically / by later pieces):
//   parentLinks/{CODE}                         -> { teacherUid, studentId }
//   parentContacts/{teacherUid}/roster/{studentId} -> { chatIds: ["123", ...] }

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}
const db = admin.firestore();

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

async function reply(chatId, text) {
  try {
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      }
    );
  } catch (e) {
    console.error("reply failed:", e);
  }
}

module.exports = async (req, res) => {
  // Only Telegram (who knows our secret) may call this
  if (req.method !== "POST") return res.status(405).end();
  if (
    req.headers["x-telegram-bot-api-secret-token"] !==
    process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return res.status(401).end();
  }

  // From here on, always answer 200 so Telegram does not keep retrying
  try {
    const msg = req.body && req.body.message;
    if (!msg || !msg.text || !msg.chat || msg.chat.type !== "private") {
      return res.status(200).end();
    }

    const chatId = msg.chat.id;
    const m = msg.text.trim().match(/^\/start(?:\s+(\S+))?$/);
    if (!m) {
      // Parent typed something else: this bot only sends notifications
      await reply(
        chatId,
        "ℹ️ ប៊ុតនេះសម្រាប់ផ្ញើសារវត្តមានរបស់សិស្សប៉ុណ្ណោះ។\nមិនអាចឆ្លើយតបសារបានទេ។"
      );
      return res.status(200).end();
    }

    const code = m[1];

    // Pressed Start without a code
    if (!code) {
      await reply(
        chatId,
        "សួស្តី! 👋\nសូមចុចតំណភ្ជាប់ដែលគ្រូបានផ្តល់ឱ្យ ដើម្បីភ្ជាប់ជាមួយសិស្សរបស់អ្នក។"
      );
      return res.status(200).end();
    }

    // Look up the secret code
    const invalid =
      "❌ តំណភ្ជាប់នេះមិនត្រឹមត្រូវ ឬផុតកំណត់។\nសូមសួរគ្រូសម្រាប់តំណថ្មី។";
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(code)) {
      await reply(chatId, invalid);
      return res.status(200).end();
    }

    const linkSnap = await db.collection("parentLinks").doc(code).get();
    if (!linkSnap.exists) {
      await reply(chatId, invalid);
      return res.status(200).end();
    }
    const { teacherUid, studentId } = linkSnap.data();

    // Find the student's name for the confirmation message
    const stuSnap = await db
      .collection("students").doc(teacherUid)
      .collection("roster").doc(studentId)
      .get();
    const name = stuSnap.exists ? stuSnap.data().fullName || studentId : studentId;

    // Save this parent's chat ID (several parents allowed: father, mother...)
    await db
      .collection("parentContacts").doc(teacherUid)
      .collection("roster").doc(studentId)
      .set(
        { chatIds: admin.firestore.FieldValue.arrayUnion(String(chatId)) },
        { merge: true }
      );

    await reply(
      chatId,
      `✅ <b>ភ្ជាប់បានជោគជ័យ!</b>\n\nពីឥឡូវនេះ អ្នកនឹងទទួលបានសារវត្តមានរបស់សិស្ស៖\n<b>${esc(name)}</b>`
    );
  } catch (err) {
    console.error(err);
  }
  return res.status(200).end();
};
