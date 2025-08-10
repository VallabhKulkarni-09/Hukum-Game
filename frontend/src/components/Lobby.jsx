import React from 'react';

export default function Lobby({
  createRoom,
  joinRoom,
  roomCode,
  setRoomCode,
  playerName,
  setPlayerName
}) {
  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      alert("Please enter your name");
      return;
    }
    createRoom();
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim() || !playerName.trim()) {
      alert("Please enter both room code and your name");
      return;
    }
    joinRoom();
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-content">
        <div className="header">
          <h1>🃏 Hukum Card Game</h1>
          <p className="subtitle">4-player trick-taking game with teams</p>
          <div className="game-rules">
            <h3>How to Play:</h3>
            <ul>
              <li>Form two teams of 2 players each</li>
              <li>One team deals the cards, the other chooses Trump (Hukum)</li>
              <li>Follow suit if you can; otherwise, play any card</li>
              <li>Dealer team needs 5 tricks to win, other team needs 4</li>
            </ul>
          </div>
        </div>

        <div className="lobby-sections">
          <div className="section create-section">
            <h2>🎮 Create New Game</h2>
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleCreateRoom)}
                maxLength="20"
              />
              <button
                onClick={handleCreateRoom}
                className="create-btn"
                disabled={!playerName.trim()}
              >
                Create Room
              </button>
            </div>
          </div>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="section join-section">
            <h2>🚪 Join Existing Game</h2>
            <div className="input-group">
              <input
                type="text"
                placeholder="Room Code (6 letters)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => handleKeyPress(e, handleJoinRoom)}
                maxLength="6"
              />
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleJoinRoom)}
                maxLength="20"
              />
              <button
                onClick={handleJoinRoom}
                className="join-btn"
                disabled={!roomCode.trim() || !playerName.trim()}
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
