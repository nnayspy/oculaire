const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Pour servir les fichiers statiques comme index.html
app.use(express.static(__dirname));

let players = [];

io.on("connection", (socket) => {
  console.log("✅ Un joueur s'est connecté :", socket.id);

  socket.on("join", (data) => {
    const player = {
      id: socket.id,
      name: data.name,
      avatar: data.avatar
    };
    players.push(player);
    console.log(`👤 ${player.name} a rejoint la partie`);

    // Envoyer la liste à tous les joueurs connectés
    io.emit("players", players);
  });

  socket.on("disconnect", () => {
    players = players.filter(p => p.id !== socket.id);
    console.log("❌ Un joueur s'est déconnecté :", socket.id);
    io.emit("players", players);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
