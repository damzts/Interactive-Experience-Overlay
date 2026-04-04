import { useEffect, useRef } from 'react'
import maplibregl, { type LngLatBoundsLike, type Map as MapLibreMap, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

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
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-base',
      type: 'raster',
      source: 'osm',
    },
  ],
} as const

function buildMarkerElement(city: MapCity) {
  const marker = document.createElement('div')
  marker.className = 'widget-forecast-map-marker'

  const dot = document.createElement('span')
  dot.className = 'widget-forecast-map-marker-dot'

  const label = document.createElement('span')
  label.className = 'widget-forecast-map-marker-label'
  label.textContent = `${city.name} ${city.temp}°`

  marker.append(dot, label)
  return marker
}

function getBounds(cities: MapCity[]): LngLatBoundsLike {
  const longitudes = cities.map((city) => city.longitude)
  const latitudes = cities.map((city) => city.latitude)

  return [
    [Math.min(...longitudes) - 4, Math.min(...latitudes) - 3],
    [Math.max(...longitudes) + 4, Math.max(...latitudes) + 3],
  ]
}

export function WeatherForecastMap({ cities }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: WEATHER_MAP_STYLE,
      center: [139.65, 35.67],
      zoom: 3.7,
      attributionControl: false,
      interactive: false,
      dragRotate: false,
      touchZoomRotate: false,
      renderWorldCopies: false,
    })

    mapRef.current = map

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || cities.length === 0) {
      return
    }

    const syncMap = () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = cities.map((city) => {
        const marker = new maplibregl.Marker({
          element: buildMarkerElement(city),
          anchor: 'bottom',
        })
          .setLngLat([city.longitude, city.latitude])
          .addTo(map)

        return marker
      })

      map.fitBounds(getBounds(cities), {
        padding: 28,
        duration: 0,
        maxZoom: 4.8,
      })

      map.resize()
    }

    if (map.loaded()) {
      syncMap()
      return
    }

    map.once('load', syncMap)
    return () => {
      map.off('load', syncMap)
    }
  }, [cities])

  return <div ref={containerRef} className="widget-forecast-mapcanvas" aria-label="Regional forecast map" />
}