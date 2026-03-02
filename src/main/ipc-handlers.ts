import { BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import { IPC_CHANNELS } from '../types';
import { Orchestrator } from './orchestrator';
import { PipelineManager } from './pipeline-manager';
import { loadConfig, loadRoles, validateRoles } from './config-loader';

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  orchestrator: Orchestrator | null,
  pipelineManager: PipelineManager,
  projectPath: string | null,
): void {
  ipcMain.handle(IPC_CHANNELS.START_PIPELINE, async (_event, directive: string) => {
    if (!orchestrator) throw new Error('No project loaded');
    const state = await orchestrator.runPipeline(directive);
    return state.id;
  });

  ipcMain.handle(IPC_CHANNELS.GET_PIPELINES, async () => {
    if (!projectPath) return [];
    return pipelineManager.listPipelines(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.GET_PIPELINE_STATE, async (_event, id: string) => {
    if (!projectPath) throw new Error('No project loaded');
    return pipelineManager.loadPipeline(projectPath, id);
  });

  ipcMain.handle(IPC_CHANNELS.GET_ARTIFACT, async (_event, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8');
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_PROJECT, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Wyvern Project Directory',
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const selectedPath = result.filePaths[0];
    const config = loadConfig(selectedPath);
    const roles = loadRoles(selectedPath);
    validateRoles(roles);

    return { config, roles };
  });

  ipcMain.handle(IPC_CHANNELS.CHECK_CLI_TOOLS, async () => {
    const { execSync } = await import('child_process');
    const missing: string[] = [];

    for (const tool of ['claude', 'gemini']) {
      try {
        execSync(`${tool} --version`, { stdio: 'pipe' });
      } catch {
        missing.push(tool);
      }
    }

    return { missing };
  });

  ipcMain.on(IPC_CHANNELS.APPROVE_CHECKPOINT, (_event, _pipelineId: string, agentId: string, response: string) => {
    if (orchestrator) orchestrator.resolveCheckpoint(agentId, response);
  });

  ipcMain.on(IPC_CHANNELS.REJECT_CHECKPOINT, (_event, _pipelineId: string, agentId: string, reason: string) => {
    if (orchestrator) orchestrator.rejectCheckpoint(agentId, reason);
  });
}

export function forwardOrchestratorEvents(mainWindow: BrowserWindow, orchestrator: Orchestrator): void {
  orchestrator.on('pipeline-update', (state) => {
    mainWindow.webContents.send(IPC_CHANNELS.PIPELINE_UPDATE, state);
  });

  orchestrator.on('agent-output', (data) => {
    mainWindow.webContents.send(IPC_CHANNELS.AGENT_OUTPUT, data);
  });

  orchestrator.on('checkpoint-request', (data) => {
    mainWindow.webContents.send(IPC_CHANNELS.CHECKPOINT_REQUEST, data);
  });
}
