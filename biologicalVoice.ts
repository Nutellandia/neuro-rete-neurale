
/**
 * SISTEMA DI SINTESI VOCALE BIOLOGICA
 * ===================================
 * Autore: Emilio Frascogna
 * 
 * Questo modulo implementa un modello fisico del tratto vocale umano
 * utilizzando la Web Audio API. Non riproduce campioni pre-registrati,
 * ma sintetizza il suono in tempo reale modulando frequenze e filtri.
 * 
 * Modello Sorgente-Filtro:
 * 1. SORGENTE: Oscillatore (Corde Vocali) + Rumore Bianco (Turbolenza)
 * 2. FILTRO: Biquad Filters (Risuonatori F1/F2 simulanti bocca e lingua)
 */

import { VocalParams, LifeStage } from "../types";

// Classificazione Fonetica per Inviluppi ADSR (Generazione dinamica)
type PhonemeType = 'VOWEL' | 'NASAL' | 'FRICATIVE' | 'PLOSIVE' | 'SILENCE' | 'UNDEFINED';

// TABULA RASA: Nessuna lettera precodificata.
// Il motore deve sintetizzare il suono puramente dai parametri muscolari grezzi.

class BiologicalVoiceSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  // Nodi di Sintesi Continua
  private osc: OscillatorNode | null = null; // Sorgente Tonale (Laringe)
  private noise: AudioBufferSourceNode | null = null; // Sorgente Rumore (Soffio)
  private filter1: BiquadFilterNode | null = null; // Formante F1 (Apertura Mascella)
  private filter2: BiquadFilterNode | null = null; // Formante F2 (Posizione Lingua)
  private noiseFilter: BiquadFilterNode | null = null; // Filtro Consonantico
  
  private voiceGain: GainNode | null = null; // Volume Voce
  private noiseGain: GainNode | null = null; // Volume Soffio

  private isSpeaking: boolean = false;
  private isMuted: boolean = false;

  constructor() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      // Analizzatore FFT per feedback visivo (Oscilloscopio)
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256; // Aumentato per migliore risoluzione visiva
      this.analyser.smoothingTimeConstant = 0.5;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4; 

      // CORREZIONE ROUTING GRAFO AUDIO
      // Vecchio: Output -> MasterGain -> Analyser -> Speaker (Il Mute uccideva il grafico)
      // Nuovo: Output -> Analyser -> MasterGain -> Speaker (Il grafico vive anche col Mute)
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      
    } catch (e) {
      console.error("WebAudio not supported");
    }
  }

  // Ottiene i dati in frequenza per la visualizzazione dell'onda sonora emessa
  public getOutputFrequencyData(): Uint8Array {
      if (!this.analyser) return new Uint8Array(32);
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);
      return data;
  }

  public setMute(muted: boolean) {
      this.isMuted = muted;
      if (this.masterGain && this.ctx) {
          const t = this.ctx.currentTime;
          this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.4, t, 0.1);
      }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.warn("Audio Context Resume Failed", e));
    }
  }

  /**
   * Metodo Core per la Sintesi Continua (Modalità Agency)
   * Riceve i parametri muscolari dal cervello e aggiorna i filtri in tempo reale.
   */
  public updateParams(params: VocalParams) {
      if (!this.ctx) return;
      
      // Assicura che il contesto sia attivo se c'è flusso d'aria
      if (params.airflow > 0.01) this.resume();

      if (!this.isSpeaking) {
           // Soglia bassa per permettere sussurri e respiro
           if(params.airflow > 0.01) this.startContinuous(); 
           return;
      }
      
      const t = this.ctx.currentTime;
      const ramp = 0.1; // Tempo di transizione muscolare (inerzia)

      // Pitch (Tensione Corde Vocali)
      const freq = 80 + (params.tension * 400); // 80Hz - 480Hz range umano
      this.osc?.frequency.setTargetAtTime(freq, t, ramp);

      // Formanti (Qualità Vocale)
      // F1 controllata dalla mascella (Bocca aperta = F1 alto = "A")
      const f1 = 200 + (params.jawOpenness * 800);
      // F2 controllata dalla lingua (Lingua avanti = F2 alto = "I")
      const f2 = 800 + (params.tonguePosition * 2500);
      
      this.filter1?.frequency.setTargetAtTime(f1, t, ramp);
      this.filter2?.frequency.setTargetAtTime(f2, t, ramp);

      // Consonanti (Rumore basato sulla costrizione)
      // Se la lingua è agli estremi, crea turbolenza
      const turbulence = Math.abs(params.tonguePosition - 0.5) * 2; 
      // Se la bocca è chiusa, il rumore aumenta (Fricativa)
      const occlusion = 1.0 - params.jawOpenness; 
      
      const noiseMix = (turbulence * 0.3) + (occlusion * 0.5);
      
      // Il filtro rumore segue la lingua
      this.noiseFilter?.frequency.setTargetAtTime(1000 + (params.tonguePosition * 4000), t, ramp);

      // Gate Volume (Polmoni)
      this.voiceGain?.gain.setTargetAtTime(params.airflow * (1 - noiseMix), t, ramp);
      this.noiseGain?.gain.setTargetAtTime(params.airflow * noiseMix * 0.5, t, ramp); 
  }

  public startContinuous() {
      if(!this.ctx || this.isSpeaking) return;
      this.resume();
      this.isSpeaking = true;
      const t = this.ctx.currentTime;
      this.setupNodes(t);
      // Fade in morbido
      this.voiceGain!.gain.setValueAtTime(0, t);
      this.voiceGain!.gain.linearRampToValueAtTime(0.5, t + 0.2);
  }

  public stopContinuous() {
      if(!this.ctx || !this.isSpeaking) return;
      const t = this.ctx.currentTime;
      this.voiceGain?.gain.setTargetAtTime(0, t, 0.2);
      this.noiseGain?.gain.setTargetAtTime(0, t, 0.2);
      setTimeout(() => {
          this.osc?.stop();
          this.noise?.stop();
          this.isSpeaking = false;
      }, 300);
  }

  // ARTICOLAZIONE GENERATIVA (Babbling / Lallazione)
  // Usata per produrre suoni randomici negli stadi primitivi
  public async speak(text: string, stage: LifeStage) {
      if (!this.ctx) return;
      this.resume();

      if(this.isSpeaking) {
          this.osc?.stop();
          this.noise?.stop();
      }

      const t = this.ctx.currentTime;
      this.setupNodes(t);
      this.isSpeaking = true;
      
      const impulses = Math.max(1, text.length / 2);
      let currentTime = t + 0.05;

      this.voiceGain!.gain.setValueAtTime(0, t);
      this.noiseGain!.gain.setValueAtTime(0, t);

      for(let i=0; i<impulses; i++) {
          const tension = Math.random();
          const jaw = Math.random();
          const tongue = Math.random();
          const airflow = 0.5 + Math.random() * 0.5;
          const isNoisy = Math.random() > 0.6; 
          
          const f1 = 200 + (jaw * 800);
          const f2 = 800 + (tongue * 2000);
          const pitch = 100 + (tension * 150);
          const duration = 0.1 + (Math.random() * 0.2); 

          this.filter1!.frequency.exponentialRampToValueAtTime(f1, currentTime + 0.05);
          this.filter2!.frequency.exponentialRampToValueAtTime(f2, currentTime + 0.05);
          
          if (!isNoisy) {
            this.osc!.frequency.linearRampToValueAtTime(pitch, currentTime);
          }

          if (isNoisy) {
              this.voiceGain!.gain.setValueAtTime(0, currentTime);
              this.noiseGain!.gain.linearRampToValueAtTime(airflow * 0.4, currentTime + 0.05);
              this.noiseGain!.gain.linearRampToValueAtTime(0, currentTime + duration);
              this.noiseFilter!.frequency.setValueAtTime(1000 + (tongue * 3000), currentTime);
          } else {
              this.voiceGain!.gain.linearRampToValueAtTime(airflow, currentTime + (duration * 0.2));
              this.voiceGain!.gain.setValueAtTime(airflow, currentTime + (duration * 0.7));
              this.voiceGain!.gain.linearRampToValueAtTime(0.1, currentTime + duration);
              this.noiseGain!.gain.linearRampToValueAtTime(0, currentTime);
          }

          currentTime += duration;
          if (Math.random() > 0.8) {
              this.voiceGain!.gain.setTargetAtTime(0, currentTime, 0.01);
              currentTime += 0.05;
          }
      }

      this.voiceGain!.gain.linearRampToValueAtTime(0, currentTime + 0.1);
      this.noiseGain!.gain.linearRampToValueAtTime(0, currentTime + 0.1);
      
      this.osc!.stop(currentTime + 0.2);
      this.noise!.stop(currentTime + 0.2);
      
      setTimeout(() => { this.isSpeaking = false; }, (currentTime - t) * 1000 + 300);
  }

  // Configurazione del grafo audio
  private setupNodes(startTime: number) {
      if(!this.ctx) return;

      this.osc = this.ctx.createOscillator();
      this.osc.type = 'sawtooth'; // Onda ricca di armoniche (simile alla voce)
      this.osc.frequency.setValueAtTime(120, startTime);

      // Generatore Rumore Bianco (per consonanti)
      const bufferSize = this.ctx.sampleRate * 2; 
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      this.noise = this.ctx.createBufferSource();
      this.noise.buffer = buffer;
      this.noise.loop = true;

      // Filtri Formanti (Risonatori)
      this.filter1 = this.ctx.createBiquadFilter();
      this.filter1.type = 'bandpass';
      this.filter1.Q.value = 4; 

      this.filter2 = this.ctx.createBiquadFilter();
      this.filter2.type = 'bandpass';
      this.filter2.Q.value = 6;
      
      this.noiseFilter = this.ctx.createBiquadFilter();
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.Q.value = 1;

      this.voiceGain = this.ctx.createGain();
      this.noiseGain = this.ctx.createGain();

      // Routing del Segnale
      this.osc.connect(this.filter1);
      this.filter1.connect(this.filter2);
      this.filter2.connect(this.voiceGain);

      this.noise.connect(this.noiseFilter);
      this.noiseFilter.connect(this.noiseGain);

      // UPDATE ROUTING: Connetti i suoni all'Analizzatore PRIMA che al Master (così vedi il grafico anche in Mute)
      this.voiceGain.connect(this.analyser!);
      this.noiseGain.connect(this.analyser!);

      this.osc.start(startTime);
      this.noise.start(startTime);
  }
}

export const biologicalVoice = new BiologicalVoiceSystem();
