import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import WaitingRoom from './components/WaitingRoom';
import './styles.css';

const socket = io();

function App() {
  const [view, setView] = useState('lobby');
  
  // Check socket connection on component mount
  useEffect(() => {
    console.log('DEBUG: App component mounted, socket connected:', socket.connected);
    console.log('DEBUG: Socket ID:', socket.id);
    console.log('DEBUG: Socket io URI:', socket.io.uri);
  }, []);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [gameState, setGameState] = useState(null);
  const [playerHand, setPlayerHand] = useState([]);
  const [isPrivateRoom, setIsPrivateRoom] = useState(false);
  const [publicRooms, setPublicRooms] = useState([]);
  const [isQuickJoin, setIsQuickJoin] = useState(false);
  const socketRef = useRef(socket);

  
  useEffect(() => {
    const handleRoomCreated = ({ roomCode }) => {
      // Clear the quick join timeout if it exists
      if (socketRef.current.quickJoinTimeout) {
        clearTimeout(socketRef.current.quickJoinTimeout);
        socketRef.current.quickJoinTimeout = null;
      }
      
      setRoomCode(roomCode);
      // If we're in quick join mode, transition to the game view (which will show WaitingRoom)
      // The transition to actual game table will happen when we receive game state
      setView('game');
    };

    const handleRoomJoined = ({ roomCode }) => {
      // Clear the quick join timeout if it exists
      if (socketRef.current.quickJoinTimeout) {
        clearTimeout(socketRef.current.quickJoinTimeout);
        socketRef.current.quickJoinTimeout = null;
      }
      
      setRoomCode(roomCode);
      // If we're in quick join mode, transition to the game view (which will show WaitingRoom)
      // The transition to actual game table will happen when we receive game state
      setView('game');
    };

    const handleGameState = (state) => {
      setGameState(state);
      if (state.playerHand) {
        setPlayerHand(state.playerHand);
      }
      
      // If we're in quick join mode and we've received a game state, transition to the game view
      // when the game has started (state is no longer teamSelection)
      if (isQuickJoin && state.state && state.state !== 'teamSelection') {
        setView('game');
        setIsQuickJoin(false); // Reset quick join flag after transitioning to game
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

    const handlePublicRooms = (rooms) => {
      setPublicRooms(rooms);
    };

    const handleError = (msg) => {
      // Clear the quick join timeout if it exists
      if (socketRef.current.quickJoinTimeout) {
        clearTimeout(socketRef.current.quickJoinTimeout);
        socketRef.current.quickJoinTimeout = null;
      }
      
      // Reset quick join state if there's an error
      if (isQuickJoin) {
        setIsQuickJoin(false);
      }
      
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
    socketRef.current.on('publicRooms', handlePublicRooms);
    socketRef.current.on('error', handleError);
    
    // Add debug prints for all socket events
    socketRef.current.on('connect', () => {
      console.log('DEBUG: Socket connected with ID:', socketRef.current.id);
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('DEBUG: Socket disconnected');
    });
    
    // Debug print for any event
    socketRef.current.onAny((event, ...args) => {
      console.log('DEBUG: Socket event received:', event, args);
    });

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
      socketRef.current.off('publicRooms', handlePublicRooms);
      socketRef.current.off('error', handleError);
    };
  }, [isQuickJoin, view]);

  const createRoom = () => {
    const name = playerName.trim();
    if (!name) {
      alert("Please enter your name");
      return;
    }
    const id = `${name.substring(0, 3)}${Date.now() % 10000}`;
    setPlayerId(id);
    socketRef.current.emit('createRoom', { playerName: name, playerId: id, isPrivate: isPrivateRoom });
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

  const getPublicRooms = () => {
    socketRef.current.emit('getPublicRooms');
  };

  const quickJoin = (nameParam) => {
    // Use the passed name parameter if available, otherwise fall back to state
    const name = (nameParam || playerName).trim();
    console.log("DEBUG: quickJoin called with playerName:", name, "nameParam:", nameParam);
    if (!name) {
      alert("Please enter your name");
      return;
    }
    const id = `${name.substring(0, 3)}${Date.now() % 10000}`;
    console.log("DEBUG: Generated playerId:", id);
    setPlayerId(id);
    setIsQuickJoin(true);
    console.log("DEBUG: Set isQuickJoin to true, current view:", view);
    
    // Set a timeout to handle cases where the server doesn't respond
    const quickJoinTimeout = setTimeout(() => {
      if (isQuickJoin && view === 'lobby') {
        alert("Failed to join a game. Please try again.");
        setIsQuickJoin(false);
      }
    }, 10000); // 10 seconds timeout
    
    // Don't immediately transition to game view, wait for room creation/join confirmation
    socketRef.current.emit('quickJoin', { playerName: name, playerId: id });
    console.log("DEBUG: Emitted quickJoin socket event");
    
    // Store the timeout ID to clear it when we get a response
    socketRef.current.quickJoinTimeout = quickJoinTimeout;
  };

  const leaveWaitingRoom = () => {
    // Clear the quick join timeout if it exists
    if (socketRef.current.quickJoinTimeout) {
      clearTimeout(socketRef.current.quickJoinTimeout);
      socketRef.current.quickJoinTimeout = null;
    }
    
    setView('lobby');
    setIsQuickJoin(false);
    setGameState(null);
    setRoomCode('');
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
        isPrivateRoom={isPrivateRoom}
        setIsPrivateRoom={setIsPrivateRoom}
        publicRooms={publicRooms}
        getPublicRooms={getPublicRooms}
        quickJoin={quickJoin}
      />
    );
  }

  if (view === 'game' && isQuickJoin) {
    return (
      <WaitingRoom
        gameState={gameState}
        playerName={playerName}
        onLeaveWaiting={leaveWaitingRoom}
      />
    );
  }

  if (view === 'game') {
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

  // This should not happen, but as a fallback, show the lobby
  return (
    <Lobby
      createRoom={createRoom}
      joinRoom={joinRoom}
      roomCode={roomCode}
      setRoomCode={setRoomCode}
      playerName={playerName}
      setPlayerName={setPlayerName}
      isPrivateRoom={isPrivateRoom}
      setIsPrivateRoom={setIsPrivateRoom}
      publicRooms={publicRooms}
      getPublicRooms={getPublicRooms}
      quickJoin={quickJoin}
    />
  );
}

export default App;