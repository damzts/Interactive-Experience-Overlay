interface Props {
  icon: 'sunny' | 'partly' | 'rain' | 'storm' | 'snow' | 'wind'
}

export function WeatherConditionGlyph({ icon }: Props) {
  if (icon === 'sunny') {
    return (
      <svg className="widget-forecast-glyph" viewBox="0 0 64 64" aria-hidden="true">
        <g className="widget-forecast-glyph-sun-rays">
          <line x1="32" y1="4" x2="32" y2="14" />
          <line x1="32" y1="50" x2="32" y2="60" />
          <line x1="4" y1="32" x2="14" y2="32" />
          <line x1="50" y1="32" x2="60" y2="32" />
          <line x1="12" y1="12" x2="19" y2="19" />
          <line x1="45" y1="45" x2="52" y2="52" />
          <line x1="12" y1="52" x2="19" y2="45" />
          <line x1="45" y1="19" x2="52" y2="12" />
        </g>
        <circle className="widget-forecast-glyph-sun-core" cx="32" cy="32" r="13" />
      </svg>
    )
  }

  if (icon === 'partly') {
    return (
      <svg className="widget-forecast-glyph" viewBox="0 0 64 64" aria-hidden="true">
        <circle className="widget-forecast-glyph-sun-core widget-forecast-glyph-sun-core--small" cx="24" cy="24" r="10" />
        <g className="widget-forecast-glyph-cloud widget-forecast-glyph-cloud--drift">
          <circle cx="24" cy="38" r="9" />
          <circle cx="34" cy="34" r="11" />
          <circle cx="45" cy="39" r="8" />
          <rect x="19" y="38" width="31" height="11" rx="5.5" />
        </g>
      </svg>
    )
  }

  if (icon === 'rain') {
    return (
      <svg className="widget-forecast-glyph" viewBox="0 0 64 64" aria-hidden="true">
        <g className="widget-forecast-glyph-cloud">
          <circle cx="24" cy="26" r="9" />
          <circle cx="34" cy="22" r="11" />
          <circle cx="45" cy="27" r="8" />
          <rect x="19" y="26" width="31" height="11" rx="5.5" />
        </g>
        <line className="widget-forecast-glyph-drop widget-forecast-glyph-drop--one" x1="22" y1="42" x2="18" y2="54" />
        <line className="widget-forecast-glyph-drop widget-forecast-glyph-drop--two" x1="32" y1="42" x2="28" y2="56" />
        <line className="widget-forecast-glyph-drop widget-forecast-glyph-drop--three" x1="42" y1="42" x2="38" y2="54" />
      </svg>
    )
  }

  if (icon === 'storm') {
    return (
      <svg className="widget-forecast-glyph" viewBox="0 0 64 64" aria-hidden="true">
        <g className="widget-forecast-glyph-cloud widget-forecast-glyph-cloud--storm">
          <circle cx="24" cy="24" r="9" />
          <circle cx="34" cy="20" r="11" />
          <circle cx="45" cy="25" r="8" />
          <rect x="19" y="24" width="31" height="11" rx="5.5" />
        </g>
        <polyline className="widget-forecast-glyph-bolt" points="33,36 26,48 33,48 29,58 41,43 34,43 38,36" />
      </svg>
    )
  }

  if (icon === 'snow') {
    return (
      <svg className="widget-forecast-glyph" viewBox="0 0 64 64" aria-hidden="true">
        <g className="widget-forecast-glyph-cloud">
          <circle cx="24" cy="24" r="9" />
          <circle cx="34" cy="20" r="11" />
          <circle cx="45" cy="25" r="8" />
          <rect x="19" y="24" width="31" height="11" rx="5.5" />
        </g>
        <g className="widget-forecast-glyph-snowflake widget-forecast-glyph-snowflake--one">
          <line x1="21" y1="42" x2="21" y2="52" />
          <line x1="16" y1="47" x2="26" y2="47" />
        </g>
        <g className="widget-forecast-glyph-snowflake widget-forecast-glyph-snowflake--two">
          <line x1="32" y1="42" x2="32" y2="54" />
          <line x1="26" y1="48" x2="38" y2="48" />
        </g>
        <g className="widget-forecast-glyph-snowflake widget-forecast-glyph-snowflake--three">
          <line x1="43" y1="42" x2="43" y2="52" />
          <line x1="38" y1="47" x2="48" y2="47" />
        </g>
      </svg>
    )
  }

  return (
    <svg className="widget-forecast-glyph" viewBox="0 0 64 64" aria-hidden="true">
      <path className="widget-forecast-glyph-wind widget-forecast-glyph-wind--one" d="M12 24h26c5 0 7-6 2-8" />
      <path className="widget-forecast-glyph-wind widget-forecast-glyph-wind--two" d="M8 34h36c6 0 8 7 1 9" />
      <path className="widget-forecast-glyph-wind widget-forecast-glyph-wind--three" d="M18 45h22c6 0 6 6 1 7" />
    </svg>
  )
}