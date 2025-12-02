

/**
 * BRACCIO MECCANICO & TELA CREATIVA
 * =================================
 * Autore: Emilio Frascogna
 * 
 * Questo componente simula l'arto robotico della rete neurale.
 * Gestisce:
 * 1. Rendering del braccio fisico (Spalla -> Mano).
 * 2. Coordinate vettoriali (0-100% normalizzate su 300x300px).
 * 3. Logica di disegno (Punto, Linea, Inchiostro).
 * 4. Propriocezione tattile (Trascinamento mano manuale).
 */

import React, { useRef, useEffect, useState } from 'react';
import { DrawingAction } from '../types';

interface CreativeCanvasProps {
    drawingAction: DrawingAction | null; // Output motorio dal cervello
    isEnabled: boolean; // "Pennarelli" abilitati
    isActive: boolean; // Sistema attivo
    onToggle: (enabled: boolean) => void;
    onCanvasUpdate: (base64: string) => void; // Feedback visivo
    onUserStroke: (strokePoints: {x: number, y: number}[]) => void; // Input utente per imitazione
    onManualMove: (x: number, y: number, isDrawing: boolean) => void; // Propriocezione
    onManualRelease: () => void;
    onClear: () => void;
    onRate: (isGood: boolean) => void;
    forcedColor: string | null;
    onColorSelect: (color: string | null) => void;
}

const PALETTE = [
    { label: 'AUTO', value: null, bg: 'linear-gradient(135deg, #f00, #0f0, #00f)', text: '#fff' },
    { label: 'WHT', value: '#ffffff', bg: '#ffffff', text: '#000' },
    { label: 'CYN', value: '#22d3ee', bg: '#22d3ee', text: '#000' },
    { label: 'PNK', value: '#e879f9', bg: '#e879f9', text: '#000' },
    { label: 'YLW', value: '#facc15', bg: '#facc15', text: '#000' },
    { label: 'RED', value: '#ef4444', bg: '#ef4444', text: '#fff' },
    { label: 'GRN', value: '#4ade80', bg: '#4ade80', text: '#000' },
    { label: 'BLU', value: '#3b82f6', bg: '#3b82f6', text: '#fff' },
];

const CreativeCanvas: React.FC<CreativeCanvasProps> = ({ 
    drawingAction, isEnabled, isActive, onToggle, onCanvasUpdate, onUserStroke, onManualMove, onManualRelease, onClear, onRate, forcedColor, onColorSelect
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const armLayerRef = useRef<HTMLCanvasElement>(null); // Layer separato per il braccio meccanico
    const cursorRef = useRef<{x: number, y: number}>({x: 150, y: 150}); // Coordinate interne 300x300
    const lastPosRef = useRef<{x: number, y: number} | null>(null); 
    const lastUpdateRef = useRef<number>(0);
    
    const [isUserInteraction, setIsUserInteraction] = useState(false); // Disegno O Trascinamento
    const [isDraggingHand, setIsDraggingHand] = useState(false); 
    const userStrokeRef = useRef<{x: number, y: number}[]>([]);

    // Pulisce la tela
    const clearCanvas = () => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#0f172a'; // Bio Dark
                ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                onClear();
                userStrokeRef.current = [];
            }
        }
    };

    // Inizializzazione
    useEffect(() => {
        clearCanvas();
    }, []);

    // --- LOOP DI RENDERING DEL BRACCIO MECCANICO ---
    useEffect(() => {
        const renderArm = () => {
            if (!armLayerRef.current) return;
            const ctx = armLayerRef.current.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, 300, 300);

            // Coordinate della mano (Cursore)
            // Safety check: se cursorRef è corrotto, resetta al centro
            if(isNaN(cursorRef.current.x) || isNaN(cursorRef.current.y)) {
                cursorRef.current = {x: 150, y: 150};
            }

            let handX = cursorRef.current.x;
            let handY = cursorRef.current.y;
            
            // Punto di ancoraggio (Spalla/Corpo) - Centro in basso
            const shoulderX = 150;
            const shoulderY = 320; // Leggermente fuori dal canvas in basso

            // Disegna il braccio meccanico (Assone Motore)
            ctx.beginPath();
            ctx.moveTo(shoulderX, shoulderY);
            ctx.lineTo(handX, handY);
            
            // Stile braccio
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#334155'; // Slate-700
            ctx.stroke();

            // Dettaglio Giuntura (Gomito fittizio/Pistone)
            const midX = (shoulderX + handX) / 2;
            const midY = (shoulderY + handY) / 2;
            ctx.beginPath();
            ctx.arc(midX, midY, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#475569';
            ctx.fill();

            requestAnimationFrame(renderArm);
        };
        const animId = requestAnimationFrame(renderArm);
        return () => cancelAnimationFrame(animId);
    }, []);

    // --- LOGICA DISEGNO AUTOMATICO ---
    useEffect(() => {
        // Il sistema disegna SOLO se l'utente non sta interagendo
        if (!isActive || !drawingAction || !canvasRef.current || isUserInteraction) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const w = canvasRef.current.width;
        const h = canvasRef.current.height;

        // Converte normalizzato (0-100) a Canvas (0-300)
        let targetX = (drawingAction.x / 100) * w;
        let targetY = (drawingAction.y / 100) * h;
        
        // Safety Fallback
        if (isNaN(targetX) || isNaN(targetY)) {
            targetX = cursorRef.current.x; 
            targetY = cursorRef.current.y;
        }

        // Disegna linea SOLO se i Pennarelli sono attivi (isEnabled) E il cervello decide di NON alzare la penna (!isLifting)
        if (isEnabled && !drawingAction.isLifting) {
            ctx.beginPath();
            ctx.strokeStyle = drawingAction.color;
            ctx.lineWidth = Math.max(1, drawingAction.pressure * 6); // Tratto dinamico
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.moveTo(cursorRef.current.x, cursorRef.current.y);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
        }

        cursorRef.current = { x: targetX, y: targetY };

        // Feedback visivo alla corteccia (max 2fps)
        if (Date.now() - lastUpdateRef.current > 500) {
            const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.5);
            onCanvasUpdate(dataUrl.split(',')[1]);
            lastUpdateRef.current = Date.now();
        }

    }, [drawingAction, isEnabled, isActive, isUserInteraction]);

    // --- MAPPATURA COORDINATE ---
    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return { x: 150, y: 150 };
        
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    // --- GESTIONE INTERAZIONI UTENTE ---
    
    // Controlla se si sta cliccando la mano specifica
    const isClickingCursor = (e: React.MouseEvent | React.TouchEvent) => {
        const coords = getCoords(e);
        const dist = Math.sqrt(Math.pow(coords.x - cursorRef.current.x, 2) + Math.pow(coords.y - cursorRef.current.y, 2));
        return dist < 40; // Raggio di hit
    }

    const startInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isActive) return; 
        setIsUserInteraction(true);

        const coords = getCoords(e);
        
        if (isClickingCursor(e)) {
            // Modalità Trascinamento Mano (Guida fisica)
            setIsDraggingHand(true);
            lastPosRef.current = coords;
            cursorRef.current = coords;
        } else if (isEnabled) {
            // Modalità Disegno Utente (Guida visiva)
            setIsDraggingHand(false);
            lastPosRef.current = coords;
            userStrokeRef.current = [{ x: (coords.x / 300) * 100, y: (coords.y / 300) * 100 }];
            
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(coords.x, coords.y);
            }
        }
    };

    const moveInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isUserInteraction) return;
        let coords = getCoords(e);

        if (isDraggingHand) {
            // CLAMPING: Evita che la mano finisca negli angoli irraggiungibili
            const padding = 20; 
            coords.x = Math.max(padding, Math.min(300 - padding, coords.x));
            coords.y = Math.max(padding, Math.min(300 - padding, coords.y));

            if (isEnabled) {
                const ctx = canvasRef.current?.getContext('2d');
                if (ctx && lastPosRef.current) {
                     ctx.strokeStyle = forcedColor || '#ffffff';
                     ctx.lineWidth = 3;
                     ctx.lineCap = 'round';
                     ctx.lineJoin = 'round';
                     ctx.beginPath();
                     ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
                     ctx.lineTo(coords.x, coords.y);
                     ctx.stroke();
                }
            }
            cursorRef.current = coords;
            lastPosRef.current = coords;
            
            // Invia dati Propriocezione
            const nx = Math.max(0, Math.min(100, (coords.x / 300) * 100));
            const ny = Math.max(0, Math.min(100, (coords.y / 300) * 100));
            onManualMove(nx, ny, true);

        } else if (isEnabled) {
            // Utente disegna col mouse (non muove la mano robotica)
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx && lastPosRef.current) {
                ctx.strokeStyle = forcedColor || '#ffffff';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
                ctx.lineTo(coords.x, coords.y);
                ctx.stroke();
                
                // Registra stroke per imitazione
                userStrokeRef.current.push({ x: (coords.x / 300) * 100, y: (coords.y / 300) * 100 });
            }
            lastPosRef.current = coords;
        }
    };

    const endInteraction = () => {
        if (!isUserInteraction) return;
        
        if (isDraggingHand) {
            onManualRelease();
        } else {
            // Disegno finito
            if (userStrokeRef.current.length > 2) {
                onUserStroke(userStrokeRef.current);
                // Aggiorna corteccia visiva
                const dataUrl = canvasRef.current?.toDataURL('image/jpeg', 0.5) || "";
                onCanvasUpdate(dataUrl.split(',')[1]);
            }
        }
        
        setIsUserInteraction(false);
        setIsDraggingHand(false);
        lastPosRef.current = null;
    };

    // Calcolo posizione cursore per display
    let cursorX = cursorRef.current.x;
    let cursorY = cursorRef.current.y;

    // Auto override per fluidità
    if (drawingAction && !isUserInteraction) {
        let autoX = (drawingAction.x / 100) * 300;
        let autoY = (drawingAction.y / 100) * 300;
        
        if (!isNaN(autoX) && !isNaN(autoY)) {
             cursorX = autoX;
             cursorY = autoY;
        }
    }
    
    // Fallback Centro
    if (isNaN(cursorX)) cursorX = 150;
    if (isNaN(cursorY)) cursorY = 150;

    return (
        <div className="bg-bio-panel p-2 rounded-lg border border-gray-700 relative mt-2">
            {/* CONTROLLI UI SUPERIORI */}
            <div className="flex justify-between items-center mb-2 relative z-50">
                <span className="text-xs font-mono text-emerald-400">BRACCIO MECCANICO</span>
                <div className="flex gap-2">
                     {!isActive && (
                         <span className="text-[9px] text-purple-400 font-bold flex items-center gap-1 bg-black/50 px-2 rounded">
                             💤 SLEEP MODE
                         </span>
                     )}
                     <button 
                        type="button"
                        onClick={() => onToggle(!isEnabled)}
                        disabled={!isActive}
                        className={`text-[9px] px-2 py-1 rounded border transition-colors ${isEnabled ? 'bg-emerald-900/50 border-emerald-500 text-emerald-100' : 'bg-gray-800 border-gray-600 text-gray-500'} disabled:opacity-50`}
                    >
                        {isEnabled ? "PENNARELLI ON" : "PENNARELLI OFF"}
                    </button>
                </div>
            </div>
            
            <div className="relative aspect-square w-full bg-black rounded overflow-hidden border border-gray-800 touch-none min-h-[250px] z-0">
                 {/* CANVAS DISEGNO (Inchiostro) */}
                 <canvas 
                    ref={canvasRef} 
                    width={300} 
                    height={300} 
                    className="absolute inset-0 w-full h-full opacity-90 cursor-crosshair z-10"
                    onMouseDown={startInteraction}
                    onMouseMove={moveInteraction}
                    onMouseUp={endInteraction}
                    onMouseLeave={endInteraction}
                    onTouchStart={startInteraction}
                    onTouchMove={moveInteraction}
                    onTouchEnd={endInteraction}
                 />
                 
                 {/* CANVAS BRACCIO (Hardware) - Layer Sottostante */}
                 <canvas 
                    ref={armLayerRef}
                    width={300} 
                    height={300}
                    className="absolute inset-0 w-full h-full z-0 pointer-events-none"
                 />
                 
                 {/* CURSORE MANO - SEMPRE RENDERIZZATO */}
                 <div 
                    className={`absolute w-4 h-4 rounded-full border-2 bg-transparent transition-all duration-75 ease-linear flex items-center justify-center z-20 pointer-events-none ${isDraggingHand ? 'scale-125 border-yellow-400' : 'border-white'} ${isActive ? 'opacity-100' : 'opacity-40 grayscale'}`}
                    style={{
                        left: `${(cursorX / 300) * 100}%`,
                        top: `${(cursorY / 300) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        // Colore di sfondo dinamico
                        backgroundColor: isDraggingHand ? 'rgba(255,255,0,0.3)' : (isEnabled && drawingAction && !drawingAction.isLifting ? (drawingAction.color || '#fff') : '#1e293b')
                    }}
                 >
                     <div className={`w-1 h-1 rounded-full ${isEnabled ? 'bg-white' : 'bg-gray-500'}`} />
                 </div>
            </div>
            
            {isEnabled && (
                <div className="mt-2 animate-fade-in relative z-50">
                    <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-thin">
                        {PALETTE.map(p => (
                            <button
                                type="button"
                                key={p.label}
                                onClick={() => onColorSelect(p.value)}
                                className={`w-6 h-6 rounded-full border border-gray-600 flex shrink-0 items-center justify-center text-[7px] font-bold transition-all ${forcedColor === p.value ? 'ring-2 ring-white scale-110 z-10' : 'opacity-70 hover:opacity-100'}`}
                                style={{ background: p.bg, color: p.text }}
                            >
                                {forcedColor === p.value && "✓"}
                                {forcedColor !== p.value && p.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex justify-between items-center gap-2">
                        <button 
                            type="button"
                            onClick={clearCanvas}
                            disabled={!isActive}
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-gray-300 text-[10px] disabled:opacity-50"
                            title="Cancella tela"
                        >
                            🗑 CESTINO
                        </button>
                        
                        <div className="flex gap-1">
                            <button 
                                type="button"
                                onClick={() => onRate(false)}
                                disabled={!isActive}
                                className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-400 rounded text-[10px] font-mono uppercase disabled:opacity-50"
                            >
                                👎
                            </button>
                            <button 
                                type="button"
                                onClick={() => onRate(true)}
                                disabled={!isActive}
                                className="px-2 py-1 bg-green-900/30 hover:bg-green-900/50 border border-green-800 text-green-400 rounded text-[10px] font-mono uppercase disabled:opacity-50"
                            >
                                👍
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="mt-1 text-[8px] text-gray-500 font-mono text-center">
                DISEGNA SULLA TELA PER GUIDARE IL BRACCIO
            </div>
        </div>
    );
};

export default CreativeCanvas;