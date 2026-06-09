import { useEffect, useRef } from 'react'

interface MapCity {
  name: string
  temp: number
  latitude: number
  longitude: number
}

interface Props {
  cities: MapCity[]
}

const WEATHER_MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'] as string[],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-base', type: 'raster' as const, source: 'osm' }],
}

export function WeatherForecastMap({ cities }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let destroyed = false

    import('maplibre-gl').then((mod) => {
      if (destroyed || !containerRef.current) return
      const maplibregl = mod.default

      // Inject CSS once
      if (!document.getElementById('maplibre-css')) {
        const link = document.createElement('link')
        link.id = 'maplibre-css'
        link.rel = 'stylesheet'
        link.href = new URL('maplibre-gl/dist/maplibre-gl.css', import.meta.url).href
        document.head.appendChild(link)
      }

      const map = new maplibregl.Map({
        container: containerRef.current!,
        style: WEATHER_MAP_STYLE,
        center: [139.65, 35.67],
        zoom: 3.7,
        attributionControl: false,
        interactive: false,
        dragRotate: false,
        touchZoomRotate: false,
        renderWorldCopies: false,
      })
      mapRef.current = { map, maplibregl }
    })

    return () => {
      destroyed = true
      if (mapRef.current) {
        markersRef.current.forEach((m) => m.remove())
        markersRef.current = []
        mapRef.current.map.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || cities.length === 0) return
    const { map, maplibregl } = mapRef.current

    const syncMap = () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = cities.map((city) => {
        const el = document.createElement('div')
        el.className = 'widget-forecast-map-marker'
        const dot = document.createElement('span')
        dot.className = 'widget-forecast-map-marker-dot'
        const label = document.createElement('span')
        label.className = 'widget-forecast-map-marker-label'
        label.textContent = `${city.name} ${city.temp}°`
        el.append(dot, label)

        return new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([city.longitude, city.latitude])
          .addTo(map)
      })

      const lngs = cities.map((c) => c.longitude)
      const lats = cities.map((c) => c.latitude)
      map.fitBounds(
        [[Math.min(...lngs) - 4, Math.min(...lats) - 3], [Math.max(...lngs) + 4, Math.max(...lats) + 3]],
        { padding: 28, duration: 0, maxZoom: 4.8 },
      )
      map.resize()
    }

    if (map.loaded()) { syncMap(); return }
    map.once('load', syncMap)
    return () => map.off('load', syncMap)
  }, [cities])

  return <div ref={containerRef} className="widget-forecast-mapcanvas" aria-label="Regional forecast map" />
}
