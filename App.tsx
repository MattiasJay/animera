import React, { useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { TravelMap } from './components/TravelMap';
import { getMultiStopRoute } from './services/routeService';
import { RouteData, Waypoint } from './types';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUIHidden, setUIHidden] = useState(false);

  const handleGenerateRoute = async (waypoints: Waypoint[]) => {
    setIsLoading(true);
    setIsPlaying(false); // Stop playing if route changes
    
    try {
      // 1. Get Route Geometry (OSRM)
      const route = await getMultiStopRoute(waypoints);
      setRouteData(route);

    } catch (error) {
      console.error("Failed to generate trip:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen relative bg-slate-900 overflow-hidden flex flex-col">
      <ControlPanel 
        isLoading={isLoading} 
        onGenerateRoute={handleGenerateRoute}
        onStartAnimation={() => {
          if (routeData) setIsPlaying(true);
        }}
        onPauseAnimation={() => setIsPlaying(false)}
        onResetAnimation={() => {
          setIsPlaying(false);
          // We let the TravelMap internal effect handle the progress reset when we toggle back to play
          // But to force a reset, we momentarily stop.
        }}
        isPlaying={isPlaying}
        isHidden={isUIHidden}
        setUIHidden={setUIHidden}
      />
      
      <div 
        className="flex-1 relative"
        onClick={() => { if(isPlaying) setIsPlaying(false); }}
      >
        <TravelMap 
          routeData={routeData}
          isPlaying={isPlaying}
          onAnimationComplete={() => setIsPlaying(false)}
        />
      </div>
    </div>
  );
};

export default App;