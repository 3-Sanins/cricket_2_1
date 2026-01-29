const firebaseConfig = {
  apiKey: "AIzaSyClRQbU3N7F2F9Pp6BYirjcQxZEyVuxcXo",
  authDomain: "cric-283bd.firebaseapp.com",
  databaseURL: "https://cric-283bd-default-rtdb.firebaseio.com",
  projectId: "cric-283bd",
  storageBucket: "cric-283bd.firebasestorage.app",
  messagingSenderId: "509305000521",
  appId: "1:509305000521:web:2c16c4f7d2e85f98476598"
};

// Init Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Create full DB structure
function createStructure() {

  const structure = {
    bidding_players_data: {
      TEMPLATE: true
    },

    pvp: {},

    tournament: {
      FPL: {
        passwd: "1234",
        status: "created",

        bidding_data: {},

        game: {
          season_data: {},
          playing: false
        },

        users: {}
      }
    }
  };

  db.ref("/").set(structure)
    .then(() => {
      alert("Database structure created successfully");
    })
    .catch((err) => {
      console.error(err);
    });
}
