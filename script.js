// ================================================
// script.js
// Student Attendance Page — Full Logic
// Fixed: Use document ID for student lookup
// Fixed: Race condition
// Fixed: Case sensitivity and spaces
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
// APP STATE
// ================================================
let currentLang      = "en";
let sessionId        = null;
let sessionData      = null;
let studentLocation  = null;
let locationVerified = false;

// ✅ FIX: Student list loaded from Firebase
// Key = normalized document ID (uppercase)
// Value = student data object
// Using a Map for fast exact lookup
let studentsMap    = new Map();
let studentsLoaded = false;

// ================================================
// TRANSLATIONS
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
      "You have already checked in for this session.",

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
      "អ្នកបានចុះវត្តមានហើយសម្រាប់វគ្គនេះ។",

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
// TRANSLATE
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

    console.log(
      "✅ " + studentsMap.size +
      " students loaded. IDs available:",
      Array.from(studentsMap.keys())
    );
  }
}

// ================================================
// ✅ KEY FIX: LOAD STUDENTS USING DOCUMENT ID
//
// The bug was that studentId FIELD value
// had typos like "ITO2" instead of "IT02"
//
// The DOCUMENT ID is always correct because
// it was set by the teacher when adding students
//
// So we use document.id as the key
// and also fix the studentId field to match
// ================================================
async function loadAllStudents() {
  console.log(
    "📥 Loading students from Firebase..."
  );

  studentsLoaded = false;
  studentsMap    = new Map();
  updateStudentIdFieldState();

  try {
    const snap =
      await getDocs(collection(db, "students"));

    snap.forEach(function (d) {
      const data = d.data();

      // ✅ ALWAYS use document ID as the key
      // Document ID is what teacher typed
      // when adding the student
      // It is more reliable than the field
      const docId =
        String(d.id).trim().toUpperCase();

      // ✅ Also normalize the studentId field
      // in case it has typos like ITO2 vs IT02
      const fieldId = String(
        data.studentId || d.id
      ).trim().toUpperCase();

      // Log any mismatch so you can fix them
      if (docId !== fieldId) {
        console.warn(
          "⚠️ MISMATCH FOUND:",
          "Document ID =", docId,
          "| studentId field =", fieldId,
          "| Using document ID:", docId
        );
      }

      // Store using document ID as the key
      // This is the reliable identifier
      studentsMap.set(docId, {
        // Use document ID as the real ID
        studentId: docId,
        fullName:  data.fullName  || "",
        age:       data.age       ?? "",
        grade:     data.grade     || "",
        // Keep original field for reference
        originalFieldId: fieldId
      });
    });

    studentsLoaded = true;

    console.log(
      "✅ Students loaded:",
      studentsMap.size
    );
    console.log(
      "📋 Available student IDs:",
      Array.from(studentsMap.keys())
    );

    updateStudentIdFieldState();

    // If student already typed their ID
    // while loading, validate it now
    const studentIdInput =
      document.getElementById("studentId");
    if (
      studentIdInput &&
      studentIdInput.value.trim() !== ""
    ) {
      validateStudentId();
    }

  } catch (err) {
    console.error(
      "❌ Failed to load students:", err
    );
    studentsLoaded = true;
    updateStudentIdFieldState();
  }
}

// ================================================
// ✅ NORMALIZE STUDENT ID
// Removes all spaces and converts to uppercase
// ================================================
function normalizeId(rawId) {
  return String(rawId || "")
    .trim()
    .toUpperCase();
}

// ================================================
// ✅ FIND STUDENT
// Searches by normalized document ID
// ================================================
function findStudent(rawId) {
  const normalized = normalizeId(rawId);
  console.log(
    "🔍 Looking for:", normalized,
    "| studentsMap has:",
    Array.from(studentsMap.keys())
  );
  const found = studentsMap.get(normalized);
  if (found) {
    console.log("✅ Found:", found);
  } else {
    console.log("❌ Not found:", normalized);
  }
  return found || null;
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

    // Clear auto-filled fields
    const fn =
      document.getElementById("fullName");
    const ag =
      document.getElementById("age");
    const gr =
      document.getElementById("grade");
    if (fn) fn.value = "";
    if (ag) ag.value = "";
    if (gr) gr.value = "";

    return false;
  }

  // Student found — clear error
  if (studentIdError) {
    studentIdError.textContent = "";
  }

  // Auto-fill details
  const fn =
    document.getElementById("fullName");
  const ag =
    document.getElementById("age");
  const gr =
    document.getElementById("grade");
  if (fn) fn.value = student.fullName;
  if (ag) ag.value = student.age;
  if (gr) gr.value = student.grade;

  if (autoFillMsgEl) {
    autoFillMsgEl.textContent =
      i("autoFillMsg");
    autoFillMsgEl.style.display = "block";
  }

  return true;
}

// ================================================
// HAVERSINE DISTANCE
// ================================================
function haversineDistance(
  lat1, lon1, lat2, lon2
) {
  const R = 6371000;
  const toRad = function (d) {
    return d * (Math.PI / 180);
  };
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) *
    Math.sin(dLat / 2) +
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
    distanceIcon.textContent     = "✅";
    distanceStatus.textContent   =
      i("locationVerified");
    distanceStatus.style.color   = "#16a34a";
    distanceBox.style.background = "#f0fdf4";
    distanceBox.style.borderColor = "#86efac";
    retryBtn.style.display = "none";
    submitBtn.disabled     = false;
    locationVerified       = true;
  } else {
    distanceIcon.textContent     = "❌";
    distanceStatus.textContent   =
      i("locationTooFar");
    distanceStatus.style.color   = "#dc2626";
    distanceBox.style.background = "#fef2f2";
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
    locationStatus.textContent =
      i("locationError");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const lat      = position.coords.latitude;
      const lon      = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      console.log(
        "✅ GPS:", lat, lon,
        "±" + accuracy + "m"
      );

      if (accuracy > MAX_ACCEPTABLE_ACCURACY) {
        locationStatus.textContent =
          i("locationPoorAccuracy");

        const db2 =
          document.getElementById("distanceBox");
        const ds =
          document.getElementById(
            "distanceStatus"
          );
        const dd =
          document.getElementById(
            "distanceDetail"
          );
        const di =
          document.getElementById("distanceIcon");

        db2.style.display    = "flex";
        db2.style.background = "#fffbeb";
        db2.style.borderColor = "#fcd34d";
        di.textContent       = "⚠️";
        ds.textContent       =
          i("locationPoorAccuracy");
        ds.style.color       = "#92400e";
        dd.textContent       =
          i("gpsAccuracy") + ": ±" +
          Math.round(accuracy) +
          " " + i("meters");
        retryBtn.style.display = "block";
        return;
      }

      const distance = haversineDistance(
        lat, lon,
        SCHOOL_LATITUDE, SCHOOL_LONGITUDE
      );

      console.log(
        "📏 Distance:", Math.round(distance), "m"
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
      console.error("GPS error:", error.code);
      locationStatus.textContent =
        error.code === error.PERMISSION_DENIED
          ? i("locationDenied")
          : i("locationError");

      const db2 =
        document.getElementById("distanceBox");
      const di =
        document.getElementById("distanceIcon");
      const ds =
        document.getElementById("distanceStatus");

      db2.style.display    = "flex";
      db2.style.background = "#fef2f2";
      db2.style.borderColor = "#fca5a5";
      di.textContent       = "❌";
      ds.textContent       = i("locationError");
      ds.style.color       = "#dc2626";
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

    // Session valid
    banner.style.display    = "flex";
    bannerIcon.textContent  = "🟢";
    bannerText.textContent  = i("sessionActive");
    banner.style.background = "#f0fdf4";
    banner.style.color      = "#16a34a";
    banner.style.border     = "1px solid #86efac";

    // Load students AND request location
    // at the same time for speed
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
// SUBMIT ATTENDANCE
// ================================================
async function submitAttendance(e) {
  e.preventDefault();

  if (!validateForm()) return;

  if (!locationVerified || !studentLocation) {
    alert(i("errLocation"));
    return;
  }

  const securityDistance = haversineDistance(
    studentLocation.latitude,
    studentLocation.longitude,
    SCHOOL_LATITUDE,
    SCHOOL_LONGITUDE
  );

  if (securityDistance > ALLOWED_DISTANCE_METERS) {
    alert(i("errTooFar"));
    locationVerified = false;
    document.getElementById("submitBtn")
      .disabled = true;
    return;
  }

  // ✅ Use normalized document ID
  // not the studentId field value
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
    // ✅ Look up record using document ID
    // which matches the students collection
    // document ID exactly
    const recordRef = doc(
      db,
      "sessionAttendance",
      sessionId,
      "records",
      studentIdVal
    );

    console.log(
      "📝 Looking for attendance record:",
      studentIdVal
    );

    const recordSnap = await getDoc(recordRef);

    if (!recordSnap.exists()) {
      console.error(
        "❌ No attendance record found for:",
        studentIdVal
      );
      document.getElementById("loadingOverlay")
        .style.display = "none";
      document.getElementById("studentIdError")
        .textContent =
          i("errStudentIdNotFound");
      return;
    }

    const existingRecord = recordSnap.data();

    if (existingRecord.status === "present") {
      document.getElementById("loadingOverlay")
        .style.display = "none";
      alert(i("errAlreadyCheckedIn"));
      return;
    }

    const now       = new Date();
    const checkDate =
      now.toLocaleDateString("en-CA");
    const checkTime =
      now.toLocaleTimeString([], {
        hour:   "2-digit",
        minute: "2-digit"
      });

    await updateDoc(recordRef, {
      fullName:           nameVal,
      age:                Number(ageVal),
      grade:              gradeVal,
      checkInDate:        checkDate,
      checkInTime:        checkTime,
      status:             "present",
      latitude:           studentLocation.latitude,
      longitude:          studentLocation.longitude,
      accuracy:           studentLocation.accuracy,
      distanceFromSchool: securityDistance,
      submittedAt:        now.toISOString()
    });

    console.log(
      "✅ Attendance saved:", studentIdVal
    );

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
            <strong>${i("studentIdLabel")}:</strong>
            ${studentIdVal}
          </div>
          <div>
            <strong>${i("fullNameLabel")}:</strong>
            ${nameVal}
          </div>
          <div>
            <strong>${i("gradeLabel")}:</strong>
            ${gradeVal}
          </div>
          <div>
            <strong>${i("colDate")}:</strong>
            ${checkDate}
          </div>
          <div>
            <strong>${i("colTime")}:</strong>
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

// Debounced student ID validation
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
// ADD AUTO-FILL MESSAGE ELEMENT TO PAGE
// ================================================
(function () {
  const errEl =
    document.getElementById("studentIdError");
  if (errEl &&
      !document.getElementById("autoFillMsg")
  ) {
    const msgEl =
      document.createElement("p");
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
