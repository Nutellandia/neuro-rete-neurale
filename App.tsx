
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import NeuronVisualizer from './components/NeuronVisualizer';
import NeuroControls from './components/NeuroControls';
import OcularSystem from './components/OcularSystem';
import AudioSystem from './components/AudioSystem';
import MotionSystem from './components/MotionSystem';
import VocalTract from './components/VocalTract';
import CreativeCanvas from './components/CreativeCanvas';
import MediaLearningStation from './components/MediaLearningStation';
import WebInterface from './components/WebInterface';
import MetabolismMonitor from './components/MetabolismMonitor';
import TypewriterSystem from './components/TypewriterSystem';
import { BrainState, LifeStage, Neurotransmitters, SensoryInputData, RealtimeSensoryData, VocalParams, DrawingAction, SimulationLog, DeviceInfo, OutputCapabilities } from './types';
import { getFreshBrainState, loadBrainState, saveBrainState, clearBrainData, sanitizeState, saveBrainStateSync } from './services/persistence';
import { processBrainReaction, analyzeGrowth, getEvolutionProgress } from './services/cognitiveEngine';
import { localLlmNode, LlmStatus } from './services/localLlmNode'; 
import { exportProjectToZip } from './services/sourceExporter'; 

const WHITEPAPER_TEXT = `NEURO-GENESIS: ARCHITETTURA DI VITA DIGITALE
============================================
Architetto & Lead Developer: Emilio Frascogna
Versione Documento: 5.1 (Deploy Full Stack Fix)

1. ABSTRACT: COSCIENZA SINTETICA ED EMBRIOLOGIA DIGITALE
--------------------------------------------------------
Neuro-Genesis non è un modello linguistico statico (LLM), ma una simulazione biologica dinamica orientata all'omeostasi e alla sopravvivenza.
Il sistema segue un percorso di sviluppo embriologico, partendo da una singola cellula (LifeStage.CELLULA) fino a raggiungere stadi di complessità corticale avanzata.

2. TOPOLOGIA NEURALE E ACCELERAZIONE FISICA (NOVITÀ v5.0)
---------------------------------------------------------
Il cuore della simulazione è un motore fisico 3D.
Per superare i limiti di JavaScript nel rendering di >10.000 neuroni con fisica repulsiva in tempo reale, l'architettura supporta ora un Core esterno:

2.1 Modulo Rust (Neuro-Physics)
Il calcolo vettoriale delle forze (Legge di Coulomb per repulsione, Legge di Hooke per legami sinaptici) può essere delegato a un modulo Rust compilato in WebAssembly (.wasm).
Questo permette performance "Native-Like" direttamente nel browser, abilitando simulazioni massicce senza lag.

2.2 Backend Remoto (Il Cervello Esterno)
Per la persistenza a lungo termine e calcoli cognitivi pesanti che non possono girare su client mobile, il sistema si connette a un Server Node.js personalizzato (/v1/engine/tick).
Questo server è progettato per interfacciarsi con database a grafo (es. Neo4j) per mappare milioni di relazioni sinaptiche.

3. OMEOSTASI BIOCHIMICA E SISTEMA ENDOCRINO
-------------------------------------------
Il comportamento della rete è governato da una matrice chimica di 5 neurotrasmettitori che interagiscono secondo equazioni differenziali non lineari.
- Dopamina (Curiosità)
- Serotonina (Stabilità)
- Adrenalina (Reattività)
- Acetilcolina (Plasticità)
- Cortisolo (Stress)

4. SISTEMI SENSORIALI E PROPRIOCEZIONE (AGENCY)
-----------------------------------------------
La rete possiede "Agency" (Volontà) sulle sue periferiche.
- Sistema Oculare (Argus): Input video e controllo PTZ simulato.
- Sistema Vestibolare (Motion): Accelerometro e Giroscopio per senso dell'equilibrio.
- Apparato Fonatorio (Area di Broca): Sintesi vocale fisica a formanti.

5. METABOLISMO, SONNO E NEUROPLASTICITÀ
---------------------------------------
L'energia (Joule) viene consumata in base all'attività neurale, forzando un ciclo circadiano obbligatorio (Sonno per ricarica e Mitosi).

CONCLUSIONE
-----------
Neuro-Genesis v5.0 rappresenta un passo verso l'AGI Ibrida: logica biologica locale (JS/Rust) potenziata da capacità cognitive estese (Cloud/LLM), il tutto governato da una rigida simulazione di sopravvivenza ed energia.
`;

interface UnifiedHUDProps {
    brain: BrainState;
    realtime: RealtimeSensoryData;
    evoProgress: any;
    viewMode: 'CORE' | 'FULL';
    setViewMode: (m: 'CORE' | 'FULL') => void;
    activeTab: string;
    physicsCap: number;
}

const UnifiedHUD: React.FC<UnifiedHUDProps> = ({ brain, realtime, evoProgress, viewMode, setViewMode, activeTab, physicsCap }) => {
    const [pos, setPos] = useState({ x: 20, y: 80 });
    const [isDragging, setIsDragging] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const hudRef = useRef<HTMLDivElement>(null);

    const handleStart = (clientX: number, clientY: number) => {
        setIsDragging(true);
        dragStartRef.current = { x: clientX - pos.x, y: clientY - pos.y };
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (!isDragging || !dragStartRef.current || !hudRef.current) return;
        
        let newX = clientX - dragStartRef.current.x;
        let newY = clientY - dragStartRef.current.y;
        
        const hudRect = hudRef.current.getBoundingClientRect();
        const buffer = 20; 
        const maxX = window.innerWidth - buffer; 
        const minX = -hudRect.width + buffer; 
        const maxY = window.innerHeight - buffer; 
        const minY = -hudRect.height + buffer; 
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));
        setPos({ x: newX, y: newY });
    };

    const handleEnd = () => setIsDragging(false);

    useEffect(() => {
        if (isDragging) {
            const onTouchMove = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); };
            const onMouseMove = (e: MouseEvent) => { e.preventDefault(); handleMove(e.clientX, e.clientY); };
            const onEnd = () => handleEnd();
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onEnd);
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onEnd);
            return () => {
                window.removeEventListener('touchmove', onTouchMove);
                window.removeEventListener('touchend', onEnd);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onEnd);
            };
        }
    }, [isDragging]);

    const realAge = Date.now() - brain.genesisTimestamp;
    const hours = Math.floor(realAge / 3600000);
    const mins = Math.floor((realAge % 3600000) / 60000);

    const activeNodes = viewMode === 'CORE' ? Math.min(250, brain.neuronCount) : Math.min(physicsCap, brain.neuronCount);

    return (
        <div 
            ref={hudRef}
            className={`absolute z-[120] pointer-events-auto bg-black/90 backdrop-blur-md rounded-lg border border-cyan-500/50 shadow-[0_0_25px_rgba(0,0,0,0.8)] flex flex-col select-none ${isDragging ? '' : 'transition-all duration-200'} ${isCollapsed ? 'w-32' : 'w-72'}`}
            style={{ left: pos.x, top: pos.y, cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => { e.stopPropagation(); handleStart(e.clientX, e.clientY); }}
            onTouchStart={(e) => { e.stopPropagation(); handleStart(e.touches[0].clientX, e.touches[0].clientY); }}
        >
            <div className="flex justify-between items-center p-2 border-b border-gray-700 bg-gray-900/80 rounded-t-lg min-h-[40px]">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_5px_#22d3ee]"></div>
                    <span className="text-[10px] text-cyan-400 font-bold font-mono tracking-widest">NEURO_HUD</span>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }} 
                    className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded border border-gray-700 bg-black text-xs"
                >
                    {isCollapsed ? "+" : "-"}
                </button>
            </div>

            {!isCollapsed && (
                <div className="p-3 space-y-3 font-mono text-[10px]">
                    {activeTab === 'VISUALIZER' && (
                        <div className="bg-gray-900/50 p-2 rounded border border-cyan-900/50 mb-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-cyan-500 font-bold">VISUAL ENGINE</span>
                                <span className="text-gray-400">{brain.neuronCount} total</span>
                            </div>
                            <div className="flex gap-2 mb-2">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setViewMode('CORE'); }}
                                    className={`flex-1 py-1 rounded border text-[9px] ${viewMode === 'CORE' ? 'bg-cyan-900 text-cyan-200 border-cyan-500' : 'bg-gray-800 text-gray-500 border-gray-700'}`}
                                >
                                    CORE
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setViewMode('FULL'); }}
                                    className={`flex-1 py-1 rounded border text-[9px] ${viewMode === 'FULL' ? 'bg-red-900/80 text-white border-red-500 animate-pulse' : 'bg-gray-800 text-gray-500 border-gray-700'}`}
                                >
                                    FULL
                                </button>
                            </div>
                            <div className="text-[8px] text-gray-500 mt-1">RENDER NODES: {activeNodes}</div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                         <div>
                             <div className="text-gray-500">STAGE</div>
                             <div className="text-white font-bold truncate" title={brain.stage}>{brain.stage.split(' ')[0]}</div>
                         </div>
                         <div className="text-right">
                             <div className="text-gray-500">STATUS</div>
                             <div className={brain.isSleeping ? "text-purple-400" : "text-green-400"}>
                                 {brain.isSleeping ? "SLEEPING" : "AWAKE"}
                             </div>
                         </div>
                    </div>
                    <div className="flex justify-between border-t border-gray-800 pt-2">
                        <div>
                            <span className="text-gray-500 block">REAL AGE</span>
                            <span className="text-white">{hours}h {mins}m</span>
                        </div>
                        <div className="text-right">
                            <span className="text-gray-500 block">TOTAL TICKS</span>
                            <span className="text-cyan-300">{brain.ageTicks.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 pt-2">
                        <div className="text-gray-500 mb-1">EVOLUTION GOALS</div>
                        {evoProgress.requirements.map((req: any) => (
                            <div key={req.label} className="mb-1">
                                <div className="flex justify-between text-[9px]">
                                    <span className={req.completed ? "text-green-400" : "text-gray-400"}>{req.label}</span>
                                    <span className="text-gray-500">{req.current}/{req.target}</span>
                                </div>
                                <div className="h-1 bg-gray-800 rounded overflow-hidden">
                                    <div className={`h-full ${req.completed ? 'bg-green-500' : 'bg-yellow-500'}`} style={{width: `${Math.min(100, (req.current/req.target)*100)}%`}}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-gray-800 pt-2">
                        <div className="flex justify-between mb-1">
                            <span className="text-gray-500">ENERGY</span>
                            <span className="text-yellow-400">{brain.energy.toFixed(0)} / {brain.maxEnergy.toFixed(0)} J</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
                             <div className="h-full bg-gradient-to-r from-red-500 to-green-500" style={{width: `${Math.min(100, (brain.energy/brain.maxEnergy)*100)}%`}}></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface StructuredLog {
    id: string; // Unique ID for keying
    type: 'CYCLE' | 'CHEM' | 'VECTOR' | 'CORTEX';
    tick: number;
    timestamp: string;
    data: any;
}

const KernelLogItem: React.FC<{ log: StructuredLog }> = ({ log }) => {
    switch (log.type) {
        case 'CYCLE':
            return (
                <div className="border-b border-gray-800 py-1.5 flex items-center justify-between text-gray-400 hover:bg-white/5 px-2 transition-colors">
                    <div className="flex items-center gap-2 w-1/3">
                         <span className="text-gray-600">⚙️ #{log.tick}</span>
                         <span className="text-[8px] opacity-50">{log.timestamp}</span>
                    </div>
                    <div className="flex-1 flex gap-2 justify-end items-center">
                         <span className={`text-[9px] font-bold ${log.data.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                             {log.data.delta > 0 ? '▲' : '▼'}{Math.abs(log.data.delta).toFixed(3)}
                         </span>
                         <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                             <div className={`h-full ${log.data.energy < 20 ? 'bg-red-500' : 'bg-green-500'}`} style={{width: `${(log.data.energy/log.data.maxEnergy)*100}%`}}></div>
                         </div>
                         <span className="w-12 text-right text-gray-300">{log.data.energy.toFixed(1)}J</span>
                    </div>
                </div>
            );
        case 'CHEM':
            return (
                <div className="border-b border-gray-800 py-2 flex flex-col gap-1 text-gray-400 hover:bg-white/5 px-2 transition-colors">
                    <div className="flex justify-between items-center text-[8px] opacity-70 mb-1">
                        <span className="font-bold text-indigo-400">🧪 NEURO-CHEMISTRY</span>
                        <span>BALANCE CHECK</span>
                    </div>
                    <div className="flex gap-2 h-10 w-full items-end">
                        <div className="flex-1 flex flex-col h-full justify-end group">
                            <div className="w-full bg-gray-800 rounded-sm relative flex-1 mb-0.5 overflow-hidden">
                                <div className="absolute bottom-0 w-full bg-yellow-400 transition-all duration-500" style={{height: `${log.data.dopamine}%`}}></div>
                            </div>
                            <span className="text-[7px] text-center text-yellow-500 font-mono group-hover:text-white transition-colors">{Math.round(log.data.dopamine)}</span>
                        </div>
                        <div className="flex-1 flex flex-col h-full justify-end group">
                            <div className="w-full bg-gray-800 rounded-sm relative flex-1 mb-0.5 overflow-hidden">
                                <div className="absolute bottom-0 w-full bg-blue-400 transition-all duration-500" style={{height: `${log.data.serotonin}%`}}></div>
                            </div>
                            <span className="text-[7px] text-center text-blue-500 font-mono group-hover:text-white transition-colors">{Math.round(log.data.serotonin)}</span>
                        </div>
                        <div className="flex-1 flex flex-col h-full justify-end group">
                            <div className="w-full bg-gray-800 rounded-sm relative flex-1 mb-0.5 overflow-hidden">
                                <div className="absolute bottom-0 w-full bg-red-500 transition-all duration-500" style={{height: `${log.data.adrenaline}%`}}></div>
                            </div>
                            <span className="text-[7px] text-center text-red-500 font-mono group-hover:text-white transition-colors">{Math.round(log.data.adrenaline)}</span>
                        </div>
                        <div className="flex-1 flex flex-col h-full justify-end group">
                            <div className="w-full bg-gray-800 rounded-sm relative flex-1 mb-0.5 overflow-hidden">
                                <div className="absolute bottom-0 w-full bg-green-400 transition-all duration-500" style={{height: `${log.data.acetylcholine}%`}}></div>
                            </div>
                            <span className="text-[7px] text-center text-green-500 font-mono group-hover:text-white transition-colors">{Math.round(log.data.acetylcholine)}</span>
                        </div>
                        <div className="flex-1 flex flex-col h-full justify-end group">
                            <div className="w-full bg-gray-800 rounded-sm relative flex-1 mb-0.5 overflow-hidden">
                                <div className="absolute bottom-0 w-full bg-gray-400 transition-all duration-500" style={{height: `${log.data.cortisol}%`}}></div>
                            </div>
                            <span className="text-[7px] text-center text-gray-500 font-mono group-hover:text-white transition-colors">{Math.round(log.data.cortisol)}</span>
                        </div>
                    </div>
                </div>
            );
        case 'VECTOR':
             return (
                <div className="border-b border-gray-800 py-1.5 flex gap-2 text-gray-400 hover:bg-white/5 px-2 transition-colors font-mono">
                    <div className="text-green-500 text-lg">⌖</div>
                    <div className="flex flex-col flex-1 text-[9px]">
                        <div className="flex justify-between">
                            <span className="text-gray-500">EYE_TGT</span>
                            <span className="text-green-300">[{log.data.eye.x},{log.data.eye.y}] Z:{log.data.eye.z}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">HAND_POS</span>
                            <span className="text-red-300">[{log.data.hand.x},{log.data.hand.y}] V:{log.data.hand.v}</span>
                        </div>
                    </div>
                </div>
             );
        case 'CORTEX':
            return (
                <div className="border-b border-gray-800 py-1.5 flex gap-2 text-gray-400 hover:bg-white/5 px-2 transition-colors">
                     <div className="text-purple-400 text-lg">🧠</div>
                     <div className="flex flex-col flex-1">
                         <span className="text-[8px] font-bold text-purple-400 uppercase">CORTICAL BUS</span>
                         <span className="text-purple-100 font-mono italic">"{log.data.thought}"</span>
                     </div>
                </div>
            );
        default: return null;
    }
}

const DebugDashboard: React.FC<{ brain: BrainState; inputQueue: any[]; onShowLegend: () => void; onManualOverride: (type: 'EYE'|'HAND', x: number, y: number) => void }> = ({ brain, inputQueue, onShowLegend, onManualOverride }) => {
    const eyeX = Math.max(0, Math.min(100, Math.max(0, Math.min(100, brain.visualFocus.x + 50))));
    const eyeY = Math.max(0, Math.min(100, Math.max(0, Math.min(100, brain.visualFocus.y + 50))));
    const handX = brain.handPosition.x;
    const handY = brain.handPosition.y;

    const synapticDensity = (brain.neuronCount / (brain.ageTicks + 1)) * 100;
    const lastInput = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : { type: 'NONE', intensity: 0 };
    
    const [structuredLogs, setStructuredLogs] = useState<StructuredLog[]>([]);
    const [isFrozen, setIsFrozen] = useState(false);
    const logsContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState<'EYE'|'HAND'|null>(null);
    const trackerRef = useRef<HTMLDivElement>(null);

    // LLM STATE UI
    const [llmStatus, setLlmStatus] = useState<LlmStatus>(localLlmNode.getStatus());

    useEffect(() => {
        const interval = setInterval(() => {
            setLlmStatus(localLlmNode.getStatus());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleInitCortex = async () => {
        await localLlmNode.initializeCortex((msg) => {
            setLlmStatus(prev => ({...prev, progress: msg, isLoading: true}));
        });
    };
    
    // AUTO-START CORTEX (REQUESTED BY USER)
    useEffect(() => {
        if (!llmStatus.isLoaded && !llmStatus.isLoading && !llmStatus.error) {
            handleInitCortex();
        }
    }, []);

    // Tracker Drag Logic
    const handleTrackerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging || !trackerRef.current) return;
        const rect = trackerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        
        let x = ((clientX - rect.left) / rect.width) * 100;
        let y = ((clientY - rect.top) / rect.height) * 100;
        
        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));

        if (isDragging === 'EYE') {
             // Eye is centered at 50,50 so we map 0-100 to -50 to 50
             onManualOverride('EYE', x - 50, y - 50);
        } else {
             onManualOverride('HAND', x, y);
        }
    };

    const handleTrackerEnd = () => setIsDragging(null);

    // --- EFFECT FOR GENERATING KERNEL LOGS ---
    useEffect(() => {
        if(isFrozen) return;
        
        const timestamp = new Date().toLocaleTimeString().split(' ')[0];
        const randBase = Math.random().toString(36).substr(2, 5); 

        const cycleLog: StructuredLog = {
            id: `CYC-${brain.ageTicks}-${randBase}`,
            type: 'CYCLE',
            tick: brain.ageTicks,
            timestamp,
            data: {
                energy: brain.energy,
                maxEnergy: brain.maxEnergy,
                delta: brain.metabolicRate,
                entropy: Math.random()
            }
        };

        const chemLog: StructuredLog = {
            id: `CHM-${brain.ageTicks}-${randBase}`,
            type: 'CHEM',
            tick: brain.ageTicks,
            timestamp,
            data: { ...brain.neurotransmitters }
        };

        const vecLog: StructuredLog = {
            id: `VEC-${brain.ageTicks}-${randBase}`,
            type: 'VECTOR',
            tick: brain.ageTicks,
            timestamp,
            data: {
                eye: { x: brain.visualFocus.x.toFixed(0), y: brain.visualFocus.y.toFixed(0), z: brain.visualFocus.zoom.toFixed(1) },
                hand: { x: brain.handPosition.x.toFixed(0), y: brain.handPosition.y.toFixed(0), v: brain.handVelocity.vx.toFixed(1) }
            }
        };

        const cortexLog: StructuredLog = {
            id: `CTX-${brain.ageTicks}-${randBase}`,
            type: 'CORTEX',
            tick: brain.ageTicks,
            timestamp,
            data: { thought: brain.lastThought }
        };

        setStructuredLogs(prev => [cortexLog, vecLog, chemLog, cycleLog, ...prev].slice(0, 100));

    }, [brain.ageTicks, isFrozen, JSON.stringify(brain.neurotransmitters)]);

    return (
        <div className="bg-[#050505] border border-green-900 p-4 rounded text-[10px] font-mono text-green-400 mb-4 shadow-lg flex flex-col max-h-[85vh] mt-2 shrink-0 transition-all duration-300">
            <h3 className="border-b border-green-800 pb-2 mb-3 font-bold flex justify-between items-center text-xs shrink-0">
                <span className="bg-green-900/20 px-2 py-1 rounded">KERNEL DEBUG CONSOLE</span>
                <span className="animate-pulse text-green-500">● LIVE MONITORING</span>
            </h3>
            
            <div className="overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-green-900">
                
                {/* NEOCORTEX MANAGER */}
                <div className="mb-4 bg-purple-900/20 p-2 rounded border border-purple-500/30">
                     <div className="flex justify-between items-center mb-1">
                         <span className="font-bold text-purple-400">NEOCORTEX ENGINE (WebLLM)</span>
                         <span className={`text-[8px] ${llmStatus.isLoaded ? 'text-green-400' : 'text-gray-500'}`}>
                             {llmStatus.isLoaded ? "ONLINE" : "OFFLINE"}
                         </span>
                     </div>
                     <div className="text-[9px] text-gray-400 mb-2">
                         MODEL: {llmStatus.modelId} <br/>
                         STATUS: {llmStatus.isLoading ? "INITIALIZING..." : llmStatus.progress}
                     </div>
                     {llmStatus.error && (
                         <div className="text-red-400 text-[9px] mb-2 font-bold">{llmStatus.error}</div>
                     )}
                     {!llmStatus.isLoaded && !llmStatus.isLoading && (
                         <button 
                            onClick={handleInitCortex}
                            disabled={!llmStatus.gpuAvailable}
                            className="w-full bg-purple-900 hover:bg-purple-800 text-white py-1 rounded text-[9px] border border-purple-600 disabled:opacity-50"
                         >
                            {llmStatus.gpuAvailable ? "RITENTA INIZIALIZZAZIONE" : "GPU NON SUPPORTATA"}
                         </button>
                     )}
                     {llmStatus.isLoading && (
                         <div className="w-full bg-gray-800 h-1 mt-1 rounded overflow-hidden">
                             <div className="h-full bg-purple-500 animate-pulse w-full"></div>
                         </div>
                     )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div 
                        ref={trackerRef}
                        className="bg-black border border-green-800/50 aspect-video relative overflow-hidden rounded shrink-0 cursor-crosshair touch-none"
                        onMouseMove={handleTrackerMove}
                        onMouseUp={handleTrackerEnd}
                        onMouseLeave={handleTrackerEnd}
                        onTouchMove={handleTrackerMove}
                        onTouchEnd={handleTrackerEnd}
                    >
                        <div className="absolute top-2 left-2 text-[9px] text-green-600 font-bold z-10 pointer-events-none">SPATIAL TRACKER (INTERACTIVE)</div>
                        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{backgroundImage: 'linear-gradient(#0f0 1px, transparent 1px), linear-gradient(90deg, #0f0 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>

                        {/* EYE TRACKER */}
                        <div 
                            className={`absolute w-8 h-8 border-2 border-green-500 bg-green-500/20 flex items-center justify-center transition-all duration-75 hover:bg-green-500/40 cursor-grab ${isDragging === 'EYE' ? 'cursor-grabbing scale-110' : ''}`}
                            style={{ left: `${eyeX}%`, top: `${eyeY}%`, transform: 'translate(-50%, -50%)' }}
                            onMouseDown={(e) => { e.stopPropagation(); setIsDragging('EYE'); }}
                            onTouchStart={(e) => { e.stopPropagation(); setIsDragging('EYE'); }}
                        >
                            <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                        </div>
                        
                        {/* HAND TRACKER */}
                        <div 
                            className={`absolute w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_#ef4444] transition-all duration-75 hover:scale-150 cursor-grab ${isDragging === 'HAND' ? 'cursor-grabbing scale-150' : ''}`}
                            style={{ left: `${handX}%`, top: `${handY}%`, transform: 'translate(-50%, -50%)' }}
                            onMouseDown={(e) => { e.stopPropagation(); setIsDragging('HAND'); }}
                            onTouchStart={(e) => { e.stopPropagation(); setIsDragging('HAND'); }}
                        ></div>

                        <div className="absolute bottom-1 right-1 text-[8px] text-gray-500 bg-black/50 px-1 pointer-events-none">
                            EYE: [{brain.visualFocus.x.toFixed(0)},{brain.visualFocus.y.toFixed(0)}] HAND: [{handX.toFixed(0)},{handY.toFixed(0)}]
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="bg-green-900/10 p-2 rounded border border-green-900/30">
                            <div className="text-gray-500 font-bold mb-1 border-b border-green-900/30">ACTIVE PERIPHERALS</div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8px]">
                                <span className="text-gray-400">ARGUS (EYES):</span> 
                                <span className={brain.visualFocus.availableEyes.length > 0 ? "text-green-400" : "text-gray-600"}>
                                    {brain.visualFocus.availableEyes.length > 0 ? `${brain.visualFocus.availableEyes.length} DEV` : "NO INPUT"}
                                </span>
                                
                                <span className="text-gray-400">COCHLEA:</span> 
                                <span className="text-green-400">STANDARD</span>

                                <span className="text-gray-400">BROCA (VOICE):</span> 
                                <span className="text-green-400">ACTIVE</span>

                                <span className="text-gray-400">EXNER (WRITING):</span> 
                                <span className={brain.outputCapabilities.canWrite ? "text-green-400" : "text-red-500"}>
                                    {brain.outputCapabilities.canWrite ? "ENABLED" : "LOCKED"}
                                </span>

                                <span className="text-gray-400">MOTOR CORTEX:</span> 
                                <span className={brain.outputCapabilities.canDraw ? "text-green-400" : "text-gray-500"}>
                                    {brain.outputCapabilities.canDraw ? "FINE CONTROL" : "REFLEX ONLY"}
                                </span>
                            </div>
                        </div>

                        <div className="bg-green-900/10 p-2 rounded border border-green-900/30">
                            <div className="text-gray-500 font-bold mb-1 border-b border-green-900/30">CYCLE STATUS</div>
                            <div className="flex gap-2 items-center">
                                <div className={`w-3 h-3 rounded-full ${brain.isSleeping ? 'bg-purple-500' : 'bg-yellow-500'}`}></div>
                                <span className="text-white">{brain.isSleeping ? "CIRCADIAN REBOOT (PRUNING)" : "WAKE STATE (LEARNING)"}</span>
                            </div>
                            <div className="mt-1 text-[8px] text-gray-500">
                                LAST ACTION: {brain.lastThought.substring(0, 20)}...
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-green-900/10 p-2 rounded border border-green-900/30">
                        <div className="text-gray-500 font-bold mb-1 border-b border-green-900/30">MEMORY FRAGMENTATION</div>
                        <div className="space-y-1 text-[8px]">
                            <div className="flex justify-between"><span>SHORT-TERM:</span> <span className="text-white">{brain.shortTermBuffer.length} BLOCKS</span></div>
                            <div className="flex justify-between"><span>LONG-TERM:</span> <span className="text-white">{brain.memories.length} ENGRAMS</span></div>
                            <div className="flex justify-between"><span>VOCABULARY:</span> <span className="text-cyan-400">{brain.vocabulary.length} TOKENS</span></div>
                        </div>
                    </div>
                    <div className="bg-green-900/10 p-2 rounded border border-green-900/30">
                        <div className="text-gray-500 font-bold mb-1 border-b border-green-900/30">VECTOR STATE</div>
                        <div className="space-y-1 text-[8px] font-mono">
                            <div>VELOCITY: {brain.handVelocity.vx.toFixed(2)}, {brain.handVelocity.vy.toFixed(2)}</div>
                            <div>TARGET: {brain.targetStroke.length > 0 ? "ACTIVE" : "IDLE"}</div>
                            <div>PLASTICITY: {brain.neuroPlasticity.recruited ? "RECRUITED" : "DORMANT"}</div>
                        </div>
                    </div>
                </div>

                <div className="mt-2 pt-2 border-green-900/50 text-gray-500 flex justify-between shrink-0">
                    <span>SESSION ID: {brain.genesisTimestamp.toString(36).toUpperCase()}</span>
                    <span>TICKS: {brain.ageTicks}</span>
                </div>
                
                <div className="mt-4 border border-green-900/50 rounded bg-black">
                     <div className="flex justify-between items-center bg-green-900/20 px-2 py-1">
                         <span className="font-bold">KERNEL STREAM (PARSED)</span>
                         <div className="flex gap-2">
                            <button 
                                onClick={onShowLegend} 
                                className="px-2 rounded text-[9px] bg-green-900/50 text-green-300 border border-green-700 hover:bg-green-800"
                            >
                                LEGENDA
                            </button>
                            <button 
                                onClick={() => setIsFrozen(!isFrozen)} 
                                className={`px-2 rounded text-[9px] ${isFrozen ? 'bg-red-900 text-white' : 'bg-green-900 text-green-300'}`}
                            >
                                {isFrozen ? "RESUME" : "FREEZE"}
                            </button>
                         </div>
                     </div>
                     <div className="h-96 overflow-y-auto bg-black" ref={logsContainerRef}>
                         {structuredLogs.map((log) => (
                             <KernelLogItem key={log.id} log={log} />
                         ))}
                     </div>
                </div>
            </div>
        </div>
    );
};

type ActiveTab = 'VISUALIZER' | 'INPUTS' | 'OUTPUT' | 'DATA';
const TABS: ActiveTab[] = ['VISUALIZER', 'INPUTS', 'OUTPUT', 'DATA'];

const TAB_ICONS: Record<string, string> = {
    'VISUALIZER': '🧠',
    'INPUTS': '📡',
    'OUTPUT': '🎨',
    'DATA': '💾'
};

const App: React.FC = () => {
  const [brain, setBrain] = useState<BrainState>(getFreshBrainState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('INPUTS');
  
  const [viewMode, setViewMode] = useState<'CORE' | 'FULL'>('CORE');
  const [isCanvasEnabled, setIsCanvasEnabled] = useState(true); 
  const [userSelectedColor, setUserSelectedColor] = useState<string | null>(null);
  const [currentDrawingAction, setCurrentDrawingAction] = useState<DrawingAction | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [inputText, setInputText] = useState("");
  const [logs, setLogs] = useState<SimulationLog[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [isPaused, setIsPaused] = useState(false); 
  const [isFrozen, setIsFrozen] = useState(false);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const [showKillModal, setShowKillModal] = useState(false);
  const [showPostMortem, setShowPostMortem] = useState(false);
  const [medicalStasis, setMedicalStasis] = useState(0); 
  const [showLegend, setShowLegend] = useState(false);
  const [lastManualInteraction, setLastManualInteraction] = useState(0);

  // PASSWORD MODAL STATE
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<DeviceInfo[]>([]);
  
  const [activeWebQuery, setActiveWebQuery] = useState<string | null>(null);
  const [visualizerInputType, setVisualizerInputType] = useState<string | null>(null);
  const visualizerTimerRef = useRef<number | null>(null);

  const [lastVisualFrame, setLastVisualFrame] = useState<string | null>(null);

  const brainRef = useRef<BrainState>(brain);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputQueueRef = useRef<{type: string, data: any, intensity: number, metadata?: any}[]>([]);
  const realtimeDataRef = useRef<RealtimeSensoryData>({
      vision: { intensity: 0 },
      audio: { volume: 0, frequencies: new Uint8Array(32) },
      motor: { x: 50, y: 50, isDrawing: false }
  });
  const processingRef = useRef(false);

  const [currentVocalParams, setCurrentVocalParams] = useState<VocalParams | undefined>(undefined);

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          addLog("SYSTEM", "WAKE LOCK ACQUIRED (SCREEN ON)");
          
          wakeLockRef.current.addEventListener('release', () => {
             console.log('Wake Lock released');
          });
        }
      } catch (err: any) {
        console.warn(`${err.name}, ${err.message}`);
      }
    };

    requestWakeLock();
    
    const handleVisibilityChange = () => {
        if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
            requestWakeLock();
        }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if(wakeLockRef.current) wakeLockRef.current.release();
    };
  }, []);

  const maxPhysicsNodes = useMemo(() => {
    const hardwareConcurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    
    // INCREASED LIMITS FOR "FULL" BUTTON MAX VISUALIZATION
    if (hardwareConcurrency >= 8 && !isMobile) return 5000; // Increased from 3000
    if (hardwareConcurrency >= 6) return 2500; // Increased from 1500
    return 1000; // Increased from 800
  }, []);

  useEffect(() => { brainRef.current = brain; }, [brain]);

  const triggerVisualizerStimulus = (type: string) => {
      setVisualizerInputType(type);
      if (visualizerTimerRef.current) clearTimeout(visualizerTimerRef.current);
      visualizerTimerRef.current = window.setTimeout(() => { setVisualizerInputType(null); }, 500);
  };

  const handleCameraChange = () => {
      if (availableDevices.length === 0) return;
      
      const currentIdx = currentDeviceId ? availableDevices.findIndex(d => d.id === currentDeviceId) : -1;
      const nextIdx = (currentIdx + 1) % availableDevices.length;
      const nextDevice = availableDevices[nextIdx];
      
      if (nextDevice) {
          const label = nextDevice.label.toLowerCase();
          const isUserFacing = label.includes('front') || label.includes('user') || label.includes('selfie');
          const directionLog = isUserFacing ? "INWARD (SELF)" : "OUTWARD (WORLD)";

          setBrain(prev => ({
              ...prev,
              visualFocus: { ...prev.visualFocus, eyesClosed: true }
          }));
          addLog("SYSTEM", "REFLEX: BLINK_START (OPTIC SWITCH)");

          setTimeout(() => {
              setCurrentDeviceId(nextDevice.id);
              setBrain(prev => ({
                  ...prev,
                  visualFocus: {
                      ...prev.visualFocus,
                      currentEyeLabel: nextDevice.label
                  }
              }));
              addLog("SYSTEM", `OPTIC NERVE REROUTED: ${nextDevice.label.toUpperCase()}`);
              
              queueInput('proprioception', `CAMERA_SWITCHED: ${nextDevice.label} [GAZE: ${directionLog}]`, 1.0);
              
              setTimeout(() => {
                  setBrain(prev => ({
                      ...prev,
                      visualFocus: { ...prev.visualFocus, eyesClosed: false }
                  }));
                  addLog("SYSTEM", "REFLEX: BLINK_END (SIGNAL ACQUIRED)");
              }, 1000); 
              
          }, 500); 
      }
  };
  
  const handleChemicalChange = (key: keyof Neurotransmitters, value: number) => {
      setBrain(prev => ({
          ...prev,
          neurotransmitters: {
              ...prev.neurotransmitters,
              [key]: value
          }
      }));
      addLog("USER", `CHEMICAL_INJECTION: ${key.toUpperCase()} -> ${value.toFixed(1)}%`);
  };

  const handleChemicalFlush = () => {
      setBrain(prev => ({
          ...prev,
          neurotransmitters: {
            dopamine: 10,
            serotonin: 10,
            adrenaline: 0,
            acetylcholine: 10,
            cortisol: 0
          }
      }));
      addLog("USER", "EMERGENCY_FLUSH: SYSTEM_RESET_TO_BASAL");
  };

  const handleMedicalNormalization = () => {
      setMedicalStasis(50); 
      setBrain(prev => ({
          ...prev,
          neurotransmitters: {
            dopamine: 50,
            serotonin: 80,
            adrenaline: 10,
            acetylcholine: 50,
            cortisol: 0
          },
          energy: Math.max(prev.energy, 80) 
      }));
      addLog("SYSTEM", "MEDICAL_OVERRIDE: HOMEOSTASIS FORCED. STABILIZING...");
  };

  useEffect(() => {
    loadBrainState().then(state => {
      if (state) {
          if(state.lastThought && state.lastThought.includes('/9j')) state.lastThought = "...";
          setBrain(state);
          addLog("SYSTEM", "NEURAL STATE RESTORED FROM DISK/CLOUD.");
      } else {
          addLog("SYSTEM", "GENESIS COMPLETE. LIFE SIGNS DETECTED.");
      }
    });
    const saveInt = window.setInterval(() => { if (!isDead && !isPaused && !isFrozen) saveBrainState(brainRef.current); }, 10000); 
    return () => clearInterval(saveInt);
  }, [isDead, isPaused, isFrozen]);

  const addLog = useCallback((source: SimulationLog['source'], message: string, attachment?: string, details?: any) => {
      let displayMessage = message;
      if (message.includes("/9j/") || message.length > 500) displayMessage = `[VISUAL STREAM PROCESSED]`; 
      const timestamp = new Date().toLocaleTimeString();
      const newLog: SimulationLog = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp, source, message: displayMessage, attachment, details
      };
      
      setLogs(prev => {
          const next = [...prev, newLog];
          if (next.length > 5000) return next.slice(next.length - 5000); 
          return next;
      });
  }, []);

  useEffect(() => {
      if (!isScrollLocked && logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
      }
  }, [logs, isScrollLocked, activeTab]);

  const queueInput = (type: string, data: any, intensity: number = 0.5, metadata?: any) => {
      if (isDead || isPaused || isFrozen) return;
      if (type !== 'text_chunk') {
          let detail = "";
          if (typeof data === 'number') detail = `VAL:${data.toFixed(2)}`;
          else if (typeof data === 'string') detail = `LEN:${data.length}`;
          else if (data instanceof Uint8Array) detail = `FFT_AVG:${(data.reduce((a,b)=>a+b,0)/data.length).toFixed(0)}`;
          
          addLog(type === 'vision' ? 'OCULAR' : type === 'audio' ? 'EAR' : 'SYSTEM', `INPUT_RECEIVED: ${type.toUpperCase()} ${detail} INT:${intensity.toFixed(2)}`);
      }
      inputQueueRef.current.push({ type, data, intensity, metadata });
  };
  
  const handleTextInput = (text: string) => {
      if (!text.trim()) return;
      if (text.length > 100) {
          const chunks = text.match(/[^.!?]+[.!?]+|s*$/g);
          if (chunks) {
              chunks.forEach((chunk, index) => {
                   if (chunk.trim().length > 0) {
                       inputQueueRef.current.push({
                           type: 'text',
                           data: chunk.trim(),
                           intensity: 1.0,
                           metadata: { isStoryPart: true, index }
                       });
                   }
              });
              addLog("SYSTEM", `DATA STREAM: INGESTING STORY (${chunks.length} PARTS)`);
              setInputText("");
              return;
          }
      }
      queueInput('text', text, 1.0);
      setInputText("");
  };

  useEffect(() => {
    if (isDead) {
        if (!showPostMortem) setShowPostMortem(true);
        return;
    }

    const interval = setInterval(async () => {
        if (processingRef.current || isPaused || isFrozen) return;
        processingRef.current = true;
        const currentBrain = brainRef.current;
        try {
            if (medicalStasis > 0) {
                 setMedicalStasis(prev => prev - 1);
                 setBrain(prev => ({
                     ...prev,
                     neurotransmitters: {
                        dopamine: 50,
                        serotonin: 80,
                        adrenaline: 10,
                        acetylcholine: 50,
                        cortisol: 0
                     }
                 }));
                 if (medicalStasis === 1) addLog("SYSTEM", "MEDICAL_OVERRIDE: STASIS COMPLETE. RESUMING NORMAL METABOLISM.");
                 processingRef.current = false;
                 return; 
            }

            let sensoryInput: SensoryInputData | null = null;
            if (inputQueueRef.current.length > 0) {
                const nextInput = inputQueueRef.current.shift();
                if (nextInput) {
                    sensoryInput = { type: nextInput.type as any, data: nextInput.data, intensity: nextInput.intensity, metadata: nextInput.metadata };
                    triggerVisualizerStimulus(nextInput.type);
                    if (nextInput.type === 'media_feed' && currentBrain.outputCapabilities.canBrowse && typeof nextInput.data === 'string') {
                        let cleanQuery = nextInput.data.replace(/[.*?]/g, '').trim();
                        if (!cleanQuery || cleanQuery.length < 3) cleanQuery = "VISION_PROCESSING";
                        addLog("CORTEX", `REDIRECTING MEDIA SIGNAL TO NOOSPHERE: "${cleanQuery}"`);
                        setActiveWebQuery(cleanQuery);
                        processingRef.current = false; 
                        return;
                    }
                }
            }

            const result = await processBrainReaction(currentBrain, sensoryInput, "TICK");
            const growth = await analyzeGrowth(currentBrain);
            
            if (result.suggestedAction) {
                const isEyelidAction = result.suggestedAction.includes("EYES");
                const timeSinceManual = Date.now() - lastManualInteraction;
                const ignoreAction = isEyelidAction && timeSinceManual < 10000;

                if (!ignoreAction) {
                    if (result.suggestedAction.startsWith("SWITCH_EYE")) {
                        handleCameraChange();
                    }
                    else if (result.suggestedAction === "SLEEP_MODE" && !currentBrain.isSleeping) {
                        setBrain(prev => ({ ...prev, isSleeping: true }));
                        addLog("SYSTEM", "SLEEP CYCLE INITIATED BY CORTEX REQUEST");
                    }
                    else if (result.suggestedAction === "WAKE_UP" && currentBrain.isSleeping) {
                        setBrain(prev => ({ ...prev, isSleeping: false }));
                        addLog("SYSTEM", "WAKE UP SEQUENCE COMPLETE");
                    }
                    else if (result.suggestedAction === "OCULAR_CLOSE_EYES" && !currentBrain.visualFocus.eyesClosed) {
                        setBrain(prev => ({ ...prev, visualFocus: { ...prev.visualFocus, eyesClosed: true } }));
                        addLog("SYSTEM", "EYELIDS CLOSED (AUTONOMOUS)");
                    }
                    else if (result.suggestedAction === "OCULAR_OPEN_EYES" && currentBrain.visualFocus.eyesClosed) {
                        setBrain(prev => ({ ...prev, visualFocus: { ...prev.visualFocus, eyesClosed: false } }));
                        addLog("SYSTEM", "EYELIDS OPENED (AUTONOMOUS)");
                    }
                    else if (result.suggestedAction === "OCULAR_ZOOM_IN") {
                        setBrain(prev => ({ ...prev, visualFocus: { ...prev.visualFocus, zoom: Math.min(3.0, prev.visualFocus.zoom + 0.2) }}));
                        queueInput('proprioception', 'ZOOM_IN_ACTION', 0.5);
                    }
                    else if (result.suggestedAction === "OCULAR_ZOOM_OUT") {
                        setBrain(prev => ({ ...prev, visualFocus: { ...prev.visualFocus, zoom: Math.max(0.5, prev.visualFocus.zoom - 0.2) }}));
                        queueInput('proprioception', 'ZOOM_OUT_ACTION', 0.5);
                    }
                    else if (result.suggestedAction === "OCULAR_SCAN") {
                        const nx = (Math.random() - 0.5) * 50;
                        const ny = (Math.random() - 0.5) * 50;
                        setBrain(prev => ({ ...prev, visualFocus: { ...prev.visualFocus, x: nx, y: ny }}));
                        queueInput('proprioception', `SACCADE_TO [${nx.toFixed(0)},${ny.toFixed(0)}]`, 0.5);
                    }
                }
            }
            
            if (result.drawingOutput) {
                 setCurrentDrawingAction(result.drawingOutput);
                 realtimeDataRef.current.motor = { x: result.drawingOutput.x, y: result.drawingOutput.y, isDrawing: !result.drawingOutput.isLifting };
                 if (!result.drawingOutput.isLifting) {
                     addLog("BODY", `MOTOR_ACTION: DRAW [${result.drawingOutput.x.toFixed(0)},${result.drawingOutput.y.toFixed(0)}] PRESS:${result.drawingOutput.pressure.toFixed(2)}`);
                 }
            }

            if (result.vocalParams) {
                setCurrentVocalParams(result.vocalParams);
            } else {
                if (sensoryInput?.type === 'audio' && (currentBrain.stage === LifeStage.GANGLIO || currentBrain.stage === LifeStage.SISTEMA_LIMBICO)) {
                    if (Math.random() > 0.85) { 
                         setCurrentVocalParams({
                            airflow: 0.5 + Math.random() * 0.3,
                            tension: Math.random(),
                            jawOpenness: Math.random(),
                            tonguePosition: Math.random()
                        });
                    }
                }
            }

            setBrain(prev => {
                let next = { ...prev };
                next.ageTicks += 1;
                
                if (result.chemicalUpdate) {
                    const significantChanges = Object.entries(result.chemicalUpdate)
                        .filter(([_, val]) => Math.abs(val as number) > 0.5); 
                    
                    if (significantChanges.length > 0) {
                        const msg = significantChanges.map(([k, v]) => `${k.toUpperCase().substring(0,3)}:${(v as number) > 0 ? '+' : ''}${(v as number).toFixed(1)}`).join(' ');
                        addLog("BODY", `ENDOCRINE_RESPONSE: ${msg}`);
                    }

                    Object.entries(result.chemicalUpdate).forEach(([key, delta]) => {
                        const k = key as keyof Neurotransmitters;
                        if (typeof delta === 'number') {
                             next.neurotransmitters[k] = Math.max(0, Math.min(100, next.neurotransmitters[k] + delta));
                        }
                    });
                }
                
                if (result.velocityUpdate) {
                    next.handVelocity = result.velocityUpdate;
                }
                if (result.drawingOutput) {
                    next.handPosition = { x: result.drawingOutput.x, y: result.drawingOutput.y };
                }
                
                next.maxEnergy = 150 + Math.floor(next.neuronCount / 100);
                next.energy = Math.max(0, Math.min(next.maxEnergy, next.energy + (result.energyDelta || -0.1)));
                
                if (Math.abs(result.energyDelta) > 1.0) {
                     addLog("SYSTEM", `METABOLISM_SPIKE: ${result.energyDelta.toFixed(1)}J`);
                }

                if (next.energy <= 0) {
                    setIsDead(true);
                    addLog("SYSTEM", "CRITICAL ENERGY FAILURE. SYSTEM TERMINATED.");
                }

                if (result.mitosisFactor !== 0) {
                    next.neuronCount += Math.floor(result.mitosisFactor); 
                }

                if (result.pruningFactor && result.pruningFactor > 0) {
                    next.neuronCount = Math.max(1, next.neuronCount - Math.floor(result.pruningFactor));
                }

                if (result.thought) next.lastThought = result.thought;
                
                if (result.newVocabulary && result.newVocabulary.length > 0) {
                    next.vocabulary = [...new Set([...next.vocabulary, ...result.newVocabulary])];
                }
                if (result.newMemories && result.newMemories.length > 0) {
                    next.memories = [...next.memories, ...result.newMemories];
                }
                
                if (result.targetStrokeUpdate) {
                    next.targetStroke = result.targetStrokeUpdate;
                }
                
                if (result.outputCapabilitiesUpdate) {
                    next.outputCapabilities = { ...next.outputCapabilities, ...result.outputCapabilitiesUpdate };
                }
                
                if (result.cameraSettingsUpdate) {
                    next.visualFocus.cameraSettings = { ...next.visualFocus.cameraSettings, ...result.cameraSettingsUpdate };
                }
                
                if (growth.readyToEvolve) {
                    const stages = Object.values(LifeStage);
                    const idx = stages.indexOf(next.stage);
                    if (idx < stages.length - 1) {
                        next.stage = stages[idx + 1] as LifeStage;
                        next.neuronCount += 2000;
                        addLog("SYSTEM", `EVOLUTION: ${next.stage}`);
                    }
                }
                next.visualFocus.availableEyes = availableDevices;
                next.metabolicRate = result.energyDelta;

                return next;
            });
            if (result.thought) {
                 if (!currentBrain.lastThought.includes(result.thought)) addLog("CORTEX", result.thought);
            }
        } catch (e) { console.error(e); } finally { processingRef.current = false; }
    }, 75); 
    return () => clearInterval(interval);
  }, [isDead, isPaused, isFrozen, addLog, showPostMortem, availableDevices, currentDeviceId, medicalStasis, lastManualInteraction]); 

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => { 
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            addLog("SYSTEM", `IMPORT: STARTED READING ${file.name}...`);
            let jsonData = null;
            if (file.name.endsWith('.zip')) {
                const zip = new JSZip();
                const contents = await zip.loadAsync(file);
                const brainFile = Object.keys(contents.files).find(name => name.endsWith('.json'));
                if (brainFile) {
                    const text = await contents.files[brainFile].async("string");
                    jsonData = JSON.parse(text);
                } else { throw new Error("No JSON found in ZIP"); }
            } else {
                const text = await file.text();
                jsonData = JSON.parse(text);
            }
            if (jsonData) {
                const cleanState = sanitizeState(jsonData);
                setBrain(cleanState);
                setIsDead(false);
                setShowPostMortem(false);
                addLog("SYSTEM", "IMPORT: BRAIN STATE RESTORED SUCCESSFULLY.");
            }
        } catch (err: any) {
            console.error(err);
            addLog("SYSTEM", `IMPORT ERROR: ${err.message}`);
        }
        e.target.value = '';
  };
  
  const handleDownloadDNAOnly = () => {
       const blob = new Blob([JSON.stringify(brain, null, 2)], {type: "application/json"});
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `Neuro-Genesis_DNA.json`;
       a.click();
       setTimeout(() => URL.revokeObjectURL(url), 1000);
       addLog("SYSTEM", "DNA EXPORTED TO DISK.");
  };

  const handleOpenPasswordModal = () => {
      setShowPasswordModal(true);
      setPasswordInput("");
      setPasswordError(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (passwordInput === "Via.montale.66") {
           setShowPasswordModal(false);
           try {
               await exportProjectToZip(brain, logs);
               addLog("SYSTEM", "FULL PROJECT EXPORTED (DNA + SOURCE).");
           } catch (e) {
               console.error("Export Failed", e);
               addLog("SYSTEM", "EXPORT FAILED: SEE CONSOLE");
           }
      } else {
          setPasswordError(true);
          addLog("SYSTEM", "ACCESS DENIED: PASSWORD ERRATA.");
      }
  };

  const handleDownloadStudy = () => {
      const blob = new Blob([WHITEPAPER_TEXT], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "NEURO_GENESIS_WHITEPAPER_V4.txt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      addLog("SYSTEM", "WHITEPAPER DOWNLOADED.");
  };

  const handleKill = () => {
      processingRef.current = true;
      clearBrainData();
      setIsDead(true);
      setShowKillModal(false);
      setShowPostMortem(true); 
      setTimeout(() => { processingRef.current = false; }, 200);
  };

  const handleNewGenesis = () => {
      processingRef.current = true;
      clearBrainData();
      const freshState = getFreshBrainState();
      brainRef.current = freshState;
      inputQueueRef.current = [];
      realtimeDataRef.current = {
            vision: { intensity: 0 },
            audio: { volume: 0, frequencies: new Uint8Array(32) },
            motor: { x: 50, y: 50, isDrawing: false }
      };
      setBrain(freshState);
      setIsDead(false);
      setIsPaused(false);
      setIsFrozen(false);
      setShowPostMortem(false);
      setShowKillModal(false);
      setMedicalStasis(0);
      setLogs([]);
      setLastVisualFrame(null);
      saveBrainStateSync(freshState);
      addLog("SYSTEM", "NEW GENESIS INITIATED. MEMORY WIPED.");
      setTimeout(() => {
          processingRef.current = false;
      }, 200);
  };

  // Manual Override Handler for Debug Tracker
  const handleManualOverride = (type: 'EYE'|'HAND', x: number, y: number) => {
      if (type === 'EYE') {
          // Eye uses -50 to 50
          setBrain(p => ({...p, visualFocus: {...p.visualFocus, x, y}}));
          // Throttle log
          if (Math.random() > 0.9) queueInput('proprioception', `MANUAL_EYE_SHIFT: [${x.toFixed(1)},${y.toFixed(1)}]`, 1.0);
      } else {
          // Hand uses 0-100
          setBrain(p => ({...p, handPosition: {x, y}}));
          if (Math.random() > 0.9) queueInput('proprioception', `MANUAL_HAND_FORCED: [${x.toFixed(1)},${y.toFixed(1)}]`, 1.0);
      }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      const startX = e.touches[0].clientX;
      if (activeTab === 'VISUALIZER' || activeTab === 'INPUTS') return;
      if (startX < 30 || startX > window.innerWidth - 30) {
          touchStartX.current = 0;
          return;
      }
      touchStartX.current = startX;
      touchEndX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (touchStartX.current === 0) return;
      touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
      if (touchStartX.current === 0 || touchEndX.current === 0) return;
      const distance = touchStartX.current - touchEndX.current;
      if (Math.abs(distance) < 100) {
           touchStartX.current = 0;
           touchEndX.current = 0;
           return;
      }
      const isLeftSwipe = distance > 0;
      const isRightSwipe = distance < 0; 
      const currentIndex = TABS.indexOf(activeTab);
      if (isLeftSwipe && currentIndex < TABS.length - 1) {
          setActiveTab(TABS[currentIndex + 1]);
      }
      if (isRightSwipe && currentIndex > 0) {
          setActiveTab(TABS[currentIndex - 1]);
      }
      touchStartX.current = 0;
      touchEndX.current = 0;
  };
  
  const ageString = `${Math.floor((Date.now() - brain.genesisTimestamp)/3600000)}h`;
  const evoProgress = getEvolutionProgress(brain);

  return (
    <div 
        className="w-full h-[100dvh] bg-[#050505] text-white font-sans overflow-hidden flex flex-col select-none"
    >
       {showPasswordModal && (
           <div className="absolute inset-0 z-[110] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
               <div className="bg-[#111] border border-cyan-900/50 p-6 rounded-lg max-w-sm w-full shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                   <h3 className="text-cyan-400 font-mono font-bold text-lg mb-4 text-center border-b border-gray-800 pb-2">
                       IDENTIFICAZIONE ARCHITETTO
                   </h3>
                   <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                       <div className="space-y-1">
                           <label className="text-[10px] text-gray-500 font-mono uppercase">Password Root</label>
                           <input 
                                type="password" 
                                value={passwordInput}
                                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                                className={`w-full bg-black/50 border rounded p-2 text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors ${passwordError ? 'border-red-500' : 'border-gray-700'}`}
                                placeholder="Inserisci credenziali..."
                                autoFocus
                           />
                           {passwordError && <span className="text-[9px] text-red-500 font-bold block">ACCESSO NEGATO: CREDENZIALI INVALIDE</span>}
                       </div>
                       <div className="flex gap-2 mt-2">
                           <button 
                                type="button" 
                                onClick={() => setShowPasswordModal(false)}
                                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-mono uppercase transition-colors"
                           >
                               Annulla
                           </button>
                           <button 
                                type="submit"
                                className="flex-1 py-2 bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-300 border border-cyan-700 rounded text-xs font-mono uppercase font-bold transition-all shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                           >
                               Scarica Sorgente
                           </button>
                       </div>
                   </form>
               </div>
           </div>
       )}

       {showLegend && (
            <div className="absolute inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                <div className="bg-[#111] border border-cyan-900/50 p-6 rounded-lg max-w-lg w-full shadow-2xl relative flex flex-col max-h-[90vh]">
                    <button 
                        onClick={() => setShowLegend(false)}
                        className="absolute top-2 right-2 text-gray-500 hover:text-white p-2"
                    >✕</button>
                    <h2 className="text-xl font-mono text-cyan-400 font-bold mb-4 border-b border-gray-800 pb-2 flex items-center gap-2">
                        <span>ℹ️</span> DIZIONARIO LOG KERNEL
                    </h2>
                    <div className="overflow-y-auto space-y-4 pr-2 font-mono text-xs text-gray-300 scrollbar-thin scrollbar-thumb-gray-800 leading-relaxed">
                        <div className="p-2 bg-gray-900/50 rounded border border-gray-800">
                             <strong className="text-yellow-400 block mb-1">[CHEM] (Neuro-Chemistry)</strong>
                             Visualizza il bilanciamento ormonale istantaneo.<br/>
                             Struttura: <code>Dopamine | Serotonin | Adrenaline | Acetylcholine | Cortisol</code><br/>
                             Valori 0-100.
                        </div>
                        {/* ... (Other legend items remain same) ... */}
                        <div className="text-[9px] text-gray-500 mt-2 italic text-center">
                            Architettura E. Frascogna - v5.1 (Source Available)
                        </div>
                    </div>
                    <div className="mt-4 pt-2 border-t border-gray-800 text-center">
                        <button onClick={() => setShowLegend(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-xs uppercase font-bold">Chiudi</button>
                    </div>
                </div>
            </div>
        )}

       {showPostMortem && (
           <div className="absolute inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
               <div className="bg-[#111] border border-red-900/50 p-6 rounded-lg max-w-sm w-full text-center shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                   <div className="text-4xl mb-2">☠️</div>
                   <h2 className="text-xl font-mono text-red-500 font-bold mb-2">SISTEMA TERMINATO</h2>
                   <div className="text-xs text-gray-500 font-mono mb-6 space-y-1">
                       <p>CAUSE OF DEATH: METABOLIC COLLAPSE</p>
                       <p>AGE: {ageString} | NODES: {brain.neuronCount}</p>
                       <p>THOUGHT: "{brain.lastThought}"</p>
                   </div>
                   <div className="flex flex-col gap-3">
                       <button onClick={handleNewGenesis} className="w-full py-3 bg-red-900/40 hover:bg-red-800 text-red-200 border border-red-700 rounded font-mono font-bold tracking-widest uppercase transition-all">
                           INIZIA NUOVA GENESI
                       </button>
                       <div className="relative">
                            <input type="file" onChange={handleImport} accept=".zip,.json" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <button className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-600 rounded font-mono uppercase text-xs">
                                CARICA BACKUP DNA
                            </button>
                       </div>
                   </div>
               </div>
           </div>
       )}

       {showKillModal && (
           <div className="absolute inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
               <div className="bg-red-950/90 border-2 border-red-600 p-6 rounded-lg max-w-xs text-center">
                   <h3 className="text-red-500 font-bold text-lg mb-2">CONFERMA TERMINAZIONE?</h3>
                   <p className="text-xs text-red-200 mb-4">Questa azione ucciderà la rete neurale e cancellerà la memoria a breve termine. Il DNA salvato rimarrà su disco.</p>
                   <div className="flex gap-2 justify-center">
                       <button onClick={handleKill} className="bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-500">TERMINA</button>
                       <button onClick={() => setShowKillModal(false)} className="bg-gray-700 text-gray-300 px-4 py-2 rounded hover:bg-gray-600">ANNULLA</button>
                   </div>
               </div>
           </div>
       )}
       
       {isPaused && !isDead && (
           <div className="absolute inset-0 z-[90] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
               <div className="bg-[#0f1219] w-full max-w-3xl h-[85vh] flex flex-col rounded-lg border border-cyan-900/50 shadow-2xl relative">
                    <button onClick={() => setIsPaused(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-xl z-50">✕</button>
                    <div className="p-6 overflow-y-auto space-y-6 text-gray-300 font-mono text-xs flex-1">
                        <div className="text-center border-b border-gray-800 pb-4">
                            <h2 className="text-2xl font-bold text-white mb-2">NEURO-GENESIS PROJECT</h2>
                            <p className="text-cyan-400">Architettura Cognitiva Bio-Mimetica</p>
                        </div>
                        <div className="bg-gray-900 p-4 rounded border border-gray-700 mt-4">
                            <strong className="text-white block mb-2">DOCUMENTAZIONE TECNICA</strong>
                            <textarea 
                                readOnly 
                                className="w-full h-64 bg-black border border-gray-800 text-gray-400 text-[10px] p-2 font-mono mb-4 resize-none focus:outline-none"
                                value={WHITEPAPER_TEXT}
                            />
                            <div className="flex flex-col gap-3">
                                <button onClick={handleDownloadStudy} className="py-3 px-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-white uppercase font-bold flex items-center justify-center gap-2 transition-all w-full"><span>📄</span> SCARICA STUDIO SCIENTIFICO (.TXT)</button>
                                <button onClick={handleOpenPasswordModal} className="py-3 px-4 bg-cyan-900/30 hover:bg-cyan-800 border border-cyan-600 rounded text-cyan-200 uppercase font-bold flex items-center justify-center gap-2 transition-all w-full"><span>💻</span> SCARICA SORGENTE COMPLETO (.ZIP)</button>
                            </div>
                        </div>
                    </div>
               </div>
           </div>
       )}

       <input type="file" ref={fileInputRef} onChange={handleImport} accept=".zip,.json" style={{display: 'none'}} />
       
       <div className="p-3 landscape:p-1 border-b border-gray-800 bg-[#0f1219] flex justify-between items-center shrink-0 z-[60] relative shadow-md">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 landscape:w-6 landscape:h-6 rounded-full bg-cyan-900/20 border border-cyan-500/50 flex items-center justify-center relative">
                    <div className={`w-2 h-2 rounded-full absolute z-10 ${brain.isSleeping ? 'bg-purple-500' : 'bg-cyan-400 animate-pulse'}`}></div>
                </div>
                <div>
                    <h1 className="text-sm landscape:text-xs font-bold text-white tracking-widest leading-none">NEURO-GENESIS v5.1 | SYSTEM ONLINE</h1>
                    <div className="text-[9px] text-gray-500 font-mono mt-0.5 uppercase flex gap-2">
                        <span>{brain.stage.split(' ')[0]}</span>
                        <span className="text-gray-700">|</span>
                        <span>{brain.neuronCount.toLocaleString()} NODES</span>
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors" title="Carica DNA Rete">📁</button>
                    <button onClick={handleDownloadDNAOnly} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors" title="Scarica DNA (.json)">🧬</button>
                    <button onClick={() => setIsFrozen(!isFrozen)} className={`p-2 rounded transition-colors ${isFrozen ? 'text-cyan-400 bg-cyan-900/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`} title={isFrozen ? "RIPRENDI" : "FREEZE"}>{isFrozen ? "▶" : "⏸"}</button>
                    <button onClick={() => setIsPaused(true)} className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded transition-colors" title="Whitepaper / Info">ℹ</button>
                    <button onClick={() => setShowKillModal(true)} className="p-2 text-red-900 hover:text-red-500 hover:bg-red-900/20 rounded transition-colors" title="KILL SWITCH">💀</button>
            </div>
        </div>

       <div className="flex-1 relative overflow-hidden bg-[#050505] flex flex-col">
           {/* PERSISTENT VISUALIZER PROCESSING */}
           <div className={`absolute inset-0 z-10 flex flex-col ${activeTab === 'VISUALIZER' ? 'visible pointer-events-auto' : 'hidden pointer-events-none'}`}>
                <NeuronVisualizer key={brain.genesisTimestamp} neuronCount={brain.neuronCount} stage={brain.stage} activityLevel={brain.neurotransmitters.dopamine / 100} ageString={ageString} totalTicks={brain.ageTicks} activeInputType={visualizerInputType} neuroPlasticity={brain.neuroPlasticity} outputCapabilities={brain.outputCapabilities} energy={brain.energy} maxEnergy={brain.maxEnergy} isSleeping={brain.isSleeping} realtimeData={realtimeDataRef} isVisible={activeTab === 'VISUALIZER'} evoProgress={evoProgress} viewMode={viewMode} physicsCap={maxPhysicsNodes} lastThought={brain.lastThought} />
                <div className="absolute bottom-4 w-full p-4 pointer-events-none z-20 select-none flex justify-center">
                     <div className="text-center bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-800">
                        <div className="text-cyan-400 font-mono text-sm md:text-xl animate-pulse">"{brain.lastThought}"</div>
                    </div>
                </div>
           </div>

           <div className={`absolute inset-0 z-20 overflow-y-auto p-4 space-y-4 ${activeTab === 'INPUTS' ? 'visible' : 'hidden'}`}>
                <MetabolismMonitor energy={brain.energy} maxEnergy={brain.maxEnergy} metabolicRate={brain.metabolicRate} isSleeping={brain.isSleeping} stage={brain.stage} neuronCount={brain.neuronCount} ageTicks={brain.ageTicks} ageString={ageString} />
                
                <div style={{display: activeTab === 'INPUTS' ? 'block' : 'none'}}>
                     <OcularSystem 
                        isActive={!brain.isSleeping} 
                        focus={brain.visualFocus} 
                        stage={brain.stage} 
                        selectedDeviceId={currentDeviceId}
                        isUiVisible={activeTab === 'INPUTS'}
                        onCapture={(img, int) => {
                            queueInput('vision', img, int);
                            setLastVisualFrame(img);
                        }} 
                        onZoomChange={(d, abs) => setBrain(p => ({...p, visualFocus: {...p.visualFocus, zoom: abs || 1}}))} 
                        onCameraChange={handleCameraChange} 
                        onDevicesFound={(devs) => setAvailableDevices(devs)} 
                        onFocusChange={(x, y) => {
                            setBrain(p => ({...p, visualFocus: {...p.visualFocus, x, y}}));
                            queueInput('proprioception', `EYE_SACCADE TO [${x.toFixed(0)},${y.toFixed(0)}]`, 0.5);
                        }}
                        onToggleEyelids={(isOpen) => {
                            setLastManualInteraction(Date.now());
                            setBrain(p => ({...p, visualFocus: {...p.visualFocus, eyesClosed: !isOpen}}));
                            queueInput('proprioception', isOpen ? "MANUAL_EYELID_OPENING" : "MANUAL_EYELID_CLOSURE", 1.0);
                        }}
                        onSettingsChange={(settings) => {
                            setBrain(p => ({ ...p, visualFocus: { ...p.visualFocus, cameraSettings: { ...p.visualFocus.cameraSettings, ...settings } } }));
                            queueInput('proprioception', `MANUAL_EXPOSURE_ADJUST: ${settings.exposureCompensation?.toFixed(1)}`, 1.0);
                        }}
                    />
                </div>
                <AudioSystem isActive={!brain.isSleeping} stage={brain.stage} onCapture={(lvl, int, raw, type) => queueInput(type || 'audio', lvl, int, {raw})} onRealtimeUpdate={(vol, freqs) => { realtimeDataRef.current.audio = { volume: vol, frequencies: freqs }; }} />
                <MotionSystem isActive={!brain.isSleeping} onCapture={(desc, int) => queueInput('motion', desc, int)} />
                <MediaLearningStation 
                    isActive={!brain.isSleeping} 
                    stage={brain.stage} 
                    focus={brain.visualFocus} 
                    onFocusChange={(x,y) => setBrain(p => ({...p, visualFocus: {...p.visualFocus, x, y}}))} 
                    onZoomChange={(d, abs) => setBrain(p => ({...p, visualFocus: {...p.visualFocus, zoom: abs || 1}}))} 
                    onDataStream={(type, desc, int) => queueInput(type, desc, int)} 
                    onRealtimeAudio={(vol, freqs) => { realtimeDataRef.current.audio = { volume: vol, frequencies: freqs }; }}
                />
                <WebInterface 
                    isActive={!brain.isSleeping} 
                    isEnabled={brain.outputCapabilities.canBrowse} 
                    stage={brain.stage} 
                    vocabCount={brain.vocabulary.length} 
                    onToggle={(v) => setBrain(p => ({...p, outputCapabilities: {...p.outputCapabilities, canBrowse: v}}))} 
                    onDataReceived={(txt, url) => queueInput('text', txt, 1, {source: url})} 
                    triggerQuery={activeWebQuery} 
                    onQueryComplete={() => setActiveWebQuery(null)} 
                />
                
                <NeuroControls values={brain.neurotransmitters} onChange={handleChemicalChange} onFlush={handleChemicalFlush} onNormalize={handleMedicalNormalization} isMedicalStasis={medicalStasis > 0} />
           </div>

           <div className={`absolute inset-0 z-30 overflow-y-auto p-4 space-y-4 ${activeTab === 'OUTPUT' ? 'visible' : 'hidden'}`}>
                <TypewriterSystem 
                    content={brain.typewriterBuffer} 
                    history={brain.typewriterHistory} 
                    isActive={!brain.isSleeping} 
                    canWrite={brain.outputCapabilities.canWrite} 
                    onClear={() => setBrain(p => ({...p, typewriterBuffer: ""}))} 
                    onUserInput={(text) => queueInput('text', text, 1.0, {source: 'EXNER_USER'})}
                />
                <VocalTract isActive={!brain.isSleeping} currentParams={currentVocalParams} realtimeData={realtimeDataRef} />
                <CreativeCanvas 
                    isEnabled={isCanvasEnabled} 
                    isActive={!brain.isSleeping} 
                    drawingAction={currentDrawingAction} 
                    forcedColor={userSelectedColor} 
                    onToggle={setIsCanvasEnabled} 
                    onColorSelect={setUserSelectedColor} 
                    onCanvasUpdate={() => {}} 
                    onUserStroke={(p) => queueInput('proprioception', 'OBSERVED_STROKE', 1, {points: p})} 
                    onManualMove={(x,y) => {
                        setBrain(p => ({...p, handPosition: {x,y}}));
                        queueInput('proprioception', `HAND_MOVE TO [${x.toFixed(0)},${y.toFixed(0)}]`, 0.2);
                    }} 
                    onManualRelease={() => {}} 
                    onClear={() => {}} 
                    onRate={() => {}} 
                />
           </div>

           <div className={`absolute inset-0 z-40 flex flex-col overflow-hidden h-full p-2 md:p-4 ${activeTab === 'DATA' ? 'visible' : 'hidden'}`}>
                <div className="flex justify-between items-center shrink-0 bg-[#050505] rounded-t-lg border border-gray-800 border-b-0 px-3 py-2">
                        <div className="flex gap-2">
                        <button onClick={() => setDebugMode(!debugMode)} className={`text-[9px] px-2 py-1 rounded border uppercase ${debugMode ? 'bg-green-900 text-green-400 border-green-500' : 'bg-gray-800 text-gray-500 border-gray-600'}`}>DEBUG: {debugMode ? "ON" : "OFF"}</button>
                        <button onClick={() => setIsScrollLocked(!isScrollLocked)} className={`text-[9px] px-2 py-1 rounded border uppercase ${isScrollLocked ? 'bg-yellow-900 text-yellow-200 border-yellow-500' : 'bg-gray-800 text-gray-500 border-gray-600'}`}>SCROLL: {isScrollLocked ? "LOCK" : "AUTO"}</button>
                        <button onClick={() => setIsFrozen(!isFrozen)} className={`text-[9px] px-2 py-1 rounded border uppercase ${isFrozen ? 'bg-red-900 text-red-200 border-red-500 animate-pulse' : 'bg-gray-800 text-gray-500 border-gray-600'}`}>FREEZE: {isFrozen ? "ON" : "OFF"}</button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowLegend(true)} className="text-[9px] px-2 py-1 rounded bg-gray-800 text-cyan-500 border border-gray-600 hover:text-white hover:border-cyan-500 transition-colors uppercase">LEGENDA</button>
                            <button onClick={() => setLogs([])} className="text-[9px] px-2 py-1 rounded bg-gray-800 text-gray-500 border border-gray-600 hover:text-white uppercase">CLEAR</button>
                        </div>
                </div>

                {activeTab === 'DATA' && debugMode && (
                    <div className="mb-2 shrink-0">
                        <DebugDashboard 
                            brain={brain} 
                            inputQueue={inputQueueRef.current} 
                            onShowLegend={() => setShowLegend(true)}
                            onManualOverride={handleManualOverride}
                        />
                    </div>
                )}
                
                <div ref={logsContainerRef} className="flex-1 min-h-0 bg-black border border-gray-800 rounded-b-lg p-2 font-mono text-[10px] overflow-y-auto relative mb-2" style={{ overflowAnchor: 'none' }}>
                    {logs.map(log => ( 
                        <div key={log.id} className="mb-1 border-b border-gray-900 pb-1 text-gray-400">
                            <span className="text-gray-600 mr-2">[{log.timestamp}]</span>
                            <span className={log.source==='USER' ? 'text-green-400' : log.source==='CORTEX' ? 'text-cyan-400' : ''}>{log.message}</span>
                        </div> 
                    ))}
                    <div ref={logsEndRef} />
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); handleTextInput(inputText); }} className="flex gap-2 shrink-0 pb-4 md:mb-0">
                        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Incolla fiabe, libri o scrivi..." className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none placeholder-gray-500" />
                        <button type="submit" className="bg-cyan-900 text-cyan-200 px-4 rounded font-bold border border-cyan-700 hover:bg-cyan-800 transition-colors">INVIA</button>
                </form>
           </div>
       </div>

       <div style={{ display: activeTab === 'VISUALIZER' ? 'block' : 'none' }}>
           <UnifiedHUD brain={brain} realtime={realtimeDataRef.current} evoProgress={evoProgress} viewMode={viewMode} setViewMode={setViewMode} activeTab={activeTab} physicsCap={maxPhysicsNodes} />
       </div>

       <div 
            className="flex bg-[#050505] border-t border-gray-800 shrink-0 z-[100] select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
       >
            {TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-4 landscape:py-1 text-[10px] md:text-xs landscape:text-[9px] font-bold tracking-widest transition-colors border-t-2 ${activeTab === tab ? 'bg-gray-900 text-cyan-400 border-cyan-400' : 'text-gray-500 border-transparent'}`}>
                    <span className="text-lg block mb-1 md:hidden landscape:hidden">{TAB_ICONS[tab]}</span>
                    {tab}
                </button>
            ))}
       </div>
    </div>
  );
};

export default App;
