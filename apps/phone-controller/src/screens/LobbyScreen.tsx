import React from 'react';
import { RoomInfo, PlayerState, COLOR_HEX, GAME_NAMES, GameId } from '@party-blast/shared';

interface LobbyScreenProps {
  roomInfo: RoomInfo;
  playerId: string;
  onStartGame: () => void;
  onVote: (gameId: GameId) => void;
  voteOptions: GameId[];
  votes: Record<string, number>;
}

export function LobbyScreen({ roomInfo, playerId, onStartGame, onVote, voteOptions, votes }: LobbyScreenProps) {
  const me = roomInfo.players.find(p => p.id === playerId);
  const isHost = me?.isHost ?? false;
  const myColor = me ? COLOR_HEX[me.color] : '#ffffff';
  const canStart = roomInfo.players.length >= 1;

  if (roomInfo.phase === 'game-select' && voteOptions.length > 0) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.header, borderColor: myColor }}>
          <div style={{ ...styles.avatar, background: myColor + '33', color: myColor }}>
            {me?.name.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div>
            <div style={styles.playerName}>{me?.name}</div>
            <div style={styles.roomCode}>Room: {roomInfo.code}</div>
          </div>
        </div>

        <div style={styles.voteTitle}>VOTE FOR NEXT GAME</div>

        <div style={styles.voteList}>
          {voteOptions.map(opt => {
            const voteCount = votes[opt] ?? 0;
            return (
              <button
                key={opt}
                style={{ ...styles.voteBtn, borderColor: myColor }}
                onClick={() => onVote(opt)}
              >
                <span style={styles.voteGameName}>{GAME_NAMES[opt] ?? opt}</span>
                <span style={{ ...styles.voteCount, color: myColor }}>{voteCount} votes</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ ...styles.header, borderColor: myColor }}>
        <div style={{ ...styles.avatar, background: myColor + '33', color: myColor }}>
          {me?.name.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div>
          <div style={styles.playerName}>{me?.name ?? 'Player'}</div>
          <div style={styles.roomCode}>Room: {roomInfo.code}</div>
        </div>
        {isHost && <div style={styles.hostBadge}>HOST</div>}
      </div>

      <div style={styles.sectionTitle}>PLAYERS ({roomInfo.players.length}/8)</div>
      <div style={styles.playerList}>
        {roomInfo.players.map(p => {
          const hex = COLOR_HEX[p.color] ?? '#fff';
          return (
            <div key={p.id} style={{ ...styles.playerRow, borderColor: hex + '44' }}>
              <div style={{ ...styles.playerDot, background: hex + '33', color: hex }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ ...styles.playerRowName, color: p.id === playerId ? hex : 'white' }}>
                {p.name}
                {p.id === playerId ? ' (you)' : ''}
              </div>
              {p.isHost && <div style={styles.hostTag}>HOST</div>}
              {!p.connected && <div style={styles.disconnectedTag}>AWAY</div>}
            </div>
          );
        })}
        {Array.from({ length: Math.max(0, 8 - roomInfo.players.length) }).slice(0, 4).map((_, i) => (
          <div key={`empty-${i}`} style={styles.emptySlot}>
            <div style={styles.emptyDot} />
            <span style={styles.emptyText}>Waiting...</span>
          </div>
        ))}
      </div>

      {isHost ? (
        <div style={styles.startSection}>
          {!canStart && <div style={styles.waitHint}>Need at least 2 players to start</div>}
          <button
            style={{ ...styles.startBtn, opacity: canStart ? 1 : 0.4 }}
            disabled={!canStart}
            onClick={onStartGame}
          >
            START GAME
          </button>
        </div>
      ) : (
        <div style={styles.waitingSection}>
          <div style={styles.waitingSpinner}>⏳</div>
          <div style={styles.waitingText}>Waiting for host to start...</div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100dvh',
    background: 'radial-gradient(ellipse at top, #0d1a2e 0%, #0a0a1a 70%)',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '16px',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: 'white',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '16px',
    border: '2px solid',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: 900,
    flexShrink: 0,
  },
  playerName: { fontSize: '20px', fontWeight: 700 },
  roomCode: { fontSize: '13px', opacity: 0.5, letterSpacing: '2px' },
  hostBadge: {
    marginLeft: 'auto',
    background: 'rgba(255,224,59,0.2)',
    color: '#FFE03B',
    fontSize: '12px',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: '6px',
    letterSpacing: '1px',
  },
  sectionTitle: {
    fontSize: '12px',
    opacity: 0.5,
    letterSpacing: '3px',
    textTransform: 'uppercase',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '12px',
    border: '1px solid',
  },
  playerDot: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: '16px',
    flexShrink: 0,
  },
  playerRowName: { fontSize: '16px', fontWeight: 600, flex: 1 },
  hostTag: {
    fontSize: '11px',
    color: '#FFE03B',
    background: 'rgba(255,224,59,0.1)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  disconnectedTag: {
    fontSize: '11px',
    color: '#FF3B3B',
    background: 'rgba(255,59,59,0.1)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  emptySlot: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.01)',
    borderRadius: '12px',
    border: '1px dashed rgba(255,255,255,0.08)',
    opacity: 0.4,
  },
  emptyDot: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)',
    flexShrink: 0,
  },
  emptyText: { fontSize: '14px', opacity: 0.5 },
  startSection: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  waitHint: {
    textAlign: 'center',
    fontSize: '13px',
    opacity: 0.5,
  },
  startBtn: {
    padding: '20px',
    fontSize: '22px',
    fontWeight: 900,
    letterSpacing: '3px',
    background: 'linear-gradient(135deg, #3BFF6A, #3B8BFF)',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 0 30px rgba(59,255,106,0.3)',
  },
  waitingSection: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '32px',
  },
  waitingSpinner: { fontSize: '48px' },
  waitingText: { fontSize: '18px', opacity: 0.6, textAlign: 'center' },
  voteTitle: {
    fontSize: '24px',
    fontWeight: 900,
    textAlign: 'center',
    letterSpacing: '3px',
    opacity: 0.8,
  },
  voteList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
  },
  voteBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    background: 'rgba(255,255,255,0.06)',
    border: '2px solid',
    borderRadius: '16px',
    color: 'white',
    fontSize: '20px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  voteGameName: { fontSize: '18px', fontWeight: 700 },
  voteCount: { fontSize: '24px', fontWeight: 900 },
};
