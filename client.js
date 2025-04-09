const socket = io();

// Exemple de gestion d'événements
socket.on('connect', () => {
  console.log('Connecté au serveur');
});

// Autres fonctionnalités côté client ici
