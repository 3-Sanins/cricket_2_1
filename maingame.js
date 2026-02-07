const firebaseConfig = {
  apiKey: "AIzaSyClRQbU3N7F2F9Pp6BYirjcQxZEyVuxcXo",
  authDomain: "cric-283bd.firebasestorage.app",
  databaseURL: "https://cric-283bd-default-rtdb.firebaseio.com",
  projectId: "cric-283bd",
  storageBucket: "cric-283bd.firebasestorage.app",
  messagingSenderId: "509305000521",
  appId: "1:509305000521:web:2c16c4f7d2e85f98476598"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const elements = {
  tournamentTitle: document.getElementById("tournamentTitle"),
  matchInfo: document.getElementById("matchInfo"),
  roleBadge: document.getElementById("roleBadge"),
  battingTeam: document.getElementById("battingTeam"),
  totalRuns: document.getElementById("totalRuns"),
  totalWickets: document.getElementById("totalWickets"),
  overs: document.getElementById("overs"),
  runRate: document.getElementById("runRate"),
  chaseInfo: document.getElementById("chaseInfo"),
  reqRunRate: document.getElementById("reqRunRate"),
  inningValue: document.getElementById("inningValue"),
  targetValue: document.getElementById("targetValue"),
  batsmenList: document.getElementById("batsmenList"),
  bowlerInfo: document.getElementById("bowlerInfo"),
  selectBowlerBtn: document.getElementById("selectBowlerBtn"),
  overLog: document.getElementById("overLog"),
  battingHint: document.getElementById("battingHint"),
  matchUpdates: document.getElementById("matchUpdates"),
  resultSection: document.getElementById("resultSection"),
  resultTitle: document.getElementById("resultTitle"),
  resultTeam1: document.getElementById("resultTeam1"),
  resultTeam2: document.getElementById("resultTeam2"),
  scoreboard1: document.getElementById("scoreboard1"),
  scoreboard2: document.getElementById("scoreboard2"),
  resultOkBtn: document.getElementById("resultOkBtn"),
  selectionModal: document.getElementById("selectionModal"),
  selectionTitle: document.getElementById("selectionTitle"),
  selectionRatingHeader: document.getElementById("selectionRatingHeader"),
  selectionTableBody: document.getElementById("selectionTableBody"),
  selectionSubmit: document.getElementById("selectionSubmit"),
  messageToast: document.getElementById("messageToast")
};

let playerName = localStorage.getItem("playerName");
let tournamentName = "";
let matchType = "";
let user1 = "";
let user2 = "";
let homeTeam = "";
let gameRef;
let gameState = null;
let selectionContext = null;

const moodButtons = Array.from(document.querySelectorAll(".mood-btn"));

const MAX_BALLS = 120;

function init() {
  const params = new URLSearchParams(window.location.search);

  if (!window.location.search) {
    tournamentName = "FPL";
    matchType = "league";
    user1 = "Akshit";
    user2 = "Lakshya";
    homeTeam = "Akshit";
    playerName = playerName || "Akshit";
    localStorage.setItem("playerName", playerName);
  } else {
    tournamentName = (params.get("tournamentname") || "").toUpperCase();
    matchType = params.get("matchtype") || "league";
    user1 = params.get("user1") || "";
    user2 = params.get("user2") || "";
    homeTeam = params.get("home") || "";
  }

  if (!playerName || !tournamentName || !user1 || !user2) {
    showToast("Invalid match parameters or player name missing.");
    return;
  }

  if (!['league', 'knockout'].includes(matchType)) {
    showToast("Invalid match type.");
    return;
  }

  elements.tournamentTitle.textContent = tournamentName;
  elements.matchInfo.textContent = `${matchType.toUpperCase()} MATCH: ${user1} vs ${user2}`;
  elements.resultOkBtn.addEventListener("click", () => {
    elements.resultSection.classList.add("hidden");
  });

  moodButtons.forEach(button => {
    button.addEventListener("click", () => handleMood(button.dataset.mood));
  });

  elements.selectBowlerBtn.addEventListener("click", () => openSelectionModal("bowler"));
  elements.selectionSubmit.addEventListener("click", handleSelectionSubmit);

  gameRef = db.ref(`tournament/${tournamentName}/game`);
  gameRef.on("value", snapshot => {
    if (!snapshot.exists()) {
      showToast("Game data not found.");
      return;
    }
    gameState = snapshot.val();
    ensurePlayerSetup();
    renderGame();
  });
}

function ensurePlayerSetup() {
  if (!gameState) {
    return;
  }

  const isParticipant = playerName === user1 || playerName === user2;

  if (gameState.status === "start" && isParticipant) {
    claimPlayerSlot();
  } else if (gameState.status && gameState.status.startsWith("play1") && isParticipant) {
    const firstPlayer = gameState.status.replace("play1", "");
    if (firstPlayer !== playerName) {
      claimPlayerSlot();
    }
  }
}

function claimPlayerSlot() {
  const statusRef = gameRef.child("status");

  statusRef.transaction(current => {
    if (current === "start") {
      return `play1${playerName}`;
    }
    if (current && current.startsWith("play1")) {
      const firstPlayer = current.replace("play1", "");
      if (firstPlayer !== playerName) {
        return "play";
      }
    }
    return;
  }).then(result => {
    if (!result.committed) {
      return;
    }

    const nextStatus = result.snapshot.val();
    if (nextStatus === `play1${playerName}` || nextStatus === "play") {
      initializePlayerNode();
    }
  }).catch(err => {
    console.error(err);
    showToast("Unable to claim match slot.");
  });
}

function initializePlayerNode() {
  const playerRef = gameRef.child(playerName);
  playerRef.once("value").then(snapshot => {
    if (snapshot.exists()) {
      return;
    }

    return hydratePlaying11().then(playing11 => {
      const updates = {
        name: playerName,
        wicket: -1,
        total_runs: 0,
        BALLS: 0,
        legal_balls: 0,
        bowler: "",
        batting: {},
        ball_log: [],
        playing11
      };
      return playerRef.set(updates);
    });
  }).catch(err => {
    console.error(err);
    showToast("Failed to initialize player data.");
  });
}

function hydratePlaying11() {
  const gamePlayingRef = gameRef.child(`${playerName}/playing11`);
  const userPlayingRef = db.ref(`tournament/${tournamentName}/users/${playerName}/selected_team`);

  return gamePlayingRef.once("value").then(snapshot => {
    if (snapshot.exists()) {
      return normalizePlaying11(snapshot.val());
    }
    return userPlayingRef.once("value").then(userSnap => {
      if (!userSnap.exists()) {
        return { captain: "", players: {} };
      }
      return normalizePlaying11(userSnap.val());
    });
  });
}

function normalizePlaying11(playing11) {
  if (!playing11 || !playing11.players) {
    return { captain: "", players: {} };
  }

  const normalizedPlayers = {};
  Object.entries(playing11.players).forEach(([id, player]) => {
    normalizedPlayers[id] = {
      ...player,
      ball_faced: player.ball_faced || 0,
      ball_thrown: player.ball_thrown || 0,
      runs_made: player.runs_made || 0,
      runs_faced: player.runs_faced || 0,
      wicket_taken: player.wicket_taken || 0,
      six: player.six || 0,
      four: player.four || 0,
      inning: player.inning || 0,
      out: typeof player.out === "number" ? player.out : -1
    };
  });

  return {
    captain: playing11.captain || "",
    players: normalizedPlayers
  };
}

function renderGame() {
  if (!gameState) {
    return;
  }

  const inning = gameState.inning || "-";
  elements.inningValue.textContent = inning;

  if (gameState.status === "finished") {
    renderResult();
    return;
  }

  const battingUser = gameState.batting || user1;
  const bowlingUser = gameState.bowling || user2;
  const battingData = gameState[battingUser] || {};
  const bowlingData = gameState[bowlingUser] || {};

  elements.battingTeam.textContent = battingUser;
  const wickets = Math.max(0, battingData.wicket || -1);
  elements.totalRuns.textContent = battingData.total_runs || 0;
  elements.totalWickets.textContent = wickets;

  const legalBalls = battingData.legal_balls || 0;
  elements.overs.textContent = formatOvers(legalBalls);
  elements.runRate.textContent = legalBalls ? ((battingData.total_runs || 0) / legalBalls * 6).toFixed(2) : "0.00";

  renderChaseInfo();
  renderBatsmen(battingData);
  renderBowler(bowlingData);
  renderOverLog(battingData.ball_log || []);
  renderRole(battingUser, bowlingUser);
  updateControls(battingUser, bowlingUser, bowlingData);
  maybePromptBatsmenSelection(battingUser, battingData);
}

function renderRole(battingUser, bowlingUser) {
  if (playerName === battingUser) {
    elements.roleBadge.textContent = "BATTING";
  } else if (playerName === bowlingUser) {
    elements.roleBadge.textContent = "BOWLING";
  } else {
    elements.roleBadge.textContent = "SPECTATOR";
  }
}

function renderChaseInfo() {
  if (gameState.inning !== "inning2") {
    elements.chaseInfo.classList.add("hidden");
    elements.targetValue.textContent = "-";
    return;
  }

  const battingUser = gameState.batting || user1;
  const bowlingUser = gameState.bowling || user2;
  const target = (gameState[bowlingUser]?.total_runs || 0) + 1;
  elements.targetValue.textContent = target;

  const legalBalls = gameState[battingUser]?.legal_balls || 0;
  const runsRemaining = target - (gameState[battingUser]?.total_runs || 0);
  const ballsRemaining = Math.max(0, MAX_BALLS - legalBalls);
  elements.chaseInfo.classList.remove("hidden");
  elements.reqRunRate.textContent = ballsRemaining ? ((runsRemaining / ballsRemaining) * 6).toFixed(2) : "0.00";
}

function renderBatsmen(battingData) {
  elements.batsmenList.innerHTML = "";
  if (!battingData.batting) {
    elements.batsmenList.innerHTML = "<p>No batsman selected.</p>";
    return;
  }

  Object.values(battingData.batting).forEach(player => {
    const row = document.createElement("div");
    row.className = "player-row";
    if (player.strike) {
      row.classList.add("strike");
    }
    const strikeRate = player.ball_faced ? ((player.runs_made / player.ball_faced) * 100).toFixed(1) : "0.0";
    row.innerHTML = `<span>${player.name}${player.strike ? " •" : ""}</span><span>${player.runs_made || 0} (${player.ball_faced || 0}) SR ${strikeRate}</span>`;
    elements.batsmenList.appendChild(row);
  });
}

function renderBowler(bowlingData) {
  if (!bowlingData.bowler || !bowlingData.bowler.name) {
    elements.bowlerInfo.textContent = "Select a bowler";
    return;
  }

  const bowler = bowlingData.bowler;
  elements.bowlerInfo.textContent = `${bowler.name} - ${bowler.wicket_taken || 0}/${bowler.runs_faced || 0}`;
}

function renderOverLog(log) {
  elements.overLog.innerHTML = "";
  const lastSix = log.slice(-6);
  lastSix.forEach(entry => {
    const item = document.createElement("span");
    item.className = "over-ball";
    item.textContent = entry;
    elements.overLog.appendChild(item);
  });
}

function updateControls(battingUser, bowlingUser, bowlingData) {
  const isBatting = playerName === battingUser;
  const hasBowler = !!(bowlingData && bowlingData.bowler && bowlingData.bowler.id);

  moodButtons.forEach(btn => {
    btn.disabled = !isBatting || !hasBowler;
  });

  elements.selectBowlerBtn.classList.toggle("hidden", playerName !== bowlingUser);
  elements.battingHint.textContent = !hasBowler ? "Waiting for bowler selection..." : "Choose your shot";
}

function maybePromptBatsmenSelection(battingUser, battingData) {
  if (playerName !== battingUser || elements.selectionModal.classList.contains("active")) {
    return;
  }

  if (!battingData.batting || Object.keys(battingData.batting).length === 0) {
    openSelectionModal("batsman", `Select Batsman #1`);
  }
}

function openSelectionModal(type, titleOverride) {
  const isBattingSelection = type === "batsman";
  selectionContext = { type };

  const playerData = gameState?.[playerName];
  if (!playerData || !playerData.playing11) {
    showToast("Playing 11 not ready.");
    return;
  }

  elements.selectionTitle.textContent = titleOverride || (isBattingSelection ? "Select Batsman" : "Select Bowler");
  elements.selectionRatingHeader.textContent = isBattingSelection ? "Bat Rating" : "Bowl Rating";

  const players = playerData.playing11.players || {};
  elements.selectionTableBody.innerHTML = "";

  Object.entries(players).forEach(([id, player]) => {
    const row = document.createElement("tr");
    const rating = isBattingSelection ? player.battingRating : player.bowlingRating;
    const skill = isBattingSelection ? (player.battingSkill || "-") : (player.bowlingSkill || "-");
    row.innerHTML = `
      <td><input type="radio" name="playerSelect" value="${id}" /></td>
      <td>${player.name}</td>
      <td>${rating}</td>
      <td>${skill}</td>
    `;
    elements.selectionTableBody.appendChild(row);
  });

  elements.selectionModal.classList.remove("hidden");
  elements.selectionModal.classList.add("active");
}

function handleSelectionSubmit() {
  const selected = elements.selectionTableBody.querySelector("input[name='playerSelect']:checked");
  if (!selected) {
    showToast("Please select a player.");
    return;
  }

  const playerId = selected.value;
  const playerData = gameState?.[playerName];
  const players = playerData?.playing11?.players || {};
  const selectedPlayer = players[playerId];

  if (!selectedPlayer) {
    showToast("Player not found.");
    return;
  }

  if (selectionContext.type === "batsman") {
    addBatsman(playerId, selectedPlayer);
  } else {
    setBowler(playerId, selectedPlayer);
  }

  elements.selectionModal.classList.add("hidden");
  elements.selectionModal.classList.remove("active");
}

function addBatsman(playerId, player) {
  const battingRef = gameRef.child(`${playerName}/batting`);
  const wicketRef = gameRef.child(`${playerName}/wicket`);

  const existingBatting = gameState?.[playerName]?.batting || {};
  if (existingBatting[playerId]) {
    showToast("Player already batting.");
    return;
  }

  wicketRef.transaction(current => {
    if (typeof current !== "number") {
      return -1;
    }
    if (current === -1) {
      return 0;
    }
    return current;
  }).then(result => {
    const currentBatting = gameState?.[playerName]?.batting || {};
    const hasStriker = Object.values(currentBatting).some(batsman => batsman.strike);
    const isFirstBatsman = result.snapshot.val() === 0 && Object.keys(currentBatting).length === 0;
    const strike = isFirstBatsman || !hasStriker;

    battingRef.child(playerId).set({
      ...player,
      strike,
      ball_faced: player.ball_faced || 0,
      runs_made: player.runs_made || 0,
      four: player.four || 0,
      six: player.six || 0,
      out: -1,
      inning: player.inning || 0
    }).then(() => {
      if (isFirstBatsman) {
        openSelectionModal("batsman", "Select Batsman #2");
      }
    });
  });
}

function setBowler(playerId, player) {
  const bowlerRef = gameRef.child(`${playerName}/bowler`);
  bowlerRef.set({
    id: playerId,
    name: player.name,
    ball_thrown: player.ball_thrown || 0,
    runs_faced: player.runs_faced || 0,
    wicket_taken: player.wicket_taken || 0
  });
}

function handleMood(mood) {
  if (!gameState || playerName !== gameState.batting) {
    return;
  }

  const battingUser = gameState.batting;
  const bowlingUser = gameState.bowling;
  const battingData = gameState[battingUser];
  const bowlingData = gameState[bowlingUser];

  if (!bowlingData || !bowlingData.bowler || !bowlingData.bowler.id) {
    showToast("Waiting for bowler selection.");
    return;
  }

  const strikerEntry = getStriker(battingData.batting || {});
  if (!strikerEntry) {
    showToast("Select batsmen first.");
    return;
  }

  const outcome = runProbability(mood, strikerEntry.player, bowlingData.bowler);
  applyBallOutcome({
    battingUser,
    bowlingUser,
    strikerEntry,
    bowler: bowlingData.bowler,
    outcome
  });
}

function runProbability() {
  return Math.floor(Math.random() * 10);
}

function applyBallOutcome({ battingUser, bowlingUser, strikerEntry, bowler, outcome }) {
  const battingData = gameState[battingUser];
  const bowlingData = gameState[bowlingUser];
  const updates = {};
  const strikerPath = `${battingUser}/batting/${strikerEntry.id}`;
  const battingPlayer = strikerEntry.player;
  const totalRuns = battingData.total_runs || 0;
  const legalBalls = battingData.legal_balls || 0;
  const ballLog = battingData.ball_log || [];
  const strikerBasePath = `${battingUser}/playing11/players/${strikerEntry.id}`;
  const bowlerBasePath = `${bowlingUser}/playing11/players/${bowler.id}`;

  const isWide = outcome === 9;
  const isWicket = outcome === 7 || outcome === 8;
  const runs = outcome <= 6 ? outcome : 0;

  if (isWide) {
    updates[`${battingUser}/total_runs`] = totalRuns + 1;
    updates[`${bowlingUser}/bowler/runs_faced`] = (bowler.runs_faced || 0) + 1;
    updates[`${bowlerBasePath}/runs_faced`] = (bowler.runs_faced || 0) + 1;
    ballLog.push("Wd");
    updates[`${battingUser}/ball_log`] = ballLog;
    commitUpdates(updates, battingUser, bowlingUser);
    return;
  }

  const nextLegalBalls = legalBalls + 1;
  const nextTotalRuns = totalRuns + runs;

  updates[`${battingUser}/legal_balls`] = nextLegalBalls;
  updates[`${battingUser}/BALLS`] = nextLegalBalls;
  updates[`${battingUser}/total_runs`] = nextTotalRuns;

  updates[`${strikerPath}/ball_faced`] = (battingPlayer.ball_faced || 0) + 1;
  updates[`${bowlingUser}/bowler/ball_thrown`] = (bowler.ball_thrown || 0) + 1;
  updates[`${bowlingUser}/bowler/runs_faced`] = (bowler.runs_faced || 0) + runs;
  updates[`${strikerBasePath}/ball_faced`] = (battingPlayer.ball_faced || 0) + 1;
  updates[`${bowlerBasePath}/ball_thrown`] = (bowler.ball_thrown || 0) + 1;
  updates[`${bowlerBasePath}/runs_faced`] = (bowler.runs_faced || 0) + runs;

  if (!isWicket) {
    updates[`${strikerPath}/runs_made`] = (battingPlayer.runs_made || 0) + runs;
    updates[`${strikerBasePath}/runs_made`] = (battingPlayer.runs_made || 0) + runs;
    if (runs === 4) {
      updates[`${strikerPath}/four`] = (battingPlayer.four || 0) + 1;
      updates[`${strikerBasePath}/four`] = (battingPlayer.four || 0) + 1;
    }
    if (runs === 6) {
      updates[`${strikerPath}/six`] = (battingPlayer.six || 0) + 1;
      updates[`${strikerBasePath}/six`] = (battingPlayer.six || 0) + 1;
    }
  }

  let swapStrike = runs % 2 === 1;
  if (nextLegalBalls % 6 === 0) {
    swapStrike = !swapStrike;
  }

  if (swapStrike) {
    const other = getNonStriker(battingData.batting || {}, strikerEntry.id);
    if (other) {
      updates[`${battingUser}/batting/${strikerEntry.id}/strike`] = false;
      updates[`${battingUser}/batting/${other.id}/strike`] = true;
    }
  }

  if (isWicket) {
    updates[`${strikerPath}/out`] = 1;
    updates[`${strikerPath}/inning`] = 1;
    updates[`${bowlingUser}/bowler/wicket_taken`] = (bowler.wicket_taken || 0) + 1;
    updates[`${bowlerBasePath}/wicket_taken`] = (bowler.wicket_taken || 0) + 1;
    updates[`${battingUser}/wicket`] = (battingData.wicket ?? 0) + 1;
    updates[`${strikerPath}/strike`] = false;
    updates[`${strikerBasePath}/out`] = 1;
    updates[`${strikerBasePath}/inning`] = 1;
    ballLog.push("W");
  } else {
    ballLog.push(`${runs}`);
  }

  updates[`${battingUser}/ball_log`] = ballLog;
  commitUpdates(updates, battingUser, bowlingUser, isWicket);
}

function commitUpdates(updates, battingUser, bowlingUser, isWicket) {
  gameRef.update(updates).then(() => {
    return gameRef.once("value");
  }).then(snapshot => {
    gameState = snapshot.val();
    if (isWicket && playerName === battingUser) {
      openSelectionModal("batsman");
    }
    checkInningsComplete(battingUser, bowlingUser);
  });
}

function checkInningsComplete(battingUser, bowlingUser) {
  const updatedBatting = gameState?.[battingUser];
  if (!updatedBatting) {
    return;
  }

  const wickets = updatedBatting.wicket || 0;
  const legalBalls = updatedBatting.legal_balls || 0;

  const inningsOver = wickets >= 10 || legalBalls >= MAX_BALLS;
  if (!inningsOver) {
    if (gameState.inning === "inning2") {
      const target = (gameState[bowlingUser]?.total_runs || 0) + 1;
      if ((updatedBatting.total_runs || 0) >= target) {
        finishMatch(battingUser);
      }
    }
    return;
  }

  if (gameState.inning !== "inning2") {
    const updates = {
      inning: "inning2",
      batting: bowlingUser,
      bowling: battingUser,
      [`${battingUser}/bowler`]: "",
      [`${bowlingUser}/bowler`]: ""
    };
    gameRef.update(updates);
  } else {
    const winner = (updatedBatting.total_runs || 0) >= (gameState[bowlingUser]?.total_runs || 0) ? battingUser : bowlingUser;
    finishMatch(winner);
  }
}

function finishMatch(winner) {
  gameRef.update({
    status: "finished",
    winner
  });
}

function renderResult() {
  const winner = gameState.winner || "";
  elements.resultTitle.textContent = `${winner} WON THE GAME`;
  elements.resultTeam1.textContent = user1;
  elements.resultTeam2.textContent = user2;
  renderScoreboard(gameState[user1], elements.scoreboard1);
  renderScoreboard(gameState[user2], elements.scoreboard2);
  elements.resultSection.classList.remove("hidden");
}

function renderScoreboard(teamData, container) {
  if (!teamData || !teamData.playing11 || !teamData.playing11.players) {
    container.textContent = "No data";
    return;
  }
  const rows = Object.values(teamData.playing11.players).map(player => {
    const strikeRate = player.ball_faced ? ((player.runs_made / player.ball_faced) * 100).toFixed(1) : "0.0";
    return `${player.name} - ${player.runs_made || 0} (${player.ball_faced || 0}) SR ${strikeRate}`;
  });
  container.innerHTML = rows.map(row => `<div>${row}</div>`).join("");
}

function getStriker(batting) {
  const entries = Object.entries(batting || {});
  for (const [id, player] of entries) {
    if (player.strike) {
      return { id, player };
    }
  }
  return null;
}

function getNonStriker(batting, strikerId) {
  const entries = Object.entries(batting || {});
  for (const [id, player] of entries) {
    if (id !== strikerId) {
      return { id, player };
    }
  }
  return null;
}

function formatOvers(legalBalls) {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

function showToast(message) {
  elements.messageToast.textContent = message;
  elements.messageToast.classList.remove("hidden");
  setTimeout(() => elements.messageToast.classList.add("hidden"), 2400);
}

document.addEventListener("DOMContentLoaded", init);
