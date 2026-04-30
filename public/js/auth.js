/**
 * auth.js
 * Handles login / signup / logout UI and token refresh.
 * Exposes: initAuth(), currentUser (reactive via window.currentUser)
 */

// ─── State ────────────────────────────────────────────────────────────────────
let _resolveReady;
export const authReady = new Promise(r => { _resolveReady = r; });

let _sessionHadAccount = false; // true once any login has happened this session

// ─── Token refresh ────────────────────────────────────────────────────────────
let _refreshTimer = null;

function scheduleRefresh(delayMs) {
  clearTimeout(_refreshTimer);
  // Refresh 60 s before expiry; access token = 15 min = 900 000 ms
  const delay = delayMs ?? (14 * 60 * 1000);
  _refreshTimer = setTimeout(silentRefresh, Math.max(delay, 5000));
}

async function silentRefresh() {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setCurrentUser(data);
      scheduleRefresh();
    } else {
      setCurrentUser(null);
    }
  } catch {
    // network error — try again in 30 s
    _refreshTimer = setTimeout(silentRefresh, 30_000);
  }
}

// ─── Current user ─────────────────────────────────────────────────────────────
let _wasLoggedIn = false; // was the user actually logged in before this change?

function setCurrentUser(user) {
  const wasLoggedIn = !!window.currentUser;
  window.currentUser = user || null;

  const justLoggedIn = !wasLoggedIn && !!user;
  // Only "wasGuest" if logging in for the first time with no prior account this session
  const wasGuest = justLoggedIn && !_sessionHadAccount;
  if (user) _sessionHadAccount = true;

  document.dispatchEvent(new CustomEvent("authchange", { detail: { user, wasGuest, justLoggedIn } }));
  updateNav();
}

// ─── Fetch user on load ───────────────────────────────────────────────────────
async function fetchCurrentUser() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = await res.json();
    if (data.user) {
      setCurrentUser(data.user);
      scheduleRefresh();
    } else {
      setCurrentUser(null);
    }
  } catch {
    setCurrentUser(null);
  } finally {
    _resolveReady();
  }
}

// ─── Intercept 401 responses globally ────────────────────────────────────────
const _origFetch = window.fetch.bind(window);
window.fetch = async function patchedFetch(input, init) {
  const res = await _origFetch(input, init);
  if (res.status === 401) {
    let body;
    try { body = await res.clone().json(); } catch { body = {}; }
    if (body.code === "TOKEN_EXPIRED") {
      // Try to refresh once and retry
      const refreshed = await _origFetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      if (refreshed.ok) {
        scheduleRefresh();
        return _origFetch(input, init); // retry original
      } else {
        setCurrentUser(null);
        showAuthModal("login");
      }
    }
  }
  return res;
};

// ─── Nav bar ──────────────────────────────────────────────────────────────────
function updateNav() {
  const navEl = document.getElementById("auth-nav");
  if (!navEl) return;
  if (window.currentUser) {
    navEl.innerHTML = `
      <span class="auth-user-name">${escHtml(window.currentUser.displayName || window.currentUser.email)}</span>
      <button id="logout-btn" class="auth-btn auth-btn-ghost">Sign out</button>
    `;
    document.getElementById("logout-btn").addEventListener("click", logout);
  } else {
    navEl.innerHTML = `
      <button id="nav-login-btn"  class="auth-btn auth-btn-ghost">Log in</button>
      <button id="nav-signup-btn" class="auth-btn auth-btn-primary">Sign up</button>
      <span class="auth-guest-label">Guest mode</span>
    `;
    document.getElementById("nav-login-btn").addEventListener("click",  () => showAuthModal("login"));
    document.getElementById("nav-signup-btn").addEventListener("click", () => showAuthModal("signup"));
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  setCurrentUser(null);
}

// ─── Modal ────────────────────────────────────────────────────────────────────
let _modal = null;

export function showAuthModal(tab = "login") {
  if (_modal) { switchTab(tab); return; }

  _modal = document.createElement("div");
  _modal.id = "auth-modal-overlay";
  _modal.innerHTML = `
    <div class="auth-modal" role="dialog" aria-modal="true" aria-label="Authentication">
      <button class="auth-modal-close" id="auth-close-btn" aria-label="Close">✕</button>

      <div class="auth-tabs">
        <button class="auth-tab" data-tab="login"  id="tab-login">Log in</button>
        <button class="auth-tab" data-tab="signup" id="tab-signup">Sign up</button>
      </div>

      <!-- Login form -->
      <form class="auth-form" id="login-form" data-form="login" novalidate>
        <h2 class="auth-heading">Welcome back</h2>
        <label>Email
          <input type="email" name="email" autocomplete="email" required placeholder="you@example.com" />
        </label>
        <label>Password
          <input type="password" name="password" autocomplete="current-password" required placeholder="••••••••" />
        </label>
        <p class="auth-error" id="login-error" hidden></p>
        <button type="submit" class="auth-btn auth-btn-primary auth-submit">Log in</button>
        <p class="auth-switch">No account? <a href="#" data-tab="signup">Sign up</a></p>
      </form>

      <!-- Signup form -->
      <form class="auth-form" id="signup-form" data-form="signup" novalidate style="display:none">
        <h2 class="auth-heading">Create account</h2>
        <label>Display name <span class="auth-optional">(optional)</span>
          <input type="text" name="displayName" autocomplete="nickname" placeholder="Your name" />
        </label>
        <label>Email
          <input type="email" name="email" autocomplete="email" required placeholder="you@example.com" />
        </label>
        <label>Password
          <input type="password" name="password" autocomplete="new-password" required placeholder="At least 8 characters" minlength="8" />
        </label>
        <p class="auth-error" id="signup-error" hidden></p>
        <button type="submit" class="auth-btn auth-btn-primary auth-submit">Create account</button>
        <p class="auth-switch">Already have one? <a href="#" data-tab="login">Log in</a></p>
        <hr class="auth-divider" />
        <button type="button" class="auth-btn auth-btn-ghost auth-guest-btn" id="continue-guest-btn">
          Continue as guest
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(_modal);
  switchTab(tab);

  // Wire events
  _modal.querySelector("#auth-close-btn").addEventListener("click", closeModal);
  _modal.addEventListener("click", e => { if (e.target === _modal) closeModal(); });

  _modal.querySelectorAll("[data-tab]").forEach(el => {
    el.addEventListener("click", e => {
      e.preventDefault();
      switchTab(el.dataset.tab);
    });
  });

  _modal.querySelector("#login-form").addEventListener("submit",  handleLogin);
  _modal.querySelector("#signup-form").addEventListener("submit", handleSignup);
  _modal.querySelector("#continue-guest-btn").addEventListener("click", closeModal);
}

function closeModal() {
  if (_modal) { _modal.remove(); _modal = null; }
}

function switchTab(tab) {
  if (!_modal) return;
  _modal.querySelectorAll(".auth-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tab);
  });
  _modal.querySelector("#login-form").style.display  = tab === "login"  ? "" : "none";
  _modal.querySelector("#signup-form").style.display = tab === "signup" ? "" : "none";
}

function setFormLoading(form, loading) {
  const btn = form.querySelector(".auth-submit");
  btn.disabled = loading;
  btn.textContent = loading
    ? (form.dataset.form === "login" ? "Logging in…" : "Creating…")
    : (form.dataset.form === "login" ? "Log in" : "Create account");
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.hidden = !msg;
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const email    = form.email.value.trim();
  const password = form.password.value;
  showError("login-error", "");
  setFormLoading(form, true);
  try {
    const res  = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { showError("login-error", data.error || "Login failed"); return; }
    setCurrentUser(data);
    scheduleRefresh();
    closeModal();
  } catch {
    showError("login-error", "Network error. Please try again.");
  } finally {
    setFormLoading(form, false);
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const form = e.target;
  const email       = form.email.value.trim();
  const password    = form.password.value;
  const displayName = form.displayName.value.trim();
  showError("signup-error", "");
  if (password.length < 8) {
    showError("signup-error", "Password must be at least 8 characters.");
    return;
  }
  setFormLoading(form, true);
  try {
    const res  = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) { showError("signup-error", data.error || "Signup failed"); return; }
    setCurrentUser(data);
    scheduleRefresh();
    closeModal();
  } catch {
    showError("signup-error", "Network error. Please try again.");
  } finally {
    setFormLoading(form, false);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])
  );
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initAuth() {
  await fetchCurrentUser();
}