import React from 'react';
import { PlayerState, COLOR_HEX } from '@party-blast/shared';

interface VictoryScreenProps {
  players: PlayerState[];
  scores: Record<string, number>;
  playerId: string;
}

export function VictoryScreen({ players, scores, playerId }: VictoryScreenProps) {
  const sorted = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const winner = sorted[0];
  const me = players.find(p => p.id === playerId);
  const myPos = sorted.findIndex(p => p.id === playerId) + 1;
  const myColor = me ? COLOR_HEX[me.color] : '#ffffff';
  const isWinner = winner?.id === playerId;

  const medals = ['🥇', '🥈', '🥉'];
  const posLabels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

  return (
    <div style={{
      ...styles.container,
      background: isWinner
        ? 'radial-gradient(ellipse at top, #2a1800 0%, #0a0a1a 70%)'
        : 'radial-gradient(ellipse at top, #0d0d0d 0%, #0a0a1a 70%)',
    }}>
      <div style={styles.title}>
        {isWinner ? '🏆 YOU WIN! 🏆' : 'GAME OVER'}
      </div>

      {isWinner ? (
        <div style={styles.winnerSection}>
          <div style={styles.winnerEmoji}>🎉</div>
          <div style={styles.winnerText}>CHAMPION!</div>
          <div style={{ ...styles.winnerScore, color: myColor }}>{scores[playerId] ?? 0} pts</div>
        </div>
      ) : (
        <div style={styles.myResultSection}>
          <div style={{ ...styles.myPosBig, color: myColor }}>
            {medals[myPos - 1] ?? `#${myPos}`}
          </div>
          <div style={styles.myPlaceText}>{posLabels[myPos - 1] ?? `${myPos}th`} Place</div>
          <div style={{ ...styles.myScoreBig, color: myColor }}>{scores[playerId] ?? 0} pts</div>
        </div>
      )}

      <div style={styles.finalTitle}>FINAL STANDINGS</div>
      <div style={styles.finalList}>
        {sorted.map((p, i) => {
          const hex = COLOR_HEX[p.color] ?? '#fff';
          const total = scores[p.id] ?? 0;
          const isMe = p.id === playerId;
          const isTop = i === 0;
          return (
            <div
              key={p.id}
              style={{
                ...styles.finalRow,
                background: isMe ? `${hex}15` : isTop ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.04)',
                borderColor: isMe ? hex : isTop ? '#FFD700' : 'rgba(255,255,255,0.06)',
                transform: isTop ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <div style={styles.finalPos}>{medals[i] ?? posLabels[i] ?? `${i+1}`}</div>
              <div style={{ ...styles.finalDot, background: hex + '33', color: hex }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ ...styles.finalName, color: isMe ? hex : isTop ? '#FFD700' : 'white' }}>
                {p.name}{isMe ? ' ★' : ''}
              </div>
              <div style={{ ...styles.finalScore, color: isTop ? '#FFD700' : 'white' }}>{total} pts</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 16px',
    gap: '16px',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: 'white',
    overflowY: 'auto',
    alignItems: 'center',
  },
  title: {
    fontSize: '32px',
    fontWeight: 900,
    letterSpacing: '2px',
    textAlign: 'center',
    color: '#FFD700',
    textShadow: '0 0 30px rgba(255,215,0,0.5)',
  },
  winnerSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '24px',
  },
  winnerEmoji: { fontSize: '64px' },
  winnerText: { fontSize: '36px', fontWeight: 900, color: '#FFD700' },
  winnerScore: { fontSize: '28px', fontWeight: 900 },
  myResultSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
  },
  myPosBig: { fontSize: '64px', lineHeight: 1 },
  myPlaceText: { fontSize: '20px', opacity: 0.7, fontWeight: 700 },
  myScoreBig: { fontSize: '32px', fontWeight: 900 },
  finalTitle: {
    fontSize: '13px',
    opacity: 0.5,
    letterSpacing: '3px',
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  finalList: { display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' },
  finalRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid',
    transition: 'transform 0.2s',
  },
  finalPos: { fontSize: '20px', minWidth: '36px', textAlign: 'center' },
  finalDot: {
    width: '32px', height: '32px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: '14px', flexShrink: 0,
  },
  finalName: { flex: 1, fontSize: '16px', fontWeight: 600 },
  finalScore: { fontSize: '20px', fontWeight: 900 },
};
