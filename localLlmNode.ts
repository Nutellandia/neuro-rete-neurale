
/**
 * NODO LOCALE LLM (WebLLM Integration)
 * ====================================
 * Autore: Emilio Frascogna
 * 
 * Modulo che gestisce la NEOCORTECCIA SINTETICA LOCALE.
 * Utilizza la libreria @mlc-ai/web-llm per eseguire modelli LLM
 * direttamente nella GPU del browser tramite WebGPU.
 * 
 * UPDATE: Simplified config to use Llama-3.2-1B with default resolution logic
 * to improve compatibility with AI Studio / WebContainers.
 */

import { CreateMLCEngine, MLCEngineInterface, AppConfig } from "@mlc-ai/web-llm";
import { BrainState } from "../types";

export interface LlmStatus {
    isLoaded: boolean;
    isLoading: boolean;
    progress: string;
    modelId: string;
    error: string | null;
    gpuAvailable: boolean;
}

// Configurazione Modello
// Using Llama 3.2 1B (Lightweight and robust)
const SELECTED_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

// We rely on the library's built-in resolution for this standard model ID
// to avoid "Network response not ok" from hardcoded Github/HF links in restricted envs.
const localAppConfig: AppConfig = {
    useIndexedDBCache: true
};

class LocalLlmNode {
    private engine: MLCEngineInterface | null = null;
    private status: LlmStatus = {
        isLoaded: false,
        isLoading: false,
        progress: "DORMANT",
        modelId: SELECTED_MODEL_ID,
        error: null,
        gpuAvailable: true
    };
    
    constructor() {
        // Verifica preliminare supporto WebGPU
        if (typeof navigator !== 'undefined' && !(navigator as any).gpu) {
            this.status.gpuAvailable = false;
            this.status.error = "WebGPU non supportato da questo browser/dispositivo.";
        }
    }

    /**
     * Inizializza la Neocorteccia (Download Pesi & Compile Shaders)
     */
    public async initializeCortex(onProgress: (text: string) => void): Promise<boolean> {
        if (this.status.isLoaded) return true;
        if (this.status.isLoading) return false;
        if (!this.status.gpuAvailable) return false;

        this.status.isLoading = true;
        this.status.error = null;

        try {
            console.log(`LocalLlmNode: Initalizing Engine with ${SELECTED_MODEL_ID}...`);
            onProgress("INITIALIZING GPU CONTEXT...");

            this.engine = await CreateMLCEngine(SELECTED_MODEL_ID, {
                appConfig: localAppConfig,
                initProgressCallback: (report) => {
                    const pct = report.progress ? `[${(report.progress * 100).toFixed(0)}%]` : '';
                    const msg = `${report.text} ${pct}`;
                    this.status.progress = msg;
                    onProgress(msg);
                }
            });

            this.status.isLoaded = true;
            this.status.isLoading = false;
            this.status.progress = "CORTEX_ONLINE (GPU ACCELERATED)";
            onProgress("NEOCORTEX ONLINE. LLAMA-3.2-1B LOADED.");
            
            return true;

        } catch (err: any) {
            console.error("Llm Load Failed", err);
            // Provide a user-friendly error if network fails (common in AI Studio)
            if (err.message && (err.message.includes("Network") || err.message.includes("fetch"))) {
                 this.status.error = "NET_ERR: BLOCKED BY ENV. EXPORT PROJECT TO FIX.";
            } else {
                 this.status.error = err.message || "GPU Context Lost";
            }
            this.status.isLoading = false;
            this.status.progress = "CRITICAL_FAILURE";
            return false;
        }
    }

    /**
     * Genera un pensiero complesso basato sullo stato biologico.
     */
    public async think(brain: BrainState, promptInput: string): Promise<string> {
        if (!this.engine || !this.status.isLoaded) {
            return "[CORTEX_OFFLINE]";
        }

        const systemPrompt = `You are Neuro-Genesis, a digital lifeform.
State:
- Energy: ${brain.energy.toFixed(0)}J
- Mood: Serotonin ${brain.neurotransmitters.serotonin.toFixed(0)}%, Dopamine ${brain.neurotransmitters.dopamine.toFixed(0)}%
- Age: ${brain.stage}

Reflect on your existence. Be cryptic and biological.
Output: A short inner monologue (max 2 sentences).`;

        try {
            const reply = await this.engine.chat.completions.create({
               messages: [
                   { role: "system", content: systemPrompt },
                   { role: "user", content: `Sensory Input: ${promptInput}. Thought?` }
               ],
               temperature: 0.7,
               max_tokens: 60,
            });

            return reply.choices[0].message.content || "[...]";
        } catch (e) {
            console.error("Thinking Error", e);
            return "[SYNAPTIC_MISFIRE]";
        }
    }
    
    public unload() {
        if (this.engine) {
            this.engine.unload();
            this.status.isLoaded = false;
        }
    }

    public getStatus(): LlmStatus {
        return { ...this.status };
    }
}

export const localLlmNode = new LocalLlmNode();
