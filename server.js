const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.use('/scenes', express.static(path.join(__dirname, 'scenes')));

let players = [];
let scenes = [];
let blindPlayer = null;
let votes = {};
let scores = {};
let hints = {};

function loadScenePairs() {
  const scenesPath = path.join(__dirname, 'scenes');
  const files = fs.readdirSync(scenesPath).filter(file => file.endsWith("a.jpg") || file.endsWith("a.png"));
  return files.map(f => f.replace(/a\.(jpg|png)$/i, ""));
}

function getScenePair(sceneBase) {
  return {
    normal: `scenes/${sceneBase}a.jpg`,
    blind: `scenes/${sceneBase}b.jpg`
  };
}

scenes = loadScenePairs();
console.log("📸 Scènes disponibles :", scenes);

io.on("connection", (socket) => {
  console.log("✅ Connexion :", socket.id);

  socket.on("join", (data) => {
    let player = players.find(p => p.name === data.name);
    if (!player) {
      player = { id: socket.id, name: data.name, avatar: data.avatar, eliminated: false };
      players.push(player);
      scores[data.name] = 0;
    } else {
      player.id = socket.id;
      player.avatar = data.avatar;
    }
    console.log(`👤 ${data.name} est connecté`);
    io.emit("players", players);
    io.emit("scores", scores);
  });

  socket.on("startRound", () => {
    if (players.length < 3 || scenes.length === 0) return;
    blindPlayer = players[Math.floor(Math.random() * players.length)].name;
    const sceneBase = scenes[Math.floor(Math.random() * scenes.length)];
    const selected = getScenePair(sceneBase);

    hints = {};
    votes = {};

    for (const player of players.filter(p => !p.eliminated)) {
      const image = player.name === blindPlayer ? selected.blind : selected.normal;
      io.to(player.id).emit("newRound", { blindPlayer, currentScene: image });
    }
  });

  socket.on("submitHint", (hint) => {
    const player = players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;
    hints[player.name] = hint;

    const activePlayers = players.filter(p => !p.eliminated);
    if (Object.keys(hints).length === activePlayers.length) {
      io.emit("allHints", hints);
    }
  });

  socket.on("vote", (targetName) => {
    const voter = players.find(p => p.id === socket.id);
    if (!voter || voter.eliminated) return;
    votes[voter.name] = targetName;

    const activePlayers = players.filter(p => !p.eliminated);
    if (Object.keys(votes).length === activePlayers.length - 1) {
      let results = {};
      Object.values(votes).forEach(v => results[v] = (results[v] || 0) + 1);

      const sorted = Object.entries(results).sort((a, b) => b[1] - a[1]);
      const [topName, topVotes] = sorted[0];
      const tied = sorted.filter(([_, v]) => v === topVotes).length > 1;
      const majority = Math.floor(activePlayers.length / 2) + 1;

      if (tied || topVotes < majority) {
        io.emit("tieOrNoMajority", { voteCounts: results });
        hints = {};
        votes = {};
        return;
      }

      players.find(p => p.name === topName).eliminated = true;
      io.emit("roundResult", { eliminated: topName, voteCounts: results });
      votes = {};

      if (topName === blindPlayer) {
        activePlayers.forEach(p => { if (p.name !== blindPlayer) scores[p.name] += 1; });
        io.emit("gameOver", { winner: "civils", scores });
      } else if (activePlayers.length <= 3) {
        scores[blindPlayer] += 2;
        io.emit("gameOver", { winner: "undercover", scores });
      }
    }
  });

  socket.on("disconnect", () => {
    players = players.filter(p => p.id !== socket.id);
    io.emit("players", players);
  });
});

server.listen(3000, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:3000`);
});
