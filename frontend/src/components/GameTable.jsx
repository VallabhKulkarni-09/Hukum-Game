import React, { useEffect, useState } from 'react';

export default function GameTable({
  gameState,
  playerId,
  playerName,
  playerHand,
  chooseTeam,
  startGame,
  chooseDealerPlayer,
  chooseHukum,
  playCard
}) {
  const [trickVisible, setTrickVisible] = useState(true);
  const [lastPlayedCard, setLastPlayedCard] = useState(null);

  useEffect(() => {
    if (gameState?.trick?.length === 0) {
      setTrickVisible(true);
      setLastPlayedCard(null);
    } else if (gameState?.trick?.length > 0) {
      // Check if a new card was added to the trick
      const currentTrick = gameState.trick;
      if (currentTrick.length > 0) {
        const newCard = currentTrick[currentTrick.length - 1];
        if (newCard.playerId === playerId) {
          setLastPlayedCard(newCard);
          // Reset the last played card after animation completes
          setTimeout(() => setLastPlayedCard(null), 1000);
        }
      }
    }
  }, [gameState?.trick, playerId]);

  if (!gameState) {
    return (
      <div className="game-table loading">
        <h2>🎴 Loading game...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  const player = gameState.players?.find(p => p.id === playerId);
  const playerTeam = player?.team;
  const isMyTurn = gameState.currentTurn === playerId;

  const getPlayerName = (pId) => gameState.players?.find(p => p.id === pId)?.name || 'Unknown';

  const isValidPlay = (card) => {
    if (!isMyTurn || gameState.state !== 'playing' || !gameState.trick) return false;
    if (gameState.trick.length === 0) return true;
    const leadSuit = gameState.trick[0].card.suit;
    const hasLead = playerHand.some(c => c.suit === leadSuit);
    if (hasLead && card.suit !== leadSuit) return false;
    return true;
  };

  const getCardImage = (card) => {
    const suit = card.suit.toLowerCase();
    const value = card.value;
    return `/cards/${suit}/${value}.webp`;
  };

  const getSuitEmoji = (suit) => {
    switch (suit) {
      case 'Hearts': return '♥️';
      case 'Diamonds': return '♦️';
      case 'Clubs': return '♣️';
      case 'Spades': return '♠️';
      default: return '';
    }
  };

  if (gameState.state === 'teamSelection') {
    const isCreator = gameState.players.length > 0 && gameState.players[0].id === playerId;
    const canStart = gameState.teams?.A?.length === 2 && gameState.teams?.B?.length === 2;

    return (
      <div className="game-table">
        <div className="game-header">
          <h1>🃏 Hukum Game Lobby</h1>
          <div className="room-info">
            <h2>Room Code: <span className="room-code">{gameState.roomCode}</span></h2>
            <p>Share this code with friends to join!</p>
          </div>
        </div>

        <div className="teams-section">
          <div className="teams-container">
            <div className="team team-a">
              <h3>🔴 Team A</h3>
              <div className="team-players">
                {gameState.teams?.A?.map(id => {
                  const p = gameState.players.find(pl => pl.id === id);
                  return (
                    <div key={id} className="player-card">
                      <span className="player-name">{p ? p.name : 'Unknown'}</span>
                      {id === playerId && <span className="you-badge">(You)</span>}
                    </div>
                  );
                })}
                {gameState.teams?.A?.length < 2 && (
                  <button
                    className="join-team-btn"
                    onClick={() => chooseTeam('A')}
                    disabled={playerTeam === 'A'}
                  >
                    {playerTeam === 'A' ? '✓ Joined' : 'Join Team A'}
                  </button>
                )}
              </div>
            </div>

            <div className="vs-divider">
              <span>VS</span>
            </div>

            <div className="team team-b">
              <h3>🔵 Team B</h3>
              <div className="team-players">
                {gameState.teams?.B?.map(id => {
                  const p = gameState.players.find(pl => pl.id === id);
                  return (
                    <div key={id} className="player-card">
                      <span className="player-name">{p ? p.name : 'Unknown'}</span>
                      {id === playerId && <span className="you-badge">(You)</span>}
                    </div>
                  );
                })}
                {gameState.teams?.B?.length < 2 && (
                  <button
                    className="join-team-btn"
                    onClick={() => chooseTeam('B')}
                    disabled={playerTeam === 'B'}
                  >
                    {playerTeam === 'B' ? '✓ Joined' : 'Join Team B'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {isCreator && canStart && (
            <button className="start-game-btn" onClick={startGame}>
              🚀 Start Game
            </button>
          )}

          {!canStart && (
            <p className="waiting-message">
              Waiting for all players to join teams...
            </p>
          )}
        </div>

        <div className="players-summary">
          <h3>Players in Room ({gameState.players.length}/4):</h3>
          <div className="players-list">
            {gameState.players.map(p => (
              <div key={p.id} className="player-summary">
                <span className="player-name">{p.name}</span>
                {p.id === playerId && <span className="you-badge">(You)</span>}
                {p.team && <span className="team-badge">Team {p.team}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (gameState.state === 'choosingDealer') {
    if (gameState.dealerTeam === playerTeam) {
      return (
        <div className="game-table dealer-selection">
          <div className="game-header">
            <h1>🃏 Hukum Game</h1>
            <h2>Room Code: {gameState.roomCode}</h2>
          </div>

          <div className="dealer-prompt">
            <h3>🎯 Your team ({playerTeam}) deals first!</h3>
            <p>Choose who will be the dealer:</p>
            <div className="dealer-options">
              {gameState.players
                .filter(p => p.team === playerTeam)
                .map(p => (
                  <button
                    key={p.id}
                    className="dealer-btn"
                    onClick={() => chooseDealerPlayer(p.id)}
                  >
                    <span className="dealer-name">{p.name}</span>
                    {p.id === playerId && <span className="you-indicator">(You)</span>}
                  </button>
                ))}
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="game-table waiting">
          <div className="game-header">
            <h1>🃏 Hukum Game</h1>
            <h2>Room Code: {gameState.roomCode}</h2>
          </div>
          <div className="waiting-message">
            <h3>⏳ Waiting for Team {gameState.dealerTeam} to choose their dealer...</h3>
            <div className="spinner"></div>
          </div>
        </div>
      );
    }
  }

  if (gameState.state === 'choosingHukum') {
    if (playerId === gameState.hukumChooser) {
      return (
        <div className="game-table hukum-selection">
          <div className="game-header">
            <h1>🃏 Hukum Game</h1>
            <h2>Room Code: {gameState.roomCode}</h2>
          </div>

          <div className="hukum-prompt">
            <h3>🎲 Choose the Trump Suit (Hukum):</h3>
            <p>Your choice will determine which suit beats all others!</p>
            <div className="suit-selection">
              {['Clubs', 'Diamonds', 'Spades', 'Hearts'].map(suit => (
                <button
                  key={suit}
                  className="suit-btn"
                  onClick={() => chooseHukum(suit)}
                >
                  <span className="suit-emoji">{getSuitEmoji(suit)}</span>
                  <span className="suit-name">{suit}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="your-hand-preview">
            <h4>Your Hand:</h4>
            <div className="hand-preview">
              {playerHand.map((card, index) => (
                <div key={index} className="card-preview">
                  <img
                    src={getCardImage(card)}
                    alt={`${card.value} of ${card.suit}`}
                    style={{ width: '50px', height: '70px' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="game-table waiting">
          <div className="game-header">
            <h1>🃏 Hukum Game</h1>
            <h2>Room Code: {gameState.roomCode}</h2>
          </div>
          <div className="waiting-message">
            <h3>⏳ Waiting for {getPlayerName(gameState.hukumChooser)} to choose Hukum...</h3>
            <div className="spinner"></div>
          </div>
        </div>
      );
    }
  }

  if (gameState.state === 'playing') {
    return (
      <div className="game-table playing">
        <div className="game-header">
          <h1>🃏 Hukum Game</h1>
          <div className="game-status">
            <span className="room-code">Room: {gameState.roomCode}</span>
            <span className="round-info">Round {gameState.round + 1}/8</span>
          </div>
        </div>

        <div className="game-info-bar">
          <div className="info-section">
            <span className="label">Trump:</span>
            <span className="trump-suit">
              {getSuitEmoji(gameState.hukum)} {gameState.hukum}
            </span>
          </div>
          <div className="info-section">
            <span className="label">Dealer Team:</span>
            <span className="dealer-team">Team {gameState.dealerTeam}</span>
          </div>
          <div className="info-section scores">
            <span className="label">Tricks Won:</span>
            <span className="score">A: {gameState.tricksWon?.A || 0}</span>
            <span className="score">B: {gameState.tricksWon?.B || 0}</span>
          </div>
        </div>

        <div className="current-turn">
          {isMyTurn ? (
            <div className="your-turn">
              <h3>🎯 Your Turn!</h3>
              <p>Choose a card to play</p>
            </div>
          ) : (
            <div className="waiting-turn">
              <h3>⏳ {getPlayerName(gameState.currentTurn)}'s Turn</h3>
            </div>
          )}
        </div>

        <div className="game-table-surface">
          <div className="table-decoration"></div>
          
          <div className={`trick-area ${trickVisible ? '' : 'fade-out'}`}>
            <h3>Current Trick</h3>
            <div className="trick-cards">
              {gameState.trick?.length > 0 ? (
                gameState.trick.map((t, index) => (
                  <div
                    key={index}
                    className={`played-card ${lastPlayedCard && t.card.value === lastPlayedCard.card.value && t.card.suit === lastPlayedCard.card.suit ? 'last-played' : ''}`}
                  >
                    <div className="card-display">
                      <img
                        src={getCardImage(t.card)}
                        alt={`${t.card.value} of ${t.card.suit}`}
                      />
                    </div>
                    <span className="player-name">{getPlayerName(t.playerId)}</span>
                  </div>
                ))
              ) : (
                <div className="empty-trick">
                  <p>No cards played yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="player-hand">
            <h3>Your Hand ({playerHand.length} cards)</h3>
            <div className="hand-cards">
              {playerHand.map((card, index) => {
                const canPlay = isValidPlay(card);
                const isHukum = card.suit === gameState.hukum;
                const isLeadingSuit = gameState.trick?.length > 0 && card.suit === gameState.trick[0].card.suit;
                
                return (
                  <button
                    key={`${card.suit}-${card.value}-${index}`}
                    className={`card ${!canPlay ? 'invalid' : ''} ${!isMyTurn ? 'disabled' : ''} ${isHukum ? 'hukum-card' : ''} ${isLeadingSuit ? 'leading-suit' : ''}`}
                    onClick={() => canPlay && isMyTurn && playCard(card)}
                    disabled={!isMyTurn || !canPlay}
                    title={!canPlay ? 'You must follow the leading suit if you have it' : ''}
                  >
                    <div className="card-content">
                      <img
                        src={getCardImage(card)}
                        alt={`${card.value} of ${card.suit}`}
                      />
                      {isHukum && <div className="hukum-indicator">H</div>}
                    </div>
                  </button>
                );
              })}
            </div>

            {gameState.trick?.length === 0 && isMyTurn && (
              <div className="play-hint">
                <p>💡 You're leading this trick - play any card!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gameState.state === 'gameOver') {
    const isWinner = gameState.winner?.includes(playerTeam);

    return (
      <div className="game-table game-over">
        <div className="game-header">
          <h1>🃏 Hukum Game</h1>
          <h2>Room Code: {gameState.roomCode}</h2>
        </div>

        <div className={`game-result ${isWinner ? 'winner' : 'loser'}`}>
          <h2>🏁 Game Over!</h2>
          <div className="winner-announcement">
            <h3>{gameState.winner} Wins! 🎉</h3>
            {isWinner && <p>Congratulations! 🎊</p>}
          </div>

          <div className="final-scores">
            <h4>Final Scores:</h4>
            <div className="score-summary">
              <div className="team-score">
                <span className="team-name">Team A:</span>
                <span className="score">{gameState.tricksWon?.A || 0} tricks</span>
              </div>
              <div className="team-score">
                <span className="team-name">Team B:</span>
                <span className="score">{gameState.tricksWon?.B || 0} tricks</span>
              </div>
            </div>
          </div>

          <button
            className="play-again-btn"
            onClick={() => window.location.reload()}
          >
            🔄 Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-table loading">
      <h1>🃏 Hukum Game</h1>
      <h2>Room Code: {gameState.roomCode}</h2>
      <p>Loading game state...</p>
      <div className="spinner"></div>
    </div>
  );
}
