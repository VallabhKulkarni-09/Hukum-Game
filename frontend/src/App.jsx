// frontend/src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import GameTable from './components/GameTable'; // GameTable now handles Lobby view
import './styles.css'; // Import global styles

// Connect to the backend server (proxied via Vite dev server)
// Vite's proxy (defined in vite.config.js) will forward this to http://localhost:4000
const socket = io();

function App() {
  const [view, setView] = useState('lobby'); // 'lobby' or 'game'
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [gameState, setGameState] = useState(null);
  const socketRef = useRef(socket); // Use ref to persist socket instance

  useEffect(() => {
    // --- Setup Socket Listeners ---
    const handleRoomCreated = ({ roomCode }) => {
      console.log("Room created:", roomCode);
      setRoomCode(roomCode);
      setView('game'); // Transition to game view (which shows lobby/team selection)
    };

    const handleRoomJoined = ({ roomCode }) => {
      console.log("Room joined:", roomCode);
      setRoomCode(roomCode);
      setView('game'); // Transition to game view (which shows lobby/team selection)
    };

    const handlePlayerJoined = (player) => {
      console.log(`${player.name} joined the room.`);
      // gameState update will handle UI changes
    };

    const handleGameState = (state) => {
      console.log("Received game state update:", state);
      setGameState(state);
    };

    const handleCardPlayed = ({ playerId, card }) => {
      console.log(`Player ${playerId} played ${card.value} of ${card.suit}`);
      // gameState update will handle UI changes
    };

    const handleError = (msg) => {
      console.error("Socket Error:", msg);
      alert(`Error: ${msg}`);
    };

    const handlePlayerLeft = ({ id, name }) => {
      console.log(`Player ${name} (${id}) left the room.`);
      // gameState update will handle UI changes
    };

    // Attach listeners
    socketRef.current.on('roomCreated', handleRoomCreated);
    socketRef.current.on('roomJoined', handleRoomJoined);
    socketRef.current.on('playerJoined', handlePlayerJoined);
    socketRef.current.on('gameState', handleGameState);
    socketRef.current.on('cardPlayed', handleCardPlayed);
    socketRef.current.on('error', handleError);
    socketRef.current.on('playerLeft', handlePlayerLeft);

    // Cleanup listeners on component unmount
    return () => {
      socketRef.current.off('roomCreated', handleRoomCreated);
      socketRef.current.off('roomJoined', handleRoomJoined);
      socketRef.current.off('playerJoined', handlePlayerJoined);
      socketRef.current.off('gameState', handleGameState);
      socketRef.current.off('cardPlayed', handleCardPlayed);
      socketRef.current.off('error', handleError);
      socketRef.current.off('playerLeft', handlePlayerLeft);
    };
  }, []); // Empty dependency array: run once on mount

  // --- Action Functions (Emit events to server) ---
  const createRoom = () => {
    const name = playerName.trim();
    if (!name) {
      alert("Please enter your name");
      return;
    }
    const id = `${name.substring(0, 3)}${Date.now() % 10000}`;
    setPlayerId(id);
    setPlayerName(name);
    console.log("Creating room for:", name, id);
    socketRef.current.emit('createRoom', { playerName: name, playerId: id });
  };

  const joinRoom = () => {
    const code = roomCode.trim().toUpperCase();
    const name = playerName.trim();
    if (!code || !name) {
      alert("Please enter room code and name");
      return;
    }
    const id = `${name.substring(0, 3)}${Date.now() % 10000}`;
    setPlayerId(id);
    setPlayerName(name);
    console.log("Joining room:", code, "as", name, id);
    socketRef.current.emit('joinRoom', { roomCode: code, playerName: name, playerId: id });
  };

  const chooseTeam = (team) => {
    if (!roomCode) return;
    console.log(`Player ${playerId} choosing team ${team}`);
    socketRef.current.emit('chooseTeam', { roomCode, team });
  };

  const startGame = () => {
    if (!roomCode) return;
    console.log(`Player ${playerId} requesting to start game in room ${roomCode}`);
    socketRef.current.emit('startGame', { roomCode });
  };

  const chooseDealerPlayer = (chosenPlayerId) => {
    if (!roomCode) return;
    console.log(`Player ${playerId} choosing dealer: ${chosenPlayerId}`);
    socketRef.current.emit('chooseDealerPlayer', { roomCode, playerId: chosenPlayerId });
  };

  const chooseHukum = (suit) => {
    if (!roomCode) return;
    console.log(`Player ${playerId} choosing Hukum: ${suit}`);
    socketRef.current.emit('chooseHukum', { roomCode, suit });
  };

  const playCard = (card) => {
    if (!roomCode) return;
    console.log(`Player ${playerId} playing card:`, card);
    socketRef.current.emit('playCard', { roomCode, card });
  };

  const reconnect = () => {
    if (roomCode) {
        console.log("Requesting game state update...");
        socketRef.current.emit('getGameState', { roomCode });
    }
  };

  // --- Reconnection Logic ---
  useEffect(() => {
    if (view === 'game') {
      reconnect(); // Initial sync
      const interval = setInterval(reconnect, 5000); // Reconnect every 5s to sync state
      return () => clearInterval(interval);
    }
    // Clear interval if view changes to 'lobby'
  }, [view, roomCode]); // Depend on view and roomCode

  // --- Render Logic ---
  // Initial lobby screen (create or join)
  // This is now handled by the conditional rendering inside GameTable when view is 'game'
  // but no roomCode is set, or gameState is null/undefined for the room.

  // If in game view, show GameTable which handles lobby/team selection internally
  if (view === 'game') {
    return (
      <GameTable
        gameState={gameState}
        playerId={playerId}
        playerName={playerName}
        chooseTeam={chooseTeam}
        startGame={startGame}
        chooseDealerPlayer={chooseDealerPlayer}
        chooseHukum={chooseHukum}
        playCard={playCard}
      />
    );
  }

  // Fallback or initial render if view is somehow 'lobby' but we expect to go to GameTable
  // This part is kept for robustness, though the flow should push to 'game' view quickly.
  return (
    <div className="lobby">
      <h1>🃏 Hukum Card Game</h1>
      <p>4-player trick-taking game with teams</p>
      <div className="section">
        <h2>Create Game</h2>
        <input
          type="text"
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <button onClick={createRoom}>Create Room</button>
      </div>
      <div className="section">
        <h2>Join Game</h2>
        <input
          type="text"
          placeholder="Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength="6"
        />
        <input
          type="text"
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <button onClick={joinRoom}>Join Room</button>
      </div>
    </div>
   );
}

export default App;