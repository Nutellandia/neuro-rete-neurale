import { BrainState } from "@/types";
export const localLlmNode = {
    initializeCortex: async () => true,
    think: async () => "[LLM THOUGHT]",
    getStatus: () => ({ isLoaded: false, isLoading: false, error: null, gpuAvailable: true })
};