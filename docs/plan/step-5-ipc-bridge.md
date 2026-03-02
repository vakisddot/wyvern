# Step 5: IPC Bridge — Preload + Main Handlers

## Goal

Wire up Electron IPC so the renderer process can control the orchestrator and receive real-time updates. This is the bridge between the main process (Steps 1-4) and the GUI (Step 6).

## Prerequisites

Steps 1-4 must be complete.

## Files to Create

### `src/main/ipc-handlers.ts`

Registers all `ipcMain.handle` (request/response) and `ipcMain.on` (fire-and-forget) handlers. Also forwards orchestrator events to the renderer.

```typescript
function registerIpcHandlers(
  mainWindow: BrowserWindow,
  orchestrator: Orchestrator,
  pipelineManager: PipelineManager,
  projectPath: string,
): void {
  // Request/response handlers
  ipcMain.handle(IPC_CHANNELS.START_PIPELINE, async (_, directive) => {
    const state = await orchestrator.runPipeline(directive);
    return state.id;
  });

  ipcMain.handle(IPC_CHANNELS.GET_PIPELINES, async () => {
    return pipelineManager.listPipelines(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.GET_PIPELINE_STATE, async (_, id) => {
    return pipelineManager.loadPipeline(projectPath, id);
  });

  ipcMain.handle(IPC_CHANNELS.GET_ARTIFACT, async (_, filePath) => {
    return fs.readFileSync(filePath, 'utf-8');
  });

  // Fire-and-forget handlers
  ipcMain.on(IPC_CHANNELS.APPROVE_CHECKPOINT, (_, pipelineId, agentId, response) => {
    orchestrator.resolveCheckpoint(agentId, response);
  });

  ipcMain.on(IPC_CHANNELS.REJECT_CHECKPOINT, (_, pipelineId, agentId, reason) => {
    orchestrator.rejectCheckpoint(agentId, reason);
  });

  // Forward orchestrator events to renderer
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
```

### `src/global.d.ts`

Augment the Window interface so TypeScript knows about `window.wyvern`:

```typescript
import { WyvernAPI } from './types';

declare global {
  interface Window {
    wyvern: WyvernAPI;
  }
}
```

## Files to Modify

### `src/preload.ts`

Full rewrite. Expose the `WyvernAPI` to the renderer via `contextBridge.exposeInMainWorld`.

- Import `contextBridge`, `ipcRenderer` from `electron`
- Import `IPC_CHANNELS` from `./types`
- Build the API object mapping each method to `ipcRenderer.invoke` (for request/response) or `ipcRenderer.send` (for fire-and-forget)
- For event listeners (`onPipelineUpdate`, `onAgentOutput`, `onCheckpointRequest`): use `ipcRenderer.on` and return an unsubscribe function that calls `ipcRenderer.removeListener`
- Call `contextBridge.exposeInMainWorld('wyvern', api)`

### `src/index.ts`

Major restructure of the main process entry point:

1. Keep the Electron app lifecycle handling (ready, window-all-closed, activate)
2. After app is ready, before creating window:
   - Note: config/roles loading will happen lazily when a project is opened (Step 7), not at startup
   - For now, just create placeholder instances or defer instantiation
3. In `createWindow()`:
   - Set window size to `1400x900` (three-panel app needs space)
   - Set `webPreferences.contextIsolation: true` explicitly
   - Keep the preload script reference
   - Gate `openDevTools()` behind `!app.isPackaged` check
4. After window creation, call `registerIpcHandlers()`
5. The orchestrator instantiation will be deferred until a project is opened — for now wire up what you can, and the handlers that don't need a project (like `OPEN_PROJECT`) should work

## Verification

1. `npm run lint` passes
2. `npm start` — app launches without errors at the larger window size
3. Open DevTools in renderer, type `window.wyvern` — should show the full API object with all methods as functions
4. Call `window.wyvern.getPipelines()` from DevTools — should return an empty array or handle gracefully (no project loaded yet)
5. No TypeScript errors in the build
