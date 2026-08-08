// ================================================
// script.js — Student Attendance Page
//
// Features:
//   1. Session ID validation
//   2. Auto GPS location check
//   3. Student ID auto-fill from Firebase
//   4. Device token (UUID) anti-cheat
//   5. Check-in with timestamp
//   6. Check-out with timestamp
//   7. Rate limiting
//   8. Real-time session close detection
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
  getDocs,
  onSnapshot,
  runTransaction
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
// SCHOOL LOCATION — FIXED 100 METERS
// ================================================
const SCHOOL_LAT     = 11.822624138074948;
const SCHOOL_LON     = 104.7536601355822;
const MAX_DISTANCE   = 100;
const MAX_ACCURACY   = 50;

// ================================================
// RATE LIMIT
// ================================================
const MAX_ATTEMPTS     = 5;
const LOCKOUT_MS       = 5 * 60 * 1000;

// ================================================
// APP STATE
// ================================================
let currentLang      = "en";
let sessionId        = null;
let sessionData      = null;
let studentLocation  = null;
let locationVerified = false;
let deviceToken      = null;
let sessionListener  = null;

// Student state
let studentsMap    = new Map();
let studentsLoaded = false;

// Check-in / Check-out state
let studentCheckedIn  = false;
let studentCheckedOut = false;
let currentStudentId  = null;

// ================================================
// TRANSLATIONS — ALL NEW KEYS INCLUDED
// ================================================
const i18n = {
  en: {
    title:    "QR Attendance System",
    subtitle: "Tepranom High School",

    // Session
    sessionActive:
      "Attendance session is open.",
    sessionClosed:
      "Attendance session is closed.",
    sessionClosedTitle:
      "Session Closed",
    sessionClosedMsg:
      "The attendance session is not open. Please ask your teacher to start the session.",
    noSession:
      "No session found. Please scan the QR code again.",
    sessionExpired:
      "This QR code is no longer valid.",
    attendanceClosed:
      "Attendance is currently closed.",
    sessionEndedMsg:
      "Attendance session has ended.",

    // Location
    requestingLocation:
      "Requesting your location...",
    locationReason:
      "Your location is needed to verify you are at school.",
    locating:
      "Getting your GPS location...",
    locationVerifiedMsg:
      "✅ Location verified. You are within the school area.",
    locationTooFar:
      "❌ You are outside the school area. Attendance is not allowed.",
    locationDenied:
      "Location permission is required before you can check in.",
    locationError:
      "Could not get your location. Please try again.",
    locationPoorAccuracy:
      "GPS accuracy is too low. Please move to an open area.",
    retryLocation:
      "Try Again",
    gpsAccuracy:
      "GPS Accuracy",
    distanceFromSchool:
      "Distance from school",
    meters:
      "meters",

    // Students
    loadingStudents:
      "Loading student data...",
    studentIdLabel:
      "Student ID",
    studentIdPlaceholder:
      "Enter your Student ID (e.g. IT01)",
    fullNameLabel:
      "Full Name",
    fullNamePlaceholder:
      "Auto-filled from your ID",
    ageLabel:
      "Age",
    agePlaceholder:
      "Auto-filled",
    gradeLabel:
      "Grade / Class",
    gradePlaceholder:
      "Auto-filled",
    formTitle:
      "📋 Mark Your Attendance",
    submitButton:
      "✅ Check In",

    // Auto-fill
    autoFillMsg:
      "✅ Student found. Details filled automatically.",
    autoFillReadOnly:
      "Name, Age and Grade are read-only.",

    // Errors
    errStudentId:
      "Please enter your Student ID.",
    errStudentIdNotFound:
      "Student ID not found. Please check your Student ID.",
    errStudentIdLoading:
      "Please wait. Student data is still loading.",
    errLocation:
      "Location not verified yet. Please wait.",
    errTooFar:
      "You are outside the school area. Attendance is not allowed.",
    errAlreadyCheckedIn:
      "You have already checked in for this session.",
    errDeviceUsed:
      "This device has already checked in for this attendance session.",
    errRateLimit:
      "Too many attempts.\nPlease wait 5 minutes.",
    errSessionClosed:
      "The attendance session has ended.",

    // Check-in success
    successTitle:
      "Check-In Successful!",
    successMessage:
      "Your attendance has been recorded.",
    savingText:
      "Saving your attendance...",

    // ✅ Check-out
    checkedInTitle:
      "You Are Checked In",
    checkInTimeLabel:
      "Check In Time",
    checkOutTimeLabel:
      "Check Out Time",
    statusLabel:
      "Status",
    present:
      "Present",
    notCheckedOut:
      "Not Checked Out",
    notCheckedInYet:
      "Not Checked In Yet",
    checkOutButton:
      "🚪 Check Out",
    checkingOut:
      "Processing check-out...",
    checkOutSuccess:
      "✅ You have successfully checked out.",
    alreadyCheckedOutMsg:
      "✅ You have already checked out for this session.",
    errAlreadyCheckedOut:
      "You have already checked out for this session.",
    errNotCheckedIn:
      "You must check in before checking out.",
    errCheckOutLocation:
      "You must be within the school area to check out.",

    // Footer
    footerSecurity:
      "🔒 Your location is only used to verify attendance.",
    footerSchool:
      "Tepranom High School Attendance System",

    // Table
    colDate: "Date",
    colTime: "Time"
  },

  km: {
    title:    "ប្រព័ន្ធចុះវត្តមាន QR",
    subtitle: "វិទ្យាល័យទេពប្រណម្យ",

    // Session
    sessionActive:
      "វគ្គចុះវត្តមានកំពុងបើក។",
    sessionClosed:
      "វគ្គចុះវត្តមានបានបិទ។",
    sessionClosedTitle:
      "វគ្គបានបិទ",
    sessionClosedMsg:
      "វគ្គចុះវត្តមានមិនទាន់បើក។ សូមស្នើគ្រូឱ្យចាប់ផ្ដើមវគ្គ។",
    noSession:
      "រកមិនឃើញវគ្គ។ សូមស្កេន QR Code ម្តងទៀត។",
    sessionExpired:
      "QR Code នេះលែងមានសុពលភាពទៀតហើយ។",
    attendanceClosed:
      "ការចុះវត្តមានត្រូវបានបិទ។",
    sessionEndedMsg:
      "វគ្គចុះវត្តមានបានបញ្ចប់។",

    // Location
    requestingLocation:
      "កំពុងស្នើទីតាំងរបស់អ្នក...",
    locationReason:
      "ត្រូវការទីតាំងរបស់អ្នក ដើម្បីផ្ទៀងផ្ទាត់ថាអ្នកនៅសាលា។",
    locating:
      "កំពុងទទួល GPS ទីតាំង...",
    locationVerifiedMsg:
      "✅ ទីតាំងត្រូវបានផ្ទៀងផ្ទាត់។ អ្នកស្ថិតនៅក្នុងបរិវេណសាលា។",
    locationTooFar:
      "❌ អ្នកស្ថិតនៅក្រៅបរិវេណសាលា។ មិនអាចចុះវត្តមានបានទេ។",
    locationDenied:
      "អ្នកត្រូវតែអនុញ្ញាតការប្រើទីតាំង មុនពេលអាចចុះវត្តមានបាន។",
    locationError:
      "មិនអាចទទួលទីតាំងរបស់អ្នក។ សូមព្យាយាមម្តងទៀត។",
    locationPoorAccuracy:
      "GPS មិនមានភាពត្រឹមត្រូវ។ សូមទៅកន្លែងដែលមានទីធ្លា។",
    retryLocation:
      "ព្យាយាមម្តងទៀត",
    gpsAccuracy:
      "ភាពត្រឹមត្រូវ GPS",
    distanceFromSchool:
      "ចម្ងាយពីសាលា",
    meters:
      "ម៉ែត្រ",

    // Students
    loadingStudents:
      "កំពុងផ្ទុកទិន្នន័យសិស្ស...",
    studentIdLabel:
      "លេខសម្គាល់សិស្ស",
    studentIdPlaceholder:
      "បញ្ចូលលេខសម្គាល់ (ឧ. IT01)",
    fullNameLabel:
      "ឈ្មោះពេញ",
    fullNamePlaceholder:
      "បំពេញដោយស្វ័យប្រវត្តិ",
    ageLabel:
      "អាយុ",
    agePlaceholder:
      "បំពេញដោយស្វ័យប្រវត្តិ",
    gradeLabel:
      "ថ្នាក់រៀន",
    gradePlaceholder:
      "បំពេញដោយស្វ័យប្រវត្តិ",
    formTitle:
      "📋 ចុះវត្តមានរបស់អ្នក",
    submitButton:
      "✅ ចុះម៉ោងចូល",

    // Auto-fill
    autoFillMsg:
      "✅ រកឃើញសិស្ស។ ព័ត៌មានត្រូវបានបំពេញដោយស្វ័យប្រវត្តិ។",
    autoFillReadOnly:
      "ឈ្មោះ អាយុ និងថ្នាក់ជាព័ត៌មានអានតែប៉ុណ្ណោះ។",

    // Errors
    errStudentId:
      "សូមបញ្ចូលលេខសម្គាល់សិស្ស។",
    errStudentIdNotFound:
      "រកមិនឃើញលេខសម្គាល់សិស្ស។ សូមពិនិត្យលេខសម្គាល់សិស្សរបស់អ្នក។",
    errStudentIdLoading:
      "សូមរង់ចាំ។ ទិន្នន័យសិស្សកំពុងផ្ទុក។",
    errLocation:
      "ទីតាំងមិនទាន់ផ្ទៀងផ្ទាត់ទេ។",
    errTooFar:
      "អ្នកស្ថិតនៅក្រៅបរិវេណសាលា។ មិនអាចចុះវត្តមានបានទេ។",
    errAlreadyCheckedIn:
      "អ្នកបានចុះម៉ោងចូលរួចហើយ។",
    errDeviceUsed:
      "ឧបករណ៍នេះបានចុះវត្តមានរួចហើយសម្រាប់វគ្គចុះវត្តមាននេះ។",
    errRateLimit:
      "អ្នកបានព្យាយាមច្រើនពេក។\nសូមរង់ចាំ ៥ នាទី។",
    errSessionClosed:
      "វគ្គចុះវត្តមានបានបញ្ចប់។",

    // Check-in success
    successTitle:
      "ចុះម៉ោងចូលបានជោគជ័យ!",
    successMessage:
      "វត្តមានរបស់អ្នកត្រូវបានកត់ត្រា។",
    savingText:
      "កំពុងរក្សាទុកវត្តមាន...",

    // ✅ Check-out
    checkedInTitle:
      "អ្នកបានចុះម៉ោងចូលហើយ",
    checkInTimeLabel:
      "ម៉ោងចូល",
    checkOutTimeLabel:
      "ម៉ោងចេញ",
    statusLabel:
      "ស្ថានភាព",
    present:
      "មានវត្តមាន",
    notCheckedOut:
      "មិនទាន់ចេញ",
    notCheckedInYet:
      "មិនទាន់ចុះវត្តមាន",
    checkOutButton:
      "🚪 ចុះម៉ោងចេញ",
    checkingOut:
      "កំពុងដំណើរការចុះម៉ោងចេញ...",
    checkOutSuccess:
      "✅ អ្នកបានចុះម៉ោងចេញដោយជោគជ័យ។",
    alreadyCheckedOutMsg:
      "✅ អ្នកបានចុះម៉ោងចេញរួចហើយ។",
    errAlreadyCheckedOut:
      "អ្នកបានចុះម៉ោងចេញរួចហើយសម្រាប់វគ្គនេះ។",
    errNotCheckedIn:
      "អ្នកត្រូវចុះម៉ោងចូលជាមុនសិន។",
    errCheckOutLocation:
      "អ្នកត្រូវស្ថិតនៅក្នុងបរិវេណសាលា ដើម្បីចុះម៉ោងចេញ។",

    // Footer
    footerSecurity:
      "🔒 ទីតាំងរបស់អ្នកត្រូវបានប្រើតែ​សម្រាប់​ផ្ទៀង​ផ្ទាត់​វត្តមាន​ប៉ុណ្ណោះ។",
    footerSchool:
      "ប្រព័ន្ធវត្តមានវិទ្យាល័យទេពប្រណម្យ",

    // Table
    colDate: "កាលបរិច្ឆេទ",
    colTime: "ម៉ោង"
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
// DEVICE TOKEN — crypto.randomUUID()
//
// NOT hardware-based.
// This identifies the browser installation only.
// Clearing localStorage or using private browsing
// creates a new token.
// Final check happens in Firebase (atomic).
// ================================================
function getOrCreateDeviceToken() {
  const KEY = "attendanceDeviceToken";
  let token = localStorage.getItem(KEY);

  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(KEY, token);
    console.log("🆕 New device token:", token);
  } else {
    console.log(
      "♻️ Existing token:",
      token.substring(0, 8) + "..."
    );
  }

  return token;
}

// ================================================
// STUDENT ID FIELD STATE
// ================================================
function updateStudentIdFieldState() {
  const el =
    document.getElementById("studentId");
  if (!el) return;

  if (!studentsLoaded) {
    el.disabled         = true;
    el.placeholder      = i("loadingStudents");
    el.style.background = "#f1f5f9";
    el.style.cursor     = "wait";
    el.style.color      = "#94a3b8";
  } else {
    el.disabled         = false;
    el.placeholder      =
      i("studentIdPlaceholder");
    el.style.background = "";
    el.style.cursor     = "";
    el.style.color      = "";
  }
}

// ================================================
// LOAD STUDENTS FROM FIREBASE
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
        fullName:  data.fullName || "",
        age:       data.age      ?? "",
        grade:     data.grade    || ""
      });
    });

    studentsLoaded = true;
    updateStudentIdFieldState();

    // Validate any ID already typed
    const el =
      document.getElementById("studentId");
    if (el && el.value.trim() !== "") {
      validateStudentId();
    }

  } catch (err) {
    console.error("Load students error:", err);
    studentsLoaded = true;
    updateStudentIdFieldState();
  }
}

// ================================================
// NORMALIZE + FIND STUDENT
// ================================================
function normalizeId(rawId) {
  return String(rawId || "").trim().toUpperCase();
}

function findStudent(rawId) {
  return studentsMap.get(normalizeId(rawId))
    || null;
}

// ================================================
// VALIDATE STUDENT ID — AUTO-FILL
// Name, Age, Grade are READ-ONLY
// ================================================
function validateStudentId() {
  const idInput =
    document.getElementById("studentId");
  const idError =
    document.getElementById("studentIdError");
  const msgEl =
    document.getElementById("autoFillMsg");
  const submitBtn =
    document.getElementById("submitBtn");

  if (!idInput) return false;

  const rawId = idInput.value;

  if (!studentsLoaded) {
    if (idError) {
      idError.textContent =
        i("errStudentIdLoading");
    }
    return false;
  }

  if (!rawId.trim()) {
    if (idError) idError.textContent = "";
    if (msgEl) msgEl.style.display = "none";
    clearAutoFill();
    return false;
  }

  const student = findStudent(rawId);

  if (!student) {
    if (idError) {
      idError.textContent =
        i("errStudentIdNotFound");
    }
    if (msgEl) msgEl.style.display = "none";
    clearAutoFill();
    return false;
  }

  // Student found — clear error, fill fields
  if (idError) idError.textContent = "";

  // Fill read-only fields
  setField("fullName", student.fullName);
  setField("age",      String(student.age));
  setField("grade",    student.grade);

  if (msgEl) {
    msgEl.textContent   = i("autoFillMsg");
    msgEl.style.display = "block";
  }

  // Enable submit if location verified
  if (locationVerified && submitBtn) {
    submitBtn.disabled = false;
  }

  return true;
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function clearAutoFill() {
  setField("fullName", "");
  setField("age",      "");
  setField("grade",    "");

  const submitBtn =
    document.getElementById("submitBtn");
  if (submitBtn) submitBtn.disabled = true;
}

// ================================================
// HAVERSINE FORMULA
// ================================================
function haversineDistance(
  lat1, lon1, lat2, lon2
) {
  const R     = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return R * 2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ================================================
// SHOW DISTANCE RESULT
// ================================================
function showDistanceResult(loc) {
  const box    =
    document.getElementById("distanceBox");
  const status =
    document.getElementById("distanceStatus");
  const detail =
    document.getElementById("distanceDetail");
  const icon   =
    document.getElementById("distanceIcon");
  const retry  =
    document.getElementById("retryLocationBtn");
  const submit =
    document.getElementById("submitBtn");

  const isNear = loc.distance <= MAX_DISTANCE;
  box.style.display = "flex";

  detail.textContent =
    i("distanceFromSchool") + ": " +
    Math.round(loc.distance) +
    " " + i("meters") +
    " | " + i("gpsAccuracy") + ": ±" +
    Math.round(loc.accuracy) +
    " " + i("meters");

  if (isNear) {
    icon.textContent      = "✅";
    status.textContent    = i("locationVerifiedMsg");
    status.style.color    = "#16a34a";
    box.style.background  = "#f0fdf4";
    box.style.borderColor = "#86efac";
    retry.style.display   = "none";
    locationVerified      = true;

    // Enable submit if student ID is valid
    const idVal =
      document.getElementById("studentId")
        ?.value || "";
    if (findStudent(idVal) && submit) {
      submit.disabled = false;
    }
  } else {
    icon.textContent      = "❌";
    status.textContent    = i("locationTooFar");
    status.style.color    = "#dc2626";
    box.style.background  = "#fef2f2";
    box.style.borderColor = "#fca5a5";
    retry.style.display   = "block";
    locationVerified      = false;
    if (submit) submit.disabled = true;
  }
}

// ================================================
// REQUEST LOCATION — AUTO on page load
// ================================================
function requestLocation() {
  const locStatus =
    document.getElementById("locationStatus");
  const box   =
    document.getElementById("distanceBox");
  const retry =
    document.getElementById("retryLocationBtn");
  const submit =
    document.getElementById("submitBtn");

  locationVerified    = false;
  studentLocation     = null;
  if (submit) submit.disabled = true;
  box.style.display   = "none";
  retry.style.display = "none";
  if (locStatus) {
    locStatus.textContent = i("locating");
  }

  if (!navigator.geolocation) {
    if (locStatus) {
      locStatus.textContent = i("locationError");
    }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      const lat      = pos.coords.latitude;
      const lon      = pos.coords.longitude;
      const accuracy = pos.coords.accuracy;

      if (accuracy > MAX_ACCURACY) {
        if (locStatus) {
          locStatus.textContent =
            i("locationPoorAccuracy");
        }
        box.style.display     = "flex";
        box.style.background  = "#fffbeb";
        box.style.borderColor = "#fcd34d";
        document.getElementById("distanceIcon")
          .textContent = "⚠️";
        document.getElementById("distanceStatus")
          .textContent = i("locationPoorAccuracy");
        document.getElementById("distanceStatus")
          .style.color = "#92400e";
        document.getElementById("distanceDetail")
          .textContent =
            i("gpsAccuracy") + ": ±" +
            Math.round(accuracy) +
            " " + i("meters");
        retry.style.display = "block";
        return;
      }

      const distance = haversineDistance(
        lat, lon, SCHOOL_LAT, SCHOOL_LON
      );

      studentLocation = {
        latitude:  lat,
        longitude: lon,
        accuracy:  accuracy,
        distance:  distance
      };

      if (locStatus) {
        locStatus.textContent =
          i("requestingLocation");
      }
      showDistanceResult(studentLocation);
    },

    function (err) {
      const msg =
        err.code === err.PERMISSION_DENIED
          ? i("locationDenied")
          : i("locationError");

      if (locStatus) {
        locStatus.textContent = msg;
      }

      box.style.display     = "flex";
      box.style.background  = "#fef2f2";
      box.style.borderColor = "#fca5a5";
      document.getElementById("distanceIcon")
        .textContent = "❌";
      document.getElementById("distanceStatus")
        .textContent = msg;
      document.getElementById("distanceStatus")
        .style.color = "#dc2626";
      retry.style.display = "block";
    },

    {
      enableHighAccuracy: true,
      timeout:            10000,
      maximumAge:         0
    }
  );
}

// ================================================
// RATE LIMITING
// ================================================
function getRateData() {
  try {
    return JSON.parse(
      localStorage.getItem("attendanceRL") || "{}"
    );
  } catch {
    return {};
  }
}

function saveRateData(d) {
  localStorage.setItem(
    "attendanceRL", JSON.stringify(d)
  );
}

function isRateLimited() {
  const d   = getRateData();
  const now = Date.now();
  if (d.lockedUntil && now < d.lockedUntil) {
    return true;
  }
  if (d.lockedUntil && now >= d.lockedUntil) {
    saveRateData({ attempts: 0, lockedUntil: 0 });
  }
  return false;
}

function recordFailedAttempt() {
  const d   = getRateData();
  const now = Date.now();
  if (d.lockedUntil && now >= d.lockedUntil) {
    saveRateData({ attempts: 1, lockedUntil: 0 });
    return;
  }
  d.attempts = (d.attempts || 0) + 1;
  if (d.attempts >= MAX_ATTEMPTS) {
    d.lockedUntil = now + LOCKOUT_MS;
  }
  saveRateData(d);
}

function resetRateLimit() {
  saveRateData({ attempts: 0, lockedUntil: 0 });
}

function showRateLimitBox() {
  const formCard =
    document.getElementById("formCard");
  if (!formCard) return;

  const old =
    document.getElementById("rateLimitWarning");
  if (old) old.remove();

  const box = document.createElement("div");
  box.id        = "rateLimitWarning";
  box.className = "rate-limit-box";
  box.innerHTML = `
    <div style="font-size:28px;
                margin-bottom:8px;">⛔</div>
    <p style="font-weight:700;
              color:#991b1b;
              font-size:15px;">
      ${i("errRateLimit").split("\n").join("<br>")}
    </p>
    <p id="rlCountdown"
       style="font-size:13px;
              color:#64748b;
              margin-top:8px;"></p>
  `;

  formCard.parentNode.insertBefore(box, formCard);
  formCard.style.display = "none";

  // Countdown
  function tick() {
    const d   = getRateData();
    const now = Date.now();
    if (!d.lockedUntil || now >= d.lockedUntil) {
      const b = document.getElementById(
        "rateLimitWarning"
      );
      if (b) b.remove();
      const fc = document.getElementById("formCard");
      if (fc) fc.style.display = "block";
      resetRateLimit();
      return;
    }
    const rem  = Math.ceil(
      (d.lockedUntil - now) / 1000
    );
    const mins = Math.floor(rem / 60);
    const secs = rem % 60;
    const el =
      document.getElementById("rlCountdown");
    if (el) {
      el.textContent =
        `⏱ ${mins}:${String(secs).padStart(2,"0")}`;
    }
    setTimeout(tick, 1000);
  }
  tick();
}

// ================================================
// HANDLE SESSION CLOSED (real-time)
// ================================================
function handleSessionClosed() {
  if (sessionListener) {
    sessionListener();
    sessionListener = null;
  }

  const els = [
    "formCard",
    "distanceBox",
    "locationBox",
    "checkoutCard"
  ];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const closed =
    document.getElementById("sessionClosedCard");
  if (closed) {
    closed.style.display = "block";
    const msg = closed.querySelector(
      "[data-i18n='sessionClosedMsg']"
    );
    if (msg) msg.textContent = i("sessionEndedMsg");
  }

  const banner =
    document.getElementById("sessionBanner");
  if (banner) {
    banner.style.display    = "flex";
    banner.style.background = "#fef2f2";
    banner.style.color      = "#dc2626";
    banner.style.border     = "1px solid #fca5a5";
    const icon =
      document.getElementById("sessionBannerIcon");
    const text =
      document.getElementById("sessionBannerText");
    if (icon) icon.textContent = "🔴";
    if (text) {
      text.textContent = i("attendanceClosed");
    }
  }
}

// ================================================
// START SESSION LISTENER
// ================================================
function startSessionListener() {
  const ref = doc(db, "session", "current");

  sessionListener = onSnapshot(ref,
    function (snap) {
      if (!snap.exists()) return;
      const data  = snap.data();
      const today =
        new Date().toLocaleDateString("en-CA");

      const valid =
        data.isOpen    === true &&
        data.date      === today &&
        data.sessionId === sessionId;

      if (!valid) handleSessionClosed();
    },
    function (err) {
      console.error("Session listener:", err);
    }
  );
}

// ================================================
// LOAD SESSION
// ================================================
async function loadSession() {
  const params  =
    new URLSearchParams(window.location.search);
  sessionId = params.get("session");

  const formCard =
    document.getElementById("formCard");
  const closedCard =
    document.getElementById("sessionClosedCard");
  const banner =
    document.getElementById("sessionBanner");
  const bannerText =
    document.getElementById("sessionBannerText");
  const bannerIcon =
    document.getElementById("sessionBannerIcon");

  if (!sessionId) {
    formCard.style.display   = "none";
    closedCard.style.display = "block";
    const msg = document.querySelector(
      "[data-i18n='sessionClosedMsg']"
    );
    if (msg) msg.textContent = i("noSession");
    return;
  }

  try {
    const snap = await getDoc(
      doc(db, "session", "current")
    );

    if (!snap.exists()) {
      formCard.style.display   = "none";
      closedCard.style.display = "block";
      return;
    }

    sessionData   = snap.data();
    const today   =
      new Date().toLocaleDateString("en-CA");

    if (
      !sessionData.isOpen          ||
      sessionData.date   !== today ||
      sessionData.sessionId !== sessionId
    ) {
      formCard.style.display   = "none";
      closedCard.style.display = "block";
      document.querySelectorAll(
        "[data-i18n='sessionClosedMsg']"
      ).forEach(el => {
        el.textContent = i("sessionExpired");
      });
      return;
    }

    // Rate limit check
    if (isRateLimited()) {
      showRateLimitBox();
    }

    // Show open banner
    banner.style.display    = "flex";
    bannerIcon.textContent  = "🟢";
    bannerText.textContent  = i("sessionActive");
    banner.style.background = "#f0fdf4";
    banner.style.color      = "#16a34a";
    banner.style.border     = "1px solid #86efac";

    // Get or create device token
    deviceToken = getOrCreateDeviceToken();

    // Start real-time session watcher
    startSessionListener();

    // Load students AND request location
    await Promise.all([
      loadAllStudents(),
      new Promise(resolve => {
        requestLocation();
        resolve();
      })
    ]);

  } catch (err) {
    console.error("Load session error:", err);
    formCard.style.display   = "none";
    closedCard.style.display = "block";
  }
}

// ================================================
// SHOW ERROR MESSAGE
// ================================================
function showError(message) {
  const card =
    document.getElementById("errorCard");
  const msg  =
    document.getElementById("errorMessage");
  if (card && msg) {
    msg.textContent  = message;
    card.style.display = "block";
    card.scrollIntoView({
      behavior: "smooth",
      block:    "center"
    });
    setTimeout(() => {
      card.style.display = "none";
    }, 6000);
  }
}

// ================================================
// VALIDATE FORM BEFORE SUBMIT
// ================================================
function validateForm() {
  const idVal =
    document.getElementById("studentId")
      ?.value.trim() || "";

  document.getElementById("studentIdError")
    .textContent = "";

  if (!studentsLoaded) {
    document.getElementById("studentIdError")
      .textContent = i("errStudentIdLoading");
    return false;
  }

  if (!idVal) {
    document.getElementById("studentIdError")
      .textContent = i("errStudentId");
    return false;
  }

  if (!findStudent(idVal)) {
    document.getElementById("studentIdError")
      .textContent = i("errStudentIdNotFound");
    return false;
  }

  return true;
}

// ================================================
// FORMAT TIME FOR DISPLAY
// ================================================
function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour:   "2-digit",
    minute: "2-digit"
  });
}

// ================================================
// SHOW CHECKOUT CARD
// After successful check-in, show this card
// ================================================
function showCheckoutCard(
  studentName,
  checkInDisplay,
  checkOutDisplay,
  isCheckedOut
) {
  // Hide form
  const formCard =
    document.getElementById("formCard");
  if (formCard) formCard.style.display = "none";

  // Hide distance and location boxes
  const distBox =
    document.getElementById("distanceBox");
  const locBox =
    document.getElementById("locationBox");
  if (distBox) distBox.style.display = "none";
  if (locBox)  locBox.style.display  = "none";

  // Show checkout card
  const card =
    document.getElementById("checkoutCard");
  if (!card) return;
  card.style.display = "block";

  // Fill in name
  const nameEl =
    document.getElementById("checkoutStudentName");
  if (nameEl) nameEl.textContent = studentName;

  // Fill check-in time
  const ciEl =
    document.getElementById("displayCheckInTime");
  if (ciEl) {
    ciEl.textContent =
      checkInDisplay || "--";
  }

  // Fill check-out time
  const coEl =
    document.getElementById("displayCheckOutTime");
  if (coEl) {
    coEl.textContent = checkOutDisplay ||
      i("notCheckedOut");
  }

  // Fill status
  const stEl =
    document.getElementById("displayStatus");
  if (stEl) {
    stEl.textContent = i("present");
    stEl.style.color = "#16a34a";
  }

  // Handle check-out button
  const btn =
    document.getElementById("checkOutBtn");
  const doneMsg =
    document.getElementById("alreadyCheckedOutMsg");

  if (isCheckedOut) {
    if (btn) btn.style.display     = "none";
    if (doneMsg) {
      doneMsg.textContent   =
        i("alreadyCheckedOutMsg");
      doneMsg.style.display = "block";
    }
  } else {
    if (btn) btn.style.display     = "block";
    if (doneMsg) {
      doneMsg.style.display = "none";
    }
  }
}

// ================================================
// ✅ SUBMIT ATTENDANCE — CHECK IN
//
// Security checks in order:
// 1. Rate limit
// 2. Form validation (student ID)
// 3. GPS location within 100m
// 4. Session still open
// 5. Device token (atomic Firebase transaction)
// 6. Not already checked in
// ================================================
async function submitAttendance(e) {
  e.preventDefault();

  // 1. Rate limit
  if (isRateLimited()) {
    showRateLimitBox();
    return;
  }

  // 2. Form validation
  if (!validateForm()) {
    const idVal =
      document.getElementById("studentId")
        ?.value.trim() || "";
    if (idVal && !findStudent(idVal)) {
      recordFailedAttempt();
      if (isRateLimited()) showRateLimitBox();
    }
    return;
  }

  // 3. GPS
  if (!locationVerified || !studentLocation) {
    showError(i("errLocation"));
    return;
  }

  const dist = haversineDistance(
    studentLocation.latitude,
    studentLocation.longitude,
    SCHOOL_LAT, SCHOOL_LON
  );

  if (dist > MAX_DISTANCE) {
    showError(i("errTooFar"));
    locationVerified = false;
    const sb =
      document.getElementById("submitBtn");
    if (sb) sb.disabled = true;
    return;
  }

  const studentIdVal = normalizeId(
    document.getElementById("studentId").value
  );
  const student      = findStudent(studentIdVal);
  const nameVal      = student?.fullName || "";
  const ageVal       = student?.age      || "";
  const gradeVal     = student?.grade    || "";

  const overlay =
    document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "flex";

  try {
    // 4. Re-verify session is still open
    const freshSnap = await getDoc(
      doc(db, "session", "current")
    );
    if (freshSnap.exists()) {
      const fd    = freshSnap.data();
      const today =
        new Date().toLocaleDateString("en-CA");
      if (
        !fd.isOpen          ||
        fd.date   !== today ||
        fd.sessionId !== sessionId
      ) {
        if (overlay) overlay.style.display = "none";
        handleSessionClosed();
        return;
      }
    }

    // 5. Device token check — atomic transaction
    const deviceKey    =
      sessionId + "_" + deviceToken;
    const deviceLogRef =
      doc(db, "deviceLogs", deviceKey);

    const recordRef = doc(
      db,
      "sessionAttendance",
      sessionId,
      "records",
      studentIdVal
    );

    // Use Firestore transaction for atomicity
    // This prevents two simultaneous submissions
    // from the same device token
    let alreadyUsedByOther = false;
    let alreadyCheckedIn   = false;

    await runTransaction(db, async (tx) => {
      const deviceSnap = await tx.get(deviceLogRef);
      const recordSnap = await tx.get(recordRef);

      // Check device token
      if (deviceSnap.exists()) {
        const dl = deviceSnap.data();
        if (dl.studentId !== studentIdVal) {
          alreadyUsedByOther = true;
          return; // abort transaction
        }
      }

      // Check attendance record
      if (!recordSnap.exists()) {
        // Record doesn't exist yet — skip
        // (teacher may not have started session)
        return;
      }

      const rd = recordSnap.data();
      if (rd.status === "present") {
        alreadyCheckedIn = true;
        return;
      }

      // All checks passed — save
      const now         = new Date();
      const checkInTime = now.toISOString();
      const display     = formatTime(now);
      const checkDate   =
        now.toLocaleDateString("en-CA");

      const data = {
        fullName:           nameVal,
        age:                Number(ageVal),
        grade:              gradeVal,
        studentId:          studentIdVal,
        sessionId:          sessionId,
        checkInTime:        checkInTime,
        checkInDisplay:     display,
        checkInDate:        checkDate,
        checkOutTime:       null,
        checkOutDisplay:    null,
        status:             "present",
        latitude:           studentLocation.latitude,
        longitude:          studentLocation.longitude,
        gpsAccuracy:        studentLocation.accuracy,
        distanceFromSchool: dist,
        deviceToken:
          deviceToken.substring(0, 8) + "...",
        submittedAt:        checkInTime
      };

      tx.update(recordRef, data);

      // Save device log
      tx.set(deviceLogRef, {
        deviceToken: deviceToken,
        studentId:   studentIdVal,
        sessionId:   sessionId,
        usedAt:      checkInTime
      });

      // Store for checkout use
      currentStudentId  = studentIdVal;
      studentCheckedIn  = true;
      studentCheckedOut = false;
    });

    if (overlay) overlay.style.display = "none";

    if (alreadyUsedByOther) {
      showError(i("errDeviceUsed"));
      return;
    }

    if (alreadyCheckedIn) {
      showError(i("errAlreadyCheckedIn"));
      return;
    }

    // ✅ SUCCESS — Show checkout card
    resetRateLimit();
    currentStudentId = studentIdVal;
    studentCheckedIn = true;

    const now = new Date();
    showCheckoutCard(
      nameVal,
      formatTime(now),
      null,
      false
    );

    console.log(
      "✅ Check-in saved:", studentIdVal
    );

  } catch (err) {
    console.error("Check-in error:", err);
    if (overlay) overlay.style.display = "none";
    showError(err.message);
  }
}

// ================================================
// ✅ CHECK OUT
//
// Security checks:
// 1. Student checked in
// 2. Not already checked out
// 3. Session still open
// 4. Within 100 meters
// 5. Device token matches
// ================================================
async function handleCheckOut() {
  if (!studentCheckedIn) {
    showError(i("errNotCheckedIn"));
    return;
  }

  if (studentCheckedOut) {
    showError(i("errAlreadyCheckedOut"));
    return;
  }

  // Re-request location for checkout
  const overlay =
    document.getElementById("loadingOverlay");
  const loadingText =
    document.querySelector(".loading-text");

  if (overlay) overlay.style.display = "flex";
  if (loadingText) {
    loadingText.textContent = i("checkingOut");
  }

  // Get fresh location
  navigator.geolocation.getCurrentPosition(
    async function (pos) {
      const lat  = pos.coords.latitude;
      const lon  = pos.coords.longitude;
      const dist = haversineDistance(
        lat, lon, SCHOOL_LAT, SCHOOL_LON
      );

      if (dist > MAX_DISTANCE) {
        if (overlay) {
          overlay.style.display = "none";
        }
        if (loadingText) {
          loadingText.textContent =
            i("savingText");
        }
        showError(i("errCheckOutLocation"));
        return;
      }

      try {
        // Verify session still open
        const freshSnap = await getDoc(
          doc(db, "session", "current")
        );
        if (freshSnap.exists()) {
          const fd    = freshSnap.data();
          const today =
            new Date().toLocaleDateString("en-CA");
          if (
            !fd.isOpen          ||
            fd.date   !== today ||
            fd.sessionId !== sessionId
          ) {
            if (overlay) {
              overlay.style.display = "none";
            }
            handleSessionClosed();
            return;
          }
        }

        const recordRef = doc(
          db,
          "sessionAttendance",
          sessionId,
          "records",
          currentStudentId
        );

        const recordSnap = await getDoc(recordRef);
        if (!recordSnap.exists()) {
          if (overlay) {
            overlay.style.display = "none";
          }
          showError("Attendance record not found.");
          return;
        }

        const rd = recordSnap.data();

        // Already checked out?
        if (rd.checkOutTime) {
          if (overlay) {
            overlay.style.display = "none";
          }
          studentCheckedOut = true;
          showError(i("errAlreadyCheckedOut"));
          return;
        }

        // Save check-out time
        const now            = new Date();
        const checkOutISO    = now.toISOString();
        const checkOutDisplay = formatTime(now);

        await updateDoc(recordRef, {
          checkOutTime:    checkOutISO,
          checkOutDisplay: checkOutDisplay,
          checkOutLat:     lat,
          checkOutLon:     lon,
          checkOutDist:    dist
        });

        studentCheckedOut = true;

        if (overlay) overlay.style.display = "none";
        if (loadingText) {
          loadingText.textContent = i("savingText");
        }

        // Update checkout card display
        const coEl = document.getElementById(
          "displayCheckOutTime"
        );
        if (coEl) {
          coEl.textContent = checkOutDisplay;
        }

        // Hide checkout button, show done message
        const btn =
          document.getElementById("checkOutBtn");
        const doneMsg = document.getElementById(
          "alreadyCheckedOutMsg"
        );
        if (btn) btn.style.display = "none";
        if (doneMsg) {
          doneMsg.textContent   =
            i("checkOutSuccess");
          doneMsg.style.display = "block";
          doneMsg.style.color   = "#16a34a";
        }

        console.log(
          "✅ Check-out saved:", currentStudentId
        );

      } catch (err) {
        console.error("Check-out error:", err);
        if (overlay) overlay.style.display = "none";
        if (loadingText) {
          loadingText.textContent = i("savingText");
        }
        showError(err.message);
      }
    },

    function (err) {
      if (overlay) overlay.style.display = "none";
      if (loadingText) {
        loadingText.textContent = i("savingText");
      }
      showError(i("locationError"));
    },

    {
      enableHighAccuracy: true,
      timeout:            10000,
      maximumAge:         0
    }
  );
}

// ================================================
// EVENT LISTENERS
// ================================================
document.getElementById("languageButton")
  ?.addEventListener("click", function () {
    applyLanguage(
      currentLang === "en" ? "km" : "en"
    );
  });

document.getElementById("retryLocationBtn")
  ?.addEventListener("click", requestLocation);

document.getElementById("attendanceForm")
  ?.addEventListener("submit", submitAttendance);

document.getElementById("checkOutBtn")
  ?.addEventListener("click", handleCheckOut);

// Student ID input — debounced validation
let idTimer = null;
document.getElementById("studentId")
  ?.addEventListener("input", function () {
    clearTimeout(idTimer);
    idTimer = setTimeout(validateStudentId, 600);
  });

document.getElementById("studentId")
  ?.addEventListener("blur", function () {
    clearTimeout(idTimer);
    validateStudentId();
  });

// ================================================
// START
// ================================================
const savedLang =
  localStorage.getItem("studentLanguage") || "en";
applyLanguage(savedLang);
await loadSession();
