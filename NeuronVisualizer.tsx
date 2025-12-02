
import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { LifeStage, RealtimeSensoryData, NeuroPlasticity, OutputCapabilities } from '../types';

interface NeuronVisualizerProps {
    neuronCount: number;
    stage: LifeStage;
    activityLevel: number;
    ageString: string;
    totalTicks: number;
    activeInputType: string | null;
    neuroPlasticity: NeuroPlasticity;
    outputCapabilities: OutputCapabilities;
    energy: number;
    maxEnergy: number;
    isSleeping: boolean;
    realtimeData: React.MutableRefObject<RealtimeSensoryData>;
    isVisible: boolean;
    evoProgress: any;
    viewMode: 'CORE' | 'FULL';
    physicsCap: number;
    lastThought?: string;
}

interface PointerState {
    isDragging: boolean;
    pointers: Map<number, {x: number, y: number}>;
    lastPinchDist: number;
    startX: number;
    startY: number;
    draggedNodeMap: Map<number, number>; // PointerID -> NodeID
    lastTapTime: number; 
    isDoubleTapPending: boolean; 
    hasMovedDuringDoubleTap: boolean;
    interactionMode: 'ORBIT' | 'PAN' | 'ZOOM' | 'NODE_DRAG' | 'DOUBLE_TAP_MOVE' | 'NONE';
    gestureLock: 'NONE' | 'PAN' | 'ZOOM';
}

interface Node3D {
    id: number;
    x: number;
    y: number;
    z: number;
    ox: number; // Origin X (for spring back)
    oy: number; // Origin Y
    oz: number; // Origin Z
    group: number;
    scale: number;
    projX: number;
    projY: number;
    birth: number; 
    energy: number; 
    highlightIntensity: number; 
    isDying?: boolean; 
    deathTime?: number; 
    hasExploded?: boolean;
    lastFire: number; 
}

interface Signal {
    id: number;
    from: Node3D;
    to: Node3D;
    progress: number; // 0 to 1
    speed: number;
    color: string;
}

interface CloudParticle {
    x: number;
    y: number;
    z: number;
    baseAlpha: number;
    phase: number;
    group: number;
}

interface ExplosionParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;     
    color: string;
    size: number;
}

// MASSIVE SCALE EXPANSION & SEPARATION
const BIO_SPHERES = [
  // Vertical Axis (Brain Stem -> Limbic)
  { id: 0, label: 'TRONCO ENCEFALICO', cx: 0, cy: 700, cz: 0, radius: 140, color: '#ef4444', type: 'column' }, 
  { id: 1, label: 'GANGLI BASALI', cx: 0, cy: 350, cz: 0, radius: 160, color: '#f97316', type: 'sphere' },
  { id: 2, label: 'SISTEMA LIMBICO', cx: 0, cy: 0, cz: 0, radius: 200, color: '#ffffff', type: 'sphere' },
  
  // Posterior
  { id: 3, label: 'CORTECCIA VISIVA', cx: 0, cy: -100, cz: -700, radius: 240, color: '#eab308', type: 'sphere' }, 
  
  // Sides
  { id: 4, label: 'LOBO TEMPORALE SX', cx: -600, cy: -50, cz: 100, radius: 220, color: '#84cc16', type: 'sphere' }, 
  { id: 5, label: 'LOBO TEMPORALE DX', cx: 600, cy: -50, cz: 100, radius: 220, color: '#84cc16', type: 'sphere' }, 
  
  // Top/Dorsal
  { id: 6, label: 'CORTECCIA MOTORIA', cx: 0, cy: -500, cz: -100, radius: 260, color: '#8b5cf6', type: 'sphere' }, 
  
  // Frontal
  { id: 7, label: 'LOBO PREFRONTALE', cx: 0, cy: -350, cz: 700, radius: 250, color: '#d946ef', type: 'sphere' }, 
  
  // Specific Areas
  { id: 8, label: 'AREA DI BROCA', cx: -400, cy: -250, cz: 450, radius: 160, color: '#ec4899', type: 'sphere' },
  { id: 9, label: 'AREA DI EXNER', cx: 400, cy: -250, cz: 450, radius: 160, color: '#06b6d4', type: 'sphere' },
  
  { id: 99, label: 'DEBRIS', cx: 0, cy: 0, cz: 0, radius: 0, color: '#ffffff', type: 'debris' }
];

const getAllowedGroups = (stage: LifeStage): number[] => {
    switch (stage) {
        case LifeStage.PROGENITORE: return [0];
        case LifeStage.GANGLIO: return [0, 1];
        case LifeStage.SISTEMA_LIMBICO: return [0, 1, 2];
        case LifeStage.NEOCORTECCIA: return [0, 1, 2, 3, 6];
        case LifeStage.CORTECCIA_ASSOCIATIVA: return [0, 1, 2, 3, 4, 5, 6, 7];
        case LifeStage.CERVELLO_MATURO: return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        case LifeStage.POST_UMANO: return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        default: return [0];
    }
};

const NeuronVisualizer: React.FC<NeuronVisualizerProps> = ({ 
    neuronCount, stage, isSleeping, realtimeData, isVisible, viewMode, physicsCap
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const nodesRef = useRef<Node3D[]>([]);
    const cloudRef = useRef<CloudParticle[]>([]); 
    const debrisRef = useRef<ExplosionParticle[]>([]);
    const signalsRef = useRef<Signal[]>([]);
    
    const animationFrameRef = useRef<number>(0);
    
    const DEFAULT_CAM = {
        rotX: 0.2,
        rotY: 0,
        distance: 2800, 
        panX: 0,
        panY: 0,
        autoRotate: true
    };

    const cameraRef = useRef({...DEFAULT_CAM});

    const pointerRef = useRef<PointerState>({
        isDragging: false,
        pointers: new Map(),
        lastPinchDist: 0,
        startX: 0, 
        startY: 0,
        draggedNodeMap: new Map(),
        lastTapTime: 0,
        isDoubleTapPending: false,
        hasMovedDuringDoubleTap: false,
        interactionMode: 'NONE',
        gestureLock: 'NONE'
    });
    
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

    // --- CLOUD GENERATION ---
    useEffect(() => {
        const allowedGroups = getAllowedGroups(stage);
        const cloudParticles: CloudParticle[] = [];
        const cloudDensity = 600; 

        for(let i=0; i < cloudDensity; i++) {
            const group = allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
            const sphere = BIO_SPHERES.find(s => s.id === group) || BIO_SPHERES[0];
            
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = Math.cbrt(Math.random()) * (sphere.radius * 0.8);

            const x = sphere.cx + r * Math.sin(phi) * Math.cos(theta);
            const y = sphere.cy + r * Math.sin(phi) * Math.sin(theta);
            const z = sphere.cz + r * Math.cos(phi);

            cloudParticles.push({
                x, y, z,
                baseAlpha: Math.random() * 0.4 + 0.2,
                phase: Math.random() * Math.PI * 2,
                group
            });
        }
        cloudRef.current = cloudParticles;

    }, [stage]); 

    // --- NODE GENERATION & MIGRATION ---
    useEffect(() => {
        const allowedGroups = getAllowedGroups(stage);
        const modeLimit = viewMode === 'CORE' ? 200 : physicsCap;
        const targetNodes = Math.max(1, Math.min(neuronCount, modeLimit)); 
        
        // 1. Kill invalid nodes
        nodesRef.current.forEach(n => {
            if (!allowedGroups.includes(n.group) && !n.isDying) {
                spawnExplosion(n);
                n.isDying = true;
                n.deathTime = Date.now();
            }
        });

        let activeNodes = nodesRef.current.filter(n => !n.isDying);

        // 2. Migration Logic
        const activeGroupsInSimulation = new Set(activeNodes.map(n => n.group));
        const newGroups = allowedGroups.filter(g => !activeGroupsInSimulation.has(g));

        if (newGroups.length > 0 && activeNodes.length > 0) {
             const migrationCount = Math.floor(activeNodes.length * 0.3);
             for(let i=0; i<migrationCount; i++) {
                 const node = activeNodes[Math.floor(Math.random() * activeNodes.length)];
                 const targetGroup = newGroups[Math.floor(Math.random() * newGroups.length)];
                 const sphere = BIO_SPHERES.find(s => s.id === targetGroup);
                 if (sphere) {
                     node.group = targetGroup;
                     node.ox = sphere.cx + (Math.random()-0.5)*sphere.radius;
                     node.oy = sphere.cy + (Math.random()-0.5)*sphere.radius;
                     node.oz = sphere.cz + (Math.random()-0.5)*sphere.radius;
                     node.highlightIntensity = 1.0;
                 }
             }
        }

        // 3. Spawn new nodes
        if (activeNodes.length < targetNodes) {
            const newNodes: Node3D[] = Array.from({ length: targetNodes - activeNodes.length }, (_, i) => {
                const group = allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
                const sphere = BIO_SPHERES.find(s => s.id === group) || BIO_SPHERES[0];
                
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = Math.cbrt(Math.random()) * sphere.radius * (0.8 + Math.random() * 0.2);
                
                const bx = sphere.cx + r * Math.sin(phi) * Math.cos(theta);
                const by = sphere.cy + r * Math.sin(phi) * Math.sin(theta);
                const bz = sphere.cz + r * Math.cos(phi);

                return {
                    id: (Date.now() + i + Math.random()),
                    x: bx, y: by, z: bz,
                    ox: bx, oy: by, oz: bz,
                    group: group,
                    projX: 0, projY: 0, scale: 0,
                    birth: Date.now(),
                    energy: 0,
                    highlightIntensity: 0,
                    lastFire: 0
                };
            });
            nodesRef.current = [...nodesRef.current, ...newNodes];
        } else if (activeNodes.length > targetNodes) {
             const toKill = activeNodes.length - targetNodes;
             let killed = 0;
             for (let i = nodesRef.current.length - 1; i >= 0; i--) {
                 if (!nodesRef.current[i].isDying && allowedGroups.includes(nodesRef.current[i].group)) {
                     spawnExplosion(nodesRef.current[i]);
                     nodesRef.current[i].isDying = true;
                     nodesRef.current[i].deathTime = Date.now();
                     killed++;
                     if (killed >= toKill) break;
                 }
             }
        }
    }, [neuronCount, stage, physicsCap, viewMode]);

    const spawnExplosion = (n: Node3D) => {
        const sphere = BIO_SPHERES.find(s => s.id === n.group) || BIO_SPHERES[0];
        for(let i=0; i<8; i++) {
            debrisRef.current.push({
                x: n.projX,
                y: n.projY,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1.0,
                color: sphere.color,
                size: 2 + Math.random() * 3
            });
        }
    };

    // --- INTERACTION HANDLERS ---
    const handleWheel = (e: React.WheelEvent) => {
        const sensitivity = 0.001;
        const delta = e.deltaY;
        const zoomFactor = Math.exp(delta * sensitivity);
        cameraRef.current.distance *= zoomFactor;
        cameraRef.current.distance = Math.max(10, Math.min(30000, cameraRef.current.distance));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault(); // STOP SYSTEM ZOOM/MAGNIFYING GLASS
        if (!canvasRef.current) return;
        canvasRef.current.setPointerCapture(e.pointerId);
        
        const now = Date.now();
        pointerRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        pointerRef.current.isDragging = true;
        cameraRef.current.autoRotate = false;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // SINGLE NEURON HIT TEST
        let hitNode: Node3D | null = null;
        let minDist = 45; // Hit Radius

        // Scan ALL nodes to find the closest valid one
        for (let i = nodesRef.current.length - 1; i >= 0; i--) {
            const n = nodesRef.current[i];
            if (n.scale > 0 && !n.isDying) {
                const dx = n.projX - x;
                const dy = n.projY - y;
                const d = Math.sqrt(dx*dx + dy*dy);
                if (d < minDist) {
                    minDist = d;
                    hitNode = n;
                }
            }
        }

        if (hitNode) {
            // Found a specific neuron, link this pointer to it
            pointerRef.current.draggedNodeMap.set(e.pointerId, hitNode.id);
            pointerRef.current.interactionMode = 'NODE_DRAG';
            hitNode.highlightIntensity = 1.0;
            setSelectedNodeId(hitNode.id);
        }

        // NAVIGATION LOGIC
        if (pointerRef.current.pointers.size === 1) {
             // DOUBLE TAP DETECTION (Increased timeout to 600ms for easier trigger)
             if (now - pointerRef.current.lastTapTime < 600) {
                 pointerRef.current.isDoubleTapPending = true;
                 pointerRef.current.hasMovedDuringDoubleTap = false;
                 // Set to special mode for Double Tap + Drag
                 pointerRef.current.interactionMode = 'DOUBLE_TAP_MOVE';
                 pointerRef.current.gestureLock = 'NONE'; // Reset lock
             } else {
                 pointerRef.current.isDoubleTapPending = false;
                 if (!hitNode) pointerRef.current.interactionMode = 'ORBIT';
             }
             pointerRef.current.lastTapTime = now;
             
             pointerRef.current.startX = e.clientX;
             pointerRef.current.startY = e.clientY;

        } else if (pointerRef.current.pointers.size === 2) {
             // 2 Fingers
             if (pointerRef.current.interactionMode !== 'NODE_DRAG') {
                 pointerRef.current.interactionMode = 'ZOOM';
                 const pts = Array.from(pointerRef.current.pointers.values()) as {x: number, y: number}[];
                 pointerRef.current.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
             }
        } else if (pointerRef.current.pointers.size === 3) {
            pointerRef.current.interactionMode = 'PAN';
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        e.preventDefault(); // STOP SYSTEM DRAG BEHAVIORS
        if (!pointerRef.current.isDragging) return;
        
        const pointers = pointerRef.current.pointers;
        if (!pointers.has(e.pointerId)) return;
        
        const prev = pointers.get(e.pointerId)!;
        const curr = { x: e.clientX, y: e.clientY };
        pointers.set(e.pointerId, curr); 

        const deltaX = curr.x - prev.x;
        const deltaY = curr.y - prev.y;

        // NODE DRAG LOGIC (1:1 SYNC)
        if (pointerRef.current.draggedNodeMap.has(e.pointerId)) {
            const nodeId = pointerRef.current.draggedNodeMap.get(e.pointerId);
            const node = nodesRef.current.find(n => n.id === nodeId);
            if (node) {
                // To get 1:1 movement, we apply Inverse Projection
                const cam = cameraRef.current;
                const cy = Math.cos(cam.rotY);
                const sy = Math.sin(cam.rotY);
                const cx = Math.cos(cam.rotX);
                const sx = Math.sin(cam.rotX);

                const sensitivity = (1 / node.scale);
                
                const rdx = deltaX * sensitivity;
                const rdy = deltaY * sensitivity;
                
                // Approximate inverse rotation
                // FIXED SIGNS FOR "TRASCHINO" (DRAGGING) SYNCHRONIZATION AT STEEP ANGLES
                node.x += rdx * cy - rdy * sy * sx;
                node.y += rdy * cx;
                node.z += rdx * -sy - rdy * cy * sx;
                
                node.highlightIntensity = 1.0;
            }
            return;
        }

        // DOUBLE TAP + MOVE (ZOOM & PAN SYNCED with LOCK)
        if (pointerRef.current.interactionMode === 'DOUBLE_TAP_MOVE') {
            pointerRef.current.hasMovedDuringDoubleTap = true;
            
            // GESTURE LOCKING LOGIC
            if (pointerRef.current.gestureLock === 'NONE') {
                const dist = Math.hypot(deltaX, deltaY);
                if (dist > 2) { // Threshold
                    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
                        pointerRef.current.gestureLock = 'ZOOM'; // Vertical = Zoom
                    } else {
                        pointerRef.current.gestureLock = 'PAN'; // Horizontal = 2D Pan
                    }
                }
            }

            if (pointerRef.current.gestureLock === 'PAN') {
                // 1:1 Pan Sensitivity Calculation
                // The projection scale at the center of rotation is fov / distance.
                // To move 1px on screen, we need 1/scale in world space.
                // panSensitivity = distance / fov = distance / 1000.
                const panSensitivity = cameraRef.current.distance / 1000; 
                cameraRef.current.panX += deltaX * panSensitivity;
                cameraRef.current.panY += deltaY * panSensitivity;
            } 
            else if (pointerRef.current.gestureLock === 'ZOOM') {
                 const zoomSensitivity = 0.005;
                 const factor = 1 - (deltaY * zoomSensitivity);
                 cameraRef.current.distance *= factor;
            }

            // Clamp
            const minD = 10;
            const maxD = 30000;
            cameraRef.current.distance = Math.max(minD, Math.min(maxD, cameraRef.current.distance));
            
            return;
        }

        // PAN (3 Fingers)
        if (pointerRef.current.interactionMode === 'PAN') {
            const panSensitivity = cameraRef.current.distance / 1000;
            cameraRef.current.panX += deltaX * panSensitivity;
            cameraRef.current.panY += deltaY * panSensitivity;
            return;
        }

        // ZOOM (2 Fingers)
        if (pointerRef.current.interactionMode === 'ZOOM' && pointers.size === 2) {
            const pts = Array.from(pointers.values()) as {x: number, y: number}[];
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            
            if (pointerRef.current.lastPinchDist > 0) {
                const scale = pointerRef.current.lastPinchDist / dist;
                cameraRef.current.distance *= scale;
                cameraRef.current.distance = Math.max(10, Math.min(30000, cameraRef.current.distance));
            }
            pointerRef.current.lastPinchDist = dist;
            return;
        }
        
        // ORBIT (1 Finger)
        if (pointerRef.current.interactionMode === 'ORBIT' && pointers.size === 1) {
             const width = canvasRef.current?.clientWidth || 500;
             const rotSensitivity = Math.PI / width;
             
             cameraRef.current.rotY -= deltaX * rotSensitivity * 1.5;
             cameraRef.current.rotX -= deltaY * rotSensitivity * 1.5;
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.preventDefault();
        if (!canvasRef.current) return;
        canvasRef.current.releasePointerCapture(e.pointerId);
        pointerRef.current.pointers.delete(e.pointerId);
        
        if (pointerRef.current.draggedNodeMap.has(e.pointerId)) {
            pointerRef.current.draggedNodeMap.delete(e.pointerId);
        }

        if (pointerRef.current.pointers.size === 0) {
            pointerRef.current.isDragging = false;
            
            // Handle Double Tap Action Reset
            if (pointerRef.current.isDoubleTapPending && !pointerRef.current.hasMovedDuringDoubleTap) {
                // RESET VIEW ONLY IF NO MOVEMENT HAPPENED
                cameraRef.current.panX = 0;
                cameraRef.current.panY = 0;
                cameraRef.current.distance = DEFAULT_CAM.distance;
                cameraRef.current.rotX = DEFAULT_CAM.rotX;
                cameraRef.current.rotY = DEFAULT_CAM.rotY;
            }
            
            pointerRef.current.interactionMode = 'NONE';
            pointerRef.current.gestureLock = 'NONE';
            pointerRef.current.isDoubleTapPending = false;
        } else {
            if (pointerRef.current.pointers.size === 1) pointerRef.current.interactionMode = 'ORBIT';
        }
    };

    // --- RENDER LOOP ---
    useEffect(() => {
        const render = () => {
            if (!canvasRef.current || !isVisible) return;
            const ctx = canvasRef.current.getContext('2d');
            if (!ctx) return;

            const w = canvasRef.current.width = canvasRef.current.clientWidth;
            const h = canvasRef.current.height = canvasRef.current.clientHeight;
            
            // Determine Dragged IDs EARLY for Physics Loop
            const draggedIds = Array.from(pointerRef.current.draggedNodeMap.values());

            // PHYSICS & CAMERA MATH
            if (cameraRef.current.autoRotate && !pointerRef.current.isDragging) {
                cameraRef.current.rotY += 0.002;
            }
            
            const cam = cameraRef.current;
            const cx = Math.cos(cam.rotX);
            const sx = Math.sin(cam.rotX);
            const cy = Math.cos(cam.rotY);
            const sy = Math.sin(cam.rotY);

            // --- PROJECT FUNCTION (VIEW-SPACE PAN) ---
            const project = (x: number, y: number, z: number) => {
                // 1. Rotate World Point around Origin
                // Rotation Y
                let tx = x * cy - z * sy;
                let tz = x * sy + z * cy;
                
                // Rotation X
                let ty = y * cx - tz * sx;
                tz = y * sx + tz * cx;

                // 2. Apply View Space Pan (Translate View)
                tx += cam.panX;
                ty += cam.panY;
                
                // 3. Apply Camera Distance
                tz += cam.distance;
                
                if (tz <= 0) return null;
                const fov = 1000;
                const scale = fov / tz;
                return { x: w / 2 + tx * scale, y: h / 2 + ty * scale, scale: scale, z: tz };
            };

            // --- PHYSICS UPDATE (HOMEOSTASIS) ---
            if (!isSleeping) {
                nodesRef.current.forEach(n => {
                    // Elastic Physics only for non-dragged nodes
                    if (!draggedIds.includes(n.id) && !n.isDying) {
                        // 1. Spring back to origin (Homeostasis)
                        let returnForce = 0.04; // Slightly reduced to allow connection pull
                        const dx = n.ox - n.x;
                        const dy = n.oy - n.y;
                        const dz = n.oz - n.z;
                        n.x += dx * returnForce;
                        n.y += dy * returnForce;
                        n.z += dz * returnForce;
                        
                        // Jitter
                        n.x += (Math.random() - 0.5) * 2;
                        n.y += (Math.random() - 0.5) * 2;
                        n.z += (Math.random() - 0.5) * 2;
                    }
                    
                    if (n.highlightIntensity > 0) n.highlightIntensity *= 0.92;
                });
            }

            ctx.clearRect(0, 0, w, h);

            // 1. CLOUDS
            cloudRef.current.forEach(c => {
                 const p = project(c.x, c.y, c.z);
                 if (p) {
                     const size = p.scale * 4;
                     if (size > 0.5) {
                        const alpha = Math.min(1, c.baseAlpha * (1000/p.z));
                        const sphere = BIO_SPHERES.find(s => s.id === c.group);
                        ctx.fillStyle = sphere ? sphere.color : '#fff';
                        ctx.globalAlpha = alpha * 0.3;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                        ctx.fill();
                     }
                 }
            });
            ctx.globalAlpha = 1;

            // 2. SIGNALS (UPDATE & RENDER)
            const activeSignals = signalsRef.current;
            for (let i = activeSignals.length - 1; i >= 0; i--) {
                const sig = activeSignals[i];
                sig.progress += sig.speed;
                if (sig.progress >= 1) {
                    activeSignals.splice(i, 1);
                    // Trigger target? (Optional chain reaction)
                    if (Math.random() > 0.5 && !sig.to.isDying) {
                        sig.to.highlightIntensity = 1.0;
                    }
                    continue;
                }
                
                // Interpolate 3D position
                const ix = sig.from.x + (sig.to.x - sig.from.x) * sig.progress;
                const iy = sig.from.y + (sig.to.y - sig.from.y) * sig.progress;
                const iz = sig.from.z + (sig.to.z - sig.from.z) * sig.progress;
                
                const p = project(ix, iy, iz);
                if (p && p.scale > 0.1) {
                    ctx.fillStyle = sig.color;
                    ctx.shadowColor = sig.color;
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4 * p.scale, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }

            // 3. CONNECTIONS & PHYSICS (SPRINGS)
            const visibleNodes = nodesRef.current.filter(n => !n.isDying && n.scale > 0.2);
            // TRACK ACTIVE GROUPS FOR LABELS
            const activeGroups = new Set<number>();
            visibleNodes.forEach(n => activeGroups.add(n.group));

            ctx.lineWidth = 1;
            
            const now = Date.now();

            visibleNodes.forEach((n1, i) => {
                const p1 = { x: n1.projX, y: n1.projY, scale: n1.scale };
                
                // Random Firing (Base Activity)
                if (Math.random() < 0.001) n1.highlightIntensity = 1.0;

                for (let j = i + 1; j < Math.min(i + 8, visibleNodes.length); j++) {
                    const n2 = visibleNodes[j];
                    const dx = n1.x - n2.x;
                    const dy = n1.y - n2.y;
                    const dz = n1.z - n2.z;
                    const distSq = dx*dx + dy*dy + dz*dz;
                    
                    if (distSq < 900000) { 
                        // --- PHYSICS: SPRING CONNECTION ---
                        // Pull them together to create "alive" mesh feeling
                        if (!isSleeping) {
                            const force = 0.002; // Strength of connection
                            const fx = dx * force;
                            const fy = dy * force;
                            const fz = dz * force;

                            if (!draggedIds.includes(n1.id)) {
                                n1.x -= fx;
                                n1.y -= fy;
                                n1.z -= fz;
                            }
                            if (!draggedIds.includes(n2.id)) {
                                n2.x += fx;
                                n2.y += fy;
                                n2.z += fz;
                            }
                        }

                        // --- RENDERING CONNECTION ---
                        const p2 = { x: n2.projX, y: n2.projY };
                        
                        // Check if dragged
                        const isHighlighted = draggedIds.includes(n1.id) || draggedIds.includes(n2.id);

                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        
                        if (isHighlighted) {
                            ctx.strokeStyle = '#fbbf24'; // Gold
                            ctx.lineWidth = 2 * n1.scale;
                            ctx.globalAlpha = 0.9;
                            ctx.shadowBlur = 10;
                            ctx.shadowColor = '#fbbf24';
                            ctx.stroke();
                            ctx.shadowBlur = 0;
                        } else {
                            const alpha = Math.min(0.4, (n1.highlightIntensity + n2.highlightIntensity) * 0.5 + 0.1) * Math.min(p1.scale, n2.scale);
                            ctx.strokeStyle = '#ffffff';
                            ctx.lineWidth = 1;
                            ctx.globalAlpha = alpha;
                            ctx.stroke();
                        }

                        // SPAWN REAL SIGNALS
                        if (n1.highlightIntensity > 0.8 && now - n1.lastFire > 200) {
                             if (Math.random() > 0.7) {
                                 signalsRef.current.push({
                                     id: Math.random(),
                                     from: n1,
                                     to: n2,
                                     progress: 0,
                                     speed: 0.05 + Math.random() * 0.05,
                                     color: '#22d3ee' // Cyan pulse
                                 });
                                 n1.lastFire = now;
                             }
                        }
                        if (n2.highlightIntensity > 0.8 && now - n2.lastFire > 200) {
                            if (Math.random() > 0.7) {
                                signalsRef.current.push({
                                    id: Math.random(),
                                    from: n2,
                                    to: n1,
                                    progress: 0,
                                    speed: 0.05 + Math.random() * 0.05,
                                    color: '#f472b6' // Pink pulse
                                });
                                n2.lastFire = now;
                            }
                       }
                    }
                }
            });
            ctx.globalAlpha = 1;

            // 4. NODES
            nodesRef.current.forEach(n => {
                if (n.isDying) return;
                const p = project(n.x, n.y, n.z);
                if (p) {
                    n.projX = p.x;
                    n.projY = p.y;
                    n.scale = p.scale;
                    
                    const sphere = BIO_SPHERES.find(s => s.id === n.group);
                    const color = sphere ? sphere.color : '#fff';
                    const size = Math.max(1, p.scale * 3);

                    const isSelected = draggedIds.includes(n.id);

                    ctx.fillStyle = isSelected ? '#fff' : color;
                    if (n.highlightIntensity > 0.1) ctx.fillStyle = '#fff';
                    
                    // Ripple effect at birth
                    const age = now - n.birth;
                    if (age < 1000) {
                         const rippleSize = size + (age/1000) * 20;
                         const rippleAlpha = 1 - (age/1000);
                         ctx.strokeStyle = color;
                         ctx.lineWidth = 1;
                         ctx.globalAlpha = rippleAlpha;
                         ctx.beginPath();
                         ctx.arc(p.x, p.y, rippleSize, 0, Math.PI * 2);
                         ctx.stroke();
                         ctx.globalAlpha = 1;
                    }

                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            // 5. AREA LABELS (BIO SPHERES)
            // INCREASED VISIBILITY
            BIO_SPHERES.forEach(sphere => {
                if (activeGroups.has(sphere.id) && sphere.type !== 'debris') {
                    const p = project(sphere.cx, sphere.cy, sphere.cz);
                    if (p && p.z > 0) {
                        ctx.fillStyle = sphere.color;
                        ctx.font = `bold ${Math.max(10, 14 * p.scale)}px monospace`; // Increased Font Size
                        ctx.textAlign = 'center';
                        
                        // TEXT SHADOW & OUTLINE FOR READABILITY
                        ctx.shadowColor = '#000000';
                        ctx.shadowBlur = 4;
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                        ctx.strokeText(sphere.label, p.x, p.y - (sphere.radius * p.scale) - 10);
                        
                        ctx.globalAlpha = 1.0; // FULLY OPAQUE
                        ctx.fillText(sphere.label, p.x, p.y - (sphere.radius * p.scale) - 10);
                        
                        ctx.shadowBlur = 0;
                    }
                }
            });

            // 6. DEBRIS
            debrisRef.current = debrisRef.current.filter(d => d.life > 0);
            debrisRef.current.forEach(d => {
                d.x += d.vx;
                d.y += d.vy;
                d.life -= 0.05;
                ctx.fillStyle = d.color;
                ctx.globalAlpha = d.life;
                ctx.beginPath();
                ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;

            animationFrameRef.current = requestAnimationFrame(render);
        };

        animationFrameRef.current = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [isSleeping, isVisible, viewMode]);

    return (
        <div 
            className="w-full h-full relative bg-black overflow-hidden touch-none" 
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onContextMenu={(e) => e.preventDefault()} // PREVENT SYSTEM MENU
            style={{ 
                touchAction: 'none', 
                WebkitTouchCallout: 'none', 
                WebkitUserSelect: 'none',
                userSelect: 'none'
            }}
        >
            <canvas ref={canvasRef} className="w-full h-full block" />
            
            {/* CONTROLS OVERLAY - SUBTLE HINT */}
            <div className="absolute top-4 left-4 z-50 pointer-events-none opacity-50">
                <div className="text-[9px] text-gray-500 font-mono">
                    1 FINGER: ORBIT<br/>
                    TAPx2+SWIPE V: ZOOM<br/>
                    TAPx2+SWIPE H: PAN (1:1)
                </div>
            </div>
        </div>
    );
};

export default NeuronVisualizer;
