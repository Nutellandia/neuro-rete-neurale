import React, { useState, useEffect } from 'react';
import NeuronVisualizer from './NeuronVisualizer';
import NeuroControls from './NeuroControls';
import OcularSystem from './OcularSystem';
import MetabolismMonitor from './MetabolismMonitor';
import { getFreshBrainState, saveBrainState } from './persistence';
import { processBrainReaction, getEvolutionProgress } from './cognitiveEngine';

export default function App() {
  const [brain, setBrain] = useState(getFreshBrainState());
  const [activeTab, setActiveTab] = useState('VISUALIZER');

  useEffect(() => {
      const interval = setInterval(async () => {
          const res = await processBrainReaction(brain, null, "");
          setBrain(prev => ({
              ...prev,
              ageTicks: prev.ageTicks + 1,
              neurotransmitters: { ...prev.neurotransmitters, ...res.chemicalUpdate },
              energy: Math.max(0, prev.energy + res.energyDelta)
          }));
      }, 100);
      return () => clearInterval(interval);
  }, [brain]);

  return (
    <div className="w-full h-screen bg-black text-white flex flex-col font-mono overflow-hidden">
        <div className="p-2 border-b border-gray-800 flex justify-between items-center">
            <h1 className="text-sm font-bold text-cyan-400">NEURO-GENESIS V5</h1>
            <div className="flex gap-2">
                <button onClick={() => setActiveTab('VISUALIZER')} className={`px-2 py-1 text-xs border rounded ${activeTab==='VISUALIZER'?'bg-cyan-900 text-white':'text-gray-500'}`}>VIS</button>
                <button onClick={() => setActiveTab('DATA')} className={`px-2 py-1 text-xs border rounded ${activeTab==='DATA'?'bg-cyan-900 text-white':'text-gray-500'}`}>DATA</button>
            </div>
        </div>
        
        <div className="flex-1 relative">
            <div className={`absolute inset-0 ${activeTab==='VISUALIZER'?'z-10':'z-0'}`}>
                <NeuronVisualizer neuronCount={brain.neuronCount} stage={brain.stage} />
            </div>
            
            <div className={`absolute inset-0 bg-black/80 backdrop-blur-sm p-4 overflow-y-auto space-y-4 ${activeTab==='DATA'?'z-20':'hidden'}`}>
                <MetabolismMonitor energy={brain.energy} maxEnergy={brain.maxEnergy} metabolicRate={brain.metabolicRate} />
                <NeuroControls values={brain.neurotransmitters} />
                <OcularSystem isActive={!brain.isSleeping} focus={brain.visualFocus} />
                <div className="p-2 bg-gray-900 border border-gray-700 rounded">
                    <div className="text-xs text-gray-500">THOUGHT STREAM</div>
                    <div className="text-cyan-300">"{brain.lastThought || '...'}"</div>
                </div>
            </div>
        </div>
    </div>
  );
}