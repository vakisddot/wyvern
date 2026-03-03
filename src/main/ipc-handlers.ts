import { BrowserWindow, ipcMain, dialog, shell } from 'electron';
import fs from 'fs';
import { IPC_CHANNELS, WyvernConfig, RoleDefinition } from '../types';
import { Orchestrator } from './orchestrator';
import { PipelineManager } from './pipeline-manager';
import { openProject, checkCliTools } from './project-manager';
import { scaffoldProject } from './project-scaffold';

export interface ProjectContext {
  orchestrator: Orchestrator | null;
  projectPath: string | null;
  config: WyvernConfig | null;
  roles: Record<string, RoleDefinition> | null;
}

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  pipelineManager: PipelineManager,
  dataDir: string,
  ctx: ProjectContext,
): void {
  ipcMain.handle(IPC_CHANNELS.OPEN_PROJECT, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Wyvern Project Directory',
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const selectedPath = result.filePaths[0];
    const { config, roles } = openProject(selectedPath);

    ctx.projectPath = selectedPath;
    ctx.config = config;
    ctx.roles = roles;

    ctx.orchestrator = new Orchestrator(config, roles, selectedPath, dataDir, pipelineManager);
    forwardOrchestratorEvents(mainWindow, ctx.orchestrator);

    mainWindow.setTitle(`Wyvern \u2014 ${config.project.name}`);

    return { config, roles, projectPath: selectedPath };
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_PROJECT, async (_event, projectName: string) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Directory for New Wyvern Project',
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const selectedPath = result.filePaths[0];
    scaffoldProject(selectedPath, projectName);

    const { config, roles } = openProject(selectedPath);

    ctx.projectPath = selectedPath;
    ctx.config = config;
    ctx.roles = roles;

    ctx.orchestrator = new Orchestrator(config, roles, selectedPath, dataDir, pipelineManager);
    forwardOrchestratorEvents(mainWindow, ctx.orchestrator);

    mainWindow.setTitle(`Wyvern \u2014 ${config.project.name}`);

    return { config, roles, projectPath: selectedPath };
  });

  ipcMain.handle(IPC_CHANNELS.CHECK_CLI_TOOLS, async () => {
    if (!ctx.roles) return { missing: [] };
    return checkCliTools(ctx.roles);
  });

  ipcMain.handle(IPC_CHANNELS.START_PIPELINE, async (_event, directive: string) => {
    if (!ctx.orchestrator) throw new Error('No project loaded');
    try {
      const state = await ctx.orchestrator.runPipeline(directive);
      return state.id;
    } catch (err) {
      console.error('[Wyvern] Pipeline failed:', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_PIPELINES, async () => {
    if (!ctx.projectPath) return [];
    return pipelineManager.listPipelines();
  });

  ipcMain.handle(IPC_CHANNELS.GET_PIPELINE_STATE, async (_event, id: string) => {
    if (!ctx.projectPath) throw new Error('No project loaded');
    return pipelineManager.loadPipeline(id);
  });

  ipcMain.handle(IPC_CHANNELS.GET_ARTIFACT, async (_event, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8');
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_IN_EDITOR, async (_event, filePath: string) => {
    return shell.openPath(filePath);
  });

  ipcMain.on(IPC_CHANNELS.APPROVE_CHECKPOINT, (_event, _pipelineId: string, agentId: string, response: string) => {
    if (ctx.orchestrator) ctx.orchestrator.resolveCheckpoint(agentId, response);
  });

  ipcMain.on(IPC_CHANNELS.REJECT_CHECKPOINT, (_event, _pipelineId: string, agentId: string, reason: string) => {
    if (ctx.orchestrator) ctx.orchestrator.rejectCheckpoint(agentId, reason);
  });
}

export function forwardOrchestratorEvents(mainWindow: BrowserWindow, orchestrator: Orchestrator): void {
  orchestrator.on('pipeline-update', (state) => {
    mainWindow.webContents.send(IPC_CHANNELS.PIPELINE_UPDATE, state);
  });

  orchestrator.on('checkpoint-request', (data) => {
    mainWindow.webContents.send(IPC_CHANNELS.CHECKPOINT_REQUEST, data);
  });
}
