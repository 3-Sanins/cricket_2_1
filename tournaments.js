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
      location.href = "bidding.html?tournamentname=" + tournamentName;
    };

    if (creator === playerName) {
      document.getElementById("stopBiddingBtn").classList.remove("hidden");

      document.getElementById("stopBiddingBtn").onclick = async () => {
        const usersObj = JSON.parse(JSON.stringify(data.users));
        const teamNames = Object.keys(usersObj);

        // 1️⃣ pehle matches array banao
        let matches = [];

        for (let i = 0; i < teamNames.length; i++) {
          for (let j = i + 1; j < teamNames.length; j++) {

            matches.push({
              type: "league",
              user1: teamNames[i],
              user2: teamNames[j],
              home: teamNames[i],
              away: teamNames[j],
              played: false,
              result: null
            });

            matches.push({
              type: "league",
              user1: teamNames[j],
              user2: teamNames[i],
              home: teamNames[j],
              away: teamNames[i],
              played: false,
              result: null
            });

          }
        }

        // 2️⃣ shuffle matches (Fisher–Yates)
        for (let i = matches.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
  [matches[i], matches[j]] = [matches[j], matches[i]];
        }

        // 3️⃣ wapas object bana do
        const schedule = {};
        matches.forEach((m, idx) => {
          schedule["match_" + (idx + 1)] = m;
        });

        // 4️⃣ firebase write
        await tRef.child("season" + seasonNo).set({
          users: usersObj,
          schedule: schedule
        });


        await tRef.update({ status: "playing" + seasonNo });
        location.reload();
      };
    }
  }

  /* PLAYING */
  /* PLAYING */
  if (status.startsWith("playing")) {
    document.getElementById("playingSection").classList.remove("hidden");

    const season = data["season" + seasonNo];
    const users = season?.users || data.users;
    const schedule = season?.schedule || {};

    /* -------- POINTS TABLE (same as before) -------- */
    const tbody = document.querySelector("#pointsTable tbody");
    tbody.innerHTML = "";

    const rows = Object.keys(users).map(u => {
      const d = users[u];
      const wins = d.wins || 0;
      const draw = d.draw || 0;
      const played = d.matchesPlayed || 0;

      return {
        name: u,
        played,
        wins,
        draw,
        lost: played - wins - draw,
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

    /* -------- KNOCKOUT AUTO-CREATION -------- */

    const allLeagueEnded = Object.values(schedule)
      .filter(m => m.type === "league")
      .every(m => m.played === true);

    const hasKnockout = Object.values(schedule)
      .some(m => m.type === "knockout");

    if (allLeagueEnded && !hasKnockout) {

      const ranked = rows; // already sorted
      const count = ranked.length;
      const newMatches = {};

      if (count > 4) {
        newMatches["semi_1"] = {
          type: "knockout",
          round: "semi",
          user1: ranked[0].name,
          user2: ranked[2].name,
          played: false,
          result: null
        };

        newMatches["semi_2"] = {
          type: "knockout",
          round: "semi",
          user1: ranked[1].name,
          user2: ranked[3].name,
          played: false,
          result: null
        };
      }

      else if (count === 4) {
        newMatches["semi"] = {
          type: "knockout",
          round: "semi",
          user1: ranked[1].name,
          user2: ranked[2].name,
          played: false,
          result: null
        };

        newMatches["final"] = {
          type: "knockout",
          round: "final",
          user1: ranked[0].name,
          user2: "TBD",
          played: false,
          result: null
        };
      }

      else if (count === 3) {
        const diff12 = Math.abs(ranked[0].points - ranked[1].points);
        const diff23 = Math.abs(ranked[1].points - ranked[2].points);

        if (diff23 < diff12) {
          newMatches["semi"] = {
            type: "knockout",
            round: "semi",
            user1: ranked[1].name,
            user2: ranked[2].name,
            played: false,
            result: null
          };

          newMatches["final"] = {
            type: "knockout",
            round: "final",
            user1: ranked[0].name,
            user2: "TBD",
            played: false,
            result: null
          };
        } else {
          newMatches["final"] = {
            type: "knockout",
            round: "final",
            user1: ranked[0].name,
            user2: ranked[1].name,
            played: false,
            result: null
          };
        }
      }

      tRef.child("season" + seasonNo + "/schedule").update(newMatches);
    }

    const finalMatch = Object.values(schedule)
      .find(m => m.type === "knockout" && m.round === "final" && m.played === true);

    if (finalMatch && finalMatch.result) {
      const winner = finalMatch.result;

      document.getElementById("seasonWinner").innerText =
        `${winner} won the Season ${seasonNo} of ${tournamentName}`;

      document.getElementById("seasonWinner").classList.remove("hidden");
    }
    if (
      finalMatch &&
      finalMatch.result &&
      creator === playerName
    ) {
      const nextSeasonBtn = document.getElementById("nextSeasonBtn");
      nextSeasonBtn.classList.remove("hidden");

      nextSeasonBtn.onclick = async () => {
        const nextSeasonNo = parseInt(seasonNo) + 1;

        await tRef.update({
          status: "waiting" + nextSeasonNo
        });

        location.reload();
      };
    }


    /* -------- NEXT MATCH DISPLAY -------- */

    const nextMatch = Object.values(schedule).find(m => m.played === false);
    let nextMatchText = "No upcoming matches";

    if (nextMatch) {
      if (nextMatch.type === "league") {
        nextMatchText =
          `Next match (League): ${nextMatch.user1} vs ${nextMatch.user2}\nHome: ${nextMatch.home}`;
      } else {
        nextMatchText =
          `Next match (${nextMatch.round.toUpperCase()}): ${nextMatch.user1} vs ${nextMatch.user2}`;
      }
    }

    document.getElementById("nextMatch").innerText = nextMatchText;

    const btn = document.getElementById("playWatchBtn");
    btn.innerText =
      (nextMatch &&
        (playerName === nextMatch.user1 || playerName === nextMatch.user2)) ?
      "Play" :
      "Watch";
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
