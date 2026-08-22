// ================================================
// script.js — Student Attendance Page
//
// BUG FIXES in this version:
//
// FIX 1: Sex field was empty because:
//   - Old Firebase records used "age" not "sex"
//   - Added fallback: reads sex first, then age
//   - If neither exists, shows "—" gracefully
//
// FIX 2: Submit button stayed disabled because:
//   - GPS sometimes finishes before students load
//   - showDistanceResult() ran before studentsMap
//     was populated, so findStudent() returned null
//   - Added: after loadAllStudents() completes,
//     re-check if ID is typed + location verified
//     and enable the button if both are true
// ================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
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
// SCHOOL LOCATION
// ================================================
const SCHOOL_LAT   = 11.822624138074948;
const SCHOOL_LON   = 104.7536601355822;
const MAX_DISTANCE = 100;
const MAX_ACCURACY = 50;

// ================================================
// RATE LIMIT
// ================================================
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 5 * 60 * 1000;

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
let qrMode           = "checkIn";

// Time window values read from Firebase session
let checkInStartTime  = null;
let checkInEndTime    = null;
let checkOutStartTime = null;
let checkOutEndTime   = null;

let studentsMap    = new Map();
let studentsLoaded = false;

let studentCheckedIn  = false;
let studentCheckedOut = false;
let currentStudentId  = null;

// ================================================
// TRANSLATIONS
// ================================================
const i18n = {
  en: {
    title:    "QR Attendance System",
    subtitle: "Tepranom High School",

    sessionActive:
      "Attendance session is open.",
    sessionClosed:
      "Attendance session is closed.",
    sessionClosedTitle:
      "Session Closed",
    sessionClosedMsg:
      "The attendance session is not open. " +
      "Please ask your teacher to start " +
      "the session.",
    noSession:
      "No session found. Please scan the " +
      "QR code again.",
    sessionExpired:
      "This QR code is no longer valid.",
    attendanceClosed:
      "Attendance is currently closed.",
    sessionEndedMsg:
      "Attendance session has ended.",

    modeBannerCheckIn:
      "✅ This is a CHECK-IN QR Code",
    modeBannerCheckOut:
      "🚪 This is a CHECK-OUT QR Code",

    requestingLocation:
      "📍 Checking your location...",
    locating:
      "📍 Checking your location...",
    locationVerifiedMsg:
      "✅ You are inside the school area.",
    locationTooFar:
      "❌ You are too far from the school. " +
      "Please go to the school to check in.",
    locationDenied:
      "📍 Please allow location access " +
      "to check in.",
    locationError:
      "Could not get your location. " +
      "Please try again.",
    locationPoorAccuracy:
      "Could not verify your location. " +
      "Please try again.",
    locationNotSupported:
      "Your browser does not support " +
      "location services.",
    retryLocation:
      "Try Again",
    gpsAccuracy:
      "GPS Accuracy",
    distanceFromSchool:
      "Distance from school",
    meters:
      "meters",

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
    sexLabel:
      "Sex",
    sexPlaceholder:
      "Auto-filled",
    gradeLabel:
      "Grade / Class",
    gradePlaceholder:
      "Auto-filled",

    formTitle:
      "📋 Mark Your Attendance",
    formTitleCheckIn:
      "📥 Check-In",
    formTitleCheckOut:
      "📤 Check-Out",

    submitButton:
      "✅ Check In",
    submitButtonCheckIn:
      "✅ Check In",
    submitButtonCheckOut:
      "🚪 Check Out",

    autoFillMsg:
      "✅ Student found. Details filled " +
      "automatically.",
    autoFillReadOnly:
      "Name, Sex and Grade are read-only.",

    errStudentId:
      "Please enter your Student ID.",
    errStudentIdNotFound:
      "Student ID not found. Please check " +
      "your Student ID.",
    errStudentIdLoading:
      "Please wait. Student data is " +
      "still loading.",
    errLocation:
      "Location not verified yet. Please wait.",
    errTooFar:
      "You are outside the school area. " +
      "Attendance is not allowed.",
    errAlreadyCheckedIn:
      "You have already checked in for " +
      "this session.",
    errDeviceUsed:
      "This device has already checked in " +
      "for this attendance session.",
    errRateLimit:
      "Too many attempts.\nPlease wait 5 minutes.",
    errSessionClosed:
      "The attendance session has ended.",

    errCheckInClosed:
      "Check-In is currently closed. " +
      "Please check the allowed time.",
    errCheckOutClosed:
      "Check-Out is currently closed. " +
      "Please check the allowed time.",

    errNotCheckedInYet:
      "You have not checked in yet. " +
      "You must check in before checking out.",
    errAlreadyCheckedOut:
      "You have already checked out " +
      "for this session.",
    errCheckOutLocation:
      "You must be within the school area " +
      "to check out.",
    errNotCheckedIn:
      "You must check in before checking out.",

    successTitle:
      "Check-In Successful!",
    successMessage:
      "Your attendance has been recorded.",
    savingText:
      "Saving your attendance...",

    checkOutSuccessTitle:
      "Check-Out Successful!",
    checkOutSuccessMessage:
      "Your check-out has been recorded.",

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
      "✅ You have already checked out " +
      "for this session.",

    notCheckedInTitle:
      "Not Checked In Yet",
    notCheckedInMsg:
      "You must check in before you can " +
      "check out. Please ask your teacher " +
      "for the Check-In QR code.",

    footerSecurity:
      "🔒 Your location is only used to " +
      "verify attendance.",
    footerSchool:
      "Tepranom High School Attendance System",

    // ✅ Sex display values
    sexMale:      "Male",
    sexFemale:    "Female",
    sexNotSet:    "—",

    colDate: "Date",
    colTime: "Time"
  },

  km: {
    title:    "ប្រព័ន្ធចុះវត្តមាន QR",
    subtitle: "វិទ្យាល័យទេពប្រណម្យ",

    sessionActive:
      "វគ្គចុះវត្តមានកំពុងបើក។",
    sessionClosed:
      "វគ្គចុះវត្តមានបានបិទ។",
    sessionClosedTitle:
      "វគ្គបានបិទ",
    sessionClosedMsg:
      "វគ្គចុះវត្តមានមិនទាន់បើក។ " +
      "សូមស្នើគ្រូឱ្យចាប់ផ្ដើមវគ្គ។",
    noSession:
      "រកមិនឃើញវគ្គ។ " +
      "សូមស្កេន QR Code ម្តងទៀត។",
    sessionExpired:
      "QR Code នេះលែងមានសុពលភាពទៀតហើយ។",
    attendanceClosed:
      "ការចុះវត្តមានត្រូវបានបិទ។",
    sessionEndedMsg:
      "វគ្គចុះវត្តមានបានបញ្ចប់។",

    modeBannerCheckIn:
      "✅ QR Code នេះសម្រាប់ម៉ោងចូល",
    modeBannerCheckOut:
      "🚪 QR Code នេះសម្រាប់ម៉ោងចេញ",

    requestingLocation:
      "📍 កំពុងពិនិត្យទីតាំងរបស់អ្នក...",
    locating:
      "📍 កំពុងពិនិត្យទីតាំងរបស់អ្នក...",
    locationVerifiedMsg:
      "✅ អ្នកស្ថិតនៅក្នុងបរិវេណសាលា។",
    locationTooFar:
      "❌ អ្នកនៅឆ្ងាយពីសាលា។ " +
      "សូមទៅកាន់សាលា ដើម្បីចុះវត្តមាន។",
    locationDenied:
      "📍 សូមអនុញ្ញាតការប្រើទីតាំង " +
      "ដើម្បីចុះវត្តមាន។",
    locationError:
      "មិនអាចទទួលទីតាំងរបស់អ្នក។ " +
      "សូមព្យាយាមម្តងទៀត។",
    locationPoorAccuracy:
      "មិនអាចផ្ទៀងផ្ទាត់ទីតាំងរបស់អ្នកបានទេ។ " +
      "សូមព្យាយាមម្តងទៀត។",
    locationNotSupported:
      "កម្មវិធីរុករករបស់អ្នកមិនអាចប្រើ" +
      "ទីតាំងបានទេ។",
    retryLocation:
      "ព្យាយាមម្តងទៀត",
    gpsAccuracy:
      "ភាពត្រឹមត្រូវ GPS",
    distanceFromSchool:
      "ចម្ងាយពីសាលា",
    meters:
      "ម៉ែត្រ",

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
    sexLabel:
      "ភេទ",
    sexPlaceholder:
      "បំពេញដោយស្វ័យប្រវត្តិ",
    gradeLabel:
      "ថ្នាក់រៀន",
    gradePlaceholder:
      "បំពេញដោយស្វ័យប្រវត្តិ",

    formTitle:
      "📋 ចុះវត្តមានរបស់អ្នក",
    formTitleCheckIn:
      "📥 ចុះម៉ោងចូល",
    formTitleCheckOut:
      "📤 ចុះម៉ោងចេញ",

    submitButton:
      "✅ ចុះម៉ោងចូល",
    submitButtonCheckIn:
      "✅ ចុះម៉ោងចូល",
    submitButtonCheckOut:
      "🚪 ចុះម៉ោងចេញ",

    autoFillMsg:
      "✅ រកឃើញសិស្ស។ " +
      "ព័ត៌មានត្រូវបានបំពេញ" +
      "ដោយស្វ័យប្រវត្តិ។",
    autoFillReadOnly:
      "ឈ្មោះ ភេទ និងថ្នាក់ជា" +
      "ព័ត៌មានអានតែប៉ុណ្ណោះ។",

    errStudentId:
      "សូមបញ្ចូលលេខសម្គាល់សិស្ស។",
    errStudentIdNotFound:
      "រកមិនឃើញលេខសម្គាល់សិស្ស។ " +
      "សូមពិនិត្យលេខសម្គាល់សិស្ស" +
      "របស់អ្នក។",
    errStudentIdLoading:
      "សូមរង់ចាំ។ ទិន្នន័យសិស្ស" +
      "កំពុងផ្ទុក។",
    errLocation:
      "ទីតាំងមិនទាន់ផ្ទៀងផ្ទាត់ទេ។",
    errTooFar:
      "អ្នកស្ថិតនៅក្រៅបរិវេណសាលា។ " +
      "មិនអាចចុះវត្តមានបានទេ។",
    errAlreadyCheckedIn:
      "អ្នកបានចុះម៉ោងចូលរួចហើយ។",
    errDeviceUsed:
      "ឧបករណ៍នេះបានចុះវត្តមានរួចហើយ។",
    errRateLimit:
      "អ្នកបានព្យាយាមច្រើនពេក។\n" +
      "សូមរង់ចាំ ៥ នាទី។",
    errSessionClosed:
      "វគ្គចុះវត្តមានបានបញ្ចប់។",

    errCheckInClosed:
      "ការចុះម៉ោងចូលមិនទាន់បើកទេ។ " +
      "សូមពិនិត្យម៉ោងដែលអនុញ្ញាត។",
    errCheckOutClosed:
      "ការចុះម៉ោងចេញមិនទាន់បើកទេ។ " +
      "សូមពិនិត្យម៉ោងដែលអនុញ្ញាត។",

    errNotCheckedInYet:
      "មិនទាន់ចុះវត្តមាន — " +
      "អ្នកត្រូវចុះម៉ោងចូលជាមុនសិន។",
    errAlreadyCheckedOut:
      "អ្នកបានចុះម៉ោងចេញរួចហើយ" +
      "សម្រាប់វគ្គនេះ។",
    errCheckOutLocation:
      "អ្នកត្រូវស្ថិតនៅក្នុងបរិវេណសាលា " +
      "ដើម្បីចុះម៉ោងចេញ។",
    errNotCheckedIn:
      "អ្នកត្រូវចុះម៉ោងចូលជាមុនសិន។",

    successTitle:
      "ចុះម៉ោងចូលបានជោគជ័យ!",
    successMessage:
      "វត្តមានរបស់អ្នកត្រូវបានកត់ត្រា។",
    savingText:
      "កំពុងរក្សាទុកវត្តមាន...",

    checkOutSuccessTitle:
      "ចុះម៉ោងចេញបានជោគជ័យ!",
    checkOutSuccessMessage:
      "ការចុះម៉ោងចេញរបស់អ្នក" +
      "ត្រូវបានកត់ត្រា។",

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
      "✅ អ្នកបានចុះម៉ោងចេញ" +
      "ដោយជោគជ័យ។",
    alreadyCheckedOutMsg:
      "✅ អ្នកបានចុះម៉ោងចេញរួចហើយ។",

    notCheckedInTitle:
      "មិនទាន់ចុះវត្តមាន",
    notCheckedInMsg:
      "អ្នកត្រូវចុះម៉ោងចូលជាមុនសិន " +
      "មុននឹងអាចចុះម៉ោងចេញបាន។ " +
      "សូមស្នើ QR Code ម៉ោងចូលពីគ្រូ។",

    footerSecurity:
      "🔒 ទីតាំងរបស់អ្នកត្រូវបានប្រើ" +
      "តែ​សម្រាប់​ផ្ទៀង​ផ្ទាត់​វត្តមាន" +
      "​ប៉ុណ្ណោះ។",
    footerSchool:
      "ប្រព័ន្ធវត្តមានវិទ្យាល័យទេពប្រណម្យ",

    // ✅ Sex display values (Khmer)
    sexMale:      "ប្រុស",
    sexFemale:    "ស្រី",
    sexNotSet:    "—",

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
// ✅ FIXED: TRANSLATE SEX VALUE
//
// BEFORE: only handled "Male" and "Female"
// NOW: also handles empty string, undefined,
//      null gracefully by showing "—"
//
// Also handles old Firebase records that may
// have stored Khmer text directly — we keep
// them as-is if not recognized.
// ================================================
function translateSex(sexValue) {
  // No value at all → show dash
  if (!sexValue || sexValue.trim() === "") {
    return i("sexNotSet");
  }

  const normalized = sexValue.trim();

  if (normalized === "Male") {
    return i("sexMale");
  }
  if (normalized === "Female") {
    return i("sexFemale");
  }

  // If already in Khmer or unknown value,
  // return as-is so data is not lost
  return normalized;
}

// ================================================
// ✅ FIXED: CHECK IF SUBMIT BUTTON SHOULD ENABLE
//
// This is a NEW central function that checks
// ALL conditions needed to enable the button.
//
// Called from:
//   - after student ID validation
//   - after location is verified
//   - after students finish loading
//
// This fixes the race condition where GPS
// finished before students loaded (or vice versa)
// and the button never got enabled.
// ================================================
function checkAndEnableSubmitButton() {
  const submitBtn =
    document.getElementById("submitBtn");
  if (!submitBtn) return;

  const idVal =
    document.getElementById("studentId")
      ?.value.trim() || "";

  // All conditions must be true:
  // 1. Students are loaded from Firebase
  // 2. Student ID is entered
  // 3. Student exists in Firebase
  // 4. Location is verified (within 100m)
  const shouldEnable =
    studentsLoaded &&
    idVal !== "" &&
    findStudent(idVal) !== null &&
    locationVerified;

  submitBtn.disabled = !shouldEnable;

  // Log for debugging
  console.log(
    "🔘 Submit button check:",
    "\n  studentsLoaded:", studentsLoaded,
    "\n  idVal:", idVal,
    "\n  studentFound:", findStudent(idVal) !== null,
    "\n  locationVerified:", locationVerified,
    "\n  → button enabled:", shouldEnable
  );
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

  // ✅ Re-translate sex field if already filled
  // Uses rawValue stored in dataset to
  // convert to the new language
  const sexField =
    document.getElementById("sex");
  if (
    sexField &&
    sexField.dataset.rawValue !== undefined &&
    sexField.dataset.rawValue !== ""
  ) {
    sexField.value =
      translateSex(sexField.dataset.rawValue);
  }

  updateFormForMode();
  updateModeBanner();

  if (studentLocation) {
    showDistanceResult(studentLocation);
  }

  updateStudentIdFieldState();
}

// ================================================
// UPDATE FORM FOR CURRENT QR MODE
// ================================================
function updateFormForMode() {
  const titleEl =
    document.getElementById("formCard")
      ?.querySelector(".form-title");
  const submitBtn =
    document.getElementById("submitBtn");

  if (qrMode === "checkOut") {
    if (titleEl) {
      titleEl.textContent = i("formTitleCheckOut");
    }
    if (submitBtn) {
      submitBtn.textContent =
        i("submitButtonCheckOut");
    }
  } else {
    if (titleEl) {
      titleEl.textContent = i("formTitleCheckIn");
    }
    if (submitBtn) {
      submitBtn.textContent =
        i("submitButtonCheckIn");
    }
  }
}

// ================================================
// UPDATE MODE BANNER
// ================================================
function updateModeBanner() {
  const banner =
    document.getElementById("modeBanner");
  const text =
    document.getElementById("modeBannerText");

  if (!banner) return;

  if (qrMode === "checkOut") {
    banner.style.display    = "block";
    banner.style.background = "#fef3c7";
    banner.style.color      = "#92400e";
    banner.style.border     = "2px solid #fcd34d";
    if (text) {
      text.textContent = i("modeBannerCheckOut");
    }
  } else {
    banner.style.display    = "block";
    banner.style.background = "#dcfce7";
    banner.style.color      = "#166534";
    banner.style.border     = "2px solid #86efac";
    if (text) {
      text.textContent = i("modeBannerCheckIn");
    }
  }
}

// ================================================
// DEVICE TOKEN
// ================================================
function getOrCreateDeviceToken() {
  const KEY = "attendanceDeviceToken";
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(KEY, token);
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
// ✅ FIXED: LOAD STUDENTS FROM FIREBASE
//
// CHANGE: Now reads BOTH "sex" AND "age" fields.
//
// Why: Old student records in Firebase were
// created when the system used "age". After the
// change to "sex", old records still have "age"
// but no "sex". New records have "sex".
//
// Fix: Read sex first. If sex is empty/missing,
// try reading age as a fallback display value.
// This way old records still show something
// instead of being blank.
//
// IMPORTANT: We do NOT delete or overwrite
// existing Firebase data. We just read
// whichever field exists.
//
// ✅ FIX 2: After loading, re-check button state
// This handles the race condition where GPS
// finishes before students load.
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

      // ✅ Read sex field
      // If sex is missing (old record), use age
      // as a display fallback.
      // Store original Firebase field in rawSex
      // so we know what the actual DB value is.
      let sexValue = "";

      if (
        data.sex !== undefined &&
        data.sex !== null &&
        String(data.sex).trim() !== ""
      ) {
        // New record: has sex field
        sexValue = String(data.sex).trim();
      } else if (
        data.age !== undefined &&
        data.age !== null &&
        String(data.age).trim() !== ""
      ) {
        // Old record: has age field, use it
        // We show it as-is since we cannot
        // know if it was Male/Female
        sexValue = String(data.age).trim();
      }

      console.log(
        "📚 Loaded student:",
        docId,
        "| sex:", sexValue,
        "| grade:", data.grade
      );

      studentsMap.set(docId, {
        studentId: docId,
        fullName:  data.fullName  || "",
        sex:       sexValue,
        grade:     data.grade     || ""
      });
    });

    studentsLoaded = true;
    updateStudentIdFieldState();

    // ✅ FIX: After students load, re-validate
    // any ID the student already typed.
    // This handles the case where GPS finished
    // first and students loaded second.
    const el =
      document.getElementById("studentId");
    if (el && el.value.trim() !== "") {
      console.log(
        "🔄 Students loaded after ID entered.",
        "Re-validating ID:",
        el.value.trim()
      );
      validateStudentId();
    }

    // ✅ Always re-check button state after
    // students load, regardless of whether
    // ID was already typed
    checkAndEnableSubmitButton();

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
// ✅ FIXED: VALIDATE STUDENT ID — AUTO-FILL
//
// CHANGE: Sex field now uses the fixed
// translateSex() which handles empty values
// gracefully instead of showing nothing.
//
// CHANGE: Button enabling now calls the central
// checkAndEnableSubmitButton() instead of
// checking locationVerified directly here.
// This ensures consistent behavior.
// ================================================
function validateStudentId() {
  const idInput =
    document.getElementById("studentId");
  const idError =
    document.getElementById("studentIdError");
  const msgEl =
    document.getElementById("autoFillMsg");

  if (!idInput) return false;

  const rawId = idInput.value;

  if (!studentsLoaded) {
    if (idError) {
      idError.textContent =
        i("errStudentIdLoading");
    }
    // ✅ Ensure button is disabled while loading
    const submitBtn =
      document.getElementById("submitBtn");
    if (submitBtn) submitBtn.disabled = true;
    return false;
  }

  if (!rawId.trim()) {
    if (idError) idError.textContent = "";
    if (msgEl) msgEl.style.display = "none";
    clearAutoFill();
    // ✅ Recheck button (will disable it)
    checkAndEnableSubmitButton();
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
    // ✅ Recheck button (will disable it)
    checkAndEnableSubmitButton();
    return false;
  }

  // ✅ Student found — clear error
  if (idError) idError.textContent = "";

  // Fill name field
  setField("fullName", student.fullName);

  // ✅ FIXED: Fill sex field properly
  // Store raw English value in dataset
  // so language switch can re-translate it
  const sexField =
    document.getElementById("sex");
  if (sexField) {
    // Store the raw Firebase value
    sexField.dataset.rawValue = student.sex;
    // Display translated value
    const displaySex = translateSex(student.sex);
    sexField.value = displaySex;

    console.log(
      "👤 Sex field filled:",
      "\n  raw value:", student.sex,
      "\n  displayed:", displaySex
    );
  }

  // Fill grade field
  setField("grade", student.grade);

  if (msgEl) {
    msgEl.textContent   = i("autoFillMsg");
    msgEl.style.display = "block";
  }

  console.log(
    "✅ Student validated:",
    "\n  ID:", student.studentId,
    "\n  Name:", student.fullName,
    "\n  Sex:", student.sex,
    "\n  Grade:", student.grade,
    "\n  locationVerified:", locationVerified
  );

  // ✅ FIXED: Use central function to check
  // all conditions and enable/disable button
  checkAndEnableSubmitButton();

  return true;
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function clearAutoFill() {
  setField("fullName", "");

  const sexField =
    document.getElementById("sex");
  if (sexField) {
    sexField.value = "";
    sexField.dataset.rawValue = "";
  }

  setField("grade", "");
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
// ✅ FIXED: SHOW DISTANCE RESULT
//
// CHANGE: Now calls checkAndEnableSubmitButton()
// instead of directly checking findStudent().
//
// This fixes the case where:
// - GPS finishes AFTER students load
// - The central function checks all conditions
// ================================================
function showDistanceResult(loc) {
  const box    =
    document.getElementById("distanceBox");
  const status =
    document.getElementById("distanceStatus");
  const icon   =
    document.getElementById("distanceIcon");
  const retry  =
    document.getElementById("retryLocationBtn");
  const locBox =
    document.getElementById("locationBox");

  const isNear = loc.distance <= MAX_DISTANCE;

  // ✅ Only one location message on screen
  // at a time — hide the "checking..." box
  // now that we have a result.
  if (locBox) locBox.style.display = "none";
  box.style.display = "flex";

  if (isNear) {
    icon.textContent      = "✅";
    status.textContent    = i("locationVerifiedMsg");
    status.style.color    = "#16a34a";
    box.style.background  = "#f0fdf4";
    box.style.borderColor = "#86efac";
    retry.style.display   = "none";
    locationVerified      = true;

    console.log(
      "📍 Location verified.",
      "Distance:", Math.round(loc.distance), "m"
    );
  } else {
    icon.textContent      = "❌";
    status.textContent    = i("locationTooFar");
    status.style.color    = "#dc2626";
    box.style.background  = "#fef2f2";
    box.style.borderColor = "#fca5a5";
    retry.style.display   = "block";
    locationVerified      = false;

    console.log(
      "📍 Location too far.",
      "Distance:", Math.round(loc.distance), "m"
    );
  }

  // ✅ FIXED: Use central function
  // This handles both cases:
  // GPS finishes before or after students load
  checkAndEnableSubmitButton();
}

// ================================================
// REQUEST LOCATION
// ================================================
function requestLocation() {
  const locStatus =
    document.getElementById("locationStatus");
  const locBox =
    document.getElementById("locationBox");
  const box   =
    document.getElementById("distanceBox");
  const retry =
    document.getElementById("retryLocationBtn");

  locationVerified    = false;
  studentLocation     = null;

  // Disable button while re-requesting location
  const submitBtn =
    document.getElementById("submitBtn");
  if (submitBtn) submitBtn.disabled = true;

  // ✅ Only one location message on screen
  // at a time — show the "checking..." box
  // and hide any previous result.
  box.style.display   = "none";
  retry.style.display = "none";
  if (locBox) locBox.style.display = "flex";
  if (locStatus) {
    locStatus.textContent = i("locating");
  }

  if (!navigator.geolocation) {
    if (locStatus) {
      locStatus.textContent =
        i("locationNotSupported");
    }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      const lat      = pos.coords.latitude;
      const lon      = pos.coords.longitude;
      const accuracy = pos.coords.accuracy;

      if (accuracy > MAX_ACCURACY) {
        if (locBox) locBox.style.display = "none";
        box.style.display     = "flex";
        box.style.background  = "#fef2f2";
        box.style.borderColor = "#fca5a5";
        document.getElementById("distanceIcon")
          .textContent = "❌";
        document.getElementById("distanceStatus")
          .textContent = i("locationPoorAccuracy");
        document.getElementById("distanceStatus")
          .style.color = "#dc2626";
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

      showDistanceResult(studentLocation);
    },

    function (err) {
      const msg =
        err.code === err.PERMISSION_DENIED
          ? i("locationDenied")
          : i("locationError");

      if (locBox) locBox.style.display = "none";
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

  function tick() {
    const d   = getRateData();
    const now = Date.now();
    if (!d.lockedUntil || now >= d.lockedUntil) {
      const b = document.getElementById(
        "rateLimitWarning"
      );
      if (b) b.remove();
      const fc =
        document.getElementById("formCard");
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
        `⏱ ${mins}:${
          String(secs).padStart(2, "0")
        }`;
    }
    setTimeout(tick, 1000);
  }
  tick();
}

// ================================================
// HANDLE SESSION CLOSED
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
    "checkoutCard",
    "modeBanner",
    "notCheckedInCard"
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
    if (msg) {
      msg.textContent = i("sessionEndedMsg");
    }
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

  const modeParam = params.get("mode");
  if (
    modeParam === "checkOut" ||
    modeParam === "checkIn"
  ) {
    qrMode = modeParam;
  } else {
    qrMode = "checkIn";
  }

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

    // Read time windows from Firebase
    checkInStartTime  =
      sessionData.checkInStartTime  || null;
    checkInEndTime    =
      sessionData.checkInEndTime    || null;
    checkOutStartTime =
      sessionData.checkOutStartTime || null;
    checkOutEndTime   =
      sessionData.checkOutEndTime   || null;

    if (isRateLimited()) {
      showRateLimitBox();
    }

    banner.style.display    = "flex";
    bannerIcon.textContent  = "🟢";
    bannerText.textContent  = i("sessionActive");
    banner.style.background = "#f0fdf4";
    banner.style.color      = "#16a34a";
    banner.style.border     = "1px solid #86efac";

    updateModeBanner();
    updateFormForMode();

    deviceToken = getOrCreateDeviceToken();
    startSessionListener();

    // ✅ NEW: If this device already has a
    // Firebase-verified attendance record for
    // THIS exact session (e.g. the student
    // refreshed the page after checking in),
    // restore the success screen instead of
    // showing the form again.
    const restored = await tryRestoreAttendanceState();
    if (restored) return;

    // Load students AND start location at same time
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
    msg.textContent    = message;
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
// FORMAT TIME
// ================================================
function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour:   "2-digit",
    minute: "2-digit"
  });
}

// ================================================
// TIME WINDOW CHECK
// ================================================
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  return parseInt(parts[0]) * 60 +
         parseInt(parts[1]);
}

function isWithinTimeWindow(startStr, endStr) {
  if (!startStr || !endStr) return true;

  const startMins = timeToMinutes(startStr);
  const endMins   = timeToMinutes(endStr);
  if (startMins === null || endMins === null) {
    return true;
  }

  const now     = new Date();
  const nowMins =
    now.getHours() * 60 + now.getMinutes();

  return nowMins >= startMins &&
         nowMins <= endMins;
}

// ================================================
// SHOW CHECKOUT CARD
// ================================================
function showCheckoutCard(
  studentName,
  checkInDisplay,
  checkOutDisplay,
  isCheckedOut
) {
  const formCard =
    document.getElementById("formCard");
  if (formCard) formCard.style.display = "none";

  const distBox =
    document.getElementById("distanceBox");
  const locBox =
    document.getElementById("locationBox");
  if (distBox) distBox.style.display = "none";
  if (locBox)  locBox.style.display  = "none";

  const card =
    document.getElementById("checkoutCard");
  if (!card) return;
  card.style.display = "block";

  const nameEl =
    document.getElementById("checkoutStudentName");
  if (nameEl) nameEl.textContent = studentName;

  const ciEl =
    document.getElementById("displayCheckInTime");
  if (ciEl) {
    ciEl.textContent = checkInDisplay || "--";
  }

  const coEl =
    document.getElementById("displayCheckOutTime");
  if (coEl) {
    coEl.textContent =
      checkOutDisplay || i("notCheckedOut");
  }

  const stEl =
    document.getElementById("displayStatus");
  if (stEl) {
    stEl.textContent = i("present");
    stEl.style.color = "#16a34a";
  }

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
// SHOW NOT CHECKED IN CARD
// ================================================
function showNotCheckedInCard() {
  const hideIds = [
    "formCard",
    "distanceBox",
    "locationBox",
    "checkoutCard",
    "successCard",
    "errorCard"
  ];
  hideIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const card =
    document.getElementById("notCheckedInCard");
  if (card) {
    const title =
      card.querySelector(
        "[data-i18n='notCheckedInTitle']"
      );
    const msg =
      card.querySelector(
        "[data-i18n='notCheckedInMsg']"
      );
    if (title) {
      title.textContent = i("notCheckedInTitle");
    }
    if (msg) {
      msg.textContent = i("notCheckedInMsg");
    }
    card.style.display = "block";
  }
}

// ================================================
// ✅ NEW: LOCAL ATTENDANCE STATE (refresh fix)
//
// PURPOSE:
// Only fixes the UI after an accidental page
// refresh/reload. It does NOT create or prove
// attendance by itself — Firebase Firestore is
// still the real source of truth.
//
// The key is scoped to the current sessionId,
// which already encodes today's date
// (e.g. "2026-08-21-AB12X9" — see
// generateSessionId() in teacher.html), so a
// saved state can never be mistaken for a
// different day's or a different session's
// attendance.
// ================================================
function saveAttendanceState(state) {
  try {
    const key = "attendanceState_" + sessionId;
    localStorage.setItem(key, JSON.stringify(state));
  } catch (err) {
    console.error(
      "Save attendance state error:", err
    );
  }
}

// Reads the locally saved state (if any) for
// THIS session, then verifies it against the
// real Firestore attendance record before
// trusting it. Only restores the success page
// if Firebase confirms the student is actually
// checked in. Returns true if it restored the
// UI, false otherwise (caller should continue
// with the normal form flow).
async function tryRestoreAttendanceState() {
  let saved = null;
  try {
    const raw = localStorage.getItem(
      "attendanceState_" + sessionId
    );
    if (raw) saved = JSON.parse(raw);
  } catch (err) {
    saved = null;
  }

  if (
    !saved ||
    saved.sessionId !== sessionId ||
    !saved.studentId
  ) {
    return false;
  }

  try {
    const recordRef = doc(
      db,
      "sessionAttendance",
      sessionId,
      "records",
      saved.studentId
    );
    const snap = await getDoc(recordRef);

    // ✅ Firebase is the real source of truth.
    // If the record doesn't exist, or was never
    // actually marked present, do NOT restore —
    // fall back to the normal attendance form.
    if (!snap.exists()) return false;
    const rd = snap.data();
    if (rd.status !== "present" || !rd.checkInTime) {
      return false;
    }

    currentStudentId  = saved.studentId;
    studentCheckedIn  = true;
    studentCheckedOut = !!rd.checkOutTime;

    showCheckoutCard(
      rd.fullName || saved.fullName || "",
      rd.checkInDisplay  || "--",
      rd.checkOutDisplay || null,
      !!rd.checkOutTime
    );

    // Keep the local copy in sync with the
    // verified Firebase values.
    saveAttendanceState({
      studentId:       saved.studentId,
      sessionId:       sessionId,
      date:
        (sessionData && sessionData.date) ||
        saved.date || null,
      fullName:        rd.fullName || saved.fullName || "",
      checkInDisplay:  rd.checkInDisplay  || null,
      checkOutDisplay: rd.checkOutDisplay || null,
      checkedIn:       true,
      checkedOut:      !!rd.checkOutTime
    });

    return true;

  } catch (err) {
    console.error(
      "Restore attendance state error:", err
    );
    return false;
  }
}

// ================================================
// SUBMIT ATTENDANCE
// ================================================
async function submitAttendance(e) {
  e.preventDefault();

  if (isRateLimited()) {
    showRateLimitBox();
    return;
  }

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
    checkAndEnableSubmitButton();
    return;
  }

  // Time window check
  if (qrMode === "checkOut") {
    if (!isWithinTimeWindow(
      checkOutStartTime,
      checkOutEndTime
    )) {
      showError(i("errCheckOutClosed"));
      return;
    }
  } else {
    if (!isWithinTimeWindow(
      checkInStartTime,
      checkInEndTime
    )) {
      showError(i("errCheckInClosed"));
      return;
    }
  }

  const studentIdVal = normalizeId(
    document.getElementById("studentId").value
  );
  const student  = findStudent(studentIdVal);
  const nameVal  = student?.fullName || "";
  const sexVal   = student?.sex      || "";
  const gradeVal = student?.grade    || "";

  const overlay =
    document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "flex";

  if (qrMode === "checkOut") {
    await handleCheckOutSubmit(
      studentIdVal,
      nameVal,
      sexVal,
      gradeVal,
      dist,
      overlay
    );
  } else {
    await handleCheckInSubmit(
      studentIdVal,
      nameVal,
      sexVal,
      gradeVal,
      dist,
      overlay
    );
  }
}

// ================================================
// HANDLE CHECK-IN SUBMIT
// ================================================
async function handleCheckInSubmit(
  studentIdVal,
  nameVal,
  sexVal,
  gradeVal,
  dist,
  overlay
) {
  try {
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

    let alreadyUsedByOther = false;
    let alreadyCheckedIn   = false;

    await runTransaction(db, async (tx) => {
      const deviceSnap =
        await tx.get(deviceLogRef);
      const recordSnap =
        await tx.get(recordRef);

      if (deviceSnap.exists()) {
        const dl = deviceSnap.data();
        if (dl.studentId !== studentIdVal) {
          alreadyUsedByOther = true;
          return;
        }
      }

      if (!recordSnap.exists()) {
        return;
      }

      const rd = recordSnap.data();
      if (rd.status === "present") {
        alreadyCheckedIn = true;
        return;
      }

      const now         = new Date();
      const checkInTime = now.toISOString();
      const display     = formatTime(now);
      const checkDate   =
        now.toLocaleDateString("en-CA");

      // Store the raw English sex value
      // in Firebase (not translated Khmer)
      const data = {
        fullName:           nameVal,
        sex:                sexVal,
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

      tx.set(deviceLogRef, {
        deviceToken: deviceToken,
        studentId:   studentIdVal,
        sessionId:   sessionId,
        usedAt:      checkInTime
      });

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

    // ✅ NEW: remember this so a page refresh
    // restores this same success screen
    saveAttendanceState({
      studentId:       studentIdVal,
      sessionId:       sessionId,
      date:
        (sessionData && sessionData.date) ||
        new Date().toLocaleDateString("en-CA"),
      fullName:        nameVal,
      checkInDisplay:  formatTime(now),
      checkOutDisplay: null,
      checkedIn:       true,
      checkedOut:      false
    });

  } catch (err) {
    console.error("Check-in error:", err);
    if (overlay) overlay.style.display = "none";
    showError(err.message);
  }
}

// ================================================
// HANDLE CHECK-OUT SUBMIT
// ================================================
async function handleCheckOutSubmit(
  studentIdVal,
  nameVal,
  sexVal,
  gradeVal,
  dist,
  overlay
) {
  try {
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

    const recordRef = doc(
      db,
      "sessionAttendance",
      sessionId,
      "records",
      studentIdVal
    );

    const recordSnap = await getDoc(recordRef);

    if (overlay) overlay.style.display = "none";

    if (!recordSnap.exists()) {
      showNotCheckedInCard();
      return;
    }

    const rd = recordSnap.data();

    if (
      !rd.checkInTime ||
      rd.status !== "present"
    ) {
      showNotCheckedInCard();
      return;
    }

    if (rd.checkOutTime) {
      showCheckoutCard(
        rd.fullName || nameVal,
        rd.checkInDisplay || "--",
        rd.checkOutDisplay || "--",
        true
      );
      // ✅ NEW: keep local state in sync
      saveAttendanceState({
        studentId:       studentIdVal,
        sessionId:       sessionId,
        date:
          (sessionData && sessionData.date) ||
          new Date().toLocaleDateString("en-CA"),
        fullName:        rd.fullName || nameVal,
        checkInDisplay:  rd.checkInDisplay  || "--",
        checkOutDisplay: rd.checkOutDisplay || "--",
        checkedIn:       true,
        checkedOut:      true
      });
      return;
    }

    if (overlay) overlay.style.display = "flex";

    navigator.geolocation.getCurrentPosition(
      async function (pos) {
        const freshLat  = pos.coords.latitude;
        const freshLon  = pos.coords.longitude;
        const freshDist = haversineDistance(
          freshLat, freshLon,
          SCHOOL_LAT, SCHOOL_LON
        );

        if (freshDist > MAX_DISTANCE) {
          if (overlay) {
            overlay.style.display = "none";
          }
          showError(i("errCheckOutLocation"));
          return;
        }

        try {
          const now             = new Date();
          const checkOutISO     = now.toISOString();
          const checkOutDisplay = formatTime(now);

          await updateDoc(recordRef, {
            checkOutTime:    checkOutISO,
            checkOutDisplay: checkOutDisplay,
            checkOutLat:     freshLat,
            checkOutLon:     freshLon,
            checkOutDist:    freshDist
          });

          if (overlay) {
            overlay.style.display = "none";
          }

          currentStudentId  = studentIdVal;
          studentCheckedIn  = true;
          studentCheckedOut = true;

          showCheckoutCard(
            rd.fullName || nameVal,
            rd.checkInDisplay || "--",
            checkOutDisplay,
            true
          );

          // ✅ NEW: remember the completed
          // checkout so a refresh restores it
          saveAttendanceState({
            studentId:       studentIdVal,
            sessionId:       sessionId,
            date:
              (sessionData && sessionData.date) ||
              new Date().toLocaleDateString("en-CA"),
            fullName:        rd.fullName || nameVal,
            checkInDisplay:  rd.checkInDisplay || "--",
            checkOutDisplay: checkOutDisplay,
            checkedIn:       true,
            checkedOut:      true
          });

        } catch (err) {
          console.error(
            "Check-out save error:", err
          );
          if (overlay) {
            overlay.style.display = "none";
          }
          showError(err.message);
        }
      },

      function (err) {
        if (overlay) {
          overlay.style.display = "none";
        }
        showError(i("locationError"));
      },

      {
        enableHighAccuracy: true,
        timeout:            10000,
        maximumAge:         0
      }
    );

  } catch (err) {
    console.error("Check-out submit error:", err);
    if (overlay) overlay.style.display = "none";
    showError(err.message);
  }
}

// ================================================
// CHECK OUT BUTTON HANDLER
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

  if (!isWithinTimeWindow(
    checkOutStartTime,
    checkOutEndTime
  )) {
    showError(i("errCheckOutClosed"));
    return;
  }

  const overlay =
    document.getElementById("loadingOverlay");
  const loadingText =
    document.querySelector(".loading-text");

  if (overlay) overlay.style.display = "flex";
  if (loadingText) {
    loadingText.textContent = i("checkingOut");
  }

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

        const recordSnap =
          await getDoc(recordRef);
        if (!recordSnap.exists()) {
          if (overlay) {
            overlay.style.display = "none";
          }
          showError(
            "Attendance record not found."
          );
          return;
        }

        const rd = recordSnap.data();

        if (rd.checkOutTime) {
          if (overlay) {
            overlay.style.display = "none";
          }
          studentCheckedOut = true;
          showError(i("errAlreadyCheckedOut"));
          return;
        }

        const now             = new Date();
        const checkOutISO     = now.toISOString();
        const checkOutDisplay = formatTime(now);

        await updateDoc(recordRef, {
          checkOutTime:    checkOutISO,
          checkOutDisplay: checkOutDisplay,
          checkOutLat:     lat,
          checkOutLon:     lon,
          checkOutDist:    dist
        });

        studentCheckedOut = true;

        if (overlay) {
          overlay.style.display = "none";
        }
        if (loadingText) {
          loadingText.textContent = i("savingText");
        }

        const coEl = document.getElementById(
          "displayCheckOutTime"
        );
        if (coEl) {
          coEl.textContent = checkOutDisplay;
        }

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

        // ✅ NEW: remember the completed
        // checkout so a refresh restores it
        const nameElNow = document.getElementById(
          "checkoutStudentName"
        );
        const ciElNow = document.getElementById(
          "displayCheckInTime"
        );
        saveAttendanceState({
          studentId:       currentStudentId,
          sessionId:       sessionId,
          date:
            (sessionData && sessionData.date) ||
            new Date().toLocaleDateString("en-CA"),
          fullName:
            nameElNow?.textContent || "",
          checkInDisplay:
            ciElNow?.textContent || null,
          checkOutDisplay: checkOutDisplay,
          checkedIn:       true,
          checkedOut:      true
        });

      } catch (err) {
        console.error("Check-out error:", err);
        if (overlay) {
          overlay.style.display = "none";
        }
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
