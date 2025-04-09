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
  const files = fs.readdirSync(scenesPath).filter(file => file.endsWith("_a.jpg") || file.endsWith("_a.png"));
  return files.map(f => f.replace("_a", ""));
}

function getScenePair(sceneBase) {
  return {
    normal: `scenes/${sceneBase}_a.jpg`,
    blind: `scenes/${sceneBase}_b.jpg`
  };
}

scenes = loadScenePairs();

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
      scores[data.name] = 0;
    }

    console.log(`👤 ${data.name} est connecté`);
    io.emit("players", players);
    io.emit("scores", scores);
  });

  socket.on("startRound", () => {
    console.log("📢 startRound reçu");
    if (players.length < 3 || scenes.length === 0) return;
    blindPlayer = players[Math.floor(Math.random() * players.length)].name;
    const sceneBase = scenes[Math.floor(Math.random() * scenes.length)];
    const selected = getScenePair(sceneBase);

    hints = {};
    votes = {};

    for (const player of players) {
      const image = player.name === blindPlayer ? selected.blind : selected.normal;
      io.to(player.id).emit("newRound", {
        blindPlayer,
        currentScene: image
      });
    }
  });

  socket.on("submitHint", (hint) => {
    const player = players.find(p => p.id === socket.id);
    if (!player) return;
    hints[player.name] = hint;

    if (Object.keys(hints).length === players.length) {
      io.emit("allHints", hints);
    }
  });

  socket.on("vote", (targetName) => {
    const voter = players.find(p => p.id === socket.id);
    if (!voter || voter.name === blindPlayer) return;
    votes[voter.name] = targetName;

    if (Object.keys(votes).length === players.length - 1) {
      let results = {};
      for (let v of Object.values(votes)) {
        results[v] = (results[v] || 0) + 1;
      }
      const mostVoted = Object.entries(results).sort((a, b) => b[1] - a[1])[0][0];

      if (mostVoted === blindPlayer) {
        for (let voterName of Object.keys(votes)) {
          scores[voterName] += 1;
        }
      } else {
        if (scores[blindPlayer] !== undefined) {
          scores[blindPlayer] += 2;
        }
      }

      io.emit("roundResult", { blindPlayer, mostVoted });
      io.emit("scores", scores);
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
