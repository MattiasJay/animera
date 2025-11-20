export interface Coordinates {
  lat: number;
  lng: number;
}

export enum TransportMode {
  CAR = 'car',   // Samåkning
  TRAIN = 'train', // Tåg
  BUS = 'bus'    // Buss
}

export interface Waypoint {
  id: string;
  name: string;
  coords: Coordinates;
  modeToNext: TransportMode; // How do we travel TO the next point?
}

export interface RouteLeg {
  coordinates: Coordinates[];
  mode: TransportMode;
  distance: number;
  duration: number;
}

export interface RouteData {
  legs: RouteLeg[];
  totalDistance: number;
  totalDuration: number;
  boundingBox: [Coordinates, Coordinates]; // [SouthWest, NorthEast]
}

export interface PlaceResult {
  display_name: string;
  lat: string;
  lon: string;
}

export interface TripDetails {
  startName: string;
  endName: string;
  startCoords: Coordinates;
  endCoords: Coordinates;
  summary: string;
}