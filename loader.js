// ===== SATVERSE LOADER (BULLETPROOF BUILD) =====
console.log("SATVERSE LOADER STARTED");
(function boot() {
  // Emergency killswitch - removes loader after 10 seconds NO MATTER WHAT
  const EMERGENCY_TIMEOUT = 10000;
  let loaderElement = null;
  let isInitialized = false;
  
  // Absolute failsafe
  setTimeout(() => {
    if (!isInitialized && loaderElement && loaderElement.parentNode) {
      console.error("⚠️ EMERGENCY: Force-removing stuck loader");
      loaderElement.remove();
      if (!window.SATVERSE) window.SATVERSE = {};
      window.SATVERSE.ready = true;
      window.dispatchEvent(new CustomEvent("satverse:ready"));
    }
  }, EMERGENCY_TIMEOUT);
  
  if (!document.body) {
    setTimeout(boot, 10);
    return;
  }
  
  /* ---------- STYLES ---------- */
  const style = document.createElement("style");
  style.textContent = `
    #satverse-loader {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center,#1a1f24,#0a0c0d);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: opacity .4s ease;
    }
    #satverse-loader h1 {
      font-size: clamp(3rem,9vw,4.2rem);
      font-weight: 900;
      letter-spacing: 4px;
      background: linear-gradient(90deg,#3ab5f0,#2ecc71);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      color: transparent;
      animation: glow 1.4s infinite ease-in-out;
    }
    @keyframes glow {
      0%{opacity:.6}
      50%{opacity:1}
      100%{opacity:.6}
    }
    #name-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.65);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999998;
    }
    .name-box {
      background: rgba(255,255,255,.06);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255,255,255,.15);
      border-radius: 16px;
      padding: 28px;
      width: 90%;
      max-width: 360px;
      text-align: center;
      color: #fff;
    }
    .name-box h2 { margin-bottom: 8px; }
    .name-box p {
      font-size: .9rem;
      color: #aaa;
      margin-bottom: 14px;
    }
    .name-box input {
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.25);
      background: rgba(0,0,0,.45);
      color: #fff;
      font-size: 1rem;
      box-sizing: border-box;
    }
    .name-box button {
      margin-top: 14px;
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      background: linear-gradient(90deg,#3ab5f0,#2ecc71);
      color: #000;
      transition: opacity .2s;
    }
    .name-box button:hover {
      opacity: 0.9;
    }
    .name-box .skip-link {
      margin-top: 12px;
      font-size: 0.85rem;
      color: #888;
      cursor: pointer;
      text-decoration: underline;
    }
    .name-box .skip-link:hover {
      color: #aaa;
    }
    .name-box .error {
      color: #ff6b6b;
      font-size: 0.85rem;
      margin-top: 8px;
      display: none;
    }
    .name-box .error.show {
      display: block;
    }
  `;
  document.head.appendChild(style);
  
  /* ---------- LOADER ---------- */
  const loader = document.createElement("div");
  loader.id = "satverse-loader";
  loader.innerHTML = `<h1>SATVERSE</h1>`;
  document.body.appendChild(loader);
  loaderElement = loader; // Store reference for emergency removal
  
  /* ---------- SAFE STORAGE ---------- */
  const Storage = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn("LocalStorage read failed:", e);
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        console.warn("LocalStorage write failed:", e);
        return false;
      }
    }
  };
  
  /* ---------- VALIDATE NAME ---------- */
  function validateName(name) {
    const trimmed = name.trim();
    if (!trimmed) {
      return { valid: false, error: "Name cannot be empty" };
    }
    if (trimmed.length < 2) {
      return { valid: false, error: "Name must be at least 2 characters" };
    }
    if (trimmed.length > 20) {
      return { valid: false, error: "Name must be 20 characters or less" };
    }
    if (!/^[a-zA-Z0-9\s\-_'.]+$/.test(trimmed)) {
      return { valid: false, error: "Name contains invalid characters" };
    }
    return { valid: true, name: trimmed };
  }
  
  /* ---------- PLAYER NAME ---------- */
  function askName() {
    return new Promise((resolve, reject) => {
      // Timeout for name input (auto-resolve after 30 seconds)
      const nameTimeout = setTimeout(() => {
        console.warn("Name input timeout - using guest mode");
        Storage.set("playerName", "Guest");
        resolve();
      }, 30000);
      
      const existingName = Storage.get("playerName");
      if (existingName) {
        console.log("Player name found:", existingName);
        clearTimeout(nameTimeout);
        return resolve();
      }
      
      const overlay = document.createElement("div");
      overlay.id = "name-overlay";
      overlay.innerHTML = `
        <div class="name-box">
          <h2>Welcome to SATVERSE</h2>
          <p>Enter your player name</p>
          <input id="sv-name" placeholder="Your name" maxlength="20" autocomplete="off">
          <button id="sv-save">Continue</button>
          <div class="skip-link" id="sv-skip">Skip (use Guest)</div>
          <div class="error" id="sv-error"></div>
        </div>
      `;
      document.body.appendChild(overlay);
      
      const input = document.getElementById("sv-name");
      const button = document.getElementById("sv-save");
      const skipBtn = document.getElementById("sv-skip");
      const errorEl = document.getElementById("sv-error");
      
      function cleanup() {
        clearTimeout(nameTimeout);
        if (overlay && overlay.parentNode) {
          overlay.remove();
        }
      }
      
      function showError(msg) {
        errorEl.textContent = msg;
        errorEl.classList.add("show");
      }
      
      function hideError() {
        errorEl.classList.remove("show");
      }
      
      function finalize(name) {
        Storage.set("playerName", name);
        console.log("Player name saved:", name);
        cleanup();
        resolve();
      }
      
      function handleSubmit() {
        hideError();
        const validation = validateName(input.value);
        
        if (!validation.valid) {
          showError(validation.error);
          input.focus();
          return;
        }
        
        finalize(validation.name);
      }
      
      // Click handler
      button.onclick = handleSubmit;
      
      // Skip handler
      skipBtn.onclick = () => {
        finalize("Guest");
      };
      
      // Enter key
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          handleSubmit();
        }
      });
      
      // Escape key to skip
      document.addEventListener("keydown", function escHandler(e) {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", escHandler);
          finalize("Guest");
        }
      });
      
      // Focus input
      setTimeout(() => input.focus(), 100);
    });
  }
  
  /* ---------- LOADER REMOVAL ---------- */
  function removeLoader() {
    console.log("🔄 Removing loader...");
    
    if (!loader || !loader.parentNode) {
      console.warn("Loader already removed");
      isInitialized = true;
      return;
    }
    
    loader.style.opacity = "0";
    
    setTimeout(() => {
      if (loader && loader.parentNode) {
        loader.remove();
        console.log("✅ SATVERSE READY");
      }
      isInitialized = true;
    }, 400);
    
    // Set ready flag immediately
    if (!window.SATVERSE) window.SATVERSE = {};
    window.SATVERSE.ready = true;
    
    // Dispatch event
    try {
      window.dispatchEvent(new CustomEvent("satverse:ready"));
    } catch (e) {
      console.warn("Event dispatch failed:", e);
    }
  }
  
  /* ---------- MAIN INITIALIZATION ---------- */
  async function initialize() {
    console.log("🚀 Initializing SATVERSE...");
    
    if (isInitialized) {
      console.log("Already initialized, skipping...");
      return;
    }
    
    try {
      await askName();
      removeLoader();
    } catch (error) {
      console.error("Initialization error:", error);
      removeLoader(); // Always remove loader even on error
    }
  }
  
  /* ---------- START INITIALIZATION ---------- */
  // Start immediately - don't wait for any events
  console.log("📍 Document state:", document.readyState);
  
  // Use setTimeout to break out of current execution context
  setTimeout(() => {
    initialize().catch(err => {
      console.error("Fatal initialization error:", err);
      removeLoader();
    });
  }, 100);
  
})();
