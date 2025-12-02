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
Architetto & Lead Developer: Emilio Frascogna`;

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
                <button onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }} className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded border border-gray-700 bg-black text-xs">
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
                                <button onClick={(e) => { e.stopPropagation(); setViewMode('CORE'); }} className={`flex-1 py-1 rounded border text-[9px] ${viewMode === 'CORE' ? 'bg-cyan-900 text-cyan-200 border-cyan-500' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>CORE</button>
                                <button onClick={(e) => { e.stopPropagation(); setViewMode('FULL'); }} className={`flex-1 py-1 rounded border text-[9px] ${viewMode === 'FULL' ? 'bg-red-900/80 text-white border-red-500 animate-pulse' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>FULL</button>
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
                </div>
            )}
        </div>
    );
};

const App: React.FC = () => {
  const [brain, setBrain] = useState<BrainState>(getFreshBrainState());
  const [activeTab, setActiveTab] = useState<string>('INPUTS');
  const [viewMode, setViewMode] = useState<'CORE' | 'FULL'>('CORE');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState(false);
  const [logs, setLogs] = useState<SimulationLog[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [showKillModal, setShowKillModal] = useState(false);
  const [showPostMortem, setShowPostMortem] = useState(false);
  const [medicalStasis, setMedicalStasis] = useState(0); 
  const [showLegend, setShowLegend] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<DeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [activeWebQuery, setActiveWebQuery] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");

  const brainRef = useRef<BrainState>(brain);
  const inputQueueRef = useRef<any[]>([]);
  const realtimeDataRef = useRef<RealtimeSensoryData>({ vision: { intensity: 0 }, audio: { volume: 0, frequencies: new Uint8Array(32) }, motor: { x: 50, y: 50, isDrawing: false } });
  const processingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { brainRef.current = brain; }, [brain]);

  const addLog = useCallback((source: SimulationLog['source'], message: string) => {
      setLogs(prev => [...prev, { id: Math.random().toString(), timestamp: new Date().toLocaleTimeString(), source, message }].slice(-500));
  }, []);

  const queueInput = (type: string, data: any, intensity = 0.5) => {
      inputQueueRef.current.push({ type, data, intensity });
      addLog(type === 'vision' ? 'OCULAR' : 'SYSTEM', `INPUT: ${type}`);
  };

  useEffect(() => {
    loadBrainState().then(state => {
      if (state) { setBrain(state); addLog("SYSTEM", "STATE RESTORED"); }
    });
    const saveInt = setInterval(() => { if (!isDead) saveBrainState(brainRef.current); }, 10000); 
    return () => clearInterval(saveInt);
  }, []);

  useEffect(() => {
    if (isDead) { if (!showPostMortem) setShowPostMortem(true); return; }
    const interval = setInterval(async () => {
        if (processingRef.current || isPaused || isFrozen) return;
        processingRef.current = true;
        try {
            let input = inputQueueRef.current.shift();
            const result = await processBrainReaction(brainRef.current, input ? { type: input.type, data: input.data, intensity: input.intensity } : null, "TICK");
            
            setBrain(prev => {
                let next = { ...prev };
                next.ageTicks++;
                if (result.chemicalUpdate) Object.assign(next.neurotransmitters, result.chemicalUpdate);
                next.energy += result.energyDelta;
                if (next.energy <= 0) setIsDead(true);
                if (result.thought) next.lastThought = result.thought;
                return next;
            });
        } catch(e) { console.error(e); } finally { processingRef.current = false; }
    }, 75);
    return () => clearInterval(interval);
  }, [isDead, isPaused, isFrozen]);

  const handleAuthAndDownload = async () => {
      if (authInput === "FRASCOGNA-ARCH") {
          setIsAuthModalOpen(false);
          setAuthError(false);
          try {
              await exportProjectToZip(brain, logs);
              addLog("SYSTEM", "FULL EXPORT (SOURCE+DATA) AUTHORIZED.");
          } catch (e) {
              console.error(e);
              addLog("SYSTEM", "EXPORT FAILED.");
          }
      } else {
          setAuthError(true);
      }
  };

  return (
    <div className="w-full h-full bg-black text-white font-sans">
       {isAuthModalOpen && (
           <div className="absolute inset-0 z-[150] bg-black/95 flex items-center justify-center p-4">
               <div className="bg-[#111] border border-cyan-900/50 p-6 rounded-lg max-w-sm w-full text-center">
                   <h2 className="text-lg font-mono text-cyan-400 font-bold mb-2">IDENTIFICAZIONE ARCHITETTO</h2>
                   <input type="password" value={authInput} onChange={(e) => setAuthInput(e.target.value)} className="w-full bg-black border border-gray-700 p-2 rounded text-center text-cyan-400 mb-4" placeholder="PASSWORD" />
                   {authError && <div className="text-red-500 text-xs font-bold mb-2">ACCESSO NEGATO.</div>}
                   <button onClick={handleAuthAndDownload} className="w-full py-2 bg-cyan-900/50 border border-cyan-700 rounded text-cyan-200">SBLOCCA & SCARICA</button>
                   <button onClick={() => setIsAuthModalOpen(false)} className="mt-2 text-gray-500 text-xs">ANNULLA</button>
               </div>
           </div>
       )}
       <div className="p-2 border-b border-gray-800 flex justify-between items-center">
            <h1 className="text-sm font-bold">NEURO-GENESIS v5.1</h1>
            <button onClick={() => setIsAuthModalOpen(true)} className="text-cyan-500">💾 EXPORT</button>
       </div>
       <div className="relative h-[calc(100vh-50px)]">
           <NeuronVisualizer neuronCount={brain.neuronCount} stage={brain.stage} activityLevel={0.5} ageString="0h" totalTicks={brain.ageTicks} activeInputType={null} neuroPlasticity={brain.neuroPlasticity} outputCapabilities={brain.outputCapabilities} energy={brain.energy} maxEnergy={brain.maxEnergy} isSleeping={brain.isSleeping} realtimeData={realtimeDataRef} isVisible={activeTab==='VISUALIZER'} evoProgress={{requirements:[]}} viewMode={viewMode} physicsCap={2000} />
       </div>
       <div className="absolute bottom-0 w-full bg-black border-t border-gray-800 flex">
            {['VISUALIZER', 'INPUTS', 'OUTPUT', 'DATA'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-4 text-xs font-bold ${activeTab === tab ? 'text-cyan-400' : 'text-gray-500'}`}>{tab}</button>
            ))}
       </div>
    </div>
  );
};

export default App;