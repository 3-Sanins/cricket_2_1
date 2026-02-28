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
        //alertManager.show('navigation', 'Current player removed - showing first available player');
      }
    } else {
      currentPlayerIndex = 0;
      currentPlayerKey = null;
    }

    playerKeys = newPlayerKeys;
    players = newPlayers;

    // Reset price to 1 for players with price > 10000
    newPlayerKeys.forEach(k => {
      const p = obj[k];
      if ((parseFloat(p.price) || 0) > 10000) {
        database.ref(`tournament/${currentTournament}/bidding_data/${k}/price`).set(1);
      }
    });

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
  
  const typeText = player.type || "N/A";
  document.getElementById("player-type").textContent = typeText;
  
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
  console.log("=== START transferPlayerToTeam ===");
  console.log("Player:", player);
  console.log("Key:", key);
  console.log("Receiving User:", receivingUser);
  
  const playerPrice = parseFloat(player.price) || 0;
  console.log("Player Price:", playerPrice);

  try {
    console.log("Step 1: Fetching user data (skipping transfer lock)");
    const userRef = database.ref(`tournament/${currentTournament}/users/${receivingUser}`);
    const userSnapshot = await userRef.once("value");
    const currentUserData = userSnapshot.val() || {};
    console.log("User Data:", currentUserData);
    
    const currentMoney = parseFloat(currentUserData.money) || 0;
    console.log("Current Money:", currentMoney);

    if (currentMoney < playerPrice) {
      const errorMsg = `Insufficient funds. Need ₹${playerPrice}, have ₹${currentMoney}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log("Step 2: Generating unique key");
    const teamRef = database.ref(`tournament/${currentTournament}/users/${receivingUser}/players`);
    const teamSnapshot = await teamRef.once("value");
    const team = teamSnapshot.val() || {};
    
    const uniqueKey = generateUniquePlayerKey(team, player.name);
    console.log("Unique Key:", uniqueKey);

    console.log("Step 3: Preparing updates");
    const updates = {
      [`players/${uniqueKey}`]: {
        ...player,
        originalName: player.name,
        matches: 0,
        runs: 0,
        wickets: 0
      },
      money: currentMoney - playerPrice,
      bid: 0
    };
    console.log("Updates:", updates);

    console.log("Step 4: Applying updates to user");
    await userRef.update(updates);
    console.log("User updated successfully");

    console.log("Step 5: Removing player from bidding");
    const bidRef = database.ref(`tournament/${currentTournament}/bidding_data/${key}`);
    await bidRef.remove();
    console.log("Player removed from bidding");

    console.log("Step 6: Resetting all users bid status");
    await resetAllUsersBidStatus();
    console.log("Bid status reset");

    console.log("=== TRANSFER COMPLETED ===");
    return true;
    
  } catch (error) {
    console.error("=== TRANSFER ERROR ===");
    console.error("Full error:", error);
    console.error("Message:", error.message);
    
    if (error.message.includes("permission_denied")) {
      alertManager.show('permission_error', "Database permission denied. Check Firebase rules.");
    } else if (error.message.includes("database/")) {
      alertManager.show('db_error', `Database error: ${error.message}`);
    } else {
      alertManager.show('transfer_error', error.message || "Transfer failed");
    }
    
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

    // +1 increment system
    const newPrice = currentPrice + 1;

    console.log("Current Price:", currentPrice);
    console.log("New Price:", newPrice);
    console.log("Player:", player);
    console.log("Key:", key);

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
