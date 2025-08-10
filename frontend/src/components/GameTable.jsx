// frontend/src/components/GameTable.jsx
import React, { useState, useEffect } from 'react';

export default function GameTable({
  gameState,
  playerId,
  playerName,
  chooseDealerPlayer,
  chooseHukum,
  playCard,
  chooseTeam,
  startGame
}) {
  // Local state to manage hand display if needed for incremental updates
  // const [displayedHand, setDisplayedHand] = useState([]);

  if (!gameState) {
    return <div className="game-table"><h2>Loading game...</h2></div>;
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
  const isTeamSelection = gameState.state === 'teamSelection';
  const isChoosingDealer = gameState.state === 'choosingDealer';
  const isHukumSelection = gameState.state === 'choosingHukum';
  const isPlaying = gameState.state === 'playing';
  const isGameOver = gameState.state === 'gameOver';

  // --- CORRECTED Frontend Validation Logic ---
  const isValidPlay = (card) => {
    if (!isMyTurn || !isPlaying || !gameState.trick) return false;
    if (gameState.trick.length === 0) return true; // First card, always valid

    const leadSuit = gameState.trick[0].card.suit;
    const hasLead = playerHand.some(c => c.suit === leadSuit);

    // If player has the lead suit, they must play it
    if (hasLead) {
        return card.suit === leadSuit;
    }

    // If player doesn't have the lead suit, any card is valid
    return true;
  };

  const handleCardClick = (card) => {
    if (!isMyTurn || !isPlaying) return;
    playCard(card);
  };


  // --- Team Selection View ---
  if (isTeamSelection) {
    const isRoomFull = gameState.players.length >= 4;
    const isCreator = gameState.players.length > 0 && gameState.players[0].id === playerId;
    const canStart = gameState.teams?.A?.length === 2 && gameState.teams?.B?.length === 2;

    return (
      <div className="game-table">
        <h1>🃏 Hukum Lobby</h1>
        <h2>Room Code: {gameState.roomCode}</h2>
        {isRoomFull ? (
          <p>Room is full. Waiting for game to start...</p>
        ) : (
          <p>Share this code with friends to join!</p>
        )}

        <div className="teams-layout">
          <div className="team-pick">
            <h3>Team A</h3>
            <ul>
              {gameState.teams?.A?.map(id => {
                const p = gameState.players.find(pl => pl.id === id);
                return <li key={id} className="player">{p ? p.name : 'Unknown'}</li>;
              })}
              {gameState.teams?.A?.length < 2 && (
                <button onClick={() => chooseTeam('A')}>
                  Join Team A
                </button>
              )}
            </ul>
          </div>
          <div className="team-pick">
            <h3>Team B</h3>
            <ul>
              {gameState.teams?.B?.map(id => {
                const p = gameState.players.find(pl => pl.id === id);
                return <li key={id} className="player">{p ? p.name : 'Unknown'}</li>;
              })}
              {gameState.teams?.B?.length < 2 && (
                <button onClick={() => chooseTeam('B')}>
                  Join Team B
                </button>
              )}
            </ul>
          </div>
        </div>

        {isCreator && canStart && (
          <button className="start-button" onClick={startGame}>
            Start Game
          </button>
        )}

        <div className="players-list">
          <h3>Players in Room:</h3>
          <ul>
            {gameState.players.map(p => (
              <li key={p.id}>{p.name} {p.id === playerId ? '(You)' : ''} {p.team ? `(Team ${p.team})` : ''}</li>
            ))}
          </ul>
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
          <p>You can see your first 4 cards.</p>
          <div className="suit-buttons">
            {['Clubs', 'Diamonds', 'Spades', 'Hearts'].map(suit => (
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
                <p>You can see your first 4 cards.</p>
                 {/* Optionally display the first 4 cards here for others */}
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
    }
  }

  // --- Playing View ---
  if (isPlaying) {
    return (
      <div className="game-table">
        <h1>🃏 Hukum</h1>
        <h2>Room Code: {gameState.roomCode}</h2>

        {/* Game Info */}
        <div className="game-info">
          <p><strong>You:</strong> {playerName} (Team {playerTeam})</p>
          <p><strong>Dealer Team:</strong> {gameState.dealerTeam || 'Not chosen'}</p>
          {gameState.dealer && (
            <p><strong>Dealer:</strong> {gameState.players?.find(p => p.id === gameState.dealer)?.name}</p>
          )}
          {gameState.hukum && <p><strong>Hukum (Trump):</strong> {gameState.hukum}</p>}
          <p><strong>Scores:</strong> Team A: {gameState.scores?.A} | Team B: {gameState.scores?.B}</p>
          {gameState.currentTurn && (
            <p><strong>Current Turn:</strong> {gameState.players?.find(p => p.id === gameState.currentTurn)?.name}</p>
          )}
          {gameState.round !== undefined && <p><strong>Round:</strong> {gameState.round + 1} / 8</p>}
        </div>

        {/* Trick Area */}
        <div className="trick-area">
          <h3>Current Trick</h3>
          <div className="cards-played">
            {gameState.trick?.map((t, index) => {
              const p = gameState.players?.find(pl => pl.id === t.playerId);
              return (
                <div key={index} className="played-card">
                  <span>{t.card.value} of {t.card.suit}</span>
                  <small>({p?.name})</small>
                </div>
              );
            })}
          </div>
        </div>

        {/* Player's Hand */}
        <div className="hand">
          <h3>Your Hand</h3>
          <div className="hand-cards">
            {sortedHand.map((card, index) => (
              <button
                key={`${card.suit}-${card.value}-${index}`}
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

  // --- Game Over View ---
  if (isGameOver) {
    return (
      <div className="game-table">
        <h1>🃏 Hukum</h1>
        <h2>Room Code: {gameState.roomCode}</h2>
        <div className="winner">
          <h2>Game Over!</h2>
          <p>Winner: <strong>{gameState.winner}</strong></p>
          <p>Final Scores: Team A: {gameState.scores?.A} | Team B: {gameState.scores?.B}</p>
          <button onClick={() => window.location.reload()}>Play Again (Reload)</button>
        </div>
      </div>
    );
  }

  // --- Default/Fallback View ---
  return (
    <div className="game-table">
      <h1>🃏 Hukum</h1>
      <h2>Room Code: {gameState.roomCode}</h2>
      <p>Waiting for game state update...</p>
    </div>
  );
}