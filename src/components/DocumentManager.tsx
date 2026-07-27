import React, { useState } from 'react';
import { 
  FileText, 
  Upload, 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  Search, 
  Filter, 
  Eye, 
  Sparkles,
  Tag,
  Clock,
  HardDrive
} from 'lucide-react';
import { TechDocument, DocumentCategory } from '../types';

interface DocumentManagerProps {
  documents: TechDocument[];
  selectedDocIds: string[];
  onToggleDocSelection: (docId: string) => void;
  onSelectAllDocs: (select: boolean) => void;
  onUploadDocument: (file: File, category: DocumentCategory, title?: string, tags?: string) => Promise<void>;
  onCreateDocSnippet: (title: string, category: DocumentCategory, content: string, tags?: string[]) => Promise<void>;
  onDeleteDocument: (docId: string) => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  documents,
  selectedDocIds,
  onToggleDocSelection,
  onSelectAllDocs,
  onUploadDocument,
  onCreateDocSnippet,
  onDeleteDocument
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewDoc, setPreviewDoc] = useState<TechDocument | null>(null);

  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('Pipeline Spec Sheet');
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadTags, setUploadTags] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [snippetContent, setSnippetContent] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const categories: string[] = [
    'All',
    'Pipeline Spec Sheet',
    'Research Paper',
    'Technical Architecture',
    'Benchmark Data',
    'Code / Config'
  ];

  const filteredDocs = documents.filter(doc => {
    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
    const matchesSearch = 
      !searchQuery ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      if (selectedFile) {
        await onUploadDocument(selectedFile, uploadCategory, uploadTitle, uploadTags);
      } else if (uploadTitle && snippetContent) {
        await onCreateDocSnippet(uploadTitle, uploadCategory, snippetContent, uploadTags.split(',').map(t => t.trim()));
      }
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadTitle('');
      setSnippetContent('');
      setUploadTags('');
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Technical Document & Spec Library</span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {documents.length} Files
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select context documents to feed into the agentic research network
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectAllDocs(selectedDocIds.length < documents.length)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {selectedDocIds.length === documents.length ? 'Deselect All' : 'Select All Context'}
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Document / Spec</span>
          </button>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredDocs.map(doc => {
          const isSelected = selectedDocIds.includes(doc.id);

          return (
            <div
              key={doc.id}
              className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50/30 dark:border-indigo-500 dark:bg-indigo-950/20 ring-1 ring-indigo-500/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2.5">
                    <button
                      onClick={() => onToggleDocSelection(doc.id)}
                      className="mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0"
                    >
                      {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-400" />}
                    </button>

                    <div>
                      <h3 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                        {doc.title}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-mono">{doc.fileName}</p>
                    </div>
                  </div>

                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                    {doc.category}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mb-3">
                  {doc.summary || doc.content.slice(0, 160)}
                </p>

                {/* Tags */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  {doc.tags.map(tag => (
                    <span
                      key={tag}
                      className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9.5px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Info & Action Controls */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400 dark:border-slate-800/80">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    {(doc.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    className="flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Inspect</span>
                  </button>

                  <button
                    onClick={() => onDeleteDocument(doc.id)}
                    className="text-slate-400 hover:text-rose-500"
                    title="Delete Document"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Document Inspector Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-3xl flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-sm text-white">{previewDoc.title}</h3>
                <p className="text-xs text-indigo-400 font-mono">{previewDoc.fileName} • {previewDoc.category}</p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-800">
              {previewDoc.content}
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleFileUploadSubmit} className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <h3 className="font-bold text-base text-white mb-1">Add Technical Document or Spec Sheet</h3>
            <p className="text-xs text-slate-400 mb-4">Upload PDF, Markdown, TXT file or paste raw spec sheet content.</p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Document Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-100"
                >
                  <option value="Pipeline Spec Sheet">Pipeline Spec Sheet</option>
                  <option value="Research Paper">Research Paper</option>
                  <option value="Technical Architecture">Technical Architecture</option>
                  <option value="Benchmark Data">Benchmark Data</option>
                  <option value="Code / Config">Code / Config</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. KV-Cache FP8 Quantization Benchmark Spec"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">File Upload (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-300"
                />
              </div>

              {!selectedFile && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Or Paste Content Direct</label>
                  <textarea
                    placeholder="Paste Markdown / Plaintext / Code spec here..."
                    value={snippetContent}
                    onChange={(e) => setSnippetContent(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-100 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Tags (Comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. FP8, H100, VRAM, Pipeline"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
              >
                {isUploading ? 'Uploading...' : 'Save to Document Library'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
