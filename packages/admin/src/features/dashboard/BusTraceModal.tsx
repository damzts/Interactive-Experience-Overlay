import { useEffect, useRef, useState, useCallback } from 'react';
import { Pause, Play, Trash2 } from 'lucide-react';
import type { BusFrame } from '@ieomlabs/shared';
import { socket } from '../../socket/client';
import { Modal } from '../../components/organisms/Modal';
import { Button } from '../../components/atoms/Button';
import { cn } from '../../utils/cn';

const MAX_FRAMES = 500;

function eventColor(event: string): string {
  const prefix = event.split(':')[0] ?? '';
  const map: Record<string, string> = {
    obs:      'text-[var(--color-warning-400)]',
    chat:     'text-[var(--color-success-400)]',
    scene:    'text-[var(--color-primary-400)]',
    overlay:  'text-[var(--color-primary-400)]',
    show:     'text-[var(--color-primary-300)]',
    bus:      'text-[var(--color-danger-400)]',
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

interface BusTraceModalProps {
  open: boolean;
  onClose: () => void;
}

export function BusTraceModal({ open, onClose }: BusTraceModalProps) {
  const [frames, setFrames] = useState<BusFrame[]>([]);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync so the socket callback closure always reads the current value
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    if (!open) return;
    setFrames([]);
    setPaused(false);

    const handler = (incoming: BusFrame[]) => {
      if (pausedRef.current) return;
      setFrames((prev) => {
        const next = [...prev, ...incoming];
        return next.length > MAX_FRAMES ? next.slice(next.length - MAX_FRAMES) : next;
      });
    };

    socket.emit('bus:trace:subscribe');
    socket.on('bus:trace:frames', handler);

    return () => {
      socket.emit('bus:trace:unsubscribe');
      socket.off('bus:trace:frames', handler);
    };
  }, [open]);

  // Auto-scroll to bottom on new frames when not paused
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [frames, paused]);

  const handleClear = useCallback(() => setFrames([]), []);
  const togglePause = useCallback(() => setPaused((p) => !p), []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bus Trace"
      className="max-w-4xl"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-3)]">
        <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] tabular-nums">
          {frames.length} / {MAX_FRAMES} frames
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          icon={paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          onClick={togglePause}
        >
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={handleClear}
        >
          Clear
        </Button>
      </div>

      {/* Frame list */}
      <div
        ref={scrollRef}
        className="overflow-y-auto rounded-[var(--radius-md)] bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)]"
        style={{ height: '60vh' }}
      >
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
                {/* seq */}
                <span className="shrink-0 w-9 text-right text-[10px] text-[var(--color-text-disabled)]">
                  #{frame.seq}
                </span>
                {/* timestamp */}
                <span className="shrink-0 text-[10px] text-[var(--color-text-muted)] tabular-nums">
                  {fmtTime(frame.t)}
                </span>
                {/* source badge */}
                {frame.source != null && (
                  <span className="shrink-0 px-[5px] py-[1px] rounded text-[9px] bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
                    {frame.source}
                  </span>
                )}
                {/* event */}
                <span className={cn('shrink-0 font-semibold', eventColor(frame.event))}>
                  {frame.event}
                </span>
                {/* payload */}
                <span className="truncate text-[var(--color-text-secondary)]">
                  {fmtPayload(frame.payload)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {paused && (
        <p className="mt-[var(--space-2)] text-[var(--text-xs)] text-[var(--color-warning-400)] text-center">
          Paused — incoming frames are dropped until resumed
        </p>
      )}
    </Modal>
  );
}
