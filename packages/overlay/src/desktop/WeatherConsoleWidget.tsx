import { useEffect, useMemo, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'
import { WeatherConditionGlyph } from './WeatherConditionGlyph'
import { WeatherForecastMap } from './WeatherForecastMap'
import { dispatchWidgetSignal } from './widgetSimulationEvents'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const MODES = ['today', 'map', 'alerts'] as const

type ForecastIcon = 'sunny' | 'partly' | 'rain' | 'storm' | 'snow' | 'wind'

interface ForecastDay {
  day: string
  icon: ForecastIcon
  label: string
  high: number
  low: number
}

interface HourlyEntry {
  time: string
  temp: number
  icon: ForecastIcon
}

interface CityTemperature {
  name: string
  temp: number
  latitude: number
  longitude: number
}

interface WeatherSnapshot {
  location: string
  summary: string
  condition: string
  icon: ForecastIcon
  temperature: number
  apparentTemperature: number
  humidity: number
  pressure: number
  wind: number
  comfort: number
  updatedAt: string
  forecast: ForecastDay[]
  hourly: HourlyEntry[]
  cities: CityTemperature[]
  alerts: string[]
  mapNotes: Array<{ title: string; detail: string }>
}

const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

const REGION = {
  name: 'Tokyo Bay Region',
  latitude: 35.6764,
  longitude: 139.6500,
}

const MAP_CITIES = [
  { name: 'Tokyo', latitude: 35.6764, longitude: 139.6500 },
  { name: 'Sapporo', latitude: 43.0618, longitude: 141.3545 },
  { name: 'Naha', latitude: 26.2124, longitude: 127.6809 },
] as const

const FALLBACK_WEATHER: WeatherSnapshot = {
  location: REGION.name,
  summary: 'Forecast feed unavailable. Showing the last known desktop briefing style.',
  condition: 'Partly Cloudy',
  icon: 'partly',
  temperature: 24,
  apparentTemperature: 26,
  humidity: 61,
  pressure: 1008,
  wind: 10,
  comfort: 68,
  updatedAt: 'Offline fallback',
  forecast: [
    { day: 'Mon', icon: 'sunny', label: 'Sunny', high: 26, low: 19 },
    { day: 'Tue', icon: 'partly', label: 'Partly Cloudy', high: 24, low: 18 },
    { day: 'Wed', icon: 'rain', label: 'Showers', high: 20, low: 16 },
    { day: 'Thu', icon: 'storm', label: 'Thunderstorms', high: 18, low: 15 },
    { day: 'Fri', icon: 'sunny', label: 'Clear', high: 25, low: 17 },
  ],
  hourly: [
    { time: '12 PM', temp: 24, icon: 'sunny' },
    { time: '3 PM', temp: 25, icon: 'sunny' },
    { time: '6 PM', temp: 22, icon: 'partly' },
    { time: '9 PM', temp: 20, icon: 'rain' },
  ],
  cities: [
    { name: 'Tokyo', temp: 24, latitude: 35.6764, longitude: 139.6500 },
    { name: 'Sapporo', temp: 19, latitude: 43.0618, longitude: 141.3545 },
    { name: 'Naha', temp: 27, latitude: 26.2124, longitude: 127.6809 },
  ],
  alerts: [
    'Forecast service temporarily unavailable.',
    'Live weather data will resume when the API responds.',
    'Desktop map and daily outlook are using local fallback values.',
  ],
  mapNotes: [
    { title: 'Tokyo', detail: 'Conditions are being held on fallback data.' },
    { title: 'Sapporo', detail: 'Regional comparison will update on next successful sync.' },
    { title: 'Naha', detail: 'Live warm-coast readings are temporarily unavailable.' },
  ],
}

function getForecastIcon(icon: ForecastIcon) {
  if (icon === 'sunny') return 'Sun'
  if (icon === 'partly') return 'Partly'
  if (icon === 'rain') return 'Rain'
  if (icon === 'snow') return 'Snow'
  if (icon === 'wind') return 'Wind'
  return 'Storm'
}

function getWeatherDescriptor(code: number): { label: string; icon: ForecastIcon } {
  if (code === 0) return { label: 'Clear', icon: 'sunny' }
  if (code === 1 || code === 2) return { label: 'Partly Cloudy', icon: 'partly' }
  if (code === 3 || code === 45 || code === 48) return { label: 'Cloudy', icon: 'partly' }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'Rain', icon: 'rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Snow', icon: 'snow' }
  if (code === 95 || code === 96 || code === 99) return { label: 'Thunderstorms', icon: 'storm' }
  return { label: 'Windy', icon: 'wind' }
}

function formatDayLabel(dateText: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(dateText))
}

function formatHourLabel(dateText: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).format(new Date(dateText))
}

function formatUpdatedAt(dateText: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateText))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function buildAlerts(condition: string, wind: number, humidity: number, forecast: ForecastDay[]) {
  const alerts: string[] = []

  if (condition === 'Rain' || condition === 'Thunderstorms') {
    alerts.push(`${condition} active in the current observation window.`)
  }

  if (wind >= 25) {
    alerts.push(`Breezy conditions with sustained winds near ${wind} km/h.`)
  }

  if (humidity >= 78) {
    alerts.push(`High humidity at ${humidity}% may make conditions feel heavier.`)
  }

  const coolestDay = forecast.reduce((lowest, item) => (item.low < lowest.low ? item : lowest), forecast[0])
  const warmestDay = forecast.reduce((highest, item) => (item.high > highest.high ? item : highest), forecast[0])

  alerts.push(`Coolest overnight low: ${coolestDay.day} at ${coolestDay.low}°.`)
  alerts.push(`Warmest daytime high: ${warmestDay.day} at ${warmestDay.high}°.`)

  return alerts.slice(0, 3)
}

async function fetchRegionWeather(signal: AbortSignal): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(REGION.latitude),
    longitude: String(REGION.longitude),
    timezone: 'auto',
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'surface_pressure',
      'wind_speed_10m',
      'weather_code',
    ].join(','),
    hourly: ['temperature_2m', 'weather_code'].join(','),
    daily: ['weather_code', 'temperature_2m_max', 'temperature_2m_min'].join(','),
    forecast_days: '5',
  })

  const [regionResponse, cityResponses] = await Promise.all([
    fetch(`${WEATHER_ENDPOINT}?${params.toString()}`, { signal }),
    Promise.all(
      MAP_CITIES.map(async (city) => {
        const cityParams = new URLSearchParams({
          latitude: String(city.latitude),
          longitude: String(city.longitude),
          timezone: 'auto',
          current: 'temperature_2m',
        })
        const response = await fetch(`${WEATHER_ENDPOINT}?${cityParams.toString()}`, { signal })
        if (!response.ok) {
          throw new Error(`Failed to fetch city weather for ${city.name}`)
        }
        return response.json()
      }),
    ),
  ])

  if (!regionResponse.ok) {
    throw new Error('Failed to fetch regional weather data')
  }

  const regionData = await regionResponse.json() as {
    current: {
      time: string
      temperature_2m: number
      apparent_temperature: number
      relative_humidity_2m: number
      surface_pressure: number
      wind_speed_10m: number
      weather_code: number
    }
    hourly: {
      time: string[]
      temperature_2m: number[]
      weather_code: number[]
    }
    daily: {
      time: string[]
      weather_code: number[]
      temperature_2m_max: number[]
      temperature_2m_min: number[]
    }
  }

  const currentDescriptor = getWeatherDescriptor(regionData.current.weather_code)
  const forecast = regionData.daily.time.map((dateText, index) => {
    const descriptor = getWeatherDescriptor(regionData.daily.weather_code[index] ?? 0)
    return {
      day: formatDayLabel(dateText),
      icon: descriptor.icon,
      label: descriptor.label,
      high: Math.round(regionData.daily.temperature_2m_max[index] ?? 0),
      low: Math.round(regionData.daily.temperature_2m_min[index] ?? 0),
    }
  })

  const currentHourIndex = Math.max(0, regionData.hourly.time.findIndex((entry) => entry === regionData.current.time))
  const hourly = regionData.hourly.time.slice(currentHourIndex, currentHourIndex + 4).map((dateText, index) => {
    const actualIndex = currentHourIndex + index
    const descriptor = getWeatherDescriptor(regionData.hourly.weather_code[actualIndex] ?? regionData.current.weather_code)
    return {
      time: formatHourLabel(dateText),
      temp: Math.round(regionData.hourly.temperature_2m[actualIndex] ?? regionData.current.temperature_2m),
      icon: descriptor.icon,
    }
  })

  const cities = cityResponses.map((cityData, index) => ({
    name: MAP_CITIES[index].name,
    temp: Math.round((cityData as { current?: { temperature_2m?: number } }).current?.temperature_2m ?? 0),
    latitude: MAP_CITIES[index].latitude,
    longitude: MAP_CITIES[index].longitude,
  }))

  const wind = Math.round(regionData.current.wind_speed_10m)
  const humidity = Math.round(regionData.current.relative_humidity_2m)
  const comfort = clamp(Math.round(100 - Math.abs(regionData.current.apparent_temperature - 22) * 6 - Math.max(0, humidity - 60) * 0.35), 28, 96)

  return {
    location: REGION.name,
    summary: `${currentDescriptor.label} across ${REGION.name} with ${wind < 14 ? 'light' : wind < 24 ? 'moderate' : 'strong'} winds through the latest forecast window.`,
    condition: currentDescriptor.label,
    icon: currentDescriptor.icon,
    temperature: Math.round(regionData.current.temperature_2m),
    apparentTemperature: Math.round(regionData.current.apparent_temperature),
    humidity,
    pressure: Math.round(regionData.current.surface_pressure),
    wind,
    comfort,
    updatedAt: formatUpdatedAt(regionData.current.time),
    forecast,
    hourly,
    cities,
    alerts: buildAlerts(currentDescriptor.label, wind, humidity, forecast),
    mapNotes: cities.map((city) => ({
      title: city.name,
      detail: `${city.temp}° with ${city.temp > Math.round(regionData.current.temperature_2m) ? 'warmer' : city.temp < Math.round(regionData.current.temperature_2m) ? 'cooler' : 'matching'} conditions than central Tokyo.`,
    })),
  }
}

export function WeatherConsoleWidget({ appId, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props & { appId: string }) {
  const [mode, setMode] = useState<(typeof MODES)[number]>('today')
  const [tick, setTick] = useState(0)
  const [weather, setWeather] = useState<WeatherSnapshot>(FALLBACK_WEATHER)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const timer = window.setInterval(() => setTick((prev) => prev + 1), 180)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const loadWeather = async () => {
      try {
        setStatus('loading')
        const nextWeather = await fetchRegionWeather(controller.signal)
        setWeather(nextWeather)
        setStatus('ready')
        dispatchWidgetSignal({ source: appId, event: 'weather:update', payload: { condition: nextWeather.condition } })
        if (nextWeather.icon === 'storm') dispatchWidgetSignal({ source: appId, event: 'weather:storm' })
        if (nextWeather.icon === 'sunny') dispatchWidgetSignal({ source: appId, event: 'weather:clear' })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        console.error('Weather widget failed to load live forecast data', error)
        setWeather(FALLBACK_WEATHER)
        setStatus('error')
      }
    }

    void loadWeather()
    const refreshTimer = window.setInterval(() => void loadWeather(), 1000 * 60 * 15)

    return () => {
      controller.abort()
      window.clearInterval(refreshTimer)
    }
  }, [])

  const pressure = weather.pressure
  const humidity = weather.humidity
  const wind = weather.wind
  const comfort = weather.comfort
  const dayPhase = (Math.sin(tick / 12) + 1) / 2
  const statusCopy = useMemo(() => {
    if (status === 'loading') return 'Syncing live forecast data'
    if (status === 'error') return 'Fallback weather briefing'
    return `Updated ${weather.updatedAt}`
  }, [status, weather.updatedAt])
  const modeIndex = MODES.indexOf(mode)

  const shiftMode = (direction: -1 | 1) => {
    const nextIndex = (modeIndex + direction + MODES.length) % MODES.length
    setMode(MODES[nextIndex])
  }

  return (
    <DesktopWindow
      id="weather"
      title="Forecast Channel"
      width={500}
      defaultPosition={{ x: 346, y: 140 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--weather-center"
      bodyClassName="desktop-window-body--weather-center"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px', minHeight: '540px', minWidth: 'min(500px, calc(100vw - 48px))' }}
    >
      <div className="widget-stack widget-stack--fill">
        <div className="widget-panel widget-panel--display widget-panel--weather-center">
          <div className="widget-forecast-shell">
            <div className="widget-forecast-hero">
              <div className="widget-forecast-brand">
                <span className="widget-forecast-channel">Forecast Channel</span>
                <span className="widget-forecast-location">{weather.location}</span>
                <span className="widget-forecast-summary">{weather.summary}</span>
              </div>
              <div className="widget-forecast-current">
                <span className="widget-forecast-temp">{weather.temperature}&deg;</span>
                <span className="widget-forecast-condition">{weather.condition}</span>
                <span className="widget-forecast-meta">Feels like {weather.apparentTemperature}&deg; / Humidity {humidity}%</span>
              </div>
            </div>

            <div className="widget-forecast-layout">
              <div className="widget-forecast-mapcard">
                <div className="widget-forecast-mapheader">
                  <span className="widget-forecast-maplabel">Regional Forecast Map</span>
                  <span className="widget-forecast-maptime">{statusCopy}</span>
                </div>

                <div className="widget-forecast-mapstage">
                  <WeatherForecastMap cities={weather.cities} />
                  <span className="widget-forecast-glow widget-forecast-glow--sun" style={{ opacity: 0.3 + dayPhase * 0.4 }} />
                  <span className="widget-forecast-glow widget-forecast-glow--sea" />
                  <span className="widget-forecast-mapveil" />
                  <span className="widget-forecast-mapattribution">Map data © OpenStreetMap</span>
                </div>

                <div className="widget-forecast-hourly">
                  {weather.hourly.map((entry) => (
                    <div key={entry.time} className="widget-forecast-hourcard">
                      <span>{entry.time}</span>
                      <strong>{entry.temp}&deg;</strong>
                      <span>{getForecastIcon(entry.icon)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="widget-forecast-sidepanel">
                <div className="widget-forecast-sidepanel-header">
                  <div className="widget-forecast-sidepanel-headingcopy">
                    <span className="widget-forecast-sidepanel-title">{mode === 'today' ? 'Today' : mode === 'map' ? 'Map Details' : 'Weather Notices'}</span>
                    <span className="widget-forecast-sidepanel-copy">{status === 'ready' ? 'Live forecast briefing' : 'Wii-style channel briefing'}</span>
                  </div>
                  <div className="widget-forecast-panelnav" aria-label="Forecast panel navigation">
                    <button type="button" className="widget-forecast-panelnav-button" onClick={() => shiftMode(-1)} aria-label="Previous panel">
                      &#8249;
                    </button>
                    <div className="widget-forecast-panelnav-copy">
                      <span className="widget-forecast-panelnav-label">Panel</span>
                      <strong className="widget-forecast-panelnav-mode">{mode}</strong>
                    </div>
                    <button type="button" className="widget-forecast-panelnav-button" onClick={() => shiftMode(1)} aria-label="Next panel">
                      &#8250;
                    </button>
                  </div>
                </div>

                {mode === 'today' && (
                  <div className="widget-forecast-todaypanel">
                    <div className={`widget-forecast-bigicon widget-forecast-bigicon--${weather.icon}`}>
                      <WeatherConditionGlyph icon={weather.icon} />
                    </div>
                    <div className="widget-forecast-statline"><span>Pressure</span><strong>{pressure} hPa</strong></div>
                    <div className="widget-forecast-statline"><span>Wind</span><strong>{wind} km/h</strong></div>
                    <div className="widget-forecast-statline"><span>Comfort</span><strong>{comfort}%</strong></div>
                  </div>
                )}

                {mode === 'map' && (
                  <div className="widget-forecast-mapnotes">
                    {weather.mapNotes.map((note) => (
                      <div key={note.title} className="widget-forecast-note">
                        <strong>{note.title}</strong>
                        <span>{note.detail}</span>
                      </div>
                    ))}
                  </div>
                )}

                {mode === 'alerts' && (
                  <div className="widget-forecast-alertlist">
                    {weather.alerts.map((alert, index) => (
                      <div key={alert} className={`widget-forecast-alert${index === 0 ? ' widget-forecast-alert--primary' : ''}`}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="widget-forecast-footerstats">
                  <div className="widget-forecast-footercard">
                    <span>Humidity</span>
                    <strong>{humidity}%</strong>
                  </div>
                  <div className="widget-forecast-footercard">
                    <span>Wind</span>
                    <strong>{wind} km/h</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="widget-forecast-bottombar">
              {weather.forecast.map((item) => (
                <button key={item.day} type="button" className="widget-forecast-mini">
                  <span>{item.day}</span>
                  <strong>{item.high}&deg;</strong>
                  <span>{getForecastIcon(item.icon)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DesktopWindow>
  )
}