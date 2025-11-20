import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { RouteData, TransportMode } from '../types';

// --- Configuration ---
const COLORS = {
  [TransportMode.CAR]: '#0099ff',   // Requested Blue
  [TransportMode.TRAIN]: '#22c55e', // Green
  [TransportMode.BUS]: '#ec4899',   // Pink
};

const ANIMATION_DURATION_SECONDS = 90; // 90s for slow playback
const FOLLOW_ZOOM_LEVEL = 10; 

// --- Icons ---
const getIconHtml = (mode: TransportMode, isFlipped: boolean) => {
  const color = COLORS[mode];
  let svgContent = '';

  // Reduced stroke-width by ~25%
  if (mode === TransportMode.TRAIN) {
     svgContent = `
      <svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.1">
        <!-- Wheels -->
        <circle cx="8" cy="17" r="2.5" fill="white" stroke="none"/>
        <circle cx="17" cy="17" r="2.5" fill="white" stroke="none"/>
        <path d="M8 17 L17 17" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        
        <!-- Cabin/Body -->
        <path d="M4 15V9C4 8 4 7 6 7H10V5H12V7H14V4L18 4V7H19C20.1 7 21 7.9 21 9V15H4Z" stroke-linejoin="round"/>
        <rect x="5" y="9" width="4" height="3" fill="white" opacity="0.8" stroke="none" />
        
        <!-- Funnel top -->
        <path d="M14 4L18 4" stroke-linecap="round"/>
      </svg>`;
  } else if (mode === TransportMode.BUS) {
     svgContent = `
      <svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5">
         <rect x="3" y="6" width="18" height="11" rx="2" />
         <path d="M3 13h18" />
         <path d="M7 6v4" stroke-width="0.8" opacity="0.5"/>
         <path d="M12 6v4" stroke-width="0.8" opacity="0.5"/>
         <path d="M17 6v4" stroke-width="0.8" opacity="0.5"/>
         <circle cx="7" cy="17" r="2" fill="white"/>
         <circle cx="17" cy="17" r="2" fill="white"/>
      </svg>`;
  } else {
    // Car
    svgContent = `
      <svg viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5">
        <path d="M3 12 L6 6 H16 L19 12 H21 V16 H3 V12" stroke-linejoin="round" />
        <circle cx="7" cy="16" r="2" fill="white"/>
        <circle cx="17" cy="16" r="2" fill="white"/>
      </svg>`;
  }

  // Mirror horizontally if moving West (left)
  const transform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
  
  return `
    <div style="
      transform: ${transform}; 
      width: 48px; 
      height: 48px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      filter: drop-shadow(0px 5px 8px rgba(0,0,0,0.4)); 
      transition: transform 0.2s;
    ">
      ${svgContent}
    </div>`;
};

const createLeafletIcon = (mode: TransportMode, isFlipped: boolean) => {
  return L.divIcon({
    html: getIconHtml(mode, isFlipped),
    className: 'custom-vehicle-icon', 
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
};

interface TravelMapProps {
  routeData: RouteData | null;
  isPlaying: boolean;
  onAnimationComplete: () => void;
}

// Internal interface for processed path data
interface PathPoint {
  lat: number;
  lng: number;
  mode: TransportMode;
  cumulativeDistance: number; // Meters from start
}

// --- Inner Component for Logic ---
const MapContent: React.FC<TravelMapProps> = ({ routeData, isPlaying, onAnimationComplete }) => {
  const map = useMap();
  
  // Refs for Leaflet objects
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const bgPolylinesRef = useRef<L.Polyline[]>([]);
  
  // Trail Management
  const finishedSegmentsLayerRef = useRef<L.LayerGroup | null>(null);
  const currentSegmentPolylineRef = useRef<L.Polyline | null>(null);
  const currentSegmentPointsRef = useRef<L.LatLng[]>([]);
  
  // Refs for Data & Animation State
  const pathDataRef = useRef<PathPoint[]>([]);
  const totalDistanceRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);
  const startZoomRef = useRef<number>(0);
  
  // Previous state
  const prevModeRef = useRef<TransportMode>(TransportMode.CAR);
  const prevFlippedRef = useRef<boolean>(false);

  // Helper to update markers/lines
  const updateMapState = (
    point: PathPoint, 
    isFinal: boolean,
    isFlipped: boolean = false,
    interpolatedPos: L.LatLng,
    currentZoom: number
  ) => {
    if (!vehicleMarkerRef.current || !currentSegmentPolylineRef.current || !finishedSegmentsLayerRef.current) return;

    // 1. Move Vehicle
    vehicleMarkerRef.current.setLatLng(interpolatedPos);

    // 2. Update Mode / Trail Color logic
    if (point.mode !== prevModeRef.current) {
        // MODE CHANGED: Freeze current segment
        if (currentSegmentPointsRef.current.length > 0) {
            L.polyline(currentSegmentPointsRef.current, {
                color: COLORS[prevModeRef.current],
                weight: 6,
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(finishedSegmentsLayerRef.current);
        }

        // Reset current segment
        currentSegmentPointsRef.current = [interpolatedPos];
        currentSegmentPolylineRef.current.setLatLngs(currentSegmentPointsRef.current);
        currentSegmentPolylineRef.current.setStyle({ color: COLORS[point.mode] });
        
        // Update Icon
        const icon = createLeafletIcon(point.mode, isFlipped);
        vehicleMarkerRef.current.setIcon(icon);
        
        prevModeRef.current = point.mode;
    } 
    
    // Update Flipped state
    if (isFlipped !== prevFlippedRef.current) {
        const icon = createLeafletIcon(point.mode, isFlipped);
        vehicleMarkerRef.current.setIcon(icon);
        prevFlippedRef.current = isFlipped;
    }

    // 3. Grow Current Trail
    currentSegmentPointsRef.current.push(interpolatedPos);
    currentSegmentPolylineRef.current.setLatLngs(currentSegmentPointsRef.current);

    // 4. Follow Camera with Zoom
    if (!isFinal) {
      map.setView(interpolatedPos, currentZoom, { animate: false });
    }
  };

  // Effect: Handle Background Line Opacity based on isPlaying
  useEffect(() => {
    bgPolylinesRef.current.forEach(poly => {
      // If playing, make background completely invisible and 0 width
      // This ensures NO thin lines appear in front of the vehicle
      if (isPlaying) {
          poly.setStyle({ opacity: 0, weight: 0 });
      } else {
          poly.setStyle({ opacity: 0.4, weight: 6 });
      }
    });
  }, [isPlaying]);

  // 1. Setup Map & Data when routeData changes
  useEffect(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    isAnimatingRef.current = false;
    
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.remove();
      vehicleMarkerRef.current = null;
    }
    if (finishedSegmentsLayerRef.current) {
        finishedSegmentsLayerRef.current.clearLayers();
        finishedSegmentsLayerRef.current.remove();
        finishedSegmentsLayerRef.current = null;
    }
    if (currentSegmentPolylineRef.current) {
        currentSegmentPolylineRef.current.remove();
        currentSegmentPolylineRef.current = null;
    }

    bgPolylinesRef.current.forEach(p => p.remove());
    bgPolylinesRef.current = [];
    pathDataRef.current = [];
    currentSegmentPointsRef.current = [];

    if (!routeData) return;

    // --- Pre-process Data ---
    const points: PathPoint[] = [];
    let currentDist = 0;
    
    routeData.legs.forEach(leg => {
      leg.coordinates.forEach((c) => {
        let dist = 0;
        if (points.length > 0) {
          const prev = points[points.length - 1];
          const from = L.latLng(prev.lat, prev.lng);
          const to = L.latLng(c.lat, c.lng);
          dist = from.distanceTo(to);
        }
        currentDist += dist;

        points.push({
          lat: c.lat,
          lng: c.lng,
          mode: leg.mode,
          cumulativeDistance: currentDist
        });
      });
    });

    pathDataRef.current = points;
    totalDistanceRef.current = currentDist;

    if (points.length === 0) return;

    // --- Draw Background (Full Route) ---
    routeData.legs.forEach(leg => {
      const pl = L.polyline(leg.coordinates.map(c => [c.lat, c.lng]), {
        color: COLORS[leg.mode],
        weight: 6,
        opacity: 0.4, // Default visibility
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      bgPolylinesRef.current.push(pl);
    });

    // --- Initialize Layers ---
    finishedSegmentsLayerRef.current = L.layerGroup().addTo(map);
    
    const startPoint = points[0];
    
    // Current Segment Polyline
    currentSegmentPolylineRef.current = L.polyline([], {
        color: COLORS[startPoint.mode],
        weight: 6,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);

    // Vehicle
    vehicleMarkerRef.current = L.marker([startPoint.lat, startPoint.lng], {
      icon: createLeafletIcon(startPoint.mode, false),
      zIndexOffset: 1000
    }).addTo(map);
    
    prevModeRef.current = startPoint.mode;
    prevFlippedRef.current = false;

    // --- FIT BOUNDS (Overview) ---
    if (routeData.boundingBox) {
      const [sw, ne] = routeData.boundingBox;
      if (sw.lat !== 0 && ne.lat !== 0) {
        map.invalidateSize();
        // Fit bounds initially
        map.fitBounds(
          [[sw.lat, sw.lng], [ne.lat, ne.lng]], 
          { padding: [50, 50], animate: false }
        );
      }
    }

  }, [routeData, map]);

  // 2. Animation Loop
  useEffect(() => {
    if (!isPlaying || pathDataRef.current.length < 2) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      isAnimatingRef.current = false;
      return;
    }

    if (!isAnimatingRef.current) {
      isAnimatingRef.current = true;
      startTimeRef.current = performance.now();
      
      // Capture start zoom for the zoom-in effect
      startZoomRef.current = map.getZoom();

      // Reset trails
      if (finishedSegmentsLayerRef.current) finishedSegmentsLayerRef.current.clearLayers();
      currentSegmentPointsRef.current = [];
      if (currentSegmentPolylineRef.current) currentSegmentPolylineRef.current.setLatLngs([]);
    }

    const animate = (time: number) => {
      const elapsed = time - startTimeRef.current;
      const durationMs = ANIMATION_DURATION_SECONDS * 1000;
      
      // Normalize time (0 to 1)
      const rawProgress = Math.min(elapsed / durationMs, 1);
      
      // LINEAR MOVEMENT (Constant Speed)
      const easedProgress = rawProgress;

      // Map eased progress to total distance
      const targetDist = totalDistanceRef.current * easedProgress;

      // Zoom Interpolation (First 3 seconds)
      const zoomDuration = 3000; 
      let currentZoom = FOLLOW_ZOOM_LEVEL;
      
      if (elapsed < zoomDuration) {
          const zoomProgress = elapsed / zoomDuration;
          // Ease out cubic for zoom only
          const ease = 1 - Math.pow(1 - zoomProgress, 3);
          currentZoom = startZoomRef.current + (FOLLOW_ZOOM_LEVEL - startZoomRef.current) * ease;
      }

      if (rawProgress >= 1) {
        const last = pathDataRef.current[pathDataRef.current.length - 1];
        updateMapState(last, true, false, L.latLng(last.lat, last.lng), FOLLOW_ZOOM_LEVEL);
        onAnimationComplete();
        isAnimatingRef.current = false;
        return;
      }

      // Find current segment
      let nextIdx = pathDataRef.current.findIndex(p => p.cumulativeDistance >= targetDist);
      if (nextIdx === -1) nextIdx = pathDataRef.current.length - 1;
      if (nextIdx === 0) nextIdx = 1;

      const p1 = pathDataRef.current[nextIdx - 1];
      const p2 = pathDataRef.current[nextIdx];

      // Interpolate Position
      const segmentDist = p2.cumulativeDistance - p1.cumulativeDistance;
      const distInSegment = targetDist - p1.cumulativeDistance;
      const ratio = segmentDist > 0 ? distInSegment / segmentDist : 0;

      const lat = p1.lat + (p2.lat - p1.lat) * ratio;
      const lng = p1.lng + (p2.lng - p1.lng) * ratio;
      const currentPos = L.latLng(lat, lng);

      const isFlipped = p2.lng < p1.lng;
      const mode = p1.mode; 

      updateMapState(
        { lat, lng, mode, cumulativeDistance: targetDist }, 
        false, 
        isFlipped, 
        currentPos,
        currentZoom
      );

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, onAnimationComplete, map]);

  return null;
};

export const TravelMap: React.FC<TravelMapProps> = (props) => {
  return (
    // Scaled to 2.5 to ensure edges are covered when tilted
    <div 
      className={`w-full h-full bg-slate-900 transition-transform duration-[1500ms] ease-in-out ${props.isPlaying ? 'z-0' : ''}`}
      style={{
        transform: props.isPlaying ? 'perspective(1000px) rotateX(35deg) scale(2.5)' : 'none',
        transformOrigin: 'center 60%' 
      }}
    >
      <MapContainer 
        center={[59.3293, 18.0686]} 
        zoom={5} 
        className="w-full h-full"
        zoomControl={false}
        attributionControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer 
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png" 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> • Gemini 2.5 • OSRM'
        />
        <MapContent {...props} />
      </MapContainer>
    </div>
  );
};