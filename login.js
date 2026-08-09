// ================================================
// login.js
// Teacher Login Page — Full Logic
// Firebase Authentication with Email + Password
// ================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ================================================
// TRANSLATIONS — ENGLISH AND KHMER
// ================================================
const lt = {
  en: {
    pageTitle:    "Teacher Login - Teppranam",
    schoolName:   "Teppranam High School",
    schoolSub:    "វិទ្យាល័យទេពប្រណម្យ",
    loginTitle:   "Teacher Login",
    emailLabel:   "Email",
    emailPlaceholder:
      "Enter your email address",
    passwordLabel: "Password",
    passwordPlaceholder:
      "Enter your password",
    loginBtn:     "Login",
    loggingIn:    "Logging in...",
    forgotPassword:
      "Forgot Password?",
    loginFooter:
      "🔒 Authorized teachers only",
    langBtn:      "ខ្មែរ",

    // Validation errors
    errEmailEmpty:
      "Please enter your email address.",
    errEmailInvalid:
      "Please enter a valid email address.",
    errPasswordEmpty:
      "Please enter your password.",
    errPasswordShort:
      "Password must be at least 6 characters.",

    // Auth errors
    errInvalidCredential:
      "Invalid email or password.",
    errTooManyRequests:
      "Too many failed attempts. Please try again later.",
    errNetworkFailed:
      "Network error. Please check your connection.",
    errGeneral:
      "Login failed. Please try again.",

    // Success
    loginSuccess:
      "Login successful. Redirecting...",

    // Forgot password
    forgotEmailPrompt:
      "Enter your email address to reset your password:",
    resetEmailSent:
      "Password reset email sent. Please check your inbox.",
    errResetEmailEmpty:
      "Please enter your email address.",
    errResetFailed:
      "Could not send reset email. Please try again."
  },

  km: {
    pageTitle:
      "ចូលប្រើសម្រាប់គ្រូ - វិទ្យាល័យទេពប្រណម្យ",
    schoolName:
      "វិទ្យាល័យទេពប្រណម្យ",
    schoolSub:
      "Teppranam High School",
    loginTitle:
      "ចូលប្រើសម្រាប់គ្រូ",
    emailLabel:
      "អ៊ីមែល",
    emailPlaceholder:
      "បញ្ចូលអាសយដ្ឋានអ៊ីមែលរបស់អ្នក",
    passwordLabel:
      "ពាក្យសម្ងាត់",
    passwordPlaceholder:
      "បញ្ចូលពាក្យសម្ងាត់របស់អ្នក",
    loginBtn:
      "ចូលប្រើ",
    loggingIn:
      "កំពុងចូលប្រើ...",
    forgotPassword:
      "ភ្លេចពាក្យសម្ងាត់?",
    loginFooter:
      "🔒 សម្រាប់តែគ្រូដែលមានការអនុញ្ញាតប៉ុណ្ណោះ",
    langBtn:
      "English",

    // Validation errors
    errEmailEmpty:
      "សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែលរបស់អ្នក។",
    errEmailInvalid:
      "សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែលត្រឹមត្រូវ។",
    errPasswordEmpty:
      "សូមបញ្ចូលពាក្យសម្ងាត់របស់អ្នក។",
    errPasswordShort:
      "ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ 6 តួអក្សរ។",

    // Auth errors
    errInvalidCredential:
      "អ៊ីមែល ឬ ពាក្យសម្ងាត់មិនត្រឹមត្រូវ។",
    errTooManyRequests:
      "ព្យាយាមច្រើនដងពេក។ សូមព្យាយាមម្តងទៀតពេលក្រោយ។",
    errNetworkFailed:
      "បញ្ហាបណ្តាញ។ សូមពិនិត្យការតភ្ជាប់របស់អ្នក។",
    errGeneral:
      "ការចូលប្រើបានបរាជ័យ។ សូមព្យាយាមម្តងទៀត។",

    // Success
    loginSuccess:
      "ចូលប្រើបានជោគជ័យ។ កំពុងបញ្ជូន...",

    // Forgot password
    forgotEmailPrompt:
      "បញ្ចូលអាសយដ្ឋានអ៊ីមែលរបស់អ្នក ដើម្បីកំណត់ពាក្យសម្ងាត់ឡើងវិញ៖",
    resetEmailSent:
      "បានផ្ញើអ៊ីមែលកំណត់ពាក្យសម្ងាត់ឡើងវិញ។ សូមពិនិត្យប្រអប់សំបុត្ររបស់អ្នក។",
    errResetEmailEmpty:
      "សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែលរបស់អ្នក។",
    errResetFailed:
      "មិនអាចផ្ញើអ៊ីមែលកំណត់ឡើងវិញ។ សូមព្យាយាមម្តងទៀត។"
  }
};

// ================================================
// LANGUAGE STATE
// ================================================
let lLang =
  localStorage.getItem("teacherLanguage")
  || "en";

// Get translation by key
function l(key) {
  return lt[lLang][key] || key;
}

// ================================================
// APPLY LANGUAGE TO LOGIN PAGE
// ================================================
function applyLoginLang(lang) {
  lLang = lang;
  localStorage.setItem("teacherLanguage", lang);

  document.documentElement.lang =
    lang === "km" ? "km" : "en";
  document.body.classList.toggle(
    "khmer", lang === "km"
  );

  document.title = l("pageTitle");

  // Translate all data-l elements
  document.querySelectorAll("[data-l]")
    .forEach(function (el) {
      const key = el.getAttribute("data-l");
      const val = l(key);
      if (val !== key) el.textContent = val;
    });

  // Translate placeholders
  document.querySelectorAll(
    "[data-l-placeholder]"
  ).forEach(function (el) {
    const key =
      el.getAttribute("data-l-placeholder");
    const val = l(key);
    if (val !== key) el.placeholder = val;
  });

  // Language button
  const langBtn =
    document.getElementById("loginLangBtn");
  if (langBtn) {
    langBtn.textContent = l("langBtn");
  }
}

// ================================================
// SHOW ERROR MESSAGE
// ================================================
function showError(message) {
  const box =
    document.getElementById("loginErrorBox");
  const msg =
    document.getElementById("loginErrorMsg");
  const successBox =
    document.getElementById("loginSuccessBox");

  successBox.style.display = "none";
  msg.textContent  = message;
  box.style.display = "flex";

  // Shake animation
  box.classList.remove("shake");
  void box.offsetWidth; // force reflow
  box.classList.add("shake");
}

// ================================================
// SHOW SUCCESS MESSAGE
// ================================================
function showSuccess(message) {
  const box =
    document.getElementById("loginSuccessBox");
  const msg =
    document.getElementById("loginSuccessMsg");
  const errorBox =
    document.getElementById("loginErrorBox");

  errorBox.style.display = "none";
  msg.textContent   = message;
  box.style.display = "flex";
}

// ================================================
// HIDE ALL MESSAGES
// ================================================
function hideMessages() {
  document.getElementById("loginErrorBox")
    .style.display = "none";
  document.getElementById("loginSuccessBox")
    .style.display = "none";
  document.getElementById("emailError")
    .textContent = "";
  document.getElementById("passwordError")
    .textContent = "";
}

// ================================================
// SET LOADING STATE ON LOGIN BUTTON
// ================================================
function setLoading(isLoading) {
  const btn =
    document.getElementById("loginBtn");
  const btnText =
    document.getElementById("loginBtnText");
  const spinner =
    document.getElementById("loginSpinner");

  if (isLoading) {
    btn.disabled = true;
    btnText.textContent = l("loggingIn");
    spinner.style.display = "inline-block";
  } else {
    btn.disabled = false;
    btnText.textContent = l("loginBtn");
    spinner.style.display = "none";
  }
}

// ================================================
// VALIDATE FORM FIELDS
// Returns true if valid, false if not
// ================================================
function validateLoginForm() {
  let valid = true;

  const email =
    document.getElementById("loginEmail")
      .value.trim();
  const password =
    document.getElementById("loginPassword")
      .value;

  // Clear old errors
  document.getElementById("emailError")
    .textContent = "";
  document.getElementById("passwordError")
    .textContent = "";

  // Email validation
  if (!email) {
    document.getElementById("emailError")
      .textContent = l("errEmailEmpty");
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email)) {
    document.getElementById("emailError")
      .textContent = l("errEmailInvalid");
    valid = false;
  }

  // Password validation
  if (!password) {
    document.getElementById("passwordError")
      .textContent = l("errPasswordEmpty");
    valid = false;
  } else if (password.length < 6) {
    document.getElementById("passwordError")
      .textContent = l("errPasswordShort");
    valid = false;
  }

  return valid;
}

// ================================================
// GET CORRECT REDIRECT URL
// Works on GitHub Pages and localhost
// ================================================
function getTeacherPageUrl() {
  const origin   = window.location.origin;
  const pathname = window.location.pathname;
  const basePath = pathname.replace(
    /\/[^\/]*\.html$/, "/"
  );
  return origin + basePath + "teacher.html";
}

// ================================================
// HANDLE LOGIN FORM SUBMIT
// ================================================
async function handleLogin(e) {
  e.preventDefault();
  hideMessages();

  // Validate first
  if (!validateLoginForm()) return;

  const email =
    document.getElementById("loginEmail")
      .value.trim();
  const password =
    document.getElementById("loginPassword")
      .value;

  setLoading(true);

  try {
    // Sign in with Firebase Authentication
    await signInWithEmailAndPassword(
      auth, email, password
    );

    // Login successful
    showSuccess(l("loginSuccess"));

    // Wait a moment then redirect
    setTimeout(function () {
      window.location.href =
        getTeacherPageUrl();
    }, 1200);

  } catch (error) {
    setLoading(false);
    console.error("Login error:", error.code);

    // Show correct error message
    // based on Firebase error code
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
      case "auth/invalid-email":
        showError(l("errInvalidCredential"));
        break;

      case "auth/too-many-requests":
        showError(l("errTooManyRequests"));
        break;

      case "auth/network-request-failed":
        showError(l("errNetworkFailed"));
        break;

      default:
        showError(l("errGeneral"));
        break;
    }
  }
}

// ================================================
// HANDLE FORGOT PASSWORD
// ================================================
async function handleForgotPassword() {
  const email = prompt(l("forgotEmailPrompt"));

  // Teacher cancelled the prompt
  if (email === null) return;

  if (!email.trim()) {
    alert(l("errResetEmailEmpty"));
    return;
  }

  try {
    await sendPasswordResetEmail(
      auth, email.trim()
    );
    alert(l("resetEmailSent"));
  } catch (error) {
    console.error(
      "Password reset error:", error
    );
    alert(l("errResetFailed"));
  }
}

// ================================================
// CHECK IF ALREADY LOGGED IN
// If teacher is already logged in,
// skip the login page and go to dashboard
// ================================================
onAuthStateChanged(auth, function (user) {
  if (user) {
    // Already logged in
    // Redirect to teacher dashboard
    window.location.href = getTeacherPageUrl();
  }
  // If not logged in, stay on login page
});

// ================================================
// SHOW / HIDE PASSWORD TOGGLE
// ================================================
document.getElementById("togglePassword")
  .addEventListener("click", function () {
    const input =
      document.getElementById("loginPassword");
    const isPassword =
      input.type === "password";
    input.type =
      isPassword ? "text" : "password";
    this.textContent =
      isPassword ? "🙈" : "👁";
  });

// ================================================
// FORM SUBMIT EVENT
// ================================================
document.getElementById("loginForm")
  .addEventListener("submit", handleLogin);

// ================================================
// FORGOT PASSWORD EVENT
// ================================================
document.getElementById("forgotPasswordBtn")
  .addEventListener("click",
    handleForgotPassword
  );

// ================================================
// LANGUAGE BUTTON EVENT
// ================================================
document.getElementById("loginLangBtn")
  .addEventListener("click", function () {
    applyLoginLang(
      lLang === "en" ? "km" : "en"
    );
  });

// ================================================
// START THE LOGIN PAGE
// ================================================
applyLoginLang(lLang);
