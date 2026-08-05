// ============================================
// FIREBASE IMPORTS
// ============================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================
// FIREBASE CONFIGURATION
// Replace with your real Firebase values
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyDpKCJ9xVeq2BY07aDwzzQ1qWvbStRuZLI",
  authDomain: "student-qr-attendance-90323.firebaseapp.com",
  projectId: "student-qr-attendance-90323",
  storageBucket: "student-qr-attendance-90323.firebasestorage.app",
  messagingSenderId: "45837607105",
  appId: "1:45837607105:web:29f7dd8350f1dc06bd7440"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);


// ============================================
// SCHOOL LOCATION
// ============================================

const SCHOOL_LATITUDE  = 11.822622780866276;
const SCHOOL_LONGITUDE = 104.7536602852736;
const ALLOWED_METERS   = 100;


// ============================================
// LANGUAGE
// ============================================

let currentLanguage =
  localStorage.getItem("attendanceLanguage") || "en";

const translations = {
  en: {
    title:              "Student QR Attendance",
    subtitle:           "Please enter your information and allow location access to check in.",
    requestingLocation: "Requesting your location permission...",
    locationReason:     "Your location is needed to verify that you are physically present at school. We do not collect location secretly.",
    formTitle:          "📋 Attendance Form",
    fullName:           "Full Name <span class='required'>*</span>",
    age:                "Age <span class='required'>*</span>",
    grade:              "Grade / Class <span class='required'>*</span>",
    locationConsent:    "I allow this website to access my location for attendance verification.",
    submit:             "Submit Attendance",
    successTitle:       "Attendance recorded successfully!",
    successMessage:     "Thank you. Your attendance has been saved.",
    saving:             "Saving your attendance...",
    footerSecurity:     "🔒 Your information is kept safe and secure.",
    footerSchool:       "តេប្រណំ - Tepranom High School",
    sessionClosedTitle: "Attendance is Closed",
    sessionClosedMsg:   "The teacher has not opened attendance yet or the session has ended. Please ask your teacher."
  },
  km: {
    title:              "ប្រព័ន្ធវត្តមានសិស្សតាម QR Code",
    subtitle:           "សូមបញ្ចូលព័ត៌មានរបស់អ្នក ហើយអនុញ្ញាតទីតាំង ដើម្បីចុះវត្តមាន។",
    requestingLocation: "កំពុងស្នើសុំការអនុញ្ញាតទីតាំងរបស់អ្នក...",
    locationReason:     "ទីតាំងរបស់អ្នកត្រូវការសម្រាប់បញ្ជាក់ថាអ្នកកំពុងនៅសាលា។ យើងមិនប្រមូលទីតាំងដោយសម្ងាត់ទេ។",
    formTitle:          "📋 ទម្រង់ចុះវត្តមាន",
    fullName:           "ឈ្មោះពេញ <span class='required'>*</span>",
    age:                "អាយុ <span class='required'>*</span>",
    grade:              "ថ្នាក់រៀន <span class='required'>*</span>",
    locationConsent:    "ខ្ញុំយល់ព្រមឱ្យគេហទំព័រនេះប្រើទីតាំងរបស់ខ្ញុំ សម្រាប់បញ្ជាក់វត្តមាន។",
    submit:             "ដាក់ស្នើវត្តមាន",
    successTitle:       "បានកត់ត្រាវត្តមានដោយជោគជ័យ!",
    successMessage:     "សូមអរគុណ។ វត្តមានរបស់អ្នកត្រូវបានរក្សាទុក។",
    saving:             "កំពុងរក្សាទុកវត្តមានរបស់អ្នក...",
    footerSecurity:     "🔒 ព័ត៌មានរបស់អ្នកត្រូវបានរក្សាទុកដោយសុវត្ថិភាព។",
    footerSchool:       "សាលាមធ្យមសិក្សាតេប្រណំ",
    sessionClosedTitle: "ការចុះវត្តមានបានបិទ",
    sessionClosedMsg:   "គ្រូមិនទាន់បើកវត្តមានទេ ឬវគ្គបានបញ្ចប់ហើយ។ សូមសាកសួរគ្រូរបស់អ្នក។"
  }
};

const messages = {
  en: {
    locationGranted:    "✅ Location access granted.",
    locationDenied:     "❌ Location permission denied. Please enable location and refresh.",
    locationRequired:   "⚠️ Location permission is required.",
    browserNoLocation:  "Your browser does not support location.",
    checkingDistance:   "⏳ Checking your distance from school...",
    insideSchool:       "✅ You are inside school. You may submit attendance.",
    outsideSchool:      "❌ You are too far from school. You must be at Tepranom High School.",
    consentRequired:    "⚠️ This checkbox is required. You must allow location access.",
    nameRequired:       "Please enter your full name.",
    ageRequired:        "Please enter a valid age between 5 and 100.",
    gradeRequired:      "Please enter your Grade or Class.",
    alreadyChecked:     "⚠️ You have already submitted attendance today.",
    saveError:          "❌ Failed to save. Please check your internet and try again.",
    sessionNotOpen:     "❌ Attendance session is not open. Please ask your teacher.",
    outsideTimeWindow:  "❌ Attendance is only allowed between {open} and {close}.",
    detailsTitle:       "📋 Attendance Details",
    detailsName:        "👤 Name",
    detailsAge:         "🎂 Age",
    detailsGrade:       "🏫 Grade",
    detailsDate:        "📅 Date",
    detailsTime:        "🕐 Time",
    detailsLocation:    "📍 Location recorded ✅"
  },
  km: {
    locationGranted:    "✅ បានអនុញ្ញាតទីតាំង។",
    locationDenied:     "❌ បានបដិសេធទីតាំង។ សូមបើកទីតាំង ហើយផ្ទុកឡើងវិញ។",
    locationRequired:   "⚠️ ការអនុញ្ញាតទីតាំងគឺចាំបាច់។",
    browserNoLocation:  "កម្មវិធីរុករករបស់អ្នកមិនគាំទ្រទីតាំងទេ។",
    checkingDistance:   "⏳ កំពុងពិនិត្យចម្ងាយពីសាលា...",
    insideSchool:       "✅ អ្នកនៅក្នុងសាលា។ អ្នកអាចដាក់ស្នើវត្តមានបាន។",
    outsideSchool:      "❌ អ្នកនៅឆ្ងាយពីសាលាពេក។ អ្នកត្រូវតែនៅសាលាមធ្យមសិក្សាតេប្រណំ។",
    consentRequired:    "⚠️ ប្រអប់នេះគឺត្រូវការ។ អ្នកត្រូវអនុញ្ញាតទីតាំង។",
    nameRequired:       "សូមបញ្ចូលឈ្មោះពេញរបស់អ្នក។",
    ageRequired:        "សូមបញ្ចូលអាយុដែលត្រឹមត្រូវ។",
    gradeRequired:      "សូមបញ្ចូលថ្នាក់រៀន។",
    alreadyChecked:     "⚠️ អ្នកបានចុះវត្តមានថ្ងៃនេះរួចហើយ។",
    saveError:          "❌ មិនអាចរក្សាទុកបានទេ។ សូមពិនិត្យអ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត។",
    sessionNotOpen:     "❌ វគ្គវត្តមានមិនទាន់បើកទេ។ សូមសាកសួរគ្រូ។",
    outsideTimeWindow:  "❌ ការចុះវត្តមានត្រូវបានអនុញ្ញាតតែពី {open} ដល់ {close} ប៉ុណ្ណោះ។",
    detailsTitle:       "📋 ព័ត៌មានវត្តមាន",
    detailsName:        "👤 ឈ្មោះ",
    detailsAge:         "🎂 អាយុ",
    detailsGrade:       "🏫 ថ្នាក់",
    detailsDate:        "📅 កាលបរិច្ឆេទ",
    detailsTime:        "🕐 ម៉ោង",
    detailsLocation:    "📍 បានរក្សាទុកទីតាំង ✅"
  }
};

function msg(key) {
  return messages[currentLanguage][key];
}


// ============================================
// LOCATION VARIABLES
// ============================================

let studentLatitude     = null;
let studentLongitude    = null;
let locationAllowed     = false;
let studentIsNearSchool = false;


// ============================================
// HAVERSINE DISTANCE FORMULA
// ============================================

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R     = 6371000;
  const toRad = function (d) {
    return d * (Math.PI / 180);
  };
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(
    Math.sqrt(a), Math.sqrt(1 - a)
  );
}


// ============================================
// DISTANCE BOX
// ============================================

function showDistanceBox(type, message) {
  const box  = document.getElementById("distanceBox");
  const text = document.getElementById("distanceStatus");
  const icon = document.getElementById("distanceIcon");

  box.style.display = "flex";
  box.className = "distance-box";

  if (type === "inside") {
    box.classList.add("inside");
    icon.textContent = "✅";
  } else if (type === "outside") {
    box.classList.add("outside");
    icon.textContent = "❌";
  } else {
    box.classList.add("checking");
    icon.textContent = "⏳";
  }

  text.textContent = message;
}


// ============================================
// REQUEST LOCATION
// ============================================

function requestLocation() {
  const locationStatus =
    document.getElementById("locationStatus");
  const locationBox =
    document.getElementById("locationBox");

  if (!navigator.geolocation) {
    locationStatus.textContent =
      msg("browserNoLocation");
    locationBox.classList.add("denied");
    return;
  }

  locationStatus.textContent =
    translations[currentLanguage].requestingLocation;

  navigator.geolocation.getCurrentPosition(

    function success(position) {
      studentLatitude  = position.coords.latitude;
      studentLongitude = position.coords.longitude;
      locationAllowed  = true;

      locationStatus.textContent =
        msg("locationGranted");
      locationBox.classList.remove("denied");
      locationBox.classList.add("allowed");

      showDistanceBox("checking",
        msg("checkingDistance"));

      const distance = calculateDistance(
        studentLatitude, studentLongitude,
        SCHOOL_LATITUDE, SCHOOL_LONGITUDE
      );

      const rounded = Math.round(distance);

      if (distance <= ALLOWED_METERS) {
        studentIsNearSchool = true;
        showDistanceBox("inside",
          msg("insideSchool") +
          " (" + rounded + "m)");
      } else {
        studentIsNearSchool = false;
        showDistanceBox("outside",
          msg("outsideSchool") +
          " (" + rounded + "m " +
          (currentLanguage === "km"
            ? "ពីសាលា" : "from school") +
          ")");
      }
    },

    function () {
      locationAllowed     = false;
      studentIsNearSchool = false;
      locationStatus.textContent =
        msg("locationDenied");
      locationBox.classList.remove("allowed");
      locationBox.classList.add("denied");
    },

    { enableHighAccuracy: true,
      timeout: 15000, maximumAge: 0 }
  );
}


// ============================================
// CHECK SESSION STATUS FROM FIREBASE
// ============================================

async function checkSessionStatus() {
  try {
    const sessionDoc =
      await getDoc(doc(db, "session", "current"));

    if (!sessionDoc.exists()) {
      return { isOpen: false, reason: "no_session" };
    }

    const data = sessionDoc.data();

    // Check if session is open
    if (!data.isOpen) {
      return { isOpen: false, reason: "closed" };
    }

    // Check today's date matches session date
    const today = new Date().toLocaleDateString("en-CA");
    if (data.date !== today) {
      return { isOpen: false, reason: "wrong_date" };
    }

    // Check time window if set
    if (data.openTime && data.closeTime) {
      const now = new Date();
      const currentMinutes =
        now.getHours() * 60 + now.getMinutes();

      const [openH, openM] =
        data.openTime.split(":").map(Number);
      const [closeH, closeM] =
        data.closeTime.split(":").map(Number);

      const openMinutes  = openH  * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      if (currentMinutes < openMinutes ||
          currentMinutes > closeMinutes) {
        return {
          isOpen: false,
          reason: "outside_time",
          openTime:  data.openTime,
          closeTime: data.closeTime
        };
      }
    }

    return {
      isOpen:    true,
      sessionId: data.sessionId,
      openTime:  data.openTime  || null,
      closeTime: data.closeTime || null
    };

  } catch (error) {
    console.error("Session check error:", error);
    return { isOpen: false, reason: "error" };
  }
}


// ============================================
// SHOW SESSION BANNER ON STUDENT PAGE
// ============================================

async function updateStudentSessionBanner() {
  const banner =
    document.getElementById("sessionBanner");
  const bannerIcon =
    document.getElementById("sessionBannerIcon");
  const bannerText =
    document.getElementById("sessionBannerText");
  const formCard =
    document.getElementById("formCard");
  const sessionClosedCard =
    document.getElementById("sessionClosedCard");

  const status = await checkSessionStatus();

  banner.style.display = "flex";

  if (status.isOpen) {
    banner.className = "session-banner open";
    bannerIcon.textContent = "🟢";
    bannerText.textContent =
      currentLanguage === "km"
        ? "វគ្គវត្តមានបើកហើយ។ អ្នកអាចចុះវត្តមានបាន។"
        : "Attendance session is open. You may check in.";

    formCard.style.display = "block";
    sessionClosedCard.style.display = "none";

  } else {
    banner.className = "session-banner closed";
    bannerIcon.textContent = "🔴";
    bannerText.textContent =
      currentLanguage === "km"
        ? "វគ្គវត្តមានបិទ។ សូមសាកសួរគ្រូ។"
        : "Attendance session is closed. Please ask your teacher.";

    formCard.style.display = "none";
    sessionClosedCard.style.display = "block";
  }
}


// ============================================
// APPLY LANGUAGE
// ============================================

function applyLanguage(language) {
  currentLanguage = language;
  localStorage.setItem("attendanceLanguage", language);

  document.documentElement.lang =
    language === "km" ? "km" : "en";
  document.body.classList.toggle(
    "khmer", language === "km"
  );

  document.querySelectorAll("[data-i18n]")
    .forEach(function (el) {
      const key = el.getAttribute("data-i18n");
      if (translations[language][key] !== undefined) {
        el.innerHTML = translations[language][key];
      }
    });

  document.querySelectorAll("[data-placeholder-en]")
    .forEach(function (input) {
      input.placeholder =
        language === "km"
          ? input.getAttribute("data-placeholder-km")
          : input.getAttribute("data-placeholder-en");
    });

  const btn = document.getElementById("languageButton");
  if (btn) {
    btn.textContent =
      language === "en" ? "ខ្មែរ" : "English";
  }
}


// ============================================
// LOADING
// ============================================

function showLoading() {
  document.getElementById("loadingOverlay")
    .classList.add("active");
}

function hideLoading() {
  document.getElementById("loadingOverlay")
    .classList.remove("active");
}


// ============================================
// ERROR CARD
// ============================================

function showError(message) {
  const card =
    document.getElementById("errorCard");
  document.getElementById("errorMessage")
    .textContent = message;
  card.style.display = "block";
  card.scrollIntoView({
    behavior: "smooth", block: "center"
  });
  setTimeout(function () {
    card.style.display = "none";
  }, 8000);
}

function clearErrors() {
  ["nameError","ageError",
   "gradeError","locationError"]
    .forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.textContent = "";
    });

  document.querySelectorAll("input")
    .forEach(function (i) {
      i.classList.remove("error");
    });

  const cg =
    document.getElementById("consentGroup");
  if (cg) cg.classList.remove("shake","error-border");

  document.getElementById("errorCard")
    .style.display = "none";
}


// ============================================
// SHAKE CHECKBOX
// ============================================

function shakeCheckbox() {
  const cg =
    document.getElementById("consentGroup");
  cg.classList.remove("shake","error-border");
  void cg.offsetWidth;
  cg.classList.add("shake","error-border");
  setTimeout(function () {
    cg.classList.remove("shake");
  }, 600);
}


// ============================================
// VALIDATE FORM
// ============================================

function validateForm(fullName, age, grade) {
  let valid = true;

  if (fullName.trim() === "") {
    document.getElementById("nameError")
      .textContent = msg("nameRequired");
    document.getElementById("fullName")
      .classList.add("error");
    valid = false;
  }

  const ageNum = Number(age);
  if (
    age.trim() === "" ||
    Number.isNaN(ageNum) ||
    ageNum < 5 || ageNum > 100
  ) {
    document.getElementById("ageError")
      .textContent = msg("ageRequired");
    document.getElementById("age")
      .classList.add("error");
    valid = false;
  }

  if (grade.trim() === "") {
    document.getElementById("gradeError")
      .textContent = msg("gradeRequired");
    document.getElementById("grade")
      .classList.add("error");
    valid = false;
  }

  const consent =
    document.getElementById("locationConsent").checked;

  if (!consent) {
    document.getElementById("locationError")
      .textContent = msg("consentRequired");
    shakeCheckbox();
    return false;
  }

  if (!locationAllowed) {
    document.getElementById("locationError")
      .textContent = msg("locationRequired");
    valid = false;
  }

  if (locationAllowed && !studentIsNearSchool) {
    document.getElementById("locationError")
      .textContent = msg("outsideSchool");
    valid = false;
  }

  return valid;
}


// ============================================
// DUPLICATE CHECK
// ============================================

async function checkDuplicate(fullName) {
  const today =
    new Date().toLocaleDateString("en-CA");
  const q = query(
    collection(db, "attendance"),
    where("fullName", "==", fullName),
    where("date",     "==", today)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}


// ============================================
// SAFE HTML
// ============================================

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}


// ============================================
// SUBMIT ATTENDANCE
// ============================================

async function submitAttendance(event) {
  event.preventDefault();
  clearErrors();

  const fullName =
    document.getElementById("fullName")
      .value.trim();
  const age =
    document.getElementById("age").value;
  const grade =
    document.getElementById("grade")
      .value.trim();

  if (!validateForm(fullName, age, grade)) return;

  const submitBtn =
    document.getElementById("submitBtn");
  showLoading();
  submitBtn.disabled = true;

  try {
    // Check session status
    const session = await checkSessionStatus();

    if (!session.isOpen) {
      hideLoading();
      submitBtn.disabled = false;

      if (session.reason === "outside_time") {
        const timeMsg =
          msg("outsideTimeWindow")
            .replace("{open}",  session.openTime)
            .replace("{close}", session.closeTime);
        showError(timeMsg);
      } else {
        showError(msg("sessionNotOpen"));
      }
      return;
    }

    // Check duplicate
    const duplicate = await checkDuplicate(fullName);
    if (duplicate) {
      hideLoading();
      submitBtn.disabled = false;
      showError(msg("alreadyChecked"));
      return;
    }

    const now = new Date();
    const dateString =
      now.toLocaleDateString("en-CA");
    const timeString =
      now.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit",
        second: "2-digit", hour12: true
      });

    const attendanceData = {
      fullName:    fullName,
      age:         Number(age),
      grade:       grade,
      latitude:    studentLatitude,
      longitude:   studentLongitude,
      date:        dateString,
      time:        timeString,
      sessionId:   session.sessionId,
      status:      "Present",
      submittedAt: serverTimestamp()
    };

    await addDoc(
      collection(db, "attendance"),
      attendanceData
    );

    hideLoading();

    document.getElementById("formCard")
      .style.display = "none";

    document.getElementById("sessionBanner")
      .style.display = "none";

    const successCard =
      document.getElementById("successCard");
    successCard.style.display = "block";

    document.getElementById("successDetails")
      .innerHTML = `
        <strong>${msg("detailsTitle")}</strong><br>
        ${msg("detailsName")}:
          ${escapeHTML(fullName)}<br>
        ${msg("detailsAge")}:
          ${Number(age)}<br>
        ${msg("detailsGrade")}:
          ${escapeHTML(grade)}<br>
        ${msg("detailsDate")}:
          ${dateString}<br>
        ${msg("detailsTime")}:
          ${timeString}<br>
        ${msg("detailsLocation")}
      `;

    successCard.scrollIntoView({
      behavior: "smooth", block: "center"
    });

  } catch (error) {
    console.error("Submit error:", error);
    hideLoading();
    submitBtn.disabled = false;
    showError(
      msg("saveError") + " (" + error.message + ")"
    );
  }
}


// ============================================
// START
// ============================================

window.addEventListener("DOMContentLoaded",
  function () {
    applyLanguage(currentLanguage);

    document.getElementById("languageButton")
      .addEventListener("click", function () {
        applyLanguage(
          currentLanguage === "en" ? "km" : "en"
        );
      });

    document.getElementById("attendanceForm")
      .addEventListener("submit", submitAttendance);

    requestLocation();
    updateStudentSessionBanner();
  }
);
