import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PlayerColor, RoomInfo, GameId, PlayerState,
  ServerMessage, COLOR_HEX,
} from '@party-blast/shared';
import { useWebSocket } from './hooks/useWebSocket';
import { JoinScreen } from './screens/JoinScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { CountdownScreen } from './screens/CountdownScreen';
import { GameController } from './screens/GameController';
import { ResultsScreen } from './screens/ResultsScreen';
import { VictoryScreen } from './screens/VictoryScreen';

type AppScreen =
  | 'join'
  | 'lobby'
  | 'countdown'
  | 'game'
  | 'results'
  | 'victory';

interface GameResultState {
  scores: Record<string, number>;
  cumulativeScores: Record<string, number>;
  players: PlayerState[];
}

export default function App() {
  const { connected, send, addHandler } = useWebSocket();
  const [screen, setScreen] = useState<AppScreen>('join');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [myColor, setMyColor] = useState<PlayerColor>('red');
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);

  // Countdown
  const [countdownGame, setCountdownGame] = useState<GameId>('platform-panic');
  const [countdownSecs, setCountdownSecs] = useState(3);

  // Game
  const [currentGameId, setCurrentGameId] = useState<GameId>('platform-panic');
  const [gameState, setGameState] = useState<{
    players: PlayerState[];
    timeRemaining: number;
    round: number;
    totalRounds: number;
    scores: Record<string, number>;
  } | null>(null);

  // Votes
  const [voteOptions, setVoteOptions] = useState<GameId[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});

  // Results
  const [resultState, setResultState] = useState<GameResultState | null>(null);

  // Check URL for prefilled room code
  const urlParams = new URLSearchParams(window.location.search);
  const prefillCode = urlParams.get('room') ?? undefined;

  // Input send interval
  const playerIdRef = useRef(playerId);
  const roomCodeRef = useRef(roomCode);
  const currentGameIdRef = useRef(currentGameId);
  playerIdRef.current = playerId;
  roomCodeRef.current = roomCode;
  currentGameIdRef.current = currentGameId;

  useEffect(() => {
    const remove = addHandler((msg: ServerMessage) => {
      switch (msg.type) {
        case 'room_joined':
          setRoomInfo(msg.roomInfo);
          setPlayerId(msg.playerId);
          setJoining(false);
          setError(null);
          setScreen('lobby');
          // Set my color from room info
          const me = msg.roomInfo.players.find(p => p.id === msg.playerId);
          if (me) setMyColor(me.color);
          break;

        case 'room_error':
          setError(msg.message);
          setJoining(false);
          break;

        case 'player_joined':
          setRoomInfo(msg.roomInfo);
          break;

        case 'player_left':
          setRoomInfo(msg.roomInfo);
          break;

        case 'game_starting':
          setCountdownGame(msg.gameId);
          setCountdownSecs(msg.countdown);
          setCurrentGameId(msg.gameId);
          setScreen('countdown');
          break;

        case 'game_votes':
          setVoteOptions(msg.options);
          setVotes(msg.votes as Record<string, number>);
          if (screen !== 'lobby') setScreen('lobby');
          // Update room info phase
          setRoomInfo(prev => prev ? { ...prev, phase: 'game-select' } : prev);
          break;

        case 'game_end':
          setResultState({
            scores: msg.scores,
            cumulativeScores: msg.cumulativeScores,
            players: gameState?.players ?? roomInfo?.players ?? [],
          });
          setScreen('results');
          break;

        case 'settings_updated':
          setRoomInfo(prev => prev ? { ...prev, settings: msg.settings } : prev);
          break;

        case 'state':
          if (msg.phase === 'playing') {
            if (screen !== 'game') setScreen('game');
            if (msg.gameId) setCurrentGameId(msg.gameId);
            setGameState({
              players: msg.players,
              timeRemaining: msg.timeRemaining,
              round: msg.round,
              totalRounds: msg.totalRounds,
              scores: msg.scores,
            });
          } else if (msg.phase === 'lobby') {
            setRoomInfo(prev => prev ? { ...prev, players: msg.players, phase: 'lobby' } : prev);
            if (screen !== 'lobby') setScreen('lobby');
          } else if (msg.phase === 'victory') {
            setScreen('victory');
            setGameState(prev => prev ? { ...prev, players: msg.players, scores: msg.scores } : prev);
          } else if (msg.phase === 'results') {
            // results handled by game_end
          } else if (msg.phase === 'countdown') {
            // handled by game_starting
          }
          break;

        case 'ping':
          break;
      }
    });
    return remove;
  }, [addHandler, screen, gameState, roomInfo]);

  const handleJoin = useCallback((code: string, name: string, color: PlayerColor) => {
    if (!connected) {
      setError('Not connected to server. Please wait...');
      return;
    }
    setJoining(true);
    setError(null);
    setMyColor(color);
    setRoomCode(code);
    send({ type: 'join_room', code, playerName: name, color });
  }, [connected, send]);

  const handleStartGame = useCallback(() => {
    send({ type: 'start_game', roomCode: roomCodeRef.current, playerId: playerIdRef.current });
  }, [send]);

  const handleVote = useCallback((gameId: GameId) => {
    send({ type: 'vote_game', roomCode: roomCodeRef.current, playerId: playerIdRef.current, gameId });
  }, [send]);

  const handleInput = useCallback((data: { joystick?: { x: number; y: number }; buttons?: Record<string, boolean> }) => {
    if (!playerIdRef.current || !roomCodeRef.current) return;
    send({
      type: 'input',
      playerId: playerIdRef.current,
      roomCode: roomCodeRef.current,
      gameId: currentGameIdRef.current,
      timestamp: Date.now(),
      data,
    });
  }, [send]);

  const myPlayer = gameState?.players.find(p => p.id === playerId);

  // Connection indicator
  const connIndicator = (
    <div style={{
      position: 'fixed',
      top: 8,
      right: 8,
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: connected ? '#3BFF6A' : '#FF3B3B',
      zIndex: 1000,
      boxShadow: `0 0 8px ${connected ? '#3BFF6A' : '#FF3B3B'}`,
    }} />
  );

  return (
    <>
      {connIndicator}
      {screen === 'join' && (
        <JoinScreen
          onJoin={handleJoin}
          error={error}
          connecting={joining}
          prefillCode={prefillCode}
        />
      )}
      {screen === 'lobby' && roomInfo && (
        <LobbyScreen
          roomInfo={roomInfo}
          playerId={playerId}
          onStartGame={handleStartGame}
          onVote={handleVote}
          voteOptions={voteOptions}
          votes={votes}
        />
      )}
      {screen === 'countdown' && (
        <CountdownScreen
          gameId={countdownGame}
          countdown={countdownSecs}
          myColor={myColor}
        />
      )}
      {screen === 'game' && gameState && (
        <GameController
          gameId={currentGameId}
          myColor={myColor}
          myPlayer={myPlayer}
          timeRemaining={gameState.timeRemaining}
          onInput={handleInput}
        />
      )}
      {screen === 'results' && resultState && (
        <ResultsScreen
          players={resultState.players}
          roundScores={resultState.scores}
          cumulativeScores={resultState.cumulativeScores}
          playerId={playerId}
          round={gameState?.round ?? 1}
          totalRounds={gameState?.totalRounds ?? 5}
        />
      )}
      {screen === 'victory' && gameState && (
        <VictoryScreen
          players={gameState.players}
          scores={gameState.scores}
          playerId={playerId}
        />
      )}
    </>
  );
}
