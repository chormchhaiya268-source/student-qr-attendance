// api/parent-link.js  (Vercel serverless function)
//
// The teacher page calls this when the teacher presses "Parent link".
// It checks the teacher is really logged in, then returns a secret link like
//   https://t.me/teppranam_checkin_bot?start=CODE
// CODE belongs to ONE student only.

const crypto = require("crypto");
const admin = require("firebase-admin");

const BOT_USERNAME = "teppranam_checkin_bot";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}
const db = admin.firestore();

function newCode() {
  // 12 random characters, only A-Z a-z 0-9 _ -  (allowed by Telegram)
  return crypto.randomBytes(9).toString("base64url");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // 1. Who is calling? Must be a logged-in teacher.
    const auth = req.headers.authorization || "";
    const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!idToken) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }
    let teacherUid;
    try {
      teacherUid = (await admin.auth().verifyIdToken(idToken)).uid;
    } catch (e) {
      return res.status(401).json({ ok: false, error: "Login expired" });
    }

    // 2. Which student? Must be in THIS teacher's own roster.
    const { studentId, reset } = req.body || {};
    if (typeof studentId !== "string" || !/^[^\/\\]{1,64}$/.test(studentId)) {
      return res.status(400).json({ ok: false, error: "Bad student ID" });
    }
    const stuSnap = await db
      .collection("students").doc(teacherUid)
      .collection("roster").doc(studentId)
      .get();
    if (!stuSnap.exists) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }

    // 3. Reuse the existing code, or make a new one
    const contactRef = db
      .collection("parentContacts").doc(teacherUid)
      .collection("roster").doc(studentId);
    const contactSnap = await contactRef.get();
    const contact = contactSnap.exists ? contactSnap.data() : {};

    let code = contact.linkCode;
    let codeIsValid = false;
    if (code && !reset) {
      const linkSnap = await db.collection("parentLinks").doc(code).get();
      codeIsValid = linkSnap.exists;
    }

    if (!codeIsValid) {
      if (code) {
        // Old code stops working
        await db.collection("parentLinks").doc(code).delete();
      }
      code = newCode();
      await db.collection("parentLinks").doc(code).set({
        teacherUid,
        studentId,
        createdAt: new Date().toISOString(),
      });
      await contactRef.set({ linkCode: code }, { merge: true });
    }

    const connected = Array.isArray(contact.chatIds) ? contact.chatIds.length : 0;

    return res.status(200).json({
      ok: true,
      link: `https://t.me/${BOT_USERNAME}?start=${code}`,
      connected,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
