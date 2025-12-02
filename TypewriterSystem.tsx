import React, { useRef, useEffect, useState } from 'react';
import { TypewriterPage, LifeStage } from '../types';

interface TypewriterSystemProps {
    content: string; // Il buffer attuale
    history: TypewriterPage[]; // Pagine strappate
    isActive: boolean;
    canWrite: boolean; // Capacità hardware sbloccata
    onClear: () => void; // Strappa pagina
    onUserInput?: (text: string) => void;
}

const TypewriterSystem: React.FC<TypewriterSystemProps> = ({ content, history, isActive, canWrite, onClear, onUserInput }) => {
    const endRef = useRef<HTMLDivElement>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [inputText, setInputText] = useState("");

    // Auto-scroll durante la digitazione
    useEffect(() => {
        if (endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [content]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputText.trim() && onUserInput) {
            onUserInput(inputText);
            setInputText("");
        }
    };

    if (!canWrite) {
        return (
            <div className="bg-bio-panel p-6 rounded-lg border border-gray-800 opacity-50 flex flex-col items-center justify-center text-center gap-2 min-h-[200px]">
                <span className="text-3xl grayscale">⌨️</span>
                <span className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">AREA DI EXNER: INATTIVA</span>
                <span className="text-[9px] text-gray-600">La rete non ha ancora sviluppato la motricità fine necessaria per scrivere.</span>
            </div>
        );
    }

    return (
        <div className="bg-bio-panel p-2 rounded-lg border border-cyan-900/40 mt-4 relative flex flex-col gap-2">
            
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                <div className="flex flex-col">
                    <span className="text-xs font-mono text-cyan-400 font-bold flex items-center gap-2">
                        <span>⌨️</span> COMUNICAZIONE ESTERNA
                    </span>
                    <span className="text-[8px] text-gray-500 uppercase tracking-wider">
                        PROP. MECCANICA: {content.length > 0 ? "ATTIVA" : "STANDBY"}
                    </span>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowHistory(!showHistory)}
                        className={`text-[9px] px-2 py-1 rounded border font-bold uppercase transition-colors ${showHistory ? 'bg-indigo-900 text-indigo-200 border-indigo-500' : 'bg-gray-800 text-gray-500 border-gray-600'}`}
                    >
                        STORICO ({history.length})
                    </button>
                    <button 
                        onClick={onClear}
                        disabled={!content}
                        className="text-[9px] bg-red-900/30 hover:bg-red-800/50 text-red-300 border border-red-800 px-3 py-1 rounded font-mono uppercase disabled:opacity-30"
                        title="Strappa pagina e archivia"
                    >
                        ✁ STRAPPA PAGINA
                    </button>
                </div>
            </div>

            {/* AREA DI SCRITTURA (FOGLIO DIGITALE) */}
            <div className="relative bg-[#0a0a0a] rounded border border-gray-800 min-h-[150px] max-h-[300px] overflow-hidden flex flex-col font-mono text-xs shadow-inner">
                
                {showHistory ? (
                    <div className="absolute inset-0 bg-[#0f1219] z-20 overflow-y-auto p-4 space-y-4">
                        {history.length === 0 && <div className="text-gray-600 text-center mt-10">ARCHIVIO VUOTO</div>}
                        {history.map((page) => (
                            <div key={page.id} className="bg-black border border-gray-800 p-3 rounded opacity-80 hover:opacity-100 transition-opacity">
                                <div className="text-[8px] text-gray-500 mb-1 border-b border-gray-900 pb-1 flex justify-between">
                                    <span>ID: {page.id}</span>
                                    <span>{new Date(page.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">{page.content}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap leading-relaxed text-cyan-50 relative">
                        {/* Cursore Lampeggiante */}
                        {content}
                        <span className="inline-block w-2 h-4 bg-cyan-500 ml-1 align-middle animate-pulse"></span>
                    </div>
                )}

                {/* Status Bar della tastiera */}
                <div className="bg-gray-900 border-t border-gray-800 px-2 py-1 flex justify-between items-center text-[8px] text-gray-500">
                    <span>CHARS: {content.length}</span>
                    <span className={isActive ? "text-green-500" : "text-red-500"}>
                        {isActive ? "● MOTOR_LINK_ESTABLISHED" : "○ CONNECTION_LOST"}
                    </span>
                </div>
            </div>

            {/* INPUT UTENTE NELL'AREA EXNER */}
            <form onSubmit={handleSend} className="flex gap-2">
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Scrivi qui per interagire con Exner..."
                    disabled={!isActive}
                    className="flex-1 bg-black/50 border border-gray-700 rounded px-2 py-1.5 text-[10px] text-cyan-200 font-mono focus:border-cyan-500 focus:outline-none placeholder-gray-700"
                />
                <button 
                    type="submit" 
                    disabled={!inputText.trim() || !isActive}
                    className="bg-cyan-900/40 hover:bg-cyan-800 text-cyan-400 border border-cyan-800 px-3 rounded text-[10px] font-bold uppercase disabled:opacity-30"
                >
                    INVIA
                </button>
            </form>
            
            <div className="text-[8px] text-gray-600 font-mono text-center">
                La rete digita volontariamente usando l'Area di Exner (Lobo Frontale).
            </div>
        </div>
    );
};

export default TypewriterSystem;