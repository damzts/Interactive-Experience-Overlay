interface AppGlyphProps {
  icon: string
  label: string
  size: number
  className?: string
}

function looksLikeImageIcon(icon: string) {
  if (!icon) return false
  if (icon.startsWith('data:image/')) return true
  if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(icon) && /(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(icon)) {
    return true
  }
  return icon.startsWith('/assets/') || icon.startsWith('/media/')
}

export function AppGlyph({ icon, label, size, className = '' }: AppGlyphProps) {
  if (looksLikeImageIcon(icon)) {
    return (
      <img
        src={icon}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={className}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    )
  }

  return (
    <span className={className} role="img" aria-label={label} style={{ fontSize: size }}>
      {icon}
    </span>
  )
}