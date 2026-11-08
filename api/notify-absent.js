// api/notify-absent.js  (Vercel serverless function)
//
// Sends a Khmer Telegram message to the parents of every student who has NOT
// checked in, once the teacher's check-in time has ended.
//
// Who may call it:
//   1) The teacher dashboard (logged-in teacher, Firebase ID token).
//   2) Optional: an outside timer (e.g. cron-job.org) that sends
//        Authorization: Bearer <CRON_SECRET>
//      Only works if you add CRON_SECRET in Vercel. It covers every teacher
//      who has an open session, even when the dashboard page is closed.
//
// Vercel environment variables:
//   TELEGRAM_BOT_TOKEN, FIREBASE_SERVICE_ACCOUNT, (optional) CRON_SECRET

const crypto = require("crypto");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}
const db = admin.firestore();

const TZ = "Asia/Phnom_Penh";
const hmFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
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

async function processTeacher(teacherUid, manual) {
  const sessRef = db.collection("sessions").doc(teacherUid);
  const sSnap = await sessRef.get();
  if (!sSnap.exists) return { status: "no_session" };
  const s = sSnap.data();

  const today = dayFmt.format(new Date());
  if (!s.isOpen || !s.sessionId || s.date !== today) {
    return { status: "no_session" };
  }
  const sid = s.sessionId;
  const nowHM = hmFmt.format(new Date());

  if (!manual) {
    const end = s.checkInEndTime;
    if (!/^\d{2}:\d{2}$/.test(end || "")) return { status: "no_window" };
    if (s.absentAlertSessionId === sid) return { status: "already_done" };
    if (nowHM <= end) return { status: "too_early" };

    // Safety: if the session was started AFTER the check-in time already
    // ended, never auto-alert everybody. The teacher must press the button.
    if (s.startedAt) {
      const startHM = hmFmt.format(new Date(s.startedAt));
      if (startHM > end) return { status: "started_late" };
    }
  }

  // Everyone who has not checked in and was not already alerted
  const recSnap = await db
    .collection("attendance").doc(teacherUid)
    .collection("sessions").doc(sid)
    .collection("records").get();

  const absent = [];
  let alreadyAlerted = 0;
  recSnap.forEach((d) => {
    const r = d.data();
    if (r.status === "present" || r.checkInTime) return;
    if (r.absentNotified) { alreadyAlerted++; return; }
    absent.push({ id: d.id, ref: d.ref, rec: r });
  });

  // Parents of those students
  const contactRefs = absent.map((a) =>
    db.collection("parentContacts").doc(teacherUid)
      .collection("roster").doc(a.id)
  );
  const contactSnaps = contactRefs.length ? await db.getAll(...contactRefs) : [];
  absent.forEach((a, i) => {
    const c = contactSnaps[i];
    a.chatIds =
      c && c.exists && Array.isArray(c.data().chatIds) ? c.data().chatIds : [];
  });

  let messages = 0;
  let students = 0;
  let noParent = 0;

  async function handleOne(a) {
    if (a.chatIds.length === 0) { noParent++; return; }

    // Claim so the same student is never alerted twice
    let claimed = false;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(a.ref);
      const d = snap.exists ? snap.data() : null;
      if (!d || d.absentNotified || d.status === "present" || d.checkInTime) return;
      tx.update(a.ref, { absentNotified: true });
      claimed = true;
    });
    if (!claimed) return;

    const text =
      `⚠️ <b>សិស្សមិនទាន់បានចុះវត្តមាន</b>\n` +
      `🏫 វិទ្យាល័យទេពប្រណម្យ\n\n` +
      `👤 ឈ្មោះ៖ <b>${esc(a.rec.fullName)}</b>\n` +
      `🆔 អត្តលេខ៖ ${esc(a.rec.studentId || a.id)}\n` +
      `📚 ថ្នាក់៖ ${esc(a.rec.grade)}\n` +
      `📅 កាលបរិច្ឆេទ៖ ${today}\n` +
      `🕒 ម៉ោងពិនិត្យ៖ ${nowHM}\n\n` +
      `កូនរបស់អ្នកមិនទាន់បានចុះវត្តមានចូលរៀនទេ។ ` +
      `សូមទំនាក់ទំនងគ្រូ ប្រសិនបើមានបញ្ហា។`;

    const results = await Promise.all(a.chatIds.map((id) => sendTelegram(id, text)));
    const ok = results.filter(Boolean).length;
    if (ok === 0) {
      await a.ref.update({ absentNotified: false }); // allow a retry
    } else {
      messages += ok;
      students++;
    }
  }

  // Send in small groups so we stay inside Telegram's speed limit
  for (let i = 0; i < absent.length; i += 15) {
    await Promise.all(absent.slice(i, i + 15).map(handleOne));
  }

  // Remember that this session is finished (saves reads on later calls)
  await sessRef.update({ absentAlertSessionId: sid }).catch(() => {});

  if (absent.length === 0 && alreadyAlerted > 0) {
    return { status: "already_done", absent: 0, students: 0, messages: 0, noParent: 0 };
  }
  return { status: "sent", absent: absent.length, students, messages, noParent };
}

module.exports = async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ ok: false, error: "Not logged in" });

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ ok: false, error: "Token missing" });
  }

  try {
    // Mode 2: outside timer (needs CRON_SECRET in Vercel)
    const cron = process.env.CRON_SECRET;
    if (cron && safeEqual(token, cron)) {
      const open = await db.collection("sessions").where("isOpen", "==", true).get();
      const out = [];
      for (const d of open.docs) {
        try {
          out.push(await processTeacher(d.id, false));
        } catch (e) {
          console.error("cron teacher failed:", e);
          out.push({ status: "error" });
        }
      }
      return res.status(200).json({ ok: true, teachers: out.length, results: out });
    }

    // Mode 1: the logged-in teacher
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
    let uid;
    try {
      uid = (await admin.auth().verifyIdToken(token)).uid;
    } catch (e) {
      return res.status(401).json({ ok: false, error: "Login expired" });
    }
    const manual = !!(req.body && req.body.manual);
    const r = await processTeacher(uid, manual);
    return res.status(200).json({ ok: true, ...r });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
