const firebaseConfig = {
  apiKey: "AIzaSyClRQbU3N7F2F9Pp6BYirjcQxZEyVuxcXo",
  authDomain: "cric-283bd.firebaseapp.com",
  databaseURL: "https://cric-283bd-default-rtdb.firebaseio.com",
  projectId: "cric-283bd",
  storageBucket: "cric-283bd.firebasestorage.app",
  messagingSenderId: "509305000521",
  appId: "1:509305000521:web:2c16c4f7d2e85f98476598"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const currentTournament = (() => {
  const params = new URLSearchParams(window.location.search);
  for (const [k, v] of params.entries()) {
    if (k.toLowerCase() === "tournamentname") return v;
  }
  alert("Tournament name missing");
  throw new Error("Tournament missing");
})();

const currentUser = (() => {
  const user = localStorage.getItem("playerName");
  if (!user) {
    alert("Please log in first.");
    throw new Error("User not authenticated");
  }
  return user;
})();

let players = [];
let playerKeys = [];
let currentPlayerIndex = 0;
let currentPlayerKey = null;
let userData = {};
let playersListener = null;
let userListener = null;

const alertManager = {
  history: {},
  COOLDOWN: 2000,
  show(category, message) {
    const now = Date.now();
    const last = this.history[category];
    if (last && last.message === message && (now - last.time) < this.COOLDOWN) {
      return;
    }
    this.history[category] = { message, time: now };
    alert(message);
  }
};

function fetchData() {
  const playersRef = database.ref(`tournament/${currentTournament}/bidding_data`);
  const userRef = database.ref(`tournament/${currentTournament}/users/${currentUser}`);

  if (playersListener) playersRef.off("value", playersListener);
  if (userListener) userRef.off("value", userListener);

  playersListener = playersRef.on("value", snap => {
    const obj = snap.val() || {};
    const newPlayerKeys = Object.keys(obj);
    const newPlayers = newPlayerKeys.map(k => obj[k]);

    if (currentPlayerKey && newPlayerKeys.includes(currentPlayerKey)) {
      currentPlayerIndex = newPlayerKeys.indexOf(currentPlayerKey);
    } else if (newPlayerKeys.length > 0) {
      const wasViewingPlayer = currentPlayerKey !== null;
      currentPlayerIndex = 0;
      currentPlayerKey = newPlayerKeys[0];
      if (wasViewingPlayer) {
        alertManager.show('navigation', 'Current player removed - showing first available player');
      }
    } else {
      currentPlayerIndex = 0;
      currentPlayerKey = null;
    }

    playerKeys = newPlayerKeys;
    players = newPlayers;

    displayPlayer();
    updateButtonStates();
  }, error => {
    console.error("Error fetching players:", error);
    alertManager.show('fetch_error', "Failed to load players. Please refresh.");
  });

  userListener = userRef.on("value", snap => {
    const data = snap.val() || {};
    
    userData = {
      money: parseFloat(data.money) || 0,
      bid: parseInt(data.bid) || 0,
      players: data.players || {}
    };
    
    document.getElementById("user-money").textContent = `₹${userData.money.toLocaleString()}`;
    document.getElementById("user-players").textContent = 
      `${Object.keys(userData.players).length} Players`;
    
    updateButtonStates();
  }, error => {
    console.error("Error fetching user data:", error);
    alertManager.show('fetch_error', "Failed to load user data. Please refresh.");
  });
}

function displayPlayer() {
  if (players.length === 0 || currentPlayerIndex >= players.length) {
    document.getElementById("player-name").textContent = "No players available";
    document.getElementById("player-type").textContent = "Waiting...";
    document.getElementById("player-batting").textContent = "-";
    document.getElementById("player-bowling").textContent = "-";
    document.getElementById("player-skills").textContent = "N/A";
    document.getElementById("player-weakness").textContent = "N/A";
    document.getElementById("player-bidder").textContent = "None";
    document.getElementById("player-price").textContent = "₹0";
    document.getElementById("take-btn").disabled = true;
    document.getElementById("leave-btn").disabled = true;
    return;
  }

  const player = players[currentPlayerIndex];
  document.getElementById("player-name").textContent = player.name || "Unknown";
  
  // Extract just the type value without "Type: " prefix
  const typeText = player.type || "N/A";
  document.getElementById("player-type").textContent = typeText;
  
  // Extract just the rating values
  document.getElementById("player-batting").textContent = player.battingRating || "N/A";
  document.getElementById("player-bowling").textContent = player.bowlingRating || "N/A";
  
  document.getElementById("player-skills").textContent = 
    player.strengths ? player.strengths.join(", ") : "N/A";
  document.getElementById("player-weakness").textContent = 
    player.weakness ? player.weakness.join(", ") : "N/A";
  document.getElementById("player-bidder").textContent = player.bidder || "None";
  document.getElementById("player-price").textContent = `₹${player.price || 0}`;
}

function updateButtonStates() {
  if (players.length === 0 || currentPlayerIndex >= players.length) {
    document.getElementById("take-btn").disabled = true;
    document.getElementById("leave-btn").disabled = true;
    return;
  }

  const player = players[currentPlayerIndex];
  const userBidStatus = (userData.bid === 1);
  const isCurrentBidder = (player.bidder === currentUser);
  const shouldDisable = userBidStatus || isCurrentBidder;

  document.getElementById("take-btn").disabled = shouldDisable;
  document.getElementById("leave-btn").disabled = shouldDisable;
}

function normalizeUserBid(userObj) {
  return parseInt(userObj?.bid) || 0;
}

function allExceptUserBidOne(users, excluded) {
  return Object.keys(users)
    .filter(u => u !== excluded)
    .every(u => normalizeUserBid(users[u]) === 1);
}

function allUsersBidOne(users) {
  return Object.keys(users).every(u => normalizeUserBid(users[u]) === 1);
}

function resetAllUsersBidStatus(callback) {
  const usersRef = database.ref(`tournament/${currentTournament}/users`);
  
  usersRef.once("value")
    .then(snap => {
      const users = snap.val() || {};
      const updates = {};
      Object.keys(users).forEach(userName => {
        updates[`${userName}/bid`] = 0;
      });
      return usersRef.update(updates);
    })
    .then(callback)
    .catch(error => {
      console.error("Error resetting bid status:", error);
      if (callback) callback();
    });
}

function generateUniquePlayerKey(teamPlayers, baseName) {
  let key = baseName;
  let counter = 1;
  while (teamPlayers[key]) {
    key = `${baseName}_${counter}`;
    counter++;
  }
  return key;
}

async function transferPlayerToTeam(player, key, receivingUser) {
  const playerPrice = parseFloat(player.price) || 0;
  const tempTransferId = `temp_${Date.now()}_${Math.random()}`;
  
  const transferLockRef = database.ref(
    `tournament/${currentTournament}/transfer_locks/${tempTransferId}`
  );
  const userRef = database.ref(`tournament/${currentTournament}/users/${receivingUser}`);
  const teamRef = database.ref(`tournament/${currentTournament}/users/${receivingUser}/players`);
  const bidRef = database.ref(`tournament/${currentTournament}/bidding_data/${key}`);

  try {
    await transferLockRef.set({ player: player.name, user: receivingUser, timestamp: Date.now() });

    const userSnapshot = await userRef.once("value");
    const currentUserData = userSnapshot.val() || {};
    const currentMoney = parseFloat(currentUserData.money) || 0;

    if (currentMoney < playerPrice) {
      await transferLockRef.remove();
      throw new Error("Insufficient funds");
    }

    const teamSnapshot = await teamRef.once("value");
    const team = teamSnapshot.val() || {};
    const uniqueKey = generateUniquePlayerKey(team, player.name);

    const teamPlayerData = {
      ...player,
      originalName: player.name,
      matches: 0,
      runs: 0,
      wickets: 0
    };

    await database.ref(`tournament/${currentTournament}/users/${receivingUser}`).update({
      [`players/${uniqueKey}`]: teamPlayerData,
      money: currentMoney - playerPrice,
      bid: 0
    });

    await bidRef.remove();
    await transferLockRef.remove();
    await resetAllUsersBidStatus();

    alertManager.show('transfer_success', `Player transferred to ${receivingUser === currentUser ? 'you' : receivingUser}`);
  } catch (error) {
    await transferLockRef.remove().catch(() => {});
    console.error("Transfer error:", error);
    alertManager.show('transfer_error', error.message || "Transfer failed. Please try again.");
    throw error;
  }
}

document.getElementById("take-btn").addEventListener("click", async () => {
  if (players.length === 0 || currentPlayerIndex >= players.length) {
    alertManager.show('action_error', "No player available to bid on");
    return;
  }

  const player = players[currentPlayerIndex];
  const key = playerKeys[currentPlayerIndex];
  if (!player || !key) return;

  document.getElementById("take-btn").disabled = true;

  try {
    const usersSnapshot = await database.ref(`tournament/${currentTournament}/users`).once("value");
    const users = usersSnapshot.val() || {};

    if (allExceptUserBidOne(users, currentUser)) {
      await transferPlayerToTeam(player, key, currentUser);
      return;
    }

    const userSnapshot = await database.ref(`tournament/${currentTournament}/users/${currentUser}`).once("value");
    const freshUserData = userSnapshot.val() || {};
    const currentMoney = parseFloat(freshUserData.money) || 0;
    const currentPrice = parseFloat(player.price) || 0;
    const newPrice = currentPrice * 1.1;

    if (newPrice > currentMoney) {
      alertManager.show('funds_error', "Insufficient funds");
      document.getElementById("take-btn").disabled = false;
      return;
    }

    const bidRef = database.ref(`tournament/${currentTournament}/bidding_data/${key}`);
    const result = await bidRef.transaction(currentData => {
      if (!currentData) return;
      return {
        ...currentData,
        bidder: currentUser,
        price: newPrice
      };
    });

    if (!result.committed) {
      alertManager.show('bid_error', "Bid failed - player may have been removed");
    }
  } catch (error) {
    console.error("Error placing bid:", error);
    alertManager.show('bid_error', "Failed to place bid. Please try again.");
    document.getElementById("take-btn").disabled = false;
  }
});

document.getElementById("leave-btn").addEventListener("click", async () => {
  if (players.length === 0 || currentPlayerIndex >= players.length) {
    alertManager.show('action_error', "No player available");
    return;
  }

  const player = players[currentPlayerIndex];
  const key = playerKeys[currentPlayerIndex];
  if (!player || !key) return;

  const bidder = player.bidder || "";
  document.getElementById("leave-btn").disabled = true;

  try {
    const bidRef = database.ref(`tournament/${currentTournament}/bidding_data/${key}`);
    
    await bidRef.transaction(currentData => {
      if (!currentData) return;
      return currentData;
    });

    await database.ref(`tournament/${currentTournament}/users/${currentUser}/bid`).set(1);

    const usersSnapshot = await database.ref(`tournament/${currentTournament}/users`).once("value");
    const users = usersSnapshot.val() || {};

    if (bidder && allExceptUserBidOne(users, bidder)) {
      await transferPlayerToTeam(player, key, bidder);
      return;
    }

    if (allUsersBidOne(users)) {
      await database.ref(`tournament/${currentTournament}/bidding_data/${key}`).remove();
      await resetAllUsersBidStatus();
      alertManager.show('remove_success', "Player removed (everyone left)");
    }
  } catch (error) {
    console.error("Error in leave operation:", error);
    alertManager.show('leave_error', "Failed to leave bid. Please try again.");
    document.getElementById("leave-btn").disabled = false;
  }
});

document.getElementById("refresh-btn")?.addEventListener("click", () => fetchData());

document.getElementById("prev-btn")?.addEventListener("click", () => {
  if (players.length === 0) return;
  currentPlayerIndex = (currentPlayerIndex - 1 + players.length) % players.length;
  currentPlayerKey = playerKeys[currentPlayerIndex];
  displayPlayer();
  updateButtonStates();
});

document.getElementById("next-btn")?.addEventListener("click", () => {
  if (players.length === 0) return;
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  currentPlayerKey = playerKeys[currentPlayerIndex];
  displayPlayer();
  updateButtonStates();
});

window.addEventListener("beforeunload", () => {
  if (playersListener) {
    database.ref(`tournament/${currentTournament}/bidding_data`).off("value", playersListener);
  }
  if (userListener) {
    database.ref(`tournament/${currentTournament}/users/${currentUser}`).off("value", userListener);
  }
});

window.onload = fetchData;
