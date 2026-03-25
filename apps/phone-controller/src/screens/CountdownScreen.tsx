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
      <div style={styles.tip}>{getTip(gameId)}</div>
    </div>
  );
}

function getTip(gameId: GameId): string {
  switch (gameId) {
    case 'platform-panic': return 'Move with joystick. Don\'t fall off the crumbling platforms!';
    case 'bomb-tag': return 'Run from the bomb! Press TAG near someone to pass it!';
    case 'arena-ball': return 'Score goals! Use DASH for a speed boost toward the ball.';
    case 'sumo-smash': return 'Push opponents off the ring! CHARGE for a powerful knockback.';
    case 'kart-blitz': return 'Race around the track! Use BOOST for a burst of speed.';
    case 'bullseye-bonanza': return 'Aim with joystick, press THROW to hit targets for points!';
    case 'doodle-dash': return 'Draw or guess! Use joystick to draw, press GUESS when you know it.';
    case 'obstacle-gauntlet': return 'Run forward and dodge obstacles! Press JUMP to leap over them.';
    case 'trivia-royale': return 'Answer questions with A/B/X/Y! Faster = more points.';
    case 'rhythm-riot': return 'Hit A/B/X/Y to the beat! Build combos for bonus points.';
    default: return 'Use joystick and buttons to play!';
  }
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
