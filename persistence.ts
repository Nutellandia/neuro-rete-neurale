import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { BrainState, LifeStage, ComputeMode } from "@/types";

const firebaseConfig = {
  apiKey: "AIzaSyA84mQMf4xDipOcbbPA_vqSQrXIwhJRP78",
  authDomain: "genesis-4a679.firebaseapp.com",
  projectId: "genesis-4a679",
  storageBucket: "genesis-4a679.firebasestorage.app",
  messagingSenderId: "1043488726934",
  appId: "1:1043488726934:web:c842798635cd48a05247b7",
  measurementId: "G-LSJZHNWLWF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

isSupported().then(yes => { if(yes) getAnalytics(app); }).catch(err => console.warn("Firebase Analytics not supported"));

const COLLECTION_NAME = "neuro_saves";
const LOCAL_STORAGE_KEY = "neuro_genesis_local_backup";
const ID_KEY = "neuro_device_id";

const getDeviceId = () => {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
        id = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(ID_KEY, id);
    }
    return id;
};

export const getFreshBrainState = (): BrainState => ({ stage: LifeStage.PROGENITORE, neuronCount: 1, energy: 100, neurotransmitters: {dopamine:50,serotonin:50,adrenaline:10,acetylcholine:50,cortisol:0}, memories:[], shortTermBuffer:[], phonemeMemory:{}, synapseStrength:0.1, ageTicks:0, lastThought:'...', isSleeping:false, vocabulary:[], learnedReflexes:{}, curiosityLevel:0, mirrorNeuronActivity:0, visualFocus:{x:0,y:0,zoom:1,eyesClosed:false,activeEyeIndex:0,availableEyes:[],currentEyeLabel:'',cameraSettings:{exposureCompensation:0,iso:0,torch:false}}, handPosition:{x:50,y:50}, handVelocity:{vx:0,vy:0}, targetStroke:[], neuroPlasticity:{recruited:false,triggeredBy:'',activationTimestamp:0}, outputCapabilities:{canWrite:false,canDraw:false,canBrowse:false}, typewriterBuffer:'', typewriterHistory:[], detectedPeripherals:[], computeMode:ComputeMode.LOCAL_BROWSER, proceduralConfig:{seed:0,densityMap:{},lodThreshold:0}, ascensionLevel:0, maxEnergy:100, metabolicRate:0, genesisTimestamp: Date.now() });

export const sanitizeState = (s:any) => s;
export const saveBrainStateSync = (s:any) => { try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(s)); } catch(e){} };
export const saveBrainState = async (state: BrainState) => {
    try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    try { const deviceId = getDeviceId(); await setDoc(doc(db, COLLECTION_NAME, deviceId), JSON.parse(JSON.stringify(state))); } catch (e) {}
};
export const loadBrainState = async () => {
    try { const localData = localStorage.getItem(LOCAL_STORAGE_KEY); if (localData) return JSON.parse(localData); } catch (e) {}
    return null;
};
export const clearBrainData = async () => { localStorage.removeItem(LOCAL_STORAGE_KEY); };