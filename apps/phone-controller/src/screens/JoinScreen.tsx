import React, { useState, useRef } from 'react';
import { PlayerColor, COLOR_HEX, PLAYER_COLORS } from '@party-blast/shared';

interface JoinScreenProps {
  onJoin: (code: string, name: string, color: PlayerColor) => void;
  error: string | null;
  connecting: boolean;
  prefillCode?: string;
}

export function JoinScreen({ onJoin, error, connecting, prefillCode }: JoinScreenProps) {
  const [code, setCode] = useState(prefillCode ?? '');
  const [name, setName] = useState('');
  const [color, setColor] = useState<PlayerColor>('red');
  const [step, setStep] = useState<'code' | 'name'>(prefillCode ? 'name' : 'code');

  const nameRef = useRef<HTMLInputElement>(null);

  function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length >= 4) setStep('name');
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length === 0) return;
    onJoin(code.toUpperCase(), name.trim(), color);
  }

  return (
    <div style={styles.container}>
      <div style={styles.logo}>PARTY BLAST</div>
      <div style={styles.tagline}>Mobile Controller</div>

      {step === 'code' ? (
        <form onSubmit={handleCodeSubmit} style={styles.form}>
          <div style={styles.label}>Enter Room Code</div>
          <input
            style={styles.codeInput}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="XXXX"
            maxLength={4}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
          />
          <button
            type="submit"
            style={{ ...styles.btn, opacity: code.length >= 4 ? 1 : 0.4 }}
            disabled={code.length < 4}
          >
            NEXT
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} style={styles.form}>
          <div style={styles.roomCodeBadge}>Room: <strong>{code}</strong></div>

          <div style={styles.label}>Your Name</div>
          <input
            ref={nameRef}
            style={styles.nameInput}
            value={name}
            onChange={e => setName(e.target.value.slice(0, 12))}
            placeholder="Enter name..."
            maxLength={12}
            autoFocus
            autoComplete="off"
          />

          <div style={styles.label}>Pick Your Color</div>
          <div style={styles.colorGrid}>
            {PLAYER_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  ...styles.colorBtn,
                  background: COLOR_HEX[c],
                  transform: color === c ? 'scale(1.25)' : 'scale(1)',
                  boxShadow: color === c ? `0 0 16px ${COLOR_HEX[c]}` : 'none',
                  border: color === c ? '3px solid white' : '3px solid transparent',
                }}
              />
            ))}
          </div>

          <div style={{ ...styles.colorPreview, background: COLOR_HEX[color] }}>
            {name.charAt(0).toUpperCase() || '?'}
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            style={{
              ...styles.btn,
              background: COLOR_HEX[color],
              opacity: name.trim().length > 0 && !connecting ? 1 : 0.4,
            }}
            disabled={name.trim().length === 0 || connecting}
          >
            {connecting ? 'JOINING...' : 'JOIN GAME'}
          </button>

          <button type="button" style={styles.backBtn} onClick={() => setStep('code')}>
            Back
          </button>
        </form>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100dvh',
    background: 'radial-gradient(ellipse at top, #1a0533 0%, #0a0a1a 70%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    gap: '8px',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: 'white',
  },
  logo: {
    fontSize: '48px',
    fontWeight: 900,
    background: 'linear-gradient(135deg, #FF3BB0, #C03BFF, #3B8BFF)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-1px',
    marginBottom: '4px',
  },
  tagline: {
    fontSize: '14px',
    opacity: 0.5,
    letterSpacing: '4px',
    textTransform: 'uppercase',
    marginBottom: '32px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    width: '100%',
    maxWidth: '320px',
  },
  label: {
    fontSize: '13px',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    alignSelf: 'flex-start',
  },
  codeInput: {
    width: '100%',
    padding: '20px',
    fontSize: '48px',
    fontWeight: 900,
    textAlign: 'center',
    letterSpacing: '16px',
    background: 'rgba(255,255,255,0.08)',
    border: '2px solid rgba(255,255,255,0.2)',
    borderRadius: '16px',
    color: '#FFE03B',
    outline: 'none',
    textTransform: 'uppercase',
    caretColor: '#FFE03B',
  },
  nameInput: {
    width: '100%',
    padding: '16px',
    fontSize: '24px',
    fontWeight: 700,
    textAlign: 'center',
    background: 'rgba(255,255,255,0.08)',
    border: '2px solid rgba(255,255,255,0.2)',
    borderRadius: '16px',
    color: 'white',
    outline: 'none',
  },
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    width: '100%',
  },
  colorBtn: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  colorPreview: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    fontWeight: 900,
    color: 'rgba(0,0,0,0.5)',
    border: '4px solid rgba(255,255,255,0.3)',
  },
  btn: {
    width: '100%',
    padding: '18px',
    fontSize: '20px',
    fontWeight: 900,
    letterSpacing: '2px',
    background: '#C03BFF',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: '8px',
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '8px',
  },
  roomCodeBadge: {
    fontSize: '18px',
    padding: '8px 20px',
    background: 'rgba(255,224,59,0.1)',
    border: '1px solid rgba(255,224,59,0.3)',
    borderRadius: '8px',
    color: '#FFE03B',
    letterSpacing: '2px',
  },
  error: {
    color: '#FF3B3B',
    fontSize: '14px',
    textAlign: 'center',
    background: 'rgba(255,59,59,0.1)',
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,59,59,0.3)',
    width: '100%',
  },
};
