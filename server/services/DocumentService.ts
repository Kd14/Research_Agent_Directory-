import crypto from 'crypto';
import { extractText, getDocumentProxy } from 'unpdf';
import type { TechDocument } from '../../client/types';
import { ValidationError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import type { DocumentStore } from '../storage/DocumentStore';

interface UploadedFile {
  readonly buffer: Buffer;
  readonly originalname: string;
  readonly size: number;
}

function isPdf(buffer: Buffer, fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pdf') || buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

/** PDFs need real text extraction - decoding their compressed byte streams as UTF-8 produces garbage. */
export async function extractFileContent(buffer: Buffer, fileName: string): Promise<Result<string, ValidationError>> {
  if (!isPdf(buffer, fileName)) {
    return Ok(buffer.toString('utf-8'));
  }

  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    if (!text.trim()) {
      return Err(new ValidationError(`"${fileName}" is a PDF but no extractable text was found (it may be scanned/image-only)`));
    }
    return Ok(text);
  } catch (err) {
    return Err(new ValidationError(`Failed to parse PDF "${fileName}": ${err instanceof Error ? err.message : String(err)}`));
  }
}

interface UploadMeta {
  readonly category?: string;
  readonly title?: string;
  readonly tags?: string;
}

interface CreateInput {
  readonly title?: string;
  readonly category?: string;
  readonly fileName?: string;
  readonly content?: string;
  readonly tags?: string[];
}

function generateDocId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

export class DocumentService {
  constructor(private readonly store: DocumentStore) {}

  list(): readonly TechDocument[] {
    return this.store.list();
  }

  /** Existing docs may predate contentHash - compute it on the fly for those. */
  private findDuplicateByContent(contentHash: string): TechDocument | undefined {
    return this.store.list().find(d => (d.contentHash ?? computeContentHash(d.content)) === contentHash);
  }

  async upload(file: UploadedFile | undefined, meta: UploadMeta): Promise<Result<TechDocument, ValidationError>> {
    if (!file) {
      return Err(new ValidationError('No file provided in request'));
    }

    const extracted = await extractFileContent(file.buffer, file.originalname);
    if (!extracted.ok) {
      return extracted;
    }
    const fileContent = extracted.value;
    const contentHash = computeContentHash(fileContent);

    const existing = this.findDuplicateByContent(contentHash);
    if (existing) {
      return Ok(existing);
    }

    const docCategory = meta.category || 'Technical Architecture';
    const parsedTags = meta.tags ? meta.tags.split(',').map(t => t.trim()) : ['Uploaded Doc'];

    const newDoc: TechDocument = {
      id: generateDocId(),
      title: meta.title || file.originalname,
      category: docCategory as TechDocument['category'],
      fileName: file.originalname,
      content: fileContent,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      summary: fileContent.slice(0, 200) + '...',
      tags: parsedTags,
      contentHash
    };

    this.store.add(newDoc);
    return Ok(newDoc);
  }

  createFromText(input: CreateInput): Result<TechDocument, ValidationError> {
    if (!input.title || !input.content) {
      return Err(new ValidationError('Title and content are required'));
    }

    const contentHash = computeContentHash(input.content);
    const existing = this.findDuplicateByContent(contentHash);
    if (existing) {
      return Ok(existing);
    }

    const newDoc: TechDocument = {
      id: generateDocId(),
      title: input.title,
      category: (input.category || 'Technical Architecture') as TechDocument['category'],
      fileName: input.fileName || `${input.title.toLowerCase().replace(/\s+/g, '_')}.txt`,
      content: input.content,
      sizeBytes: Buffer.byteLength(input.content, 'utf-8'),
      uploadedAt: new Date().toISOString(),
      summary: input.content.slice(0, 200) + '...',
      tags: input.tags || ['Custom Doc'],
      contentHash
    };

    this.store.add(newDoc);
    return Ok(newDoc);
  }

  delete(id: string): number {
    return this.store.remove(id);
  }
}
