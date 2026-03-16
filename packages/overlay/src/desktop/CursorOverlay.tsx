import React, { useEffect, useRef, useState } from 'react';
import winCursor from './assets/win98-cursor.svg';
import { socket } from '../socket/client';

export interface CursorOverlayController {
  moveTo: (x: number, y: number, options?: { duration?: number }) => Promise<void>;
  click: () => Promise<void>;
  setVisible: (visible: boolean) => void;
}

export const CursorOverlayContext = React.createContext<CursorOverlayController | null>(null);

export function CursorOverlayProvider({ children }: { children: React.ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [clickAnim, setClickAnim] = useState(false);
  const moveResolve = useRef<(() => void) | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const isSimulationLeaderRef = useRef(false);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    const updateLeaderStatus = (payload: { socketId: string | null }) => {
      isSimulationLeaderRef.current = !!payload.socketId && payload.socketId === socket.id;
    };

    socket.on('ambiance:leader', updateLeaderStatus);
    return () => {
      socket.off('ambiance:leader', updateLeaderStatus);
    };
  }, []);

  // Expose controller
  const controller = useRef<CursorOverlayController>({
    moveTo: (x, y, { duration = 600 } = {}) => {
      setVisible(true);
      if (!(window as any).__cursorMirrorApplying && isSimulationLeaderRef.current) {
        socket.emit('cursor:mirror', { kind: 'move', x, y, duration });
      }
      return new Promise<void>((resolve) => {
        const start = { ...posRef.current };
        const dx = x - start.x;
        const dy = y - start.y;
        const startTime = performance.now();
        function animate(now: number) {
          const t = Math.min(1, (now - startTime) / duration);
          setPos({ x: start.x + dx * t, y: start.y + dy * t });
          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            setPos({ x, y });
            resolve();
          }
        }
        requestAnimationFrame(animate);
      });
    },
    click: () => {
      setClickAnim(true);
      if (!(window as any).__cursorMirrorApplying && isSimulationLeaderRef.current) {
        socket.emit('cursor:mirror', { kind: 'click' });
      }
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          setClickAnim(false);
          resolve();
        }, 180);
      });
    },
    setVisible: (v) => {
      setVisible(v)
      if (!(window as any).__cursorMirrorApplying && isSimulationLeaderRef.current) {
        socket.emit('cursor:mirror', { kind: 'visible', visible: v });
      }
    },
  });

  useEffect(() => {
    (window as any).__cursorOverlayController = controller.current
    return () => {
      delete (window as any).__cursorOverlayController
    }
  }, [])

  return (
    <CursorOverlayContext.Provider value={controller.current}>
      {children}
      {visible && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            width: 24,
            height: 24,
            pointerEvents: 'none',
            zIndex: 99999,
            transform: 'translate(-2px, -1px)',
          }}
        >
          <img
            src={winCursor}
            alt="Simulated cursor"
            width={24}
            height={24}
            style={{ display: 'block', filter: 'drop-shadow(1px 1px 0 rgba(0,0,0,0.45))' }}
          />
          {clickAnim && (
            <div
              style={{
                position: 'absolute',
                left: -6,
                top: -6,
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: '2px solid rgba(0, 255, 255, 0.65)',
                boxShadow: '0 0 8px rgba(0, 255, 255, 0.45)',
              }}
            />
          )}
        </div>
      )}
    </CursorOverlayContext.Provider>
  );
}
