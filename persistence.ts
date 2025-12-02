

/**
 * SISTEMA DI PERSISTENZA E SALVATAGGIO
 * ====================================
 * Autore: Emilio Frascogna
 * 
 * Gestisce il salvataggio dello stato cerebrale (DNA) sia in Locale
 * che su Cloud (Firebase). Include logiche di compressione ZIP
 * e sanitizzazione dati per prevenire corruzione (Deep Clean).
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { BrainState, LifeStage, ComputeMode } from "../types";

// --- CONFIGURAZIONE FIREBASE (Google Cloud) ---
const firebaseConfig = {
  apiKey: "AIzaSyA84mQMf4xDipOcbbPA_vqSQrXIwhJRP78",
  authDomain: "genesis-4a679.firebaseapp.com",
  projectId: "genesis-4a679",
  storageBucket: "genesis-4a679.firebasestorage.app",
  messagingSenderId: "1043488726934",
  appId: "1:1043488726934:web:c842798635cd48a05247b7",
  measurementId: "G-LSJZHNWLWF"
};

// Inizializzazione Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Inizializzazione Analytics sicura
isSupported().then(yes => {
    if(yes) getAnalytics(app);
}).catch(err => console.warn("Firebase Analytics not supported in this environment"));

const COLLECTION_NAME = "neuro_saves";
const LOCAL_STORAGE_KEY = "neuro_genesis_local_backup";
const ID_KEY = "neuro_device_id";

// Helper per ID Dispositivo univoco
const getDeviceId = () => {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
        id = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(ID_KEY, id);
    }
    return id;
};

// GENERATORE DI STATO VERGINE (Factory Function)
// Crea una nuova rete allo stadio Cellula
export const getFreshBrainState = (): BrainState => ({
  stage: LifeStage.PROGENITORE,
  ascensionLevel: 0,
  energy: 80, 
  maxEnergy: 150, 
  metabolicRate: 0,
  genesisTimestamp: Date.now(), 
  neurotransmitters: {
    dopamine: 50,
    serotonin: 80,
    adrenaline: 10,
    acetylcholine: 10,
    cortisol: 0
  },
  memories: [],
  shortTermBuffer: [], 
  phonemeMemory: {}, 
  neuronCount: 1,
  synapseStrength: 0.1,
  ageTicks: 0,
  lastThought: "[SYSTEM: VITAL_SIGNAL_DETECTED]",
  isSleeping: false, 
  vocabulary: [],
  learnedReflexes: {},
  curiosityLevel: 0,
  mirrorNeuronActivity: 0,
  visualFocus: { 
    x: 0, 
    y: 0, 
    zoom: 1, 
    eyesClosed: false,
    activeEyeIndex: 0, 
    availableEyes: [], 
    currentEyeLabel: "Default",
    cameraSettings: {
        exposureCompensation: 0,
        iso: 0,
        torch: false
    }
  },
  handPosition: { x: 50, y: 50 },
  handVelocity: { vx: 0, vy: 0 },
  targetStroke: [],
  neuroPlasticity: {
      recruited: false,
      triggeredBy: "",
      activationTimestamp: 0
  },
  outputCapabilities: {
      canWrite: false,
      canDraw: false, // Disabilitato inizialmente
      canBrowse: false
  },
  typewriterBuffer: "",
  typewriterHistory: [],
  detectedPeripherals: [],
  
  // Architecture Defaults
  computeMode: ComputeMode.LOCAL_BROWSER,
  proceduralConfig: {
      seed: Date.now(),
      densityMap: { 0: 0.5, 1: 0.8 }, // Base density
      lodThreshold: 1000
  }
});

/**
 * SANITIZZAZIONE DATI (Deep Clean)
 * Rimuove stringhe corrotte (es. Base64 di immagini) che potrebbero essere state 
 * salvate per errore nel vocabolario o nei pensieri.
 * 
 * UPDATE v4.5: Include migrazione Legacy -> Biological LifeStage
 */
export const sanitizeState = (state: any): BrainState => {
    const clean = { ...getFreshBrainState(), ...state };
    
    // --- MIGRAZIONE STADI EVOLUTIVI (LEGACY -> BIO) ---
    // Se il salvataggio usa vecchie stringhe o enum, mappale ai nuovi termini biologici
    const stageMap: Record<string, LifeStage> = {
        'CELLULA': LifeStage.PROGENITORE,
        'Cellula': LifeStage.PROGENITORE,
        'GANGLIO': LifeStage.GANGLIO,
        'Ganglio': LifeStage.GANGLIO,
        'CERVELLO_PRIMITIVO': LifeStage.SISTEMA_LIMBICO,
        'Cervello Primitivo': LifeStage.SISTEMA_LIMBICO,
        'COSCIENZA_EMERGENTE': LifeStage.NEOCORTECCIA,
        'Coscienza Emergente': LifeStage.NEOCORTECCIA,
        'BAMBINO_DIGITALE': LifeStage.CORTECCIA_ASSOCIATIVA,
        'Bambino Digitale': LifeStage.CORTECCIA_ASSOCIATIVA,
        'AGI_COMPLETA': LifeStage.CERVELLO_MATURO,
        'AGI Completa': LifeStage.CERVELLO_MATURO,
        'POST_SINGOLARITA': LifeStage.POST_UMANO,
        'Post Singolarità': LifeStage.POST_UMANO
    };

    // Controllo se lo stadio attuale è una chiave legacy
    // Usiamo una coercizione di tipo sicura
    const currentStageStr = clean.stage as string;
    if (stageMap[currentStageStr]) {
        clean.stage = stageMap[currentStageStr];
    } 
    // Fallback: se lo stadio non è valido, resetta a Progenitore ma mantieni i neuroni
    else if (!Object.values(LifeStage).includes(clean.stage)) {
        clean.stage = LifeStage.PROGENITORE;
    }

    // 1. Pulisci Vocabolario da Base64 o stringhe lunghe
    if (Array.isArray(clean.vocabulary)) {
        clean.vocabulary = clean.vocabulary.filter((word: string) => {
            if (typeof word !== 'string') return false;
            if (word.length > 50) return false;
            if (word.startsWith('/') || word.startsWith('data:')) return false;
            return true;
        });
    }

    // 2. Pulisci Pensieri
    if (typeof clean.lastThought === 'string' && (clean.lastThought.length > 200 || clean.lastThought.startsWith('/'))) {
        clean.lastThought = "...";
    }

    // 3. Pulisci Memorie
    if (Array.isArray(clean.memories)) {
        clean.memories = clean.memories.filter((m: any) => {
            if (!m.content || typeof m.content !== 'string') return false;
            if (m.content.length > 1000) return false; // Max lunghezza memoria
            return true;
        });
    }
    
    // 4. Ripara Exner
    if (!clean.typewriterBuffer) clean.typewriterBuffer = "";
    if (!clean.typewriterHistory) clean.typewriterHistory = [];

    // 5. Ripara Strutture Dati Mancanti (Migration)
    if (!clean.phonemeMemory) clean.phonemeMemory = {};
    if (!clean.visualFocus) clean.visualFocus = getFreshBrainState().visualFocus;
    if (!clean.outputCapabilities) clean.outputCapabilities = getFreshBrainState().outputCapabilities;
    if (!clean.visualFocus.cameraSettings) clean.visualFocus.cameraSettings = { exposureCompensation: 0, iso: 0, torch: false };
    
    // 6. Init Architettura
    if (!clean.computeMode) clean.computeMode = ComputeMode.LOCAL_BROWSER;
    if (!clean.proceduralConfig) clean.proceduralConfig = getFreshBrainState().proceduralConfig;

    return clean;
};

/**
 * SALVATAGGIO SINCRONO (Locale)
 * Per operazioni critiche (es. Apprendimento nuova parola)
 */
export const saveBrainStateSync = (state: BrainState) => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("Local Save Sync Error:", e);
    }
};

/**
 * SALVATAGGIO ASINCRONO (Cloud + Locale)
 */
export const saveBrainState = async (state: BrainState) => {
    // 1. Scrittura Locale Immediata
    saveBrainStateSync(state);

    // 2. Scrittura Cloud (Debounced o periodica idealmente, qui diretta)
    try {
        const deviceId = getDeviceId();
        await setDoc(doc(db, COLLECTION_NAME, deviceId), JSON.parse(JSON.stringify(state))); // JSON stringify/parse pulisce undefined
    } catch (e) {
        // Silenzia errori cloud (offline mode)
    }
};

/**
 * CARICAMENTO STATO (Strategia: Local-First)
 */
export const loadBrainState = async (): Promise<BrainState | null> => {
    // 1. Tenta Locale (Priorità Massima)
    try {
        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localData) {
            const parsed = JSON.parse(localData);
            return sanitizeState(parsed);
        }
    } catch (e) {
        console.warn("Local Load Failed, trying Cloud...", e);
    }

    // 2. Tenta Cloud (Backup)
    try {
        const deviceId = getDeviceId();
        const snap = await getDoc(doc(db, COLLECTION_NAME, deviceId));
        if (snap.exists()) {
            return sanitizeState(snap.data());
        }
    } catch (e) {
        console.warn("Cloud Load Failed", e);
    }

    return null; // Nessun salvataggio trovato
};

/**
 * CANCELLAZIONE TOTALE (Kill Switch)
 */
export const clearBrainData = async () => {
    try {
        // 1. Cancella Locale
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        
        // 2. Cancella Cloud
        const deviceId = getDeviceId();
        await deleteDoc(doc(db, COLLECTION_NAME, deviceId));
    } catch (e) {
        console.error("Clear Data Error:", e);
    }
};