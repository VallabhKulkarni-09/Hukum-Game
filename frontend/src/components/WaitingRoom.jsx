import React, { useEffect, useState } from 'react';

export default function WaitingRoom({ gameState, playerName, onLeaveWaiting }) {
  console.log("DEBUG: WaitingRoom rendered with playerName:", playerName, "gameState:", gameState);
  const [countdown, setCountdown] = useState(null);
  const [waitingAnimation, setWaitingAnimation] = useState(0);

  useEffect(() => {
    // Animation effect for waiting state
    const interval = setInterval(() => {
      setWaitingAnimation(prev => (prev + 1) % 4);
    }, 800);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Set countdown if we have enough players
    if (gameState?.players?.length >= 3) {
      setCountdown(10);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    } else {
      setCountdown(null);
    }
  }, [gameState?.players?.length]);

  const getPlayerStatus = () => {
    if (!gameState) return "Connecting to game server...";
    const playerCount = gameState?.players?.length || 0;
    if (playerCount === 1) return "Waiting for players...";
    if (playerCount === 2) return "Building teams...";
    if (playerCount === 3) return "Almost ready!";
    if (playerCount === 4) return "Starting game...";
    return "Preparing game...";
  };

  const getDots = () => {
    return '.'.repeat(waitingAnimation + 1);
  };

  return (
    <div className="waiting-room">
      <div className="waiting-content">
        <div className="waiting-header">
          <h1>⚡ Quick Join</h1>
          <div className="room-code-display">
            <span className="room-code-label">Room:</span>
            <span className="room-code">{gameState?.roomCode || '----'}</span>
          </div>
        </div>

        <div className="waiting-status">
          <div className="status-animation">
            <div className="pulse-circle"></div>
            <div className="pulse-circle"></div>
            <div className="pulse-circle"></div>
          </div>
          
          <h2>{getPlayerStatus()}{getDots()}</h2>
          
          <div className="player-count">
            <div className="count-display">
              <span className="current-count">{gameState?.players?.length || 0}</span>
              <span className="separator">/</span>
              <span className="max-count">4</span>
            </div>
            <div className="count-label">Players</div>
          </div>

          {countdown !== null && (
            <div className="countdown-container">
              <div className="countdown-circle">
                <span className="countdown-number">{countdown}</span>
              </div>
              <div className="countdown-label">Game starting</div>
            </div>
          )}
        </div>

        <div className="players-in-waiting">
          <h3>Players in Room</h3>
          <div className="waiting-players-list">
            {gameState?.players?.map((player, index) => (
              <div key={player.id} className={`waiting-player ${index < 2 ? 'team-a' : 'team-b'}`}>
                <div className="player-avatar">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div className="player-info">
                  <span className="player-name">{player.name}</span>
                  <span className="player-status">
                    {index < 2 ? 'Team A' : 'Team B'}
                    {player.name === playerName && <span className="you-indicator"> (You)</span>}
                  </span>
                </div>
                <div className="player-ready">
                  <div className="ready-indicator"></div>
                </div>
              </div>
            ))}
            
            {/* Empty slots */}
            {[...Array(4 - (gameState?.players?.length || 0))].map((_, index) => (
              <div key={`empty-${index}`} className="waiting-player empty">
                <div className="player-avatar placeholder">
                  ?
                </div>
                <div className="player-info">
                  <span className="player-name">Waiting for player...</span>
                  <span className="player-status">Joining soon</span>
                </div>
                <div className="player-ready">
                  <div className="ready-indicator pending"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="waiting-actions">
          <button onClick={onLeaveWaiting} className="leave-btn">
            Leave Waiting Room
          </button>
        </div>

        <div className="waiting-tips">
          <h4>💡 Quick Tips</h4>
          <ul>
            <li>Teams are automatically assigned: first 2 players join Team A, next 2 join Team B</li>
            <li>The game will start automatically when all 4 players have joined</li>
            <li>You can leave at any time before the game starts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}