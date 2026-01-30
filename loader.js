// ===== SATVERSE LOADER (STABLE BUILD) =====
console.log("SATVERSE LOADER STARTED");

(function boot() {
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
      -webkit-text-fill-color: transparent;
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
    }
  `;
  document.head.appendChild(style);

  /* ---------- LOADER ---------- */
  const loader = document.createElement("div");
  loader.id = "satverse-loader";
  loader.innerHTML = `<h1>SATVERSE</h1>`;
  document.body.appendChild(loader);

  /* ---------- PLAYER NAME ---------- */
  function askName() {
    return new Promise(resolve => {
      if (localStorage.getItem("playerName")) return resolve();

      const overlay = document.createElement("div");
      overlay.id = "name-overlay";
      overlay.innerHTML = `
        <div class="name-box">
          <h2>Welcome to SATVERSE</h2>
          <p>Enter your player name</p>
          <input id="sv-name" placeholder="Your name">
          <button id="sv-save">Continue</button>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById("sv-save").onclick = () => {
        const v = document.getElementById("sv-name").value.trim();
        if (!v) return;
        localStorage.setItem("playerName", v);
        overlay.remove();
        resolve();
      };
    });
  }

  /* ---------- FLOW ---------- */
  window.addEventListener("load", async () => {
    await askName();
    loader.style.opacity = "0";
    setTimeout(() => loader.remove(), 400);
    window.SATVERSE_READY = true;
    console.log("SATVERSE READY");
  });

})();
