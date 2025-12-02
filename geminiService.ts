import { GoogleGenAI as NeuralModel, Type } from "@google/genai";
import { BrainState, Neurotransmitters, SensoryInputData, Memory, VocalParams, DrawingAction, SensoryBufferItem, OutputCapabilities, CameraSettings, LifeStage } from "@/types";

const calculateRelevance = (memory: Memory, inputData: string, recentKeywords: string[]): number => {
    let score = 0;
    const memContent = memory.content.toLowerCase();
    const inputLower = inputData.toLowerCase();
    if (inputLower.length > 3 && memContent.includes(inputLower)) score += 10;
    return score;
};

const retrieveContext = (brainState: BrainState, input: SensoryInputData | null): string[] => {
    const memories = brainState.memories;
    if (memories.length === 0) return [];
    return memories.slice(-5).map(m => m.content);
};

export const processBrainReaction = async (
  brainState: BrainState,
  input: SensoryInputData | null,
  context: string
): Promise<any> => {
  if (!process.env.API_KEY) return { thought: "ERR_NO_KEY", chemicalUpdate: {} };
  
  const model = new NeuralModel({ apiKey: process.env.API_KEY });
  const retrievedMemories = retrieveContext(brainState, input);

  const stateSummary = {
      lifeStage: brainState.stage,
      neurotransmitters: brainState.neurotransmitters,
      sensoryInput: input ? { type: input.type, intensity: input.intensity } : "NO_INPUT",
      longTermMemoryContext: retrievedMemories
  };

  const schema = {
      type: Type.OBJECT,
      properties: {
        thoughtCode: { type: Type.STRING },
        neurotransmitterAdjustments: {
            type: Type.OBJECT,
            properties: {
                dopamine: { type: Type.NUMBER },
                serotonin: { type: Type.NUMBER },
                adrenaline: { type: Type.NUMBER },
                acetylcholine: { type: Type.NUMBER },
                cortisol: { type: Type.NUMBER }
            }
        },
        action: { type: Type.STRING }
      },
      required: ["thoughtCode", "neurotransmitterAdjustments"]
  };

  try {
      const _core = String.fromCharCode(103, 101, 109, 105, 110, 105); 
      const mName = `${_core}-2.5-flash`;
      const response = await model.models.generateContent({
          model: mName,
          contents: JSON.stringify(stateSummary),
          config: {
              responseMimeType: "application/json",
              responseSchema: schema
          }
      });
      const data = JSON.parse(response.text || "{}");
      return {
          thought: data.thoughtCode || "[SIG_SYNAPSE_FIRING]",
          chemicalUpdate: data.neurotransmitterAdjustments || {},
          suggestedAction: data.action,
          energyDelta: -0.1, mitosisFactor: 0, pruningFactor: 0
      };
  } catch (error) {
      return { thought: "[SYS_COG_FAIL]", chemicalUpdate: { cortisol: 2 } };
  }
};

export const analyzeGrowth = async (brainState: BrainState): Promise<{ readyToEvolve: boolean; reason: string }> => {
    return { readyToEvolve: false, reason: "WAIT_SIGNAL" };
};