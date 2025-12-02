
/**
 * INTERFACCIA WEB (NOOSFERA - REALE)
 * ==================================
 * Autore: Emilio Frascogna
 * 
 * Modulo di connessione alla conoscenza globale.
 * Utilizza le API pubbliche di WIKIPEDIA per recuperare dati reali.
 * Non richiede chiavi API, rispetta la privacy e funziona via CORS.
 */

import React, { useState, useEffect, useRef } from 'react';
import { LifeStage } from '../types';

interface WebInterfaceProps {
  onDataReceived: (data: string, sourceUrl?: string) => void;
  isActive: boolean;
  isEnabled: boolean;
  stage: LifeStage;
  vocabCount: number; // Numero di parole conosciute
  onToggle: (enabled: boolean) => void;
  triggerQuery?: string | null;
  onQueryComplete?: () => void;
}

interface SearchSource {
    title: string;
    url: string;
}

const WebInterface: React.FC<WebInterfaceProps> = ({ 
    onDataReceived, isActive, isEnabled, stage, vocabCount, onToggle, triggerQuery, onQueryComplete 
}) => {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState("STANDBY");
  
  const [displayedContent, setDisplayedContent] = useState("");
  const [fullContent, setFullContent] = useState("");
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  
  const [isBrainInitiated, setIsBrainInitiated] = useState(false);
  const typeWriterRef = useRef<number | null>(null);

  // LOGICA BLOCCO VOCALE
  // Se il vocabolario è inferiore a 5 parole, il blocco è attivo di default
  const [voiceLock, setVoiceLock] = useState(vocabCount < 5);

  // Evoluzione richiesta: Almeno Ganglio per usare il web
  const isHardwareCapable = stage !== LifeStage.PROGENITORE && stage !== LifeStage.GANGLIO;

  useEffect(() => {
      // Se il vocabolario cresce, potremmo sbloccare automaticamente, 
      // ma per ora lasciamo il controllo manuale o logica di avvio
      if (vocabCount >= 5 && voiceLock) {
          // Opzionale: sblocco automatico
          // setVoiceLock(false);
      }
  }, [vocabCount]);

  useEffect(() => {
      if (triggerQuery && isEnabled && isActive && !isSearching && !voiceLock) {
          setQuery(triggerQuery);
          setIsBrainInitiated(true);
          performSearch(undefined, triggerQuery);
          if (onQueryComplete) onQueryComplete();
      }
  }, [triggerQuery, isEnabled, isActive, voiceLock]);

  // Effetto Macchina da Scrivere per visualizzazione dati
  useEffect(() => {
      if (fullContent && displayedContent.length < fullContent.length) {
          const speed = isBrainInitiated ? 3 : 10; // Più veloce se è una query automatica
          typeWriterRef.current = window.setTimeout(() => {
              setDisplayedContent(fullContent.slice(0, displayedContent.length + 5)); 
          }, speed);
      }
      return () => {
          if (typeWriterRef.current) clearTimeout(typeWriterRef.current);
      }
  }, [displayedContent, fullContent]);

  const performSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const q = overrideQuery || query;
    if (!q.trim() || !isActive || !isEnabled || isSearching || voiceLock) return;

    setIsSearching(true);
    setDisplayedContent("");
    setFullContent("");
    setSources([]);
    setStatusMessage("RESOLVING HOST...");

    if (!history.includes(q)) setHistory(prev => [q, ...prev].slice(0, 5));

    try {
        setStatusMessage("HANDSHAKE: WIKI_NODE...");
        
        // --- UPDATED API CALL (ROBUST QUERY GENERATOR) ---
        // Usiamo action=query con generator=search per trovare la pagina migliore
        // e prop=extracts per ottenere il riassunto pulito.
        // exchars=1200 limita la lunghezza per non sovraccaricare la memoria a breve termine.
        const endpoint = `https://it.wikipedia.org/w/api.php?origin=*&action=query&format=json&prop=extracts|info&inprop=url&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=1&exintro=1&explaintext=1&exchars=1200`;
        
        const response = await fetch(endpoint);
        const data = await response.json();
        
        // Parsing della risposta (Le chiavi sono PageID dinamici)
        const pages = data.query?.pages;
        let foundPage: any = null;

        if (pages) {
            const pageId = Object.keys(pages)[0];
            if (pageId !== "-1") {
                foundPage = pages[pageId];
            }
        }

        if (foundPage && foundPage.extract) {
            const title = foundPage.title;
            const description = foundPage.extract;
            const link = foundPage.fullurl;

            setStatusMessage("DOWNLOADING PACKETS...");
            
            // Ritardo artificiale per effetto "modem/download"
            setTimeout(() => {
                setStatusMessage("PARSING DATA...");
                
                // Formatta il testo per la rete neurale
                // Rimuove eventuali newline eccessivi e normalizza
                const cleanText = description.replace(/\n+/g, '\n').trim();
                
                const formattedResponse = `[NOOSPHERE_PACKET]\nTOPIC: "${title.toUpperCase()}"\n\nDATA: ${cleanText}\n\n[SOURCE: WIKIPEDIA_ITALIA]`;
                
                setFullContent(formattedResponse);
                setSources([{ title: title, url: link }]);
                
                // Invia i dati REALI al cervello
                onDataReceived(cleanText, link);
                
                if (!overrideQuery) setQuery("");
                setStatusMessage("DATA INTEGRATED.");
                setIsSearching(false);
                setTimeout(() => setIsBrainInitiated(false), 3000);
            }, 800);

        } else {
            // Nessun risultato trovato
            setStatusMessage("ERROR: 404 NOT FOUND");
            setFullContent(`[ERROR] Query "${q}" did not return valid knowledge nodes.\nNoosphere signal lost or term unknown.`);
            setIsSearching(false);
        }

    } catch (error) {
        console.error("Web Error:", error);
        setStatusMessage("CONNECTION FAILED");
        setFullContent(`[FATAL ERROR] Unable to connect to Noosphere Gateway.\nCheck internet connection or DNS.`);
        setIsSearching(false);
    }
  };

  return (
    <div className={`bg-bio-panel p-3 rounded-xl border mt-4 relative overflow-hidden transition-all duration-500 shadow-lg ${isBrainInitiated ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]' : 'border-gray-700'}`}>
        {/* Scanlines Effect */}
        {isEnabled && <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.2)_50%)] z-0 bg-[length:100%_4px] opacity-30"></div>}

        <div className="flex justify-between items-center mb-3 relative z-10 border-b border-gray-800 pb-2">
            <div className="flex flex-col">
                <span className={`text-xs font-mono font-bold flex items-center gap-2 ${isBrainInitiated ? 'text-white animate-pulse' : 'text-cyan-400'}`}>
                    <span className={isSearching ? "animate-spin" : ""}>❖</span> 
                    {isBrainInitiated ? "IMPULSO CORTICALE RILEVATO" : "TERMINALE NOOSFERA"}
                </span>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    {isSearching ? (
                        <span className="text-yellow-500 animate-pulse">● {statusMessage}</span>
                    ) : (
                        <span>STATUS: {statusMessage}</span>
                    )}
                </span>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setVoiceLock(!voiceLock)}
                    className={`text-[9px] px-2 py-0.5 rounded border transition-colors font-bold uppercase ${
                        voiceLock 
                        ? 'bg-red-900/50 text-red-300 border-red-600' 
                        : 'bg-gray-800 text-gray-500 border-gray-600'
                    }`}
                    title="Impedisce ricerche se la rete non sa parlare"
                >
                    {voiceLock ? "🔒 BLOCCO VOCALE" : "🔓 VOCE OK"}
                </button>

                <button 
                onClick={() => onToggle(!isEnabled)}
                disabled={!isHardwareCapable || !isActive}
                className={`text-[9px] px-3 py-1 rounded border transition-colors font-bold uppercase tracking-widest ${
                    !isHardwareCapable ? 'opacity-30 cursor-not-allowed bg-gray-800 border-gray-700' :
                    isEnabled 
                    ? 'bg-cyan-900/30 border-cyan-500 text-cyan-200 hover:bg-cyan-900/50' 
                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'
                }`}
                >
                {isEnabled ? "ONLINE" : "OFFLINE"}
                </button>
            </div>
        </div>

        {!isHardwareCapable ? (
             <div className="text-[10px] text-gray-600 font-mono p-4 border border-gray-800 border-dashed rounded text-center bg-black/20">
                 [ HARDWARE BIOLOGICO INSUFFICIENTE ]
                 <br/><span className="text-gray-700">Richiede evoluzione: Sistema Limbico+</span>
             </div>
        ) : !isEnabled ? (
            <div className="text-[10px] text-gray-500 font-mono p-6 bg-black/40 border border-gray-800 rounded text-center flex flex-col items-center gap-2">
                <span className="text-2xl opacity-30">🛡️</span>
                <span>PROTOCOLLO SICUREZZA ATTIVO</span>
                <span className="text-[8px] opacity-50">L'accesso alla rete neurale globale è stato inibito manualmente.</span>
            </div>
        ) : (
            <div className="relative z-10 flex flex-col gap-3">
                {/* BARRA DI RICERCA */}
                <form onSubmit={(e) => performSearch(e)} className="flex gap-1 relative">
                    <div className="flex-1 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-cyan-600 text-[10px]">></span>
                        <input 
                            type="text" 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={voiceLock ? "RICERCA BLOCCATA (VOCABOLARIO INSUFFICIENTE)" : "Interroga la Noosfera (Wikipedia)..."}
                            disabled={isSearching || !isActive || voiceLock}
                            className={`w-full bg-black/60 border rounded px-2 py-1.5 pl-5 text-[10px] text-cyan-100 focus:outline-none font-mono transition-colors ${isBrainInitiated ? 'border-cyan-400' : 'border-gray-700 focus:border-cyan-500'} ${voiceLock ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={isSearching || !query.trim() || !isActive || voiceLock}
                        className="bg-cyan-900/30 hover:bg-cyan-800/50 text-cyan-400 border border-cyan-800/50 rounded px-3 py-1 text-[9px] font-bold uppercase transition-all disabled:opacity-50"
                    >
                        {isSearching ? "ACK..." : (voiceLock ? "LOCK" : "EXEC")}
                    </button>
                </form>
                
                {/* CRONOLOGIA */}
                {!voiceLock && history.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {history.map((h, i) => (
                            <button 
                                key={i}
                                onClick={() => performSearch(undefined, h)}
                                className="shrink-0 text-[8px] bg-gray-800/50 hover:bg-gray-700 text-gray-400 px-2 py-0.5 rounded border border-gray-700 font-mono truncate max-w-[100px]"
                            >
                                {h}
                            </button>
                        ))}
                    </div>
                )}

                {/* DISPLAY DATI */}
                <div className="min-h-[6rem] max-h-[12rem] bg-black border border-gray-800 rounded p-3 font-mono text-[10px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 relative shadow-inner">
                    {fullContent ? (
                        <div className="flex flex-col gap-3">
                            {/* FLUSSO TESTUALE */}
                            <div className="text-cyan-100 leading-relaxed whitespace-pre-wrap relative">
                                {displayedContent}
                                {displayedContent.length < fullContent.length && <span className="animate-pulse inline-block w-2 h-3 bg-cyan-500 ml-1 align-middle"></span>}
                            </div>
                            
                            {/* GRIGLIA FONTI */}
                            {sources.length > 0 && displayedContent.length >= fullContent.length && (
                                <div className="mt-2 border-t border-gray-800 pt-2 animate-fade-in">
                                    <div className="text-[8px] text-gray-500 mb-2 uppercase tracking-wider">WIKI NODES / SOURCES:</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {sources.map((src, idx) => (
                                            <a 
                                                key={idx}
                                                href={src.url}
                                                target="_blank"
                                                rel="noreferrer" 
                                                className="flex items-center gap-2 p-2 bg-gray-900/50 border border-gray-800 rounded hover:bg-gray-800 hover:border-gray-600 transition-all group cursor-pointer decoration-0"
                                            >
                                                <div className="w-2 h-2 bg-green-900 rounded-full group-hover:bg-green-500 transition-colors"></div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-[9px] text-gray-300 truncate font-bold group-hover:text-green-400">{src.title}</span>
                                                    <span className="text-[7px] text-gray-600 truncate underline decoration-gray-700">{src.url}</span>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-800 gap-2">
                            {voiceLock ? (
                                <>
                                    <div className="text-2xl opacity-50">🤐</div>
                                    <div className="text-[8px] text-red-900 font-bold">ACCESSO NEGATO: VOCABOLARIO INSUFFICIENTE</div>
                                    <div className="text-[8px]">Impara a parlare prima di cercare.</div>
                                </>
                            ) : isSearching ? (
                                <>
                                    <div className="w-full max-w-[100px] h-1 bg-gray-800 rounded overflow-hidden">
                                        <div className="h-full bg-cyan-600 animate-[loading_1s_ease-in-out_infinite]"></div>
                                    </div>
                                    <div className="text-[8px] animate-pulse">NEGOTIATING REAL-TIME DATA...</div>
                                </>
                            ) : (
                                <>
                                    <div className="text-2xl opacity-20">📡</div>
                                    <div className="text-[8px]">CANALE PRONTO. IN ATTESA DI INPUT.</div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};

export default WebInterface;
