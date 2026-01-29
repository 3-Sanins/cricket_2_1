const firebaseConfig = {
  apiKey: "AIzaSyClRQbU3N7F2F9Pp6BYirjcQxZEyVuxcXo",
  authDomain: "cric-283bd.firebaseapp.com",
  databaseURL: "https://cric-283bd-default-rtdb.firebaseio.com",
  projectId: "cric-283bd",
  storageBucket: "cric-283bd.firebasestorage.app",
  messagingSenderId: "509305000521",
  appId: "1:509305000521:web:2c16c4f7d2e85f98476598"
};

const playerName = localStorage.getItem("playerName");

if (typeof playerName !== "string" || playerName.trim() === "") {
    alert("playerName missing. User not logged in.");
    console.error("playerName =", playerName);
    throw new Error("STOP: playerName is null");
}

firebase.initializeApp(firebaseConfig);
const db = firebase.database();



const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const tName = document.getElementById("tName");
const tPass = document.getElementById("tPass");
const tMoney = document.getElementById("tMoney");

let mode = "";

window.onload = loadTournaments;

function loadTournaments() {
    const list = document.getElementById("tournamentList");
    list.innerHTML = "";

    db.ref("tournament").once("value")
        .then(snap => {

            // 🔹 If tournament node doesn't exist → nothing to show
            if (!snap.exists()) {
                console.log("No tournaments exist yet");
                return;
            }

            snap.forEach(t => {
                const users = t.child("users");

                if (users.exists() && users.hasChild(playerName)) {
                    const card = document.createElement("div");
                    card.className = "card";
                    card.innerText = t.key;

                    card.onclick = () => {
                        localStorage.setItem("currentTournament", t.key);
                        window.location.href="tournaments.html?tournamentname="+currentTournament;
                        // future navigation
                    };

                    list.appendChild(card);
                }
            });
        })
        .catch(err => {
            console.error("Failed to load tournaments:", err);
        });
}

/* Modal handlers */
function openJoin() {
    mode = "join";
    modalTitle.innerText = "Join Tournament";
    tMoney.style.display = "none";
    openModal();
}

function openCreate() {
    mode = "create";
    modalTitle.innerText = "Create Tournament";
    tMoney.style.display = "block";
    openModal();
}

function openModal() {
    modal.style.display = "flex";
}

function closeModal() {
    modal.style.display = "none";
    tName.value = tPass.value = tMoney.value = "";
}

/* Submit */
function submitModal() {
    const name = tName.value.trim();
    const pass = tPass.value.trim();

    if (!name || !pass) return;

    if (mode === "join") joinTournament(name, pass);
    else createTournament(name, pass, Number(tMoney.value));
}

/* Logic */
function joinTournament(name, pass) {
    const ref = db.ref("tournament/" + name);

    ref.once("value").then(snap => {
        if (!snap.exists()) {
            alert("Tournament not found");
            return;
        }

        const dbPass = snap.child("passwd").val();
        if (!dbPass || dbPass.toLowerCase() !== pass.toLowerCase()) {
            alert("Incorrect password");
            return;
        }

        const money = snap.child("money").val();

        ref.child("users/" + playerName).set({
            bid: 0,
            money: money,
            matchesPlayed: 0,
            wins: 0,
            playersOwned: 0,
            team: [],
            selected_team: []
        }).then(() => location.reload());
    });
}

function createTournament(name, pass, money) {
    if (!money || money <= 0) return;

    const tournamentRef = db.ref("tournament/" + name.toUpperCase());
    const playersRef = db.ref("bidding_players_data");

    tournamentRef.once("value").then(tSnap => {
        if (tSnap.exists()) {
            alert("Tournament already exists");
            return;
        }

        // 1️⃣ Read all bidding players
        playersRef.once("value").then(playersSnap => {
            if (!playersSnap.exists()) {
                alert("No players available for bidding");
                return;
            }

            // 2️⃣ Create tournament + copy players
            tournamentRef.set({
                creator: playerName,
                status: "Waiting1",
                passwd: pass,
                money: money,
                bidding_data: playersSnap.val(),   // ✅ FULL COPY
                users: {
                    [playerName]: {
                        bid: 0,
                        money: money,
                        matchesPlayed: 0,
                        wins: 0,
                        playersOwned: 0,
                        team: [],
                        selected_team: []
                    }
                }
            }).then(() => {
                location.reload();
            });
        });
    });
}
