const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = [];
let currentScene = null;
let blindPlayer = null;
let votes = {}; // stocker les votes

io.on("connection", (socket) => {
  console.log("✅ Connexion :", socket.id);

  socket.on("join", (data) => {
    const existing = players.find(p => p.name === data.name);
    if (existing) {
      existing.id = socket.id;
      existing.avatar = data.avatar;
    } else {
      players.push({
        id: socket.id,
        name: data.name,
        avatar: data.avatar
      });
    }

    console.log(`👤 ${data.name} est connecté`);
    io.emit("players", players);
  });

  socket.on("startRound", () => {
    if (players.length < 3) return;
    blindPlayer = players[Math.floor(Math.random() * players.length)].name;
    currentScene = "scene1.jpg"; // à remplacer par une logique d'aléatoire plus tard
    votes = {}; // reset votes
    io.emit("newRound", { blindPlayer, currentScene });
  });

  socket.on("vote", (targetName) => {
    const voter = players.find(p => p.id === socket.id);
    if (!voter || voter.name === blindPlayer) return; // blind can't vote
    votes[voter.name] = targetName;

    if (Object.keys(votes).length === players.length - 1) {
      // tous les votes sont arrivés
      let results = {};
      for (let v of Object.values(votes)) {
        results[v] = (results[v] || 0) + 1;
      }
      const mostVoted = Object.entries(results).sort((a, b) => b[1] - a[1])[0][0];
      io.emit("roundResult", { blindPlayer, mostVoted });
    }
  });

  socket.on("disconnect", () => {
    const index = players.findIndex(p => p.id === socket.id);
    if (index !== -1) {
      console.log("❌ Déconnexion de :", players[index].name);
      players.splice(index, 1);
      io.emit("players", players);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
