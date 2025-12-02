
import JSZip from 'jszip';
import { BrainState, SimulationLog } from '../types';

/**
 * SISTEMA DI ESPORTAZIONE ROBUSTO (FETCH RUNTIME)
 * ===============================================
 * Invece di usare 'import ?raw' che causa errori di risoluzione moduli in alcuni ambienti,
 * utilizziamo fetch() per scaricare i file sorgente direttamente dal server web
 * che ospita l'applicazione. Questo approccio è immune a errori di build-time.
 */

// LISTA COMPLETA DEI FILE DA INCLUDERE NELLO ZIP
const FILES_TO_FETCH = [
    'index.html',
    'index.tsx',
    'App.tsx',
    'types.ts',
    'metadata.json',
    'manifest.json',
    'icon.svg',
    'service-worker.js',
    'vite.config.ts',
    'tsconfig.json',
    'package.json',
    
    // Components
    'components/AudioSystem.tsx',
    'components/CreativeCanvas.tsx',
    'components/MediaLearningStation.tsx',
    'components/MetabolismMonitor.tsx',
    'components/MotionSystem.tsx',
    'components/NeuronVisualizer.tsx',
    'components/NeuroControls.tsx',
    'components/OcularSystem.tsx',
    'components/TypewriterSystem.tsx',
    'components/VocalTract.tsx',
    'components/WebInterface.tsx',

    // Services
    'services/biologicalVoice.ts',
    'services/cognitiveEngine.ts',
    'services/externalCortex.ts',
    'services/geminiService.ts',
    'services/localLlmNode.ts',
    'services/neuralModel.ts',
    'services/neuroArchitect.ts',
    'services/persistence.ts',
    'services/sourceExporter.ts',

    // Backend
    'backend/package.json',
    'backend/server.js'
];

export const exportProjectToZip = async (brain: BrainState, logs: SimulationLog[]) => {
    console.log("[EXPORT] Avvio procedura Fetch & Zip...");
    const zip = new JSZip();

    // --- 1. DATI NEURALI ---
    const neuralFolder = zip.folder("neural_data");
    if (neuralFolder) {
        neuralFolder.file("brain_dna.json", JSON.stringify(brain, null, 2));
        neuralFolder.file("simulation_logs.json", JSON.stringify(logs, null, 2));
    }

    // --- 2. CODICE SORGENTE (Scaricato via HTTP) ---
    const sourceFolder = zip.folder("source_code");
    if (sourceFolder) {
        // Eseguiamo tutte le richieste in parallelo
        const fetchPromises = FILES_TO_FETCH.map(async (path) => {
            try {
                // Costruiamo il percorso relativo alla root del sito
                const url = `./${path}`;
                const response = await fetch(url);
                
                if (response.ok) {
                    const text = await response.text();
                    sourceFolder.file(path, text);
                } else {
                    console.warn(`[EXPORT] Impossibile recuperare ${path}: ${response.status}`);
                    sourceFolder.file(path + ".missing", `HTTP ERROR ${response.status}: File not found or not served.`);
                }
            } catch (e: any) {
                console.warn(`[EXPORT] Errore fetch ${path}:`, e);
                sourceFolder.file(path + ".error", `FETCH ERROR: ${e.message}`);
            }
        });

        await Promise.all(fetchPromises);
    }

    // README
    const readmeContent = `NEURO-GENESIS PROJECT EXPORT
    
Data Export: ${new Date().toLocaleString()}
Metodo: Runtime Fetch

NOTE:
1. 'brain_dna.json' contiene lo stato neurale completo.
2. I file in 'source_code' sono stati scaricati dall'applicazione in esecuzione.
   Se alcuni file mancano o hanno estensione .error, il server web non li stava servendo come asset statici.
`;
    zip.file("README_EXPORT.txt", readmeContent);

    // --- 3. GENERAZIONE E DOWNLOAD ---
    try {
        console.log("[EXPORT] Compressione ZIP...");
        const content = await zip.generateAsync({ type: "blob" });
        
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Neuro_Genesis_FULL_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);

        console.log("[EXPORT] Completato.");

    } catch (e) {
        console.error("[EXPORT] Errore generazione ZIP:", e);
        alert("Errore durante la creazione dell'archivio.");
    }
};
