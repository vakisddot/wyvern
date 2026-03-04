import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, WyvernAPI } from './types';

const api: WyvernAPI = {
  startPipeline: (directive: string, projectPath: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.START_PIPELINE, directive, projectPath);
  },

  getPipelines: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_PIPELINES);
  },

  getPipelineState: (id: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_PIPELINE_STATE, id);
  },

  getArtifact: (filePath: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_ARTIFACT, filePath);
  },

  openProject: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.OPEN_PROJECT);
  },

  createProject: (projectName: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.CREATE_PROJECT, projectName);
  },

  checkCliTools: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.CHECK_CLI_TOOLS);
  },

  openInEditor: (filePath: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.OPEN_IN_EDITOR, filePath);
  },

  saveConfig: (projectPath: string, content: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_CONFIG, projectPath, content);
  },

  saveRole: (projectPath: string, slug: string, content: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_ROLE, projectPath, slug, content);
  },

  createRole: (projectPath: string, slug: string, content: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.CREATE_ROLE, projectPath, slug, content);
  },

  deleteRole: (projectPath: string, slug: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.DELETE_ROLE, projectPath, slug);
  },

  onPipelineUpdate: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, state: Parameters<typeof cb>[0]) => cb(state);
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_UPDATE, listener);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.PIPELINE_UPDATE, listener); };
  },
};

contextBridge.exposeInMainWorld('wyvern', api);
