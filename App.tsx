
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
Versione Documento: 5.0 (Integrazione Rust/Wasm & Backend)
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
    const hudRef = useRef<HTMLDivElement>(null);
    return (
        <div ref={hudRef} className="absolute z-[120] pointer-events-auto bg-black/90 text-white p-2 rounded border border-gray-700 top-20 left-20">
           <div className="font-mono text-xs">HUD ACTIVE</div>
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

  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<DeviceInfo[]>([]);
  
  const [activeWebQuery, setActiveWebQuery] = useState<string | null>(null);
  const [visualizerInputType, setVisualizerInputType] = useState<string | null>(null);
  const visualizerTimerRef = useRef<number | null>(null);

  const [lastVisualFrame, setLastVisualFrame] = useState<string | null>(null);

  const brainRef = useRef<BrainState>(brain);
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

  const maxPhysicsNodes = useMemo(() => {
    return 1000;
  }, []);

  useEffect(() => { brainRef.current = brain; }, [brain]);

  const handleCameraChange = () => {
      if (availableDevices.length === 0) return;
      const currentIdx = currentDeviceId ? availableDevices.findIndex(d => d.id === currentDeviceId) : -1;
      const nextIdx = (currentIdx + 1) % availableDevices.length;
      const nextDevice = availableDevices[nextIdx];
      if (nextDevice) setCurrentDeviceId(nextDevice.id);
  };
  
  const handleChemicalChange = (key: keyof Neurotransmitters, value: number) => {
      setBrain(prev => ({...prev, neurotransmitters: {...prev.neurotransmitters, [key]: value}}));
  };

  const handleChemicalFlush = () => {
      setBrain(prev => ({...prev, neurotransmitters: {dopamine: 10, serotonin: 10, adrenaline: 0, acetylcholine: 10, cortisol: 0}}));
  };

  const handleMedicalNormalization = () => {
      setMedicalStasis(50); 
      setBrain(prev => ({...prev, neurotransmitters: {dopamine: 50, serotonin: 80, adrenaline: 10, acetylcholine: 50, cortisol: 0}, energy: Math.max(prev.energy, 80)}));
  };

  useEffect(() => {
    loadBrainState().then(state => {
      if (state) setBrain(state);
    });
    const saveInt = window.setInterval(() => { if (!isDead && !isPaused && !isFrozen) saveBrainState(brainRef.current); }, 10000); 
    return () => clearInterval(saveInt);
  }, [isDead, isPaused, isFrozen]);

  const addLog = useCallback((source: SimulationLog['source'], message: string, attachment?: string, details?: any) => {
      const timestamp = new Date().toLocaleTimeString();
      const newLog: SimulationLog = { id: Math.random().toString(36).substr(2, 9), timestamp, source, message, attachment, details };
      setLogs(prev => { const next = [...prev, newLog]; return next.length > 5000 ? next.slice(next.length - 5000) : next; });
  }, []);

  const queueInput = (type: string, data: any, intensity: number = 0.5, metadata?: any) => {
      if (isDead || isPaused || isFrozen) return;
      inputQueueRef.current.push({ type, data, intensity, metadata });
  };
  
  const handleTextInput = (text: string) => {
      if (!text.trim()) return;
      queueInput('text', text, 1.0);
      setInputText("");
  };

  useEffect(() => {
    if (isDead) { if (!showPostMortem) setShowPostMortem(true); return; }
    const interval = setInterval(async () => {
        if (processingRef.current || isPaused || isFrozen) return;
        processingRef.current = true;
        const currentBrain = brainRef.current;
        try {
            if (medicalStasis > 0) setMedicalStasis(prev => prev - 1);

            let sensoryInput: SensoryInputData | null = null;
            if (inputQueueRef.current.length > 0) {
                const nextInput = inputQueueRef.current.shift();
                if (nextInput) sensoryInput = { type: nextInput.type as any, data: nextInput.data, intensity: nextInput.intensity, metadata: nextInput.metadata };
            }

            const result = await processBrainReaction(currentBrain, sensoryInput, "TICK");
            const growth = await analyzeGrowth(currentBrain);
            
            setBrain(prev => {
                let next = { ...prev };
                next.ageTicks += 1;
                if (result.chemicalUpdate) Object.entries(result.chemicalUpdate).forEach(([key, delta]) => { const k = key as keyof Neurotransmitters; if (typeof delta === 'number') next.neurotransmitters[k] = Math.max(0, Math.min(100, next.neurotransmitters[k] + delta)); });
                next.energy = Math.max(0, Math.min(next.maxEnergy, next.energy + (result.energyDelta || -0.1)));
                if (next.energy <= 0) setIsDead(true);
                if (result.thought) next.lastThought = result.thought;
                if (growth.readyToEvolve) next.stage = LifeStage.GANGLIO; 
                return next;
            });
        } catch (e) { console.error(e); } finally { processingRef.current = false; }
    }, 75); 
    return () => clearInterval(interval);
  }, [isDead, isPaused, isFrozen, addLog, medicalStasis]); 

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => { 
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            setBrain(sanitizeState(JSON.parse(text)));
        } catch (err: any) { console.error(err); }
  };
  
  const handleDownloadDNAOnly = () => {
       const blob = new Blob([JSON.stringify(brain, null, 2)], {type: "application/json"});
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url; a.download = "DNA.json"; a.click();
  };

  const handleDownloadSourceAndDNA = async () => {
       await exportProjectToZip(brain, logs);
  };

  const handleNewGenesis = () => {
      const freshState = getFreshBrainState();
      setBrain(freshState);
      setIsDead(false);
      setShowPostMortem(false);
      saveBrainStateSync(freshState);
  };
  
  const ageString = `${Math.floor((Date.now() - brain.genesisTimestamp)/3600000)}h`;
  const evoProgress = getEvolutionProgress(brain);

  return (
    <div className="w-full h-[100dvh] bg-[#050505] text-white font-sans overflow-hidden flex flex-col select-none">
       <div className="p-3 border-b border-gray-800 bg-[#0f1219] flex justify-between items-center shrink-0 z-[60] relative shadow-md">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-900/20 border border-cyan-500/50 flex items-center justify-center relative">
                    <div className={`w-2 h-2 rounded-full absolute z-10 ${brain.isSleeping ? 'bg-purple-500' : 'bg-cyan-400 animate-pulse'}`}></div>
                </div>
                <div>
                    <h1 className="text-sm font-bold text-white tracking-widest leading-none">NEURO-GENESIS | SYSTEM ONLINE</h1>
                    <div className="text-[9px] text-gray-500 font-mono mt-0.5 uppercase flex gap-2">
                        <span>{brain.stage.split(' ')[0]}</span>
                        <span className="text-gray-700">|</span>
                        <span>{brain.neuronCount.toLocaleString()} NODES</span>
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                    <button onClick={handleDownloadSourceAndDNA} className="p-2 text-cyan-400 hover:text-white hover:bg-gray-800 rounded transition-colors" title="Export Source">📦</button>
            </div>
        </div>

       <div className="flex-1 relative overflow-hidden bg-[#050505] flex flex-col">
           <div className={`absolute inset-0 z-10 flex flex-col ${activeTab === 'VISUALIZER' ? 'visible pointer-events-auto' : 'hidden pointer-events-none'}`}>
                <NeuronVisualizer key={brain.genesisTimestamp} neuronCount={brain.neuronCount} stage={brain.stage} activityLevel={brain.neurotransmitters.dopamine / 100} ageString={ageString} totalTicks={brain.ageTicks} activeInputType={visualizerInputType} neuroPlasticity={brain.neuroPlasticity} outputCapabilities={brain.outputCapabilities} energy={brain.energy} maxEnergy={brain.maxEnergy} isSleeping={brain.isSleeping} realtimeData={realtimeDataRef} isVisible={activeTab === 'VISUALIZER'} evoProgress={evoProgress} viewMode={viewMode} physicsCap={maxPhysicsNodes} lastThought={brain.lastThought} />
           </div>

           <div className={`absolute inset-0 z-20 overflow-y-auto p-4 space-y-4 ${activeTab === 'INPUTS' ? 'visible' : 'hidden'}`}>
                <MetabolismMonitor energy={brain.energy} maxEnergy={brain.maxEnergy} metabolicRate={brain.metabolicRate} isSleeping={brain.isSleeping} stage={brain.stage} neuronCount={brain.neuronCount} ageTicks={brain.ageTicks} ageString={ageString} />
                <div style={{display: activeTab === 'INPUTS' ? 'block' : 'none'}}>
                     <OcularSystem isActive={!brain.isSleeping} focus={brain.visualFocus} stage={brain.stage} selectedDeviceId={currentDeviceId} isUiVisible={activeTab === 'INPUTS'} onCapture={(img, int) => queueInput('vision', img, int)} onZoomChange={(d, abs) => setBrain(p => ({...p, visualFocus: {...p.visualFocus, zoom: abs || 1}}))} onCameraChange={handleCameraChange} onDevicesFound={setAvailableDevices} onFocusChange={(x, y) => setBrain(p => ({...p, visualFocus: {...p.visualFocus, x, y}}))} onToggleEyelids={(isOpen) => setBrain(p => ({...p, visualFocus: {...p.visualFocus, eyesClosed: !isOpen}}))} onSettingsChange={() => {}} />
                </div>
                <AudioSystem isActive={!brain.isSleeping} stage={brain.stage} onCapture={(lvl, int, raw, type) => queueInput(type || 'audio', lvl, int, {raw})} />
                <MotionSystem isActive={!brain.isSleeping} onCapture={(desc, int) => queueInput('motion', desc, int)} />
                <NeuroControls values={brain.neurotransmitters} onChange={handleChemicalChange} onFlush={handleChemicalFlush} onNormalize={handleMedicalNormalization} isMedicalStasis={medicalStasis > 0} />
           </div>

           <div className={`absolute inset-0 z-30 overflow-y-auto p-4 space-y-4 ${activeTab === 'OUTPUT' ? 'visible' : 'hidden'}`}>
                <TypewriterSystem content={brain.typewriterBuffer} history={brain.typewriterHistory} isActive={!brain.isSleeping} canWrite={brain.outputCapabilities.canWrite} onClear={() => setBrain(p => ({...p, typewriterBuffer: ""}))} onUserInput={(text) => queueInput('text', text, 1.0, {source: 'EXNER_USER'})} />
                <VocalTract isActive={!brain.isSleeping} currentParams={currentVocalParams} realtimeData={realtimeDataRef} />
                <CreativeCanvas isEnabled={isCanvasEnabled} isActive={!brain.isSleeping} drawingAction={currentDrawingAction} forcedColor={userSelectedColor} onToggle={setIsCanvasEnabled} onColorSelect={setUserSelectedColor} onCanvasUpdate={() => {}} onUserStroke={() => {}} onManualMove={() => {}} onManualRelease={() => {}} onClear={() => {}} onRate={() => {}} />
           </div>
           
           <div style={{ display: activeTab === 'VISUALIZER' ? 'block' : 'none' }}>
               <UnifiedHUD brain={brain} realtime={realtimeDataRef.current} evoProgress={evoProgress} viewMode={viewMode} setViewMode={setViewMode} activeTab={activeTab} physicsCap={maxPhysicsNodes} />
           </div>
       </div>

       <div className="flex bg-[#050505] border-t border-gray-800 shrink-0 z-[100] select-none">
            {TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-4 text-[10px] font-bold tracking-widest transition-colors border-t-2 ${activeTab === tab ? 'bg-gray-900 text-cyan-400 border-cyan-400' : 'text-gray-500 border-transparent'}`}>
                    <span className="text-lg block mb-1">{TAB_ICONS[tab]}</span>
                    {tab}
                </button>
            ))}
       </div>
    </div>
  );
};

export default App;
