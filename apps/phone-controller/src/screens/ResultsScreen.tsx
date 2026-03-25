import React from 'react';
import { PlayerState, COLOR_HEX } from '@party-blast/shared';

interface ResultsScreenProps {
  players: PlayerState[];
  roundScores: Record<string, number>;
  cumulativeScores: Record<string, number>;
  playerId: string;
  round: number;
  totalRounds: number;
}

export function ResultsScreen({ players, roundScores, cumulativeScores, playerId, round, totalRounds }: ResultsScreenProps) {
  const sorted = [...players].sort((a, b) => (cumulativeScores[b.id] ?? 0) - (cumulativeScores[a.id] ?? 0));
  const myPos = sorted.findIndex(p => p.id === playerId) + 1;
  const me = players.find(p => p.id === playerId);
  const myColor = me ? COLOR_HEX[me.color] : '#ffffff';
  const myRoundPts = me ? (roundScores[me.id] ?? 0) : 0;
  const myTotal = me ? (cumulativeScores[me.id] ?? 0) : 0;

  const medals = ['🥇', '🥈', '🥉'];
  const posLabels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

  return (
    <div style={styles.container}>
      <div style={styles.title}>ROUND {round} RESULTS</div>
      <div style={styles.subtitle}>of {totalRounds} rounds</div>

      {/* My result highlight */}
      <div style={{ ...styles.myResult, borderColor: myColor }}>
        <div style={{ ...styles.myPos, color: myColor }}>
          {medals[myPos - 1] ?? `#${myPos}`}
        </div>
        <div style={styles.myStats}>
          <div style={styles.myName}>{me?.name ?? 'You'}</div>
          <div style={styles.myPts}>+{myRoundPts} this round</div>
        </div>
        <div style={{ ...styles.myTotal, color: myColor }}>{myTotal} pts</div>
      </div>

      {/* Full leaderboard */}
      <div style={styles.leaderboard}>
        {sorted.map((p, i) => {
          const hex = COLOR_HEX[p.color] ?? '#fff';
          const roundPts = roundScores[p.id] ?? 0;
          const total = cumulativeScores[p.id] ?? 0;
          const isMe = p.id === playerId;
          return (
            <div
              key={p.id}
              style={{
                ...styles.row,
                background: isMe ? `${hex}11` : 'rgba(255,255,255,0.04)',
                borderColor: isMe ? hex : 'rgba(255,255,255,0.06)',
              }}
            >
              <div style={styles.rowPos}>{posLabels[i] ?? `${i + 1}`}</div>
              <div style={{ ...styles.rowDot, background: hex + '33', color: hex }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ ...styles.rowName, color: isMe ? hex : 'white' }}>
                {p.name}{isMe ? ' ★' : ''}
              </div>
              <div style={styles.rowRoundPts}>+{roundPts}</div>
              <div style={styles.rowTotal}>{total}</div>
            </div>
          );
        })}
      </div>

      <div style={styles.hint}>Next game starting soon...</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100dvh',
    background: 'radial-gradient(ellipse at top, #0d2010 0%, #0a0a1a 70%)',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 16px',
    gap: '12px',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: 'white',
    overflowY: 'auto',
  },
  title: {
    fontSize: '28px',
    fontWeight: 900,
    color: '#3BFF6A',
    textAlign: 'center',
    letterSpacing: '2px',
  },
  subtitle: {
    fontSize: '13px',
    opacity: 0.4,
    textAlign: 'center',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  myResult: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '16px',
    border: '2px solid',
    marginBottom: '8px',
  },
  myPos: { fontSize: '40px', flexShrink: 0 },
  myStats: { flex: 1 },
  myName: { fontSize: '20px', fontWeight: 700 },
  myPts: { fontSize: '14px', color: '#3BFF6A', opacity: 0.8 },
  myTotal: { fontSize: '32px', fontWeight: 900 },
  leaderboard: { display: 'flex', flexDirection: 'column', gap: '6px' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid',
  },
  rowPos: { fontSize: '13px', opacity: 0.6, minWidth: '36px', fontWeight: 700 },
  rowDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: '14px',
    flexShrink: 0,
  },
  rowName: { flex: 1, fontSize: '15px', fontWeight: 600 },
  rowRoundPts: { fontSize: '14px', color: '#3BFF6A', minWidth: '40px', textAlign: 'right' },
  rowTotal: { fontSize: '20px', fontWeight: 900, minWidth: '48px', textAlign: 'right' },
  hint: {
    textAlign: 'center',
    fontSize: '14px',
    opacity: 0.4,
    letterSpacing: '1px',
    marginTop: 'auto',
    padding: '16px',
  },
};
