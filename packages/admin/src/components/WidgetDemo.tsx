import React, { useRef, useState } from 'react';

export function WidgetDemo() {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState(false);

  const handleWidgetAction = () => {
    setFeedback(true);
    setTimeout(() => setFeedback(false), 1200);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={widgetRef}
        style={{ width: 100, height: 100, background: feedback ? '#7fffd4' : 'lightblue', margin: 40, transition: 'background 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
      >
        Widget
        {feedback && (
          <span style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '4px 12px',
            borderRadius: 6,
            fontSize: 14,
            pointerEvents: 'none',
            zIndex: 2,
          }}>
            Used!
          </span>
        )}
      </div>
      {/* WidgetSimulator removed */}
    </div>
  );
}
