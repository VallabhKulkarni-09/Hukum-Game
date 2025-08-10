const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());


const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

function createDeck() {
  const suits = ['Clubs', 'Diamonds', 'Spades', 'Hearts'];
  const values = ['7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
  const deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function rankValue(value) {
  const ranks = { '7': 0, '8': 1, '9': 2, '10': 3, 'Jack': 4, 'Queen': 5, 'King': 6, 'Ace': 7 };
  return ranks[value] || 0;
}

function getTrickWinner(cards, hukum, startingSuit) {
  let maxSuitIndex = -1;
  let maxTrumpIndex = -1;
  let maxOtherIndex = -1;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card.suit === startingSuit) {
      if (maxSuitIndex === -1 || rankValue(card.value) > rankValue(cards[maxSuitIndex].value)) {
        maxSuitIndex = i;
      }
    } else if (card.suit === hukum) {
      if (maxTrumpIndex === -1 || rankValue(card.value) > rankValue(cards[maxTrumpIndex].value)) {
        maxTrumpIndex = i;
      }
    } else {
      if (maxOtherIndex === -1 || rankValue(card.value) > rankValue(cards[maxOtherIndex].value)) {
        maxOtherIndex = i;
      }
    }
  }

  if (maxSuitIndex !== -1) {
    return maxSuitIndex;
  } else if (maxTrumpIndex !== -1) {
    return maxTrumpIndex;
  } else {
    return maxOtherIndex;
  }
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getPublicGameState(room) {
  const publicState = { ...room };
  delete publicState.hands;
  return publicState;
}

function isValidPlay(hand, card, trick, hukum) {
  if (trick.length === 0) return true;
  const leadingSuit = trick[0].card.suit;
  const hasLeadingSuit = hand.some(c => c.suit === leadingSuit);
  if (hasLeadingSuit && card.suit !== leadingSuit) {
    return false;
  }
  return true;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ playerName, playerId, isPrivate = false }) => {
    let roomCode;
    do {
      roomCode = generateRoomCode();
    } while (rooms[roomCode]);

  rooms[roomCode] = {
      roomCode,
      players: [],
      playerSockets: {},
      state: 'teamSelection',
      teams: { A: [], B: [] },
      dealerTeam: null,
      dealer: null,
      hukum: null,
      hukumChooser: null,
      deck: [],
      hands: {},
      currentTurn: null,
      trick: [],
      trickStarter: null,
      round: 0,
      tricksWon: { A: 0, B: 0 },
      gameHistory: [],
      winner: null,
      isPrivate: isPrivate,
      createdAt: Date.now(),
    };

    const newPlayer = { id: playerId, name: playerName, team: null };
    rooms[roomCode].players.push(newPlayer);
    rooms[roomCode].playerSockets[playerId] = socket.id;

    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, player: newPlayer });
    io.to(roomCode).emit('gameState', getPublicGameState(rooms[roomCode]));
  });

  socket.on('joinRoom', ({ roomCode, playerName, playerId }) => {
    const room = rooms[roomCode?.toUpperCase()];
    if (!room) {
      socket.emit('error', 'Room not found.');
      return;
    }
    if (room.players.length >= 4) {
      socket.emit('error', 'Room is full.');
      return;
    }
    if (room.players.some(p => p.id === playerId)) {
      socket.emit('error', 'Player ID already taken.');
      return;
    }

    const newPlayer = { id: playerId, name: playerName, team: null };
    room.players.push(newPlayer);
    room.playerSockets[playerId] = socket.id;

    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode: room.roomCode });
    io.to(roomCode).emit('playerJoined', newPlayer);
    io.to(roomCode).emit('gameState', getPublicGameState(room));
  });

  socket.on('chooseTeam', ({ roomCode, team }) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'teamSelection') return;

    const playerId = Object.keys(room.playerSockets).find(id => room.playerSockets[id] === socket.id);
    if (!playerId) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    if (player.team) {
      const oldTeamIndex = room.teams[player.team].indexOf(playerId);
      if (oldTeamIndex > -1) room.teams[player.team].splice(oldTeamIndex, 1);
    }

    if (room.teams[team].length < 2) {
      room.teams[team].push(playerId);
      player.team = team;
      io.to(roomCode).emit('teamsUpdated', room.teams);
      io.to(roomCode).emit('gameState', getPublicGameState(room));
      
      // Check if all players have joined and teams are full, then auto-start game
      if (room.players.length === 4 && room.teams.A.length === 2 && room.teams.B.length === 2) {
        room.dealerTeam = Math.random() > 0.5 ? 'A' : 'B';
        room.state = 'choosingDealer';
        io.to(roomCode).emit('gameState', getPublicGameState(room));
        io.to(roomCode).emit('promptChooseDealer', { dealerTeam: room.dealerTeam });
      }
    }
  });

  socket.on('startGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'teamSelection') return;
    if (room.players.length !== 4) {
      socket.emit('error', 'Need 4 players to start.');
      return;
    }
    if (room.teams.A.length !== 2 || room.teams.B.length !== 2) {
      socket.emit('error', 'Teams must be full (2 players each).');
      return;
    }

    room.dealerTeam = Math.random() > 0.5 ? 'A' : 'B';
    room.state = 'choosingDealer';
    io.to(roomCode).emit('gameState', getPublicGameState(room));
    io.to(roomCode).emit('promptChooseDealer', { dealerTeam: room.dealerTeam });
  });

  socket.on('chooseDealerPlayer', ({ roomCode, playerId: chosenDealerId }) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'choosingDealer') return;

    const dealerPlayer = room.players.find(p => p.id === chosenDealerId);
    if (!dealerPlayer || dealerPlayer.team !== room.dealerTeam) {
      socket.emit('error', 'Invalid dealer selection.');
      return;
    }

    room.dealer = chosenDealerId;
    let deck = createDeck();
    deck = shuffle(deck);
    room.deck = deck;

    for (let i = 0; i < 4; i++) {
      const playerId = room.players[i].id;
      room.hands[playerId] = deck.splice(0, 4);
    }

    room.players.forEach(player => {
      const playerSocketId = room.playerSockets[player.id];
      if (playerSocketId) {
        io.to(playerSocketId).emit('dealCards', { hand: room.hands[player.id] });
      }
    });

    room.state = 'choosingHukum';
    const hukumChooserTeam = room.dealerTeam === 'A' ? 'B' : 'A';
    const hukumChooserIndex = Math.floor(Math.random() * 2);
    room.hukumChooser = room.teams[hukumChooserTeam][hukumChooserIndex];
    const hukumChooserSocketId = room.playerSockets[room.hukumChooser];
    if (hukumChooserSocketId) {
      io.to(hukumChooserSocketId).emit('promptChooseHukum', { hand: room.hands[room.hukumChooser] });
    }
    io.to(roomCode).emit('gameState', getPublicGameState(room));
  });

  socket.on('chooseHukum', ({ roomCode, suit }) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'choosingHukum') return;

    const playerId = Object.keys(room.playerSockets).find(id => room.playerSockets[id] === socket.id);
    if (!playerId || playerId !== room.hukumChooser) {
      socket.emit('error', 'Not your turn to choose Hukum.');
      return;
    }

    const chooserHand = room.hands[playerId];
    const validSuits = [...new Set(chooserHand.map(card => card.suit))];
    if (!validSuits.includes(suit)) {
      socket.emit('error', 'You must choose Hukum from your 8 cards.');
      return;
    }

    for (let i = 0; i < 4; i++) {
      const pid = room.players[i].id;
      const next4 = room.deck.splice(0, 4);
      room.hands[pid] = room.hands[pid].concat(next4);
    }

    room.players.forEach(player => {
      const playerSocketId = room.playerSockets[player.id];
      if (playerSocketId) {
        io.to(playerSocketId).emit('dealCards', { hand: room.hands[player.id] });
      }
    });

    room.hukum = suit;
    room.state = 'playing';
    room.round = 0;
    room.tricksWon = { A: 0, B: 0 };
    room.trick = [];
    const firstPlayerTeam = room.dealerTeam;
    room.currentTurn = room.teams[firstPlayerTeam][0];
    room.trickStarter = room.currentTurn;
    io.to(roomCode).emit('gameState', getPublicGameState(room));
    io.to(roomCode).emit('hukumChosen', { hukum: suit, chooser: room.players.find(p => p.id === room.hukumChooser).name });
  });

  socket.on('playCard', ({ roomCode, card }) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'playing') return;

    const playerId = Object.keys(room.playerSockets).find(id => room.playerSockets[id] === socket.id);
    if (!playerId || playerId !== room.currentTurn) {
      socket.emit('error', 'Not your turn.');
      return;
    }

    const hand = room.hands[playerId];
    const cardIndex = hand.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (cardIndex === -1) {
      socket.emit('error', 'Card not in your hand.');
      return;
    }

    if (!isValidPlay(hand, card, room.trick, room.hukum)) {
      let errorMessage = 'Invalid play. ';
      if (room.trick.length > 0) {
        const leadingSuit = room.trick[0].card.suit;
        if (hand.some(c => c.suit === leadingSuit)) {
          errorMessage += `You must follow the leading suit (${leadingSuit}).`;
        }
      }
      socket.emit('error', errorMessage);
      return;
    }

    hand.splice(cardIndex, 1);
    room.trick.push({ playerId, card });
    io.to(roomCode).emit('cardPlayed', { playerId, card, playerName: room.players.find(p => p.id === playerId).name });
    const playerSocketId = room.playerSockets[playerId];
    if (playerSocketId) {
      io.to(playerSocketId).emit('handUpdated', { hand });
    }

    // Find the current player's index in the trick order
    const currentPlayerIndex = room.players.findIndex(p => p.id === playerId);
    
    // Set the next player's turn
    const nextPlayerIndex = (currentPlayerIndex + 1) % 4;
    room.currentTurn = room.players[nextPlayerIndex].id;

    // If this is the 4th card, complete the trick
    if (room.trick.length === 4) {
      const leadingSuit = room.trick[0].card.suit;
      const winnerIdx = getTrickWinner(room.trick.map(t => t.card), room.hukum, leadingSuit);
      const winnerId = room.trick[winnerIdx].playerId;
      const winnerPlayer = room.players.find(p => p.id === winnerId);
      const winnerTeam = winnerPlayer.team;

      room.tricksWon[winnerTeam] += 1;
      room.gameHistory.push({
        round: room.round + 1,
        trick: [...room.trick],
        winner: winnerId,
        winnerTeam,
        leadingSuit
      });

      io.to(roomCode).emit('trickComplete', {
        winner: winnerId,
        winnerName: winnerPlayer.name,
        winnerTeam,
        trick: room.trick,
        tricksWon: room.tricksWon
      });

      setTimeout(() => {
        room.trick = [];
        room.currentTurn = winnerId;
        room.trickStarter = winnerId;
        room.round += 1;

        const dealerTeamTricks = room.tricksWon[room.dealerTeam];
        const otherTeam = room.dealerTeam === 'A' ? 'B' : 'A';
        const otherTeamTricks = room.tricksWon[otherTeam];
        let gameEnded = false;

        if (dealerTeamTricks >= 5) {
          room.state = 'gameOver';
          room.winner = `Team ${room.dealerTeam}`;
          gameEnded = true;
        } else if (otherTeamTricks >= 4) {
          room.state = 'gameOver';
          room.winner = `Team ${otherTeam}`;
          gameEnded = true;
        } else if (room.round >= 8) {
          room.state = 'gameOver';
          room.winner = dealerTeamTricks > otherTeamTricks ? `Team ${room.dealerTeam}` : otherTeamTricks > dealerTeamTricks ? `Team ${otherTeam}` : 'Draw';
          gameEnded = true;
        }

        io.to(roomCode).emit('trickCleared');
        io.to(roomCode).emit('gameState', getPublicGameState(room));
        if (gameEnded) {
          io.to(roomCode).emit('gameOver', {
            winner: room.winner,
            finalScores: room.tricksWon,
            gameHistory: room.gameHistory
          });
        }
      }, 2500);
    } else {
      io.to(roomCode).emit('gameState', getPublicGameState(room));
    }
  });

  socket.on('getGameState', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room) {
      const playerId = Object.keys(room.playerSockets).find(id => room.playerSockets[id] === socket.id);
      const stateToSend = getPublicGameState(room);
      stateToSend.playerHand = (playerId && room.hands[playerId] && room.state !== 'gameOver') ? room.hands[playerId] : [];
      socket.emit('gameState', stateToSend);
    }
  });

  socket.on('getPublicRooms', () => {
    const publicRooms = Object.values(rooms)
      .filter(room => !room.isPrivate && room.state === 'teamSelection' && room.players.length < 4)
      .map(room => ({
        roomCode: room.roomCode,
        playerCount: room.players.length,
        createdAt: room.createdAt
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
    
    socket.emit('publicRooms', publicRooms);
  });

  socket.on('quickJoin', ({ playerName, playerId }) => {
    console.log('DEBUG: Backend quickJoin called with playerName:', playerName, 'playerId:', playerId);
    console.log('DEBUG: Socket ID:', socket.id);
    
    // Find a public room with space
    const availableRooms = Object.values(rooms)
      .filter(room => !room.isPrivate && room.state === 'teamSelection' && room.players.length < 4);
    
    console.log('DEBUG: Available rooms found:', availableRooms.length);
    
    if (availableRooms.length > 0) {
      console.log('DEBUG: Joining existing room');
      // Join the first available room
      const room = availableRooms[0];
      const newPlayer = { id: playerId, name: playerName, team: null };
      room.players.push(newPlayer);
      room.playerSockets[playerId] = socket.id;

      // Auto-assign team for quick join (first 2 players to Team A, next 2 to Team B)
      if (room.players.length <= 2) {
        newPlayer.team = 'A';
        room.teams.A.push(playerId);
      } else {
        newPlayer.team = 'B';
        room.teams.B.push(playerId);
      }

      console.log('DEBUG: Player added to room, team assigned:', newPlayer.team);
      console.log('DEBUG: Room players count:', room.players.length);
      socket.join(room.roomCode);
      console.log('DEBUG: Socket joined room:', room.roomCode);
      console.log('DEBUG: Emitting roomJoined with roomCode:', room.roomCode);
      socket.emit('roomJoined', { roomCode: room.roomCode });
      console.log('DEBUG: roomJoined event emitted');
      io.to(room.roomCode).emit('playerJoined', newPlayer);
      console.log('DEBUG: Emitting gameState for room:', room.roomCode);
      io.to(room.roomCode).emit('gameState', getPublicGameState(room));
      console.log('DEBUG: gameState event emitted');
      
      // Check if room is now full and auto-start game
      if (room.players.length === 4 && room.teams.A.length === 2 && room.teams.B.length === 2) {
        room.dealerTeam = Math.random() > 0.5 ? 'A' : 'B';
        room.state = 'choosingDealer';
        io.to(room.roomCode).emit('gameState', getPublicGameState(room));
        io.to(room.roomCode).emit('promptChooseDealer', { dealerTeam: room.dealerTeam });
      }
    } else {
      console.log('DEBUG: No available rooms, creating new room');
      // No available rooms, create a new public one
      let roomCode;
      do {
        roomCode = generateRoomCode();
      } while (rooms[roomCode]);

      rooms[roomCode] = {
        roomCode,
        players: [],
        playerSockets: {},
        state: 'teamSelection',
        teams: { A: [], B: [] },
        dealerTeam: null,
        dealer: null,
        hukum: null,
        hukumChooser: null,
        deck: [],
        hands: {},
        currentTurn: null,
        trick: [],
        trickStarter: null,
        round: 0,
        tricksWon: { A: 0, B: 0 },
        gameHistory: [],
        winner: null,
        isPrivate: false,
        createdAt: Date.now(),
      };

      const newPlayer = { id: playerId, name: playerName, team: 'A' };
      rooms[roomCode].players.push(newPlayer);
      rooms[roomCode].playerSockets[playerId] = socket.id;
      rooms[roomCode].teams.A.push(playerId);

      console.log('DEBUG: New room created with roomCode:', roomCode);
      console.log('DEBUG: Room players count:', rooms[roomCode].players.length);
      socket.join(roomCode);
      console.log('DEBUG: Socket joined room:', roomCode);
      console.log('DEBUG: Emitting roomCreated with roomCode:', roomCode);
      socket.emit('roomCreated', { roomCode, player: newPlayer });
      console.log('DEBUG: roomCreated event emitted');
      io.to(roomCode).emit('gameState', getPublicGameState(rooms[roomCode]));
      console.log('DEBUG: gameState event emitted');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (let roomCode in rooms) {
      const room = rooms[roomCode];
      const playerId = Object.keys(room.playerSockets).find(id => room.playerSockets[id] === socket.id);
      if (playerId) {
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex > -1) {
          const player = room.players.splice(playerIndex, 1)[0];
          delete room.playerSockets[playerId];
          if (player.team && room.teams[player.team]) {
            const teamIndex = room.teams[player.team].indexOf(playerId);
            if (teamIndex > -1) room.teams[player.team].splice(teamIndex, 1);
          }
          io.to(roomCode).emit('playerLeft', { id: playerId, name: player.name });
          io.to(roomCode).emit('gameState', getPublicGameState(room));
          if (room.state === 'teamSelection') {
            io.to(roomCode).emit('teamsUpdated', room.teams);
          }
          break;
        }
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});