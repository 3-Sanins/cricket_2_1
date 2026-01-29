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
const db = firebase.database();

const playerName = localStorage.getItem("playerName");
if (!playerName) fail();

/* URL PARAM */
const params = new URLSearchParams(window.location.search);
const rawTournament = params.get("tournamentname");
console.log(rawTournament);
if (!rawTournament) fail();

const tournamentName = rawTournament.toUpperCase();
const tRef = db.ref("tournament/" + tournamentName);

/* MAIN */
tRef.once("value").then(snapshot => {
  if (!snapshot.exists()) return fail();

  const data = snapshot.val();

  if (!data.users || !data.users[playerName]) return fail();

  document.getElementById("tournamentTitle").innerText =
    tournamentName.toUpperCase();

  const status = data.status.toLowerCase();
  const creator = data.creator;
  const seasonNo = status.match(/\d+/)[0];

  /* WAITING */
  if (status.startsWith("waiting")) {
    if (creator !== playerName) {
      showMessage(`Please wait for Season ${seasonNo} to be started`);
    } else {
      document.getElementById("creatorControls").classList.remove("hidden");
      document.getElementById("userCount").innerText =
        "Total users: " + Object.keys(data.users).length;

      document.getElementById("startBiddingBtn").onclick = () => {
        tRef.update({ status: "bidding" + seasonNo });
        location.reload();
      };
    }
  }

  /* BIDDING */
  if (status.startsWith("bidding")) {
    document.getElementById("biddingControls").classList.remove("hidden");

    document.getElementById("goToBiddingBtn").onclick = () => {
      location.href = "bidding.html?tournamentname="+tournamentName;
    };

    if (creator === playerName) {
      document.getElementById("stopBiddingBtn").classList.remove("hidden");

      document.getElementById("stopBiddingBtn").onclick = async () => {
        await tRef.child("season" + seasonNo).set({
          users: JSON.parse(JSON.stringify(data.users)),
          schedule: {}
        });

        await tRef.update({ status: "playing" + seasonNo });
        location.reload();
      };
    }
  }

  /* PLAYING */
  if (status.startsWith("playing")) {
    document.getElementById("playingSection").classList.remove("hidden");

    const users =
      data["season" + seasonNo]?.users || data.users;

    const tbody = document.querySelector("#pointsTable tbody");
    tbody.innerHTML = "";

    const rows = Object.keys(users).map(u => {
      const d = users[u];
      const wins = d.matches_won || 0;
      const draw = d.draw || 0;
      return {
        name: u,
        played: d.matches_played || 0,
        wins,
        draw,
        lost: d.lost || 0,
        points: wins * 2 + draw
      };
    }).sort((a, b) => b.points - a.points);

    rows.forEach(r => {
      const tr = document.createElement("tr");
      if (r.name === playerName) tr.classList.add("highlight");

      tr.innerHTML = `
        <td>${r.name}</td>
        <td>${r.played}</td>
        <td>${r.wins}</td>
        <td>${r.draw}</td>
        <td>${r.lost}</td>
        <td>${r.points}</td>
      `;
      tbody.appendChild(tr);
    });

    /* NEXT MATCH (placeholder) */
    const userA = "userA";
    const userB = "userB";

    document.getElementById("nextMatch").innerText =
      `Next match between "${userA}" and "${userB}"`;

    const btn = document.getElementById("playWatchBtn");
    btn.innerText =
      (playerName === userA || playerName === userB) ? "Play" : "Watch";
  }
});

/* HELPERS */
function showMessage(msg) {
  const m = document.getElementById("message");
  m.innerText = msg;
  m.classList.remove("hidden");
}

function fail() {
  showMessage("No such tournament exists");
}
