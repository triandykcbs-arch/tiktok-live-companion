
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Camera, Video, Music, Layers, Plus, Trash2, Play, Pause, SkipForward, ChevronUp, ChevronDown, Settings, Sliders, RefreshCw, X, RotateCcw, Square, Repeat, Clock, Search, Maximize2, Sun, ZoomIn } from 'lucide-react';
import { MediaItem, ViewMode, PlaylistState } from './types';

// Helper for generating unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

const STORAGE_KEY = 'tiktok_stream_companion_v1';

export default function App() {
  // --- INITIAL STATE LOADING ---
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_viewMode`);
    return (saved as ViewMode) || 'video-focus';
  });
  
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnScreenControls, setShowOnScreenControls] = useState(false);
  const controlsTimeoutRef = useRef<number | null>(null);
  
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_facingMode`);
    return (saved as 'user' | 'environment') || 'user';
  });
  
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Camera Settings State
  const [camSettings, setCamSettings] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_camSettings`);
    return saved ? JSON.parse(saved) : { brightness: 100, contrast: 100, zoom: 1 };
  });

  // Track hardware capabilities
  const [capabilities, setCapabilities] = useState<any>(null);
  
  // Playlist State
  const [playlists, setPlaylists] = useState<PlaylistState>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_playlists`);
    return saved ? JSON.parse(saved) : { videos: [], audios: [] };
  });
  
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
  const [currentAudioIdx, setCurrentAudioIdx] = useState(0);
  
  // Playback Control States
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isVideoLooping, setIsVideoLooping] = useState(() => {
    return localStorage.getItem(`${STORAGE_KEY}_videoLoop`) === 'true';
  });
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioLooping, setIsAudioLooping] = useState(() => {
    return localStorage.getItem(`${STORAGE_KEY}_audioLoop`) === 'true';
  });

  // Refs for media elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- MEMOIZED FILTERED PLAYLISTS ---
  const filteredItems = useMemo(() => {
    const items = activeTab === 'video' ? playlists.videos : playlists.audios;
    if (!searchQuery.trim()) return items;
    return items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeTab, playlists, searchQuery]);

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_playlists`, JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_camSettings`, JSON.stringify(camSettings));
  }, [camSettings]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_viewMode`, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_facingMode`, facingMode);
  }, [facingMode]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_videoLoop`, String(isVideoLooping));
  }, [isVideoLooping]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_audioLoop`, String(isAudioLooping));
  }, [isAudioLooping]);

  // Real-time Clock Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Camera
  useEffect(() => {
    async function setupCamera() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: facingMode, 
            aspectRatio: 9/16,
            width: { ideal: 1080 },
            height: { ideal: 1920 }
          }, 
          audio: true 
        });
        
        if (cameraRef.current) {
          cameraRef.current.srcObject = stream;
        }
        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        if (track && 'getCapabilities' in track) {
          const caps = (track as any).getCapabilities();
          setCapabilities(caps);
          if (caps.zoom && camSettings.zoom === 1) {
            setCamSettings(s => ({ ...s, zoom: caps.zoom.min }));
          }
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    }
    setupCamera();
    
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [facingMode]);

  // Sync Camera Hardware Settings
  useEffect(() => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    const constraints: any = { advanced: [] };
    
    if (capabilities?.zoom) {
      const zoomVal = Math.max(capabilities.zoom.min, Math.min(capabilities.zoom.max, camSettings.zoom));
      constraints.advanced.push({ zoom: zoomVal });
    }

    if (capabilities?.exposureCompensation) {
      const mid = (capabilities.exposureCompensation.min + capabilities.exposureCompensation.max) / 2;
      const range = capabilities.exposureCompensation.max - capabilities.exposureCompensation.min;
      const expoVal = mid + ((camSettings.brightness - 100) / 100) * (range / 2);
      constraints.advanced.push({ exposureCompensation: expoVal });
    }

    if (constraints.advanced.length > 0) {
      try {
        track.applyConstraints(constraints);
      } catch (e) {
        console.warn("Hardware constraints failed", e);
      }
    }
  }, [camSettings, capabilities]);

  // --- AUTO-PLAY HANDLERS ---
  useEffect(() => {
    if (isVideoPlaying && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [currentVideoIdx]);

  useEffect(() => {
    if (isAudioPlaying && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [currentAudioIdx]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'audio') => {
    const files = e.target.files;
    if (!files) return;

    const newItems: MediaItem[] = Array.from(files).map((file: File) => ({
      id: generateId(),
      name: file.name,
      url: URL.createObjectURL(file),
      type
    }));

    setPlaylists(prev => ({
      ...prev,
      [type === 'video' ? 'videos' : 'audios']: [...prev[type === 'video' ? 'videos' : 'audios'], ...newItems]
    }));
  };

  const removeItem = (id: string, type: 'video' | 'audio') => {
    setPlaylists(prev => ({
      ...prev,
      [type === 'video' ? 'videos' : 'audios']: prev[type === 'video' ? 'videos' : 'audios'].filter(i => i.id !== id)
    }));
  };

  const clearPlaylist = (type: 'video' | 'audio') => {
    if (confirm(`Clear all ${type}s?`)) {
      setPlaylists(prev => ({
        ...prev,
        [type === 'video' ? 'videos' : 'audios']: []
      }));
      if (type === 'video') setCurrentVideoIdx(0);
      else setCurrentAudioIdx(0);
    }
  };

  const toggleView = () => {
    setViewMode(prev => prev === 'video-focus' ? 'camera-focus' : 'video-focus');
    setShowOnScreenControls(false);
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const nextVideo = useCallback(() => {
    if (playlists.videos.length === 0) return;
    setCurrentVideoIdx(prev => (prev + 1) % playlists.videos.length);
  }, [playlists.videos.length]);

  const nextAudio = useCallback(() => {
    if (playlists.audios.length === 0) return;
    setCurrentAudioIdx(prev => (prev + 1) % playlists.audios.length);
  }, [playlists.audios.length]);

  const toggleVideoPlay = () => {
    if (videoRef.current) {
      if (isVideoPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  const handleVideoAreaClick = (e: React.MouseEvent) => {
    if (viewMode === 'camera-focus') return;
    setShowOnScreenControls(prev => !prev);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => setShowOnScreenControls(false), 3000);
  };

  const cameraStyle: React.CSSProperties = {
    filter: `brightness(${capabilities?.exposureCompensation ? 100 : camSettings.brightness}%) contrast(${camSettings.contrast}%)`,
    transform: `${facingMode === 'user' ? 'scaleX(-1)' : ''} ${!capabilities?.zoom ? `scale(${camSettings.zoom})` : ''}`,
    transformOrigin: 'center center',
  };

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center">
      
      {/* --- RENDER AREA --- */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-zinc-900">
        {/* Container Utama Portrait */}
        <div className="relative w-full h-full max-w-[56.25vh] aspect-[9/16] bg-black overflow-hidden shadow-2xl">
          
          <div className="relative w-full h-full">
            
            {/* 1. PLAYLIST VIDEO ELEMENT */}
            <video 
              ref={videoRef}
              src={playlists.videos[currentVideoIdx]?.url}
              className={`absolute transition-all duration-700 ease-in-out object-cover cursor-pointer ${
                viewMode === 'video-focus' 
                ? 'inset-0 w-full h-full z-0 rounded-none border-0' 
                : 'top-4 left-4 w-[32%] aspect-[9/16] z-30 rounded-2xl border-2 border-white/30 shadow-2xl hover:scale-105 active:scale-95'
              }`}
              autoPlay={isVideoPlaying}
              muted={viewMode === 'camera-focus'}
              onEnded={() => isVideoLooping ? (videoRef.current && (videoRef.current.currentTime = 0, videoRef.current.play())) : nextVideo()}
              playsInline
              onClick={(e) => {
                if (viewMode === 'camera-focus') {
                  e.stopPropagation();
                  toggleView();
                } else {
                  handleVideoAreaClick(e);
                }
              }}
            />

            {/* 2. CAMERA FEED ELEMENT */}
            <video 
              ref={cameraRef}
              autoPlay
              playsInline
              muted
              className={`absolute transition-all duration-700 ease-in-out object-cover cursor-pointer ${
                viewMode === 'camera-focus' 
                ? 'inset-0 w-full h-full z-0 rounded-none border-0' 
                : 'top-4 left-4 w-[32%] aspect-[9/16] z-30 rounded-2xl border-2 border-white/30 shadow-2xl hover:scale-105 active:scale-95'
              }`}
              style={cameraStyle}
              onClick={(e) => {
                if (viewMode === 'video-focus') {
                  e.stopPropagation();
                  toggleView();
                }
              }}
            />

            {/* Kontrol On-Screen Kamera (Saat Fokus) */}
            {viewMode === 'camera-focus' && (
              <>
                {/* Brightness Overlay */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 h-40 w-10 flex flex-col items-center gap-2 bg-black/20 backdrop-blur-md rounded-full py-4 border border-white/10">
                  <Sun className="w-4 h-4 text-white/50" />
                  <div className="relative h-full w-1 bg-white/20 rounded-full overflow-hidden">
                     <input 
                      type="range" 
                      min="0" max="200" 
                      value={camSettings.brightness} 
                      onChange={(e) => setCamSettings(s => ({ ...s, brightness: parseInt(e.target.value) }))}
                      className="absolute inset-0 w-40 h-10 -rotate-90 origin-center translate-x-[-75px] translate-y-[75px] bg-transparent appearance-none cursor-pointer accent-pink-500"
                    />
                  </div>
                </div>

                {/* Zoom Overlay */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-40 h-40 w-10 flex flex-col items-center gap-2 bg-black/20 backdrop-blur-md rounded-full py-4 border border-white/10">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-pink-500 font-mono">{camSettings.zoom.toFixed(1)}x</span>
                    <ZoomIn className="w-4 h-4 text-white/50" />
                  </div>
                  <div className="relative h-full w-1 bg-white/20 rounded-full overflow-hidden">
                     <input 
                      type="range" 
                      min={capabilities?.zoom?.min || 1} 
                      max={capabilities?.zoom?.max || 5} 
                      step="0.1"
                      value={camSettings.zoom} 
                      onChange={(e) => setCamSettings(s => ({ ...s, zoom: parseFloat(e.target.value) }))}
                      className="absolute inset-0 w-40 h-10 -rotate-90 origin-center translate-x-[-75px] translate-y-[75px] bg-transparent appearance-none cursor-pointer accent-pink-500"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Video Controls Overlay (Play/Pause) */}
            {viewMode === 'video-focus' && (
              <div className={`absolute inset-0 z-40 flex items-center justify-center gap-8 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-none ${showOnScreenControls ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={(e) => { e.stopPropagation(); toggleVideoPlay(); }} className="pointer-events-auto p-6 bg-white/20 hover:bg-white/30 backdrop-blur-xl rounded-full text-white border border-white/20 active:scale-90 transition-all shadow-xl">
                  {isVideoPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); (videoRef.current && (videoRef.current.pause(), videoRef.current.currentTime = 0, setIsVideoPlaying(false))); }} className="pointer-events-auto p-6 bg-red-500/40 hover:bg-red-500/60 backdrop-blur-xl rounded-full text-white border border-white/20 active:scale-90 transition-all shadow-xl">
                  <Square className="w-10 h-10 fill-current" />
                </button>
              </div>
            )}

            {/* Label PIP (Hanya muncul di PIP yang kecil) */}
            <div className={`absolute top-4 left-4 z-40 w-[32%] aspect-[9/16] pointer-events-none flex items-center justify-center`}>
               <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 flex items-center gap-1 scale-[0.7] opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-3 h-3 text-white" />
                  <span className="text-[10px] text-white font-bold uppercase tracking-widest">SWAP</span>
               </div>
            </div>

          </div>

          {/* Clock Overlay */}
          <div className="absolute top-4 right-4 z-40 flex items-center gap-1.5 px-2.5 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 text-white pointer-events-none">
            <Clock className="w-3.5 h-3.5 text-pink-500" />
            <span className="text-sm font-mono font-medium">{timeString}</span>
          </div>
        </div>
      </div>

      {/* Audio Player */}
      <audio 
        ref={audioRef} 
        src={playlists.audios[currentAudioIdx]?.url} 
        onEnded={() => isAudioLooping ? (audioRef.current && (audioRef.current.currentTime = 0, audioRef.current.play())) : nextAudio()} 
        onPlay={() => setIsAudioPlaying(true)} 
        onPause={() => setIsAudioPlaying(false)} 
      />

      {/* --- UI DRAWER (BOTTOM) --- */}
      <div className={`absolute bottom-0 w-full z-50 transition-transform duration-300 ${isControlsVisible ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'}`}>
        <button onClick={() => setIsControlsVisible(!isControlsVisible)} className="mx-auto flex items-center justify-center w-12 h-8 bg-zinc-800/90 backdrop-blur-xl rounded-t-2xl border-t border-x border-white/10">
          {isControlsVisible ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>

        <div className="w-full bg-zinc-900/95 backdrop-blur-2xl border-t border-white/10 p-4 pb-8 space-y-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <div className="flex bg-white/5 p-1 rounded-xl">
            <button onClick={() => setActiveTab('video')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'video' ? 'bg-white text-black shadow-md' : 'text-white/60'}`}>
              <Video className="w-4 h-4" /> Video
            </button>
            <button onClick={() => setActiveTab('audio')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'audio' ? 'bg-white text-black shadow-md' : 'text-white/60'}`}>
              <Music className="w-4 h-4" /> Audio
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-pink-500 transition-colors" />
            <input type="text" placeholder={`Search ${activeTab}s...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-pink-500/50 transition-all" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-white/40 tracking-widest">{activeTab} Playlist</h3>
              <div className="flex items-center gap-3">
                <button onClick={() => clearPlaylist(activeTab)} className="text-[10px] font-bold text-white/30 hover:text-red-500 uppercase tracking-widest transition-colors">Clear</button>
                <label className="cursor-pointer flex items-center gap-1 text-xs font-bold text-pink-500 hover:text-pink-400">
                  <Plus className="w-4 h-4" /> Add <input type="file" multiple accept={activeTab === 'video' ? 'video/*' : 'audio/*'} className="hidden" onChange={(e) => handleFileUpload(e, activeTab)} />
                </label>
              </div>
            </div>

            <div className="h-32 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {filteredItems.map((item) => {
                const originalIdx = (activeTab === 'video' ? playlists.videos : playlists.audios).indexOf(item);
                const isActive = (activeTab === 'video' ? currentVideoIdx : currentAudioIdx) === originalIdx;
                return (
                  <div key={item.id} className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${ isActive ? 'bg-pink-500/10 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.1)]' : 'bg-white/5 border-transparent hover:border-white/10' }`}>
                    <button onClick={() => activeTab === 'video' ? setCurrentVideoIdx(originalIdx) : setCurrentAudioIdx(originalIdx)} className="flex-1 text-left truncate">
                      <p className={`text-sm font-medium truncate ${ isActive ? 'text-pink-400' : 'text-white' }`}>{originalIdx + 1}. {item.name}</p>
                    </button>
                    <button onClick={() => removeItem(item.id, activeTab)} className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Master Audio Bar */}
          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 relative overflow-hidden">
            <div className="flex-1 truncate">
              <p className="text-[10px] text-white/40 font-bold uppercase mb-0.5 tracking-wider">Now Playing</p>
              <p className="text-xs font-medium truncate text-white">{playlists.audios[currentAudioIdx]?.name || "None"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsAudioLooping(!isAudioLooping)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isAudioLooping ? 'bg-pink-500 text-white shadow-lg' : 'bg-white/5 text-white/60 hover:text-white'}`}><Repeat className="w-5 h-5" /></button>
              <button onClick={() => { if (isAudioPlaying) audioRef.current?.pause(); else audioRef.current?.play(); setIsAudioPlaying(!isAudioPlaying); }} className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full shadow-lg active:scale-90 transition-transform">
                {isAudioPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
              </button>
              <button onClick={nextAudio} className="w-10 h-10 flex items-center justify-center bg-white/10 text-white rounded-xl active:scale-95 hover:bg-white/20 transition-all"><SkipForward className="w-5 h-5" /></button>
            </div>
          </div>

          {/* Master Toolbar */}
          <div className="grid grid-cols-3 gap-3">
            <button onClick={toggleView} className="flex flex-col items-center justify-center gap-1 bg-zinc-800 py-3 rounded-2xl border border-white/5 text-white/80 active:bg-zinc-700 hover:text-white transition-all">
              <Layers className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Swap Mode</span>
            </button>
            <button onClick={toggleFacingMode} className="flex flex-col items-center justify-center gap-1 bg-zinc-800 py-3 rounded-2xl border border-white/5 text-white/80 active:bg-zinc-700 hover:text-white transition-all">
              <RotateCcw className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Flip Cam</span>
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="flex flex-col items-center justify-center gap-1 bg-zinc-800 py-3 rounded-2xl border border-white/5 text-white/80 active:bg-zinc-700 hover:text-white transition-all">
              <Settings className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Config</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
