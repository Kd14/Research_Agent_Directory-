import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchDocumentsDirectory } from './watchDocuments';
import { DocumentService } from '../services/DocumentService';

let watchDir: string;

beforeEach(() => {
  watchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusagent-watch-'));
});

afterEach(() => {
  fs.rmSync(watchDir, { recursive: true, force: true });
});

function makeFakeDocumentService() {
  const createFromText = vi.fn(() => ({ ok: true, value: { id: 'doc_1' } }));
  return { createFromText } as unknown as DocumentService;
}

describe('watchDocumentsDirectory', () => {
  it('logs and does nothing if the directory does not exist', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const documentService = makeFakeDocumentService();

    watchDocumentsDirectory(path.join(watchDir, 'does-not-exist'), documentService);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
    expect(documentService.createFromText).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('imports a new file after the debounce window once it settles on disk', async () => {
    const documentService = makeFakeDocumentService();
    watchDocumentsDirectory(watchDir, documentService);

    const filePath = path.join(watchDir, 'note.txt');
    fs.writeFileSync(filePath, 'hello from watch mode');

    await vi.waitFor(
      () => {
        expect(documentService.createFromText).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'note.txt', content: 'hello from watch mode' })
        );
      },
      { timeout: 3000, interval: 100 }
    );
  });
});
