// api/telegram.js  (Vercel serverless function)
//
// 1) POST  = Telegram calls this when someone writes to your bot.
//            /start CODE  -> connects the parent to ONE student.
//            anything else -> the bot DELETES the message (chat looks read-only).
// 2) GET   = open  https://YOUR-SITE/api/telegram  in a browser to see a
//            self-check that tells you what is wrong (no secrets are shown).
//
// Vercel environment variables:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, FIREBASE_SERVICE_ACCOUNT

const admin = require("firebase-admin");

// Firebase is started only when needed, so a bad Firebase key can never
// stop the bot from at least answering /start.
function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      ),
    });
  }
  return admin.firestore();
}

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

async function tg(method, payload) {
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    return await r.json();
  } catch (e) {
    console.error(method, "failed:", e);
    return { ok: false, description: String(e.message || e) };
  }
}

const reply = (chatId, text) =>
  tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });

// ------------------------------------------------
// GET: self-check page
// ------------------------------------------------
async function selfCheck(res) {
  const out = {
    hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
    hasWebhookSecret: !!process.env.TELEGRAM_WEBHOOK_SECRET,
    hasFirebaseKey: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    firebaseWorks: false,
    webhook: null,
    problems: [],
  };

  if (!out.hasBotToken)
    out.problems.push("TELEGRAM_BOT_TOKEN is missing in Vercel. Add it, then press Redeploy.");
  if (!out.hasWebhookSecret)
    out.problems.push("TELEGRAM_WEBHOOK_SECRET is missing in Vercel. Add it, then press Redeploy, then run the setWebhook link again.");
  if (!out.hasFirebaseKey)
    out.problems.push("FIREBASE_SERVICE_ACCOUNT is missing in Vercel. Paste the whole JSON file, then press Redeploy.");

  if (out.hasFirebaseKey) {
    try {
      await getDb().collection("parentLinks").limit(1).get();
      out.firebaseWorks = true;
    } catch (e) {
      out.problems.push(
        "FIREBASE_SERVICE_ACCOUNT does not work (" +
          String(e.message || e).slice(0, 90) +
          "). Download a NEW private key from Firebase and paste the WHOLE file again, then Redeploy."
      );
    }
  }

  if (out.hasBotToken) {
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      );
      const j = await r.json();
      if (!j.ok) {
        out.problems.push("Telegram rejected the bot token. Copy the token again from BotFather.");
      } else {
        const w = j.result;
        out.webhook = {
          url: w.url || "(empty)",
          pending_update_count: w.pending_update_count,
          last_error_message: w.last_error_message || null,
        };
        if (!w.url)
          out.problems.push("The webhook is not set. Run the setWebhook link again.");
        else if (!/\/api\/telegram$/.test(w.url))
          out.problems.push("The webhook url must end with /api/telegram. Run the setWebhook link again.");
        const err = String(w.last_error_message || "");
        if (/401/.test(err))
          out.problems.push("Telegram gets 401: the secret password in Vercel is different from the one in the setWebhook link. Make them identical, Redeploy, and run setWebhook again.");
        else if (/404/.test(err))
          out.problems.push("Telegram gets 404: api/telegram.js is not in the api folder on GitHub, or Vercel has not deployed it.");
        else if (/500|502|503/.test(err))
          out.problems.push("Telegram gets a server error: check FIREBASE_SERVICE_ACCOUNT and the Vercel Logs.");
        else if (err)
          out.problems.push("Telegram reports: " + err);
      }
    } catch (e) {
      out.problems.push("Could not reach Telegram: " + String(e.message || e));
    }
  }

  if (out.problems.length === 0) out.problems.push("No problem found. Everything looks OK.");
  return res.status(200).json(out);
}

module.exports = async (req, res) => {
  if (req.method === "GET") return selfCheck(res);
  if (req.method !== "POST") return res.status(405).end();

  // Only Telegram (who knows our secret) may call this
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    !secret ||
    req.headers["x-telegram-bot-api-secret-token"] !== secret
  ) {
    return res.status(401).end();
  }

  // From here on, always answer 200 so Telegram does not keep retrying
  try {
    const msg = req.body && req.body.message;
    if (!msg || !msg.chat || msg.chat.type !== "private") {
      return res.status(200).end();
    }

    const chatId = msg.chat.id;
    const m = (msg.text || "").trim().match(/^\/start(?:\s+(\S+))?$/);

    // Anything that is not /start: delete it, so the chat looks read-only
    if (!m) {
      const del = await tg("deleteMessage", {
        chat_id: chatId,
        message_id: msg.message_id,
      });
      if (!del.ok) {
        await reply(
          chatId,
          "ℹ️ ប៊ុតនេះសម្រាប់ផ្ញើសារវត្តមានរបស់សិស្សប៉ុណ្ណោះ។\nមិនអាចឆ្លើយតបសារបានទេ។"
        );
      }
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

    const invalid =
      "❌ តំណភ្ជាប់នេះមិនត្រឹមត្រូវ ឬផុតកំណត់។\nសូមសួរគ្រូសម្រាប់តំណថ្មី។";
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(code)) {
      await reply(chatId, invalid);
      return res.status(200).end();
    }

    const db = getDb();
    const linkSnap = await db.collection("parentLinks").doc(code).get();
    if (!linkSnap.exists) {
      await reply(chatId, invalid);
      return res.status(200).end();
    }
    const { teacherUid, studentId } = linkSnap.data();

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
