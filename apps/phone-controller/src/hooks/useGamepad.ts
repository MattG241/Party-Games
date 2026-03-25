import { useEffect, useRef, useCallback } from 'react';
import nipplejs, { JoystickManager, JoystickOutputData } from 'nipplejs';
import { GameId } from '@party-blast/shared';
import { INPUT_RATE } from '@party-blast/shared';

interface GamepadState {
  joystick: { x: number; y: number };
  buttons: Record<string, boolean>;
}

type InputSender = (data: GamepadState) => void;

export function useGamepad(containerRef: React.RefObject<HTMLElement | null>, onInput: InputSender) {
  const stateRef = useRef<GamepadState>({ joystick: { x: 0, y: 0 }, buttons: {} });
  const managerRef = useRef<JoystickManager | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const zone = el.querySelector<HTMLElement>('[data-joystick-zone]');
    if (!zone) return;

    managerRef.current = nipplejs.create({
      zone,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: 'white',
      size: 120,
      restOpacity: 0.5,
    });

    managerRef.current.on('move', (_evt, data: JoystickOutputData) => {
      if (data.vector) {
        stateRef.current.joystick = { x: data.vector.x, y: -data.vector.y };
      }
    });

    managerRef.current.on('end', () => {
      stateRef.current.joystick = { x: 0, y: 0 };
    });

    // Send input at INPUT_RATE hz
    intervalRef.current = setInterval(() => {
      onInputRef.current(stateRef.current);
    }, 1000 / INPUT_RATE);

    return () => {
      managerRef.current?.destroy();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [containerRef]);

  const pressButton = useCallback((name: string) => {
    stateRef.current.buttons[name] = true;
    setTimeout(() => {
      stateRef.current.buttons[name] = false;
    }, 100);
  }, []);

  const holdButton = useCallback((name: string, held: boolean) => {
    stateRef.current.buttons[name] = held;
  }, []);

  return { pressButton, holdButton };
}
