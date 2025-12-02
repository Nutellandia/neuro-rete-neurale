
/**
 * MONITOR METABOLICO
 * ==================
 * Autore: Emilio Frascogna
 * 
 * Componente per la visualizzazione dell'efficienza energetica.
 * Include un grafico sparkline in tempo reale che mostra il consumo
 * o il recupero di energia (Joule) basato sull'attività neurale.
 * Ora include anche i dati di stato generale (HUD Mirror).
 */

import React, { useEffect, useState, useRef } from 'react';
import { LifeStage } from '../types';

interface MetabolismMonitorProps {
    energy: number;
    maxEnergy: number;
    metabolicRate: number; // Delta per tick (+ ricarica, - consumo)
    isSleeping: boolean;
    stage: LifeStage;
    neuronCount: number;
    ageTicks: number;
    ageString: string;
}

const formatScalableNumber = (num: number): string => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
};

const MetabolismMonitor: React.FC<MetabolismMonitorProps> = ({ 
    energy, maxEnergy, metabolicRate, isSleeping, 
    stage, neuronCount, ageTicks, ageString 
}) => {
    const [history, setHistory] = useState<number[]>(new Array(40).fill(energy));
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Aggiorna lo storico per il grafico
    useEffect(() => {
        setHistory(prev => [...prev.slice(1), energy]);
    }, [energy]);

    // Rendering del grafico Sparkline su Canvas
    useEffect(() => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const w = canvasRef.current.width;
        const h = canvasRef.current.height;

        ctx.clearRect(0, 0, w, h);
        
        // Griglia di sfondo
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
        ctx.stroke();

        // Linea del grafico
        ctx.beginPath();
        const step = w / (history.length - 1);
        const maxVal = maxEnergy * 1.1; // Fattore di scala
        
        history.forEach((val, i) => {
            const y = h - ((val / maxVal) * h);
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * step, y);
        });

        ctx.lineWidth = 2;
        // Colore dinamico: Viola (Sonno), Rosso (Critico), Verde (Normale)
        ctx.strokeStyle = isSleeping ? '#a78bfa' : (energy < maxEnergy * 0.2 ? '#ef4444' : '#4ade80');
        ctx.stroke();

        // Riempimento Area
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.fillStyle = isSleeping ? 'rgba(167, 139, 250, 0.2)' : 'rgba(74, 222, 128, 0.1)';
        ctx.fill();

    }, [history, energy, maxEnergy, isSleeping]);

    const percentage = Math.round((energy / maxEnergy) * 100);
    const timeRemaining = metabolicRate < 0 
        ? Math.round(energy / Math.abs(metabolicRate))
        : Infinity;

    return (
        <div className="bg-bio-panel p-3 rounded-lg border border-gray-700 w-full mb-2 shadow-lg">
             {/* HUD INFO MIRROR */}
             <div className="grid grid-cols-2 gap-4 mb-4 border-b border-gray-800 pb-2">
                <div>
                    <div className="text-[9px] text-gray-500 font-mono mb-1">STAGE</div>
                    <div className="text-xs font-bold text-yellow-400 font-mono uppercase truncate">{stage}</div>
                    
                    <div className="mt-2 text-[9px] text-gray-500 font-mono mb-1">NODES</div>
                    <div className="text-xl font-bold text-cyan-400 font-mono leading-none">
                        {formatScalableNumber(neuronCount)}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[9px] text-gray-500 font-mono mb-1">AGE</div>
                    <div className="text-xs font-bold text-white font-mono">{formatScalableNumber(ageTicks)} TICKS</div>
                    <div className="text-[9px] text-gray-600 font-mono">{ageString}</div>
                </div>
             </div>

             <div className="flex justify-between items-end mb-2">
                 <div>
                     <div className="text-[9px] text-gray-400 font-mono font-bold uppercase tracking-widest mb-1">
                         METABOLIC RATE
                     </div>
                     <div className={`text-xs font-mono flex items-center gap-2 ${metabolicRate > 0 ? 'text-green-400' : 'text-red-400'}`}>
                         <span className="text-lg">{metabolicRate > 0 ? '⚡' : '🔥'}</span>
                         <span>{metabolicRate > 0 ? '+' : ''}{metabolicRate.toFixed(3)} J/tick</span>
                     </div>
                 </div>
                 <div className="flex flex-col items-end">
                     <div className="text-[9px] text-gray-500 font-mono mb-1">ENERGY RESERVE</div>
                     <div className="flex flex-col items-end leading-none">
                        <span className={`text-2xl font-bold font-mono ${percentage < 20 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                            {energy.toFixed(0)}
                        </span>
                        <span className="text-[9px] text-gray-500 font-mono">
                            MAX: {maxEnergy} J
                        </span>
                     </div>
                 </div>
             </div>
             
             <div className="relative w-full h-12 bg-black border border-gray-800 rounded overflow-hidden">
                 <canvas ref={canvasRef} width={300} height={48} className="w-full h-full block" />
                 
                 {/* Sfondo solido (bg-gray-900) per evitare ghosting dei numeri */}
                 {timeRemaining !== Infinity && !isSleeping && (
                     <div className="absolute top-1 right-1 px-2 py-1 bg-gray-900 text-red-400 text-[9px] font-mono font-bold rounded border border-red-900/50 shadow-md z-10">
                         DEPLETION: {timeRemaining}t
                     </div>
                 )}
                 {isSleeping && (
                     <div className="absolute top-1 right-1 px-2 py-1 bg-gray-900 text-purple-300 text-[9px] font-mono font-bold rounded border border-purple-800 animate-pulse z-10">
                         RECHARGING...
                     </div>
                 )}
             </div>
        </div>
    );
};

export default MetabolismMonitor;
