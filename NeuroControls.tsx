
import React from 'react';
import { Neurotransmitters } from '../types';

interface NeuroControlsProps {
  values: Neurotransmitters;
  onChange: (key: keyof Neurotransmitters, value: number) => void;
  onFlush: () => void;
  onNormalize?: () => void;
  isMedicalStasis?: boolean;
}

const ChemicalSlider: React.FC<{
  label: string;
  value: number;
  color: string;
  desc: string;
  onChange: (val: number) => void;
  disabled?: boolean;
}> = ({ label, value, color, desc, onChange, disabled }) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1">
      <span className={`text-sm font-bold ${color}`}>{label}</span>
      <span className="text-xs text-gray-400">{value.toFixed(1)}%</span>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${disabled ? 'bg-gray-800 accent-gray-600' : 'bg-gray-700 accent-bio-accent'}`}
    />
    <p className="text-[10px] text-gray-500 mt-1">{desc}</p>
  </div>
);

const NeuroControls: React.FC<NeuroControlsProps> = ({ values, onChange, onFlush, onNormalize, isMedicalStasis }) => {
  return (
    <div className={`bg-bio-panel p-4 rounded-lg border w-full transition-all duration-500 ${isMedicalStasis ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : 'border-gray-700'}`}>
      <h3 className="text-lg font-mono text-white mb-4 border-b border-gray-600 pb-2 flex justify-between items-center">
        <span>SISTEMA ENDOCRINO</span>
        {isMedicalStasis && <span className="text-[10px] bg-green-900 text-green-300 px-2 py-1 rounded animate-pulse">MEDICAL STASIS ACTIVE</span>}
      </h3>
      
      <ChemicalSlider 
        label="DOPAMINA" 
        value={values.dopamine} 
        color="text-yellow-400"
        desc="Sistema di ricompensa e apprendimento. Troppo alta causa instabilità."
        onChange={(v) => onChange('dopamine', v)}
        disabled={isMedicalStasis}
      />
      
      <ChemicalSlider 
        label="SEROTONINA" 
        value={values.serotonin} 
        color="text-blue-400"
        desc="Regolazione dell'umore e stabilità. Bassa causa depressione simulata."
        onChange={(v) => onChange('serotonin', v)}
        disabled={isMedicalStasis}
      />
      
      <ChemicalSlider 
        label="ADRENALINA" 
        value={values.adrenaline} 
        color="text-red-500"
        desc="Risposta fight-or-flight. Velocità di reazione."
        onChange={(v) => onChange('adrenaline', v)}
        disabled={isMedicalStasis}
      />

      <ChemicalSlider 
        label="ACETILCOLINA" 
        value={values.acetylcholine} 
        color="text-green-400"
        desc="Plasticità e formazione della memoria."
        onChange={(v) => onChange('acetylcholine', v)}
        disabled={isMedicalStasis}
      />

      <ChemicalSlider 
        label="CORTISOLO" 
        value={values.cortisol} 
        color="text-gray-400"
        desc="Livello di stress. Alto rischio di catastrofe cognitiva."
        onChange={(v) => onChange('cortisol', v)}
        disabled={isMedicalStasis}
      />

      <div className="mt-8 pt-4 border-t border-gray-600 grid grid-cols-2 gap-3">
        {onNormalize && (
            <button 
            onClick={onNormalize}
            disabled={isMedicalStasis}
            className="w-full py-2 bg-green-900/50 hover:bg-green-800 text-green-200 border border-green-700 rounded text-xs font-mono tracking-widest transition-colors uppercase disabled:opacity-50"
            >
            ⚕ NORMALIZZA (STABILIZZA)
            </button>
        )}

        <button 
          onClick={onFlush}
          className="w-full py-2 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-700 rounded text-xs font-mono tracking-widest transition-colors uppercase"
        >
          ⚠ EMERGENCY FLUSH
        </button>
      </div>
      <p className="text-[10px] text-gray-500/70 mt-2 text-center">
          Normalizza: Blocca i livelli per 10s. Flush: Reset a zero (Shock).
      </p>
    </div>
  );
};

export default NeuroControls;
