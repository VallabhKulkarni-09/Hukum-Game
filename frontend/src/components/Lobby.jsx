// src/components/Lobby.jsx
import React from 'react';

export default function Lobby({
  createRoom,
  joinRoom,
  roomCode,
  setRoomCode,
  playerName,
  setPlayerName
}) {
  return (
    <div className="lobby">
      <h1>🃏 Hukum Card Game</h1>
      <p>4-player trick-taking game with teams</p>
      
      <div className="section">
        <h2>Create Game</h2>
        <input
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <button onClick={createRoom}>Create Room</button>
      </div>
      
      <div className="section">
        <h2>Join Game</h2>
        <input
          placeholder="Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength="6"
        />
        <input
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <button onClick={joinRoom}>Join Room</button>
      </div>
    </div>
  );
}