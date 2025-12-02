import { BrainState, LifeStage, Neurotransmitters, SensoryInputData, VocalParams, DrawingAction, SensoryBufferItem, Memory, OutputCapabilities, CameraSettings, ComputeMode } from "@/types";
import { localLlmNode } from "./localLlmNode";

const SYSTEM_THOUGHTS = {
    IDLE: ["[SYS: OMEOS_CHECK_OK]", "[NET: SYNAPSE_IDLE]"],
    SLEEP: ["[HIBERNATION: ATP_REGEN]", "[SYS: PRUNING_WEAK_CONNECTIONS]"],
    ALERT: ["[ATTENTION: SPIKE_DETECTED]", "[CORTEX: ANALYSIS_REQ]"],
    VISUAL: ["[V1: EDGE_DETECTION]", "[V1: CONTRAST_MAP]"],
    AUDIO: ["[A1: FREQUENCY_ANALYSIS]"],
    LOW_BATTERY: ["[WARNING: GLUCOSE_CRITICAL]"]
};

const getRandomThought = (category: keyof typeof SYSTEM_THOUGHTS): string => {
    const list = SYSTEM_THOUGHTS[category];
    return list[Math.floor(Math.random() * list.length)];
};

export const getEvolutionProgress = (brain: BrainState) => {
    return { label: brain.stage, requirements: [] };
};

export const processBrainReaction = async (
    brain: BrainState,
    input: SensoryInputData | null,
    context: string
): Promise<any> => {
    let energyDelta = -0.05; 
    let thought = getRandomThought('IDLE');
    if (input) energyDelta -= 0.1;
    if (brain.isSleeping) energyDelta = 0.8;
    return {
        thought,
        chemicalUpdate: {},
        energyDelta,
        mitosisFactor: brain.isSleeping ? 10 : 0,
        pruningFactor: 0
    };
};

export const analyzeGrowth = async (brain: BrainState): Promise<{ readyToEvolve: boolean; reason: string }> => {
    return { readyToEvolve: false, reason: "WAIT_SIGNAL" };
};