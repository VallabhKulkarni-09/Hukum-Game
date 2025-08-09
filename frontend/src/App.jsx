// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';

// Connect to the backend server (proxied via Vite dev server)
const socket = io(); // Uses proxy defined in vite.config.js

function App() {
  const [view, setView] = useState('lobby'); // 'lobby' or 'game'
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [gameState, setGameState] = useState(null);
  const socketRef = useRef(socket);

  useEffect(() => {
    socketRef.current.on('roomCreated', ({ roomCode }) => {
      setRoomCode(roomCode);
      setView('game'); // Go directly to game view (which shows lobby/team selection)
    });

    socketRef.current.on('roomJoined', ({ roomCode }) => {
      setRoomCode(roomCode);
      setView('game'); // Go directly to game view (which shows lobby/team selection)
    });

    socketRef.current.on('playerJoined', (player) => {
      console.log(`${player.name} joined`);
    });

    socketRef.current.on('gameState', (state) => {
      setGameState(state);
    });

    socketRef.current.on('cardPlayed', ({ playerId, card }) => {
      console.log(`Player ${playerId} played ${card.value} of ${card.suit}`);
    });

    socketRef.current.on('error', (msg) => {
      alert(msg);
    });

    socketRef.current.on('playerLeft', ({ id }) => {
      // Handle player leaving, maybe show a message or update UI
      console.log(`Player ${id} left the room.`);
    });

    return () => {
      socketRef.current.off('roomCreated');
      socketRef.current.off('roomJoined');
      socketRef.current.off('playerJoined');
      socketRef.current.off('gameState');
      socketRef.current.off('cardPlayed');
      socketRef.current.off('error');
      socketRef.current.off('playerLeft');
    };
  }, []);

  const createRoom = () => {
    if (!playerName.trim()) return alert("Please enter your name");
    const id = `${playerName.substring(0, 3)}${Date.now() % 1000}`;
    setPlayerId(id);
    socketRef.current.emit('createRoom', { playerName: playerName.trim(), playerId: id });
  };

  const joinRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (!code || !playerName.trim()) return alert("Please enter room code and name");
    const id = `${playerName.trim().slice(0, 3)}${Date.now() % 1000}`;
    setPlayerId(id);
    socketRef.current.emit('joinRoom', { roomCode: code, playerName: playerName.trim(), playerId: id });
  };

  const chooseTeam = (team) => {
    socketRef.current.emit('chooseTeam', { roomCode, team });
  };

  const startGame = () => {
    socketRef.current.emit('startGame', { roomCode });
  };

  const chooseDealerPlayer = (playerId) => {
    socketRef.current.emit('chooseDealerPlayer', { roomCode, playerId });
  };

  const chooseHukum = (suit) => {
    socketRef.current.emit('chooseHukum', { roomCode, suit });
  };

  const playCard = (card) => {
    socketRef.current.emit('playCard', { roomCode, card });
  };

  const reconnect = () => {
    if (roomCode) {
        socketRef.current.emit('getGameState', { roomCode });
    }
  };

  useEffect(() => {
    if (view === 'game') {
      reconnect();
      const interval = setInterval(reconnect, 5000); // Reconnect every 5s to sync state
      return () => clearInterval(interval);
    }
  }, [view, roomCode]);

  // If in game view, show GameTable which handles lobby/team selection internally
  if (view === 'game') {
    return (
      <GameTable
        gameState={gameState}
        playerId={playerId}
        playerName={playerName}
        chooseDealerPlayer={chooseDealerPlayer}
        chooseHukum={chooseHukum}
        playCard={playCard}
      />
    );
  }

  // Initial lobby screen (create or join)
  return (
    <Lobby
      createRoom={createRoom}
      joinRoom={joinRoom}
      roomCode={roomCode}
      setRoomCode={setRoomCode}
      playerName={playerName}
      setPlayerName={setPlayerName}
    />
  );
}

export default App;