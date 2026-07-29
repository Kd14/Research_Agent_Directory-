import fs from 'fs';
import path from 'path';
import type { DocumentService } from '../services/DocumentService';

const DEBOUNCE_MS = 500;

// Purely in-process via Node's built-in fs.watch (no chokidar dependency) - reasonable for an
// opt-in, unset-by-default local convenience feature. Note: fs.watch's `recursive` option is only
// supported on macOS and Windows, not Linux; on Linux this only watches the top-level directory.
export function watchDocumentsDirectory(watchDir: string, documentService: DocumentService): void {
  if (!fs.existsSync(watchDir)) {
    console.error(`[watch] Directory does not exist, skipping watch mode: ${watchDir}`);
    return;
  }

  const pending = new Map<string, NodeJS.Timeout>();

  const importFile = (filePath: string): void => {
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return;

      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      const result = documentService.createFromText({
        title: fileName,
        fileName,
        content,
        tags: ['Watched Folder']
      });

      if (result.ok) {
        console.log(`[watch] Imported ${fileName} from ${watchDir}`);
      }
    } catch (err) {
      console.error(`[watch] Failed to import ${filePath}:`, err);
    }
  };

  fs.watch(watchDir, { recursive: true }, (_eventType, fileName) => {
    if (!fileName) return;
    const filePath = path.join(watchDir, fileName.toString());

    const existingTimer = pending.get(filePath);
    if (existingTimer) clearTimeout(existingTimer);

    pending.set(
      filePath,
      setTimeout(() => {
        pending.delete(filePath);
        if (fs.existsSync(filePath)) importFile(filePath);
      }, DEBOUNCE_MS)
    );
  });

  console.log(`[watch] Watching ${watchDir} for new/changed documents`);
}
