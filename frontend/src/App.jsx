import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import './styles.css';

const socket = io();

function App() {
  const [view, setView] = useState('lobby');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [gameState, setGameState] = useState(null);
  const [playerHand, setPlayerHand] = useState([]);
  const socketRef = useRef(socket);

  
  useEffect(() => {
    const handleRoomCreated = ({ roomCode }) => {
      setRoomCode(roomCode);
      setView('game');
    };

    const handleRoomJoined = ({ roomCode }) => {
      setRoomCode(roomCode);
      setView('game');
    };

    const handleGameState = (state) => {
      setGameState(state);
      if (state.playerHand) {
        setPlayerHand(state.playerHand);
      }
    };

    const handleDealCards = ({ hand }) => {
      setPlayerHand(hand);
    };

    const handleHandUpdated = ({ hand }) => {
      setPlayerHand(hand);
    };

    const handleCardPlayed = ({ playerId, card, playerName }) => {
      console.log(`${playerName} played ${card.value} of ${card.suit}`);
    };

    const handleTrickComplete = ({ winnerName, winnerTeam, tricksWon }) => {
      console.log(`Trick won by ${winnerName} (Team ${winnerTeam})`);
    };

    const handleTrickCleared = () => {
      // Optional: Additional handling if needed
    };

    const handleHukumChosen = ({ hukum, chooser }) => {
      console.log(`${chooser} chose ${hukum} as Hukum`);
    };

    const handleError = (msg) => {
      alert(`Error: ${msg}`);
    };

    socketRef.current.on('roomCreated', handleRoomCreated);
    socketRef.current.on('roomJoined', handleRoomJoined);
    socketRef.current.on('gameState', handleGameState);
    socketRef.current.on('dealCards', handleDealCards);
    socketRef.current.on('handUpdated', handleHandUpdated);
    socketRef.current.on('cardPlayed', handleCardPlayed);
    socketRef.current.on('trickComplete', handleTrickComplete);
    socketRef.current.on('trickCleared', handleTrickCleared);
    socketRef.current.on('hukumChosen', handleHukumChosen);
    socketRef.current.on('error', handleError);

    return () => {
      socketRef.current.off('roomCreated', handleRoomCreated);
      socketRef.current.off('roomJoined', handleRoomJoined);
      socketRef.current.off('gameState', handleGameState);
      socketRef.current.off('dealCards', handleDealCards);
      socketRef.current.off('handUpdated', handleHandUpdated);
      socketRef.current.off('cardPlayed', handleCardPlayed);
      socketRef.current.off('trickComplete', handleTrickComplete);
      socketRef.current.off('trickCleared', handleTrickCleared);
      socketRef.current.off('hukumChosen', handleHukumChosen);
      socketRef.current.off('error', handleError);
    };
  }, []);

  const createRoom = () => {
    const name = playerName.trim();
    if (!name) {
      alert("Please enter your name");
      return;
    }
    const id = `${name.substring(0, 3)}${Date.now() % 10000}`;
    setPlayerId(id);
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
    socketRef.current.emit('joinRoom', { roomCode: code, playerName: name, playerId: id });
  };

  const chooseTeam = (team) => {
    if (!roomCode) return;
    socketRef.current.emit('chooseTeam', { roomCode, team });
  };

  const startGame = () => {
    if (!roomCode) return;
    socketRef.current.emit('startGame', { roomCode });
  };

  const chooseDealerPlayer = (chosenPlayerId) => {
    if (!roomCode) return;
    socketRef.current.emit('chooseDealerPlayer', { roomCode, playerId: chosenPlayerId });
  };

  const chooseHukum = (suit) => {
    if (!roomCode) return;
    socketRef.current.emit('chooseHukum', { roomCode, suit });
  };

  const playCard = (card) => {
    if (!roomCode) return;
    socketRef.current.emit('playCard', { roomCode, card });
  };

  if (view === 'lobby') {
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

  return (
    <GameTable
      gameState={gameState}
      playerId={playerId}
      playerName={playerName}
      playerHand={playerHand}
      chooseTeam={chooseTeam}
      startGame={startGame}
      chooseDealerPlayer={chooseDealerPlayer}
      chooseHukum={chooseHukum}
      playCard={playCard}
    />
  );
}

export default App;