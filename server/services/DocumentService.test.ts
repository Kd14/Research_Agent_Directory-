import { describe, expect, it, vi } from 'vitest';
import { DocumentService } from './DocumentService';

function makeFakeStore() {
  const docs: any[] = [];
  return {
    list: vi.fn(() => docs),
    add: vi.fn((doc: any) => { docs.unshift(doc); }),
    remove: vi.fn((id: string) => {
      const idx = docs.findIndex(d => d.id === id);
      if (idx >= 0) docs.splice(idx, 1);
      return docs.length;
    })
  };
}

describe('DocumentService.upload', () => {
  it('rejects when no file is provided', () => {
    const service = new DocumentService(makeFakeStore() as any);
    const result = service.upload(undefined, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('builds a document from the uploaded file and persists it', () => {
    const store = makeFakeStore();
    const service = new DocumentService(store as any);
    const file = { buffer: Buffer.from('hello'), originalname: 'a.txt', size: 5 };

    const result = service.upload(file, { category: 'Research Paper', title: 'My Doc' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('My Doc');
      expect(result.value.content).toBe('hello');
      expect(result.value.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(store.add).toHaveBeenCalledTimes(1);
  });

  it('detects a duplicate upload by content hash and does not create a second record', () => {
    const store = makeFakeStore();
    const service = new DocumentService(store as any);
    const file = { buffer: Buffer.from('same content'), originalname: 'a.txt', size: 12 };

    const first = service.upload(file, { title: 'First' });
    expect(first.ok).toBe(true);

    const second = service.upload({ ...file, originalname: 'b.txt' }, { title: 'Second (different name)' });
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.id).toBe(first.value.id);
    }
    expect(store.add).toHaveBeenCalledTimes(1);
  });

  it('matches duplicates against legacy documents that predate contentHash', () => {
    const store = makeFakeStore();
    store.list.mockReturnValue([
      { id: 'doc_legacy', title: 'Legacy', category: 'Research Paper', fileName: 'legacy.txt', content: 'legacy content', sizeBytes: 14, uploadedAt: '', tags: [] }
    ]);
    const service = new DocumentService(store as any);

    const result = service.upload({ buffer: Buffer.from('legacy content'), originalname: 'new.txt', size: 14 }, { title: 'New Upload' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('doc_legacy');
    }
    expect(store.add).not.toHaveBeenCalled();
  });
});

describe('DocumentService.createFromText', () => {
  it('rejects when title or content is missing', () => {
    const service = new DocumentService(makeFakeStore() as any);
    const result = service.createFromText({ title: 'Only Title' });
    expect(result.ok).toBe(false);
  });

  it('creates a document from text content', () => {
    const store = makeFakeStore();
    const service = new DocumentService(store as any);
    const result = service.createFromText({ title: 'Snippet', content: 'body text' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('Snippet');
      expect(result.value.content).toBe('body text');
    }
    expect(store.add).toHaveBeenCalledTimes(1);
  });

  it('detects a duplicate snippet by content hash', () => {
    const store = makeFakeStore();
    const service = new DocumentService(store as any);

    const first = service.createFromText({ title: 'First', content: 'duplicate body' });
    const second = service.createFromText({ title: 'Second', content: 'duplicate body' });

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.id).toBe(first.value.id);
    }
    expect(store.add).toHaveBeenCalledTimes(1);
  });
});

describe('DocumentService.delete', () => {
  it('delegates to the store and returns the remaining count', () => {
    const store = makeFakeStore();
    const service = new DocumentService(store as any);
    service.createFromText({ title: 'A', content: 'x' });
    const remaining = service.delete('nonexistent');
    expect(store.remove).toHaveBeenCalledWith('nonexistent');
    expect(remaining).toBe(store.list().length);
  });
});
