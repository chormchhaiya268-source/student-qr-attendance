// ================================================
// script.js
// Student Attendance Page — Full Secure Logic
// Security Layers:
//   1. Session ID validation
//   2. GPS + Haversine verification
//   3. Device Fingerprinting (SHA-256)
//   4. Rate Limiting (5 attempts / 5 min)
//   5. Duplicate attendance check
//   6. Session timeout check
//   7. Full attendance log
// ================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ================================================
// FIREBASE CONFIG
// ================================================
const firebaseConfig = {
  apiKey:
    "AIzaSyDpKCJ9xVeq2BY07aDwzzQ1qWvbStRuZLI",
  authDomain:
    "student-qr-attendance-90323.firebaseapp.com",
  projectId:
    "student-qr-attendance-90323",
  storageBucket:
    "student-qr-attendance-90323.firebasestorage.app",
  messagingSenderId:
    "45837607105",
  appId:
    "1:45837607105:web:29f7dd8350f1dc06bd7440"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ================================================
// SCHOOL LOCATION
// ================================================
const SCHOOL_LATITUDE         = 11.822624138074948;
const SCHOOL_LONGITUDE        = 104.7536601355822;
const ALLOWED_DISTANCE_METERS = 100;
const MAX_ACCEPTABLE_ACCURACY = 50;

// ================================================
// RATE LIMIT SETTINGS
// ================================================
const MAX_ATTEMPTS     = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in ms

// ================================================
// APP STATE
// ================================================
let currentLang      = "en";
let sessionId        = null;
let sessionData      = null;
let studentLocation  = null;
let locationVerified = false;
let deviceFingerprint = null;

let studentsMap    = new Map();
let studentsLoaded = false;

// ================================================
// TRANSLATIONS — WITH NEW SECURITY MESSAGES
// ================================================
const i18n = {
  en: {
    title:    "QR Attendance System",
    subtitle: "Tepranom High School",

    sessionActive:
      "Session is open. You can check in.",
    sessionClosed:
      "Attendance session is closed.",
    sessionClosedTitle:
      "Session Closed",
    sessionClosedMsg:
      "The attendance session is not open right now. Please ask your teacher to start the session and scan the correct QR code.",
    noSession:
      "No attendance session found. Please scan the QR code again.",
    sessionExpired:
      "This session is no longer active.",

    requestingLocation:
      "Requesting your location...",
    locationReason:
      "Your location is needed to verify you are at school.",
    locating:
      "Getting your GPS location...",
    locationVerified:
      "✅ You are near the school. Location verified.",
    locationTooFar:
      "❌ You are too far from the school. You must be within 100 meters of the school to check in.",
    locationDenied:
      "Location permission was denied. You must allow location access to check in.",
    locationError:
      "Could not get your location. Please try again.",
    locationPoorAccuracy:
      "Your location is not accurate enough. Please move to an open area and try again.",
    retryLocation:
      "Check Location Again",
    gpsAccuracy:
      "GPS Accuracy",
    distanceFromSchool:
      "Distance from school",
    meters: "meters",

    loadingStudents:
      "Loading student data...",
    studentsReady:
      "Ready. Please enter your Student ID.",

    studentIdLabel:
      "Student ID",
    studentIdPlaceholder:
      "Enter your Student ID (e.g. IT15)",
    fullNameLabel:
      "Full Name",
    fullNamePlaceholder:
      "Your full name",
    ageLabel:
      "Age",
    agePlaceholder:
      "Your age",
    gradeLabel:
      "Grade / Class",
    gradePlaceholder:
      "Your grade or class",
    formTitle:
      "📋 Mark Your Attendance",
    submitButton:
      "✅ Submit Attendance",

    errStudentId:
      "Please enter your Student ID.",
    errStudentIdNotFound:
      "Student ID not found. Please check your ID and try again.",
    errStudentIdLoading:
      "Please wait. Student data is still loading.",
    errName:
      "Please enter your full name.",
    errAge:
      "Please enter a valid age.",
    errGrade:
      "Please enter your grade or class.",
    errLocation:
      "Location not verified. Please wait for location check.",
    errTooFar:
      "You are too far from school. Move closer and try again.",
    errAlreadyCheckedIn:
      "You have already checked in.",

    // ✅ NEW SECURITY MESSAGES
    errDeviceUsed:
      "This device has already been used to submit attendance for this session.",
    errRateLimit:
      "Too many attempts. Please wait 5 minutes.",
    errSessionExpiredTimeout:
      "This attendance session has expired.",
    fingerprintGenerating:
      "Verifying your device...",

    autoFillMsg:
      "✅ Student found. Details filled automatically.",

    successTitle:
      "Attendance Marked!",
    successMessage:
      "Your attendance has been recorded successfully.",

    savingText:
      "Saving your attendance...",

    footerSecurity:
      "🔒 Your location is only used to verify attendance.",
    footerSchool:
      "Tepranom High School Attendance System",

    notCheckedInYet: "Not Checked In Yet",
    present:         "Present",
    colDate:         "Date",
    colTime:         "Time"
  },

  km: {
    title:    "ប្រព័ន្ធចុះវត្តមាន QR",
    subtitle: "វិទ្យាល័យទេពប្រណម្យ",

    sessionActive:
      "វគ្គកំពុងបើក។ អ្នកអាចចុះវត្តមានបាន។",
    sessionClosed:
      "វគ្គចុះវត្តមានបានបិទ។",
    sessionClosedTitle:
      "វគ្គបានបិទ",
    sessionClosedMsg:
      "វគ្គចុះវត្តមានមិនទាន់បើកនៅពេលនេះទេ។ សូមស្នើគ្រូឱ្យចាប់ផ្ដើមវគ្គ ហើយស្កេន QR Code ម្តងទៀត។",
    noSession:
      "រកមិនឃើញវគ្គចុះវត្តមានទេ។ សូមស្កេន QR Code ម្តងទៀត។",
    sessionExpired:
      "វគ្គនេះលែងសកម្មទៀតហើយ។",

    requestingLocation:
      "កំពុងស្នើទីតាំងរបស់អ្នក...",
    locationReason:
      "ត្រូវការទីតាំងរបស់អ្នក ដើម្បីផ្ទៀងផ្ទាត់ថាអ្នកនៅសាលា។",
    locating:
      "កំពុងទទួល GPS ទីតាំងរបស់អ្នក...",
    locationVerified:
      "✅ អ្នកស្ថិតនៅជិតសាលា។ ទីតាំងត្រូវបានផ្ទៀងផ្ទាត់។",
    locationTooFar:
      "❌ អ្នកនៅឆ្ងាយពីសាលាពេក។ អ្នកត្រូវស្ថិតនៅក្នុងចម្ងាយ 100 ម៉ែត្រពីសាលា ដើម្បីចុះវត្តមាន។",
    locationDenied:
      "ការអនុញ្ញាតទីតាំងត្រូវបានបដិសេធ។ អ្នកត្រូវអនុញ្ញាតការចូលប្រើទីតាំង ដើម្បីចុះវត្តមាន។",
    locationError:
      "មិនអាចទទួលទីតាំងរបស់អ្នក។ សូមព្យាយាមម្តងទៀត។",
    locationPoorAccuracy:
      "ទីតាំងរបស់អ្នកមិនមានភាពត្រឹមត្រូវគ្រប់គ្រាន់ទេ។ សូមទៅកន្លែងដែលមានទីធ្លា ហើយពិនិត្យម្តងទៀត។",
    retryLocation:
      "ពិនិត្យទីតាំងម្តងទៀត",
    gpsAccuracy:
      "ភាពត្រឹមត្រូវ GPS",
    distanceFromSchool:
      "ចម្ងាយពីសាលា",
    meters: "ម៉ែត្រ",

    loadingStudents:
      "កំពុងផ្ទុកទិន្នន័យសិស្ស...",
    studentsReady:
      "រួចរាល់។ សូមបញ្ចូលលេខសម្គាល់សិស្ស។",

    studentIdLabel:
      "លេខសម្គាល់សិស្ស",
    studentIdPlaceholder:
      "បញ្ចូលលេខសម្គាល់សិស្ស (ឧ. IT15)",
    fullNameLabel:
      "ឈ្មោះពេញ",
    fullNamePlaceholder:
      "ឈ្មោះពេញរបស់អ្នក",
    ageLabel:
      "អាយុ",
    agePlaceholder:
      "អាយុរបស់អ្នក",
    gradeLabel:
      "ថ្នាក់រៀន",
    gradePlaceholder:
      "ថ្នាក់រៀនរបស់អ្នក",
    formTitle:
      "📋 ចុះវត្តមានរបស់អ្នក",
    submitButton:
      "✅ ដាក់ស្នើវត្តមាន",

    errStudentId:
      "សូមបញ្ចូលលេខសម្គាល់សិស្ស។",
    errStudentIdNotFound:
      "រកមិនឃើញលេខសម្គាល់សិស្ស។ សូមពិនិត្យលេខសម្គាល់ ហើយព្យាយាមម្តងទៀត។",
    errStudentIdLoading:
      "សូមរង់ចាំ។ ទិន្នន័យសិស្សកំពុងផ្ទុក។",
    errName:
      "សូមបញ្ចូលឈ្មោះពេញ។",
    errAge:
      "សូមបញ្ចូលអាយុត្រឹមត្រូវ។",
    errGrade:
      "សូមបញ្ចូលថ្នាក់រៀន។",
    errLocation:
      "ទីតាំងមិនទាន់ផ្ទៀងផ្ទាត់ទេ។ សូមរង់ចាំការពិនិត្យទីតាំង។",
    errTooFar:
      "អ្នកនៅឆ្ងាយពីសាលា។ សូមមកជិតជាង ហើយព្យាយាមម្តងទៀត។",
    errAlreadyCheckedIn:
      "អ្នកបានចុះវត្តមានរួចហើយ។",

    // ✅ NEW SECURITY MESSAGES
    errDeviceUsed:
      "ឧបករណ៍នេះបានប្រើសម្រាប់ចុះវត្តមានរួចហើយក្នុងវគ្គនេះ។",
    errRateLimit:
      "អ្នកបានព្យាយាមច្រើនពេក។\nសូមរង់ចាំ ៥ នាទី។",
    errSessionExpiredTimeout:
      "វគ្គចុះវត្តមាននេះបានផុតកំណត់ពេលវេលាហើយ។",
    fingerprintGenerating:
      "កំពុងផ្ទៀងផ្ទាត់ឧបករណ៍របស់អ្នក...",

    autoFillMsg:
      "✅ រកឃើញសិស្ស។ ព័ត៌មានត្រូវបានបំពេញដោយស្វ័យប្រវត្តិ។",

    successTitle:
      "វត្តមានត្រូវបានកត់ត្រា!",
    successMessage:
      "វត្តមានរបស់អ្នកត្រូវបានរក្សាទុកដោយជោគជ័យ។",

    savingText:
      "កំពុងរក្សាទុកវត្តមាន...",

    footerSecurity:
      "🔒 ទីតាំងរបស់អ្នកត្រូវបានប្រើតែសម្រាប់ផ្ទៀងផ្ទាត់វត្តមានប៉ុណ្ណោះ។",
    footerSchool:
      "ប្រព័ន្ធវត្តមានវិទ្យាល័យទេពប្រណម្យ",

    notCheckedInYet: "មិនទាន់ចុះវត្តមាន",
    present:         "មានវត្តមាន",
    colDate:         "កាលបរិច្ឆេទ",
    colTime:         "ម៉ោង"
  }
};

// ================================================
// TRANSLATE HELPER
// ================================================
function i(key) {
  return i18n[currentLang][key] || key;
}

// ================================================
// APPLY LANGUAGE
// ================================================
function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("studentLanguage", lang);

  document.documentElement.lang =
    lang === "km" ? "km" : "en";
  document.body.classList.toggle(
    "khmer", lang === "km"
  );

  document.querySelectorAll("[data-i18n]")
    .forEach(function (el) {
      const key = el.getAttribute("data-i18n");
      const val = i(key);
      if (val !== key) el.textContent = val;
    });

  document.querySelectorAll(
    "[data-i18n-placeholder]"
  ).forEach(function (el) {
    const key =
      el.getAttribute("data-i18n-placeholder");
    const val = i(key);
    if (val !== key) el.placeholder = val;
  });

  const langBtn =
    document.getElementById("languageButton");
  if (langBtn) {
    langBtn.textContent =
      lang === "en" ? "ខ្មែរ" : "English";
  }

  const retryBtn =
    document.getElementById("retryLocationBtn");
  if (retryBtn) {
    retryBtn.textContent = i("retryLocation");
  }

  if (studentLocation) {
    showDistanceResult(studentLocation);
  }

  updateStudentIdFieldState();
}

// ================================================
// STUDENT ID FIELD STATE
// ================================================
function updateStudentIdFieldState() {
  const studentIdInput =
    document.getElementById("studentId");
  if (!studentIdInput) return;

  if (!studentsLoaded) {
    studentIdInput.disabled    = true;
    studentIdInput.placeholder =
      i("loadingStudents");
    studentIdInput.style.background = "#f1f5f9";
    studentIdInput.style.cursor     = "wait";
    studentIdInput.style.color      = "#94a3b8";
  } else {
    studentIdInput.disabled    = false;
    studentIdInput.placeholder =
      i("studentIdPlaceholder");
    studentIdInput.style.background = "";
    studentIdInput.style.cursor     = "";
    studentIdInput.style.color      = "";
  }
}

// ================================================
// LOAD STUDENTS
// ================================================
async function loadAllStudents() {
  studentsLoaded = false;
  studentsMap    = new Map();
  updateStudentIdFieldState();

  try {
    const snap =
      await getDocs(collection(db, "students"));

    snap.forEach(function (d) {
      const data  = d.data();
      const docId =
        String(d.id).trim().toUpperCase();

      studentsMap.set(docId, {
        studentId: docId,
        fullName:  data.fullName  || "",
        age:       data.age       ?? "",
        grade:     data.grade     || ""
      });
    });

    studentsLoaded = true;
    updateStudentIdFieldState();

    const studentIdInput =
      document.getElementById("studentId");
    if (
      studentIdInput &&
      studentIdInput.value.trim() !== ""
    ) {
      validateStudentId();
    }

  } catch (err) {
    console.error("Failed to load students:", err);
    studentsLoaded = true;
    updateStudentIdFieldState();
  }
}

// ================================================
// NORMALIZE ID
// ================================================
function normalizeId(rawId) {
  return String(rawId || "")
    .trim()
    .toUpperCase();
}

// ================================================
// FIND STUDENT
// ================================================
function findStudent(rawId) {
  const normalized = normalizeId(rawId);
  return studentsMap.get(normalized) || null;
}

// ================================================
// ✅ SECURITY LAYER 4
// DEVICE FINGERPRINT GENERATOR
//
// How it works:
// 1. Collect browser properties:
//    - userAgent, platform, screen size
//    - timezone, language
// 2. Combine into one string
// 3. Hash with SHA-256
// 4. Result = unique device ID
//
// Why it prevents cheating:
// - Same phone = same fingerprint always
// - If Student A uses Phone X → saved to Firebase
// - If Student B tries Phone X → same fingerprint
//   → Firebase already has it → REJECTED
// ================================================
async function generateDeviceFingerprint() {
  const components = [
    navigator.userAgent      || "unknown",
    navigator.platform       || "unknown",
    screen.width + "x" + screen.height,
    screen.colorDepth        || "unknown",
    Intl.DateTimeFormat()
      .resolvedOptions().timeZone || "unknown",
    navigator.language       || "unknown",
    navigator.hardwareConcurrency || "unknown",
    screen.pixelDepth        || "unknown"
  ];

  const raw = components.join("|");

  // Use Web Crypto API to SHA-256 hash
  const encoder = new TextEncoder();
  const data     = encoder.encode(raw);

  const hashBuffer =
    await crypto.subtle.digest("SHA-256", data);

  const hashArray =
    Array.from(new Uint8Array(hashBuffer));

  const hashHex = hashArray
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");

  console.log(
    "🔑 Device fingerprint generated:",
    hashHex.substring(0, 16) + "..."
  );

  return hashHex;
}

// ================================================
// GET BROWSER NAME
// ================================================
function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox"))  return "Firefox";
  if (ua.includes("Edg"))      return "Edge";
  if (ua.includes("Chrome"))   return "Chrome";
  if (ua.includes("Safari"))   return "Safari";
  if (ua.includes("Opera"))    return "Opera";
  return "Unknown";
}

// ================================================
// GET OPERATING SYSTEM
// ================================================
function getOperatingSystem() {
  const ua = navigator.userAgent;
  if (ua.includes("Windows NT")) return "Windows";
  if (ua.includes("Mac OS X"))   return "macOS";
  if (ua.includes("Android"))    return "Android";
  if (
    ua.includes("iPhone") ||
    ua.includes("iPad")
  ) return "iOS";
  if (ua.includes("Linux"))      return "Linux";
  return "Unknown";
}

// ================================================
// ✅ SECURITY LAYER 7
// RATE LIMITING
//
// Stored in localStorage (per device)
// Structure: { attempts: 3, lockedUntil: 0 }
//
// After 5 failed attempts:
// → Lock for 5 minutes
// → Show warning message
// ================================================
function getRateLimitData() {
  try {
    const raw =
      localStorage.getItem("attendanceRateLimit");
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function saveRateLimitData(data) {
  localStorage.setItem(
    "attendanceRateLimit",
    JSON.stringify(data)
  );
}

function isRateLimited() {
  const data = getRateLimitData();
  const now  = Date.now();

  if (data.lockedUntil && now < data.lockedUntil) {
    // Still locked
    const remaining = Math.ceil(
      (data.lockedUntil - now) / 1000 / 60
    );
    return { locked: true, minutesLeft: remaining };
  }

  // Lock expired — reset
  if (
    data.lockedUntil &&
    now >= data.lockedUntil
  ) {
    saveRateLimitData({ attempts: 0, lockedUntil: 0 });
  }

  return { locked: false, minutesLeft: 0 };
}

function recordFailedAttempt() {
  const data = getRateLimitData();
  const now  = Date.now();

  // Reset if previous lockout expired
  if (data.lockedUntil && now >= data.lockedUntil) {
    saveRateLimitData({ attempts: 1, lockedUntil: 0 });
    return;
  }

  data.attempts = (data.attempts || 0) + 1;

  if (data.attempts >= MAX_ATTEMPTS) {
    data.lockedUntil = now + LOCKOUT_DURATION;
    console.warn(
      "🔒 Rate limit reached. Locked for 5 minutes."
    );
  }

  saveRateLimitData(data);
}

function resetFailedAttempts() {
  saveRateLimitData({ attempts: 0, lockedUntil: 0 });
}

// Show rate limit warning box
function showRateLimitWarning() {
  const formCard =
    document.getElementById("formCard");
  if (!formCard) return;

  // Remove old warning if exists
  const old =
    document.getElementById("rateLimitWarning");
  if (old) old.remove();

  const box = document.createElement("div");
  box.id = "rateLimitWarning";
  box.className = "rate-limit-box";
  box.innerHTML = `
    <div style="font-size:28px;
                margin-bottom:8px;">⛔</div>
    <p style="font-weight:700;
              color:#991b1b;
              font-size:15px;
              margin-bottom:4px;">
      ${i("errRateLimit")
        .split("\n")
        .join("<br>")}
    </p>
    <p id="rateLimitCountdown"
       style="font-size:13px;
              color:#64748b;
              margin-top:6px;"></p>
  `;

  formCard.parentNode.insertBefore(
    box, formCard
  );
  formCard.style.display = "none";

  // Start countdown display
  startRateLimitCountdown();
}

function startRateLimitCountdown() {
  const countdownEl =
    document.getElementById("rateLimitCountdown");
  if (!countdownEl) return;

  function updateCountdown() {
    const data = getRateLimitData();
    const now  = Date.now();

    if (!data.lockedUntil || now >= data.lockedUntil) {
      // Unlocked — reload page
      const box =
        document.getElementById("rateLimitWarning");
      if (box) box.remove();
      const formCard =
        document.getElementById("formCard");
      if (formCard) {
        formCard.style.display = "block";
      }
      resetFailedAttempts();
      return;
    }

    const remaining =
      Math.ceil((data.lockedUntil - now) / 1000);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;

    countdownEl.textContent =
      `⏱ ${mins}:${String(secs).padStart(2,"0")}`;

    setTimeout(updateCountdown, 1000);
  }

  updateCountdown();
}

// ================================================
// VALIDATE STUDENT ID AND AUTO-FILL
// ================================================
function validateStudentId() {
  const studentIdInput =
    document.getElementById("studentId");
  const studentIdError =
    document.getElementById("studentIdError");
  const autoFillMsgEl =
    document.getElementById("autoFillMsg");

  if (!studentIdInput) return false;

  const rawId = studentIdInput.value;

  if (!studentsLoaded) {
    if (studentIdError) {
      studentIdError.textContent =
        i("errStudentIdLoading");
    }
    return false;
  }

  if (!rawId.trim()) {
    if (studentIdError) {
      studentIdError.textContent = "";
    }
    if (autoFillMsgEl) {
      autoFillMsgEl.style.display = "none";
    }
    return false;
  }

  const student = findStudent(rawId);

  if (!student) {
    if (studentIdError) {
      studentIdError.textContent =
        i("errStudentIdNotFound");
    }
    if (autoFillMsgEl) {
      autoFillMsgEl.style.display = "none";
    }

    const fn = document.getElementById("fullName");
    const ag = document.getElementById("age");
    const gr = document.getElementById("grade");
    if (fn) fn.value = "";
    if (ag) ag.value = "";
    if (gr) gr.value = "";

    return false;
  }

  if (studentIdError) {
    studentIdError.textContent = "";
  }

  const fn = document.getElementById("fullName");
  const ag = document.getElementById("age");
  const gr = document.getElementById("grade");
  if (fn) fn.value = student.fullName;
  if (ag) ag.value = student.age;
  if (gr) gr.value = student.grade;

  if (autoFillMsgEl) {
    autoFillMsgEl.textContent  = i("autoFillMsg");
    autoFillMsgEl.style.display = "block";
  }

  return true;
}

// ================================================
// HAVERSINE DISTANCE
// ================================================
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = function (d) {
    return d * (Math.PI / 180);
  };
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return R * 2 * Math.atan2(
    Math.sqrt(a), Math.sqrt(1 - a)
  );
}

// ================================================
// SHOW DISTANCE RESULT
// ================================================
function showDistanceResult(loc) {
  const distanceBox =
    document.getElementById("distanceBox");
  const distanceStatus =
    document.getElementById("distanceStatus");
  const distanceDetail =
    document.getElementById("distanceDetail");
  const distanceIcon =
    document.getElementById("distanceIcon");
  const retryBtn =
    document.getElementById("retryLocationBtn");
  const submitBtn =
    document.getElementById("submitBtn");

  const isNear =
    loc.distance <= ALLOWED_DISTANCE_METERS;

  distanceBox.style.display = "flex";

  distanceDetail.textContent =
    i("distanceFromSchool") + ": " +
    Math.round(loc.distance) +
    " " + i("meters") +
    " | " + i("gpsAccuracy") + ": ±" +
    Math.round(loc.accuracy) +
    " " + i("meters");

  if (isNear) {
    distanceIcon.textContent      = "✅";
    distanceStatus.textContent    = i("locationVerified");
    distanceStatus.style.color    = "#16a34a";
    distanceBox.style.background  = "#f0fdf4";
    distanceBox.style.borderColor = "#86efac";
    retryBtn.style.display = "none";
    submitBtn.disabled     = false;
    locationVerified       = true;
  } else {
    distanceIcon.textContent      = "❌";
    distanceStatus.textContent    = i("locationTooFar");
    distanceStatus.style.color    = "#dc2626";
    distanceBox.style.background  = "#fef2f2";
    distanceBox.style.borderColor = "#fca5a5";
    retryBtn.style.display = "block";
    submitBtn.disabled     = true;
    locationVerified       = false;
  }
}

// ================================================
// REQUEST LOCATION
// ================================================
function requestLocation() {
  const locationStatus =
    document.getElementById("locationStatus");
  const distanceBox =
    document.getElementById("distanceBox");
  const retryBtn =
    document.getElementById("retryLocationBtn");
  const submitBtn =
    document.getElementById("submitBtn");

  locationVerified          = false;
  studentLocation           = null;
  submitBtn.disabled        = true;
  distanceBox.style.display = "none";
  retryBtn.style.display    = "none";
  locationStatus.textContent = i("locating");

  if (!navigator.geolocation) {
    locationStatus.textContent = i("locationError");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const lat      = position.coords.latitude;
      const lon      = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      if (accuracy > MAX_ACCEPTABLE_ACCURACY) {
        locationStatus.textContent =
          i("locationPoorAccuracy");

        const db2 =
          document.getElementById("distanceBox");
        const ds  =
          document.getElementById("distanceStatus");
        const dd  =
          document.getElementById("distanceDetail");
        const di  =
          document.getElementById("distanceIcon");

        db2.style.display     = "flex";
        db2.style.background  = "#fffbeb";
        db2.style.borderColor = "#fcd34d";
        di.textContent        = "⚠️";
        ds.textContent        = i("locationPoorAccuracy");
        ds.style.color        = "#92400e";
        dd.textContent        =
          i("gpsAccuracy") + ": ±" +
          Math.round(accuracy) +
          " " + i("meters");
        retryBtn.style.display = "block";
        return;
      }

      const distance = haversineDistance(
        lat, lon, SCHOOL_LATITUDE, SCHOOL_LONGITUDE
      );

      studentLocation = {
        latitude:  lat,
        longitude: lon,
        accuracy:  accuracy,
        distance:  distance
      };

      locationStatus.textContent =
        i("requestingLocation");
      showDistanceResult(studentLocation);
    },

    function (error) {
      locationStatus.textContent =
        error.code === error.PERMISSION_DENIED
          ? i("locationDenied")
          : i("locationError");

      const db2 =
        document.getElementById("distanceBox");
      const di  =
        document.getElementById("distanceIcon");
      const ds  =
        document.getElementById("distanceStatus");

      db2.style.display     = "flex";
      db2.style.background  = "#fef2f2";
      db2.style.borderColor = "#fca5a5";
      di.textContent        = "❌";
      ds.textContent        = i("locationError");
      ds.style.color        = "#dc2626";
      retryBtn.style.display = "block";
    },

    {
      enableHighAccuracy: true,
      timeout:            15000,
      maximumAge:         0
    }
  );
}

// ================================================
// ✅ SECURITY LAYER 6
// SESSION TIMEOUT CHECK
//
// If teacher set a duration (expiresAt):
// Check if current time > expiresAt
// If yes → show expired message
// ================================================
function isSessionExpired(sessionData) {
  if (!sessionData.expiresAt) return false;

  const now       = Date.now();
  const expiresAt =
    new Date(sessionData.expiresAt).getTime();

  return now > expiresAt;
}

// ================================================
// LOAD SESSION
// ================================================
async function loadSession() {
  const urlParams =
    new URLSearchParams(window.location.search);
  sessionId = urlParams.get("session");

  const banner =
    document.getElementById("sessionBanner");
  const bannerText =
    document.getElementById("sessionBannerText");
  const bannerIcon =
    document.getElementById("sessionBannerIcon");
  const formCard =
    document.getElementById("formCard");
  const closedCard =
    document.getElementById("sessionClosedCard");

  if (!sessionId) {
    formCard.style.display   = "none";
    closedCard.style.display = "block";
    document.querySelector(
      "[data-i18n='sessionClosedMsg']"
    ).textContent = i("noSession");
    return;
  }

  try {
    const sessionDoc = await getDoc(
      doc(db, "session", "current")
    );

    if (!sessionDoc.exists()) {
      formCard.style.display   = "none";
      closedCard.style.display = "block";
      return;
    }

    sessionData = sessionDoc.data();
    const today =
      new Date().toLocaleDateString("en-CA");

    // ✅ Check session ID matches
    if (
      !sessionData.isOpen ||
      sessionData.date !== today ||
      sessionData.sessionId !== sessionId
    ) {
      formCard.style.display   = "none";
      closedCard.style.display = "block";
      document.querySelectorAll(
        "[data-i18n='sessionClosedMsg']"
      ).forEach(function (el) {
        el.textContent = i("sessionExpired");
      });
      return;
    }

    // ✅ LAYER 6: Check timeout
    if (isSessionExpired(sessionData)) {
      formCard.style.display   = "none";
      closedCard.style.display = "block";
      document.querySelectorAll(
        "[data-i18n='sessionClosedMsg']"
      ).forEach(function (el) {
        el.textContent =
          i("errSessionExpiredTimeout");
      });
      return;
    }

    // ✅ Check rate limit BEFORE loading
    const rateLimitStatus = isRateLimited();
    if (rateLimitStatus.locked) {
      showRateLimitWarning();
    }

    // Session valid
    banner.style.display    = "flex";
    bannerIcon.textContent  = "🟢";
    bannerText.textContent  = i("sessionActive");
    banner.style.background = "#f0fdf4";
    banner.style.color      = "#16a34a";
    banner.style.border     = "1px solid #86efac";

    // Generate fingerprint in background
    generateDeviceFingerprint().then(function (fp) {
      deviceFingerprint = fp;
      console.log("✅ Fingerprint ready");
    });

    await Promise.all([
      loadAllStudents(),
      new Promise(function (resolve) {
        requestLocation();
        resolve();
      })
    ]);

  } catch (error) {
    console.error("Load session error:", error);
    formCard.style.display   = "none";
    closedCard.style.display = "block";
  }
}

// ================================================
// VALIDATE FULL FORM
// ================================================
function validateForm() {
  let valid = true;

  const studentIdVal =
    document.getElementById("studentId")
      .value.trim();
  const nameVal =
    document.getElementById("fullName")
      .value.trim();
  const ageVal =
    document.getElementById("age").value.trim();
  const gradeVal =
    document.getElementById("grade")
      .value.trim();

  document.getElementById("studentIdError")
    .textContent = "";
  document.getElementById("nameError")
    .textContent = "";
  document.getElementById("ageError")
    .textContent = "";
  document.getElementById("gradeError")
    .textContent = "";

  if (!studentsLoaded) {
    document.getElementById("studentIdError")
      .textContent = i("errStudentIdLoading");
    return false;
  }

  if (!studentIdVal) {
    document.getElementById("studentIdError")
      .textContent = i("errStudentId");
    valid = false;
  } else if (!findStudent(studentIdVal)) {
    document.getElementById("studentIdError")
      .textContent = i("errStudentIdNotFound");
    valid = false;
  }

  if (!nameVal) {
    document.getElementById("nameError")
      .textContent = i("errName");
    valid = false;
  }

  if (
    !ageVal ||
    isNaN(ageVal) ||
    Number(ageVal) < 5 ||
    Number(ageVal) > 100
  ) {
    document.getElementById("ageError")
      .textContent = i("errAge");
    valid = false;
  }

  if (!gradeVal) {
    document.getElementById("gradeError")
      .textContent = i("errGrade");
    valid = false;
  }

  return valid;
}

// ================================================
// SHOW ERROR CARD WITH MESSAGE
// ================================================
function showErrorCard(message) {
  const errorCard =
    document.getElementById("errorCard");
  const errorMessage =
    document.getElementById("errorMessage");

  if (errorCard && errorMessage) {
    errorMessage.textContent = message;
    errorCard.style.display  = "block";

    // Scroll to error
    errorCard.scrollIntoView({
      behavior: "smooth", block: "center"
    });

    // Auto hide after 6 seconds
    setTimeout(function () {
      errorCard.style.display = "none";
    }, 6000);
  }
}

// ================================================
// ✅ SUBMIT ATTENDANCE — ALL SECURITY LAYERS
// ================================================
async function submitAttendance(e) {
  e.preventDefault();

  // ✅ LAYER 7: Rate limit check
  const rateLimitStatus = isRateLimited();
  if (rateLimitStatus.locked) {
    showRateLimitWarning();
    return;
  }

  if (!validateForm()) {
    // Count failed validation as attempt
    // only if student ID was wrong
    const studentIdVal =
      document.getElementById("studentId")
        .value.trim();
    if (studentIdVal && !findStudent(studentIdVal)) {
      recordFailedAttempt();

      // Check if now locked
      const newStatus = isRateLimited();
      if (newStatus.locked) {
        showRateLimitWarning();
      }
    }
    return;
  }

  // ✅ LAYER 3: GPS check
  if (!locationVerified || !studentLocation) {
    showErrorCard(i("errLocation"));
    return;
  }

  const securityDistance = haversineDistance(
    studentLocation.latitude,
    studentLocation.longitude,
    SCHOOL_LATITUDE,
    SCHOOL_LONGITUDE
  );

  if (securityDistance > ALLOWED_DISTANCE_METERS) {
    showErrorCard(i("errTooFar"));
    locationVerified = false;
    document.getElementById("submitBtn")
      .disabled = true;
    return;
  }

  // ✅ LAYER 6: Session timeout check again at submit
  if (sessionData && isSessionExpired(sessionData)) {
    showErrorCard(i("errSessionExpiredTimeout"));
    document.getElementById("formCard")
      .style.display = "none";
    document.getElementById("sessionClosedCard")
      .style.display = "block";
    return;
  }

  const studentIdVal =
    normalizeId(
      document.getElementById("studentId").value
    );
  const nameVal =
    document.getElementById("fullName")
      .value.trim();
  const ageVal =
    document.getElementById("age").value.trim();
  const gradeVal =
    document.getElementById("grade")
      .value.trim();

  document.getElementById("loadingOverlay")
    .style.display = "flex";

  try {
    // ✅ LAYER 4: Device fingerprint check
    // Make sure fingerprint is ready
    if (!deviceFingerprint) {
      deviceFingerprint =
        await generateDeviceFingerprint();
    }

    // Check if this device already submitted
    // for this session
    const deviceLogRef = doc(
      db,
      "deviceLogs",
      sessionId + "_" + deviceFingerprint
    );
    const deviceLogSnap = await getDoc(deviceLogRef);

    if (deviceLogSnap.exists()) {
      // Device already used
      // But allow SAME student to resubmit
      // (page refresh case)
      const logData = deviceLogSnap.data();

      if (logData.studentId !== studentIdVal) {
        // Different student using same device
        document.getElementById("loadingOverlay")
          .style.display = "none";
        showErrorCard(i("errDeviceUsed"));
        return;
      }
      // Same student → allow (refresh case)
    }

    // ✅ LAYER 5: Duplicate attendance check
    const recordRef = doc(
      db,
      "sessionAttendance",
      sessionId,
      "records",
      studentIdVal
    );

    const recordSnap = await getDoc(recordRef);

    if (!recordSnap.exists()) {
      document.getElementById("loadingOverlay")
        .style.display = "none";
      document.getElementById("studentIdError")
        .textContent = i("errStudentIdNotFound");
      recordFailedAttempt();
      return;
    }

    const existingRecord = recordSnap.data();

    if (existingRecord.status === "present") {
      document.getElementById("loadingOverlay")
        .style.display = "none";
      showErrorCard(i("errAlreadyCheckedIn"));
      return;
    }

    // ✅ Build attendance record with full log
    const now       = new Date();
    const checkDate =
      now.toLocaleDateString("en-CA");
    const checkTime =
      now.toLocaleTimeString([], {
        hour:   "2-digit",
        minute: "2-digit"
      });

    // ✅ LAYER 8: Full attendance log data
    const attendanceData = {
      fullName:           nameVal,
      age:                Number(ageVal),
      grade:              gradeVal,
      studentId:          studentIdVal,
      sessionId:          sessionId,
      checkInDate:        checkDate,
      checkInTime:        checkTime,
      status:             "present",

      // GPS data
      latitude:           studentLocation.latitude,
      longitude:          studentLocation.longitude,
      gpsAccuracy:        studentLocation.accuracy,
      distanceFromSchool: securityDistance,

      // Device security data
      deviceFingerprint:  deviceFingerprint,
      browser:            getBrowserName(),
      operatingSystem:    getOperatingSystem(),
      userAgent:          navigator.userAgent,

      // Timestamps
      submittedAt:        now.toISOString(),
      submittedTimestamp: now.getTime()
    };

    // Save attendance record
    await updateDoc(recordRef, attendanceData);

    // ✅ LAYER 4: Save device log to Firebase
    // This prevents other students using same device
    await setDoc(deviceLogRef, {
      fingerprint:  deviceFingerprint,
      studentId:    studentIdVal,
      sessionId:    sessionId,
      submittedAt:  now.toISOString(),
      browser:      getBrowserName(),
      os:           getOperatingSystem()
    });

    // ✅ Reset rate limit on success
    resetFailedAttempts();

    console.log(
      "✅ Attendance saved with security data:",
      studentIdVal
    );

    // Show success
    document.getElementById("loadingOverlay")
      .style.display = "none";
    document.getElementById("formCard")
      .style.display = "none";
    document.getElementById("distanceBox")
      .style.display = "none";
    document.getElementById("locationBox")
      .style.display = "none";

    const successCard =
      document.getElementById("successCard");
    successCard.style.display = "block";

    document.getElementById("successDetails")
      .innerHTML = `
        <div style="
          background:#f0fdf4;
          border-radius:10px;
          padding:16px;
          margin-top:16px;
          text-align:left;
          font-size:14px;
          line-height:2;">
          <div>
            <strong>
              ${i("studentIdLabel")}:
            </strong>
            ${studentIdVal}
          </div>
          <div>
            <strong>
              ${i("fullNameLabel")}:
            </strong>
            ${nameVal}
          </div>
          <div>
            <strong>
              ${i("gradeLabel")}:
            </strong>
            ${gradeVal}
          </div>
          <div>
            <strong>
              ${i("colDate")}:
            </strong>
            ${checkDate}
          </div>
          <div>
            <strong>
              ${i("colTime")}:
            </strong>
            ${checkTime}
          </div>
          <div>
            <strong>
              ${i("distanceFromSchool")}:
            </strong>
            ${Math.round(securityDistance)}
            ${i("meters")}
          </div>
        </div>
      `;

  } catch (error) {
    console.error("Submit error:", error);
    document.getElementById("loadingOverlay")
      .style.display = "none";
    document.getElementById("errorCard")
      .style.display = "block";
    document.getElementById("errorMessage")
      .textContent = error.message;
  }
}

// ================================================
// EVENT LISTENERS
// ================================================
document.getElementById("languageButton")
  .addEventListener("click", function () {
    applyLanguage(
      currentLang === "en" ? "km" : "en"
    );
  });

document.getElementById("retryLocationBtn")
  .addEventListener("click", requestLocation);

let studentIdTimer = null;
document.getElementById("studentId")
  .addEventListener("input", function () {
    clearTimeout(studentIdTimer);
    studentIdTimer = setTimeout(
      validateStudentId, 600
    );
  });

document.getElementById("studentId")
  .addEventListener("blur", function () {
    clearTimeout(studentIdTimer);
    validateStudentId();
  });

document.getElementById("attendanceForm")
  .addEventListener("submit", submitAttendance);

// ================================================
// ADD AUTO-FILL MESSAGE ELEMENT
// ================================================
(function () {
  const errEl =
    document.getElementById("studentIdError");
  if (
    errEl &&
    !document.getElementById("autoFillMsg")
  ) {
    const msgEl = document.createElement("p");
    msgEl.id = "autoFillMsg";
    msgEl.style.cssText =
      "font-size:12px;" +
      "color:#16a34a;" +
      "font-weight:600;" +
      "margin-top:5px;" +
      "display:none;";
    errEl.parentNode.insertBefore(
      msgEl, errEl.nextSibling
    );
  }
})();

// ================================================
// START
// ================================================
const savedLang =
  localStorage.getItem("studentLanguage") || "en";
applyLanguage(savedLang);
await loadSession();
