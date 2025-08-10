// backend/server.js
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

// In-memory storage for games
const rooms = {}; // roomCode: gameState

// Helper: Create Deck
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

// Helper: Shuffle Array
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helper: Rank Value for Trick Comparison
function rankValue(value) {
  const ranks = { '7': 0, '8': 1, '9': 2, '10': 3, 'Jack': 4, 'Queen': 5, 'King': 6, 'Ace': 7 };
  return ranks[value] || 0;
}

// Helper: Determine Trick Winner
function getTrickWinner(cards, hukum, startingSuit) {
  let highestCard = cards[0];
  let winnerIndex = 0;

  for (let i = 1; i < cards.length; i++) {
    const card = cards[i];
    // Trump beats non-trump
    if (card.suit === hukum && highestCard.suit !== hukum) {
      highestCard = card;
      winnerIndex = i;
    }
    // Higher trump beats lower trump
    else if (card.suit === hukum && highestCard.suit === hukum) {
      if (rankValue(card.value) > rankValue(highestCard.value)) {
        highestCard = card;
        winnerIndex = i;
      }
    }
    // Non-trump follows suit beats lower non-trump of same suit
    else if (card.suit === startingSuit && highestCard.suit !== startingSuit) {
      highestCard = card;
      winnerIndex = i;
    }
    else if (card.suit === startingSuit && highestCard.suit === startingSuit) {
      if (rankValue(card.value) > rankValue(highestCard.value)) {
        highestCard = card;
        winnerIndex = i;
      }
    }
  }
  return winnerIndex;
}

// Helper: Generate Room Code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper: Get Public Game State (hide hands from other players, send player's own hand)
function getPublicGameState(room, playerIdForHand = null) {
  const publicState = {
    ...room,
    // Always hide the full hands object from general state
  };
  delete publicState.hands;
  delete publicState.deck; // Don't send the deck either

  // If a specific player ID is provided, send their hand
  if (playerIdForHand && room.hands && room.hands[playerIdForHand]) {
      publicState.playerHand = room.hands[playerIdForHand];
  }

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

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create Room
  socket.on('createRoom', ({ playerName, playerId }) => {
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
      deck: [],
      hands: {},
      currentTurn: null,
      trick: [],
      trickStarter: null,
      round: 0,
      scores: { A: 0, B: 0 },
      winner: null,
    };

    const newPlayer = { id: playerId, name: playerName, team: null };
    rooms[roomCode].players.push(newPlayer);
    rooms[roomCode].playerSockets[playerId] = socket.id;

    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode });
    io.to(roomCode).emit('gameState', getPublicGameState(rooms[roomCode]));
  });

  // Join Room
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
      socket.emit('error', 'Player ID taken.');
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

  // Choose Team
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
        socket.emit('error', 'Teams must be full (2 players each) to start.');
        return;
    }

    room.players.forEach(player => {
        if (!player.team) {
             if (room.teams.A.length < 2) {
                 room.teams.A.push(player.id);
                 player.team = 'A';
             } else if (room.teams.B.length < 2) {
                 room.teams.B.push(player.id);
                 player.team = 'B';
             }
        }
    });

    room.dealerTeam = Math.random() > 0.5 ? 'A' : 'B';
    room.state = 'choosingDealer';
    io.to(roomCode).emit('gameState', getPublicGameState(room));
    io.to(roomCode).emit('promptChooseDealerTeam', { dealerTeam: room.dealerTeam });
  });

  // Choose Dealer Player (after team is chosen)
  socket.on('chooseDealerPlayer', ({ roomCode, playerId: chosenDealerId }) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'choosingDealer') return;

    const dealerPlayer = room.players.find(p => p.id === chosenDealerId);
    if (!dealerPlayer || dealerPlayer.team !== room.dealerTeam) {
        socket.emit('error', 'Invalid dealer selection.');
        return;
    }

    room.dealer = chosenDealerId;

    // Deal cards - STEP 1: Deal first 4 cards to each player
    let deck = createDeck();
    deck = shuffle(deck);
    room.deck = deck; // Store for later

    for (let i = 0; i < 4; i++) {
        const playerId = room.players[i].id;
        room.hands[playerId] = deck.splice(0, 4);
        // Send the initial hand only to the player who received it
        const playerSocketId = room.playerSockets[playerId];
        if (playerSocketId) {
            io.to(playerSocketId).emit('dealFirstHalf', room.hands[playerId]); // New event
        }
    }

    // Update state to 'choosingHukum' immediately so Hukum chooser knows it's their turn
    room.state = 'choosingHukum';

    // Determine who chooses Hukum (player after dealer)
    const dealerIndex = room.players.findIndex(p => p.id === room.dealer);
    const hukumChooser = room.players[(dealerIndex + 1) % 4];
    const hukumChooserSocketId = room.playerSockets[hukumChooser.id];
    if (hukumChooserSocketId) {
        io.to(hukumChooserSocketId).emit('promptChooseHukum');
    }

    // Broadcast the updated state (including dealer, but not full hands yet for others)
    io.to(roomCode).emit('gameState', getPublicGameState(room));
    // Note: Players will get their own hand via 'dealFirstHalf' or 'gameState' with playerHand if they reconnect
  });

  // Choose Hukum Suit - STEP 2: After seeing first 4 cards
  socket.on('chooseHukum', ({ roomCode, suit }) => {
    const room = rooms[roomCode];
    // Allow choosing Hukum even if state is still 'choosingDealer' (in case of race condition)
    // or if it's correctly 'choosingHukum'
    if (!room || (room.state !== 'choosingDealer' && room.state !== 'choosingHukum')) return;

    const playerId = Object.keys(room.playerSockets).find(id => room.playerSockets[id] === socket.id);
    if (!playerId) return;

    const dealerIndex = room.players.findIndex(p => p.id === room.dealer);
    const expectedChooserId = room.players[(dealerIndex + 1) % 4].id;
    if (playerId !== expectedChooserId) {
        socket.emit('error', 'Not your turn to choose Hukum.');
        return;
    }

    if (!['Clubs', 'Diamonds', 'Spades', 'Hearts'].includes(suit)) {
        socket.emit('error', 'Invalid suit.');
        return;
    }

    room.hukum = suit;

    // Deal remaining 4 cards to each player after a short delay
    setTimeout(() => {
        // Deal remaining 4 cards
        for (let i = 0; i < 4; i++) {
            const playerId = room.players[i].id;
            const newCards = room.deck.splice(0, 4); // Use the stored deck
            room.hands[playerId] = room.hands[playerId].concat(newCards);

            // Send the second half of the hand only to the player who received it
            const playerSocketId = room.playerSockets[playerId];
            if (playerSocketId) {
                io.to(playerSocketId).emit('dealSecondHalf', newCards); // New event
            }
        }

        // Now the game officially starts
        room.state = 'playing';
        room.round = 0;
        room.scores = { A: 0, B: 0 };
        room.trick = [];
        const firstPlayerToPlay = room.players[(dealerIndex + 2) % 4];
        room.currentTurn = firstPlayerToPlay.id;
        room.trickStarter = room.currentTurn;

        // Broadcast the final game state with full hands (each player gets theirs via playerHand)
        io.to(roomCode).emit('gameState', getPublicGameState(room));
        // Also send the full hand to each player individually for clarity
        for (let i = 0; i < 4; i++) {
            const playerId = room.players[i].id;
            const playerSocketId = room.playerSockets[playerId];
            if (playerSocketId) {
                 // Send the complete hand again
                 io.to(playerSocketId).emit('fullHand', room.hands[playerId]);
            }
        }

    }, 1500); // 1.5 second delay for dealing the second half
  });

  // Play Card - Uses the corrected isValidPlay function
  socket.on('playCard', ({ roomCode, card }) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'playing') return;

    const playerId = Object.keys(room.playerSockets).find(id => room.playerSockets[id] === socket.id);
    if (!playerId || playerId !== room.currentTurn) {
      socket.emit('error', 'Not your turn.');
      return;
    }

    const hand = room.hands[playerId];
    // --- Use the corrected isValidPlay function ---
    const isValid = isValidPlay(hand, card, room.trick, room.trickStarter, room.hukum, room.players);
    if (!isValid) {
      socket.emit('error', 'Invalid play according to game rules.');
      return;
    }

    // If valid, remove the card from hand
    const cardIndex = hand.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (cardIndex !== -1) { // Should always be true if isValid is true
        hand.splice(cardIndex, 1);
    }

    // Add card to the trick
    room.trick.push({ playerId, card });

    io.to(roomCode).emit('cardPlayed', { playerId, card });

    // Move to next player
    const currentIndex = room.players.findIndex(p => p.id === playerId);
    room.currentTurn = room.players[(currentIndex + 1) % 4].id;

    // Check if trick is complete
    if (room.trick.length === 4) {
      const startingSuit = room.trick[0].card.suit;
      const winnerIdx = getTrickWinner(room.trick.map(t => t.card), room.hukum, startingSuit);
      const winnerId = room.trick[winnerIdx].playerId;
      const winnerPlayer = room.players.find(p => p.id === winnerId);
      const winnerTeam = winnerPlayer.team;

      room.scores[winnerTeam] += 1;
      room.trick = [];
      room.currentTurn = winnerId;
      room.trickStarter = winnerId;
      room.round += 1;

      const targetA = room.dealerTeam === 'A' ? 5 : 4;
      const targetB = room.dealerTeam === 'B' ? 5 : 4;
      if (room.scores.A >= targetA || room.scores.B >= targetB || room.round >= 8) {
        room.state = 'gameOver';
        if (room.scores.A >= targetA) {
            room.winner = 'Team A';
        } else if (room.scores.B >= targetB) {
            room.winner = 'Team B';
        } else {
            room.winner = room.scores.A > room.scores.B ? 'Team A' : (room.scores.B > room.scores.A ? 'Team B' : 'Draw');
        }
      }
    }

    io.to(roomCode).emit('gameState', getPublicGameState(room));
  });

  // Get Game State (for reconnection, sends player's own hand)
  socket.on('getGameState', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room) {
      const playerId = Object.keys(room.playerSockets).find(id => room.playerSockets[id] === socket.id);
      // Send the public state, including the requesting player's hand if available
      io.to(socket.id).emit('gameState', getPublicGameState(room, playerId));
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