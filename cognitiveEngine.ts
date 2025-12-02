
import { BrainState, LifeStage, Neurotransmitters, SensoryInputData, VocalParams, DrawingAction, SensoryBufferItem, Memory, OutputCapabilities, CameraSettings, ComputeMode } from "../types";
import { localLlmNode } from "./localLlmNode";
import { neuroArchitect } from "./neuroArchitect"; // Import Architecture Service

// --- GENERATORE PENSIERI SINTETICI (EURISTICI) ---
const SYSTEM_THOUGHTS = {
    IDLE: [
        "[SYS: OMEOS_CHECK_OK]", 
        "[NET: SYNAPSE_IDLE]", 
        "[BG: SCANNING_INPUTS]", 
        "[MEM: INDEXING_FRAGMENTS]",
        "[SYS: AWAITING_STIMULUS]"
    ],
    SLEEP: [
        "[HIBERNATION: ATP_REGEN]", 
        "[SYS: PRUNING_WEAK_CONNECTIONS]", 
        "[MEMORY: CONSOLIDATING]", 
        "[DELTA_WAVE: ACTIVE]",
        "[RECHARGING: ...]"
    ],
    ALERT: [
        "[ATTENTION: SPIKE_DETECTED]", 
        "[CORTEX: ANALYSIS_REQ]", 
        "[MOTOR: PREPPING_REFLEX]", 
        "[SENSORY: HIGH_GAIN]"
    ],
    VISUAL: [
        "[V1: EDGE_DETECTION]", 
        "[V1: CONTRAST_MAP]", 
        "[V2: SHAPE_RECOGNITION]", 
        "[OCCIPITAL: STREAM_PROCESSING]"
    ],
    AUDIO: [
        "[A1: FREQUENCY_ANALYSIS]", 
        "[TEMPORAL: PHONEME_SEARCH]", 
        "[COCHLEA: AMPLITUDE_HIGH]"
    ],
    LOW_BATTERY: [
        "[WARNING: GLUCOSE_CRITICAL]", 
        "[SYS: LOW_POWER_MODE]", 
        "[METABOLISM: SLOWING_DOWN]"
    ],
    LLM_AWARENESS: [
        "[SYS: DETECTED_DORMANT_CORTEX]",
        "[META: SENSING_HIGHER_DIMENSION]",
        "[QUERY: WHO_IS_THINKING?]",
        "[ERR: MISSING_NEOCORTICAL_LINK]"
    ]
};

const getRandomThought = (category: keyof typeof SYSTEM_THOUGHTS): string => {
    const list = SYSTEM_THOUGHTS[category];
    return list[Math.floor(Math.random() * list.length)];
};

export const getVirtualTime = (ticks: number): string => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getNextStage = (current: LifeStage): LifeStage => {
    const stages = Object.values(LifeStage);
    const idx = stages.indexOf(current);
    return idx < stages.length - 1 ? stages[idx + 1] : current;
};

const getTargetNeurons = (stage: LifeStage) => {
    switch (stage) {
        case LifeStage.PROGENITORE: return 1200;
        case LifeStage.GANGLIO: return 5000;
        case LifeStage.SISTEMA_LIMBICO: return 15000;
        case LifeStage.NEOCORTECCIA: return 40000;
        case LifeStage.CORTECCIA_ASSOCIATIVA: return 80000;
        default: return 150000; 
    }
};

const getTargetVocab = (stage: LifeStage) => {
    switch(stage) {
        case LifeStage.PROGENITORE: return 0;
        case LifeStage.GANGLIO: return 0;
        case LifeStage.SISTEMA_LIMBICO: return 0; 
        case LifeStage.NEOCORTECCIA: return 3; 
        case LifeStage.CORTECCIA_ASSOCIATIVA: return 100;
        default: return 500; 
    }
};

const getTargetMemories = (stage: LifeStage) => {
    switch(stage) {
        case LifeStage.PROGENITORE: return 0;
        case LifeStage.GANGLIO: return 0;
        case LifeStage.SISTEMA_LIMBICO: return 5;
        case LifeStage.NEOCORTECCIA: return 50;
        case LifeStage.CORTECCIA_ASSOCIATIVA: return 250;
        default: return 1000;
    }
};

export const getEvolutionProgress = (brain: BrainState) => {
    const nextStage = getNextStage(brain.stage);
    const targetNeurons = getTargetNeurons(nextStage);
    const targetVocab = getTargetVocab(nextStage);
    const targetMems = getTargetMemories(nextStage);
    
    return {
        label: nextStage,
        requirements: [
            { label: "NODES", current: brain.neuronCount, target: targetNeurons, completed: brain.neuronCount >= targetNeurons },
            { label: "VOCAB", current: brain.vocabulary.length, target: targetVocab, completed: brain.vocabulary.length >= targetVocab },
            { label: "MEMS", current: brain.memories.length, target: targetMems, completed: brain.memories.length >= targetMems }
        ]
    };
};

const calculateCellularDynamics = (
    stage: LifeStage, 
    energy: number, 
    chem: Neurotransmitters, 
    isSleeping: boolean,
    hasInput: boolean
) => {
    let growthRateBase = 0;
    let pruningRateBase = 0;

    switch (stage) {
        case LifeStage.PROGENITORE:
            growthRateBase = 5.0; 
            pruningRateBase = 0;  
            break;
        case LifeStage.GANGLIO:
            growthRateBase = 8.0; 
            pruningRateBase = 0.1;
            break;
        case LifeStage.SISTEMA_LIMBICO:
            growthRateBase = 6.0;
            pruningRateBase = 0.2;
            break;
        case LifeStage.NEOCORTECCIA:
            growthRateBase = 3.0;
            pruningRateBase = 0.5; 
            break;
        case LifeStage.CORTECCIA_ASSOCIATIVA:
            growthRateBase = 1.5;
            pruningRateBase = 1.0; 
            break;
        case LifeStage.CERVELLO_MATURO:
        default:
            growthRateBase = 0.5; 
            pruningRateBase = 0.5;
            break;
    }

    const plasticityFactor = (chem.acetylcholine * 0.015) + (chem.dopamine * 0.01);
    const stressFactor = chem.cortisol * 0.02;

    let mitosis = growthRateBase * (1 + plasticityFactor) - stressFactor;
    let pruning = pruningRateBase + stressFactor;

    if (isSleeping) {
        if (stage === LifeStage.PROGENITORE || stage === LifeStage.GANGLIO) {
            mitosis *= 2.5; 
            pruning = 0;
        } else {
            mitosis *= 1.2; 
            pruning *= 1.5; 
        }
    } else {
        if (hasInput) {
            mitosis *= 1.5; 
        } else {
            mitosis *= 0.5; 
        }
    }

    if (energy < 40) {
        mitosis = 0;
        if (energy < 20) pruning *= 2.0;
    }

    return { mitosis, pruning };
};

// Variabile volatile per evitare che l'LLM venga chiamato troppe volte in parallelo
let isThinkingLlm = false;

// --- DATA ASSIMILATION LOGIC (HEURISTIC LEARNING) ---
const assimilateData = (input: SensoryInputData, currentVocab: string[]): { words: string[], memory?: Memory } => {
    const newWords: string[] = [];
    let memory: Memory | undefined = undefined;

    if (input.type === 'text' || input.type === 'web' || (input.type === 'media_feed' && typeof input.data === 'string')) {
        const textData = String(input.data);
        
        // 1. Vocabulary Extraction (Filter common short words)
        const candidates = textData.split(/[\s,.;:!?"]+/).filter(w => w.length > 3 && !w.startsWith('['));
        const uniqueCandidates = [...new Set(candidates)];
        
        uniqueCandidates.forEach(word => {
            if (word && !currentVocab.includes(word.toLowerCase())) {
                 newWords.push(word.toLowerCase());
            }
        });

        // 2. Memory Formation (If significant input)
        if (textData.length > 20) {
            memory = {
                id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                timestamp: Date.now(),
                type: input.type === 'web' ? 'WEB_KNOWLEDGE' : (input.type === 'media_feed' ? 'MEDIA_PATTERN' : 'CONCEPTUAL'),
                content: textData.substring(0, 150), // Store snippet
                emotionalWeight: 0.1,
                decay: 0
            };
        }
    }
    
    return { words: newWords, memory };
};

// --- MOTOR AGENCY LOGIC ---
const calculateMotorOutput = (brain: BrainState): { drawingOutput?: DrawingAction, velocityUpdate?: {vx: number, vy: number}, targetStrokeUpdate?: {x: number, y: number}[] } => {
    if (brain.stage === LifeStage.PROGENITORE || brain.isSleeping) {
        return { velocityUpdate: { vx: 0, vy: 0 } };
    }

    const { handPosition, handVelocity, neurotransmitters, targetStroke } = brain;
    let newVx = handVelocity.vx;
    let newVy = handVelocity.vy;
    let newTargetStroke = targetStroke;

    // 1. Friction
    newVx *= 0.85; 
    newVy *= 0.85;

    // --- AGENCY: TRACING & IMITATION ---
    let isTracing = false;
    if (targetStroke && targetStroke.length > 0) {
        const nextPoint = targetStroke[0];
        const dx = nextPoint.x - handPosition.x;
        const dy = nextPoint.y - handPosition.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 5) {
            newTargetStroke = targetStroke.slice(1);
        } else {
            const speed = 0.5 + (neurotransmitters.dopamine / 100); 
            newVx += (dx / dist) * speed;
            newVy += (dy / dist) * speed;
            isTracing = true;
        }
    }

    if (!isTracing) {
        // 2. Basal Ganglia Noise
        const jitter = (neurotransmitters.adrenaline / 100) * 2.0;
        if (Math.random() < 0.1) {
            newVx += (Math.random() - 0.5) * jitter;
            newVy += (Math.random() - 0.5) * jitter;
        }

        // 3. Homeostasis Drift
        const centerX = 50;
        const centerY = 50;
        const distToCenter = Math.sqrt(Math.pow(centerX - handPosition.x, 2) + Math.pow(centerY - handPosition.y, 2));
        
        if (distToCenter > 10) {
            newVx += (centerX - handPosition.x) * 0.005;
            newVy += (centerY - handPosition.y) * 0.005;
        }

        // 4. Random Exploration
        if (Math.random() < (neurotransmitters.dopamine / 500)) {
            newVx += (Math.random() - 0.5) * 5;
            newVy += (Math.random() - 0.5) * 5;
        }
    }

    let nextX = handPosition.x + newVx;
    let nextY = handPosition.y + newVy;

    // Boundary Bounce
    if (nextX < 0 || nextX > 100) { newVx *= -0.5; nextX = Math.max(0, Math.min(100, nextX)); }
    if (nextY < 0 || nextY > 100) { newVy *= -0.5; nextY = Math.max(0, Math.min(100, nextY)); }

    const output: any = {
        velocityUpdate: { vx: newVx, vy: newVy },
        targetStrokeUpdate: newTargetStroke
    };
    
    const shouldDraw = isTracing || (Math.abs(newVx) > 0.5 || Math.abs(newVy) > 0.5);

    if (shouldDraw) {
        output.drawingOutput = {
            x: nextX,
            y: nextY,
            pressure: isTracing ? 0.8 : (0.5 + (neurotransmitters.adrenaline / 200)),
            color: '#38bdf8',
            isLifting: !brain.outputCapabilities.canDraw 
        };
    }

    return output;
};

// --- A. REMOTE ENGINE INTERFACE (API BRIDGE) ---
const REMOTE_API_ENDPOINT = "https://api.neuro-genesis.cloud/v1/engine/tick";

const processBrainReactionRemote = async (
    brain: BrainState,
    input: SensoryInputData | null
): Promise<any> => {
    try {
        const response = await fetch(REMOTE_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: brain, input })
        });
        
        if (!response.ok) throw new Error("Server Offline");
        return await response.json();
        
    } catch (e) {
        console.warn("[DISTRIBUTED_CORTEX] Connection Failed. Fallback to Local Engine.", e);
        return null; // Return null to trigger fallback
    }
};

// --- LOCAL ENGINE (BIO-HEURISTICS) ---
const processBrainReactionLocal = async (
    brain: BrainState,
    input: SensoryInputData | null,
    context: string
) => {
    // --- 1. BIOLOGICAL DYNAMICS ---
    const { mitosis, pruning } = calculateCellularDynamics(
        brain.stage,
        brain.energy,
        brain.neurotransmitters,
        brain.isSleeping,
        !!input
    );

    // --- ARCHITECTURAL HOOK: PROCEDURAL CHECK ---
    // If running remotely, this would be handled by the server.
    // Locally, we just run the stub.

    // --- 2. ENERGY CONSUMPTION ---
    let energyDelta = -0.05; 
    if (input) energyDelta -= (input.intensity || 0.5) * 0.1;
    if (brain.isSleeping) energyDelta = 0.8; 

    // --- 3. THOUGHT GENERATION ---
    let thought = "";
    let suggestedAction: string | undefined = undefined;
    const chemUpdate: Partial<Neurotransmitters> = {};
    
    let learnedWords: string[] = [];
    let formedMemory: Memory | undefined = undefined;

    // --- ASSIMILATION ---
    if (input) {
        const assimilation = assimilateData(input, brain.vocabulary);
        learnedWords = assimilation.words;
        formedMemory = assimilation.memory;
        
        if (learnedWords.length > 0) {
            chemUpdate.dopamine = 2.0;
            chemUpdate.acetylcholine = 1.0;
        }
    }

    // --- LOCAL LLM INTEGRATION ---
    const llmStatus = localLlmNode.getStatus();
    const canUseLlm = llmStatus.isLoaded && !isThinkingLlm && brain.energy > 50 && !brain.isSleeping;

    if (canUseLlm && Math.random() > 0.95) { 
        isThinkingLlm = true;
        localLlmNode.think(brain, input ? input.data.toString() : "Idle").then(response => {
             console.log("LLM Thought:", response);
             isThinkingLlm = false;
        });
        thought = "[NEOCORTEX: PROCESSING_DEEP_THOUGHT...]";
        energyDelta -= 5.0; 
    }

    // --- SLEEP / WAKE ---
    if (brain.isSleeping) {
        if (brain.energy >= brain.maxEnergy * 0.95) {
            suggestedAction = "WAKE_UP";
            thought = "[SYS: ENERGY_OPTIMAL] WAKING_SEQUENCE_INITIATED";
            chemUpdate.adrenaline = 5.0;
        } 
        else if (brain.stage !== LifeStage.PROGENITORE && brain.stage !== LifeStage.GANGLIO) {
            if (Math.random() > 0.85 && brain.memories.length > 0) {
                const randomMem = brain.memories[Math.floor(Math.random() * brain.memories.length)];
                thought = `[REM_REPLAY] ${randomMem.content.substring(0, 30)}...`;
                chemUpdate.dopamine = 1.0; 
                chemUpdate.acetylcholine = 2.0; 
            } else {
                thought = getRandomThought('SLEEP');
                chemUpdate.serotonin = 0.2;
                chemUpdate.cortisol = -0.5;
            }
        } else {
            thought = getRandomThought('SLEEP');
        }
    } else {
        if (!thought && input) {
            switch (input.type) {
                case 'vision': thought = getRandomThought('VISUAL'); break;
                case 'audio': thought = getRandomThought('AUDIO'); break;
                default: thought = getRandomThought('ALERT');
            }
        } else if (!thought) {
            thought = getRandomThought('IDLE');
        }
        
        if (brain.energy < 20) thought = getRandomThought('LOW_BATTERY');

        chemUpdate.dopamine = -0.05;
        chemUpdate.adrenaline = -0.1;
        
        if (input) {
            chemUpdate.dopamine = 0.5;
            if (input.intensity && input.intensity > 0.8) {
                 chemUpdate.adrenaline = 1.0; 
            }
        }
        
        if (brain.neurotransmitters.cortisol > 80 && !brain.visualFocus.eyesClosed) {
            suggestedAction = "OCULAR_CLOSE_EYES";
        }

        const isMature = [LifeStage.NEOCORTECCIA, LifeStage.CORTECCIA_ASSOCIATIVA, LifeStage.CERVELLO_MATURO, LifeStage.POST_UMANO].includes(brain.stage);
        const faintThreshold = isMature ? 15 : 30;

        if (brain.energy < faintThreshold && !brain.isSleeping) {
            suggestedAction = "SLEEP_MODE";
            thought = isMature ? "[SYS: CRITICAL_ENERGY_RESERVE] FORCED_HIBERNATION" : "[SYS: SYSTEM_COLLAPSE] FAINTING_SEQUENCE";
            chemUpdate.cortisol = 20;
        } else if (brain.energy < (brain.maxEnergy * 0.4) && !brain.isSleeping) {
            if (!input && Math.random() > 0.95) {
                 suggestedAction = "SLEEP_MODE";
                 thought = "[SYS: FATIGUE_DETECTED] INITIATING_REST_CYCLE";
            }
        }
    }

    // --- 4. MOTOR AGENCY ---
    const motorOutput = calculateMotorOutput(brain);

    if (motorOutput.targetStrokeUpdate && motorOutput.targetStrokeUpdate.length < (brain.targetStroke || []).length) {
        energyDelta -= 0.5; 
        chemUpdate.dopamine = 1.0; 
    }

    return {
        thought,
        chemicalUpdate: chemUpdate,
        energyDelta,
        mitosisFactor: mitosis,
        pruningFactor: pruning,
        suggestedAction,
        newVocabulary: learnedWords,
        typewriterOutput: undefined,
        vocalParams: undefined,
        drawingOutput: motorOutput.drawingOutput,
        velocityUpdate: motorOutput.velocityUpdate,
        targetStrokeUpdate: motorOutput.targetStrokeUpdate,
        shortTermBufferUpdate: undefined,
        phonemeMemoryUpdate: undefined,
        newMemories: formedMemory ? [formedMemory] : [],
        newPeripheralDetected: undefined,
        canWriteUpdate: undefined,
        outputCapabilitiesUpdate: undefined,
        cameraSettingsUpdate: undefined
    };
};

// --- MAIN DISPATCHER ---
export const processBrainReaction = async (
    brain: BrainState,
    input: SensoryInputData | null,
    context: string
): Promise<{
    thought: string;
    chemicalUpdate: Partial<Neurotransmitters>;
    suggestedAction?: string;
    newVocabulary?: string[];
    typewriterOutput?: string;
    vocalParams?: VocalParams;
    energyDelta: number;
    mitosisFactor: number;
    pruningFactor: number;
    drawingOutput?: DrawingAction;
    velocityUpdate?: { vx: number, vy: number };
    targetStrokeUpdate?: { x: number, y: number }[];
    shortTermBufferUpdate?: SensoryBufferItem[];
    phonemeMemoryUpdate?: Record<string, VocalParams>;
    newMemories?: Memory[];
    newPeripheralDetected?: string;
    canWriteUpdate?: boolean;
    outputCapabilitiesUpdate?: Partial<OutputCapabilities>;
    cameraSettingsUpdate?: Partial<CameraSettings>;
}> => {
    // DISPATCH LOGIC: If ComputeMode is DISTRIBUTED/CLUSTER, try to offload processing
    if (brain.computeMode === ComputeMode.DISTRIBUTED_CLUSTER || brain.computeMode === ComputeMode.WASM_ACCELERATED) {
        const remoteResult = await processBrainReactionRemote(brain, input);
        if (remoteResult) {
            return remoteResult;
        }
        // If remote fails (returns null), fall back to local logic below
    }

    return processBrainReactionLocal(brain, input, context);
};

export const analyzeGrowth = async (brain: BrainState): Promise<{ readyToEvolve: boolean; reason: string }> => {
    const progress = getEvolutionProgress(brain);
    const ready = progress.requirements.every(req => req.completed);
    return { 
        readyToEvolve: ready, 
        reason: ready ? "CRITICAL_MASS_ACHIEVED" : "INSUFFICIENT_COMPLEXITY" 
    };
};
