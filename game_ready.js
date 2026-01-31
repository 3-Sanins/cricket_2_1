// Firebase Configuration (Use your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyClRQbU3N7F2F9Pp6BYirjcQxZEyVuxcXo",
  authDomain: "cric-283bd.firebaseapp.com",
  databaseURL: "https://cric-283bd-default-rtdb.firebaseio.com",
  projectId: "cric-283bd",
  storageBucket: "cric-283bd.firebasestorage.app",
  messagingSenderId: "509305000521",
  appId: "1:509305000521:web:2c16c4f7d2e85f98476598"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Global Variables
let playerName = localStorage.getItem("playerName");
let tournamentName, matchType, user1, user2, homeTeam;
let isPlayer = false;
let isSpectator = false;

// DOM Elements
const elements = {
  tournamentTitle: document.getElementById('tournamentTitle'),
  matchInfo: document.getElementById('matchInfo'),

  // Team Stats
  team1Name: document.getElementById('team1Name'),
  team1Matches: document.getElementById('team1Matches'),
  team1Wins: document.getElementById('team1Wins'),
  team1Draws: document.getElementById('team1Draws'),
  team1Losses: document.getElementById('team1Losses'),
  team1Points: document.getElementById('team1Points'),
  team1Money: document.getElementById('team1Money'),

  team2Name: document.getElementById('team2Name'),
  team2Matches: document.getElementById('team2Matches'),
  team2Wins: document.getElementById('team2Wins'),
  team2Draws: document.getElementById('team2Draws'),
  team2Losses: document.getElementById('team2Losses'),
  team2Points: document.getElementById('team2Points'),
  team2Money: document.getElementById('team2Money'),

  // Sections
  proceedSection: document.getElementById('proceedSection'),
  pitchSection: document.getElementById('pitchSection'),
  tossSection: document.getElementById('tossSection'),
  tossResult: document.getElementById('tossResult'),
  tossChoiceSection: document.getElementById('tossChoiceSection'),
  waitingToss: document.getElementById('waitingToss'),
  roleSection: document.getElementById('roleSection'),
  roleTitle: document.getElementById('roleTitle'),
  pitchDisplay: document.getElementById('pitchDisplay'),
  waitingSection: document.getElementById('waitingSection'),
  waitingMessage: document.getElementById('waitingMessage'),
  spectatorSection: document.getElementById('spectatorSection'),
  messageSection: document.getElementById('messageSection'),
  messageText: document.getElementById('messageText'),

  // Buttons
  proceedBtn: document.getElementById('proceedBtn'),
  spectatorProceedBtn: document.getElementById('spectatorProceedBtn'),
  chooseBat: document.getElementById('chooseBat'),
  chooseBall: document.getElementById('chooseBall'),
  teamSelectionBtn: document.getElementById('teamSelectionBtn'),
  pitchButtons: document.querySelectorAll('.pitch-btn'),

  // Popup
  popup: document.getElementById('popup'),
  popupText: document.getElementById('popupText'),
  popupClose: document.getElementById('popupClose')
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
  if (!playerName) {
    showPopup("Player not logged in");
    setTimeout(() => window.location.href = "/", 2000);
    return;
  }

/*  // TESTING - Set hardcoded values
  tournamentName = "FPL";
  matchType = "league";
  user1 = "Akshit";
  user2 = "Arnav";
  homeTeam = Math.random() < 0.5 ? "Akshit" : "Arnav";
*/
  // To use URL params instead (for production), comment above and uncomment below:
  
  const params = new URLSearchParams(window.location.search);
  tournamentName = params.get("tournamentname");
  matchType = params.get("matchtype") || "league";
  user1 = params.get("user1");
  user2 = params.get("user2");
  homeTeam = params.get("home");
  
  if (!tournamentName || !user1 || !user2) {
    showPopup("Invalid match parameters");
    setTimeout(() => window.location.href = "/tournaments.html", 2000);
    return;
  }

  // Determine user type
  isPlayer = (playerName === user1 || playerName === user2);
  isSpectator = !isPlayer;

  // Set UI
  elements.tournamentTitle.textContent = tournamentName.toUpperCase();
  elements.matchInfo.textContent = `${matchType.toUpperCase()} MATCH: ${user1} vs ${user2}`;

  if (matchType === "league" && homeTeam) {
    elements.matchInfo.textContent += ` | Home: ${homeTeam}`;
  }

  // Load team stats
  loadTeamStats();

  // Show appropriate section
  if (isSpectator) {
    showSpectatorSection();
  } else {
    setupPlayer();
  }

  // Setup event listeners
  setupEventListeners();
}

function loadTeamStats() {
  const tRef = db.ref(`tournament/${tournamentName}/users`);

  tRef.once("value").then(snapshot => {
    const users = snapshot.val();

    // Team 1 (user1)
    const team1 = users[user1] || {};
    elements.team1Name.textContent = user1;
    elements.team1Matches.textContent = team1.matchesPlayed || 0;
    elements.team1Wins.textContent = team1.wins || 0;
    elements.team1Draws.textContent = team1.draw || 0;
    elements.team1Losses.textContent = (team1.matchesPlayed || 0) - (team1.wins || 0) - (team1.draw || 0);
    elements.team1Points.textContent = (team1.wins || 0) * 2 + (team1.draw || 0);
    elements.team1Money.textContent = formatMoney(team1.money || 0);

    // Team 2 (user2)
    const team2 = users[user2] || {};
    elements.team2Name.textContent = user2;
    elements.team2Matches.textContent = team2.matchesPlayed || 0;
    elements.team2Wins.textContent = team2.wins || 0;
    elements.team2Draws.textContent = team2.draw || 0;
    elements.team2Losses.textContent = (team2.matchesPlayed || 0) - (team2.wins || 0) - (team2.draw || 0);
    elements.team2Points.textContent = (team2.wins || 0) * 2 + (team2.draw || 0);
    elements.team2Money.textContent = formatMoney(team2.money || 0);
  });
}

function setupPlayer() {
  const gameRef = db.ref(`tournament/${tournamentName}/game`);

  // Listen for game state changes
  gameRef.on("value", handleGameStateChange);
}

function handleGameStateChange(snapshot) {
  if (!snapshot.exists()) {
    // Game node doesn't exist
    showProceedSection();
    return;
  }

  const game = snapshot.val();
  const status = game.status;
  if (status === "play") {
    const params = new URLSearchParams(window.location.search);
    window.location.href = `/maingame.html?${params.toString()}`;
    return;
  }

  if (status === "yet") {
    // Waiting for opponent
    if (game[playerName]) {
      showWaitingMessage("Waiting for opponent to proceed...");
    } else {
      showProceedSection();
    }
  } else if (status === "start") {
    // Game started
    handleGameStarted(game);
  }
}

function handleGameStarted(game) {
  // Check if pitch is set
  if (!game.pitch) {
    // Need pitch selection
    if (matchType === "league" && playerName === homeTeam) {
      showPitchSelection();
    } else {
      showWaitingMessage("Home team is selecting pitch...");
    }
    return;
  }

  // Pitch is set, check inning
  if (!game.inning) {
    // Toss not decided yet
    handleTossPhase(game);
  } else {
    // Inning set, show role
    showRoleSection(game);
  }
}

function handleTossPhase(game) {
  const tossWinner = game.toss;
  const isTossWinner = (playerName === tossWinner);

  showTossSection();
  elements.tossResult.innerHTML = isTossWinner ?
    "<span class='waiting-animation'>🎉 YOU WON THE TOSS!</span>" :
    "😔 YOU LOST THE TOSS";

  // Show pitch info
  if (game.pitch) {
    elements.tossResult.innerHTML += `<br><small>Pitch: ${game.pitch.toUpperCase()}</small>`;
  }

  if (isTossWinner) {
    elements.tossChoiceSection.classList.remove("hidden");
    elements.waitingToss.classList.add("hidden");

    // Check if pitch exists for knockout
    if (matchType !== "league" && !game.pitch) {
      // Generate random pitch for knockout
      const pitches = ["balanced", "flat", "green", "cracked"];
      const randomPitch = pitches[Math.floor(Math.random() * 4)];
      db.ref(`tournament/${tournamentName}/game`).update({ pitch: randomPitch });
    }
  } else {
    elements.tossChoiceSection.classList.add("hidden");
    elements.waitingToss.classList.remove("hidden");
  }
}

function showRoleSection(game) {
  const isBatting = (game.batting === playerName);
  const role = isBatting ? "BAT 🏏" : "BOWL 🎾";

  elements.roleTitle.textContent = `You are going to ${role}`;

  // Show pitch info
  if (game.pitch) {
    elements.pitchDisplay.textContent = `Pitch: ${game.pitch.toUpperCase()}`;
  }

  hideAllSections();
  elements.roleSection.classList.remove("hidden");
}

function showProceedSection() {
  hideAllSections();
  elements.proceedSection.classList.remove("hidden");
}

function showPitchSelection() {
  hideAllSections();
  elements.pitchSection.classList.remove("hidden");
}

function showTossSection() {
  hideAllSections();
  elements.tossSection.classList.remove("hidden");
}

function showWaitingMessage(message) {
  hideAllSections();
  elements.waitingSection.classList.remove("hidden");
  elements.waitingMessage.textContent = message;
}

function showSpectatorSection() {
  hideAllSections();
  elements.spectatorSection.classList.remove("hidden");
}

function hideAllSections() {
  elements.proceedSection.classList.add("hidden");
  elements.pitchSection.classList.add("hidden");
  elements.tossSection.classList.add("hidden");
  elements.roleSection.classList.add("hidden");
  elements.waitingSection.classList.add("hidden");
  elements.spectatorSection.classList.add("hidden");
}

function setupEventListeners() {
  // Proceed Button (Player)
  elements.proceedBtn.addEventListener("click", handleProceedClick);

  // Proceed Button (Spectator)
  elements.spectatorProceedBtn.addEventListener("click", handleSpectatorProceed);

  // Pitch Selection
  elements.pitchButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const pitch = e.currentTarget.dataset.pitch;
      selectPitch(pitch);
    });
  });

  // Toss Choices
  elements.chooseBat.addEventListener("click", () => chooseBatBall("bat"));
  elements.chooseBall.addEventListener("click", () => chooseBatBall("ball"));

  // Team Selection
  elements.teamSelectionBtn.addEventListener("click", goToTeamSelection);

  // Popup
  elements.popupClose.addEventListener("click", () => {
    elements.popup.classList.add("hidden");
  });
}

function handleProceedClick() {
  const gameRef = db.ref(`tournament/${tournamentName}/game`);

  // FIRST CHECK: If status is already "play", redirect immediately
  gameRef.once("value").then(snapshot => {
    if (snapshot.exists() && snapshot.val().status === "play") {
      // Redirect to maingame.html
      const params = new URLSearchParams(window.location.search);
      window.location.href = `/maingame.html?${params.toString()}`;
      return; // Exit function
    }

    // If not "play", continue with existing logic
    if (!snapshot.exists()) {
      // Create game node
      return gameRef.set({
        status: "yet",
        [playerName]: true,
        matchtype: matchType,
        ...(matchType === "league" && homeTeam && { home: homeTeam })
      });
    } else {
      const game = snapshot.val();

      if (game.status === "yet" && !game[playerName]) {
        // Both players ready - start game
        const tossWinner = Math.random() < 0.5 ? user1 : user2;

        return gameRef.update({
          status: "start",
          [playerName]: true,
          toss: tossWinner
        }).then(() => {
          // For knockout matches, generate random pitch
          if (matchType !== "league") {
            const pitches = ["balanced", "flat", "green", "cracked"];
            const randomPitch = pitches[Math.floor(Math.random() * 4)];
            return gameRef.update({ pitch: randomPitch });
          }
        });
      }
    }
  }).catch(error => {
    console.error("Error:", error);
    showMessage("Error: " + error.message);
  });
}
function handleSpectatorProceed() {
        const gameRef = db.ref(`tournament/${tournamentName}/game`);

        gameRef.once("value").then(snapshot => {
          if (snapshot.exists() && snapshot.val().status === "play") {
            // Redirect to maingame.html for watching
            const params = new URLSearchParams(window.location.search);
            window.location.href = `/maingame.html?${params.toString()}`;
          } else {
            showPopup("Match is not started yet");
            setTimeout(() => {
              window.location.href = `/tournaments.html?tournamentname=${encodeURIComponent(tournamentName)}`;
            }, 2000);
          }
        });
      }

      function selectPitch(pitch) {
        const gameRef = db.ref(`tournament/${tournamentName}/game`);
        gameRef.update({ pitch: pitch })
          .then(() => {
            showMessage(`Pitch selected: ${pitch.toUpperCase()}`);
          })
          .catch(error => {
            console.error("Error selecting pitch:", error);
            showMessage("Error selecting pitch");
          });
      }

      function chooseBatBall(choice) {
        const gameRef = db.ref(`tournament/${tournamentName}/game`);

        gameRef.once("value").then(snapshot => {
          const game = snapshot.val();
          const tossWinner = game.toss;

          if (playerName !== tossWinner) {
            showMessage("Only toss winner can choose");
            return;
          }

          const updates = {
            inning: "inning1"
          };

          if (choice === "bat") {
            updates.batting = tossWinner;
            updates.bowling = (tossWinner === user1) ? user2 : user1;
          } else {
            updates.bowling = tossWinner;
            updates.batting = (tossWinner === user1) ? user2 : user1;
          }

          gameRef.update(updates)
            .then(() => {
              showMessage(`You chose to ${choice.toUpperCase()}`);
            })
            .catch(error => {
              console.error("Error:", error);
              showMessage("Error saving choice");
            });
        });
      }

      function goToTeamSelection() {
        const params = new URLSearchParams(window.location.search);
        window.location.href = `/team_selection.html?${params.toString()}`;
      }

      function showPopup(message) {
        elements.popupText.textContent = message;
        elements.popup.classList.remove("hidden");
      }

      function showMessage(message) {
        elements.messageText.textContent = message;
        elements.messageSection.classList.remove("hidden");
        setTimeout(() => {
          elements.messageSection.classList.add("hidden");
        }, 3000);
      }

      function formatMoney(amount) {
        if (amount >= 10000000) {
          return `₹${(amount / 10000000).toFixed(1)}Cr`;
        } else if (amount >= 100000) {
          return `₹${(amount / 100000).toFixed(1)}L`;
        } else {
          return `₹${amount}`;
        }
      }
