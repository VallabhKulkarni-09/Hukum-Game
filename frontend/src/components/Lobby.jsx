import React, { useEffect, useState } from 'react';

export default function Lobby({
  createRoom,
  joinRoom,
  roomCode,
  setRoomCode,
  playerName,
  setPlayerName,
  isPrivateRoom,
  setIsPrivateRoom,
  publicRooms,
  getPublicRooms,
  quickJoin
}) {
  const [createPlayerName, setCreatePlayerName] = useState('');
  const [joinPlayerName, setJoinPlayerName] = useState('');
  const [quickJoinPlayerName, setQuickJoinPlayerName] = useState('');
  
  // Sync player name across all input fields when the parent's playerName changes
  useEffect(() => {
    if (playerName) {
      setCreatePlayerName(playerName);
      setJoinPlayerName(playerName);
      setQuickJoinPlayerName(playerName);
    }
  }, [playerName]);
  
  // Update parent's playerName when any of the input fields change
  useEffect(() => {
    if (createPlayerName) {
      setPlayerName(createPlayerName);
    }
  }, [createPlayerName, setPlayerName]);
  const handleCreateRoom = () => {
    if (!createPlayerName.trim()) {
      alert("Please enter your name");
      return;
    }
    setPlayerName(createPlayerName);
    createRoom();
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      alert("Please enter room code");
      return;
    }
    
    // If name is not provided, generate a random one
    let name = joinPlayerName.trim();
    if (!name) {
      const adjectives = ['Happy', 'Lucky', 'Clever', 'Swift', 'Brave', 'Silent', 'Wise', 'Kind'];
      const nouns = ['Player', 'Gamer', 'Card', 'Trick', 'Hukum', 'Dealer', 'Winner', 'Champion'];
      const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      name = `${randomAdjective}${randomNoun}${Math.floor(Math.random() * 1000)}`;
      setJoinPlayerName(name);
    }
    
    setPlayerName(name);
    joinRoom();
  };

  useEffect(() => {
    getPublicRooms();
    const interval = setInterval(getPublicRooms, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [getPublicRooms]);

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  const handleQuickJoin = () => {
    console.log("DEBUG: handleQuickJoin called with quickJoinPlayerName:", quickJoinPlayerName);
    if (!quickJoinPlayerName.trim()) {
      alert("Please enter your name");
      return;
    }
    console.log("DEBUG: Setting playerName to:", quickJoinPlayerName);
    setPlayerName(quickJoinPlayerName);
    console.log("DEBUG: Calling quickJoin function with name:", quickJoinPlayerName);
    quickJoin(quickJoinPlayerName);
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
                value={createPlayerName}
                onChange={(e) => setCreatePlayerName(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleCreateRoom)}
                maxLength="20"
              />
              <div className="room-privacy">
                <label className="privacy-toggle">
                  <input
                    type="checkbox"
                    checked={isPrivateRoom}
                    onChange={(e) => setIsPrivateRoom(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                  <span className="privacy-label">
                    {isPrivateRoom ? '🔒 Private Room' : '🌐 Public Room'}
                  </span>
                </label>
              </div>
              <button
                onClick={handleCreateRoom}
                className="create-btn"
                disabled={!createPlayerName.trim()}
              >
                Create Room
              </button>
            </div>
          </div>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="section quick-join-section">
            <h2>⚡ Quick Join</h2>
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter your name"
                value={quickJoinPlayerName}
                onChange={(e) => setQuickJoinPlayerName(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleQuickJoin)}
                maxLength="20"
              />
              <button
                onClick={handleQuickJoin}
                className="quick-join-btn"
                disabled={!quickJoinPlayerName.trim()}
              >
                Quick Join
              </button>
            </div>
            <p className="quick-join-description">
              Automatically join a public room or create a new one
            </p>
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
              placeholder="Enter your name (optional)"
              value={joinPlayerName}
              onChange={(e) => setJoinPlayerName(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, handleJoinRoom)}
              maxLength="20"
            />
            <button
              onClick={handleJoinRoom}
              className="join-btn"
              disabled={!roomCode.trim()}
            >
              Join Room
            </button>
          </div>
        </div>

        {publicRooms.length > 0 && (
          <div className="public-rooms-section">
            <h2>🌐 Public Rooms Available</h2>
            <div className="public-rooms-list">
              {publicRooms.map((room) => (
                <div key={room.roomCode} className="public-room-item">
                  <div className="room-info">
                    <span className="room-code">{room.roomCode}</span>
                    <span className="player-count">{room.playerCount}/4 players</span>
                  </div>
                  <button
                    onClick={() => {
                      setRoomCode(room.roomCode);
                      setJoinPlayerName(joinPlayerName || quickJoinPlayerName || createPlayerName);
                      if (joinPlayerName.trim() || quickJoinPlayerName.trim() || createPlayerName.trim()) {
                        joinRoom();
                      }
                    }}
                    className="join-public-room-btn"
                    disabled={!(joinPlayerName.trim() || quickJoinPlayerName.trim() || createPlayerName.trim())}
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
