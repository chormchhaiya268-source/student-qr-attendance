// ================================================
// script.js
// Student Attendance Page — Full Logic
// Handles: session check, location verification,
// form submission, Firebase save, language switch
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
  apiKey: "AIzaSyDpKCJ9xVeq2BY07aDwzzQ1qWvbStRuZLI",
  authDomain: "student-qr-attendance-90323.firebaseapp.com",
  projectId: "student-qr-attendance-90323",
  storageBucket:
    "student-qr-attendance-90323.firebasestorage.app",
  messagingSenderId: "45837607105",
  appId:
    "1:45837607105:web:29f7dd8350f1dc06bd7440"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ================================================
// SCHOOL LOCATION CONSTANTS
// Students must be within 100 meters
// ================================================
const SCHOOL_LATITUDE         = 11.822624138074948;
const SCHOOL_LONGITUDE        = 104.7536601355822;
const ALLOWED_DISTANCE_METERS = 100;
// If GPS accuracy is worse than this, warn user
const MAX_ACCEPTABLE_ACCURACY = 50;

// ================================================
// APP STATE
// ================================================
let currentLang      = "en";
let sessionId        = null;
let sessionData      = null;
let studentLocation  = null;
let locationVerified = false;

// ================================================
// TRANSLATIONS — ENGLISH AND KHMER
// All text goes here, nothing hardcoded elsewhere
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

    // Success
    successTitle:
      "Attendance Marked!",
    successMessage:
      "Your attendance has been recorded successfully.",

    // Loading
    savingText:
      "Saving your attendance...",
    checkingStudent:
      "Checking student record...",

    // Footer
    footerSecurity:
      "🔒 Your location is only used to verify attendance.",
    footerSchool:
      "Tepranom High School Attendance System",

    // Status
    notCheckedInYet: "Not Checked In Yet",
    present:         "Present"
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
      "រកមិនឃើញលេខសម្គាល់សិស្សទេ។ សូមពិនិត្យលេខសម្គាល់ ហើយព្យាយាមម្តងទៀត។",
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

    // Success
    successTitle:
      "វត្តមានត្រូវបានកត់ត្រា!",
    successMessage:
      "វត្តមានរបស់អ្នកត្រូវបានរក្សាទុកដោយជោគជ័យ។",

    // Loading
    savingText:
      "កំពុងរក្សាទុកវត្តមាន...",
    checkingStudent:
      "កំពុងពិនិត្យកំណត់ត្រាសិស្ស...",

    // Footer
    footerSecurity:
      "🔒 ទីតាំងរបស់អ្នកត្រូវបានប្រើតែសម្រាប់ផ្ទៀងផ្ទាត់វត្តមានប៉ុណ្ណោះ។",
    footerSchool:
      "ប្រព័ន្ធវត្តមានវិទ្យាល័យទេពប្រណម្យ",

    // Status
    notCheckedInYet: "មិនទាន់ចុះវត្តមាន",
    present:         "មានវត្តមាន"
  }
};

// ================================================
// TRANSLATE — get text by key
// ================================================
function i(key) {
  return i18n[currentLang][key] || key;
}

// ================================================
// APPLY LANGUAGE TO ALL ELEMENTS
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

  // Language button text
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

  // Refresh distance display if we already
  // have a location result
  if (studentLocation) {
    showDistanceResult(studentLocation);
  }
}

// ================================================
// HAVERSINE FORMULA
// Calculates real distance between two GPS
// coordinates in meters
// ================================================
function haversineDistance(
  lat1, lon1, lat2, lon2
) {
  const R = 6371000; // Earth radius in meters
  const toRad = function (deg) {
    return deg * (Math.PI / 180);
  };

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(
    Math.sqrt(a), Math.sqrt(1 - a)
  );

  return R * c; // distance in meters
}

// ================================================
// SHOW DISTANCE RESULT BOX
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

  const distance   = locationResult.distance;
  const accuracy   = locationResult.accuracy;
  const isNear     = distance <= ALLOWED_DISTANCE_METERS;

  distanceBox.style.display = "flex";

  // Show detail line with numbers
  distanceDetail.textContent =
    i("distanceFromSchool") + ": " +
    Math.round(distance) + " " + i("meters") +
    " | " + i("gpsAccuracy") + ": ±" +
    Math.round(accuracy) + " " + i("meters");

  if (isNear) {
    // Student is close enough
    distanceIcon.textContent = "✅";
    distanceStatus.textContent =
      i("locationVerified");
    distanceStatus.style.color = "#16a34a";
    distanceBox.style.background = "#f0fdf4";
    distanceBox.style.borderColor = "#86efac";
    retryBtn.style.display  = "none";
    submitBtn.disabled       = false;
    locationVerified         = true;

  } else {
    // Student is too far
    distanceIcon.textContent = "❌";
    distanceStatus.textContent =
      i("locationTooFar");
    distanceStatus.style.color = "#dc2626";
    distanceBox.style.background = "#fef2f2";
    distanceBox.style.borderColor = "#fca5a5";
    retryBtn.style.display  = "block";
    submitBtn.disabled       = true;
    locationVerified         = false;
  }
}

// ================================================
// REQUEST STUDENT LOCATION
// Uses GPS with high accuracy
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
  submitBtn.disabled = true;
  distanceBox.style.display = "none";
  retryBtn.style.display    = "none";

  locationStatus.textContent = i("locating");

  if (!navigator.geolocation) {
    locationStatus.textContent =
      i("locationError");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    // SUCCESS callback
    function (position) {
      const lat      = position.coords.latitude;
      const lon      = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      console.log("✅ GPS:", lat, lon,
        "accuracy:", accuracy, "m");

      // Check if GPS accuracy is too poor
      if (accuracy > MAX_ACCEPTABLE_ACCURACY) {
        locationStatus.textContent =
          i("locationPoorAccuracy");

        // Show distance box with warning
        const distanceBox =
          document.getElementById("distanceBox");
        const distanceStatus =
          document.getElementById("distanceStatus");
        const distanceDetail =
          document.getElementById("distanceDetail");
        const distanceIcon =
          document.getElementById("distanceIcon");

        distanceBox.style.display  = "flex";
        distanceBox.style.background = "#fffbeb";
        distanceBox.style.borderColor = "#fcd34d";
        distanceIcon.textContent   = "⚠️";
        distanceStatus.textContent =
          i("locationPoorAccuracy");
        distanceStatus.style.color = "#92400e";
        distanceDetail.textContent =
          i("gpsAccuracy") + ": ±" +
          Math.round(accuracy) + " " + i("meters");
        retryBtn.style.display = "block";
        return;
      }

      // Calculate distance using Haversine formula
      const distance = haversineDistance(
        lat, lon,
        SCHOOL_LATITUDE, SCHOOL_LONGITUDE
      );

      console.log("📏 Distance from school:",
        Math.round(distance), "m");

      // Store location result
      studentLocation = {
        latitude:  lat,
        longitude: lon,
        accuracy:  accuracy,
        distance:  distance
      };

      locationStatus.textContent =
        i("requestingLocation");

      // Show the result to the student
      showDistanceResult(studentLocation);
    },

    // ERROR callback
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

      const retryBtn =
        document.getElementById(
          "retryLocationBtn"
        );
      const distanceBox =
        document.getElementById("distanceBox");
      const distanceIcon =
        document.getElementById("distanceIcon");
      const distanceStatus =
        document.getElementById("distanceStatus");

      distanceBox.style.display  = "flex";
      distanceBox.style.background = "#fef2f2";
      distanceBox.style.borderColor = "#fca5a5";
      distanceIcon.textContent   = "❌";
      distanceStatus.textContent =
        i("locationError");
      distanceStatus.style.color = "#dc2626";
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
// Checks if the session from the URL is active
// ================================================
async function loadSession() {
  // Get session ID from URL
  // Example URL:
  // https://user.github.io/repo/index.html
  //   ?session=2025-01-15-ABC123
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

  // No session ID in URL
  if (!sessionId) {
    formCard.style.display  = "none";
    closedCard.style.display = "block";
    document.querySelector(
      "[data-i18n='sessionClosedMsg']"
    ).textContent = i("noSession");
    return;
  }

  try {
    // Check Firebase for session data
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

    // Check session is open and for today
    if (
      !sessionData.isOpen ||
      sessionData.date !== today ||
      sessionData.sessionId !== sessionId
    ) {
      formCard.style.display   = "none";
      closedCard.style.display = "block";

      // Translate the closed message
      document.querySelectorAll(
        "[data-i18n='sessionClosedMsg']"
      ).forEach(function (el) {
        el.textContent = i("sessionExpired");
      });
      return;
    }

    // Session is valid and active
    banner.style.display = "flex";
    bannerIcon.textContent = "🟢";
    bannerText.textContent = i("sessionActive");
    banner.style.background = "#f0fdf4";
    banner.style.color      = "#16a34a";
    banner.style.border     =
      "1px solid #86efac";

    // Now request the student's location
    requestLocation();

  } catch (error) {
    console.error("Load session error:", error);
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
    document.getElementById("age").value.trim();
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

  if (!studentIdVal) {
    document.getElementById("studentIdError")
      .textContent = i("errStudentId");
    valid = false;
  }
  if (!nameVal) {
    document.getElementById("nameError")
      .textContent = i("errName");
    valid = false;
  }
  if (!ageVal || isNaN(ageVal) ||
      Number(ageVal) < 5 ||
      Number(ageVal) > 100) {
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

  // Validate form fields
  if (!validateForm()) return;

  // Double-check location is verified
  if (!locationVerified || !studentLocation) {
    alert(i("errLocation"));
    return;
  }

  // Security check: re-verify distance
  // before saving to Firebase
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

  const studentIdVal =
    document.getElementById("studentId")
      .value.trim().toUpperCase();
  const nameVal =
    document.getElementById("fullName")
      .value.trim();
  const ageVal =
    document.getElementById("age").value.trim();
  const gradeVal =
    document.getElementById("grade")
      .value.trim();

  // Show loading
  document.getElementById("loadingOverlay")
    .style.display = "flex";

  try {
    // =============================================
    // STEP 1: Find the student record in Firebase
    // Path: sessionAttendance/{sessionId}/
    //         records/{studentId}
    // =============================================
    const recordRef = doc(
      db,
      "sessionAttendance",
      sessionId,
      "records",
      studentIdVal
    );

    const recordSnap = await getDoc(recordRef);

    // Student ID not found in this session
    if (!recordSnap.exists()) {
      document.getElementById("loadingOverlay")
        .style.display = "none";
      document.getElementById("studentIdError")
        .textContent = i("errStudentIdNotFound");
      return;
    }

    const existingRecord = recordSnap.data();

    // =============================================
    // STEP 2: Check if already checked in
    // =============================================
    if (existingRecord.status === "present") {
      document.getElementById("loadingOverlay")
        .style.display = "none";
      alert(i("errAlreadyCheckedIn"));
      return;
    }

    // =============================================
    // STEP 3: Get current date and time
    // =============================================
    const now       = new Date();
    const checkDate =
      now.toLocaleDateString("en-CA");
    const checkTime =
      now.toLocaleTimeString([], {
        hour:   "2-digit",
        minute: "2-digit"
      });

    // =============================================
    // STEP 4: Update the student's record
    // Changes status from notCheckedInYet
    // to present, and adds real date/time
    // =============================================
    await updateDoc(recordRef, {
      // Update check-in info
      fullName:    nameVal,
      age:         Number(ageVal),
      grade:       gradeVal,
      checkInDate: checkDate,
      checkInTime: checkTime,
      status:      "present",

      // Save location data
      latitude:    studentLocation.latitude,
      longitude:   studentLocation.longitude,
      accuracy:    studentLocation.accuracy,
      distanceFromSchool: securityDistance,

      // When this was submitted
      submittedAt: now.toISOString()
    });

    console.log("✅ Attendance saved for:",
      studentIdVal, nameVal);

    // =============================================
    // STEP 5: Hide form, show success
    // =============================================
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

    // Show student details on success card
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
              ${i("colDate") || "Date"}:
            </strong>
            ${checkDate}
          </div>
          <div>
            <strong>
              ${i("colTime") || "Time"}:
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
    console.error("Submit attendance error:",
      error);
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

// Form submit
document.getElementById("attendanceForm")
  .addEventListener("submit", submitAttendance);

// ================================================
// START THE APP
// ================================================
const savedLang =
  localStorage.getItem("studentLanguage") || "en";
applyLanguage(savedLang);
await loadSession();
