// frontend/src/components/GameTable.jsx
import React from 'react';

export default function GameTable({
  gameState,
  playerId,
  playerName,
  chooseDealerPlayer, // Prop function from App.jsx
  chooseHukum,        // Prop function from App.jsx
  playCard,           // Prop function from App.jsx
  chooseTeam,         // <-- Add this prop (from App.jsx)
  startGame           // <-- Add this prop (from App.jsx)
}) {
  if (!gameState) {
    return (
      <div className="game-table loading">
        <h2>🎴 Loading game...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  // Use gameState.playerHand which is sent specifically to this player by the backend
  const playerHand = gameState.playerHand || [];
  const sortedHand = [...playerHand].sort((a, b) => {
    const suitOrder = { Clubs: 0, Diamonds: 1, Spades: 2, Hearts: 3 };
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
    const valueOrder = ['7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
    return valueOrder.indexOf(a.value) - valueOrder.indexOf(b.value);
  });

  const player = gameState.players?.find(p => p.id === playerId);
  const playerTeam = player?.team;
  const isMyTurn = gameState.currentTurn === playerId;

  const handleCardClick = (card) => {
    if (!isMyTurn || !isPlaying) return;
    playCard(card); // Use the prop function
  };

  const isValidPlay = (card) => {
    if (!isMyTurn || !isPlaying || !gameState.trick) return false;
    if (gameState.trick.length === 0) return true;

    const leadSuit = gameState.trick[0].card.suit;
    const hasLead = playerHand.some(c => c.suit === leadSuit);
    const hasTrump = playerHand.some(c => c.suit === gameState.hukum);

    if (hasLead && card.suit !== leadSuit) return false;
    if (!hasLead && card.suit !== gameState.hukum && hasTrump) return false;
    return true;
  };

  const handleCardClick = (card) => {
    if (!isMyTurn || !isPlaying) return;
    playCard(card);
  };


// --- Team Selection View ---
if (isTeamSelection) {
  const isRoomFull = gameState.players.length >= 4;
  const currentPlayer = gameState.players.find(p => p.id === playerId);
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

      <div className="teams-layout">
        <div className="team-pick">
          <h3>Team A</h3>
          <ul>
            {gameState.teams?.A?.map(id => {
              const p = gameState.players.find(pl => pl.id === id);
              return <li key={id} className="player">{p ? p.name : 'Unknown'}</li>;
            })}
          </ul>
          {/* Use the `chooseTeam` prop function, not `socket` */}
          {gameState.teams?.A?.length < 2 && !currentPlayer?.team && (
            <button onClick={() => chooseTeam('A')}>
              Join Team A
            </button>
          )}
        </div>

        <div className="team-pick">
          <h3>Team B</h3>
          <ul>
            {gameState.teams?.B?.map(id => {
              const p = gameState.players.find(pl => pl.id === id);
              return <li key={id} className="player">{p ? p.name : 'Unknown'}</li>;
            })}
          </ul>
          {/* Use the `chooseTeam` prop function, not `socket` */}
          {gameState.teams?.B?.length < 2 && !currentPlayer?.team && (
            <button onClick={() => chooseTeam('B')}>
              Join Team B
            </button>
          )}
        </div>
      </div>

      {/* Use the `startGame` prop function, not `socket` */}
      {isCreator && canStart && (
        <button className="start-button" onClick={startGame}>
          Start Game
        </button>
      )}

      {!canStart && (
        <p className="waiting-message">
          Waiting for all players to join teams...
        </p>
      )}

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

  // --- Choosing Dealer View ---
  if (isChoosingDealer && gameState.dealerTeam === playerTeam) {
     return (
      <div className="game-table prompt">
        <h1>🃏 Hukum</h1>
        <h2>Room Code: {gameState.roomCode}</h2>
        <h3>You are on the Dealer Team ({playerTeam})!</h3>
        <p>Choose the dealer player:</p>
        <div className="players-list">
          {gameState.players
            .filter(p => p.team === playerTeam)
            .map(p => (
              // Use the prop function `socket` is not defined here
              <button key={p.id} onClick={() => chooseDealerPlayer(p.id)}>
                {p.name}
              </button>
            ))}
        </div>
      </div>
    );
  }

  // --- Hukum Selection View ---
  if (isHukumSelection) {
    const dealerIndex = gameState.players.findIndex(p => p.id === gameState.dealer);
    const expectedChooserId = gameState.players[(dealerIndex + 1) % 4]?.id;
    const isChooser = playerId === expectedChooserId;

    if (isChooser) {
      return (
        <div className="game-table prompt">
          <h1>🃏 Hukum</h1>
          <h2>Room Code: {gameState.roomCode}</h2>
          <h3>Choose the Hukum (Trump) Suit:</h3>
          <div className="suit-buttons">
            {['Clubs', 'Diamonds', 'Spades', 'Hearts'].map(suit => (
              // Use the prop function `socket` is not defined here
              <button key={suit} onClick={() => chooseHukum(suit)}>
                {suit}
              </button>
            ))}
          </div>
          {/* Optionally display the first 4 cards here for the chooser */}
          <div className="hand">
            <h4>Your First 4 Cards:</h4>
            <div className="hand-cards">
              {sortedHand.map((card, index) => (
                <div key={`${card.suit}-${card.value}-${index}`} className="card">
                  <span className="card-value">{card.value}</span>
                  <span className="card-suit">of {card.suit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    } else {
        return (
            <div className="game-table">
                <h1>🃏 Hukum</h1>
                <h2>Room Code: {gameState.roomCode}</h2>
                <p>Waiting for {gameState.players.find(p => p.id === expectedChooserId)?.name} to choose Hukum...</p>
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

        {/* Player's Hand */}
        <div className="hand">
          <h3>Your Hand</h3>
          <div className="hand-cards">
            {playerHand.map((card, index) => (
              <button
                key={`${card.suit}-${card.value}-${index}`} // Better key
                className={`card ${(!isMyTurn || !isValidPlay(card)) ? 'invalid' : ''}`}
                onClick={() => handleCardClick(card)}
                disabled={!isMyTurn || !isValidPlay(card)}
              >
                <span className="card-value">{card.value}</span>
                <span className="card-suit">of {card.suit}</span>
              </button>
            ))}
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
