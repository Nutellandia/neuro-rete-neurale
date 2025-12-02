
import React, { useEffect, useState, useRef } from 'react';

interface MotionSystemProps {
  onCapture: (description: string, intensity: number, metadata?: any) => void;
  isActive: boolean;
  onConnect?: () => void;
}

const MotionSystem: React.FC<MotionSystemProps> = ({ onCapture, isActive, onConnect }) => {
  const [active, setActive] = useState(false);
  const [isSoothing, setIsSoothing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>("STANDBY");
  const [motionData, setMotionData] = useState({ x: 0, y: 0, z: 0 });
  const [rotationData, setRotationData] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const lastTriggerTime = useRef<number>(0);
  const sootheIntervalRef = useRef<number | null>(null);

  // iOS 13+ richiede permessi espliciti tramite interazione utente
  const requestPermission = async () => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
        setPermissionStatus("HTTPS REQUIRED");
        alert("I sensori richiedono una connessione sicura (HTTPS) o localhost.");
        return;
    }

    const reqMotion = (DeviceMotionEvent as any).requestPermission;
    const reqOrient = (DeviceOrientationEvent as any).requestPermission;
    const isIOS = typeof reqMotion === 'function' || typeof reqOrient === 'function';

    if (isIOS) {
      setPermissionStatus("REQUESTING...");
      try {
        let motionGranted = 'granted';
        let orientGranted = 'granted';

        if (typeof reqMotion === 'function') motionGranted = await reqMotion();
        if (typeof reqOrient === 'function') orientGranted = await reqOrient();

        if (motionGranted === 'granted' || orientGranted === 'granted') {
          setPermissionStatus("GRANTED");
          startSensors();
        } else {
          setPermissionStatus("DENIED");
          alert("Permesso negato. Controlla le impostazioni privacy di Safari.");
        }
      } catch (e: any) {
        console.error(e);
        setPermissionStatus("ERROR: " + (e.message || e));
        startSensors();
      }
    } else {
      setPermissionStatus("AUTO-START");
      startSensors();
    }
  };

  const startSensors = () => {
    if (!window.DeviceMotionEvent && !window.DeviceOrientationEvent) {
        setPermissionStatus("NO_HARDWARE");
        return;
    }
    
    window.removeEventListener('devicemotion', handleMotion);
    window.removeEventListener('deviceorientation', handleOrientation);

    if (window.DeviceMotionEvent) window.addEventListener('devicemotion', handleMotion);
    if (window.DeviceOrientationEvent) window.addEventListener('deviceorientation', handleOrientation);
    
    setActive(true);
    setPermissionStatus("WAITING DATA...");
    if(onConnect) onConnect();
  };

  const stopSensors = () => {
    window.removeEventListener('devicemotion', handleMotion);
    window.removeEventListener('deviceorientation', handleOrientation);
    setActive(false);
    setPermissionStatus("STOPPED");
  };

  const handleOrientation = (event: DeviceOrientationEvent) => {
      const alpha = event.alpha || 0; // Z axis rotation (Compass)
      const beta = event.beta || 0;   // X axis rotation (Tilt Front/Back)
      const gamma = event.gamma || 0; // Y axis rotation (Tilt Left/Right)
      
      setRotationData({ alpha, beta, gamma });

      const now = Date.now();
      if (now - lastTriggerTime.current > 500) {
          const rotationIntensity = (Math.abs(beta) + Math.abs(gamma)) / 180;
          if (rotationIntensity > 0.3) {
               // Segnale Giroscopico Puro (Canali Semicircolari)
               onCapture("[SIGNAL: VESTIBULAR_ROTATION]", rotationIntensity * 0.5, {
                   sensor: 'GYROSCOPE',
                   axis: { alpha, beta, gamma }
               });
               lastTriggerTime.current = now;
          }
      }
  };

  const handleMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return; else setPermissionStatus("RECEIVING");
    
    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;

    setMotionData({ x, y, z });

    const totalAccel = Math.sqrt(x*x + y*y + z*z);
    const now = Date.now();
    
    // Z include gravità (~9.8).
    if (totalAccel > 25 && now - lastTriggerTime.current > 1000) {
        // Segnale Accelerometro Puro (Otoliti)
        onCapture("[SIGNAL: VESTIBULAR_IMPACT]", Math.min(1, totalAccel / 60), {
            sensor: 'ACCELEROMETER',
            force: totalAccel
        });
        lastTriggerTime.current = now;
    } 
  };

  const simulateShake = () => {
      if (isSoothing) toggleSoothe();
      
      // Simula Caos su entrambi i sensori
      // 1. Accelerometro (Scossoni lineari)
      const shockX = (Math.random() * 40) - 20;
      const shockY = (Math.random() * 40) - 20;
      const shockZ = (Math.random() * 40); // Solo positivi forti + gravità
      
      // 2. Giroscopio (Disorientamento rotazionale)
      const rotAlpha = Math.random() * 360;
      const rotBeta = (Math.random() * 180) - 90;
      const rotGamma = (Math.random() * 180) - 90;

      setMotionData({ x: shockX, y: shockY, z: shockZ });
      setRotationData({ alpha: rotAlpha, beta: rotBeta, gamma: rotGamma });

      onCapture("[SIGNAL: VESTIBULAR_TRAUMA_COMPLEX]", 0.95, {
          sensor: 'MULTISENSORY_CONFLICT',
          desc: 'High G-Force + Rapid Rotation'
      });

      setTimeout(() => {
          setMotionData({x:0, y:0, z:9.8});
          setRotationData({alpha:0, beta:0, gamma:0});
      }, 400);
  };

  const toggleSoothe = () => {
    if (isSoothing) {
      setIsSoothing(false);
      if (sootheIntervalRef.current) clearInterval(sootheIntervalRef.current);
      setMotionData({ x: 0, y: 0, z: 9.8 });
      setRotationData({ alpha: 0, beta: 0, gamma: 0 });
    } else {
      setIsSoothing(true);
      if (active) stopSensors();

      let tick = 0;
      sootheIntervalRef.current = window.setInterval(() => {
        tick += 0.05; // Velocità onda
        
        // Simula Cullamento Ritmico
        // 1. Giroscopio: Oscillazione dolce (Rollio)
        const simGamma = Math.sin(tick) * 20; // +/- 20 gradi
        const simBeta = Math.cos(tick) * 5;   // Leggero pitch
        
        // 2. Accelerometro: Variazione gravità laterale coerente col rollio
        const simX = Math.sin(tick) * 3; 
        const simY = Math.cos(tick/2) * 1;
        const simZ = 9.8 + Math.sin(tick * 2) * 0.5; // Leggero "bounce" verticale
        
        setMotionData({ x: simX, y: simY, z: simZ });
        setRotationData({ alpha: tick * 10, beta: simBeta, gamma: simGamma });
        
        if (Math.floor(tick * 10) % 25 === 0) {
           onCapture("[SIGNAL: VESTIBULAR_RHYTHM_SYNC]", 0.4, {
               sensor: 'INTEGRATED_BALANCE',
               desc: 'Coherent Otolith & Canal Stimulation'
           });
        }
      }, 50);
    }
  };

  useEffect(() => {
    return () => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('devicemotion', handleMotion);
            window.removeEventListener('deviceorientation', handleOrientation);
        }
        if (sootheIntervalRef.current) clearInterval(sootheIntervalRef.current);
    };
  }, []);

  return (
    <div className="bg-bio-panel p-2 rounded-lg border border-gray-700 mt-2">
      <div className="flex justify-between items-center mb-2">
         <div className="flex flex-col">
             <span className="text-xs font-mono text-orange-400">VESTIBOLARE & EQUILIBRIO</span>
             <span className={`text-[8px] font-mono tracking-widest ${permissionStatus === 'RECEIVING' ? 'text-green-500 animate-pulse' : (permissionStatus.includes('HTTPS') ? 'text-red-500' : 'text-gray-500')}`}>
                 STATUS: {permissionStatus}
             </span>
         </div>
         <button 
            onClick={active ? stopSensors : requestPermission}
            disabled={isSoothing}
            className={`text-[10px] px-3 py-1 rounded border transition-colors font-bold ${
              active 
              ? 'bg-orange-900/50 border-orange-500 text-orange-200' 
              : 'bg-gray-800 border-gray-600 text-gray-400 disabled:opacity-30'
            }`}
          >
            {active ? "DISCONNETTI" : "ATTIVA SENSORI"}
          </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
          {/* ACCELEROMETRO (OTOLITI) */}
          <div className="bg-gray-900/50 p-1.5 rounded border border-gray-800">
              <div className="text-[8px] text-gray-500 mb-1 flex justify-between">
                  <span>OTOLITI (ACCEL LINEARE)</span>
                  <span className="text-orange-500">G-FORCE</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center font-mono text-[9px]">
                  <div style={{color: isSoothing ? '#4ade80' : 'white'}}>X:{motionData.x.toFixed(1)}</div>
                  <div style={{color: isSoothing ? '#4ade80' : 'white'}}>Y:{motionData.y.toFixed(1)}</div>
                  <div style={{color: isSoothing ? '#4ade80' : 'white'}}>Z:{motionData.z.toFixed(1)}</div>
              </div>
          </div>

          {/* GIROSCOPIO (CANALI SEMICIRCOLARI) */}
          <div className="bg-gray-900/50 p-1.5 rounded border border-gray-800">
              <div className="text-[8px] text-gray-500 mb-1 flex justify-between">
                  <span>CANALI (ROTAZIONE)</span>
                  <span className="text-blue-500">ANGOLARE</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center font-mono text-[9px]">
                  <div style={{color: isSoothing ? '#60a5fa' : 'white'}}>α:{rotationData.alpha.toFixed(0)}°</div>
                  <div style={{color: isSoothing ? '#60a5fa' : 'white'}}>β:{rotationData.beta.toFixed(0)}°</div>
                  <div style={{color: isSoothing ? '#60a5fa' : 'white'}}>γ:{rotationData.gamma.toFixed(0)}°</div>
              </div>
          </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={simulateShake}
          className="flex-1 py-2 text-[10px] font-mono font-bold bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded transition-colors uppercase flex flex-col items-center leading-none gap-1"
        >
          <span>⚡ SIMULA TRAUMA</span>
          <span className="text-[7px] text-red-500/70">CAOS VESTIBOLARE</span>
        </button>

        <button
          onClick={toggleSoothe}
          className={`flex-1 py-2 text-[10px] font-mono font-bold border rounded transition-all uppercase flex flex-col items-center justify-center leading-none gap-1 ${
            isSoothing 
            ? 'bg-green-500/20 text-green-400 border-green-500 animate-pulse' 
            : 'bg-bio-accent/10 hover:bg-bio-accent/20 text-bio-accent border-bio-accent/30'
          }`}
        >
          {isSoothing ? (
            <>
                <span>≋ CULLAMENTO ATTIVO</span>
                <span className="text-[7px] text-green-300/70">OSCILLAZIONE SINCRONA</span>
            </>
          ) : (
            <>
                <span>~ CULLA (RITMICO)</span>
                <span className="text-[7px] text-bio-accent/70">STIMOLA SEROTONINA</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default MotionSystem;
