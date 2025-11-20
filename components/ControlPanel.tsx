import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Loader2, Play, Plus, Trash2, Video, StopCircle, Car, Train, Bus, GripVertical } from 'lucide-react';
import { TransportMode, Waypoint, Coordinates, PlaceResult } from '../types';
import { searchPlaces } from '../services/placeService';

interface ControlPanelProps {
  isLoading: boolean;
  onGenerateRoute: (waypoints: Waypoint[]) => void;
  onStartAnimation: () => void;
  onPauseAnimation: () => void;
  onResetAnimation: () => void;
  isPlaying: boolean;
  isHidden: boolean; // New prop to hide UI
  setUIHidden: (hidden: boolean) => void; // Callback to hide/show
}

// Icons map
const ModeIcons = {
  [TransportMode.CAR]: Car,
  [TransportMode.TRAIN]: Train,
  [TransportMode.BUS]: Bus,
};

const ModeLabels = {
  [TransportMode.CAR]: 'Samåkning',
  [TransportMode.TRAIN]: 'Tåg',
  [TransportMode.BUS]: 'Buss',
};

// --- Autocomplete Input Component ---
const PlaceInput = ({ 
  value, 
  onChange, 
  onSelect, 
  placeholder, 
  className 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  onSelect: (name: string, coords: Coordinates) => void,
  placeholder: string,
  className?: string
}) => {
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (value.length > 2 && showSuggestions) {
        const results = await searchPlaces(value);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [value, showSuggestions]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  return (
    <div 
      ref={wrapperRef} 
      className={`relative ${className}`}
      // CRITICAL: Stop propagation so the input allows selection and doesn't trigger parent drag
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={(e) => {
          setShowSuggestions(true);
          e.target.select(); // Select all text on click
        }}
        // Double security to ensure clicks inside input don't start drag
        onMouseDown={(e) => e.stopPropagation()}
        className="block w-full pl-10 pr-3 py-3 border-b border-slate-200 bg-transparent focus:border-indigo-500 focus:ring-0 outline-none transition-all placeholder-slate-400 font-medium text-slate-800 cursor-text"
        placeholder={placeholder}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 bg-white shadow-xl rounded-lg border border-slate-100 max-h-60 overflow-y-auto z-[9999]">
          {suggestions.map((place, i) => (
            <li 
              key={i}
              onClick={() => {
                onSelect(place.display_name.split(',')[0], { lat: parseFloat(place.lat), lon: parseFloat(place.lon) } as any);
                setShowSuggestions(false);
              }}
              className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm text-slate-700 border-b border-slate-50 last:border-0"
            >
              {place.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  isLoading, 
  onGenerateRoute, 
  onStartAnimation,
  onPauseAnimation,
  onResetAnimation,
  isPlaying,
  isHidden,
  setUIHidden
}) => {
  // Default Route: Östersund (Samåkning) -> Stockholm (Tåg) -> Malmö
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: 'start', name: 'Östersund', coords: { lat: 63.1792, lng: 14.6360 }, modeToNext: TransportMode.CAR },
    { id: 'stop1', name: 'Stockholm', coords: { lat: 59.3293, lng: 18.0686 }, modeToNext: TransportMode.TRAIN },
    { id: 'end', name: 'Malmö', coords: { lat: 55.6050, lng: 13.0038 }, modeToNext: TransportMode.CAR } 
  ]);
  const [isRecording, setIsRecording] = useState(false);
  
  // Drag State
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  
  // Use a ref to track if it's the first load to bypass debounce
  const isFirstLoad = useRef(true);

  // --- Live Route Generation ---
  useEffect(() => {
    // Check if all waypoints have valid coordinates
    const valid = waypoints.every(w => w.coords.lat !== 0);
    
    if (!valid || isPlaying) return;

    if (isFirstLoad.current) {
      // IMMEDIATE execution on first load
      onGenerateRoute(waypoints);
      isFirstLoad.current = false;
    } else {
      // Debounce for subsequent updates
      const timer = setTimeout(() => {
          onGenerateRoute(waypoints);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [waypoints, isPlaying]);


  const addWaypoint = () => {
    const newPoint: Waypoint = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      coords: { lat: 0, lng: 0 },
      modeToNext: TransportMode.CAR
    };
    // Insert before the last point
    const newList = [...waypoints];
    newList.splice(newList.length - 1, 0, newPoint);
    setWaypoints(newList);
  };

  const removeWaypoint = (index: number) => {
    if (waypoints.length <= 2) return;
    const newList = [...waypoints];
    newList.splice(index, 1);
    setWaypoints(newList);
  };

  const updateWaypoint = (index: number, field: keyof Waypoint, value: any) => {
    const newList = [...waypoints];
    newList[index] = { ...newList[index], [field]: value };
    setWaypoints(newList);
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
    setDraggingIndex(position);
    // Set data transfer to allow drag
    e.dataTransfer.effectAllowed = 'move';
    // A small hack to make the drag image not obstruct view, or you can set a custom one
    // e.dataTransfer.setDragImage(e.currentTarget, 0, 0); 
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    e.preventDefault();
    dragOverItem.current = position;
    setDragOverIndex(position);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    const start = dragItem.current;
    const end = dragOverItem.current;

    if (start !== null && end !== null && start !== end) {
      const newList = [...waypoints];
      const item = newList[start];
      newList.splice(start, 1);
      newList.splice(end, 0, item);
      setWaypoints(newList);
    }
    
    // Reset state
    setDraggingIndex(null);
    setDragOverIndex(null);
    dragItem.current = null;
    dragOverItem.current = null;
  };


  // Browser Screen Recording Logic
  const startRecording = async () => {
    try {
      // 1. Select screen
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false,
      });
      
      // 2. Reset everything first
      onResetAnimation();
      
      // 3. Hide UI
      setUIHidden(true);

      const mimeType = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `travel-boast-animation.${mimeType === "video/mp4" ? "mp4" : "webm"}`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
        // Show UI again
        setUIHidden(false);
        // Stop tracks
        stream.getTracks().forEach(track => track.stop());
      };

      // 4. Wait a moment for UI to hide and map to reset, then start
      setTimeout(() => {
        mediaRecorder.start();
        setIsRecording(true);
        onStartAnimation();
      }, 1000);

    } catch (err) {
      console.error("Error starting screen record:", err);
      setUIHidden(false);
    }
  };

  if (isHidden) return null;

  return (
    <div className={`absolute top-4 left-4 right-4 md:right-auto z-[1000] w-auto md:w-full max-w-md max-h-[90vh] flex flex-col pointer-events-none transition-all duration-500 ease-in-out ${isPlaying ? 'opacity-0 -translate-y-10 md:opacity-100 md:translate-y-0' : 'opacity-100 translate-y-0'}`}>
      {/* Main Control Box */}
      <div className={`bg-white/95 backdrop-blur-md text-slate-900 rounded-2xl shadow-2xl border border-white/50 flex flex-col max-h-full ${isPlaying ? 'pointer-events-none md:pointer-events-auto' : 'pointer-events-auto'}`}>
        <div className="p-5 overflow-y-auto custom-scrollbar">
          <h1 className="text-xl font-bold mb-6 flex items-center gap-2 text-[#0099ff]">
            Animera min resa
          </h1>
          
          <div className="space-y-0 relative">
            {/* Connecting Line */}
            <div 
              className="absolute left-[31px] bg-slate-200 w-0.5 z-0"
              style={{ 
                top: '1.5rem', 
                bottom: waypoints.length > 1 ? '3.5rem' : '1.5rem' 
              }}
            ></div>

            {waypoints.map((point, index) => {
              const isDragging = draggingIndex === index;
              const isDragOver = dragOverIndex === index && draggingIndex !== index;
              
              return (
                <div 
                  key={point.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragOver={(e) => e.preventDefault()} // Necessary to allow dropping
                  onDragEnd={handleDragEnd} 
                  className={`relative mb-2 transition-all duration-300
                    ${isDragging ? 'opacity-0' : 'opacity-100'}
                    ${isDragOver ? 'mt-[90px]' : 'mt-0'} 
                  `}
                  // Z-index: Dragged item highest, others ordered naturally
                  style={{ 
                    zIndex: isDragging ? 9999 : 10 + index,
                  }}
                >
                  {/* Visual Drop Indicator (Ghost Space) when hovering */}
                  {isDragOver && (
                    <div className="absolute -top-[85px] left-0 right-0 h-[80px] border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50/50 flex items-center justify-center text-indigo-400 text-xs font-bold pointer-events-none">
                      Släpp här
                    </div>
                  )}

                  <div className={`group bg-white rounded-xl transition-all duration-200 ${isDragging ? 'shadow-2xl scale-105 ring-2 ring-indigo-500' : ''}`}>
                      <div className={`flex items-center gap-2 mb-1 relative z-10 ${isDragging ? 'p-2' : ''}`}>
                        {/* Drag Handle */}
                        <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1">
                            <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Dot */}
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 z-10 shadow-sm ${index === 0 ? 'bg-[#0099ff] border-[#b3e0ff]' : index === waypoints.length - 1 ? 'bg-pink-500 border-pink-200' : 'bg-white border-slate-400'}`}></div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="relative flex-1 group/input">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MapPin className="h-4 w-4 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors" />
                            </div>
                            {/* PlaceInput stops propagation so you can select text without dragging */}
                            <PlaceInput
                                value={point.name}
                                placeholder="Stad..."
                                onSelect={(name, coords) => {
                                const newPoint = { ...point, name, coords: { lat: coords.lat, lng: (coords as any).lon }};
                                const newList = [...waypoints];
                                newList[index] = newPoint;
                                setWaypoints(newList);
                                }}
                                onChange={(val) => updateWaypoint(index, 'name', val)}
                                className=""
                            />
                            </div>
                        </div>

                        {/* Delete Button */}
                        {waypoints.length > 2 && (
                        <button onClick={() => removeWaypoint(index)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                        )}
                      </div>

                      {/* Transport Mode Selector (To Next Point) */}
                      {index < waypoints.length - 1 && (
                        <div 
                          className={`ml-[42px] mt-1 mb-3 flex gap-1 relative z-0 ${isDragging ? 'pl-2' : ''}`}
                          onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking buttons
                        >
                        {Object.values(TransportMode).map((mode) => {
                            const Icon = ModeIcons[mode];
                            const label = ModeLabels[mode];
                            const isSelected = point.modeToNext === mode;
                            
                            let activeClass = '';
                            // Adjusted colors: Car = Blue (#0099ff style), Train = Green, Bus = Pink
                            if(mode === TransportMode.CAR) activeClass = 'bg-[#e6f5ff] text-[#0099ff] border-[#b3e0ff]';
                            if(mode === TransportMode.TRAIN) activeClass = 'bg-green-100 text-green-700 border-green-200';
                            if(mode === TransportMode.BUS) activeClass = 'bg-pink-100 text-pink-700 border-pink-200';

                            return (
                            <button
                                key={mode}
                                onClick={() => updateWaypoint(index, 'modeToNext', mode)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${isSelected ? activeClass : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                title={`Res med ${label}`}
                            >
                                <Icon className="w-3 h-3" />
                                {label}
                            </button>
                            );
                        })}
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={addWaypoint}
            className="ml-[38px] mt-2 mb-8 flex items-center gap-2 text-xs font-bold text-white bg-slate-800 px-4 py-2 rounded-full hover:bg-slate-700 transition-all shadow-md w-fit"
          >
            <Plus className="w-3 h-3" />
            LÄGG TILL STOPP
          </button>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={isPlaying ? onPauseAnimation : onStartAnimation}
              className={`col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 ${
                isPlaying 
                  ? 'bg-amber-500 hover:bg-amber-600' 
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {isPlaying ? <StopCircle className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              {isPlaying ? 'Pausa' : 'Spela'}
            </button>

            <button
              onClick={startRecording}
              disabled={isRecording}
              className={`col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 ${
                isRecording
                  ? 'bg-red-500 animate-pulse cursor-not-allowed'
                  : 'bg-[#0099ff] hover:bg-[#007acc]'
              }`}
            >
              <Video className="w-5 h-5" />
              {isRecording ? 'Spelar in...' : 'Spara Video'}
            </button>
          </div>
          
          {isLoading && (
             <div className="text-center text-xs text-slate-500 mb-2 flex items-center justify-center gap-2">
                 <Loader2 className="w-3 h-3 animate-spin" />
                 Uppdaterar rutt...
             </div>
          )}
        </div>
      </div>

      {/* Disclaimer & Attribution Box (Attached below main panel) */}
      <div className={`mt-2 bg-white/95 backdrop-blur-md text-slate-900 rounded-xl shadow-xl border border-white/50 p-3 text-xs flex flex-col gap-2 shrink-0 ${isPlaying ? 'pointer-events-none md:pointer-events-auto' : 'pointer-events-auto'}`}>
          <p className="leading-relaxed">
            Detta är ett proof of concept. Tåget följer exempelvis just nu bilvägen. Häng med i utvecklingen på{' '}
            <a 
              href="https://forum.skjutsgruppen.se/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold underline decoration-black underline-offset-2 hover:opacity-70 transition-opacity text-black"
            >
              forum.skjutsgruppen.se
            </a>
          </p>
      </div>
    </div>
  );
};