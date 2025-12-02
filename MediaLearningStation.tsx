
import React, { useRef, useState, useEffect } from 'react';
import { LifeStage, VisualFocus } from '../types';

interface MediaLearningStationProps {
    isActive: boolean;
    stage: LifeStage;
    focus: VisualFocus;
    onFocusChange: (x: number, y: number) => void;
    onZoomChange: (delta: number, absolute?: number) => void;
    onDataStream: (type: 'media_feed', description: string, intensity: number, rawAudio?: Uint8Array, rawFrame?: string) => void;
    onRealtimeAudio?: (volume: number, frequencies: Uint8Array) => void; 
}

const MediaLearningStation: React.FC<MediaLearningStationProps> = ({ 
    isActive, stage, focus, onFocusChange, onZoomChange, onDataStream, onRealtimeAudio 
}) => {
    // Refs Hardware/DOM
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const lastFrameTimeRef = useRef<number>(0);
    
    // Refs Audio Analysis
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const gainRef = useRef<GainNode | null>(null);

    // Stato Player
    const [mode, setMode] = useState<'FILE' | 'YOUTUBE'>('FILE');
    const [currentFile, setCurrentFile] = useState<string | null>(null);
    const [fileType, setFileType] = useState<'video' | 'audio' | 'youtube' | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [learningIntensity, setLearningIntensity] = useState(0);
    const [userAudioOn, setUserAudioOn] = useState(true);
    const [canInteract, setCanInteract] = useState(true); // Toggle Interaction

    // Stato YouTube Facade
    const [ytUrl, setYtUrl] = useState("");
    const [ytVideoId, setYtVideoId] = useState<string | null>(null);
    const [ytIframeActive, setYtIframeActive] = useState(false); // Controls the "Red Button" facade
    const ytSimIntervalRef = useRef<number | null>(null);
    
    // Stato Dragging (Propriocezione)
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const focusStartRef = useRef<{ x: number, y: number } | null>(null);

    const isLocked = stage === LifeStage.PROGENITORE;

    const getProcessingInterval = (currentStage: LifeStage): number => {
        switch (currentStage) {
            case LifeStage.PROGENITORE: return 5000; 
            case LifeStage.GANGLIO: return 3000; 
            case LifeStage.SISTEMA_LIMBICO: return 1000; 
            case LifeStage.NEOCORTECCIA: return 500; 
            case LifeStage.CORTECCIA_ASSOCIATIVA: return 100; 
            case LifeStage.CERVELLO_MATURO: return 50; 
            default: return 2000;
        }
    };

    const processingInterval = getProcessingInterval(stage);
    const zoomPercentage = Math.min(100, Math.max(0, ((focus.zoom - 0.5) / 2.5) * 100));

    // --- SETUP AUDIO CONTEXT (SOLO FILE LOCALI) ---
    useEffect(() => {
        if (!videoRef.current) return;
        const initAudio = () => {
            if (!audioCtxRef.current) {
                const Ctx = window.AudioContext || (window as any).webkitAudioContext;
                audioCtxRef.current = new Ctx();
                analyserRef.current = audioCtxRef.current.createAnalyser();
                analyserRef.current.fftSize = 64;
                gainRef.current = audioCtxRef.current.createGain();
                gainRef.current.gain.value = userAudioOn ? 1.0 : 0.0;
                
                try {
                    sourceRef.current = audioCtxRef.current.createMediaElementSource(videoRef.current!);
                    sourceRef.current.connect(analyserRef.current);
                    analyserRef.current.connect(gainRef.current);
                    gainRef.current.connect(audioCtxRef.current.destination);
                } catch (e) { /* Ignore reconnection errors */ }
            }
            if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        };

        const handlePlay = () => {
            initAudio();
            setIsPlaying(true);
            loopLocalMedia();
        };
        const handlePause = () => setIsPlaying(false);

        videoRef.current.addEventListener('play', handlePlay);
        videoRef.current.addEventListener('pause', handlePause);
        return () => {
            videoRef.current?.removeEventListener('play', handlePlay);
            videoRef.current?.removeEventListener('pause', handlePause);
        };
    }, [stage]);

    useEffect(() => {
        if (gainRef.current && audioCtxRef.current) {
            const t = audioCtxRef.current.currentTime;
            gainRef.current.gain.setTargetAtTime(userAudioOn ? 1.0 : 0.0, t, 0.1);
        }
    }, [userAudioOn]);

    // --- PROPRIOCEZIONE (DRAG) ---
    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (!containerRef.current || canInteract) return; 
        setIsDragging(true);
        const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        dragStartRef.current = { x: cx, y: cy };
        focusStartRef.current = { x: focus.x, y: focus.y };
    };

    const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging || !dragStartRef.current || !focusStartRef.current || !containerRef.current) return;
        const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const deltaX = cx - dragStartRef.current.x;
        const deltaY = cy - dragStartRef.current.y;
        const { width, height } = containerRef.current.getBoundingClientRect();
        
        const newX = focusStartRef.current.x - ((deltaX / width) * 100 * 1.5);
        const newY = focusStartRef.current.y - ((deltaY / height) * 100 * 1.5);
        onFocusChange(newX, newY);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        dragStartRef.current = null;
        focusStartRef.current = null;
    };

    // --- LOOP ANALISI (FILE LOCALI) ---
    const loopLocalMedia = () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
            if (fileType !== 'youtube') {
                setIsPlaying(false);
                setLearningIntensity(0);
                return;
            }
        }

        const now = Date.now();
        let audioLevel = 0;
        let freqData = new Uint8Array(32);
        
        if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(freqData);
            const sum = freqData.reduce((a, b) => a + b, 0);
            audioLevel = sum / freqData.length;
            if (onRealtimeAudio) onRealtimeAudio(audioLevel, freqData);
        }

        // Estrazione Frame Video (Crop Ottico)
        if (fileType === 'video' && canvasRef.current && (now - lastFrameTimeRef.current >= processingInterval)) {
            const ctx = canvasRef.current.getContext('2d');
            const v = videoRef.current;
            if (v && v.readyState >= 2 && ctx) {
                try {
                    // Logica Zoom/Pan
                    const safeZoom = Math.max(1, focus.zoom);
                    const viewW = v.videoWidth / safeZoom;
                    const viewH = v.videoHeight / safeZoom;
                    const srcX = (v.videoWidth - viewW) * Math.max(0, Math.min(1, (focus.x + 50) / 100));
                    const srcY = (v.videoHeight - viewH) * Math.max(0, Math.min(1, (focus.y + 50) / 100));
                    
                    ctx.drawImage(v, srcX, srcY, viewW, viewH, 0, 0, 64, 64);
                    const frame = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                    
                    // Invia al cervello
                    const intensity = Math.min(1, (audioLevel/200) + 0.4);
                    setLearningIntensity(intensity);
                    onDataStream('media_feed', `[VIDEO_FEED] INT:${intensity.toFixed(2)}`, intensity, freqData, frame);
                    lastFrameTimeRef.current = now;
                } catch(e) {}
            }
        } else if (fileType === 'audio') {
             // Solo Audio
             const intensity = Math.min(1, audioLevel/150);
             setLearningIntensity(intensity);
             if (now - lastFrameTimeRef.current >= processingInterval) {
                 onDataStream('media_feed', `[AUDIO_FEED] INT:${intensity.toFixed(2)}`, intensity, freqData);
                 lastFrameTimeRef.current = now;
             }
        }

        if (fileType !== 'youtube') requestAnimationFrame(loopLocalMedia);
    };

    // --- YOUTUBE LOGIC (FACADE PATTERN) ---
    const loadYoutube = () => {
        const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = ytUrl.match(regExp);
        
        if (match && match[1]) {
            const videoId = match[1];
            setYtVideoId(videoId);
            setFileType('youtube');
            setCurrentFile(`YT: ${videoId}`);
            setCanInteract(true);
            setIsPlaying(false); // Not playing yet, waiting for user click
            setYtIframeActive(false); // Show Facade first
            setLearningIntensity(0);
            
            // RESET GAZE TO CENTER ON NEW LOAD
            onFocusChange(0, 0);
        } else {
            alert("Link YouTube non valido.");
        }
    };

    const activateYoutube = () => {
        setYtIframeActive(true);
        setIsPlaying(true);
        startYoutubeSimulation();
    };

    const startYoutubeSimulation = () => {
        if (ytSimIntervalRef.current) clearInterval(ytSimIntervalRef.current);
        
        ytSimIntervalRef.current = window.setInterval(() => {
            const simulatedIntensity = Math.random() * 0.6 + 0.2; 
            setLearningIntensity(simulatedIntensity);

            const fakeFreq = new Uint8Array(32);
            for(let i=0; i<32; i++) fakeFreq[i] = Math.random() * 255 * simulatedIntensity;
            
            if (onRealtimeAudio) onRealtimeAudio(simulatedIntensity * 200, fakeFreq);

            if (Math.random() > 0.6) {
                const concepts = ["PATTERN_RECOGNITION", "TEMPORAL_FLOW", "SEMANTIC_CONTEXT", "SOCIAL_CUE"];
                const concept = concepts[Math.floor(Math.random() * concepts.length)];
                onDataStream('media_feed', `[YT_STREAM] ${concept} - SIGNAL_SIMULATED`, simulatedIntensity, fakeFreq);
            }

        }, processingInterval);
    };

    const ejectMedia = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
        }
        if (ytSimIntervalRef.current) {
            clearInterval(ytSimIntervalRef.current);
            ytSimIntervalRef.current = null;
        }
        setFileType(null);
        setCurrentFile(null);
        setYtVideoId(null);
        setYtUrl("");
        setYtIframeActive(false);
        setIsPlaying(false);
        setLearningIntensity(0);
        setCanInteract(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setCurrentFile(file.name);
        setFileType(file.type.startsWith('video') ? 'video' : 'audio');
        if (videoRef.current) {
            videoRef.current.src = url;
            videoRef.current.load();
        }
        // RESET GAZE TO CENTER ON NEW LOAD
        onFocusChange(0, 0);
    };

    return (
        <div className={`bg-bio-panel p-2 rounded-lg border mt-4 relative overflow-hidden group transition-all ${isLocked ? 'border-gray-800 opacity-70' : 'border-indigo-900/50'}`}>
            
            {/* LOCK SCREEN */}
            {isLocked && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                    <div className="text-2xl mb-2">🔒</div>
                    <div className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-widest mb-1">MEDIA STATION CRIPTATA</div>
                    <div className="text-[9px] text-gray-500">Richiede: <span className="text-indigo-400">Ganglio Neurale</span></div>
                </div>
            )}

            {/* HEADER */}
            <div className="flex justify-between items-center mb-2 border-b border-indigo-900/30 pb-1">
                <span className="text-xs font-mono text-indigo-400 flex items-center gap-2">
                    <span>📺</span> MEDIA LEARNING
                </span>
                <div className="flex items-center gap-2">
                     {!isLocked && fileType !== 'youtube' && (fileType === 'video' || fileType === 'audio') && (
                        <button 
                            onClick={() => setUserAudioOn(!userAudioOn)}
                            className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase ${userAudioOn ? 'bg-green-900/40 text-green-300 border-green-600' : 'bg-gray-800 text-gray-500 border-gray-600'}`}
                        >
                            {userAudioOn ? "🔊 ON" : "🔇 OFF"}
                        </button>
                     )}
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${isPlaying ? 'bg-green-900 text-green-400 animate-pulse' : 'bg-gray-800 text-gray-500'}`}>
                        {isPlaying ? "ABSORBING" : "IDLE"}
                    </span>
                </div>
            </div>

            {/* VIEWPORT */}
            <div 
                ref={containerRef}
                className={`relative bg-black rounded border border-gray-800 aspect-video flex items-center justify-center overflow-hidden ${currentFile && !canInteract ? 'cursor-grab active:cursor-grabbing' : ''}`}
                onMouseDown={handleDragStart} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}
                onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd}
                onWheel={(e) => { e.preventDefault(); if(currentFile) onZoomChange(e.deltaY * -0.001); }}
            >
                {/* MENU INIZIALE */}
                {!currentFile && (
                    <div className="text-center w-full px-4 relative z-10">
                        <div className="flex justify-center gap-2 mb-4">
                            <button onClick={() => setMode('FILE')} className={`text-[9px] font-bold px-3 py-1 rounded border ${mode === 'FILE' ? 'bg-indigo-900 text-white border-indigo-500' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>FILE</button>
                            <button onClick={() => setMode('YOUTUBE')} className={`text-[9px] font-bold px-3 py-1 rounded border ${mode === 'YOUTUBE' ? 'bg-red-900 text-white border-red-500' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>YOUTUBE</button>
                        </div>
                        
                        {mode === 'FILE' ? (
                            <>
                                <div className="text-indigo-900 text-2xl mb-2">⚡</div>
                                <div className="text-[9px] text-gray-600 font-mono">CARICA FILE EDUCATIVO</div>
                            </>
                        ) : (
                            <div className="flex gap-1">
                                <input 
                                    type="text" 
                                    value={ytUrl} 
                                    onChange={(e) => setYtUrl(e.target.value)} 
                                    placeholder="Incolla link YouTube..."
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[9px] text-white font-mono"
                                />
                                <button onClick={loadYoutube} className="bg-red-700 text-white px-2 rounded font-bold text-[9px]">LOAD</button>
                            </div>
                        )}
                    </div>
                )}
                
                {/* CONTENT LAYER */}
                <div 
                    className="w-full h-full transition-transform duration-100 ease-out flex items-center justify-center"
                    style={{
                        transform: currentFile ? `translate(${-focus.x}%, ${-focus.y}%) scale(${focus.zoom})` : 'none',
                        transformOrigin: 'center center'
                    }}
                >
                    <video 
                        ref={videoRef} 
                        className={`max-w-none w-full h-full ${!currentFile || fileType === 'youtube' ? 'hidden' : 'block'} ${fileType === 'audio' ? 'opacity-0 absolute' : ''}`}
                        playsInline loop style={{ objectFit: 'contain' }}
                    />

                    {/* YOUTUBE IFRAME OR FACADE */}
                    {fileType === 'youtube' && ytVideoId && (
                        <div className={`w-full h-full relative ${canInteract ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                            {!ytIframeActive ? (
                                /* FACADE: COPERTINA E TASTO PLAY ROSSO */
                                <div 
                                    className="absolute inset-0 bg-black flex items-center justify-center cursor-pointer group z-20"
                                    onClick={activateYoutube}
                                >
                                    <div 
                                        className="absolute inset-0 bg-cover bg-center opacity-50 transition-opacity group-hover:opacity-70"
                                        style={{ backgroundImage: `url(https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg)` }}
                                    ></div>
                                    <div className="relative z-10 w-16 h-12 bg-red-600 rounded-lg flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110">
                                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1"></div>
                                    </div>
                                    <div className="absolute bottom-4 text-white font-mono text-[10px] bg-black/60 px-2 py-1 rounded">
                                        PREMI PER AVVIARE STREAM NEURALE
                                    </div>
                                </div>
                            ) : (
                                /* IFRAME REALE - PRODUCTION READY FIX */
                                <iframe 
                                    ref={iframeRef}
                                    width="100%" height="100%" 
                                    src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=1&playsinline=1&controls=1&rel=0&modestbranding=1`}
                                    title="Neural Feed"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    allowFullScreen
                                    className="absolute inset-0 z-0 w-full h-full"
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* RETICLE (GAZE CENTER) */}
                {currentFile && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-40 opacity-30">
                        <div className="w-8 h-8 border border-white/50 rounded-full flex items-center justify-center">
                            <div className="w-1 h-1 bg-red-500 rounded-full"></div>
                        </div>
                        <div className="absolute w-full h-[1px] bg-white/10"></div>
                        <div className="absolute h-full w-[1px] bg-white/10"></div>
                    </div>
                )}

                {/* ZOOM SLIDER (MOBILE FRIENDLY) */}
                {currentFile && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 h-40 w-8 z-50 flex items-center justify-center pointer-events-auto" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                        <div className="relative h-full w-2 bg-gray-900/80 rounded-full border border-gray-600 shadow-xl overflow-hidden">
                            <div className="absolute bottom-0 w-full bg-indigo-500/70 transition-all duration-300" style={{ height: `${zoomPercentage}%` }} />
                            <input 
                                type="range" min="0.5" max="3" step="0.01" 
                                value={focus.zoom} onChange={(e) => onZoomChange(0, parseFloat(e.target.value))}
                                className="absolute inset-0 opacity-0 cursor-pointer appearance-none h-full w-full"
                                style={{ transform: 'rotate(-90deg)', width: '160px', height: '32px', top: '64px', left: '-64px' }}
                            />
                        </div>
                    </div>
                )}

                {/* HUD */}
                {currentFile && (
                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-50 pointer-events-auto">
                         <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden mb-1">
                             <div className="h-full bg-indigo-500 transition-all duration-300" style={{width: `${learningIntensity * 100}%`}}></div>
                         </div>
                         <button 
                            onClick={() => setCanInteract(!canInteract)}
                            className={`text-[8px] font-bold px-2 py-1 rounded border shadow-lg uppercase transition-all ${canInteract ? 'bg-green-900/80 text-green-300 border-green-600' : 'bg-indigo-900/80 text-indigo-300 border-indigo-600'}`}
                        >
                             {canInteract ? "👆 INTERACT" : "👁️ OBSERVE"}
                         </button>
                    </div>
                )}
            </div>

            {/* CONTROLS */}
            <canvas ref={canvasRef} width={64} height={64} className="hidden" />
            <div className="flex flex-col gap-2 mt-2">
                 {!currentFile ? (
                     mode === 'FILE' && (
                        <>
                            <button onClick={() => fileInputRef.current?.click()} disabled={isLocked} className="flex-1 bg-indigo-900/30 hover:bg-indigo-800/50 text-indigo-200 text-[10px] font-mono border border-indigo-800 rounded py-2 uppercase disabled:opacity-50">Sfoglia</button>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="video/*,audio/*" className="hidden" />
                        </>
                     )
                 ) : (
                    <div className="flex gap-2">
                        {fileType !== 'youtube' && (
                            <>
                                <button onClick={() => videoRef.current?.play()} disabled={isPlaying} className="bg-green-900/30 text-green-400 px-3 rounded border border-green-800">▶</button>
                                <button onClick={() => videoRef.current?.pause()} disabled={!isPlaying} className="bg-yellow-900/30 text-yellow-400 px-3 rounded border border-yellow-800">⏸</button>
                            </>
                        )}
                        <button onClick={ejectMedia} className="bg-red-900/30 text-red-400 px-3 rounded border border-red-800 flex-1 text-[10px] font-mono uppercase">⏏ EJECT</button>
                    </div>
                 )}
            </div>
        </div>
    );
};

export default MediaLearningStation;
