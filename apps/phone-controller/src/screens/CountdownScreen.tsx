import React, { useState, useEffect } from 'react';
import { GameId, GAME_NAMES, GAME_EMOJIS, COLOR_HEX, PlayerColor } from '@party-blast/shared';

interface CountdownScreenProps {
  gameId: GameId;
  countdown: number;
  myColor: PlayerColor;
}

export function CountdownScreen({ gameId, countdown, myColor }: CountdownScreenProps) {
  const [count, setCount] = useState(countdown);
  const hex = COLOR_HEX[myColor];

  useEffect(() => {
    setCount(countdown);
    const interval = setInterval(() => {
      setCount(c => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown, gameId]);

  return (
    <div style={{ ...styles.container, background: `radial-gradient(ellipse at center, ${hex}22 0%, #0a0a1a 70%)` }}>
      <div style={styles.emoji}>{GAME_EMOJIS[gameId] ?? '🎮'}</div>
      <div style={styles.gameName}>{GAME_NAMES[gameId] ?? gameId}</div>
      <div style={styles.label}>GET READY!</div>
      <div style={{ ...styles.count, color: count <= 1 ? '#3BFF6A' : hex }}>
        {count === 0 ? 'GO!' : count}
      </div>
      <div style={styles.tip}>
        {gameId === 'platform-panic' && 'Use joystick to move. Don\'t fall off!'}
        {gameId === 'bomb-tag' && 'Run! Pass the bomb before it explodes!'}
        {gameId === 'arena-ball' && 'Use joystick + DASH to shoot the ball!'}
        {gameId === 'sumo-smash' && 'CHARGE to knock opponents off the ring!'}
        {!['platform-panic','bomb-tag','arena-ball','sumo-smash'].includes(gameId) && 'Use joystick and buttons to play!'}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: 'white',
    padding: '24px',
    textAlign: 'center',
  },
  emoji: { fontSize: '80px', lineHeight: 1 },
  gameName: {
    fontSize: '32px',
    fontWeight: 900,
    letterSpacing: '2px',
    opacity: 0.9,
  },
  label: {
    fontSize: '16px',
    opacity: 0.5,
    letterSpacing: '4px',
    textTransform: 'uppercase',
  },
  count: {
    fontSize: '120px',
    fontWeight: 900,
    lineHeight: 1,
    textShadow: '0 0 40px currentColor',
    transition: 'color 0.3s',
  },
  tip: {
    fontSize: '16px',
    opacity: 0.5,
    maxWidth: '280px',
    lineHeight: 1.5,
  },
};
