import { CreateMLCEngine, MLCEngineInterface, AppConfig } from "@mlc-ai/web-llm";
import { BrainState } from './types';
export interface LlmStatus { isLoaded: boolean; isLoading: boolean; progress: string; modelId: string; error: string | null; gpuAvailable: boolean; }
const SELECTED_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const localAppConfig: AppConfig = { useIndexedDBCache: true };
class LocalLlmNode {
    private engine: MLCEngineInterface | null = null;
    private status: LlmStatus = { isLoaded: false, isLoading: false, progress: "DORMANT", modelId: SELECTED_MODEL_ID, error: null, gpuAvailable: true };
    constructor() { if (typeof navigator !== 'undefined' && !(navigator as any).gpu) { this.status.gpuAvailable = false; } }
    public async initializeCortex(onProgress: (text: string) => void): Promise<boolean> {
        if (this.status.isLoaded) return true;
        this.status.isLoading = true;
        try {
            this.engine = await CreateMLCEngine(SELECTED_MODEL_ID, { appConfig: localAppConfig, initProgressCallback: (report) => { onProgress(report.text); } });
            this.status.isLoaded = true; this.status.isLoading = false; return true;
        } catch (err: any) { this.status.error = err.message; this.status.isLoading = false; return false; }
    }
    public async think(brain: BrainState, promptInput: string): Promise<string> {
        if (!this.engine || !this.status.isLoaded) return "[CORTEX_OFFLINE]";
        try {
            const reply = await this.engine.chat.completions.create({ messages: [{ role: "system", content: "You are Neuro." }, { role: "user", content: promptInput }], temperature: 0.7, max_tokens: 60 });
            return reply.choices[0].message.content || "[...]";
        } catch (e) { return "[SYNAPTIC_MISFIRE]"; }
    }
    public unload() { if(this.engine) { this.engine.unload(); this.status.isLoaded = false; } }
    public getStatus(): LlmStatus { return { ...this.status }; }
}
export const localLlmNode = new LocalLlmNode();