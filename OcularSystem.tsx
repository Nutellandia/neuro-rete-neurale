import React, { useRef, useEffect } from 'react';
export default function OcularSystem({ onCapture, isActive }: any) {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if(isActive) navigator.mediaDevices.getUserMedia({video:true}).then(s => { if(videoRef.current) videoRef.current.srcObject = s; });
    }, [isActive]);
    return <div className="bg-black border border-gray-700 aspect-video relative"><video ref={videoRef} autoPlay muted className="w-full h-full object-cover opacity-50"/></div>;
}