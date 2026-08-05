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
// COMPLETE TRANSLATION OBJECT
// Every single piece of text is here
// ============================================

const translations = {

  en: {
    // Page title tab
    pageTitle: "Student QR Attendance",

    // Header
    title:   "Student QR Attendance",
    subtitle: "Please enter your information and allow location access to check in.",

    // Location box
    requestingLocation: "Getting your location…",
    locationReason:
      "Your location is needed to verify that you are physically present at school. We do not collect location secretly.",
    locationGranted:
      "✅ Location access granted.",
    locationDenied:
      "❌ Location permission is required. Please allow location access.",
    browserNoLocation:
      "Your browser does not support location.",

    // Distance box
    checkingDistance:
      "⏳ Checking your distance from school…",
    insideSchool:
      "✅ You are inside school. You may submit attendance.",
    outsideSchool:
      "❌ You are too far from school. You must be at Tepranom High School.",
    fromSchool: "from school",

    // Session banner on student page
    sessionOpenBanner:
      "Attendance session is open. You may check in.",
    sessionClosedBanner:
      "Attendance session is closed. Please ask your teacher.",

    // Session closed card
    sessionClosedTitle: "Attendance is Closed",
    sessionClosedMsg:
      "The teacher has not opened attendance yet or the session has ended. Please ask your teacher.",

    // Form
    formTitle:   "📋 Attendance Form",
    fullNameLabel:       "Full Name",
    ageLabel:            "Age",
    gradeLabel:          "Grade / Class",
    fullNamePlaceholder: "Enter your full name",
    agePlaceholder:      "Enter your age",
    gradePlaceholder:    "Example: Grade 10 - A",
    locationConsentText:
      "I allow this website to access my location for attendance verification.",
    submitButton: "Submit Attendance",

    // Validation errors
    nameRequired:
      "Please enter your full name.",
    ageRequired:
      "Please enter a valid age between 5 and 100.",
    gradeRequired:
      "Please enter your Grade or Class.",
    consentRequired:
      "⚠️ This checkbox is required. You must allow location access to submit attendance.",
    locationRequired:
      "⚠️ Location permission is required.",
    outsideSchoolError:
      "❌ You are too far from school. You must be at Tepranom High School.",

    // Session errors
    sessionNotOpen:
      "❌ Attendance session is not open. Please ask your teacher.",
    outsideTimeWindow:
      "❌ Attendance is only allowed between {open} and {close}.",

    // Duplicate
    alreadyChecked:
      "⚠️ You have already checked in for today.",

    // Save error
    saveError:
      "❌ Failed to save attendance. Please check your internet and try again.",

    // Loading
    savingText: "Saving your attendance…",

    // Success
    successTitle:   "Attendance recorded successfully!",
    successMessage:
      "Thank you. Your attendance has been saved.",
    detailsTitle:    "📋 Attendance Details",
    detailsName:     "👤 Name",
    detailsAge:      "🎂 Age",
    detailsGrade:    "🏫 Grade",
    detailsDate:     "📅 Date",
    detailsTime:     "🕐 Time",
    detailsLocation: "📍 Location recorded ✅",

    // Footer
    footerSecurity:
      "🔒 Your information is kept safe and secure.",
    footerSchool:
      "Tepranom High School",

    // Language button
    languageButtonText: "ខ្មែរ"
  },

  km: {
    // Page title tab
    pageTitle: "ប្រព័ន្ធវត្តមានសិស្ស QR",

    // Header
    title:   "ប្រព័ន្ធវត្តមានសិស្សតាម QR Code",
    subtitle:
      "សូមបញ្ចូលព័ត៌មានរបស់អ្នក ហើយអនុញ្ញាតទីតាំង ដើម្បីចុះវត្តមាន។",

    // Location box
    requestingLocation:
      "កំពុងទទួលទីតាំងរបស់អ្នក…",
    locationReason:
      "ទីតាំងរបស់អ្នកត្រូវការ ដើម្បីបញ្ជាក់ថាអ្នកកំពុងស្ថិតនៅសាលា។ យើងមិនប្រមូលទីតាំងដោយសម្ងាត់ទេ។",
    locationGranted:
      "✅ បានអនុញ្ញាតការប្រើទីតាំង។",
    locationDenied:
      "❌ តម្រូវឱ្យអនុញ្ញាតការប្រើទីតាំង។ សូមអនុញ្ញាតការប្រើទីតាំងរបស់អ្នក។",
    browserNoLocation:
      "កម្មវិធីរុករករបស់អ្នកមិនគាំទ្រមុខងារទីតាំងទេ។",

    // Distance box
    checkingDistance:
      "⏳ កំពុងពិនិត្យចម្ងាយរបស់អ្នកពីសាលា…",
    insideSchool:
      "✅ អ្នកស្ថិតនៅក្នុងសាលា។ អ្នកអាចដាក់ស្នើវត្តមានបាន។",
    outsideSchool:
      "❌ អ្នកនៅឆ្ងាយពីសាលាពេក។ អ្នកត្រូវតែស្ថិតនៅវិទ្យាល័យទេពប្រណម្យ។",
    fromSchool: "ពីសាលា",

    // Session banner
    sessionOpenBanner:
      "វគ្គចុះវត្តមានបើកហើយ។ អ្នកអាចចុះវត្តមានបាន។",
    sessionClosedBanner:
      "វគ្គចុះវត្តមានត្រូវបានបិទ។ សូមសួរគ្រូរបស់អ្នក។",

    // Session closed card
    sessionClosedTitle:
      "ការចុះវត្តមានត្រូវបានបិទ",
    sessionClosedMsg:
      "គ្រូមិនទាន់បើកវត្តមានទេ ឬវគ្គបានបញ្ចប់ហើយ។ សូមសួរគ្រូរបស់អ្នក។",

    // Form
    formTitle:   "📋 ទម្រង់ចុះវត្តមាន",
    fullNameLabel:       "ឈ្មោះពេញ",
    ageLabel:            "អាយុ",
    gradeLabel:          "ថ្នាក់រៀន",
    fullNamePlaceholder: "បញ្ចូលឈ្មោះពេញរបស់អ្នក",
    agePlaceholder:      "បញ្ចូលអាយុរបស់អ្នក",
    gradePlaceholder:    "ឧទាហរណ៍៖ ថ្នាក់ទី ១០ ក",
    locationConsentText:
      "ខ្ញុំយល់ព្រមឱ្យគេហទំព័រនេះប្រើទីតាំងរបស់ខ្ញុំ សម្រាប់បញ្ជាក់វត្តមាន។",
    submitButton: "បញ្ជូនវត្តមាន",

    // Validation errors
    nameRequired:
      "សូមបញ្ចូលឈ្មោះពេញរបស់អ្នក។",
    ageRequired:
      "សូមបញ្ចូលអាយុដែលត្រឹមត្រូវ។",
    gradeRequired:
      "សូមបញ្ចូលថ្នាក់រៀន។",
    consentRequired:
      "⚠️ ប្រអប់ធីកនេះគឺចាំបាច់។ អ្នកត្រូវអនុញ្ញាតការប្រើទីតាំង ដើម្បីដាក់ស្នើវត្តមាន។",
    locationRequired:
      "⚠️ តម្រូវឱ្យអនុញ្ញាតការប្រើទីតាំង។",
    outsideSchoolError:
      "❌ អ្នកនៅឆ្ងាយពីសាលាពេក។ អ្នកត្រូវតែស្ថិតនៅវិទ្យាល័យទេពប្រណម្យ។",

    // Session errors
    sessionNotOpen:
      "❌ វគ្គចុះវត្តមានមិនទាន់បើកទេ។ សូមសួរគ្រូរបស់អ្នក។",
    outsideTimeWindow:
      "❌ ការចុះវត្តមានត្រូវបានអនុញ្ញាតតែពី {open} ដល់ {close} ប៉ុណ្ណោះ។",

    // Duplicate
    alreadyChecked:
      "⚠️ អ្នកបានចុះវត្តមានរួចហើយ។",

    // Save error
    saveError:
      "❌ មិនអាចរក្សាទុកវត្តមានបានទេ។ សូមពិនិត្យការភ្ជាប់អ៊ីនធឺណិតរបស់អ្នក ហើយព្យាយាមម្តងទៀត។",

    // Loading
    savingText: "កំពុងរក្សាទុកវត្តមានរបស់អ្នក…",

    // Success
    successTitle:
      "បានកត់ត្រាវត្តមានដោយជោគជ័យ!",
    successMessage:
      "សូមអរគុណ។ វត្តមានរបស់អ្នកត្រូវបានរក្សាទុក។",
    detailsTitle:    "📋 ព័ត៌មានលម្អិតវត្តមាន",
    detailsName:     "👤 ឈ្មោះ",
    detailsAge:      "🎂 អាយុ",
    detailsGrade:    "🏫 ថ្នាក់",
    detailsDate:     "📅 កាលបរិច្ឆេទ",
    detailsTime:     "🕐 ម៉ោង",
    detailsLocation: "📍 បានកត់ត្រាទីតាំង ✅",

    // Footer
    footerSecurity:
      "🔒 ព័ត៌មានរបស់អ្នកត្រូវបានរក្សាទុកដោយសុវត្ថិភាព។",
    footerSchool:
      "វិទ្យាល័យទេពប្រណម្យ",

    // Language button
    languageButtonText: "English"
  }
};


// ============================================
// CURRENT LANGUAGE
// ============================================

let currentLanguage =
  localStorage.getItem("attendanceLanguage") || "en";


// ============================================
// APPLY LANGUAGE TO ALL ELEMENTS
// This function translates everything at once
// ============================================

function applyLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem("attendanceLanguage", lang);

  // Set html lang attribute
  document.documentElement.lang =
    lang === "km" ? "km" : "en";

  // Toggle Khmer font class on body
  document.body.classList.toggle(
    "khmer", lang === "km"
  );

  // Update page browser tab title
  document.title =
    translations[lang].pageTitle;

  // Translate all elements with data-i18n
  document.querySelectorAll("[data-i18n]")
    .forEach(function (element) {
      const key =
        element.getAttribute("data-i18n");
      if (translations[lang][key] !== undefined) {
        element.textContent =
          translations[lang][key];
      }
    });

  // Translate all input placeholders
  document
    .querySelectorAll("[data-i18n-placeholder]")
    .forEach(function (input) {
      const key =
        input.getAttribute("data-i18n-placeholder");
      if (translations[lang][key] !== undefined) {
        input.placeholder =
          translations[lang][key];
      }
    });

  // Update language button text
  const langBtn =
    document.getElementById("languageButton");
  if (langBtn) {
    langBtn.textContent =
      translations[lang].languageButtonText;
  }

  // Re-translate any dynamic messages
  // that are already showing on screen
  retranslateDynamicMessages(lang);
}


// ============================================
// RE-TRANSLATE DYNAMIC MESSAGES
// Updates messages that were set by JavaScript
// ============================================

function retranslateDynamicMessages(lang) {
  const t = translations[lang];

  // Location status
  const locationStatus =
    document.getElementById("locationStatus");
  if (locationStatus) {
    if (locationAllowed) {
      locationStatus.textContent =
        t.locationGranted;
    } else if (locationDeniedFlag) {
      locationStatus.textContent =
        t.locationDenied;
    } else {
      locationStatus.textContent =
        t.requestingLocation;
    }
  }

  // Distance status
  const distanceStatus =
    document.getElementById("distanceStatus");
  if (distanceStatus &&
      distanceStatus.textContent !== "") {
    if (studentIsNearSchool) {
      distanceStatus.textContent =
        t.insideSchool +
        " (" + lastDistanceMeters + "m)";
    } else if (lastDistanceMeters > 0) {
      distanceStatus.textContent =
        t.outsideSchool +
        " (" + lastDistanceMeters + "m " +
        t.fromSchool + ")";
    }
  }

  // Session banner
  const bannerText =
    document.getElementById("sessionBannerText");
  if (bannerText &&
      bannerText.textContent !== "") {
    if (sessionBannerIsOpen) {
      bannerText.textContent =
        t.sessionOpenBanner;
    } else {
      bannerText.textContent =
        t.sessionClosedBanner;
    }
  }
}


// ============================================
// LOCATION VARIABLES
// ============================================

let studentLatitude     = null;
let studentLongitude    = null;
let locationAllowed     = false;
let locationDeniedFlag  = false;
let studentIsNearSchool = false;
let lastDistanceMeters  = 0;
let sessionBannerIsOpen = false;


// ============================================
// HAVERSINE DISTANCE FORMULA
// ============================================

function calculateDistance(
  lat1, lon1, lat2, lon2
) {
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
  const box  =
    document.getElementById("distanceBox");
  const text =
    document.getElementById("distanceStatus");
  const icon =
    document.getElementById("distanceIcon");

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
  const t = translations[currentLanguage];

  if (!navigator.geolocation) {
    locationStatus.textContent =
      t.browserNoLocation;
    locationBox.classList.add("denied");
    return;
  }

  locationStatus.textContent =
    t.requestingLocation;

  navigator.geolocation.getCurrentPosition(

    function success(position) {
      studentLatitude  = position.coords.latitude;
      studentLongitude = position.coords.longitude;
      locationAllowed  = true;
      locationDeniedFlag = false;

      locationStatus.textContent =
        translations[currentLanguage].locationGranted;

      locationBox.classList.remove("denied");
      locationBox.classList.add("allowed");

      showDistanceBox(
        "checking",
        translations[currentLanguage].checkingDistance
      );

      const distance = calculateDistance(
        studentLatitude, studentLongitude,
        SCHOOL_LATITUDE, SCHOOL_LONGITUDE
      );

      lastDistanceMeters = Math.round(distance);

      if (distance <= ALLOWED_METERS) {
        studentIsNearSchool = true;
        showDistanceBox(
          "inside",
          translations[currentLanguage].insideSchool +
          " (" + lastDistanceMeters + "m)"
        );
      } else {
        studentIsNearSchool = false;
        showDistanceBox(
          "outside",
          translations[currentLanguage].outsideSchool +
          " (" + lastDistanceMeters + "m " +
          translations[currentLanguage].fromSchool +
          ")"
        );
      }
    },

    function () {
      locationAllowed    = false;
      locationDeniedFlag = true;
      studentIsNearSchool = false;

      locationStatus.textContent =
        translations[currentLanguage].locationDenied;
      locationBox.classList.remove("allowed");
      locationBox.classList.add("denied");
    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}


// ============================================
// CHECK SESSION FROM FIREBASE
// ============================================

async function checkSessionStatus() {
  try {
    const sessionDoc =
      await getDoc(doc(db, "session", "current"));

    if (!sessionDoc.exists()) {
      return { isOpen: false,
               reason: "no_session" };
    }

    const data = sessionDoc.data();

    if (!data.isOpen) {
      return { isOpen: false, reason: "closed" };
    }

    const today =
      new Date().toLocaleDateString("en-CA");
    if (data.date !== today) {
      return { isOpen: false,
               reason: "wrong_date" };
    }

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
          isOpen:    false,
          reason:    "outside_time",
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
// UPDATE STUDENT SESSION BANNER
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
  const t = translations[currentLanguage];

  const status = await checkSessionStatus();

  banner.style.display = "flex";

  if (status.isOpen) {
    sessionBannerIsOpen = true;
    banner.className = "session-banner open";
    bannerIcon.textContent = "🟢";
    bannerText.textContent = t.sessionOpenBanner;
    formCard.style.display = "block";
    sessionClosedCard.style.display = "none";

  } else {
    sessionBannerIsOpen = false;
    banner.className = "session-banner closed";
    bannerIcon.textContent = "🔴";
    bannerText.textContent =
      t.sessionClosedBanner;
    formCard.style.display = "none";
    sessionClosedCard.style.display = "block";
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
  ["nameError", "ageError",
   "gradeError", "locationError"]
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
  if (cg) {
    cg.classList.remove("shake", "error-border");
  }

  document.getElementById("errorCard")
    .style.display = "none";
}


// ============================================
// SHAKE CHECKBOX
// ============================================

function shakeCheckbox() {
  const cg =
    document.getElementById("consentGroup");
  cg.classList.remove("shake", "error-border");
  void cg.offsetWidth;
  cg.classList.add("shake", "error-border");
  setTimeout(function () {
    cg.classList.remove("shake");
  }, 600);
}


// ============================================
// VALIDATE FORM
// ============================================

function validateForm(fullName, age, grade) {
  let valid = true;
  const t = translations[currentLanguage];

  if (fullName.trim() === "") {
    document.getElementById("nameError")
      .textContent = t.nameRequired;
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
      .textContent = t.ageRequired;
    document.getElementById("age")
      .classList.add("error");
    valid = false;
  }

  if (grade.trim() === "") {
    document.getElementById("gradeError")
      .textContent = t.gradeRequired;
    document.getElementById("grade")
      .classList.add("error");
    valid = false;
  }

  const consent =
    document.getElementById(
      "locationConsent"
    ).checked;

  if (!consent) {
    document.getElementById("locationError")
      .textContent = t.consentRequired;
    shakeCheckbox();
    return false;
  }

  if (!locationAllowed) {
    document.getElementById("locationError")
      .textContent = t.locationRequired;
    valid = false;
  }

  if (locationAllowed && !studentIsNearSchool) {
    document.getElementById("locationError")
      .textContent = t.outsideSchoolError;
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

  if (!validateForm(fullName, age, grade)) {
    return;
  }

  const submitBtn =
    document.getElementById("submitBtn");
  showLoading();
  submitBtn.disabled = true;

  const t = translations[currentLanguage];

  try {
    // Check session
    const session = await checkSessionStatus();

    if (!session.isOpen) {
      hideLoading();
      submitBtn.disabled = false;

      if (session.reason === "outside_time") {
        showError(
          t.outsideTimeWindow
            .replace("{open}",  session.openTime)
            .replace("{close}", session.closeTime)
        );
      } else {
        showError(t.sessionNotOpen);
      }
      return;
    }

    // Check duplicate
    const duplicate =
      await checkDuplicate(fullName);
    if (duplicate) {
      hideLoading();
      submitBtn.disabled = false;
      showError(t.alreadyChecked);
      return;
    }

    const now = new Date();
    const dateString =
      now.toLocaleDateString("en-CA");
    const timeString =
      now.toLocaleTimeString("en-US", {
        hour:   "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
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
      .innerHTML =
        `<strong>${escapeHTML(t.detailsTitle)}</strong><br>
         ${escapeHTML(t.detailsName)}:
           ${escapeHTML(fullName)}<br>
         ${escapeHTML(t.detailsAge)}:
           ${Number(age)}<br>
         ${escapeHTML(t.detailsGrade)}:
           ${escapeHTML(grade)}<br>
         ${escapeHTML(t.detailsDate)}:
           ${dateString}<br>
         ${escapeHTML(t.detailsTime)}:
           ${timeString}<br>
         ${escapeHTML(t.detailsLocation)}`;

    successCard.scrollIntoView({
      behavior: "smooth", block: "center"
    });

  } catch (error) {
    console.error("Submit error:", error);
    hideLoading();
    submitBtn.disabled = false;
    showError(
      t.saveError + " (" + error.message + ")"
    );
  }
}


// ============================================
// START — runs when page loads
// ============================================

window.addEventListener("DOMContentLoaded",
  function () {

    // Apply saved language first
    applyLanguage(currentLanguage);

    // Language button click
    document.getElementById("languageButton")
      .addEventListener("click", function () {
        const next =
          currentLanguage === "en" ? "km" : "en";
        applyLanguage(next);
      });

    // Form submit
    document.getElementById("attendanceForm")
      .addEventListener(
        "submit",
        submitAttendance
      );

    // Get location
    requestLocation();

    // Check session status
    updateStudentSessionBanner();
  }
);
