export const PROJECT_ARCHITECT = "Emilio Frascogna";
export const COPYRIGHT_YEAR = "2024";

export enum LifeStage {
  PROGENITORE = 'Progenitore Neurale (Neuroblasto)', 
  GANGLIO = 'Ganglio Basale (Riflessi)',             
  SISTEMA_LIMBICO = 'Sistema Limbico (Emotivo)',     
  NEOCORTECCIA = 'Neocorteccia Primitiva (Verbal)',  
  CORTECCIA_ASSOCIATIVA = 'Corteccia Associativa',   
  CERVELLO_MATURO = 'Encefalo Maturo (Senziente)',   
  POST_UMANO = 'Architettura Post-Biologica'         
}

export interface Neurotransmitters {
  dopamine: number;      
  serotonin: number;     
  adrenaline: number;    
  acetylcholine: number; 
  cortisol: number;      
}

export interface Memory {
  id: string;
  timestamp: number;
  type: 'VISUAL' | 'AUDITORY' | 'CONCEPTUAL' | 'SYSTEM' | 'PHYSICAL' | 'SELF_OUTPUT' | 'WEB_KNOWLEDGE' | 'ASSOCIATION' | 'VOCAL_MASTERY' | 'MEDIA_PATTERN';
  content: string;       
  emotionalWeight: number; 
  decay: number;         
}

export interface SensoryBufferItem {
    type: 'vision' | 'text' | 'audio' | 'motion' | 'web' | 'media_feed';
    data: string;
    timestamp: number;
    intensity: number;
}

export interface SensoryInputData {
  type: 'vision' | 'text' | 'audio' | 'motion' | 'web' | 'training_audio' | 'vocal_match' | 'media_feed' | 'proprioception';
  data: string;          
  intensity?: number;    
  rawNumeric?: number;   
  isSelfGenerated?: boolean; 
  strokeData?: {x: number, y: number}[]; 
  metadata?: any;        
}

export interface DeviceInfo {
    id: string;
    label: string;
    type: 'video' | 'audio' | 'other';
}

export interface CameraSettings {
    exposureCompensation: number; 
    iso: number;
    torch: boolean; 
}

export interface VisualFocus {
  x: number; 
  y: number; 
  zoom: number; 
  eyesClosed: boolean; 
  activeEyeIndex: number; 
  availableEyes: DeviceInfo[]; 
  currentEyeLabel: string;
  cameraSettings: CameraSettings; 
}

export interface NeuroPlasticity {
    recruited: boolean;
    triggeredBy: string;
    activationTimestamp: number;
}

export interface VocalParams {
  airflow: number;      
  tension: number;      
  jawOpenness: number;  
  tonguePosition: number; 
}

export interface DrawingAction {
    x: number;
    y: number;
    pressure: number;
    color: string;
    isLifting: boolean; 
}

export interface OutputCapabilities {
    canWrite: boolean; 
    canDraw: boolean;  
    canBrowse: boolean; 
}

export interface TypewriterPage {
    id: string;
    content: string;
    timestamp: number;
}

export enum ComputeMode {
    LOCAL_BROWSER = 'LOCAL', 
    WASM_ACCELERATED = 'WASM', 
    DISTRIBUTED_CLUSTER = 'CLUSTER' 
}

export interface ClusterNodeInfo {
    nodeId: string;
    region: string; 
    status: 'ACTIVE' | 'SLEEP' | 'OFFLINE';
    latencyMs: number;
    neuronCount: number;
}

export interface ProceduralConfig {
    seed: number;
    densityMap: Record<number, number>; 
    lodThreshold: number; 
}

export interface BrainState {
  stage: LifeStage;
  ascensionLevel: number;
  neurotransmitters: Neurotransmitters;
  energy: number;        
  maxEnergy: number;     
  metabolicRate: number; 
  genesisTimestamp: number; 
  memories: Memory[];    
  shortTermBuffer: SensoryBufferItem[]; 
  phonemeMemory: Record<string, VocalParams>; 
  neuronCount: number;   
  synapseStrength: number;
  ageTicks: number;      
  lastThought: string;   
  isSleeping: boolean;   
  vocabulary: string[];  
  learnedReflexes: Record<string, number>;
  curiosityLevel: number; 
  mirrorNeuronActivity: number; 
  visualFocus: VisualFocus; 
  handPosition: { x: number, y: number }; 
  handVelocity: { vx: number, vy: number }; 
  targetStroke: { x: number, y: number }[]; 
  neuroPlasticity: NeuroPlasticity;
  outputCapabilities: OutputCapabilities;
  typewriterBuffer: string;
  typewriterHistory: TypewriterPage[];
  detectedPeripherals: string[]; 
  computeMode: ComputeMode;
  clusterConfig?: {
      connectedNodes: ClusterNodeInfo[];
      activeShards: string[];
  };
  proceduralConfig: ProceduralConfig;
}

export interface SimulationLog {
  id: string;
  timestamp: string;
  message: string;
  source: 'SYSTEM' | 'CORTEX' | 'OCULAR' | 'USER' | 'EAR' | 'BODY' | 'SELF' | 'WEB' | 'MEDIA_STATION' | 'EXNER' | 'ARCHITECT';
  attachment?: string;
  details?: any; 
}

export interface RealtimeSensoryData {
  vision: {
    intensity: number;
  };
  audio: {
    volume: number;
    frequencies: Uint8Array;
  };
  motor: {
    x: number;
    y: number;
    isDrawing: boolean;
  };
}