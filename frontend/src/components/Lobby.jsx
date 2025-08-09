export default function Lobby({
  createRoom,
  joinRoom,
  roomCode,
  setRoomCode,
  playerName,
  setPlayerName,
  gameState,
  playerId,
  chooseTeam,
  startGame
}) {
  if (roomCode && gameState?.state === 'teamSelection') {
    const myPlayer = gameState.players?.find(p => p.id === playerId);
    const myTeam = myPlayer?.team;

    return (
      <div className="lobby">
        <h2>🎮 Room Code: <strong>{roomCode}</strong></h2>
        <p>Waiting for players... ({gameState.players?.length || 0}/4)</p>
        <div className="teams-layout">
          <div className="team-pick">
            <h3>Team A</h3>
            {gameState.teams?.A?.map(pid => {
              const p = gameState.players.find(pl => pl.id === pid);
              return <div key={pid} className="player">{p.name}</div>;
            })}
            <button
              disabled={myTeam === 'A'}
              onClick={() => chooseTeam('A')}
            >
              Join Team A
            </button>
          </div>
          <div className="team-pick">
            <h3>Team B</h3>
            {gameState.teams?.B?.map(pid => {
              const p = gameState.players.find(pl => pl.id === pid);
              return <div key={pid} className="player">{p.name}</div>;
            })}
            <button
              disabled={myTeam === 'B'}
              onClick={() => chooseTeam('B')}
            >
              Join Team B
            </button>
          </div>
        </div>
        {gameState.players.length === 4 && gameState.teams.A.length === 2 && (
          <button className="start-button" onClick={startGame}>
            Start Game
          </button>
        )}
      </div>
    );
  }

  // Initial lobby screen (create or join)
  return (
    <div className="lobby">
      <h1>🃏 Hukum Card Game</h1>
      <p>4-player trick-taking game with teams</p>
      <div className="section">
        <h2>Create Game</h2>
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