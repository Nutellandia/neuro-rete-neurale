import { VocalParams } from "@/types";
class BiologicalVoiceSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isSpeaking: boolean = false;

  constructor() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctx();
      this.analyser = this.ctx.createAnalyser();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4; 
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {}
  }

  public getOutputFrequencyData(): Uint8Array {
      if (!this.analyser) return new Uint8Array(32);
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);
      return data;
  }
  public setMute(muted: boolean) {
      if (this.masterGain && this.ctx) this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.4, this.ctx.currentTime, 0.1);
  }
  public updateParams(params: VocalParams) {}
  public startContinuous() {}
  public stopContinuous() {}
}
export const biologicalVoice = new BiologicalVoiceSystem();