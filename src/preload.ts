import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('wolf', {
    defaults: () => ipcRenderer.invoke('project:defaults'),
    open: () => ipcRenderer.invoke('project:open'),
    save: (project: unknown) => ipcRenderer.invoke('project:save', project),
    generate: (project: unknown) => ipcRenderer.invoke('project:generate', project),
    export: (project: unknown) => ipcRenderer.invoke('project:export', project)
});
