const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = [];

io.on("connection", (socket) => {
  console.log("✅ Connexion :", socket.id);

  socket.on("join", (data) => {
    // Empêcher les doublons de socket.id mais autoriser reconnexion (par nom)
    const existing = players.find(p => p.name === data.name);
    if (existing) {
      existing.id = socket.id; // Mise à jour de l'ID pour permettre la reconnexion
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

  socket.on("disconnect", () => {
    // Ne pas retirer le joueur, juste marquer comme déconnecté si besoin (optionnel)
    console.log("❌ Déconnexion :", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
