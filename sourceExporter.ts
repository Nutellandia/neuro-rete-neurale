
import JSZip from 'jszip';
import { BrainState, SimulationLog } from '../types';

/**
 * SISTEMA DI ESPORTAZIONE RAW (STORE ONLY)
 * ========================================
 * Strategia: Nessuna compressione (STORE).
 * Obiettivo: Velocità massima e stabilità memoria per file >50MB.
 * Include: Integrity Check (Verifica peso byte pre/post).
 */

// Lista esplicita dei file del progetto. 
const PROJECT_FILES = [
    'index.html',
    'index.tsx',
    'App.tsx',
    'types.ts',
    'metadata.json',
    'vite.config.ts',
    'tsconfig.json',
    'package.json',
    'manifest.json',
    'service-worker.js',
    'icon.svg',
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

// Helper per scaricare il Blob finale
const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); 
    a.click();
    
    // Pulizia differita
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 2000);
};

export const exportProjectToZip = async (brain: BrainState, logs: SimulationLog[]) => {
    console.log("[EXPORT] Inizio generazione ZIP (MODALITÀ RAW/STORE)...");
    const zip = new JSZip();
    let computedSize = 0;
    
    // --- 1. DATI NEURALI (STORE) ---
    const neuralFolder = zip.folder("neural_data");
    if (neuralFolder) {
        const brainString = JSON.stringify(brain, null, 2);
        const brainBlob = new Blob([brainString], { type: "application/json" });
        computedSize += brainBlob.size;
        console.log(`[CHECK] Brain DNA Size: ${(brainBlob.size / 1024 / 1024).toFixed(2)} MB`);
        
        neuralFolder.file("brain_dna.json", brainBlob, { 
            compression: "STORE" 
        });

        const logsString = JSON.stringify(logs, null, 2);
        const logsBlob = new Blob([logsString], { type: "application/json" });
        computedSize += logsBlob.size;
        console.log(`[CHECK] Logs Size: ${(logsBlob.size / 1024 / 1024).toFixed(2)} MB`);
        
        neuralFolder.file("simulation_logs.json", logsBlob, { 
            compression: "STORE"
        });
    }

    // --- 2. CODICE SORGENTE (STORE) ---
    const sourceFolder = zip.folder("source_code");
    
    if (sourceFolder) {
        console.log(`[EXPORT] Recupero file sorgente...`);

        await Promise.all(PROJECT_FILES.map(async (filePath) => {
            try {
                const response = await fetch(`./${filePath}`);
                
                if (response.ok) {
                    const text = await response.text();
                    const size = new Blob([text]).size;
                    computedSize += size;
                    
                    // Integrity Check per singolo file
                    if (size === 0) console.warn(`[WARNING] File vuoto rilevato: ${filePath}`);
                    
                    // FORZIAMO STORE ANCHE QUI PER SICUREZZA
                    sourceFolder.file(filePath, text, { compression: "STORE" });
                } else {
                    console.warn(`[EXPORT] File mancante: ${filePath}`);
                    sourceFolder.file(`${filePath}.missing`, `Status: ${response.status}`);
                }
            } catch (err) {
                console.warn(`[EXPORT] Errore fetch: ${filePath}`, err);
            }
        }));
    }

    // README
    const readmeContent = `NEURO-GENESIS PROJECT EXPORT (RAW)
    
Data: ${new Date().toLocaleString()}
Architetto: Emilio Frascogna

CONTENUTO:
1. /source_code: Codice sorgente.
2. /neural_data: DNA neurale e log.

INTEGRITÀ:
Questo archivio è stato generato senza compressione (STORE method) per garantire
l'integrità bit-perfect dei grandi dataset JSON (brain_dna.json).
`;
    const readmeSize = new Blob([readmeContent]).size;
    computedSize += readmeSize;
    zip.file("README_EXPORT.txt", readmeContent, { compression: "STORE" });

    // --- 3. GENERAZIONE E VERIFICA ---
    console.log(`[INTEGRITY] Dimensione Contenuto Attesa: ${(computedSize / 1024 / 1024).toFixed(2)} MB`);
    
    try {
        const content = await zip.generateAsync({ 
            type: "blob",
            platform: "UNIX",
            compression: "STORE" // GLOBAL STORE OVERRIDE
        });

        console.log(`[INTEGRITY] Dimensione ZIP Generato: ${(content.size / 1024 / 1024).toFixed(2)} MB`);
        
        // VERIFICA FINALE: Lo ZIP (che ha header) DEVE essere >= dei dati grezzi
        if (content.size < computedSize) {
             console.error("[INTEGRITY FAIL] Lo ZIP è più piccolo dei dati grezzi. Possibile corruzione.");
             alert("ATTENZIONE: Errore integrità dati. Il file ZIP sembra incompleto.");
        } else {
             console.log("[INTEGRITY OK] Validazione superata. Download avviato.");
        }

        const filename = `Neuro_Genesis_RAW_${Date.now()}.zip`;
        triggerDownload(content, filename);

    } catch (e) {
        console.error("[EXPORT] Errore critico generazione ZIP:", e);
        alert("Errore critico durante la generazione dell'archivio.");
    }
};
