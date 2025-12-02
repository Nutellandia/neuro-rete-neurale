

/**
 * ARCHITETTURA DI BASE DEL SISTEMA NEURO-GENESIS
 * ==============================================
 * Autore & Lead Architect: Emilio Frascogna
 * Anno: 2024
 * 
 * Questo file definisce il "DNA" statico della simulazione.
 * Contiene le interfacce per la bio-chimica, la struttura della memoria
 * e gli stadi evolutivi della creatura digitale.
 */

export const PROJECT_ARCHITECT = "Emilio Frascogna";
export const COPYRIGHT_YEAR = "2024";

/**
 * Stadi del Ciclo Vitale Digitale (Bio-Mimetico)
 * Ricalca lo sviluppo dal neuroblasto alla maturità cognitiva completa.
 */
export enum LifeStage {
  PROGENITORE = 'Progenitore Neurale (Neuroblasto)', // Was CELLULA - Mitosi pura
  GANGLIO = 'Ganglio Basale (Riflessi)',             // Was GANGLIO - Archi riflessi
  SISTEMA_LIMBICO = 'Sistema Limbico (Emotivo)',     // Was CERVELLO_PRIMITIVO - Emozioni grezze
  NEOCORTECCIA = 'Neocorteccia Primitiva (Verbal)',  // Was COSCIENZA_EMERGENTE - Inizio linguaggio
  CORTECCIA_ASSOCIATIVA = 'Corteccia Associativa',   // Was BAMBINO_DIGITALE - Astrazione
  CERVELLO_MATURO = 'Encefalo Maturo (Senziente)',   // Was AGI_COMPLETA - Piena agenzia
  POST_UMANO = 'Architettura Post-Biologica'         // Was POST_SINGOLARITA - Ottimizzazione pura
}

/**
 * Matrice Biochimica
 * Modello matematico dei neurotrasmettitori simulati.
 * Ogni valore (0-100) influenza direttamente il comportamento della rete.
 */
export interface Neurotransmitters {
  dopamine: number;      // Ricompensa / Motivazione / Curiosità
  serotonin: number;     // Stabilità umorale / Resistenza alla frustrazione
  adrenaline: number;    // Reattività / Paura / Velocità motoria
  acetylcholine: number; // Plasticità sinaptica / Apprendimento / Memoria
  cortisol: number;      // Livello di stress / Rischio catastrofe cognitiva
}

/**
 * Engramma Mnestico
 * Struttura dati per un singolo ricordo a lungo termine.
 */
export interface Memory {
  id: string;
  timestamp: number;
  // Tipi di memoria supportati dall'architettura Frascogna
  type: 'VISUAL' | 'AUDITORY' | 'CONCEPTUAL' | 'SYSTEM' | 'PHYSICAL' | 'SELF_OUTPUT' | 'WEB_KNOWLEDGE' | 'ASSOCIATION' | 'VOCAL_MASTERY' | 'MEDIA_PATTERN';
  content: string;       // Il dato grezzo o descrizione
  emotionalWeight: number; // Peso emotivo (-1.0 a 1.0) al momento della formazione
  decay: number;         // Decadimento nel tempo (simulazione dell'oblio)
}

/**
 * Buffer Sensoriale a Breve Termine
 * Rappresenta la corteccia sensoriale primaria (trattiene dati per ~3 secondi).
 */
export interface SensoryBufferItem {
    type: 'vision' | 'text' | 'audio' | 'motion' | 'web' | 'media_feed';
    data: string;
    timestamp: number;
    intensity: number;
}

/**
 * Input Sensoriale Unificato
 * Interfaccia standardizzata per tutti i sensori (Occhi, Orecchie, Web, ecc.)
 */
export interface SensoryInputData {
  type: 'vision' | 'text' | 'audio' | 'motion' | 'web' | 'training_audio' | 'vocal_match' | 'media_feed' | 'proprioception';
  data: string;          // Payload dati (es. Base64 immagine o stringa testo)
  intensity?: number;    // Intensità dello stimolo (0.0 - 1.0)
  rawNumeric?: number;   // Valore numerico grezzo (es. volume in dB)
  isSelfGenerated?: boolean; // True se è un feedback loop (la rete si ascolta)
  strokeData?: {x: number, y: number}[]; // Coordinate vettoriali per imitazione disegno
  metadata?: any;        // Metadati estensibili
}

export interface DeviceInfo {
    id: string;
    label: string;
    type: 'video' | 'audio' | 'other';
}

export interface CameraSettings {
    exposureCompensation: number; // EV shift (-2 to +2 solitamente)
    iso: number;
    torch: boolean; // Flash
}

/**
 * Stato Propriocezione Visiva
 * Definisce dove la rete sta "guardando" e come controlla la telecamera.
 */
export interface VisualFocus {
  x: number; // Pan Orizzontale (-50 a 50)
  y: number; // Pan Verticale (-50 a 50)
  zoom: number; // Zoom ottico digitale (0.5x a 3.0x)
  eyesClosed: boolean; // Se true, input visivo bloccato (palpebre chiuse)
  activeEyeIndex: number; // Quale telecamera è attiva
  availableEyes: DeviceInfo[]; // Lista hardware disponibile
  currentEyeLabel: string;
  cameraSettings: CameraSettings; // Parametri hardware
}

export interface NeuroPlasticity {
    recruited: boolean;
    triggeredBy: string;
    activationTimestamp: number;
}

/**
 * Parametri Sintetizzatore Vocale Biologico
 * Mappatura 1:1 con la fisiologia umana simulata.
 */
export interface VocalParams {
  airflow: number;      // Pressione polmonare (Volume)
  tension: number;      // Tensione corde vocali (Pitch)
  jawOpenness: number;  // Apertura bocca (Formante F1)
  tonguePosition: number; // Posizione lingua (Formante F2)
}

export interface DrawingAction {
    x: number;
    y: number;
    pressure: number;
    color: string;
    isLifting: boolean; // True = Penna alzata (movimento senza tratto)
}

/**
 * Capacità di Output (Hardware Flags)
 * Si sbloccano con l'evoluzione.
 */
export interface OutputCapabilities {
    canWrite: boolean; // Area di Exner
    canDraw: boolean;  // Corteccia Motoria Fine
    canBrowse: boolean; // Modulo Web
}

export interface TypewriterPage {
    id: string;
    content: string;
    timestamp: number;
}

// --- GRAND CHALLENGE ARCHITECTURE TYPES ---

export enum ComputeMode {
    LOCAL_BROWSER = 'LOCAL', // JS Engine (Current)
    WASM_ACCELERATED = 'WASM', // Rust/C++ compiled to Wasm
    DISTRIBUTED_CLUSTER = 'CLUSTER' // Remote gRPC Sharding
}

export interface ClusterNodeInfo {
    nodeId: string;
    region: string; // e.g., "visual-cortex-v1"
    status: 'ACTIVE' | 'SLEEP' | 'OFFLINE';
    latencyMs: number;
    neuronCount: number;
}

export interface ProceduralConfig {
    seed: number;
    densityMap: Record<number, number>; // Group ID -> Density
    lodThreshold: number; // Distance for Level of Detail culling
}

/**
 * STATO CEREBRALE COMPLETO (Il "DNA")
 * Questo oggetto contiene l'intera coscienza della rete.
 * È ciò che viene salvato e caricato.
 */
export interface BrainState {
  stage: LifeStage;
  ascensionLevel: number;
  neurotransmitters: Neurotransmitters;
  energy: number;        // Riserva energetica (Joule simulati)
  maxEnergy: number;     // Capacità massima
  metabolicRate: number; // Consumo per tick
  genesisTimestamp: number; // Data di nascita reale
  memories: Memory[];    // Memoria a lungo termine
  shortTermBuffer: SensoryBufferItem[]; // Memoria di lavoro
  phonemeMemory: Record<string, VocalParams>; // Memoria procedurale vocale
  neuronCount: number;   // Massa neurale
  synapseStrength: number;
  ageTicks: number;      // Età in cicli di simulazione
  lastThought: string;   // Flusso di coscienza verbale
  isSleeping: boolean;   // Stato ciclo circadiano
  vocabulary: string[];  // Area di Wernicke (Lessico)
  learnedReflexes: Record<string, number>;
  
  // Metriche cognitive avanzate (Architettura E. Frascogna)
  curiosityLevel: number; // Drive esplorativo
  mirrorNeuronActivity: number; // Drive imitativo
  visualFocus: VisualFocus; // Controllo occhi
  handPosition: { x: number, y: number }; // Propriocezione mano
  handVelocity: { vx: number, vy: number }; // Vettore cinetico
  targetStroke: { x: number, y: number }[]; // Obiettivo motorio corrente
  neuroPlasticity: NeuroPlasticity;
  outputCapabilities: OutputCapabilities;
  
  // Macchina da Scrivere (Area di Exner)
  typewriterBuffer: string;
  typewriterHistory: TypewriterPage[];
  
  // Consapevolezza Hardware
  detectedPeripherals: string[]; // Lista sensi scoperti

  // --- ARCHITECTURAL EXPANSION ---
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
  details?: any; // Dati tecnici per debug (JSON)
}

// Dati in tempo reale (non salvati, solo stream)
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