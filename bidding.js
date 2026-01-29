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

// ---------------- TOURNAMENT ----------------

function getTournamentNameFromURL() {
  const params = new URLSearchParams(window.location.search);
  for (const [k, v] of params.entries()) {
    if (k.toLowerCase() === "tournamentname") return v;
  }
  return null;
}

const currentTournament = getTournamentNameFromURL();
if (!currentTournament) {
  alert("Tournament name missing");
  throw new Error("Tournament missing");
}

// ---------------- USER ----------------

let currentUser = localStorage.getItem("playerName");

// ---------------- GLOBAL ----------------

let players = [];          // array of player objects
let playerKeys = [];       // matching firebase keys
let currentPlayerIndex = 0;
let userData = {};

// ---------------- FETCH ----------------

function fetchData() {
  const playersRef = database.ref(
    `tournament/${currentTournament}/bidding_data`
  );
  const userRef = database.ref(
    `tournament/${currentTournament}/users/${currentUser}`
  );

  playersRef.once("value", snap => {
    const obj = snap.val() || {};
    playerKeys = Object.keys(obj);
    players = playerKeys.map(k => obj[k]);

    displayPlayer();
    checkBidderStatus();
    checkUserBidStatus();
  });

  userRef.once("value", snap => {
    userData = snap.val() || {};
    document.getElementById("user-money").textContent =
      "Money: " + (userData.money || 0);
    document.getElementById("user-players").textContent =
      "Players Owned: " +
      ((userData.players && Object.keys(userData.players).length) || 0);
  });
}

// ---------------- DISPLAY ----------------

function displayPlayer() {
  const player = players[currentPlayerIndex];
  if (!player) {
    alert("No players available!");
    return;
  }

  document.getElementById("player-name").textContent = player.name;
  document.getElementById("player-type").textContent = "Type: " + player.type;
  document.getElementById("player-batting").textContent =
    "Batting Rating: " + player.battingRating;
  document.getElementById("player-bowling").textContent =
    "Bowling Rating: " + player.bowlingRating;

  document.getElementById("player-skills").textContent =
    "Skills: " + (player.strengths ? player.strengths.join(", ") : "N/A");

  document.getElementById("player-weakness").textContent =
    "Weakness: " + (player.weakness ? player.weakness.join(", ") : "N/A");

  document.getElementById("player-bidder").textContent =
    "Bidder: " + (player.bidder || "None");

  document.getElementById("player-price").textContent =
    "Price: " + player.price;
}

// ---------------- STATUS ----------------

function checkBidderStatus() {
  const p = players[currentPlayerIndex];
  if (p && p.bidder === currentUser) {
    document.getElementById("take-btn").disabled = true;
    document.getElementById("leave-btn").disabled = true;
  } else {
    document.getElementById("take-btn").disabled = false;
    document.getElementById("leave-btn").disabled = false;
  }
}

function checkUserBidStatus() {
  if (userData.bid == 1) {
    document.getElementById("take-btn").disabled = true;
    document.getElementById("leave-btn").disabled = true;
  }
}

// ---------------- HELPERS ----------------

function getAllUsers(cb) {
  database
    .ref(`tournament/${currentTournament}/users`)
    .once("value", snap => cb(snap.val() || {}));
}

function allExceptUserBidOne(users, excluded) {
  return Object.keys(users)
    .filter(u => u !== excluded)
    .every(u => users[u].bid == 1);
}

function allUsersBidOne(users) {
  return Object.keys(users).every(u => users[u].bid == 1);
}

// ---------------- TRANSFER ----------------

function transferPlayerToTeam(player, key, receivingUser, cb) {
  const teamRef = database.ref(
    `tournament/${currentTournament}/users/${receivingUser}/players`
  );
  const bidRef = database.ref(
    `tournament/${currentTournament}/bidding_data/${key}`
  );
  const userRef = database.ref(
    `tournament/${currentTournament}/users/${receivingUser}`
  );

  const teamPlayerData = {
    ...player,
    matches: 0,
    runs: 0,
    wickets: 0
  };

  teamRef.once("value", snap => {
    const team = snap.val() || {};
    team[player.name] = teamPlayerData;

    teamRef.set(team).then(() => {
      bidRef.remove().then(() => {
        userRef.once("value", uSnap => {
          const u = uSnap.val() || {};
          userRef.update({
            money: (u.money || 0) - parseFloat(player.price),
            bid: 0
          }).then(cb);
        });
      });
    });
  });
}

// ---------------- TAKE ----------------

document.getElementById("take-btn").addEventListener("click", () => {
  const player = players[currentPlayerIndex];
  const key = playerKeys[currentPlayerIndex];
  if (!player) return;

  getAllUsers(users => {
    if (allExceptUserBidOne(users, currentUser)) {
      transferPlayerToTeam(player, key, currentUser, () => {
        alert("Player transferred to you");
        fetchData();
      });
      return;
    }

    const newPrice = player.price + player.price * 0.1;
    if (newPrice > userData.money) {
      alert("Insufficient funds");
      return;
    }

    database
      .ref(`tournament/${currentTournament}/bidding_data/${key}`)
      .update({
        bidder: currentUser,
        price: newPrice
      })
      .then(fetchData);
  });
});

// ---------------- LEAVE ----------------

document.getElementById("leave-btn").addEventListener("click", () => {
  const player = players[currentPlayerIndex];
  const key = playerKeys[currentPlayerIndex];
  if (!player) return;

  const bidder = player.bidder || "";

  getAllUsers(users => {
    database
      .ref(`tournament/${currentTournament}/users/${currentUser}/bid`)
      .set(1);

    if (bidder && allExceptUserBidOne(users, bidder)) {
      transferPlayerToTeam(player, key, bidder, () => {
        alert(`Player transferred to ${bidder}`);
        fetchData();
      });
      return;
    }

    const updated = { ...users, [currentUser]: { bid: 1 } };
    if (allUsersBidOne(updated)) {
      database
        .ref(`tournament/${currentTournament}/bidding_data/${key}`)
        .remove()
        .then(() => {
          alert("Player removed (everyone left)");
          fetchData();
        });
    }
  });
});

// ---------------- REFRESH ----------------

document.getElementById("refresh-btn").addEventListener("click", fetchData);
window.onload = fetchData;
