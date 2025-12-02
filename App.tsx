import React, { useState, useEffect } from 'react';
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
import { getFreshBrainState, loadBrainState, saveBrainState } from './services/persistence';
import { processBrainReaction, getEvolutionProgress } from './services/cognitiveEngine';
import { exportProjectToZip } from './services/sourceExporter';

export default function App() {
  const [brain, setBrain] = useState(getFreshBrainState());
  const [logs, setLogs] = useState<any[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const realtimeDataRef = React.useRef<any>({});

  useEffect(() => {
      loadBrainState().then(s => { if(s) setBrain(s); });
      const int = setInterval(async () => {
          const res = await processBrainReaction(brain, null, "");
          setBrain(p => ({...p, ageTicks: p.ageTicks+1, neuronCount: p.neuronCount + res.mitosisFactor}));
      }, 100);
      return () => clearInterval(int);
  }, []);

  const handleDownload = async (e: React.FormEvent) => {
      e.preventDefault();
      if (passwordInput === "Via.montale.66") {
          await exportProjectToZip(brain, logs);
          setShowPasswordModal(false);
      } else {
          alert("Password Errata");
      }
  };

  return (
    <div className="w-full h-screen bg-black text-white flex flex-col font-sans overflow-hidden">
        {showPasswordModal && (
            <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                <form onSubmit={handleDownload} className="bg-gray-900 border border-cyan-500 p-6 rounded max-w-sm w-full">
                    <h3 className="text-cyan-400 font-mono mb-4 font-bold text-center">SOURCE ACCESS</h3>
                    <input type="password" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} className="w-full bg-black border border-gray-700 p-2 text-white mb-4 rounded" placeholder="Password Root..." />
                    <div className="flex gap-2">
                        <button type="button" onClick={()=>setShowPasswordModal(false)} className="flex-1 bg-gray-700 py-2 rounded">CANCEL</button>
                        <button type="submit" className="flex-1 bg-cyan-600 py-2 rounded font-bold">DOWNLOAD</button>
                    </div>
                </form>
            </div>
        )}

        <div className="p-2 bg-gray-900 border-b border-gray-800 flex justify-between items-center shrink-0">
             <div className="font-mono font-bold text-cyan-400">NEURO-GENESIS v5.1</div>
             <button onClick={()=>setShowPasswordModal(true)} className="px-3 py-1 bg-cyan-900/30 text-cyan-300 border border-cyan-700 rounded text-xs hover:bg-cyan-800">SCARICA SORGENTE</button>
        </div>

        <div className="flex-1 relative">
            <NeuronVisualizer neuronCount={brain.neuronCount} stage={brain.stage} activeInputType={null} realtimeData={realtimeDataRef} />
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-4 flex flex-col gap-2 overflow-y-auto pointer-events-auto">
                 <MetabolismMonitor energy={brain.energy} maxEnergy={brain.maxEnergy} />
                 <OcularSystem isActive={true} />
                 <AudioSystem />
                 <NeuroControls values={brain.neurotransmitters} onChange={(k:any,v:any)=>setBrain(p=>({...p, neurotransmitters:{...p.neurotransmitters, [k]:v}}))} />
            </div>
        </div>
    </div>
  );
}