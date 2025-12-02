import { BrainState, SensoryInputData, LifeStage } from "@/types";
import { localLlmNode } from "./localLlmNode";

export const getEvolutionProgress = (brain: BrainState) => {
    return { label: "NEXT", requirements: [{label:"NODES", current:brain.neuronCount, target:1000, completed:false}] };
};

export const processBrainReaction = async (brain: BrainState, input: SensoryInputData | null, ctx: string) => {
    const energyDelta = -0.1;
    const mitosisFactor = brain.energy > 50 ? 1 : 0;
    return {
        thought: "[SYSTEM: ALIVE]",
        chemicalUpdate: {},
        energyDelta,
        mitosisFactor,
        pruningFactor: 0,
        suggestedAction: undefined
    };
};

export const analyzeGrowth = async (brain: BrainState) => ({ readyToEvolve: false, reason: "WAIT" });