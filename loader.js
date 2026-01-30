(function () {
  /* ===============================
     Inject Loader + Popup Styles
  =============================== */
  const style = document.createElement("style");
  style.innerHTML = `
    /* Loader */
    #satverse-loader {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at center, #1a1f24 0%, #0a0c0d 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: opacity 0.4s ease;
    }

    #satverse-loader h1 {
      font-size: clamp(2.8rem, 10vw, 4rem);
      font-weight: 900;
      letter-spacing: 4px;
      background: linear-gradient(90deg, #3ab5f0, #2ecc71);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: glow 1.5s infinite ease-in-out;
    }

    @keyframes glow {
      0% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
      100% { opacity: 0.6; transform: scale(1); }
    }

    /* Popup Overlay */
    #name-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999998;
    }

    .name-popup {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 16px;
      padding: 30px;
      width: 90%;
      max-width: 360px;
      text-align: center;
      color: #fff;
    }

    .name-popup h2 {
      margin-bottom: 10px;
      font-size: 1.6rem;
    }

    .name-popup p {
      color: #aaa;
      font-size: 0.9rem;
      margin-bottom: 20px;
    }

    .name-popup input {
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(0,0,0,0.4);
      color: #fff;
      font-size: 1rem;
      outline: none;
      margin-bottom: 15px;
    }

    .name-popup button {
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      border: none;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      background: linear-gradient(90deg, #3ab5f0, #2ecc71);
      color: #000;
    }
  `;
  document.head.appendChild(style);

  /* ===============================
     Loader HTML
  =============================== */
  const loader = document.createElement("div");
  loader.id = "satverse-loader";
  loader.innerHTML = `<h1>SATVERSE</h1>`;
  document.body.appendChild(loader);

  /* ===============================
     On Page Load
  =============================== */
  window.addEventListener("load", () => {
    setTimeout(() => {
      loader.style.opacity = "0";
      setTimeout(() => loader.remove(), 400);
      checkPlayerName();
    }, 500);
  });

  /* ===============================
     Player Name Check
  =============================== */
  function checkPlayerName() {
    if (localStorage.getItem("playerName")) return;

    const overlay = document.createElement("div");
    overlay.id = "name-overlay";
    overlay.innerHTML = `
      <div class="name-popup">
        <h2>Welcome to SATVERSE</h2>
        <p>Enter your player name</p>
        <input type="text" id="playerNameInput" placeholder="Your name">
        <button id="savePlayerName">Continue</button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("savePlayerName").onclick = () => {
      const name = document.getElementById("playerNameInput").value.trim();
      if (!name) return;

      localStorage.setItem("playerName", name);
      overlay.remove();
    };
  }
})();
