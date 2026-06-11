import { useEffect, useRef, useState, useCallback } from 'react';
import { Pause, Play, Trash2 } from 'lucide-react';
import type { BusFrame } from '@ieomlabs/shared';
import { socket } from '../../socket/client';
import { cn } from '../../utils/cn';

const MAX_FRAMES = 500;

function eventColor(event: string): string {
  const prefix = event.split(':')[0] ?? '';
  const map: Record<string, string> = {
    obs:     'text-[var(--color-warning-400)]',
    chat:    'text-[var(--color-success-400)]',
    scene:   'text-[var(--color-primary-400)]',
    overlay: 'text-[var(--color-primary-400)]',
    show:    'text-[var(--color-primary-300)]',
    bus:     'text-[var(--color-danger-400)]',
  };
  return map[prefix] ?? 'text-[var(--color-text-primary)]';
}

function fmtPayload(payload: unknown): string {
  try {
    const s = JSON.stringify(payload);
    return s.length > 140 ? s.slice(0, 140) + '…' : s;
  } catch {
    return String(payload);
  }
}

function fmtTime(t: number): string {
  const d = new Date(t);
  return (
    d.toLocaleTimeString('en-US', { hour12: false }) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  );
}

export function BusTracePage() {
  const [frames, setFrames] = useState<BusFrame[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const pausedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const handler = (incoming: BusFrame[]) => {
      if (pausedRef.current) return;
      setFrames((prev) => {
        const next = [...prev, ...incoming];
        return next.length > MAX_FRAMES ? next.slice(next.length - MAX_FRAMES) : next;
      });
    };

    const onConnect = () => {
      setConnected(true);
      socket.emit('bus:trace:subscribe');
    };
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('bus:trace:frames', handler);

    if (!socket.connected) {
      socket.connect();
    } else {
      setConnected(true);
      socket.emit('bus:trace:subscribe');
    }

    // beforeunload fires synchronously before the window closes; emit here
    // because the useEffect cleanup won't run on window close.
    const onBeforeUnload = () => socket.emit('bus:trace:unsubscribe');
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      socket.emit('bus:trace:unsubscribe');
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('bus:trace:frames', handler);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [frames, paused]);

  const handleClear = useCallback(() => setFrames([]), []);
  const togglePause = useCallback(() => setPaused((p) => !p), []);

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* Title bar */}
      <div className="flex items-center gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--color-border-subtle)] shrink-0">
        <span className="text-[var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
          Bus Trace
        </span>
        <span
          className={cn(
            'text-[9px] font-medium px-[5px] py-[1px] rounded',
            connected
              ? 'bg-[var(--color-success-400)]/15 text-[var(--color-success-400)]'
              : 'bg-[var(--color-danger-400)]/15 text-[var(--color-danger-400)]',
          )}
        >
          {connected ? 'connected' : 'disconnected'}
        </span>
        <div className="flex-1" />
        <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] tabular-nums">
          {frames.length} / {MAX_FRAMES}
        </span>
        <button
          onClick={togglePause}
          className="flex items-center gap-[var(--space-1)] text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-[var(--space-2)] py-[var(--space-1)] rounded hover:bg-[var(--color-bg-subtle)] transition-colors"
        >
          {paused
            ? <><Play className="h-3.5 w-3.5" /> Resume</>
            : <><Pause className="h-3.5 w-3.5" /> Pause</>}
        </button>
        <button
          onClick={handleClear}
          className="flex items-center gap-[var(--space-1)] text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-[var(--space-2)] py-[var(--space-1)] rounded hover:bg-[var(--color-bg-subtle)] transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </button>
      </div>

      {/* Pause warning */}
      {paused && (
        <div className="px-[var(--space-4)] py-[var(--space-2)] bg-[var(--color-warning-400)]/10 border-b border-[var(--color-warning-400)]/20 shrink-0">
          <span className="text-[var(--text-xs)] text-[var(--color-warning-400)]">
            Paused — incoming frames are dropped until resumed
          </span>
        </div>
      )}

      {/* Frame list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {frames.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-sm)] text-[var(--color-text-muted)]">
            Waiting for bus events…
          </div>
        ) : (
          <div className="p-2 space-y-[1px] font-mono text-[var(--text-xs)]">
            {frames.map((frame) => (
              <div
                key={frame.seq}
                className="flex items-baseline gap-[var(--space-2)] px-2 py-[3px] rounded hover:bg-[var(--color-bg-subtle)]"
              >
                <span className="shrink-0 w-9 text-right text-[10px] text-[var(--color-text-disabled)]">
                  #{frame.seq}
                </span>
                <span className="shrink-0 text-[10px] text-[var(--color-text-muted)] tabular-nums">
                  {fmtTime(frame.t)}
                </span>
                {frame.source != null && (
                  <span className="shrink-0 px-[5px] py-[1px] rounded text-[9px] bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
                    {frame.source}
                  </span>
                )}
                <span className={cn('shrink-0 font-semibold', eventColor(frame.event))}>
                  {frame.event}
                </span>
                <span className="truncate text-[var(--color-text-secondary)]">
                  {fmtPayload(frame.payload)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
