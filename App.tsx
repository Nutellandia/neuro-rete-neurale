
import React, { useState, useEffect, useRef } from 'react';
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
import { BrainState, LifeStage, ComputeMode } from './types';
import { getFreshBrainState, loadBrainState, saveBrainState } from './services/persistence';
import { processBrainReaction, analyzeGrowth, getEvolutionProgress } from './services/cognitiveEngine';

// SYSTEM RESTORED
const App = () => {
    const [brain, setBrain] = useState(getFreshBrainState());
    // Basic initialization to ensure visualizer works
    return (
        <div className="bg-black w-full h-screen text-white flex flex-col font-mono">
            <div className="p-2 border-b border-gray-800 bg-gray-900 flex justify-between">
                <span className="text-cyan-400 font-bold">NEURO-GENESIS SYSTEM</span>
                <span className="text-xs text-green-500">ONLINE</span>
            </div>
            <div className="flex-1 relative">
                <NeuronVisualizer 
                   neuronCount={brain.neuronCount}
                   stage={brain.stage}
                   activityLevel={1}
                   isVisible={true}
                   realtimeData={{current: {vision:{intensity:0}, audio:{volume:0, frequencies:new Uint8Array(32)}, motor:{x:0,y:0,isDrawing:false}}}}
                   viewMode="CORE"
                   physicsCap={500}
                   ageString="0h"
                   totalTicks={brain.ageTicks}
                   neuroPlasticity={brain.neuroPlasticity}
                   outputCapabilities={brain.outputCapabilities}
                   energy={brain.energy}
                   maxEnergy={brain.maxEnergy}
                   isSleeping={brain.isSleeping}
                   evoProgress={getEvolutionProgress(brain)}
                />
            </div>
        </div>
    );
};
export default App;
