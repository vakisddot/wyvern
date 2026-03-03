import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, WyvernAPI } from './types';

const api: WyvernAPI = {
  startPipeline: (directive: string, projectPath: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.START_PIPELINE, directive, projectPath);
  },

  approveCheckpoint: (pipelineId: string, agentId: string, response: string) => {
    ipcRenderer.send(IPC_CHANNELS.APPROVE_CHECKPOINT, pipelineId, agentId, response);
  },

  rejectCheckpoint: (pipelineId: string, agentId: string, reason: string) => {
    ipcRenderer.send(IPC_CHANNELS.REJECT_CHECKPOINT, pipelineId, agentId, reason);
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

  onPipelineUpdate: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, state: Parameters<typeof cb>[0]) => cb(state);
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_UPDATE, listener);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.PIPELINE_UPDATE, listener); };
  },

  onAgentOutput: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, data: Parameters<typeof cb>[0]) => cb(data);
    ipcRenderer.on(IPC_CHANNELS.AGENT_OUTPUT, listener);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.AGENT_OUTPUT, listener); };
  },

  onCheckpointRequest: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, data: Parameters<typeof cb>[0]) => cb(data);
    ipcRenderer.on(IPC_CHANNELS.CHECKPOINT_REQUEST, listener);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.CHECKPOINT_REQUEST, listener); };
  },
};

contextBridge.exposeInMainWorld('wyvern', api);
