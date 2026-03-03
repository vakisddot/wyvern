import fs from 'fs';
import path from 'path';

const STABLE_MS = 500;

export function watchForOutput(
  outputDir: string,
  fileName: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const targetPath = path.join(outputDir, fileName);

    let resolved = false;
    let watcher: fs.FSWatcher | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let stabilityTimer: ReturnType<typeof setTimeout> | null = null;

    function cleanup(): void {
      if (watcher) { try { watcher.close(); } catch { /* ignore */ } watcher = null; }
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      if (timeout) { clearTimeout(timeout); timeout = null; }
      if (stabilityTimer) { clearTimeout(stabilityTimer); stabilityTimer = null; }
    }

    function done(filePath: string): void {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(filePath);
    }

    function fail(err: Error): void {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(err);
    }

    function waitForStable(): void {
      if (resolved) return;
      if (stabilityTimer) clearTimeout(stabilityTimer);

      if (!fs.existsSync(targetPath)) return;
      const size = fs.statSync(targetPath).size;
      if (size === 0) return;

      stabilityTimer = setTimeout(() => {
        if (resolved) return;
        if (!fs.existsSync(targetPath)) return;
        const newSize = fs.statSync(targetPath).size;
        if (newSize > 0 && newSize === size) {
          done(targetPath);
        }
      }, STABLE_MS);
    }

    // Check if file already exists and is stable
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
      waitForStable();
    }

    // Ensure the directory exists before watching
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      watcher = fs.watch(outputDir, (_eventType, eventFileName) => {
        if (eventFileName === fileName) {
          waitForStable();
        }
      });
      watcher.on('error', () => {
        // Watcher failed - polling fallback will handle it
      });
    } catch {
      // fs.watch not available - polling fallback will handle it
    }

    pollInterval = setInterval(() => {
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
        waitForStable();
      }
    }, 2000);

    timeout = setTimeout(() => {
      fail(new Error('Timed out waiting for agent output: ' + fileName));
    }, timeoutMs);
  });
}
