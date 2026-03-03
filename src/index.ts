import { app, BrowserWindow } from 'electron';
import { PipelineManager } from './main/pipeline-manager';
import { registerIpcHandlers, ProjectContext } from './main/ipc-handlers';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const dataDir = app.getPath('userData');
const pipelineManager = new PipelineManager(dataDir);

const projectContext: ProjectContext = {
  orchestrator: null,
  projectPath: null,
  config: null,
  roles: null,
};

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Wyvern',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  registerIpcHandlers(mainWindow, pipelineManager, dataDir, projectContext);
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
