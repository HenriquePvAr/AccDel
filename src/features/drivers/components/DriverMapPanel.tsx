import 'maplibre-gl/dist/maplibre-gl.css'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, {
  type ErrorEvent,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapGeoJSONFeature,
  type MapStyleImageMissingEvent,
  type Marker,
  type StyleSpecification,
} from 'maplibre-gl'
import { AlertTriangle, Loader2, Navigation, Signal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { DriverRoutePreviewResponse } from '@/contracts'
import { cn } from '@/lib/utils'
import type { DeliveryStop, Driver, DriverLocation, DriverRoute, GeoCoordinate } from '@/types'

import {
  driverMapStoreCoordinate,
  driverMapStoreLabel,
  formatDistanceMeters,
  formatDriverLastUpdate,
  formatEtaMinutes,
  formatSpeedKmh,
  getDriverFilterBucket,
  getDriverLocationCoordinate,
  getDriverStatusLabel,
  getPrimaryStop,
  getStopCoordinate,
} from './driver-location-utils'

interface DriverMapPanelProps {
  drivers: Driver[]
  locations: DriverLocation[]
  route?: DriverRoute | null
  previewRoute?: DriverRoutePreviewResponse['data'] | null
  routeLoading?: boolean
  realtimeConnected?: boolean
  selectedDriverId: string | null
  onSelectDriver?: (driverId: string) => void
  onOpenDispatchCenter?: (driverId: string) => void
}

const mapStyleUrl =
  import.meta.env.VITE_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/dark'
const fallbackMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '(c) OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-raster',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-saturation': -0.35,
        'raster-brightness-min': 0.12,
        'raster-brightness-max': 0.72,
        'raster-contrast': 0.18,
      },
    },
  ],
}

const driversSourceId = 'driver-live-source'
const currentRouteSourceId = 'driver-active-route'
const currentRouteGlowLayerId = 'driver-active-route-glow'
const currentRouteLayerId = 'driver-active-route-line'
const previewRouteSourceId = 'driver-preview-route'
const previewRouteGlowLayerId = 'driver-preview-route-glow'
const previewRouteLayerId = 'driver-preview-route-line'
const driversClusterLayerId = 'driver-live-clusters'
const driversClusterCountLayerId = 'driver-live-cluster-count'
const driversCircleGlowLayerId = 'driver-live-point-glow'
const driversCircleLayerId = 'driver-live-point'
const driversCircleLabelLayerId = 'driver-live-point-label'
const transparentMapImage = {
  width: 1,
  height: 1,
  data: new Uint8Array([0, 0, 0, 0]),
}
const emptyStops: DeliveryStop[] = []
type MapStatus = 'loading' | 'ready' | 'error'

export function DriverMapPanel({
  drivers,
  locations,
  route,
  previewRoute = null,
  routeLoading = false,
  realtimeConnected = false,
  selectedDriverId,
  onSelectDriver,
  onOpenDispatchCenter,
}: DriverMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const usingFallbackStyleRef = useRef(false)
  const hasMapLoadedRef = useRef(false)
  const selectedMarkerRef = useRef<Marker | null>(null)
  const storeMarkerRef = useRef<Marker | null>(null)
  const stopMarkersRef = useRef<Marker[]>([])
  const markersAnimationFrameRef = useRef<number | null>(null)
  const animatedLocationsRef = useRef<Map<string, DriverLocation>>(new Map())
  const previousSelectedLocationRef = useRef<GeoCoordinate | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading')
  const [mapError, setMapError] = useState<string | null>(null)
  const [fallbackStyleActive, setFallbackStyleActive] = useState(false)
  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId],
  )
  const selectedLocation = useMemo(
    () =>
      selectedDriver
        ? locations.find((entry) => entry.driverId === selectedDriver.id) ?? null
        : null,
    [locations, selectedDriver],
  )
  const selectedTrackingLocation = route?.currentLocation ?? selectedLocation
  const activeStops = route?.stops ?? selectedDriver?.queue ?? emptyStops
  const currentStop = selectedDriver ? getPrimaryStop(selectedDriver, route) : null
  const previewActive = Boolean(previewRoute)
  const routeDistance = currentStop?.distanceMeters ?? route?.distanceMeters ?? null
  const routeEta = currentStop?.etaMinutes ?? route?.etaMinutes ?? null

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const fallbackTimers: { load?: number; error?: number } = {}

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyleUrl,
      center: [driverMapStoreCoordinate.longitude, driverMapStoreCoordinate.latitude],
      zoom: 12.7,
      attributionControl: false,
      cooperativeGestures: true,
    })

    const resizeMap = () => {
      window.requestAnimationFrame(() => {
        map.resize()
      })
      window.setTimeout(() => map.resize(), 220)
    }

    const clearFallbackTimers = () => {
      if (fallbackTimers.load) {
        window.clearTimeout(fallbackTimers.load)
      }

      if (fallbackTimers.error) {
        window.clearTimeout(fallbackTimers.error)
      }
    }

    const activateFallbackStyle = (reason: string) => {
      if (usingFallbackStyleRef.current || !mapRef.current) {
        return
      }

      usingFallbackStyleRef.current = true
      setFallbackStyleActive(true)
      setMapStatus('loading')
      setMapError(reason)
      map.setStyle(fallbackMapStyle)
      fallbackTimers.error = window.setTimeout(() => {
        if (!hasMapLoadedRef.current && !map.loaded()) {
          setMapStatus('error')
          setMapReady(false)
          setMapError('Nao foi possivel carregar o mapa base. Verifique a conexao com os tiles.')
        }
      }, 6000)
    }

    const markMapReady = () => {
      clearFallbackTimers()
      resizeMap()
      hasMapLoadedRef.current = true
      setMapReady(true)
      setMapStatus('ready')
      ensureDriverLayers(map, onSelectDriver)
      ensureLineLayer(map, currentRouteSourceId, currentRouteGlowLayerId, currentRouteLayerId, '#2f8cff')
      ensureLineLayer(map, previewRouteSourceId, previewRouteGlowLayerId, previewRouteLayerId, '#22c55e')
      if (!storeMarkerRef.current) {
        storeMarkerRef.current = createStoreMarker(map)
      }
    }

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'OpenStreetMap / OpenFreeMap / MapLibre',
      }),
      'bottom-right',
    )
    map.once('load', markMapReady)
    map.on('style.load', markMapReady)
    map.on('styleimagemissing', (event: MapStyleImageMissingEvent) => {
      if (!map.hasImage(event.id)) {
        map.addImage(event.id, transparentMapImage)
      }
    })
    map.on('error', (event: ErrorEvent) => {
      if (hasMapLoadedRef.current || map.loaded()) {
        return
      }

      const message = event.error?.message ?? 'Falha ao carregar o style do mapa.'
      activateFallbackStyle(message)
    })

    mapRef.current = map
    resizeObserverRef.current = new ResizeObserver(resizeMap)
    resizeObserverRef.current.observe(mapContainerRef.current)
    resizeMap()
    fallbackTimers.load = window.setTimeout(() => {
      if (!hasMapLoadedRef.current && !map.loaded()) {
        activateFallbackStyle('O style principal demorou demais para carregar.')
      }
    }, 4500)

    return () => {
      clearFallbackTimers()
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      if (markersAnimationFrameRef.current) {
        window.cancelAnimationFrame(markersAnimationFrameRef.current)
      }
      stopMarkersRef.current.forEach((marker) => marker.remove())
      stopMarkersRef.current = []
      selectedMarkerRef.current?.remove()
      selectedMarkerRef.current = null
      storeMarkerRef.current?.remove()
      storeMarkerRef.current = null
      map.remove()
      mapRef.current = null
      usingFallbackStyleRef.current = false
      hasMapLoadedRef.current = false
    }
  }, [onSelectDriver])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !mapReady) {
      return
    }

    animateDriverSource({
      map,
      drivers,
      locations,
      selectedDriverId,
      animationFrameRef: markersAnimationFrameRef,
      animatedLocationsRef,
    })
  }, [drivers, locations, mapReady, selectedDriverId])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !mapReady) {
      return
    }

    updateLineSource(map, currentRouteSourceId, route?.geometry ?? [])
    updateLineSource(map, previewRouteSourceId, previewRoute?.previewRoute.geometry ?? [])
    setPreviewLineTone(map, previewRoute?.severity ?? null)
  }, [mapReady, previewRoute, route])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !mapReady) {
      return
    }

    stopMarkersRef.current.forEach((marker) => marker.remove())
    stopMarkersRef.current = []
    const stopsToRender = previewActive
      ? previewRoute?.previewRoute.stops ?? activeStops
      : activeStops

    if (selectedDriver && stopsToRender.length) {
      stopsToRender
        .slice()
        .sort((left, right) => left.finalSequence - right.finalSequence)
        .forEach((stop, index) => {
          stopMarkersRef.current.push(
            createStopMarker({
              map,
              stop,
              coordinate: getStopCoordinate(stop, index),
              variant: index === 0 ? 'active' : previewActive ? 'preview' : 'next',
            }),
          )
        })
    }
  }, [activeStops, mapReady, previewActive, previewRoute?.previewRoute.stops, selectedDriver])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !mapReady) {
      return
    }

    syncSelectedDriverMarker({
      map,
      selectedDriver,
      selectedLocation: selectedTrackingLocation,
      selectedMarkerRef,
      previousSelectedLocationRef,
    })
  }, [mapReady, selectedDriver, selectedTrackingLocation])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !mapReady) {
      return
    }

    const bounds = new maplibregl.LngLatBounds(
      [driverMapStoreCoordinate.longitude, driverMapStoreCoordinate.latitude],
      [driverMapStoreCoordinate.longitude, driverMapStoreCoordinate.latitude],
    )

    if (selectedDriver && (previewRoute?.previewRoute.geometry.length || route?.geometry.length)) {
      ;(previewRoute?.previewRoute.geometry ?? route?.geometry ?? []).forEach((point) => {
        bounds.extend([point.longitude, point.latitude])
      })
      bounds.extend([driverMapStoreCoordinate.longitude, driverMapStoreCoordinate.latitude])
    } else {
      locations.forEach((location) => {
        const coordinate = getDriverLocationCoordinate(location)
        bounds.extend([coordinate.longitude, coordinate.latitude])
      })
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: {
          top: 88,
          right: 88,
          bottom: 88,
          left: 88,
        },
        maxZoom: 14.8,
        duration: 650,
      })
    }
  }, [locations, mapReady, previewRoute, route, selectedDriver])

  return (
    <Card className="overflow-hidden">
      <div className="relative h-[560px] min-h-[560px] overflow-hidden bg-[#020914] xl:h-[640px] xl:min-h-[640px]">
        <div ref={mapContainerRef} className="h-full w-full" />
        {mapStatus === 'loading' ? (
          <MapOverlay
            icon={<Loader2 className="h-5 w-5 animate-spin text-primary" />}
            title="Carregando mapa operacional"
            description="Preparando base MapLibre, loja, motoboys e rotas."
          />
        ) : null}
        {mapStatus === 'error' ? (
          <MapOverlay
            icon={<AlertTriangle className="h-5 w-5 text-amber-300" />}
            title="Mapa indisponivel"
            description={mapError ?? 'Nao foi possivel renderizar o mapa neste momento.'}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#020914]/82 to-transparent" />

        <div className="absolute left-4 top-4 z-10 flex max-w-[64%] flex-wrap gap-2">
          <MapChip label={selectedDriver ? selectedDriver.name : 'Selecione um motoboy'} emphasized />
          <MapChip label={route ? 'Rota ativa' : 'Sem rota ativa'} />
          {previewActive ? <MapChip label="Preview de despacho" /> : null}
          {routeLoading ? <MapChip label="Recalculando rota" /> : null}
          <MapChip label={fallbackStyleActive ? 'Fallback OSM' : 'OpenFreeMap'} />
          <MapChip label={realtimeConnected ? 'Realtime conectado' : 'Fallback de sincronizacao'} />
          {selectedTrackingLocation ? (
            <MapChip label={`Atualizado ${formatDriverLastUpdate(selectedTrackingLocation)}`} />
          ) : null}
        </div>

        {selectedDriver ? (
          <div className="absolute right-4 top-4 z-10 w-full max-w-[348px] rounded-[24px] border border-white/10 bg-[#07111f]/88 p-4 shadow-panel backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  {previewActive ? 'Preview logistico' : 'Destino atual'}
                </p>
                <p className="mt-1 truncate text-base font-black text-white">
                  {previewActive
                    ? previewRoute?.previewRoute.stops[0]?.addressLabel ?? currentStop?.addressLabel ?? 'Sem destino'
                    : currentStop?.addressLabel ?? 'Sem destino ativo'}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {previewActive
                    ? previewRoute?.recommendation
                    : `${currentStop?.orderNumber ?? '--'} | ${currentStop?.customerName ?? selectedDriver.name}`}
                </p>
              </div>
              <div
                className={cn(
                  'rounded-2xl px-3 py-2 ring-1',
                  previewRoute?.severity === 'high'
                    ? 'bg-rose-400/12 ring-rose-300/20'
                    : previewRoute?.severity === 'medium'
                      ? 'bg-amber-400/12 ring-amber-300/20'
                      : 'bg-sky-400/12 ring-sky-300/20',
                )}
              >
                <p className="text-sm font-black text-white">
                  {previewActive ? `+${previewRoute?.addedEtaMinutes ?? 0} min` : formatEtaMinutes(routeEta)}
                </p>
                <p className="text-xs text-slate-500">
                  {previewActive
                    ? formatDistanceMeters(previewRoute?.addedDistanceMeters ?? 0)
                    : formatDistanceMeters(routeDistance)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="absolute bottom-4 left-4 z-10 max-w-[320px] rounded-[24px] border border-white/10 bg-[#07111f]/88 px-4 py-3 shadow-panel backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20">
              <Navigation className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">{driverMapStoreLabel}</p>
              <p className="text-xs text-slate-400">
                Origem da operacao | {drivers.length} motoboys monitorados
              </p>
            </div>
          </div>
        </div>

        {selectedDriver ? (
          <div className="absolute bottom-4 right-4 z-10 w-[300px] rounded-[22px] border border-white/10 bg-[#07111f]/88 px-4 py-3 shadow-panel backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              <Signal className={cn('h-3.5 w-3.5', realtimeConnected ? 'text-emerald-300' : 'text-amber-300')} />
              Operacao selecionada
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span>{getDriverStatusLabel(selectedDriver)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span>{formatSpeedKmh(selectedTrackingLocation?.speedKmh)}</span>
              {(previewActive ? previewRoute?.previewRoute.etaMinutes : routeEta) !== null ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-slate-600" />
                  <span>
                    {previewActive
                      ? formatEtaMinutes(previewRoute?.previewRoute.etaMinutes ?? null)
                      : formatEtaMinutes(routeEta)}
                  </span>
                </>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 h-9 w-full rounded-2xl"
              onClick={() => selectedDriver && onOpenDispatchCenter?.(selectedDriver.id)}
            >
              Central de despacho
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function MapChip({
  label,
  emphasized = false,
}: {
  label: string
  emphasized?: boolean
}) {
  return (
    <span
      className={cn(
        'rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] backdrop-blur-xl',
        emphasized
          ? 'border-primary/20 bg-primary/12 text-primary'
          : 'border-white/10 bg-[#07111f]/82 text-slate-300',
      )}
    >
      {label}
    </span>
  )
}

function MapOverlay({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#020914]/62 px-6 backdrop-blur-[2px]">
      <div className="max-w-sm rounded-[24px] border border-white/10 bg-[#07111f]/92 px-5 py-4 text-center shadow-panel">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
          {icon}
        </div>
        <p className="font-black text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  )
}

function ensureDriverLayers(
  map: MapLibreMap,
  onSelectDriver?: (driverId: string) => void,
) {
  if (!map.getSource(driversSourceId)) {
    map.addSource(driversSourceId, {
      type: 'geojson',
      data: emptyFeatureCollection(),
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 44,
    })
  }

  if (!map.getLayer(driversClusterLayerId)) {
    map.addLayer({
      id: driversClusterLayerId,
      type: 'circle',
      source: driversSourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#091626',
        'circle-radius': ['step', ['get', 'point_count'], 18, 8, 24, 20, 30],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(255,255,255,0.16)',
        'circle-opacity': 0.94,
      },
    })
  }

  if (!map.getLayer(driversClusterCountLayerId)) {
    map.addLayer({
      id: driversClusterCountLayerId,
      type: 'symbol',
      source: driversSourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
        'text-font': ['Open Sans Bold'],
      },
      paint: {
        'text-color': '#f8fafc',
      },
    })
  }

  if (!map.getLayer(driversCircleGlowLayerId)) {
    map.addLayer({
      id: driversCircleGlowLayerId,
      type: 'circle',
      source: driversSourceId,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 17,
        'circle-color': [
          'match',
          ['get', 'statusBucket'],
          'delivering',
          'rgba(59,130,246,0.20)',
          'available',
          'rgba(16,185,129,0.18)',
          'paused',
          'rgba(245,158,11,0.18)',
          'rgba(100,116,139,0.18)',
        ],
        'circle-blur': 0.7,
      },
    })
  }

  if (!map.getLayer(driversCircleLayerId)) {
    map.addLayer({
      id: driversCircleLayerId,
      type: 'circle',
      source: driversSourceId,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 9,
        'circle-color': [
          'match',
          ['get', 'statusBucket'],
          'delivering',
          '#2f8cff',
          'available',
          '#10b981',
          'paused',
          '#f59e0b',
          '#64748b',
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
      },
    })
  }

  if (!map.getLayer(driversCircleLabelLayerId)) {
    map.addLayer({
      id: driversCircleLabelLayerId,
      type: 'symbol',
      source: driversSourceId,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['coalesce', ['get', 'speedLabel'], '0 km/h'],
        'text-size': 10,
        'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2.2],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#dbeafe',
        'text-halo-color': 'rgba(2, 6, 23, 0.92)',
        'text-halo-width': 1,
      },
    })
  }

  map.on('click', driversClusterLayerId, (event) => {
    const feature = event.features?.[0]

    if (!feature) {
      return
    }

    const clusterId = feature.properties?.cluster_id
    const source = map.getSource(driversSourceId) as GeoJSONSource & {
      getClusterExpansionZoom?: (
        clusterId: number,
        callback: (error: Error | null, zoom: number) => void,
      ) => void
    }

    source.getClusterExpansionZoom?.(clusterId, (error, zoom) => {
      if (error) {
        return
      }

      const [longitude, latitude] = (feature.geometry as GeoJSON.Point).coordinates
      map.easeTo({
        center: [longitude, latitude],
        zoom,
        duration: 500,
      })
    })
  })

  map.on('click', driversCircleLayerId, (event) => {
    const feature = event.features?.[0] as MapGeoJSONFeature | undefined
    const driverId = feature?.properties?.driverId

    if (typeof driverId === 'string') {
      onSelectDriver?.(driverId)
    }
  })

  map.on('mouseenter', driversClusterLayerId, () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', driversClusterLayerId, () => {
    map.getCanvas().style.cursor = ''
  })
  map.on('mouseenter', driversCircleLayerId, () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', driversCircleLayerId, () => {
    map.getCanvas().style.cursor = ''
  })
}

function ensureLineLayer(
  map: MapLibreMap,
  sourceId: string,
  glowLayerId: string,
  lineLayerId: string,
  color: string,
) {
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: emptyFeatureCollection(),
    })
  }

  if (!map.getLayer(glowLayerId)) {
    map.addLayer({
      id: glowLayerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': color,
        'line-width': 11,
        'line-opacity': 0.14,
        'line-blur': 0.9,
      },
    })
  }

  if (!map.getLayer(lineLayerId)) {
    map.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': color,
        'line-width': 5,
        'line-opacity': 0.96,
        'line-dasharray': sourceId === previewRouteSourceId ? [1.2, 1.6] : [1, 0],
      },
    })
  }
}

function updateLineSource(map: MapLibreMap | null, sourceId: string, coordinates: GeoCoordinate[]) {
  if (!map || !map.isStyleLoaded()) {
    return
  }

  const source = map.getSource(sourceId) as GeoJSONSource | undefined

  if (!source) {
    return
  }

  source.setData(
    coordinates.length >= 2
      ? {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: coordinates.map((point) => [point.longitude, point.latitude]),
              },
            },
          ],
        }
      : emptyFeatureCollection(),
  )
}

function setPreviewLineTone(
  map: MapLibreMap | null,
  severity: DriverRoutePreviewResponse['data']['severity'] | null,
) {
  if (!map || !map.getLayer(previewRouteLayerId) || !map.getLayer(previewRouteGlowLayerId)) {
    return
  }

  const color =
    severity === 'high' ? '#f43f5e' : severity === 'medium' ? '#f59e0b' : '#22c55e'

  map.setPaintProperty(previewRouteGlowLayerId, 'line-color', color)
  map.setPaintProperty(previewRouteLayerId, 'line-color', color)
}

function syncSelectedDriverMarker(params: {
  map: MapLibreMap
  selectedDriver: Driver | null
  selectedLocation: DriverLocation | null
  selectedMarkerRef: React.MutableRefObject<Marker | null>
  previousSelectedLocationRef: React.MutableRefObject<GeoCoordinate | null>
}) {
  const {
    map,
    selectedDriver,
    selectedLocation,
    selectedMarkerRef,
    previousSelectedLocationRef,
  } = params

  selectedMarkerRef.current?.remove()
  selectedMarkerRef.current = null

  if (!selectedDriver || !selectedLocation) {
    previousSelectedLocationRef.current = null
    return
  }

  const coordinate = getDriverLocationCoordinate(selectedLocation)
  const element = document.createElement('button')
  element.type = 'button'
  element.className = 'cain-map-selected-driver'
  element.dataset.status = getDriverFilterBucket(selectedDriver)
  element.innerHTML = `
    <span class="cain-map-selected-driver-pulse"></span>
    <span class="cain-map-selected-driver-shell">
      <span class="cain-map-selected-driver-icon">
        <svg viewBox="0 0 24 24"><path d="M5 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm8 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0ZM7 17h4l2-7h3l1 3h2l-2-5h-5l-2 7H7V9H4v2h2z"/></svg>
      </span>
      <span class="cain-map-selected-driver-meta">
        <strong>${escapeHtml(selectedDriver.name)}</strong>
        <small>${escapeHtml(formatSpeedKmh(selectedLocation.speedKmh))}</small>
      </span>
      <span class="cain-map-selected-driver-gps"></span>
    </span>
  `
  element.style.setProperty('--driver-rotation', `${selectedLocation.heading ?? 0}deg`)

  const marker = new maplibregl.Marker({ element, anchor: 'center' })
    .setLngLat([coordinate.longitude, coordinate.latitude])
    .addTo(map)

  selectedMarkerRef.current = marker
  previousSelectedLocationRef.current = coordinate
}

function animateDriverSource(params: {
  map: MapLibreMap
  drivers: Driver[]
  locations: DriverLocation[]
  selectedDriverId: string | null
  animationFrameRef: React.MutableRefObject<number | null>
  animatedLocationsRef: React.MutableRefObject<Map<string, DriverLocation>>
}) {
  const { map, drivers, locations, selectedDriverId, animationFrameRef, animatedLocationsRef } = params
  const targetLocations = new Map(locations.map((location) => [location.driverId, location]))
  const startLocations = new Map(animatedLocationsRef.current)
  const startedAt = performance.now()
  const duration = 900

  if (animationFrameRef.current) {
    window.cancelAnimationFrame(animationFrameRef.current)
  }

  const tick = (timestamp: number) => {
    const progress = Math.min(1, (timestamp - startedAt) / duration)
    const eased = 1 - (1 - progress) * (1 - progress)
    const interpolatedLocations = new Map<string, DriverLocation>()

    targetLocations.forEach((targetLocation, driverId) => {
      const startLocation = startLocations.get(driverId)

      if (!startLocation) {
        interpolatedLocations.set(driverId, targetLocation)
        return
      }

      const startCoordinate = getDriverLocationCoordinate(startLocation)
      const targetCoordinate = getDriverLocationCoordinate(targetLocation)

      interpolatedLocations.set(driverId, {
        ...targetLocation,
        longitude:
          startCoordinate.longitude +
          (targetCoordinate.longitude - startCoordinate.longitude) * eased,
        latitude:
          startCoordinate.latitude +
          (targetCoordinate.latitude - startCoordinate.latitude) * eased,
      })
    })

    syncDriverSource(
      map,
      drivers,
      Array.from(interpolatedLocations.values()),
      selectedDriverId,
    )

    if (progress < 1) {
      animationFrameRef.current = window.requestAnimationFrame(tick)
      return
    }

    animatedLocationsRef.current = targetLocations
  }

  animationFrameRef.current = window.requestAnimationFrame(tick)
}

function syncDriverSource(
  map: MapLibreMap,
  drivers: Driver[],
  locations: DriverLocation[],
  selectedDriverId: string | null,
) {
  const source = map.getSource(driversSourceId) as GeoJSONSource | undefined

  if (!source) {
    return
  }

  const driverById = new Map(drivers.map((driver) => [driver.id, driver]))
  const features = locations
    .filter((location) => location.driverId !== selectedDriverId)
    .flatMap((location) => {
      const driver = driverById.get(location.driverId)

      if (!driver) {
        return []
      }

      const coordinate = getDriverLocationCoordinate(location)

      return [{
        type: 'Feature' as const,
        properties: {
          driverId: driver.id,
          name: driver.name,
          statusBucket: getDriverFilterBucket(driver),
          speedLabel: formatSpeedKmh(location.speedKmh),
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [coordinate.longitude, coordinate.latitude],
        },
      }]
    })

  source.setData({
    type: 'FeatureCollection',
    features,
  })
}

function createStoreMarker(map: MapLibreMap) {
  const element = document.createElement('div')
  element.className = 'cain-map-marker cain-map-marker-store'
  element.innerHTML = markerIconHtml('store')
  return new maplibregl.Marker({ element, anchor: 'bottom' })
    .setLngLat([driverMapStoreCoordinate.longitude, driverMapStoreCoordinate.latitude])
    .setPopup(
      new maplibregl.Popup({
        offset: 18,
        className: 'cain-map-popup',
      }).setHTML(`
        <strong>${driverMapStoreLabel}</strong>
        <span>Loja central | ponto de partida</span>
      `),
    )
    .addTo(map)
}

function createStopMarker({
  map,
  stop,
  coordinate,
  variant,
}: {
  map: MapLibreMap
  stop: DeliveryStop
  coordinate: GeoCoordinate
  variant: 'active' | 'next' | 'preview'
}) {
  const element = document.createElement('div')
  element.className = cn(
    'cain-map-marker cain-map-marker-stop',
    variant === 'active'
      ? 'cain-map-marker-stop-active'
      : variant === 'preview'
        ? 'cain-map-marker-stop-preview'
        : 'cain-map-marker-stop-next',
  )
  element.innerHTML = `<span>${stop.finalSequence}</span>`
  return new maplibregl.Marker({ element, anchor: 'bottom' })
    .setLngLat([coordinate.longitude, coordinate.latitude])
    .setPopup(
      new maplibregl.Popup({
        offset: 18,
        className: 'cain-map-popup',
      }).setHTML(`
        <strong>${escapeHtml(stop.orderNumber)} | ${escapeHtml(stop.customerName)}</strong>
        <span>${escapeHtml(stop.addressLabel)}</span>
        <span>ETA ${escapeHtml(formatEtaMinutes(stop.etaMinutes))} | ${escapeHtml(formatDistanceMeters(stop.distanceMeters))}</span>
      `),
    )
    .addTo(map)
}

function emptyFeatureCollection() {
  return {
    type: 'FeatureCollection' as const,
    features: [],
  }
}

function markerIconHtml(kind: 'store') {
  if (kind === 'store') {
    return '<span class="cain-map-marker-icon"><svg viewBox="0 0 24 24"><path d="M4 6.75 6 3h12l2 3.75v1.5A1.75 1.75 0 0 1 18.25 10 2.25 2.25 0 0 1 16 8.25 2.25 2.25 0 0 1 13.75 10 2.25 2.25 0 0 1 11.5 8.25 2.25 2.25 0 0 1 9.25 10 2.25 2.25 0 0 1 7 8.25 2.25 2.25 0 0 1 4.75 10 1.75 1.75 0 0 1 3 8.25v-1.5ZM5 11.25A4.1 4.1 0 0 0 7 10.6V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-9.4a4.1 4.1 0 0 0 2 .65V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/></svg></span>'
  }

  return ''
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }

    return entities[character]
  })
}
