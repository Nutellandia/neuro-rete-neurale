
import React, { useRef, useState, useEffect } from 'react';
import { VisualFocus, LifeStage, DeviceInfo, CameraSettings } from '../types';

interface OcularSystemProps {
  onCapture: (base64Image: string, intensity?: number) => void;
  onZoomChange: (delta: number, absolute?: number) => void;
  onCameraChange: () => void;
  onDevicesFound: (devices: DeviceInfo[]) => void;
  onFocusChange?: (x: number, y: number) => void;
  onToggleEyelids: (isOpen: boolean) => void;
  onSettingsChange: (settings: Partial<CameraSettings>) => void;
  isActive: boolean;
  focus: VisualFocus;
  stage: LifeStage;
  isSleeping?: boolean;
  selectedDeviceId?: string | null;
  isUiVisible?: boolean; // New prop for optimization
}

const getVisualResolution = (stage: LifeStage): number => {
    switch (stage) {
        case LifeStage.PROGENITORE: return 16;
        case LifeStage.GANGLIO: return 32;
        case LifeStage.SISTEMA_LIMBICO: return 64;
        case LifeStage.NEOCORTECCIA: return 128;
        case LifeStage.CORTECCIA_ASSOCIATIVA: return 320;
        case LifeStage.CERVELLO_MATURO: return 640;
        case LifeStage.POST_UMANO: return 1280;
        default: return 32;
    }
};

const OcularSystem: React.FC<OcularSystemProps> = ({ 
    onCapture, onZoomChange, onCameraChange, onDevicesFound, onFocusChange, onToggleEyelids, onSettingsChange,
    isActive, focus, stage, isSleeping = false, selectedDeviceId = null, isUiVisible = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null); 
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const streamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const opticNerveIntervalRef = useRef<number | null>(null);
  const renderLoopRef = useRef<number | null>(null);

  const [streamActive, setStreamActive] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [staticMedia, setStaticMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [isManuallyDisabled, setIsManuallyDisabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [viewMode, setViewMode] = useState<'NET' | 'RAW'>('NET');
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(4/3); // Default aspect ratio
  
  const [capabilities, setCapabilities] = useState<MediaTrackCapabilities | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const focusStartRef = useRef<{ x: number, y: number } | null>(null);

  const [manualMirror, setManualMirror] = useState(true); 

  // Refs for loop access to latest props without re-binding
  const isUiVisibleRef = useRef(isUiVisible);
  useEffect(() => { isUiVisibleRef.current = isUiVisible; }, [isUiVisible]);

  const matrixSize = getVisualResolution(stage);
  const zoomPercentage = Math.min(100, Math.max(0, ((focus.zoom - 0.5) / 2.5) * 100));

  // FORCE VIDEO ELEMENT UPDATE
  useEffect(() => {
      if (streamActive && videoRef.current && streamRef.current && !videoRef.current.srcObject) {
          videoRef.current.srcObject = streamRef.current;
      }
  });

  useEffect(() => {
    const listDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            const info: DeviceInfo[] = videoDevices.map(d => ({
                id: d.deviceId,
                label: d.label || `Camera ${d.deviceId.substr(0,4)}`,
                type: 'video' as const
            }));
            onDevicesFound(info);
        } catch(e) { console.warn("Camera enumeration failed", e); }
    };
    if (isActive) listDevices();
  }, [isActive]);

  useEffect(() => {
      if (isActive && !isManuallyDisabled && !staticMedia && streamActive) {
          // Force restart to apply new device ID immediately
          startCamera();
      }
  }, [selectedDeviceId]);

  useEffect(() => {
    if (videoTrackRef.current && streamActive && capabilities) {
        const constraints: any = {};
        if (capabilities.exposureCompensation && focus.cameraSettings) {
            const min = capabilities.exposureCompensation.min || -2;
            const max = capabilities.exposureCompensation.max || 2;
            let target = focus.cameraSettings.exposureCompensation;
            target = Math.max(min, Math.min(max, target));
            constraints.exposureCompensation = target;
        }
        if (Object.keys(constraints).length > 0) {
            videoTrackRef.current.applyConstraints({ advanced: [constraints] })
                .catch(err => console.debug("Failed to apply constraints", err));
        }
    }
  }, [focus.cameraSettings, streamActive, capabilities]);

  useEffect(() => {
      if (isManuallyDisabled || !isActive || isSleeping) {
          stopOpticNerve(); 
      } else if (isActive && !isManuallyDisabled && !isSleeping && (streamActive || staticMedia || focus.eyesClosed)) {
          startOpticNerve();
      }
  }, [isManuallyDisabled, isActive, streamActive, staticMedia, isSleeping, focus.eyesClosed]);

  const startCamera = async () => {
    setPermissionError(false);
    setErrorMsg("");
    
    // Completely stop previous stream first
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    // Clear video src to prevent ghosting
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
          video: selectedDeviceId 
            ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream; 
      
      const track = stream.getVideoTracks()[0];
      videoTrackRef.current = track;
      
      const caps = track.getCapabilities ? track.getCapabilities() : null;
      setCapabilities(caps);

      if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => {
              if (e.name !== 'AbortError') console.error("Camera play error", e);
          });
      }
      
      const settings = track.getSettings();
      // Logic for mirroring: 'user' facing cameras usually mirrored, environment not.
      const shouldMirror = settings.facingMode === 'user' || (!settings.facingMode && !selectedDeviceId);
      setManualMirror(shouldMirror); 
      
      if (settings.aspectRatio) {
          setVideoAspectRatio(settings.aspectRatio);
      }

      setStreamActive(true);
      startOpticNerve();

    } catch (err: any) {
      console.warn("Camera Start Error handled:", err.message);
      setStreamActive(false);
      setPermissionError(true);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMsg("PERMESSO NEGATO");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setErrorMsg("CAMERA IN USO");
      } else if (err.name === 'NotFoundError') {
          setErrorMsg("CAMERA NON TROVATA");
      } else {
          setErrorMsg("ERRORE CAMERA");
      }
    }
  };

  const stopCamera = () => {
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
      videoTrackRef.current = null;
      if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.srcObject = null;
      }
      setStreamActive(false);
      stopOpticNerve();
      if(isManuallyDisabled) onCapture("", 0);
  };

  const startOpticNerve = () => {
      if (opticNerveIntervalRef.current) clearInterval(opticNerveIntervalRef.current);
      // BACKGROUND PROCESS: Frame capture for brain (Always runs if active)
      opticNerveIntervalRef.current = window.setInterval(() => {
          if (!isSleeping) captureFrameForBrain(true);
      }, 500);

      // UI RENDER LOOP: Only runs if UI is visible to save GPU
      const loop = () => {
          if (isUiVisibleRef.current && viewMode === 'NET' && !focus.eyesClosed && !isSleeping) {
              renderNetView();
          }
          renderLoopRef.current = requestAnimationFrame(loop);
      };
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
      renderLoopRef.current = requestAnimationFrame(loop);
  };

  const stopOpticNerve = () => {
      if (opticNerveIntervalRef.current) {
          clearInterval(opticNerveIntervalRef.current);
          opticNerveIntervalRef.current = null;
      }
      if (renderLoopRef.current) {
          cancelAnimationFrame(renderLoopRef.current);
          renderLoopRef.current = null;
      }
  };

  useEffect(() => {
    const shouldBeActive = isActive && !staticMedia && !isManuallyDisabled && !focus.eyesClosed;
    if (shouldBeActive && !streamActive && !permissionError) {
        startCamera().catch(e => {
            console.log("Auto-start failed, waiting for user interaction");
        });
    } else if (!shouldBeActive && streamActive) {
        stopCamera();
    }
    return () => {
        stopOpticNerve();
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [isActive, staticMedia, isManuallyDisabled, focus.eyesClosed]); 
  
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
      if (!onFocusChange || !containerRef.current) return;
      setIsDragging(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      dragStartRef.current = { x: clientX, y: clientY };
      focusStartRef.current = { x: focus.x, y: focus.y };
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging || !dragStartRef.current || !focusStartRef.current || !onFocusChange || !containerRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      
      const { width, height } = containerRef.current.getBoundingClientRect();
      const percentX = (deltaX / width) * 100 * 1.5; 
      const percentY = (deltaY / height) * 100 * 1.5;

      const newX = focusStartRef.current.x - percentX; // Inverted (Drag Scene)
      const newY = focusStartRef.current.y - percentY; // Inverted

      onFocusChange(newX, newY);
    };

  const handleDragEnd = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      focusStartRef.current = null;
  };

  const handleVideoMetadata = () => {
      if (videoRef.current) {
          const w = videoRef.current.videoWidth;
          const h = videoRef.current.videoHeight;
          if (w && h) {
              setVideoAspectRatio(w / h);
          }
      }
  };

  const drawSourceToCanvas = (ctx: CanvasRenderingContext2D, targetSize: number) => {
      const sourceElement = staticMedia ? imageRef.current : videoRef.current;
      if (!sourceElement) return false;

      if (!staticMedia && sourceElement instanceof HTMLVideoElement) {
          if (sourceElement.readyState < 2) return false;
      }

      const width = (sourceElement as any).videoWidth || (sourceElement as any).naturalWidth;
      const height = (sourceElement as any).videoHeight || (sourceElement as any).naturalHeight;

      if (width > 0 && height > 0) {
          ctx.canvas.width = targetSize;
          ctx.canvas.height = targetSize;
          ctx.imageSmoothingEnabled = false; 

          const safeZoom = Math.max(1, focus.zoom);
          let viewW = width / safeZoom;
          let viewH = height / safeZoom;
          const panFactorX = Math.max(0, Math.min(1, (focus.x + 50) / 100));
          const panFactorY = Math.max(0, Math.min(1, (focus.y + 50) / 100));
          const maxSrcX = width - viewW;
          const maxSrcY = height - viewH;
          let sourceX = maxSrcX * panFactorX;
          let sourceY = maxSrcY * panFactorY;

          sourceX = Math.max(0, Math.min(sourceX, width - 1));
          sourceY = Math.max(0, Math.min(sourceY, height - 1));

          if (manualMirror && !staticMedia) {
              ctx.translate(targetSize, 0);
              ctx.scale(-1, 1);
          }

          try {
              ctx.drawImage(sourceElement as CanvasImageSource, sourceX, sourceY, viewW, viewH, 0, 0, targetSize, targetSize);
              if (manualMirror && !staticMedia) {
                  ctx.setTransform(1, 0, 0, 1, 0, 0);
              }
              return true;
          } catch (e) { return false; }
      }
      return false;
  };

  const captureFrameForBrain = (isAutoCapture: boolean = false) => {
    if (isSleeping) return;

    if (focus.eyesClosed) {
        onCapture("VISUAL_DARKNESS", 0); 
        return;
    }

    if (!processingCanvasRef.current || (!streamActive && !staticMedia)) return;

    const ctx = processingCanvasRef.current.getContext('2d');
    if(!ctx) return;

    if (drawSourceToCanvas(ctx, matrixSize)) {
        const dataUrl = processingCanvasRef.current.toDataURL('image/jpeg', 0.6);
        const base64 = dataUrl.split(',')[1];
        onCapture(base64, 1.0);
    }
  };

  const renderNetView = () => {
      if (!displayCanvasRef.current) return;
      const ctx = displayCanvasRef.current.getContext('2d');
      if (!ctx) return;
      drawSourceToCanvas(ctx, matrixSize);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const result = event.target?.result as string;
        if(onFocusChange) onFocusChange(0,0);
        setStaticMedia({ url: result, type: 'image' });
        setPermissionError(false); 
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearStaticMedia = () => {
      setStaticMedia(null);
  };
  
  return (
    <div className="bg-bio-panel p-2 rounded-lg border border-gray-700 relative transition-all duration-300">
      <div className="text-xs font-mono text-bio-accent mb-2 flex flex-col gap-1">
        <div className="flex justify-between items-center">
            <span>SISTEMA OCULARE (ARGUS)</span>
            <div className="flex gap-2 items-center">
                <span className={`text-[10px] ${streamActive || staticMedia ? "text-green-500 animate-pulse" : (permissionError ? "text-red-500 font-bold" : "text-gray-500")}`}>
                    {staticMedia ? "● STATIC" : (streamActive ? "● LIVE" : (permissionError ? "⚠ ERROR" : "○ OFF"))}
                </span>
            </div>
        </div>
        {focus.currentEyeLabel && (
            <div className="text-[9px] text-gray-500 truncate uppercase flex justify-between">
                <span>INPUT: {focus.currentEyeLabel}</span>
                <span className="text-gray-600">RES: {matrixSize}px</span>
            </div>
        )}
      </div>

      {showSettings && (
          <div className="mb-2 bg-black/40 p-2 rounded border border-indigo-900/50 animate-fade-in">
              {capabilities?.exposureCompensation ? (
                  <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] text-gray-400 font-mono">
                          <span>ESPOSIZIONE (EV)</span>
                          <span className="text-white">{focus.cameraSettings?.exposureCompensation.toFixed(1)}</span>
                      </div>
                      <input 
                        type="range"
                        min={capabilities.exposureCompensation.min}
                        max={capabilities.exposureCompensation.max}
                        step={capabilities.exposureCompensation.step}
                        value={focus.cameraSettings?.exposureCompensation || 0}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            onSettingsChange({ exposureCompensation: val });
                        }}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                      />
                  </div>
              ) : (
                  <div className="text-[8px] text-gray-600 text-center">DRIVERS/SETTINGS NON DISPONIBILI</div>
              )}
          </div>
      )}
      
      {/* FRAME CONTROLLER - Aspect Ratio Enforced */}
      <div 
        ref={containerRef}
        className={`relative w-full aspect-video bg-[#000] rounded overflow-hidden border-[1px] border-gray-800 flex items-center justify-center`}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        {/* INNER CONTAINER: Enforces the Camera's Aspect Ratio within the Box */}
        {/* This creates the "Frame" around the live image */}
        <div 
            className="relative bg-black"
            style={{ 
                aspectRatio: videoAspectRatio,
                height: '100%',
                maxHeight: '100%',
                maxWidth: '100%',
                border: '1px solid #334155', // The Visual Frame
                boxShadow: '0 0 20px rgba(0,0,0,0.8)'
            }}
        >
            {focus.eyesClosed && !isSleeping && (
                <div className="absolute inset-0 z-[70] bg-[#050505] flex flex-col items-center justify-center pointer-events-none border-b-4 border-t-4 border-gray-900 transition-all duration-700">
                    <div className="text-3xl grayscale opacity-50">😌</div>
                    <div className="text-[10px] text-gray-600 font-mono mt-2 uppercase tracking-widest">Palpebre Chiuse</div>
                </div>
            )}

            {isSleeping && (
                    <div className="absolute inset-0 z-[60] bg-black flex flex-col items-center justify-center pointer-events-none">
                        <div className="text-4xl animate-pulse">💤</div>
                        <div className="text-[10px] text-gray-600 font-mono mt-2">SISTEMA VISIVO A RIPOSO</div>
                    </div>
            )}

            {permissionError && !staticMedia && !isSleeping && (
                <div className="absolute inset-0 z-[50] bg-gray-900 flex flex-col items-center justify-center pointer-events-auto cursor-default">
                    <div className="text-red-500 text-2xl mb-1">📷🚫</div>
                    <div className="text-xs text-red-400 font-bold mb-2">{errorMsg || "ACCESSO CAMERA NEGATO"}</div>
                    <button 
                        onClick={() => startCamera()}
                        className="px-3 py-1 bg-red-900/50 hover:bg-red-800 border border-red-600 rounded text-[10px] text-white uppercase font-mono"
                    >
                        RIAPRI FLUSSO
                    </button>
                </div>
            )}

            {/* OVERLAY: NET INPUT AREA INDICATOR */}
            {!isSleeping && !focus.eyesClosed && (streamActive || staticMedia) && (
                <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
                    <div 
                        className={`border-2 shadow-[0_0_15px_rgba(56,189,248,0.3)] absolute transition-all duration-300 ${viewMode === 'RAW' ? 'border-red-500/50' : 'border-bio-accent/50'}`}
                        style={{
                            width: `${100 / focus.zoom}%`,
                            height: `${100 / focus.zoom}%`,
                            left: `${50 + focus.x / 2}%`,
                            top: `${50 + focus.y / 2}%`,
                            transform: 'translate(-50%, -50%)'
                        }}
                    >
                        <div className={`absolute top-0 left-0 text-black text-[8px] px-1 font-bold opacity-70 ${viewMode === 'RAW' ? 'bg-red-500' : 'bg-bio-accent'}`}>
                            {viewMode === 'RAW' ? "RAW_FOCUS" : "NET_SIGHT"}
                        </div>
                    </div>
                </div>
            )}

            {/* RAW VIDEO LAYER */}
            {staticMedia ? (
                <img 
                    ref={imageRef} 
                    src={staticMedia.url} 
                    alt="Source" 
                    className="w-full h-full object-contain" 
                />
            ) : (
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    onLoadedMetadata={handleVideoMetadata}
                    className="w-full h-full object-contain"
                />
            )}
            
            {/* NET VIEW CANVAS LAYER - EXACTLY OVERLAYS VIDEO */}
            <canvas 
                ref={displayCanvasRef}
                className="absolute inset-0 w-full h-full z-20 pointer-events-none transition-opacity duration-200"
                style={{ 
                    imageRendering: 'pixelated',
                    filter: `brightness(${1 + ((focus.cameraSettings?.exposureCompensation || 0) * 0.2)})`,
                    opacity: viewMode === 'NET' ? 1 : 0
                }}
            />
        </div>

        {staticMedia && (
            <div className="absolute top-2 right-2 z-50">
                <button onClick={clearStaticMedia} className="bg-red-600/80 hover:bg-red-500 text-white w-6 h-6 rounded flex items-center justify-center shadow-lg border border-red-400 text-xs">✖</button>
            </div>
        )}

        {(streamActive || staticMedia) && !isManuallyDisabled && !isSleeping && !focus.eyesClosed && (
            <div 
                className="absolute right-3 top-1/2 -translate-y-1/2 h-40 w-8 z-30 flex items-center justify-center group/zoom cursor-ns-resize"
                onMouseDown={(e) => e.stopPropagation()} 
                onTouchStart={(e) => e.stopPropagation()} 
            >
                    <div className="relative h-full w-2 bg-gray-900/80 rounded-full border border-gray-600 shadow-xl overflow-hidden backdrop-blur-sm">
                        <div 
                        className="absolute bottom-0 w-full bg-bio-accent/70 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                        style={{ height: `${zoomPercentage}%` }}
                        />
                        <input 
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.01"
                        value={focus.zoom}
                        onChange={(e) => onZoomChange(0, parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                        style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                        />
                    </div>
            </div>
        )}
        
        <div className="absolute bottom-2 right-2 z-[80] pointer-events-auto flex gap-2" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
             <button 
                onClick={() => setViewMode(prev => prev === 'NET' ? 'RAW' : 'NET')}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border shadow-lg backdrop-blur-md transition-all flex items-center gap-1 ${
                    viewMode === 'NET' ? 'bg-cyan-900/80 text-cyan-300 border-cyan-500' : 'bg-red-900/80 text-white border-red-500'
                }`}
                title="Cambia Visuale"
            >
                {viewMode === 'NET' ? "👁️‍🗨️ NET" : "📷 RAW"}
            </button>

             <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`px-2 py-1 rounded-full text-[10px] border shadow-lg backdrop-blur-md transition-all ${
                    showSettings ? 'bg-indigo-900 text-white border-indigo-500' : 'bg-gray-800/80 text-gray-300 border-gray-600 hover:text-white'
                }`}
            >
                ⚙️
            </button>

             <button 
                onClick={() => onToggleEyelids(focus.eyesClosed)}
                disabled={isSleeping}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border shadow-lg backdrop-blur-md transition-all ${
                    !focus.eyesClosed ? 'bg-indigo-900/80 text-indigo-300 border-indigo-500 hover:bg-indigo-800' : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700'
                }`}
            >
                {focus.eyesClosed ? "👁 APRI" : "😌 CHIUDI"}
            </button>

            <button 
                onClick={() => setIsManuallyDisabled(!isManuallyDisabled)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border shadow-lg backdrop-blur-md transition-all ${
                    !isManuallyDisabled ? 'bg-green-900/80 text-green-400 border-green-500 hover:bg-green-800' : 'bg-red-900 text-white border-red-500 hover:bg-red-800'
                }`}
            >
                {!isManuallyDisabled ? "CAM ON" : "CAM OFF"}
            </button>
        </div>
        
        <canvas ref={processingCanvasRef} className="hidden" />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="flex gap-2">
            <button
                disabled={isManuallyDisabled || isSleeping}
                onClick={() => !streamActive && !staticMedia ? startCamera() : captureFrameForBrain(false)}
                className={`flex-1 py-1 text-[10px] md:text-xs font-mono border rounded disabled:opacity-50 transition-all uppercase truncate ${permissionError ? 'bg-red-900/30 text-red-300 border-red-800 animate-pulse' : 'bg-bio-accent/20 hover:bg-bio-accent/40 text-bio-accent border-bio-accent/50'}`}
            >
                {staticMedia ? "[ANALIZZA]" : (streamActive ? "[SCATTA]" : (permissionError ? "[RIPROVA]" : "[RIAVVIA]"))}
            </button>
            
            <button 
                onClick={onCameraChange}
                disabled={isManuallyDisabled || isSleeping || staticMedia !== null}
                className="w-12 py-1 flex items-center justify-center text-xs font-mono bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 rounded disabled:opacity-30"
            >
                📷🔄
            </button>
        </div>

        <div className="flex gap-2">
            <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-1 text-[10px] md:text-xs font-mono bg-indigo-900/30 hover:bg-indigo-800/50 text-indigo-300 border border-indigo-700/50 rounded transition-all uppercase flex items-center justify-center gap-1 truncate"
            >
                <span>📂</span> {staticMedia ? "CAMBIA" : "CARICA"}
            </button>
        </div>
        
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
      </div>
    </div>
  );
};

export default OcularSystem;
