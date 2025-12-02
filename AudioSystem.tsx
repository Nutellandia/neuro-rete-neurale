

/**
 * SISTEMA UDITIVO (AUDIO SYSTEM)
 * ==============================
 * Autore: Emilio Frascogna
 * 
 * Gestisce l'acquisizione audio tramite microfono o file.
 * Utilizza Web Audio API per l'analisi FFT (Fast Fourier Transform),
 * convertendo il suono in dati di frequenza comprensibili per la rete.
 * Include funzionalità di registrazione e playback per l'addestramento vocale.
 */

import React, { useRef, useState, useEffect } from 'react';
import { LifeStage, DeviceInfo } from '../types';

interface AudioSystemProps {
  onCapture: (level: string, intensity: number, rawData?: Blob, type?: 'audio' | 'training_audio') => void;
  onDevicesFound?: (devices: DeviceInfo[]) => void;
  onRealtimeUpdate?: (volume: number, frequencies: Uint8Array) => void; 
  isActive: boolean;
  stage: LifeStage;
}

const AudioSystem: React.FC<AudioSystemProps> = ({ onCapture, onDevicesFound, onRealtimeUpdate, isActive, stage }) => {
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [monitorOn, setMonitorOn] = useState(true); // Se l'utente può sentire l'output
  const [volume, setVolume] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  
  // Riferimenti Grafo Audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null); 
  const storedAudioBufferRef = useRef<AudioBuffer | null>(null);

  const isListeningRef = useRef(false); 
  const rafId = useRef<number>(0);
  const lastTriggerTime = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameCountRef = useRef(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Riferimenti Registratore
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Callback Refs (Per evitare chiusure stale nel loop audio)
  const uploadedFileRef = useRef<string | null>(null);
  const stageRef = useRef<LifeStage>(stage);
  const hasCheckedDevicesRef = useRef(false);
  const onCaptureRef = useRef(onCapture);
  const onRealtimeUpdateRef = useRef(onRealtimeUpdate);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { uploadedFileRef.current = uploadedFile; }, [uploadedFile]);
  useEffect(() => { onCaptureRef.current = onCapture; }, [onCapture]);
  useEffect(() => { onRealtimeUpdateRef.current = onRealtimeUpdate; }, [onRealtimeUpdate]);

  // Aggiornamento dinamico del monitor
  useEffect(() => {
      if (monitorGainRef.current && audioContextRef.current) {
          const t = audioContextRef.current.currentTime;
          monitorGainRef.current.gain.setTargetAtTime(monitorOn ? 1.0 : 0.0, t, 0.1);
      }
  }, [monitorOn]);

  // Calcolo capacità uditive biologiche
  const getHearingCapabilities = (currentStage: LifeStage) => {
     switch (currentStage) {
         case LifeStage.PROGENITORE:
             return { sensitivity: 0.5, maxFreq: 'Low-Pass', label: 'PRESSIONE SONORA (Basale)' };
         case LifeStage.GANGLIO:
             return { sensitivity: 0.8, maxFreq: 'Mid-Range', label: 'UDITO GREZZO' };
         default:
             return { sensitivity: 1.2, maxFreq: 'Full Spectrum', label: 'COCLEA AVANZATA (FFT)' };
     }
  };

  const bioCaps = getHearingCapabilities(stage);

  // Rilevamento hardware audio
  useEffect(() => {
    const checkAudioDevices = async () => {
        if (hasCheckedDevicesRef.current && !isActive) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            if (onDevicesFound) {
                const deviceList: DeviceInfo[] = audioInputs.map(d => ({
                    id: d.deviceId,
                    label: d.label || `Microfono #${audioInputs.indexOf(d) + 1}`,
                    type: 'audio'
                }));
                onDevicesFound(deviceList);
                hasCheckedDevicesRef.current = true;
            }
        } catch(e) {
            console.warn("Audio Device Scan Failed", e);
        }
    };
    if (isActive) checkAudioDevices();
  }, [isActive, onDevicesFound]);

  useEffect(() => {
    return () => { stopListening(); };
  }, []);

  const ensureAudioContext = async () => {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
      }
      if (audioContextRef.current.state === 'suspended') {
          try {
              await audioContextRef.current.resume();
          } catch(e) {
              console.warn("Audio Context resume failed", e);
          }
      }
      if (!analyserRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 64; 
          analyserRef.current.smoothingTimeConstant = 0.5;
          dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      }
      if (!monitorGainRef.current) {
          monitorGainRef.current = audioContextRef.current.createGain();
          monitorGainRef.current.connect(audioContextRef.current.destination);
          monitorGainRef.current.gain.value = monitorOn ? 1.0 : 0.0;
      }
      return audioContextRef.current;
  };

  const decodeAndStoreAudio = async (arrayBuffer: ArrayBuffer) => {
      const ctx = await ensureAudioContext();
      try {
          const bufferCopy = arrayBuffer.slice(0); 
          const decodedBuffer = await ctx.decodeAudioData(bufferCopy);
          storedAudioBufferRef.current = decodedBuffer;
          return true;
      } catch (e) {
          console.error("Decoding failed", e);
          return false;
      }
  };

  const startListening = async () => {
    const ctx = await ensureAudioContext();

    // 1. SCENARIO: MEMORIA (PLAYBACK LOOP)
    if (uploadedFileRef.current && storedAudioBufferRef.current) {
        if (playbackSourceRef.current) {
            try { playbackSourceRef.current.stop(); } catch(e){}
            playbackSourceRef.current.disconnect();
        }

        const source = ctx.createBufferSource();
        source.buffer = storedAudioBufferRef.current;
        source.loop = true;
        
        // PERCORSO A: Alla Rete (Analizzatore)
        source.connect(analyserRef.current!);
        
        // PERCORSO B: All'utente (Monitor)
        source.connect(monitorGainRef.current!);
        
        source.start(0);
        playbackSourceRef.current = source;
        
        setListening(true);
        isListeningRef.current = true;
        analyzeLoop();
        return;
    }

    // 2. SCENARIO: MICROFONO LIVE
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionError(false); // Success, clear error
      
      sourceRef.current = ctx.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current!);
      // sourceRef.current.connect(monitorGainRef.current!); // Decommentare per sentire microfono
      
      setListening(true);
      isListeningRef.current = true;
      
      analyzeLoop();

    } catch (err) {
      console.error("Audio Access Denied:", err);
      setPermissionError(true);
    }
  };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
                            ? "audio/webm;codecs=opus" 
                            : "audio/webm";
                            
          const recorder = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = recorder;
          chunksRef.current = [];

          recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunksRef.current.push(e.data);
          };

          recorder.onstop = async () => {
              const blob = new Blob(chunksRef.current, { type: mimeType });
              
              if (blob.size < 100) return;

              onCaptureRef.current(`REGISTRAZIONE VOCALE [${(blob.size/1024).toFixed(1)}KB]`, 1.0, blob, 'training_audio');
              
              try {
                  const arrayBuffer = await blob.arrayBuffer();
                  const success = await decodeAndStoreAudio(arrayBuffer);
                  
                  if (success) {
                      const filename = "MODELLO_VOCALE_REC.wav";
                      setUploadedFile(filename);
                      uploadedFileRef.current = filename;

                      stopListening(); 
                      setListening(true);
                      isListeningRef.current = true;
                      startListening(); 
                  }
              } catch(e) {
                  console.error("Recording processing failed", e);
              }
              
              recorder.stream.getTracks().forEach(t => t.stop());
          };

          recorder.start();
          setRecording(true);
          
          if (!listening) {
             const ctx = await ensureAudioContext();
             sourceRef.current = ctx.createMediaStreamSource(stream);
             sourceRef.current.connect(analyserRef.current!);
             setListening(true);
             isListeningRef.current = true;
             analyzeLoop();
          }

      } catch (e) {
          console.error("Recording init failed", e);
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && recording) {
          mediaRecorderRef.current.stop();
          setRecording(false);
      }
  };

  const stopListening = () => {
    if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch(e) {}
        sourceRef.current = null;
    }
    if (playbackSourceRef.current) {
        try { playbackSourceRef.current.stop(); } catch(e) {}
        try { playbackSourceRef.current.disconnect(); } catch(e) {}
        playbackSourceRef.current = null;
    }
    
    if (rafId.current) cancelAnimationFrame(rafId.current);
    setListening(false);
    isListeningRef.current = false;
    setVolume(0);
    // IMPORTANTE: Resetta la visualizzazione
    if(onRealtimeUpdateRef.current) onRealtimeUpdateRef.current(0, new Uint8Array(32));
  };

  // LOOP DI ANALISI FFT
  const analyzeLoop = () => {
    if (!isListeningRef.current || !analyserRef.current || !dataArrayRef.current) return;

    const currentBioCaps = getHearingCapabilities(stageRef.current);
    const now = Date.now();
    
    const dataArray = dataArrayRef.current;
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const processedAvg = sum / dataArray.length;

    // Invia dati al visualizzatore dell'apparato fonatorio
    if (onRealtimeUpdateRef.current) {
        onRealtimeUpdateRef.current(processedAvg * 3, dataArray);
    }

    frameCountRef.current++;
    if (frameCountRef.current % 3 === 0) { // Throttle UI
        setVolume(Math.min(255, processedAvg * currentBioCaps.sensitivity * 2.5));
    }

    const threshold = 5 / currentBioCaps.sensitivity; 
    
    if (uploadedFileRef.current && now - lastTriggerTime.current > 3000) {
         onCaptureRef.current(`LOOP MEMORIA UDITIVA: ${uploadedFileRef.current}`, 0.9, undefined, 'training_audio');
         lastTriggerTime.current = now;
    } 
    else if (!uploadedFileRef.current && !recording && processedAvg > threshold && now - lastTriggerTime.current > 1500) {
        // TABULA RASA: No human concepts ("Parlato", "Rumore"). Only Signal Data.
        let descriptor = "[SIGNAL: NULL]";
        if (processedAvg > 120) descriptor = "[SIGNAL: AUDIO_HIGH_AMPLITUDE]";
        else if (processedAvg > 60) descriptor = "[SIGNAL: AUDIO_MID_AMPLITUDE]";
        else if (processedAvg > 10) descriptor = "[SIGNAL: AUDIO_LOW_AMPLITUDE]";
        
        onCaptureRef.current(descriptor, (processedAvg / 255) * currentBioCaps.sensitivity, undefined, 'audio');
        lastTriggerTime.current = now;
    }

    rafId.current = requestAnimationFrame(analyzeLoop);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          stopListening();
          const reader = new FileReader();
          reader.onload = async (ev) => {
              if(ev.target?.result) {
                  const success = await decodeAndStoreAudio(ev.target.result as ArrayBuffer);
                  if (success) {
                      setUploadedFile(file.name);
                      uploadedFileRef.current = file.name;
                      onCaptureRef.current(`FILE AUDIO: ${file.name}`, 1.0, undefined, 'training_audio');
                      setTimeout(() => { startListening(); }, 100);
                  }
              }
          };
          reader.readAsArrayBuffer(file);
      }
      e.target.value = '';
  };

  const ejectFile = () => {
      stopListening(); 
      setUploadedFile(null);
      uploadedFileRef.current = null;
      storedAudioBufferRef.current = null;
      setVolume(0);
      onCaptureRef.current("FILE RIMOSSO", 0, undefined, 'audio');
      if(onRealtimeUpdateRef.current) onRealtimeUpdateRef.current(0, new Uint8Array(32));
  };

  return (
    <div className="bg-bio-panel p-4 rounded-xl border-2 border-gray-600 mt-6 shadow-2xl relative overflow-hidden flex flex-col gap-4 flex-shrink-0 min-h-[250px]">
      
      <div className="flex items-center gap-4 border-b border-gray-700 pb-2 justify-between">
        <div className="flex items-center gap-4">
            <div className={`w-5 h-5 rounded-full border-2 border-black transition-colors duration-300 ${listening ? (recording ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-green-400 shadow-[0_0_10px_#4ade80]') : 'bg-gray-600'}`} />
            <div className="flex flex-col">
                <span className={`text-lg md:text-xl font-bold font-mono tracking-widest ${listening ? 'text-white' : 'text-gray-400'}`}>
                    {uploadedFile ? "PLAYER / MEMORIA" : (recording ? "REGISTRAZIONE..." : "UDITO")}
                </span>
                <span className="text-[9px] text-orange-400 font-mono border border-orange-900 px-1 rounded bg-orange-900/20 w-max">
                    {bioCaps.label}
                </span>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            {/* MONITOR SWITCH */}
            {(uploadedFile || listening) && (
                <button 
                    onClick={() => setMonitorOn(!monitorOn)}
                    className={`text-[9px] px-2 py-1 rounded border font-bold uppercase transition-colors flex items-center gap-1 ${monitorOn ? 'bg-green-900/40 text-green-300 border-green-600' : 'bg-gray-800 text-gray-500 border-gray-600'}`}
                    title="Ascolta output audio (Monitor)"
                >
                    {monitorOn ? "🔊 MON: ON" : "🔇 MON: OFF"}
                </button>
            )}

            {uploadedFile ? (
                <button onClick={ejectFile} className="text-[10px] bg-red-900/50 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded border border-red-700 font-mono uppercase flex items-center gap-1">
                    <span>⏏</span> EJECT
                </button>
            ) : (
                <div className="flex gap-2">
                     <button onClick={() => fileInputRef.current?.click()} className="text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded border border-gray-500 font-mono uppercase">📂 FILE</button>
                     <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
                </div>
            )}
        </div>
      </div>

      {/* VISUALIZZATORE LIVELLO AUDIO */}
      <div className="h-20 bg-black rounded-xl border-4 border-gray-700 overflow-hidden relative shadow-inner shrink-0">
        {permissionError && (
            <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center text-center p-2">
                <div className="text-red-500 text-lg mb-1">🎤🚫</div>
                <div className="text-red-400 font-bold text-xs mb-1">ACCESSO MICROFONO NEGATO</div>
                <button onClick={() => setPermissionError(false)} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white text-[9px] rounded border border-gray-600 uppercase font-mono">
                    CHIUDI
                </button>
            </div>
        )}

        {!listening && volume === 0 && !permissionError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#151515]">
                <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(45deg, #aaa 0, #aaa 2px, transparent 2px, transparent 20px)'}} />
                <span className="relative z-10 text-xs md:text-sm font-mono text-gray-400 font-bold bg-gray-900 px-3 py-1 border border-gray-600 rounded shadow-lg uppercase tracking-wider">
                    {uploadedFile ? "MODELLO PRONTO" : "// DISATTIVATO //"}
                </span>
            </div>
        )}

        {(listening || volume > 0) && (
            <>
                <div className="absolute inset-0 bg-gray-900 w-full h-full" />
                <div 
                    className={`h-full bg-fuchsia-500 transition-all duration-75 ease-linear shadow-[0_0_30px_rgba(192,38,211,0.8)] border-r-4 border-white`}
                    style={{ width: `${Math.max(2, (volume / 255) * 100)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                    <span className="text-xs font-mono font-bold text-white drop-shadow-md bg-black/40 px-2 py-1 rounded truncate max-w-[60%]">
                        {recording ? "● REC" : (uploadedFile ? `∞ ${uploadedFile}` : "LIVE MIC")}
                    </span>
                    <span className="text-base font-mono font-bold text-white drop-shadow-md bg-black/40 px-2 py-1 rounded">
                        {Math.round((volume / 255) * 100)}%
                    </span>
                </div>
            </>
        )}
      </div>
      
      <div className="flex gap-2">
          <button 
            onClick={listening ? stopListening : startListening}
            disabled={recording}
            className={`flex-1 py-4 rounded-xl font-bold font-mono text-sm tracking-widest uppercase transition-all shadow-lg border-b-4 ${
                listening 
                ? 'bg-gray-600 text-white border-gray-800 hover:bg-gray-500' 
                : 'bg-yellow-400 text-black border-yellow-600 hover:bg-yellow-300'
            } disabled:opacity-50`}
          >
            {listening ? "SPEGNI" : "ACCENDI"}
          </button>
          
          {!uploadedFile && (
              <button 
                 onClick={recording ? stopRecording : startRecording}
                 className={`flex-1 py-4 rounded-xl font-bold font-mono text-sm tracking-widest uppercase transition-all shadow-lg border-b-4 flex items-center justify-center gap-2 ${
                     recording 
                     ? 'bg-red-600 text-white border-red-800 animate-pulse' 
                     : 'bg-red-900/30 text-red-400 border-red-800 hover:bg-red-900/50'
                 }`}
              >
                  {recording ? (
                      <><span>⬛</span> STOP REC</>
                  ) : (
                      <><span>●</span> INSEGNA (REC)</>
                  )}
              </button>
          )}
      </div>
    </div>
  );
};

export default AudioSystem;