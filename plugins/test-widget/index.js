// Test plugin widget — minimal React component
// Served as a pre-bundled ES module from /plugins/test-widget/index.js
export default function TestWidget({ onClose }) {
  return (
    window.React?.createElement('div', { style: { padding: 16, fontFamily: 'monospace' } },
      window.React?.createElement('h3', null, '🔌 Test Plugin Widget'),
      window.React?.createElement('p', null, 'This widget was loaded from the plugins/ directory.'),
      window.React?.createElement('button', { onClick: onClose }, 'Close'),
    )
  )
}
