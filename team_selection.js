// Firebase Configuration (Same as game_ready.html)
const firebaseConfig = {
    apiKey: "AIzaSyClRQbU3N7F2F9Pp6BYirjcQxZEyVuxcXo",
    authDomain: "cric-283bd.firebasestorage.app",
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
let selectedPlayers = new Set();
let captainId = null;
let allPlayers = [];
let filteredPlayers = [];

// DOM Elements
const elements = {
    tournamentTitle: document.getElementById('tournamentTitle'),
    matchInfo: document.getElementById('matchInfo'),
    pitchType: document.getElementById('pitchType'),
    playerRole: document.getElementById('playerRole'),
    selectedCount: document.getElementById('selectedCount'),
    captainName: document.getElementById('captainName'),
    playersTableBody: document.getElementById('playersTableBody'),
    searchInput: document.getElementById('searchInput'),
    filterSelect: document.getElementById('filterSelect'),
    selectedPlayersList: document.getElementById('selectedPlayersList'),
    submitBtn: document.getElementById('submitBtn'),
    backBtn: document.getElementById('backBtn'),
    playerPopup: document.getElementById('playerPopup'),
    popupPlayerName: document.getElementById('popupPlayerName'),
    popupBatting: document.getElementById('popupBatting'),
    popupBowling: document.getElementById('popupBowling'),
    popupHand: document.getElementById('popupHand'),
    popupType: document.getElementById('popupType'),
    popupStrengths: document.getElementById('popupStrengths'),
    popupWeaknesses: document.getElementById('popupWeaknesses'),
    weaknessSection: document.getElementById('weaknessSection'),
    closePopup: document.getElementById('closePopup'),
    warningPopup: document.getElementById('warningPopup'),
    warningText: document.getElementById('warningText'),
    warningClose: document.getElementById('warningClose'),
    loadingOverlay: document.getElementById('loadingOverlay')
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    // TESTING MODE - Remove for production
    if (!window.location.search) {
        // Default testing values
        tournamentName = "FPL";
        matchType = "league";
        user1 = "Akshit";
        user2 = "Lakshya";
        playerName = playerName || "Akshit";
        localStorage.setItem("playerName", playerName);
        homeTeam = "Akshit";
    } else {
        // Production mode
        const params = new URLSearchParams(window.location.search);
        const tournamentParam = params.get("tournamentname");
        tournamentName = tournamentParam ? tournamentParam.toUpperCase() : "";
        matchType = params.get("matchtype") || "league";
        user1 = params.get("user1");
        user2 = params.get("user2");
        homeTeam = params.get("home");
    }

    if (!playerName) {
        showWarning("Player not logged in");
        setTimeout(() => window.location.href = "/", 2000);
        return;
    }

    if (!tournamentName || !user1 || !user2) {
        showWarning("Invalid match parameters");
        setTimeout(() => window.location.href = "/tournaments.html", 2000);
        return;
    }

    // Check if user is part of this match
    if (playerName !== user1 && playerName !== user2) {
        showWarning("You are not part of this match");
        setTimeout(() => window.location.href = `/tournaments.html?tournamentname=${encodeURIComponent(tournamentName)}`, 2000);
        return;
    }

    // Set UI
    elements.tournamentTitle.textContent = tournamentName.toUpperCase();
    elements.matchInfo.textContent = `${matchType.toUpperCase()} MATCH: ${user1} vs ${user2}`;
    
    // Validate user can access this page
    validateUserAccess();
    
    // Setup event listeners
    setupEventListeners();
}

function validateUserAccess() {
    const gameRef = db.ref(`tournament/${tournamentName}/game`);
    
    gameRef.once("value").then(snapshot => {
        if (!snapshot.exists()) {
            showWarning("Match not found");
            setTimeout(() => window.location.href = `/tournaments.html?tournamentname=${encodeURIComponent(tournamentName)}`, 2000);
            return;
        }
        
        const game = snapshot.val();
        
        // Check if user is in the game
        if (!game[playerName]) {
            showWarning("You are not part of this match");
            setTimeout(() => window.location.href = `/tournaments.html?tournamentname=${encodeURIComponent(tournamentName)}`, 2000);
            return;
        }
        
        // Check status
        if (game.status === "play") {
            // Match already started, redirect to maingame
            redirectToMaingame();
            return;
        } else if (game.status.startsWith("play1")) {
            const opponentName = game.status.replace("play1", "");
            if (opponentName === playerName) {
                // User already submitted, redirect to maingame
                redirectToMaingame();
                return;
            }
        }
        
        // Load game info
        loadGameInfo(game);
        
    }).catch(error => {
        console.error("Error:", error);
        showWarning("Error accessing match data");
    });
}

function loadGameInfo(game) {
    // Set pitch type
    if (game.pitch) {
        elements.pitchType.textContent = game.pitch.toUpperCase();
    }
    
    // Set player role
    if (game.batting === playerName) {
        elements.playerRole.textContent = "BAT 🏏";
        elements.playerRole.style.color = "#4cc9f0";
    } else if (game.bowling === playerName) {
        elements.playerRole.textContent = "BOWL 🎾";
        elements.playerRole.style.color = "#f72585";
    }
    
    // Load user's team players
    loadUserPlayers();
}

function loadUserPlayers() {
  elements.loadingOverlay.classList.remove("hidden");

  const teamRef = db.ref(
    `tournament/${tournamentName}/users/${playerName}/players`
  );

  teamRef.once("value")
    .then(snapshot => {
      const teamData = snapshot.val();
      allPlayers = [];

      if (!teamData) {
        console.error("❌ team empty");
        elements.loadingOverlay.classList.add("hidden");
        return;
      }

      for (const playerId in teamData) {
        const player = teamData[playerId];
        player.id = playerId;
        allPlayers.push(player);
      }

      console.log("✅ Players loaded from team:", allPlayers.length);

      loadSelectedTeam();
    })
    .catch(err => {
      console.error(err);
      elements.loadingOverlay.classList.add("hidden");
    });
}

function loadSelectedTeam() {
  const userSelectedRef = db.ref(
    `tournament/${tournamentName}/users/${playerName}/selected_team`
  );

  selectedPlayers.clear();
  captainId = null;

  userSelectedRef.once("value")
    .then(snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.val();

        // restore players
        if (data.players) {
          Object.keys(data.players).forEach(pid => {
            selectedPlayers.add(pid);
          });
        }

        // restore captain
        if (data.captain) {
          captainId = data.captain;
          elements.captainName.textContent = captainId;
        }

        // 🔥 COPY TO GAME PLAYING11
        db.ref(
          `tournament/${tournamentName}/game/${playerName}/playing11`
        ).set(data);
      }

      filteredPlayers = [...allPlayers];

      renderPlayersTable();
      renderSelectedPlayersList();
      updateSelectionCounter();
      updateSubmitButton();

      elements.loadingOverlay.classList.add("hidden");
    })
    .catch(err => {
      console.error(err);
      elements.loadingOverlay.classList.add("hidden");
    });
}


function renderPlayersTable() {
  elements.playersTableBody.innerHTML = "";

  if (!filteredPlayers || filteredPlayers.length === 0) {
    elements.playersTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:#aaa">
          No players available
        </td>
      </tr>
    `;
    return;
  }

    filteredPlayers.forEach(player => {
        const isSelected = selectedPlayers.has(player.id);
        const isCaptain = (player.id === captainId);
        
        // Determine player role
        let role = "All-rounder";
        let roleClass = "role-allrounder";
        if (player.battingRating >= 70 && player.bowlingRating < 30) {
            role = "Batsman";
            roleClass = "role-batsman";
        } else if (player.bowlingRating >= 70 && player.battingRating < 30) {
            role = "Bowler";
            roleClass = "role-bowler";
        }
        
        // Determine hand
        let handIcon = "🤚";
        let handText = "R";
        if (player.type && player.type.includes("left hand")) {
            handIcon = "✋";
            handText = "L";
        }
        
        // Get key strength
        let keyStrength = "";
        if (player.strengths && player.strengths.length > 0) {
            keyStrength = player.strengths[0].split(" ")[0];
        }
        
        const row = document.createElement("tr");
        row.className = isSelected ? "selected" : "";
        row.className += isCaptain ? " captain" : "";
        row.dataset.playerId = player.id;
        
        row.innerHTML = `
            <td>
                <input type="checkbox" ${isSelected ? "checked" : ""} 
                       onclick="event.stopPropagation(); togglePlayerSelection('${player.id}')">
            </td>
            <td class="player-name">${player.name}</td>
            <td><span class="player-role ${roleClass}">${role}</span></td>
            <td class="rating">${player.battingRating || 0}</td>
            <td class="rating">${player.bowlingRating || 0}</td>
            <td class="hand-icon" title="${handText} Hand">${handIcon}</td>
            <td><span class="strength-tag">${keyStrength}</span></td>
            <td>
                <div class="action-buttons">
                    ${isSelected ? 
                        `<button class="action-btn deselect-btn" onclick="event.stopPropagation(); togglePlayerSelection('${player.id}')">
                            Deselect
                        </button>` :
                        `<button class="action-btn select-btn" onclick="event.stopPropagation(); togglePlayerSelection('${player.id}')">
                            Select
                        </button>`
                    }
                    ${isSelected && !isCaptain ? 
                        `<button class="action-btn captain-btn" onclick="event.stopPropagation(); makeCaptain('${player.id}')">
                            Make Captain
                        </button>` : ""
                    }
                    ${isCaptain ? 
                        `<button class="action-btn remove-captain-btn" onclick="event.stopPropagation(); removeCaptain()">
                            Remove Captain
                        </button>` : ""
                    }
                </div>
            </td>
        `;
        
        // Add click event for details
        row.addEventListener("click", () => showPlayerDetails(player));
        
        elements.playersTableBody.appendChild(row);
    });
}

function renderSelectedPlayersList() {
    elements.selectedPlayersList.innerHTML = "";
    
    selectedPlayers.forEach(playerId => {
        const player = allPlayers.find(p => p.id === playerId);
        if (player) {
            const isCaptain = (playerId === captainId);
            
            const chip = document.createElement("div");
            chip.className = `player-chip ${isCaptain ? 'captain' : ''}`;
            chip.innerHTML = `
                <span class="player-chip-name">${player.name}</span>
                ${isCaptain ? '<span class="player-chip-captain">C</span>' : ''}
            `;
            
            elements.selectedPlayersList.appendChild(chip);
        }
    });
}

function showPlayerDetails(player) {
    elements.popupPlayerName.textContent = player.name;
    elements.popupBatting.textContent = player.battingRating || 0;
    elements.popupBowling.textContent = player.bowlingRating || 0;
    
    // Hand
    if (player.type && player.type.includes("left hand")) {
        elements.popupHand.textContent = "Left Hand";
    } else {
        elements.popupHand.textContent = "Right Hand";
    }
    
    // Type
    if (player.type) {
        const types = player.type.split(",");
        elements.popupType.textContent = types[0] || "Batter";
    }
    
    // Strengths
    elements.popupStrengths.innerHTML = "";
    if (player.strengths) {
        player.strengths.forEach(strength => {
            const tag = document.createElement("span");
            tag.className = "tag";
            tag.textContent = strength;
            elements.popupStrengths.appendChild(tag);
        });
    }
    
    // Weaknesses
    if (player.weakness && player.weakness.length > 0) {
        elements.weaknessSection.classList.remove("hidden");
        elements.popupWeaknesses.innerHTML = "";
        player.weakness.forEach(weakness => {
            const tag = document.createElement("span");
            tag.className = "tag weakness";
            tag.textContent = weakness;
            elements.popupWeaknesses.appendChild(tag);
        });
    } else {
        elements.weaknessSection.classList.add("hidden");
    }
    
    elements.playerPopup.classList.remove("hidden");
}

function togglePlayerSelection(playerId) {
    if (selectedPlayers.has(playerId)) {
        // Deselect player
        selectedPlayers.delete(playerId);
        
        // If this was captain, remove captain
        if (playerId === captainId) {
            captainId = null;
            elements.captainName.textContent = "Not Selected";
        }
    } else {
        // Select player
        if (selectedPlayers.size >= 11) {
            showWarning("Only 11 players can be selected");
            return;
        }
        selectedPlayers.add(playerId);
    }
    
    // Update UI
    renderPlayersTable();
    renderSelectedPlayersList();
    updateSelectionCounter();
    updateSubmitButton();
}

function makeCaptain(playerId) {
    if (!selectedPlayers.has(playerId)) {
        showWarning("Player must be selected to make captain");
        return;
    }
    
    captainId = playerId;
    const captain = allPlayers.find(p => p.id === playerId);
    if (captain) {
        elements.captainName.textContent = captain.name;
    }
    
    renderPlayersTable();
    renderSelectedPlayersList();
    updateSubmitButton();
}

function removeCaptain() {
    captainId = null;
    elements.captainName.textContent = "Not Selected";
    
    renderPlayersTable();
    renderSelectedPlayersList();
    updateSubmitButton();
}

function updateSelectionCounter() {
    elements.selectedCount.textContent = `${selectedPlayers.size}/11`;
}

function updateSubmitButton() {
    const canSubmit = (selectedPlayers.size === 11 && captainId !== null);
    elements.submitBtn.disabled = !canSubmit;
}

function setupEventListeners() {
    // Search input
    elements.searchInput.addEventListener("input", filterPlayers);
    
    // Filter select
    elements.filterSelect.addEventListener("change", filterPlayers);
    
    // Submit button
    elements.submitBtn.addEventListener("click", submitTeam);
    
    // Back button
    elements.backBtn.addEventListener("click", () => {
        window.history.back();
    });
    
    // Popup close
    elements.closePopup.addEventListener("click", () => {
        elements.playerPopup.classList.add("hidden");
    });
    
    // Warning popup close
    elements.warningClose.addEventListener("click", () => {
        elements.warningPopup.classList.add("hidden");
    });
    
    // Click outside popup to close
    elements.playerPopup.addEventListener("click", (e) => {
        if (e.target === elements.playerPopup) {
            elements.playerPopup.classList.add("hidden");
        }
    });
    
    elements.warningPopup.addEventListener("click", (e) => {
        if (e.target === elements.warningPopup) {
            elements.warningPopup.classList.add("hidden");
        }
    });
}

function filterPlayers() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const filterValue = elements.filterSelect.value;
    
    filteredPlayers = allPlayers.filter(player => {
        // Search filter
        const matchesSearch = player.name.toLowerCase().includes(searchTerm);
        
        // Role filter
        let matchesRole = true;
        if (filterValue !== "all") {
            if (filterValue === "batsman") {
                matchesRole = (player.battingRating >= 70 && player.bowlingRating < 30);
            } else if (filterValue === "bowler") {
                matchesRole = (player.bowlingRating >= 70 && player.battingRating < 30);
            } else if (filterValue === "allrounder") {
                matchesRole = !(player.battingRating >= 70 && player.bowlingRating < 30) &&
                              !(player.bowlingRating >= 70 && player.battingRating < 30);
            }
        }
        
        return matchesSearch && matchesRole;
    });
    
    renderPlayersTable();
}

async function submitTeam() {
  if (selectedPlayers.size !== 11) {
    showWarning("Select exactly 11 players");
    return;
  }

  if (!captainId) {
    showWarning("Select a captain");
    return;
  }

  const playersObj = {};

  selectedPlayers.forEach(pid => {
    const p = allPlayers.find(x => x.id === pid);
    if (p) {
      const copy = { ...p };
      delete copy.id;
      playersObj[pid] = copy;
    }
  });

  const selectedTeamData = {
    captain: captainId,
    players: playersObj
  };

  const userSelectedRef = db.ref(
    `tournament/${tournamentName}/users/${playerName}/selected_team`
  );

  const gamePlayingRef = db.ref(
    `tournament/${tournamentName}/game/${playerName}/playing11`
  );

  try {
    await Promise.all([
      userSelectedRef.set(selectedTeamData),
      gamePlayingRef.set(selectedTeamData)
    ]);

    redirectToMaingame();
  } catch (err) {
    console.error(err);
    showWarning("Failed to submit team");
  }
}


function redirectToMaingame() {
    const params = new URLSearchParams(window.location.search);
    window.location.href = `/maingame.html?${params.toString()}`;
}

function showWarning(message) {
    elements.warningText.textContent = message;
    elements.warningPopup.classList.remove("hidden");
}

// Make functions available globally for onclick handlers
window.togglePlayerSelection = togglePlayerSelection;
window.makeCaptain = makeCaptain;
window.removeCaptain = removeCaptain;
