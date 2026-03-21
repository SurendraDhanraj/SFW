import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface GISMapPickerProps {
  value: { lat: number; lng: number } | null
  onChange: (val: { lat: number; lng: number } | null) => void
  readOnly?: boolean
}

export default function GISMapPicker({ value, onChange, readOnly = false }: GISMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [coords, setCoords] = useState<string | null>(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (mapInstanceRef.current) return // don't reinit

    const defaultCenter: L.LatLngExpression = value
      ? [value.lat, value.lng]
      : [10.6572, -61.5181] // default: Trinidad & Tobago

    const map = L.map(mapRef.current, { zoomControl: true }).setView(defaultCenter, value ? 16 : 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)

    if (value) {
      markerRef.current = L.marker([value.lat, value.lng]).addTo(map)
    }

    if (!readOnly) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng
        if (markerRef.current) markerRef.current.remove()
        markerRef.current = L.marker([lat, lng]).addTo(map)
        onChange({ lat, lng })
        setCoords(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      })
    }

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // React to prop changes
  useEffect(() => {
    if (!mapInstanceRef.current) return
    const map = mapInstanceRef.current
    if (value) {
      if (markerRef.current) markerRef.current.remove()
      markerRef.current = L.marker([value.lat, value.lng]).addTo(map)
      map.setView([value.lat, value.lng], 16)
    } else {
      if (markerRef.current) markerRef.current.remove()
      map.setView([10.6572, -61.5181], 12)
    }
  }, [value, onChange])

  return (
    <div>
      <div ref={mapRef} id="gis-map-picker" className="map-container tall" />
      {!readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.375rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>location_on</span>
          <span className="label-sm text-muted">
            {coords ?? value ? `${value?.lat.toFixed(5)}, ${value?.lng.toFixed(5)}` : 'Tap map to pin location'}
          </span>
          {value && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', fontSize: '0.6875rem' }}
              onClick={() => { if (markerRef.current) markerRef.current.remove(); onChange(null); setCoords(null) }}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
