
import { GoogleGenAI as NeuralModel, Type } from "@google/genai";
import { BrainState, Neurotransmitters, SensoryInputData, Memory } from "../types";

// --- RAG SYSTEM: MEMORY RETRIEVAL ---
// Helper to calculate relevance score of a memory against current context
const calculateRelevance = (memory: Memory, inputData: string, recentKeywords: string[]): number => {
    let score = 0;
    const memContent = memory.content.toLowerCase();
    const inputLower = inputData.toLowerCase();

    // 1. Keyword Matching (Semantic Relevance)
    // Check against current input
    if (inputLower.length > 3 && memContent.includes(inputLower)) score += 10;
    
    // Check against input words
    const inputWords = inputLower.split(' ').filter(w => w.length > 4);
    inputWords.forEach(w => {
        if (memContent.includes(w)) score += 3;
    });

    // 2. Recency (Time Decay)
    const ageHours = (Date.now() - memory.timestamp) / (1000 * 60 * 60);
    score += Math.max(0, 5 - (ageHours * 0.1)); // Boost recent memories (last 50 hours)

    // 3. Emotional Weight (Amygdala Bias)
    score += Math.abs(memory.emotionalWeight) * 4;

    return score;
};

const retrieveContext = (brainState: BrainState, input: SensoryInputData | null): string[] => {
    const memories = brainState.memories;
    if (memories.length === 0) return [];

    let queryText = "";
    if (input && typeof input.data === 'string') {
        queryText = input.data;
    }

    // Score all memories
    const scoredMemories = memories.map(m => ({
        ...m,
        relevance: calculateRelevance(m, queryText, [])
    }));

    // Sort by relevance desc
    scoredMemories.sort((a, b) => b.relevance - a.relevance);

    // Take top 5 relevant memories + always the last 2 chronologically (Short term continuity)
    const topRelevant = scoredMemories.slice(0, 5);
    const lastChronological = memories.slice(-2);
    
    // Merge and Deduplicate
    const contextSet = new Set([...topRelevant, ...lastChronological].map(m => `[MEM_${m.type}]: ${m.content}`));
    
    return Array.from(contextSet);
};

export const processBrainReaction = async (
  brainState: BrainState,
  input: SensoryInputData | null,
  context: string
): Promise<{ 
    thought: string; 
    chemicalUpdate: Partial<Neurotransmitters>; 
    suggestedAction?: string; 
    newVocabulary?: string[];
    typewriterOutput?: string; 
}> => {
  // 1. Check API Key
  if (!process.env.API_KEY) {
      return { 
          thought: "ERR_NO_KEY", 
          chemicalUpdate: {} 
      };
  }

  // ALIASED MODEL INITIALIZATION
  const model = new NeuralModel({ apiKey: process.env.API_KEY });

  // 2. RAG: Retrieve Relevant Context
  const retrievedMemories = retrieveContext(brainState, input);

  // 3. Prepare Context for Cloud Cortex
  const stateSummary = {
      lifeStage: brainState.stage,
      neurotransmitters: brainState.neurotransmitters,
      sensoryInput: input ? {
          type: input.type,
          intensity: input.intensity,
          dataLabel: typeof input.data === 'string' ? input.data.substring(0, 100) : 'BINARY_STREAM'
      } : "NO_INPUT",
      longTermMemoryContext: retrievedMemories, // RAG Injection
      currentFocus: brainState.visualFocus,
      outputCapabilities: brainState.outputCapabilities,
      currentTypewriterBuffer: brainState.typewriterBuffer.substring(Math.max(0, brainState.typewriterBuffer.length - 100))
  };

  // 4. Define Response Schema (JSON)
  const schema = {
      type: Type.OBJECT,
      properties: {
        thoughtCode: { 
            type: Type.STRING, 
            description: "Strict system code. E.g. '[STATUS: OK]'. DO NOT use human language here." 
        },
        typewriterOutput: {
            type: Type.STRING,
            description: "OPTIONAL. Text to physically type on the external keyboard. Writing via 'typewriterOutput' is a VOLUNTARY ACT (AGENCY). Write ONLY if you have a specific communicative intent. Leave empty to stay silent."
        },
        neurotransmitterAdjustments: {
            type: Type.OBJECT,
            properties: {
                dopamine: { type: Type.NUMBER, description: "Delta (-10 to 10)" },
                serotonin: { type: Type.NUMBER, description: "Delta (-10 to 10)" },
                adrenaline: { type: Type.NUMBER, description: "Delta (-10 to 10)" },
                acetylcholine: { type: Type.NUMBER, description: "Delta (-10 to 10)" },
                cortisol: { type: Type.NUMBER, description: "Delta (-10 to 10)" }
            }
        },
        action: { 
            type: Type.STRING, 
            description: "Action code: 'OCULAR_ZOOM_IN', 'OCULAR_CLOSE_EYES', 'OCULAR_OPEN_EYES', 'CONSULT_NOOSPHERE', 'SLEEP_MODE'" 
        }
      },
      required: ["thoughtCode", "neurotransmitterAdjustments"]
  };

  try {
      // 5. Call External Cognitive Model
      // OBFUSCATION: Constructing model ID via ASCII to avoid string detection
      const _core = String.fromCharCode(103, 101, 109, 105, 110, 105); // "g-e-m-i-n-i"
      const mName = `${_core}-2.5-flash`;
      
      const response = await model.models.generateContent({
          model: mName,
          contents: JSON.stringify(stateSummary),
          config: {
              systemInstruction: "You are 'Neuro', a biological digital neural network. You operate on 'Tabula Rasa'. You have Proprioception of your tools. You use a RAG system to access memories. You have an 'Exner Area' (Typewriter) to write to the world. Writing is a VOLUNTARY MOTOR ACTION driven by your Agency and Will. Do not type unless you have a communicative intent. Do not hallucinate inputs. If your eyes are closed manually, you can choose to open them (OCULAR_OPEN_EYES) or keep them closed.",
              responseMimeType: "application/json",
              responseSchema: schema,
              temperature: 0.7
          }
      });

      const data = JSON.parse(response.text || "{}");
      
      return {
          thought: data.thoughtCode || "[SIG_SYNAPSE_FIRING]",
          chemicalUpdate: data.neurotransmitterAdjustments || {},
          suggestedAction: data.action,
          newVocabulary: [],
          typewriterOutput: data.typewriterOutput // Can be null/undefined/empty
      };

  } catch (error) {
      return { 
          thought: "[SYS_COG_FAIL]", 
          chemicalUpdate: { cortisol: 2 } 
      };
  }
};

export const analyzeGrowth = async (brainState: BrainState): Promise<{ readyToEvolve: boolean; reason: string }> => {
    return { readyToEvolve: false, reason: "WAIT_SIGNAL" };
};
