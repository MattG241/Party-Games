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
          ) : (
            <div style={styles.statusName}>{myPlayer?.name}</div>
          )}
        </div>
        <div style={{ ...styles.timer, color: isUrgent ? '#FF3B3B' : 'white' }}>
          {timerStr}
        </div>
      </div>

      {isEliminated ? (
        <div style={styles.eliminatedScreen}>
          <div style={styles.eliminatedEmoji}>💀</div>
          <div style={styles.eliminatedTitle}>You're out!</div>
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
            {renderButtons(gameId, hex, pressButton)}
          </div>
        </>
      )}
    </div>
  );
}

function renderButtons(
  gameId: GameId,
  hex: string,
  pressButton: (name: string) => void
): React.ReactNode {
  switch (gameId) {
    case 'arena-ball':
      return (
        <div style={btnStyles.grid1}>
          <ActionButton label="DASH" color={hex} size="large" onPress={() => pressButton('dash')} />
        </div>
      );

    case 'bomb-tag':
      return (
        <div style={btnStyles.grid1}>
          <ActionButton label="TAG" color="#FF3B3B" size="large" onPress={() => pressButton('tag')} emoji="💣" />
        </div>
      );

    case 'sumo-smash':
      return (
        <div style={btnStyles.grid1}>
          <ActionButton label="CHARGE" color={hex} size="large" onPress={() => pressButton('charge')} emoji="💥" />
        </div>
      );

    case 'platform-panic':
      return (
        <div style={btnStyles.grid1}>
          <ActionButton label="JUMP" color={hex} size="large" onPress={() => pressButton('jump')} emoji="⬆️" />
        </div>
      );

    case 'bullseye-bonanza':
      return (
        <div style={btnStyles.grid1}>
          <ActionButton label="THROW" color={hex} size="large" onPress={() => pressButton('throw')} emoji="🎯" />
        </div>
      );

    case 'kart-blitz':
      return (
        <div style={btnStyles.grid1}>
          <ActionButton label="BOOST" color="#FF8C3B" size="large" onPress={() => pressButton('boost')} emoji="🔥" />
        </div>
      );

    case 'doodle-dash':
      return (
        <div style={btnStyles.grid1}>
          <ActionButton label="GUESS" color="#3BFF6A" size="large" onPress={() => pressButton('a')} emoji="✅" />
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
