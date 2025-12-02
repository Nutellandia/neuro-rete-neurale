
import JSZip from 'jszip';
import { BrainState } from '@/types';

export const exportProjectToZip = async (brain: BrainState, logs: any[]) => {
    const zip = new JSZip();
    zip.file("brain_state.json", JSON.stringify(brain, null, 2));
    
    // In a deployed instance, we don't carry the full source strings in memory to save RAM.
    // To get the source, please use the original "Neuro-Genesis" generator or the GitHub repo.
    zip.file("README.txt", "This is a deployed instance state export.\nTo obtain the full source code, please refer to the original build environment.");

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = "Neuro_Genesis_State_Only.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
