import React, { useState } from 'react';
import { RoomInfo, COLOR_HEX, GAME_NAMES, GAME_EMOJIS, GameId } from '@party-blast/shared';

interface LobbyScreenProps {
  roomInfo: RoomInfo;
  playerId: string;
  onStartGame: () => void;
  onSelectGame: (gameId: GameId) => void;
  onVote: (gameId: GameId) => void;
  voteOptions: GameId[];
  votes: Record<string, number>;
}

const ALL_GAMES: GameId[] = [
  'platform-panic', 'bomb-tag', 'arena-ball', 'sumo-smash',
  'kart-blitz', 'bullseye-bonanza', 'obstacle-gauntlet',
  'trivia-royale', 'rhythm-riot', 'doodle-dash',
];

export function LobbyScreen({ roomInfo, playerId, onStartGame, onSelectGame, onVote, voteOptions, votes }: LobbyScreenProps) {
  const me = roomInfo.players.find(p => p.id === playerId);
  const isHost = me?.isHost ?? false;
  const myColor = me ? COLOR_HEX[me.color] : '#ffffff';
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);

  // Voting phase
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
                <span style={{ fontSize: 24 }}>{GAME_EMOJIS[opt]}</span>
                <span style={styles.voteGameName}>{GAME_NAMES[opt] ?? opt}</span>
                <span style={{ ...styles.voteCount, color: myColor }}>{voteCount}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Lobby phase
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
      </div>

      {isHost ? (
        <div style={styles.startSection}>
          <div style={styles.sectionTitle}>SELECT A GAME</div>
          <div style={styles.gameGrid}>
            {ALL_GAMES.map(gid => {
              const isSelected = selectedGame === gid;
              return (
                <button
                  key={gid}
                  onClick={() => setSelectedGame(gid)}
                  style={{
                    ...styles.gameCard,
                    borderColor: isSelected ? myColor : 'rgba(255,255,255,0.1)',
                    background: isSelected ? myColor + '22' : 'rgba(255,255,255,0.04)',
                  }}
                >
                  <span style={{ fontSize: 28 }}>{GAME_EMOJIS[gid]}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, textAlign: 'center' as const }}>{GAME_NAMES[gid]}</span>
                </button>
              );
            })}
          </div>

          <button
            style={{
              ...styles.startBtn,
              opacity: selectedGame ? 1 : 0.4,
            }}
            disabled={!selectedGame}
            onClick={() => {
              if (selectedGame) onSelectGame(selectedGame);
            }}
          >
            {selectedGame ? `PLAY ${GAME_NAMES[selectedGame].toUpperCase()}` : 'SELECT A GAME'}
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
    gap: '12px',
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
    flexShrink: 0,
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 900,
    flexShrink: 0,
  },
  playerName: { fontSize: '18px', fontWeight: 700 },
  roomCode: { fontSize: '12px', opacity: 0.5, letterSpacing: '2px' },
  hostBadge: {
    marginLeft: 'auto',
    background: 'rgba(255,224,59,0.2)',
    color: '#FFE03B',
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: '6px',
    letterSpacing: '1px',
  },
  sectionTitle: {
    fontSize: '11px',
    opacity: 0.5,
    letterSpacing: '3px',
    textTransform: 'uppercase',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '10px',
    border: '1px solid',
  },
  playerDot: {
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
  playerRowName: { fontSize: '15px', fontWeight: 600, flex: 1 },
  hostTag: {
    fontSize: '10px',
    color: '#FFE03B',
    background: 'rgba(255,224,59,0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  disconnectedTag: {
    fontSize: '10px',
    color: '#FF3B3B',
    background: 'rgba(255,59,59,0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  startSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  gameGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  gameCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '12px 4px',
    borderRadius: '12px',
    border: '2px solid',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'rgba(255,255,255,0.04)',
  },
  startBtn: {
    padding: '18px',
    fontSize: '18px',
    fontWeight: 900,
    letterSpacing: '2px',
    background: 'linear-gradient(135deg, #3BFF6A, #3B8BFF)',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 0 30px rgba(59,255,106,0.3)',
    marginTop: 'auto',
    flexShrink: 0,
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
    gap: '12px',
    padding: '16px 20px',
    background: 'rgba(255,255,255,0.06)',
    border: '2px solid',
    borderRadius: '16px',
    color: 'white',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  voteGameName: { fontSize: '16px', fontWeight: 700, flex: 1 },
  voteCount: { fontSize: '22px', fontWeight: 900 },
};
