
/**
 * INTERFACCIA APPARATO FONATORIO
 * ==============================
 * Autore: Emilio Frascogna
 * 
 * Visualizzatore e controller per il sistema di sintesi vocale.
 * Mostra un oscilloscopio duale (Input vs Output) per permettere alla rete
 * di "vedere" la propria voce e confrontarla con quella dell'insegnante (Match).
 */

import React, { useState, useEffect, useRef } from 'react';
import { VocalParams, RealtimeSensoryData } from '../types';
import { biologicalVoice } from '../services/biologicalVoice';

interface VocalTractProps {
    currentParams: VocalParams | undefined; // Input dal Cervello
    isActive: boolean;
    realtimeData: React.MutableRefObject<RealtimeSensoryData>; 
    onClearTarget?: () => void; 
    onSuccess?: (params: VocalParams) => void;
}

const VocalTract: React.FC<VocalTractProps> = ({ currentParams, isActive, realtimeData, onClearTarget, onSuccess }) => {
    const [manualMode, setManualMode] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [matchScore, setMatchScore] = useState(0); 
    const [successTriggered, setSuccessTriggered] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [params, setParams] = useState<VocalParams>({
        airflow: 0,
        tension: 0.5,
        jawOpenness: 0.5,
        tonguePosition: 0.5
    });
    
    const sustainTimerRef = useRef<number>(0);

    useEffect(() => {
        biologicalVoice.setMute(isMuted);
    }, []);

    const toggleMute = () => {
        const newState = !isMuted;
        setIsMuted(newState);
        biologicalVoice.setMute(newState);
    };
    
    const handleClear = () => {
        if (onClearTarget) onClearTarget();
        setSuccessTriggered(false);
        setMatchScore(0);
        sustainTimerRef.current = 0;
    };

    // SINCRONIZZAZIONE CERVELLO -> MUSCOLI
    useEffect(() => {
        if (!manualMode && currentParams) {
            setParams(currentParams);
            // Se in controllo automatico, aggiorna il motore vocale
            if (isActive) {
                 biologicalVoice.updateParams(currentParams);
            }
        }
    }, [currentParams, manualMode, isActive]);

    // CONTROLLO MANUALE (Override)
    useEffect(() => {
        if (manualMode && isActive) {
            biologicalVoice.startContinuous();
            biologicalVoice.updateParams(params);
        } else if (manualMode && !isActive) {
            biologicalVoice.stopContinuous();
        }
    }, [manualMode, isActive, params]);

    // --- LOOP OSCILLOSCOPIO COMPARATIVO ---
    useEffect(() => {
        let rafId = 0;
        const draw = () => {
            if (!canvasRef.current) return; 

            const ctx = canvasRef.current.getContext('2d');
            if (!ctx) return;

            const w = canvasRef.current.width;
            const h = canvasRef.current.height;
            
            ctx.fillStyle = '#111827'; 
            ctx.fillRect(0, 0, w, h);
            
            // Griglia
            ctx.strokeStyle = '#374151';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
            ctx.stroke();

            // ONDA GIALLA: TARGET (Input Audio)
            let hasInput = false;
            const inputFreqs = realtimeData.current?.audio?.frequencies;
            
            if (inputFreqs) {
                let sum = 0;
                for(let k=0; k<inputFreqs.length; k++) sum+=inputFreqs[k];
                
                if (sum > 10) {
                    hasInput = true;
                    ctx.strokeStyle = '#fbbf24'; // Giallo
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    const sliceWidth = w / inputFreqs.length;
                    let x = 0;

                    for (let i = 0; i < inputFreqs.length; i++) {
                        const barH = (inputFreqs[i] / 255) * h;
                        if (i === 0) ctx.moveTo(x, h - barH);
                        else ctx.lineTo(x, h - barH);
                        x += sliceWidth;
                    }
                    ctx.stroke();
                }
            }

            // ONDA VERDE: SELF (Voce Generata)
            const selfData = biologicalVoice.getOutputFrequencyData();
            let hasOutput = false;
            if (selfData.length > 0) {
                 let sSelf = 0;
                 for(let k=0; k<selfData.length; k++) sSelf+=selfData[k];
                 if(sSelf > 5) hasOutput = true;
            }

            if (hasOutput) {
                ctx.strokeStyle = '#4ade80'; // Verde
                ctx.lineWidth = 2;
                ctx.beginPath();
                const sliceWidth = w / selfData.length;
                let x = 0;
                let diffScore = 0;

                for (let i = 0; i < selfData.length; i++) {
                    const barH = (selfData[i] / 255) * h;
                    if (i === 0) ctx.moveTo(x, h - barH);
                    else ctx.lineTo(x, h - barH);
                    x += sliceWidth;

                    // Calcolo differenza spettrale
                    if (hasInput && inputFreqs) {
                        diffScore += Math.abs(selfData[i] - inputFreqs[i]);
                    }
                }
                ctx.stroke();

                // CALCOLO MATCHING (Apprendimento)
                if (hasInput && inputFreqs) {
                    const totalPossibleDiff = 255 * selfData.length;
                    const accuracy = 1 - (diffScore / totalPossibleDiff);
                    const percent = Math.round(accuracy * 100);
                    setMatchScore(percent);
                    
                    // Se la risonanza è alta per un tempo sufficiente (> 800ms)
                    if (percent > 75 && !successTriggered) {
                        sustainTimerRef.current++;
                        if (sustainTimerRef.current > 40 && onSuccess) { 
                             setSuccessTriggered(true);
                             onSuccess(params);
                        }
                    } else {
                        sustainTimerRef.current = 0;
                    }

                } else {
                    setMatchScore(0);
                    sustainTimerRef.current = 0;
                }
            }

            rafId = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(rafId);
    }, [isActive, successTriggered]);

    const handleChange = (key: keyof VocalParams, val: number) => {
        setParams(prev => ({ ...prev, [key]: val }));
    };

    return (
        <div className="bg-bio-panel p-2 rounded-lg border border-gray-700 mt-2 relative">
            <div className="flex justify-between items-center mb-2">
                <div className="flex flex-col leading-none">
                    <span className="text-xs font-mono text-purple-400">APPARATO FONATORIO</span>
                    {isMuted && <span className="text-[8px] text-red-500 font-bold uppercase tracking-wider">MUTE ATTIVO</span>}
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={toggleMute}
                        className={`text-[9px] px-2 py-1 rounded border transition-colors uppercase font-bold flex items-center gap-1 ${isMuted ? 'bg-red-900/50 text-red-200 border-red-600' : 'bg-green-900/50 text-green-200 border-green-600'}`}
                    >
                        {isMuted ? (
                            <><span>🔇</span> MUTE</>
                        ) : (
                            <><span>🔊</span> ON</>
                        )}
                    </button>

                    <button 
                        onClick={() => setManualMode(!manualMode)}
                        disabled={!isActive}
                        className={`text-[9px] px-2 py-1 rounded border transition-colors uppercase font-bold ${manualMode ? 'bg-purple-900 text-purple-200 border-purple-500' : 'bg-gray-800 border-gray-600 text-gray-500'}`}
                    >
                        {manualMode ? "MANUAL" : "BRAIN"}
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-gray-400 w-12">POLMONI</span>
                        <input type="range" min="0" max="1" step="0.01" value={params.airflow} disabled={!manualMode} onChange={(e) => handleChange('airflow', parseFloat(e.target.value))} className={`flex-1 h-1.5 rounded-lg appearance-none cursor-pointer ${manualMode ? 'bg-gray-700 accent-purple-500' : 'bg-gray-800 accent-gray-600'}`} />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-gray-400 w-12">CORDE</span>
                        <input type="range" min="0" max="1" step="0.01" value={params.tension} disabled={!manualMode} onChange={(e) => handleChange('tension', parseFloat(e.target.value))} className={`flex-1 h-1.5 rounded-lg appearance-none cursor-pointer ${manualMode ? 'bg-gray-700 accent-purple-500' : 'bg-gray-800 accent-gray-600'}`} />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-gray-400 w-12">MASCELLA</span>
                        <input type="range" min="0" max="1" step="0.01" value={params.jawOpenness} disabled={!manualMode} onChange={(e) => handleChange('jawOpenness', parseFloat(e.target.value))} className={`flex-1 h-1.5 rounded-lg appearance-none cursor-pointer ${manualMode ? 'bg-gray-700 accent-purple-500' : 'bg-gray-800 accent-gray-600'}`} />
                    </div>
                </div>

                <div className="w-full md:w-32 h-24 bg-black rounded border border-gray-800 relative shrink-0 overflow-hidden group">
                    <canvas ref={canvasRef} width={128} height={96} className="w-full h-full" />
                    
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={handleClear} className="bg-red-900/80 hover:bg-red-600 text-white p-1 rounded text-[8px] font-bold border border-red-500">🗑</button>
                    </div>

                    {successTriggered && (
                        <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 backdrop-blur-[1px] animate-pulse">
                            <span className="text-xs font-bold text-white drop-shadow-md">LEARNED!</span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-2 flex justify-between items-center px-2">
                 <div className="text-[9px] text-gray-500 font-mono">
                    {manualMode ? "SINTETIZZATORE MANUALE" : "AREA DI BROCA (AGENCY ON)"}
                </div>
                {matchScore > 50 && (
                    <div className="text-[9px] font-bold text-green-400 animate-pulse font-mono">
                        RISONANZA: {matchScore}%
                    </div>
                )}
            </div>
        </div>
    );
};

export default VocalTract;
