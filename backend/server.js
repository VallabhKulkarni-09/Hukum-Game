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

// Helper: Get Public Game State (hide hands)
function getPublicGameState(room) {
  const publicState = { ...room };
  // Hide hands from other players
  delete publicState.hands;
  // Optionally, reveal current player's hand to themselves on request
  return publicState;
}

// --- CORRECTED Helper Function: Validate Card Play ---
// This is the key fix for allowing any card when lacking the lead suit.
function isValidPlay(hand, card, trick, trickStarter, hukum, players) {
  // 1. Check if the card is actually in the player's hand
  const cardInHand = hand.find(c => c.suit === card.suit && c.value === card.value);
  if (!cardInHand) {
    return false; // Card not in hand is always invalid
  }

  // 2. If this is the first card played in the trick, any card is valid
  if (trick.length === 0) {
    return true;
  }

  // 3. It's not the first card, so we need to check the suit rules
  const startingSuit = trick[0].card.suit;

  // Check if the player has any cards of the suit that was led
  const hasStartingSuit = hand.some(c => c.suit === startingSuit);

  // 4. If the player HAS the starting suit, they MUST play a card of that suit
  if (hasStartingSuit) {
    return card.suit === startingSuit;
  }

  // 5. If the player does NOT have the starting suit, they can play ANY card
  // This includes trumps (Hukum) or any other suit.
  // No further checks are needed.
  return true;
}
// --- End Helper Function ---

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
      roomCode, // Store room code inside the room object
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
      round: 0, // 0-7
      scores: { A: 0, B: 0 },
      winner: null,
      isPrivate: isPrivate,
      createdAt: Date.now(),
    };

    const newPlayer = { id: playerId, name: playerName, team: null };
    rooms[roomCode].players.push(newPlayer);
    rooms[roomCode].playerSockets[playerId] = socket.id;

    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, player: newPlayer });
    // No need to emit playerJoined for the creator, they are already in the room state
    io.to(roomCode).emit('gameState', getPublicGameState(rooms[roomCode])); // Update for creator
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
        io.to(roomCode).emit('teamsUpdated', room.teams); // Update teams for all
        io.to(roomCode).emit('gameState', getPublicGameState(room)); // Update full state
    }
  });

  // Start Game
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

    // Assign teams to players (in case they weren't set properly)
    room.players.forEach(player => {
        if (!player.team) {
             // Assign to the team with space
             if (room.teams.A.length < 2) {
                 room.teams.A.push(player.id);
                 player.team = 'A';
             } else if (room.teams.B.length < 2) {
                 room.teams.B.push(player.id);
                 player.team = 'B';
             }
        }
    });

    // Choose dealer team (random)
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
    
    // Deal cards
    let deck = createDeck();
    deck = shuffle(deck);

    // Deal 4 cards to each player
    for (let i = 0; i < 4; i++) {
        room.hands[room.players[i].id] = deck.splice(0, 4);
    }

    // Deal remaining 4 cards after a short delay
    setTimeout(() => {
        for (let i = 0; i < 4; i++) {
            const playerId = room.players[i].id;
            const newCards = deck.splice(0, 4);
            room.hands[playerId] = room.hands[playerId].concat(newCards);
            
            // Send the full hand only to the player who received it
            const playerSocketId = room.playerSockets[playerId];
            if (playerSocketId) {
                io.to(playerSocketId).emit('dealSecondHalf', newCards);
            }
        }
        room.state = 'choosingHukum';

        // Determine who chooses Hukum (player after dealer)
        const dealerIndex = room.players.findIndex(p => p.id === room.dealer);
        const hukumChooser = room.players[(dealerIndex + 1) % 4];
        const hukumChooserSocketId = room.playerSockets[hukumChooser.id];
        if (hukumChooserSocketId) {
            io.to(hukumChooserSocketId).emit('promptChooseHukum');
        }
        room.round = 0; // Initialize round counter
        room.scores = { A: 0, B: 0 }; // Initialize scores
        room.trick = [];
        const firstPlayerToPlay = room.players[(dealerIndex + 2) % 4];
        room.currentTurn = firstPlayerToPlay.id;
        room.trickStarter = room.currentTurn;
        
        io.to(roomCode).emit('gameState', getPublicGameState(room));
    }, 1500); // 1.5 second delay for dealing
  });

  // Choose Hukum Suit
  socket.on('chooseHukum', ({ roomCode, suit }) => {
    const room = rooms[roomCode];
    // Allow choosing Hukum even if state is still 'choosingDealer' (in case of race condition)
    // or if it's correctly 'choosingHukum'
    if (!room || (room.state !== 'choosingDealer' && room.state !== 'choosingHukum')) return;

    const playerId = Object.keys(room.playerSockets).find(id => room.playerSockets[id] === socket.id);
    if (!playerId) return;

    // Verify this player is the one who should choose Hukum
    const dealerIndex = room.players.findIndex(p => p.id === room.dealer);
    const expectedChooserId = room.players[(dealerIndex + 1) % 4].id;
    if (playerId !== expectedChooserId) {
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
    // round, scores, trick, currentTurn, trickStarter are already set in chooseDealerPlayer
    io.to(roomCode).emit('gameState', getPublicGameState(room));
  });

  // Play Card
  socket.on('playCard', ({ roomCode, card }) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'playing') return;

    const playerId = Object.keys(room.playerSockets).find(id => room.playerSockets[id] === socket.id);
    if (!playerId || playerId !== room.currentTurn) {
      socket.emit('error', 'Not your turn.');
      return;
    }

    const hand = room.hands[playerId];
    // Basic validation
    const cardIndex = hand.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (cardIndex === -1) {
        socket.emit('error', 'Card not in hand.');
        return;
    }

    // --- More detailed play validation ---
    const isValidPlay = (hand, card, trick, trickStarter, hukum, players) => {
        if (trick.length === 0) return true; // First card is always valid

        const startingSuit = trick[0].card.suit;
        const hasCurrentSuit = hand.some(c => c.suit === startingSuit);
        const hasHukum = hand.some(c => c.suit === hukum);

        if (hasCurrentSuit && card.suit !== startingSuit) {
            return false; // Must follow suit
        }
        if (!hasCurrentSuit && card.suit !== hukum && hasHukum) {
            return false; // Must play trump if no suit and has trump
        }
        return true;
    };
    // --- End validation ---

    const isValid = isValidPlay(hand, card, room.trick, room.trickStarter, room.hukum, room.players);
    if (!isValid) {
      socket.emit('error', 'Invalid play according to game rules.');
      return;
    }

    // Remove card from hand
    hand.splice(cardIndex, 1);
    // Add card to trick
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

    // Check if trick is complete (4 cards played)
    if (room.trick.length === 4) {
      const leadingSuit = room.trick[0].card.suit;
      const winnerIdx = getTrickWinner(room.trick.map(t => t.card), room.hukum, leadingSuit);
      const winnerId = room.trick[winnerIdx].playerId;
      const winnerPlayer = room.players.find(p => p.id === winnerId);
      const winnerTeam = winnerPlayer.team;

      room.scores[winnerTeam] += 1;
      
      // Clear trick and set next leader
      room.trick = [];
      room.currentTurn = winnerId;
      room.trickStarter = winnerId;
      room.round += 1;

      // Check for win condition
      const targetA = room.dealerTeam === 'A' ? 5 : 4;
      const targetB = room.dealerTeam === 'B' ? 5 : 4;
      if (room.scores.A >= targetA || room.scores.B >= targetB || room.round >= 8) { // Max 8 rounds
        room.state = 'gameOver';
        if (room.scores.A >= targetA) {
            room.winner = 'Team A';
        } else if (room.scores.B >= targetB) {
            room.winner = 'Team B';
        } else {
            // Tie or end of rounds, determine by score
            room.winner = room.scores.A > room.scores.B ? 'Team A' : (room.scores.B > room.scores.A ? 'Team B' : 'Draw');
        }
      }
    }

    io.to(roomCode).emit('gameState', getPublicGameState(room));
  });

  // Get Game State (for reconnection)
  socket.on('getGameState', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room) {
      const playerId = Object.keys(room.playerSockets).find(id => room.playerSockets[id] === socket.id);
      const stateToSend = getPublicGameState(room);
      if (playerId && room.hands[playerId]) {
          // Send player's own hand
          stateToSend.playerHand = room.hands[playerId];
      }
      io.to(socket.id).emit('gameState', stateToSend);
    }
  });

  // Disconnect
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

            // Remove from team
            if (player.team && room.teams[player.team]) {
                const teamIndex = room.teams[player.team].indexOf(playerId);
                if (teamIndex > -1) room.teams[player.team].splice(teamIndex, 1);
            }

            io.to(roomCode).emit('playerLeft', { id: playerId, name: player.name });
            io.to(roomCode).emit('gameState', getPublicGameState(room));
            // Optionally, update teams if someone leaves pre-game
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