import React, { useRef, useEffect, useCallback } from 'react';
import nipplejs from 'nipplejs';
import { GameId, PlayerColor, COLOR_HEX, PlayerState } from '@party-blast/shared';

interface GameControllerProps {
  gameId: GameId;
  myColor: PlayerColor;
  myPlayer: PlayerState | undefined;
  timeRemaining: number;
  onInput: (data: { joystick?: { x: number; y: number }; buttons?: Record<string, boolean> }) => void;
}

export function GameController({ gameId, myColor, myPlayer, timeRemaining, onInput }: GameControllerProps) {
  const hex = COLOR_HEX[myColor];
  const joystickZoneRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{ joystick: { x: number; y: number }; buttons: Record<string, boolean> }>({
    joystick: { x: 0, y: 0 },
    buttons: {},
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;

  useEffect(() => {
    const zone = joystickZoneRef.current;
    if (!zone) return;

    const manager = nipplejs.create({
      zone,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: hex,
      size: 130,
      restOpacity: 0.4,
    });

    manager.on('move', (_evt, data) => {
      if (data.vector) {
        stateRef.current.joystick = { x: data.vector.x, y: -data.vector.y };
      }
    });
    manager.on('end', () => { stateRef.current.joystick = { x: 0, y: 0 }; });

    intervalRef.current = setInterval(() => {
      onInputRef.current({
        joystick: stateRef.current.joystick,
        buttons: { ...stateRef.current.buttons },
      });
      // Reset momentary buttons
      for (const k of Object.keys(stateRef.current.buttons)) {
        if (stateRef.current.buttons[k]) stateRef.current.buttons[k] = false;
      }
    }, 1000 / 30);

    return () => {
      manager.destroy();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hex, gameId]);

  const pressButton = useCallback((name: string) => {
    stateRef.current.buttons[name] = true;
  }, []);

  // Timer formatting
  const secs = Math.ceil(timeRemaining);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const timerStr = `${m}:${s.toString().padStart(2, '0')}`;
  const isUrgent = secs <= 10;

  const isEliminated = myPlayer?.eliminated ?? false;
  const isFinished = myPlayer?.data?.finished ?? false;

  return (
    <div style={styles.container}>
      {/* Status bar */}
      <div style={{ ...styles.statusBar, borderColor: hex + '44' }}>
        <div style={{ ...styles.myIndicator, background: hex + '33', color: hex }}>
          {myPlayer?.name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <div style={styles.statusCenter}>
          {isEliminated ? (
            <div style={styles.eliminatedText}>ELIMINATED</div>
          ) : isFinished ? (
            <div style={{ fontSize: '14px', color: '#3BFF6A', fontWeight: 700, letterSpacing: '2px' }}>FINISHED!</div>
          ) : (
            <div style={styles.statusName}>
              {myPlayer?.name}
              {gameId === 'kart-blitz' && myPlayer?.data?.lap !== undefined && (
                <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
                  LAP {Math.min(((myPlayer.data.lap as number) ?? 0) + 1, myPlayer.data.totalLaps as number ?? 3)}/{myPlayer.data.totalLaps as number ?? 3}
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ ...styles.timer, color: isUrgent ? '#FF3B3B' : 'white' }}>
          {timerStr}
        </div>
      </div>

      {isEliminated || isFinished ? (
        <div style={styles.eliminatedScreen}>
          <div style={styles.eliminatedEmoji}>{isFinished ? '🏁' : '💀'}</div>
          <div style={{ ...styles.eliminatedTitle, color: isFinished ? '#3BFF6A' : '#FF3B3B' }}>
            {isFinished ? 'Race Complete!' : "You're out!"}
          </div>
          <div style={styles.eliminatedHint}>Watch the TV screen...</div>
        </div>
      ) : (
        <>
          {/* Joystick area */}
          <div style={styles.joystickArea}>
            <div ref={joystickZoneRef} style={styles.joystickZone} />
          </div>

          {/* Action buttons based on game */}
          <div style={styles.buttonArea}>
            {renderButtons(gameId, hex, pressButton, myPlayer)}
          </div>
        </>
      )}
    </div>
  );
}

function renderButtons(
  gameId: GameId,
  hex: string,
  pressButton: (name: string) => void,
  myPlayer?: PlayerState,
): React.ReactNode {
  switch (gameId) {
    case 'arena-ball': {
      const dashCd = (myPlayer?.data?.dashCooldown as number) ?? 0;
      const canDash = dashCd <= 0;
      const teamScores = (myPlayer?.data?.teamScores as number[]) ?? [0, 0];
      const myTeam = (myPlayer?.data?.team as number) ?? 0;
      return (
        <div style={{ ...btnStyles.grid1, flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, textAlign: 'center' }}>
            <span style={{ color: myTeam === 0 ? hex : '#888' }}>{teamScores[0]}</span>
            <span style={{ opacity: 0.4 }}> - </span>
            <span style={{ color: myTeam === 1 ? hex : '#888' }}>{teamScores[1]}</span>
          </div>
          <ActionButton
            label={canDash ? 'DASH' : `${dashCd.toFixed(1)}s`}
            color={canDash ? hex : '#555555'}
            size="large"
            onPress={() => pressButton('dash')}
            emoji={canDash ? '💨' : '⏳'}
          />
          <div style={{ fontSize: 12, opacity: 0.5 }}>
            Team {myTeam === 0 ? 'Blue' : 'Red'}
          </div>
        </div>
      );
    }

    case 'bomb-tag': {
      const hasBomb = myPlayer?.data?.hasBomb ?? false;
      const tagCd = (myPlayer?.data?.tagCooldown as number) ?? 0;
      const canTag = tagCd <= 0;
      const fuseProgress = (myPlayer?.data?.fuseProgress as number) ?? 0;
      const round = (myPlayer?.data?.round as number) ?? 1;
      const totalRounds = (myPlayer?.data?.totalRounds as number) ?? 5;
      return (
        <div style={{ ...btnStyles.grid1, flexDirection: 'column', gap: '12px' }}>
          {hasBomb && (
            <div style={{ width: '140px', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{
                width: `${(1 - fuseProgress) * 100}%`,
                height: '100%',
                background: fuseProgress > 0.7 ? '#FF0000' : fuseProgress > 0.4 ? '#FF8C3B' : '#FFE03B',
                borderRadius: '5px',
                transition: 'width 0.3s',
              }} />
            </div>
          )}
          <ActionButton
            label={hasBomb ? (canTag ? 'TAG!' : `${tagCd.toFixed(1)}s`) : 'NO BOMB'}
            color={hasBomb ? '#FF3B3B' : '#333333'}
            size="large"
            onPress={() => pressButton('tag')}
            emoji={hasBomb ? '💣' : '🏃'}
          />
          <div style={{ fontSize: 12, opacity: 0.5, textAlign: 'center' }}>
            Round {round}/{totalRounds} · {hasBomb ? 'PASS THE BOMB!' : 'Run away!'}
          </div>
        </div>
      );
    }

    case 'sumo-smash': {
      const chargeCd = (myPlayer?.data?.chargeCooldown as number) ?? 0;
      const canCharge = chargeCd <= 0;
      const edgeDist = (myPlayer?.data?.edgeDistance as number) ?? 10;
      const aliveCount = (myPlayer?.data?.aliveCount as number) ?? 0;
      const nearEdge = edgeDist < 3;
      return (
        <div style={{ ...btnStyles.grid1, flexDirection: 'column', gap: '12px' }}>
          {nearEdge && (
            <div style={{ fontSize: 14, color: '#FF3B3B', fontWeight: 700, animation: 'blink 0.5s infinite alternate' }}>
              ⚠️ NEAR EDGE!
            </div>
          )}
          <ActionButton
            label={canCharge ? 'CHARGE' : `${chargeCd.toFixed(1)}s`}
            color={canCharge ? hex : '#555555'}
            size="large"
            onPress={() => pressButton('charge')}
            emoji={canCharge ? '💥' : '⏳'}
          />
          <div style={{ fontSize: 12, opacity: 0.5, textAlign: 'center' }}>
            {aliveCount} remaining
          </div>
        </div>
      );
    }

    case 'platform-panic': {
      const jumpCd = (myPlayer?.data?.jumpCooldown as number) ?? 0;
      const canJump = jumpCd <= 0;
      const aliveCount = (myPlayer?.data?.aliveCount as number) ?? 0;
      const activePlats = (myPlayer?.data?.activePlatforms as number) ?? 0;
      return (
        <div style={{ ...btnStyles.grid1, flexDirection: 'column', gap: '12px' }}>
          <ActionButton
            label={canJump ? 'JUMP' : `${jumpCd.toFixed(1)}s`}
            color={canJump ? hex : '#555555'}
            size="large"
            onPress={() => pressButton('jump')}
            emoji={canJump ? '⬆️' : '⏳'}
          />
          <div style={{ fontSize: 12, opacity: 0.5, textAlign: 'center' }}>
            {aliveCount} alive · {activePlats} platforms
          </div>
        </div>
      );
    }

    case 'bullseye-bonanza':
      return (
        <div style={btnStyles.grid1}>
          <ActionButton label="THROW" color={hex} size="large" onPress={() => pressButton('throw')} emoji="🎯" />
        </div>
      );

    case 'kart-blitz': {
      const boostCooldown = (myPlayer?.data?.boostCooldown as number) ?? 0;
      const canBoost = boostCooldown <= 0;
      return (
        <div style={{ ...btnStyles.grid1, flexDirection: 'column', gap: '12px' }}>
          <ActionButton
            label={canBoost ? 'BOOST' : `${boostCooldown.toFixed(1)}s`}
            color={canBoost ? '#FF8C3B' : '#555555'}
            size="large"
            onPress={() => pressButton('boost')}
            emoji={canBoost ? '🔥' : '⏳'}
          />
          {myPlayer?.data?.speed !== undefined && (
            <div style={{ width: '140px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, ((myPlayer.data.speed as number) / 18) * 100)}%`,
                height: '100%',
                background: myPlayer.data.boosting ? '#FF8C3B' : '#3BFF6A',
                borderRadius: '4px',
                transition: 'width 0.1s',
              }} />
            </div>
          )}
        </div>
      );
    }

    case 'doodle-dash':
      return (
        <div style={btnStyles.grid2}>
          <ActionButton label="A" color="#3BFF6A" size="medium" onPress={() => pressButton('a')} />
          <ActionButton label="B" color="#FF3B3B" size="medium" onPress={() => pressButton('b')} />
          <ActionButton label="X" color="#3B8BFF" size="medium" onPress={() => pressButton('x')} />
          <ActionButton label="Y" color="#FFE03B" size="medium" onPress={() => pressButton('y')} />
        </div>
      );

    case 'obstacle-gauntlet':
      return (
        <div style={btnStyles.grid1}>
          <ActionButton label="JUMP" color={hex} size="large" onPress={() => pressButton('jump')} emoji="🦘" />
        </div>
      );

    case 'trivia-royale':
      return (
        <div style={btnStyles.grid2}>
          <ActionButton label="A" color="#3BFF6A" size="medium" onPress={() => pressButton('a')} />
          <ActionButton label="B" color="#FF3B3B" size="medium" onPress={() => pressButton('b')} />
          <ActionButton label="X" color="#3B8BFF" size="medium" onPress={() => pressButton('x')} />
          <ActionButton label="Y" color="#FFE03B" size="medium" onPress={() => pressButton('y')} />
        </div>
      );

    case 'rhythm-riot':
      return (
        <div style={btnStyles.grid2}>
          <ActionButton label="A" color="#3BFF6A" size="medium" onPress={() => pressButton('a')} />
          <ActionButton label="B" color="#FF3B3B" size="medium" onPress={() => pressButton('b')} />
          <ActionButton label="X" color="#3B8BFF" size="medium" onPress={() => pressButton('x')} />
          <ActionButton label="Y" color="#FFE03B" size="medium" onPress={() => pressButton('y')} />
        </div>
      );

    default:
      return (
        <div style={btnStyles.grid2}>
          <ActionButton label="A" color="#3BFF6A" size="medium" onPress={() => pressButton('a')} />
          <ActionButton label="B" color="#FF3B3B" size="medium" onPress={() => pressButton('b')} />
        </div>
      );
  }
}

interface ActionButtonProps {
  label: string;
  color: string;
  size: 'large' | 'medium' | 'small';
  onPress: () => void;
  emoji?: string;
}

function ActionButton({ label, color, size, onPress, emoji }: ActionButtonProps) {
  const sz = size === 'large' ? 140 : size === 'medium' ? 100 : 72;
  const fs = size === 'large' ? 18 : size === 'medium' ? 16 : 14;

  function handleTouch(e: React.TouchEvent) {
    e.preventDefault();
    onPress();
    // Haptic
    if ('vibrate' in navigator) navigator.vibrate(20);
  }

  return (
    <button
      onTouchStart={handleTouch}
      onClick={onPress}
      style={{
        width: sz,
        height: sz,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${color}dd, ${color}88)`,
        border: `3px solid ${color}`,
        color: 'white',
        fontSize: fs,
        fontWeight: 900,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        boxShadow: `0 0 20px ${color}66`,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        letterSpacing: '1px',
      }}
    >
      {emoji && <span style={{ fontSize: size === 'large' ? 28 : 20 }}>{emoji}</span>}
      {label}
    </button>
  );
}

const btnStyles: Record<string, React.CSSProperties> = {
  grid1: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    alignItems: 'center',
    justifyItems: 'center',
    padding: '16px',
  },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100dvh',
    background: '#0a0a1a',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: 'white',
    overflow: 'hidden',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid',
    flexShrink: 0,
  },
  myIndicator: {
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
  statusCenter: { flex: 1 },
  statusName: { fontSize: '16px', fontWeight: 700 },
  eliminatedText: { fontSize: '14px', color: '#FF3B3B', fontWeight: 700, letterSpacing: '2px' },
  timer: {
    fontSize: '24px',
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    transition: 'color 0.3s',
  },
  joystickArea: {
    flex: '1 1 55%',
    position: 'relative',
    background: 'rgba(255,255,255,0.02)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  joystickZone: {
    position: 'absolute',
    inset: 0,
    touchAction: 'none',
  },
  buttonArea: {
    flex: '1 1 45%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eliminatedScreen: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },
  eliminatedEmoji: { fontSize: '80px' },
  eliminatedTitle: { fontSize: '32px', fontWeight: 900, color: '#FF3B3B' },
  eliminatedHint: { fontSize: '16px', opacity: 0.5 },
};
