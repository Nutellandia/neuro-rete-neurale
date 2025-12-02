import React from 'react';
export default function NeuroControls({values, onChange}: any) {
    return <div className="bg-gray-900 p-2 border border-gray-700 mt-2">{Object.keys(values).map(k=><div key={k}>{k}: {values[k]}</div>)}</div>;
}