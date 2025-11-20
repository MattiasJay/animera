import { Coordinates, RouteData, RouteLeg, TransportMode, Waypoint } from "../types";

// OSRM Public server
const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

export const getMultiStopRoute = async (waypoints: Waypoint[]): Promise<RouteData> => {
  if (waypoints.length < 2) {
    throw new Error("At least 2 waypoints needed");
  }

  const legs: RouteLeg[] = [];
  let totalDistance = 0;
  let totalDuration = 0;

  // Process the route segment by segment
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    const mode = start.modeToNext;

    try {
      const url = `${OSRM_BASE_URL}/${start.coords.lng},${start.coords.lat};${end.coords.lng},${end.coords.lat}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const json = await response.json();

      if (json.code === "Ok" && json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        const geoJsonCoords = route.geometry.coordinates;
        const coordinates: Coordinates[] = geoJsonCoords.map((c: number[]) => ({
          lat: c[1],
          lng: c[0],
        }));

        legs.push({
          coordinates,
          mode: mode,
          distance: route.distance,
          duration: route.duration
        });
        totalDistance += route.distance;
        totalDuration += route.duration;
      } else {
        // Fallback to straight line if OSRM fails
        legs.push({
          coordinates: [start.coords, end.coords],
          mode: mode,
          distance: 0,
          duration: 0
        });
      }
    } catch (e) {
      console.error("OSRM Error", e);
      legs.push({
          coordinates: [start.coords, end.coords],
          mode: mode,
          distance: 0,
          duration: 0
      });
    }
  }

  // Calculate bounding box
  const allCoords = legs.flatMap(l => l.coordinates);
  
  // Default bounds (Sweden-ish) if no data
  let boundingBox: [Coordinates, Coordinates] = [
      { lat: 55.3, lng: 11.0 },
      { lat: 69.0, lng: 24.0 }
  ];

  if (allCoords.length > 0) {
    const lats = allCoords.map(c => c.lat);
    const lngs = allCoords.map(c => c.lng);
    
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);

    // Ensure finite numbers
    if (isFinite(minLat) && isFinite(maxLat) && isFinite(minLng) && isFinite(maxLng)) {
        
        // Add reasonable padding to prevent max zoom on single points
        const minDiff = 0.05; // Approx 5km padding minimum
        
        if (maxLat - minLat < minDiff) {
            const center = (maxLat + minLat) / 2;
            maxLat = center + minDiff;
            minLat = center - minDiff;
        }
        if (maxLng - minLng < minDiff) {
            const center = (maxLng + minLng) / 2;
            maxLng = center + minDiff;
            minLng = center - minDiff;
        }

        boundingBox = [
            { lat: minLat, lng: minLng },
            { lat: maxLat, lng: maxLng }
        ];
    }
  }

  return {
    legs,
    totalDistance,
    totalDuration,
    boundingBox
  };
};