// api/notify.js  (Vercel serverless function, CommonJS)
//
// Called by the student page right after a check-in / check-out.
// Sends a Khmer Telegram message to every parent connected to that student.
//
// Parents are saved by api/telegram.js at:
//   parentContacts/{teacherUid}/roster/{studentId}  ->  { chatIds: ["123", ...] }
//
// Vercel environment variables: TELEGRAM_BOT_TOKEN, FIREBASE_SERVICE_ACCOUNT

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}
const db = admin.firestore();

const SAFE_ID = /^[^\/\\]{1,128}$/; // blocks path tricks like "a/b"

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function fmt(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Phnom_Penh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

async function sendTelegram(chatId, text) {
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      }
    );
    const j = await r.json();
    if (!j.ok) console.error("Telegram error for", chatId, j);
    return j.ok === true;
  } catch (e) {
    console.error("Telegram fetch failed:", e);
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { teacherUid, sessionId, studentId, type } = req.body || {};
    if (
      ![teacherUid, sessionId, studentId].every(
        (v) => typeof v === "string" && SAFE_ID.test(v)
      )
    ) {
      return res.status(400).json({ ok: false, error: "Bad request" });
    }
    const isCheckout = type === "checkout";
    const flag = isCheckout ? "checkoutNotified" : "checkinNotified";

    const recRef = db
      .collection("attendance").doc(teacherUid)
      .collection("sessions").doc(sessionId)
      .collection("records").doc(studentId);

    // 1. Find the parents first (nothing to do if none connected)
    const contactSnap = await db
      .collection("parentContacts").doc(teacherUid)
      .collection("roster").doc(studentId)
      .get();
    const chatIds =
      contactSnap.exists && Array.isArray(contactSnap.data().chatIds)
        ? contactSnap.data().chatIds
        : [];
    if (chatIds.length === 0) {
      return res.status(200).json({ ok: true, skipped: "no parent connected" });
    }

    // 2. Claim this notification atomically (prevents duplicates/replays)
    let rec = null;
    let reason = null;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(recRef);
      if (!snap.exists) { reason = "no record"; return; }
      const d = snap.data();
      if (d.status !== "present") { reason = "not present"; return; }
      if (d[flag]) { reason = "already sent"; return; }

      const iso = isCheckout ? d.checkOutTime : d.checkInTime;
      const t = iso ? new Date(iso) : null;
      if (!t || isNaN(t) || Date.now() - t.getTime() > 5 * 60 * 1000) {
        reason = "event too old or missing";
        return;
      }
      tx.update(recRef, { [flag]: true });
      rec = { ...d, eventTime: t };
    });

    if (!rec) {
      return res.status(200).json({ ok: true, skipped: reason });
    }

    // 3. Build the Khmer message
    const title = isCheckout
      ? "🏫 សិស្សបានចាកចេញពីសាលា"
      : "✅ សិស្សបានចុះវត្តមានចូលរៀន";
    const timeLabel = isCheckout ? "ម៉ោងចាកចេញ" : "ម៉ោងចូលរៀន";

    const text =
      `<b>${title}</b>\n\n` +
      `👤 ឈ្មោះ៖ <b>${esc(rec.fullName)}</b>\n` +
      `🆔 អត្តលេខ៖ ${esc(rec.studentId || studentId)}\n` +
      `🏫 ថ្នាក់៖ ${esc(rec.grade)}\n` +
      `🕒 ${timeLabel}៖ ${esc(fmt(rec.eventTime))}\n\n` +
      `វិទ្យាល័យទេពប្រណម្យ`;

    // 4. Send to every connected parent
    const results = await Promise.all(chatIds.map((id) => sendTelegram(id, text)));
    const sentCount = results.filter(Boolean).length;

    if (sentCount === 0) {
      await recRef.update({ [flag]: false }); // release claim so it can retry
      return res.status(502).json({ ok: false, error: "Telegram failed" });
    }

    return res.status(200).json({ ok: true, sent: sentCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
