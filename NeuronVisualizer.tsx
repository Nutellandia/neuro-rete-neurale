import React, { useRef, useEffect } from 'react';
export default function NeuronVisualizer({neuronCount, stage}: any) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const cvs = canvasRef.current;
        if(!cvs) return;
        const ctx = cvs.getContext('2d');
        if(ctx) {
            ctx.fillStyle = '#000'; ctx.fillRect(0,0,cvs.width,cvs.height);
            ctx.fillStyle = '#22d3ee'; ctx.font = '20px monospace';
            ctx.fillText(`NEURO-VISUALIZER: ${neuronCount} NODES`, 20, 40);
            ctx.fillText(`STAGE: ${stage}`, 20, 70);
        }
    }, [neuronCount, stage]);
    return <canvas ref={canvasRef} className="w-full h-full block bg-black" width={800} height={600} />;
}