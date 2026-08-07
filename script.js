// ================================================
// script.js
// Student Attendance Page — Full Logic
// Fixed: Race condition, case sensitivity,
// spaces, auto-fill, loading state
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
// SCHOOL LOCATION CONSTANTS
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

// ✅ FIX: Track whether Firebase has
// finished loading the student list
let studentsLoaded   = false;
let allStudents      = [];

// ================================================
// TRANSLATIONS
// ================================================
const i18n = {
  en: {
    title:    "QR Attendance System",
    subtitle: "Tepranom High School",

    // Session
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

    // Location
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

    // ✅ NEW: Student data loading
    loadingStudents:
      "Loading student data...",
    studentsReady:
      "Student data loaded. You can now enter your Student ID.",

    // Form labels
    studentIdLabel:
      "Student ID",
    studentIdPlaceholder:
      "Enter your Student ID (e.g. STU001)",
    fullNameLabel:
      "Full Name",
    fullNamePlaceholder:
      "Enter your full name",
    ageLabel:
      "Age",
    agePlaceholder:
      "Enter your age",
    gradeLabel:
      "Grade / Class",
    gradePlaceholder:
      "Enter your grade or class",
    formTitle:
      "📋 Mark Your Attendance",
    submitButton:
      "✅ Submit Attendance",

    // Validation errors
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

    // Auto-fill message
    autoFillMsg:
      "✅ Student found. Details filled automatically.",

    // Success
    successTitle:
      "Attendance Marked!",
    successMessage:
      "Your attendance has been recorded successfully.",

    // Loading
    savingText:
      "Saving your attendance...",

    // Footer
    footerSecurity:
      "🔒 Your location is only used to verify attendance.",
    footerSchool:
      "Tepranom High School Attendance System",

    // Status
    notCheckedInYet: "Not Checked In Yet",
    present:         "Present",

    // Table columns used in success details
    colDate: "Date",
    colTime: "Time"
  },

  km: {
    title:    "ប្រព័ន្ធចុះវត្តមាន QR",
    subtitle: "វិទ្យាល័យទេពប្រណម្យ",

    // Session
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

    // Location
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

    // ✅ NEW: Student data loading
    loadingStudents:
      "កំពុងផ្ទុកទិន្នន័យសិស្ស...",
    studentsReady:
      "ទិន្នន័យសិស្សបានផ្ទុករួច។ អ្នកអាចបញ្ចូលលេខសម្គាល់សិស្សបាន។",

    // Form labels
    studentIdLabel:
      "លេខសម្គាល់សិស្ស",
    studentIdPlaceholder:
      "បញ្ចូលលេខសម្គាល់សិស្ស (ឧ. STU001)",
    fullNameLabel:
      "ឈ្មោះពេញ",
    fullNamePlaceholder:
      "បញ្ចូលឈ្មោះពេញ",
    ageLabel:
      "អាយុ",
    agePlaceholder:
      "បញ្ចូលអាយុ",
    gradeLabel:
      "ថ្នាក់រៀន",
    gradePlaceholder:
      "បញ្ចូលថ្នាក់រៀន",
    formTitle:
      "📋 ចុះវត្តមានរបស់អ្នក",
    submitButton:
      "✅ ដាក់ស្នើវត្តមាន",

    // Validation
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

    // Auto-fill message
    autoFillMsg:
      "✅ រកឃើញសិស្ស។ ព័ត៌មានត្រូវបានបំពេញដោយស្វ័យប្រវត្តិ។",

    // Success
    successTitle:
      "វត្តមានត្រូវបានកត់ត្រា!",
    successMessage:
      "វត្តមានរបស់អ្នកត្រូវបានរក្សាទុកដោយជោគជ័យ។",

    // Loading
    savingText:
      "កំពុងរក្សាទុកវត្តមាន...",

    // Footer
    footerSecurity:
      "🔒 ទីតាំងរបស់អ្នកត្រូវបានប្រើតែសម្រាប់ផ្ទៀងផ្ទាត់វត្តមានប៉ុណ្ណោះ។",
    footerSchool:
      "ប្រព័ន្ធវត្តមានវិទ្យាល័យទេពប្រណម្យ",

    // Status
    notCheckedInYet: "មិនទាន់ចុះវត្តមាន",
    present:         "មានវត្តមាន",

    // Table columns
    colDate: "កាលបរិច្ឆេទ",
    colTime: "ម៉ោង"
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

  // Translate data-i18n elements
  document.querySelectorAll("[data-i18n]")
    .forEach(function (el) {
      const key = el.getAttribute("data-i18n");
      const val = i(key);
      if (val !== key) el.textContent = val;
    });

  // Translate placeholders
  document.querySelectorAll(
    "[data-i18n-placeholder]"
  ).forEach(function (el) {
    const key =
      el.getAttribute("data-i18n-placeholder");
    const val = i(key);
    if (val !== key) el.placeholder = val;
  });

  // Language button
  const langBtn =
    document.getElementById("languageButton");
  if (langBtn) {
    langBtn.textContent =
      lang === "en" ? "ខ្មែរ" : "English";
  }

  // Retry button
  const retryBtn =
    document.getElementById("retryLocationBtn");
  if (retryBtn) {
    retryBtn.textContent = i("retryLocation");
  }

  // Refresh distance display if we have
  // a location already
  if (studentLocation) {
    showDistanceResult(studentLocation);
  }

  // Update student ID field placeholder
  // based on loading state
  updateStudentIdFieldState();
}

// ================================================
// ✅ FIX: STUDENT ID FIELD STATE MANAGER
// Controls whether the field is enabled
// and what placeholder text shows
// ================================================
function updateStudentIdFieldState() {
  const studentIdInput =
    document.getElementById("studentId");
  const studentIdError =
    document.getElementById("studentIdError");

  if (!studentIdInput) return;

  if (!studentsLoaded) {
    // Firebase still loading
    // Disable the field and show loading text
    studentIdInput.disabled    = true;
    studentIdInput.placeholder =
      i("loadingStudents");
    studentIdInput.style.background = "#f1f5f9";
    studentIdInput.style.cursor     = "wait";
    studentIdInput.style.color      = "#94a3b8";

    console.log(
      "⏳ Student ID field disabled" +
      " — waiting for Firebase"
    );

  } else {
    // Firebase finished loading
    // Enable the field
    studentIdInput.disabled    = false;
    studentIdInput.placeholder =
      i("studentIdPlaceholder");
    studentIdInput.style.background = "";
    studentIdInput.style.cursor     = "";
    studentIdInput.style.color      = "";

    console.log(
      "✅ Student ID field enabled" +
      " — " + allStudents.length +
      " students loaded"
    );
  }
}

// ================================================
// ✅ FIX: LOAD ALL STUDENTS FROM FIREBASE
// Must complete before student ID validation
// ================================================
async function loadAllStudents() {
  console.log(
    "📥 Loading student list from Firebase..."
  );

  // Show loading state on student ID field
  studentsLoaded = false;
  updateStudentIdFieldState();

  try {
    const snap =
      await getDocs(collection(db, "students"));

    allStudents = [];

    snap.forEach(function (d) {
      const data = d.data();
      allStudents.push({
        // ✅ FIX: Store normalized ID
        // so comparison is always consistent
        studentId: String(
          data.studentId || d.id
        ).trim().toUpperCase(),
        fullName:  data.fullName  || "",
        age:       data.age       ?? "",
        grade:     data.grade     || ""
      });
    });

    studentsLoaded = true;

    console.log(
      "✅ Students loaded successfully:",
      allStudents.length,
      "students"
    );
    console.log(
      "📋 Student IDs in database:",
      allStudents.map(function (s) {
        return s.studentId;
      })
    );

    // Enable the student ID field
    updateStudentIdFieldState();

    // ✅ FIX: If student already typed their
    // ID while Firebase was loading,
    // validate it now that data is ready
    const studentIdInput =
      document.getElementById("studentId");
    if (
      studentIdInput &&
      studentIdInput.value.trim() !== ""
    ) {
      console.log(
        "🔄 Student typed ID before load" +
        " completed. Validating now..."
      );
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
// ✅ FIX: NORMALIZE STUDENT ID
// Removes spaces and converts to uppercase
// So IT15, it15, It15, " IT15 " all match
// ================================================
function normalizeStudentId(rawId) {
  return String(rawId || "")
    .trim()
    .toUpperCase();
}

// ================================================
// ✅ FIX: FIND STUDENT BY ID
// Uses normalized comparison
// ================================================
function findStudentById(rawId) {
  const normalizedInput =
    normalizeStudentId(rawId);

  console.log(
    "🔍 Searching for student ID:",
    normalizedInput
  );
  console.log(
    "📋 Available students:",
    allStudents.map(function (s) {
      return s.studentId;
    })
  );

  const found = allStudents.find(
    function (student) {
      // Both sides are already normalized
      // in loadAllStudents so this is safe
      return student.studentId ===
        normalizedInput;
    }
  );

  if (found) {
    console.log("✅ Student found:", found);
  } else {
    console.log(
      "❌ Student not found for ID:",
      normalizedInput
    );
  }

  return found || null;
}

// ================================================
// ✅ FIX: VALIDATE STUDENT ID
// Only runs after Firebase has loaded
// Auto-fills name, age, grade if found
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

  // ✅ FIX: Do not validate while loading
  if (!studentsLoaded) {
    console.log(
      "⏳ Skipping validation" +
      " — students not loaded yet"
    );
    if (studentIdError) {
      studentIdError.textContent =
        i("errStudentIdLoading");
    }
    return false;
  }

  // Empty check
  if (!rawId.trim()) {
    if (studentIdError) {
      studentIdError.textContent =
        i("errStudentId");
    }
    if (autoFillMsgEl) {
      autoFillMsgEl.textContent = "";
      autoFillMsgEl.style.display = "none";
    }
    return false;
  }

  // Find the student
  const student = findStudentById(rawId);

  if (!student) {
    // Student not found
    if (studentIdError) {
      studentIdError.textContent =
        i("errStudentIdNotFound");
    }
    if (autoFillMsgEl) {
      autoFillMsgEl.textContent = "";
      autoFillMsgEl.style.display = "none";
    }

    // Clear auto-filled fields
    const fullNameInput =
      document.getElementById("fullName");
    const ageInput =
      document.getElementById("age");
    const gradeInput =
      document.getElementById("grade");

    if (fullNameInput) fullNameInput.value = "";
    if (ageInput)      ageInput.value      = "";
    if (gradeInput)    gradeInput.value    = "";

    return false;
  }

  // ✅ Student found — clear error
  if (studentIdError) {
    studentIdError.textContent = "";
  }

  // ✅ AUTO-FILL student details
  const fullNameInput =
    document.getElementById("fullName");
  const ageInput =
    document.getElementById("age");
  const gradeInput =
    document.getElementById("grade");

  if (fullNameInput) {
    fullNameInput.value = student.fullName;
  }
  if (ageInput) {
    ageInput.value = student.age;
  }
  if (gradeInput) {
    gradeInput.value = student.grade;
  }

  // Show auto-fill success message
  if (autoFillMsgEl) {
    autoFillMsgEl.textContent =
      i("autoFillMsg");
    autoFillMsgEl.style.display = "block";
  }

  console.log(
    "✅ Auto-filled details for:",
    student.fullName
  );

  return true;
}

// ================================================
// HAVERSINE FORMULA
// Calculates real distance in meters
// ================================================
function haversineDistance(
  lat1, lon1, lat2, lon2
) {
  const R = 6371000;
  const toRad = function (deg) {
    return deg * (Math.PI / 180);
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

  const c = 2 * Math.atan2(
    Math.sqrt(a), Math.sqrt(1 - a)
  );

  return R * c;
}

// ================================================
// SHOW DISTANCE RESULT
// ================================================
function showDistanceResult(locationResult) {
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

  const distance =
    locationResult.distance;
  const accuracy =
    locationResult.accuracy;
  const isNear =
    distance <= ALLOWED_DISTANCE_METERS;

  distanceBox.style.display = "flex";

  distanceDetail.textContent =
    i("distanceFromSchool") + ": " +
    Math.round(distance) +
    " " + i("meters") +
    " | " + i("gpsAccuracy") + ": ±" +
    Math.round(accuracy) +
    " " + i("meters");

  if (isNear) {
    distanceIcon.textContent    = "✅";
    distanceStatus.textContent  =
      i("locationVerified");
    distanceStatus.style.color  = "#16a34a";
    distanceBox.style.background =
      "#f0fdf4";
    distanceBox.style.borderColor =
      "#86efac";
    retryBtn.style.display  = "none";
    submitBtn.disabled       = false;
    locationVerified         = true;
  } else {
    distanceIcon.textContent    = "❌";
    distanceStatus.textContent  =
      i("locationTooFar");
    distanceStatus.style.color  = "#dc2626";
    distanceBox.style.background =
      "#fef2f2";
    distanceBox.style.borderColor =
      "#fca5a5";
    retryBtn.style.display  = "block";
    submitBtn.disabled       = true;
    locationVerified         = false;
  }
}

// ================================================
// REQUEST STUDENT LOCATION
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

  // Reset state
  locationVerified = false;
  studentLocation  = null;
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
    // SUCCESS
    function (position) {
      const lat      =
        position.coords.latitude;
      const lon      =
        position.coords.longitude;
      const accuracy =
        position.coords.accuracy;

      console.log(
        "✅ GPS location received:",
        lat, lon,
        "accuracy:", accuracy, "m"
      );

      // Poor accuracy warning
      if (accuracy > MAX_ACCEPTABLE_ACCURACY) {
        locationStatus.textContent =
          i("locationPoorAccuracy");

        const distanceBox =
          document.getElementById(
            "distanceBox"
          );
        const distanceStatus =
          document.getElementById(
            "distanceStatus"
          );
        const distanceDetail =
          document.getElementById(
            "distanceDetail"
          );
        const distanceIcon =
          document.getElementById(
            "distanceIcon"
          );

        distanceBox.style.display   = "flex";
        distanceBox.style.background =
          "#fffbeb";
        distanceBox.style.borderColor =
          "#fcd34d";
        distanceIcon.textContent    = "⚠️";
        distanceStatus.textContent  =
          i("locationPoorAccuracy");
        distanceStatus.style.color  = "#92400e";
        distanceDetail.textContent  =
          i("gpsAccuracy") + ": ±" +
          Math.round(accuracy) +
          " " + i("meters");
        retryBtn.style.display = "block";
        return;
      }

      // Calculate distance using Haversine
      const distance = haversineDistance(
        lat, lon,
        SCHOOL_LATITUDE,
        SCHOOL_LONGITUDE
      );

      console.log(
        "📏 Distance from school:",
        Math.round(distance), "m"
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

    // ERROR
    function (error) {
      console.error("GPS error:", error);

      if (error.code ===
          error.PERMISSION_DENIED) {
        locationStatus.textContent =
          i("locationDenied");
      } else {
        locationStatus.textContent =
          i("locationError");
      }

      const distanceBox =
        document.getElementById("distanceBox");
      const distanceIcon =
        document.getElementById("distanceIcon");
      const distanceStatus =
        document.getElementById("distanceStatus");
      const retryBtn =
        document.getElementById(
          "retryLocationBtn"
        );

      distanceBox.style.display   = "flex";
      distanceBox.style.background = "#fef2f2";
      distanceBox.style.borderColor = "#fca5a5";
      distanceIcon.textContent    = "❌";
      distanceStatus.textContent  =
        i("locationError");
      distanceStatus.style.color  = "#dc2626";
      retryBtn.style.display = "block";
    },

    // GPS OPTIONS
    {
      enableHighAccuracy: true,
      timeout:            15000,
      maximumAge:         0
    }
  );
}

// ================================================
// LOAD SESSION FROM FIREBASE
// ================================================
async function loadSession() {
  const urlParams =
    new URLSearchParams(
      window.location.search
    );
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
    document.getElementById(
      "sessionClosedCard"
    );

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

    // Session is valid
    banner.style.display    = "flex";
    bannerIcon.textContent  = "🟢";
    bannerText.textContent  = i("sessionActive");
    banner.style.background = "#f0fdf4";
    banner.style.color      = "#16a34a";
    banner.style.border     =
      "1px solid #86efac";

    // ✅ Load students first, then request
    // location at the same time
    // Both run in parallel for speed
    await Promise.all([
      loadAllStudents(),
      new Promise(function (resolve) {
        requestLocation();
        resolve();
      })
    ]);

  } catch (error) {
    console.error(
      "Load session error:", error
    );
    formCard.style.display   = "none";
    closedCard.style.display = "block";
  }
}

// ================================================
// VALIDATE FORM
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
    document.getElementById("age")
      .value.trim();
  const gradeVal =
    document.getElementById("grade")
      .value.trim();

  // Clear old errors
  document.getElementById("studentIdError")
    .textContent = "";
  document.getElementById("nameError")
    .textContent = "";
  document.getElementById("ageError")
    .textContent = "";
  document.getElementById("gradeError")
    .textContent = "";

  // ✅ FIX: Check loading state first
  if (!studentsLoaded) {
    document.getElementById("studentIdError")
      .textContent = i("errStudentIdLoading");
    return false;
  }

  // Student ID
  if (!studentIdVal) {
    document.getElementById("studentIdError")
      .textContent = i("errStudentId");
    valid = false;
  } else {
    // Validate student exists
    const student =
      findStudentById(studentIdVal);
    if (!student) {
      document.getElementById("studentIdError")
        .textContent =
          i("errStudentIdNotFound");
      valid = false;
    }
  }

  // Full name
  if (!nameVal) {
    document.getElementById("nameError")
      .textContent = i("errName");
    valid = false;
  }

  // Age
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

  // Grade
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

  // Validate form
  if (!validateForm()) return;

  // Check location
  if (!locationVerified || !studentLocation) {
    alert(i("errLocation"));
    return;
  }

  // Security re-check distance
  const securityDistance = haversineDistance(
    studentLocation.latitude,
    studentLocation.longitude,
    SCHOOL_LATITUDE,
    SCHOOL_LONGITUDE
  );

  if (
    securityDistance > ALLOWED_DISTANCE_METERS
  ) {
    alert(i("errTooFar"));
    locationVerified = false;
    document.getElementById("submitBtn")
      .disabled = true;
    return;
  }

  const studentIdVal =
    normalizeStudentId(
      document.getElementById("studentId")
        .value
    );
  const nameVal =
    document.getElementById("fullName")
      .value.trim();
  const ageVal =
    document.getElementById("age")
      .value.trim();
  const gradeVal =
    document.getElementById("grade")
      .value.trim();

  // Show loading
  document.getElementById("loadingOverlay")
    .style.display = "flex";

  try {
    // Find record in Firebase
    const recordRef = doc(
      db,
      "sessionAttendance",
      sessionId,
      "records",
      studentIdVal
    );

    const recordSnap =
      await getDoc(recordRef);

    // Student not in this session
    if (!recordSnap.exists()) {
      document.getElementById("loadingOverlay")
        .style.display = "none";
      document.getElementById("studentIdError")
        .textContent =
          i("errStudentIdNotFound");
      return;
    }

    const existingRecord = recordSnap.data();

    // Already checked in
    if (existingRecord.status === "present") {
      document.getElementById("loadingOverlay")
        .style.display = "none";
      alert(i("errAlreadyCheckedIn"));
      return;
    }

    // Get current date and time
    const now       = new Date();
    const checkDate =
      now.toLocaleDateString("en-CA");
    const checkTime =
      now.toLocaleTimeString([], {
        hour:   "2-digit",
        minute: "2-digit"
      });

    // Update the student record
    await updateDoc(recordRef, {
      fullName:    nameVal,
      age:         Number(ageVal),
      grade:       gradeVal,
      checkInDate: checkDate,
      checkInTime: checkTime,
      status:      "present",
      latitude:    studentLocation.latitude,
      longitude:   studentLocation.longitude,
      accuracy:    studentLocation.accuracy,
      distanceFromSchool: securityDistance,
      submittedAt: now.toISOString()
    });

    console.log(
      "✅ Attendance saved for:",
      studentIdVal, nameVal
    );

    // Hide loading and form
    document.getElementById("loadingOverlay")
      .style.display = "none";
    document.getElementById("formCard")
      .style.display = "none";
    document.getElementById("distanceBox")
      .style.display = "none";
    document.getElementById("locationBox")
      .style.display = "none";

    // Show success
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
    console.error(
      "Submit attendance error:", error
    );
    document.getElementById("loadingOverlay")
      .style.display = "none";

    const errorCard =
      document.getElementById("errorCard");
    const errorMsg =
      document.getElementById("errorMessage");
    errorCard.style.display = "block";
    errorMsg.textContent    = error.message;
  }
}

// ================================================
// EVENT LISTENERS
// ================================================

// Language button
document.getElementById("languageButton")
  .addEventListener("click", function () {
    applyLanguage(
      currentLang === "en" ? "km" : "en"
    );
  });

// Retry location button
document.getElementById("retryLocationBtn")
  .addEventListener("click", function () {
    requestLocation();
  });

// ✅ FIX: Student ID field
// Validate when student stops typing
// Uses debounce to avoid running on
// every single keystroke
let studentIdTimer = null;
document.getElementById("studentId")
  .addEventListener("input", function () {

    // Clear any pending validation
    clearTimeout(studentIdTimer);

    // Wait 600ms after typing stops
    // then validate
    // This prevents validation running
    // while student is still typing
    studentIdTimer = setTimeout(
      function () {
        validateStudentId();
      },
      600
    );
  });

// ✅ FIX: Also validate when student
// leaves the student ID field
document.getElementById("studentId")
  .addEventListener("blur", function () {
    clearTimeout(studentIdTimer);
    validateStudentId();
  });

// Form submit
document.getElementById("attendanceForm")
  .addEventListener("submit",
    submitAttendance
  );

// ================================================
// ADD AUTO-FILL MESSAGE ELEMENT
// Insert it after the studentId error span
// ================================================
(function addAutoFillMsg() {
  const studentIdError =
    document.getElementById("studentIdError");
  if (studentIdError && !
    document.getElementById("autoFillMsg")
  ) {
    const msgEl = document.createElement("p");
    msgEl.id    = "autoFillMsg";
    msgEl.style.cssText =
      "font-size:12px;" +
      "color:#16a34a;" +
      "font-weight:600;" +
      "margin-top:5px;" +
      "display:none;";
    studentIdError.parentNode.insertBefore(
      msgEl,
      studentIdError.nextSibling
    );
  }
})();

// ================================================
// START THE APP
// ================================================
const savedLang =
  localStorage.getItem("studentLanguage")
  || "en";
applyLanguage(savedLang);
await loadSession();
