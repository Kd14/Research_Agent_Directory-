import React, { useState } from 'react';
import { FileCode2, Sigma, Workflow, Download, Eye, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { convertMarkdownToPdf } from '../services/api';

const PLACEHOLDER_MARKDOWN = `# Sample Document

## Math

Energy-mass equivalence: $E = mc^2$

$$\\int_0^\\infty e^{-x^2} \\, dx = \\frac{\\sqrt{\\pi}}{2}$$

## Diagram (converted to SVG via LLM)

\`\`\`diagram
User -> API Gateway -> Auth Service
API Gateway -> Database
\`\`\`

## Diagram (rendered locally via mermaid)

\`\`\`mermaid
graph TD; A[Client] --> B[Server]; B --> C[(Database)];
\`\`\`
`;

// Standalone document -> PDF conversion tool, independent of the agentic research workflow. Any
// markdown can be pasted here (or uploaded as a .md/.txt file) and rendered to a polished PDF with
// LaTeX math (KaTeX) and mermaid diagrams rendered locally, plus optional LLM-assisted conversion
// of plain-text/ASCII diagram blocks into real SVG. Talks directly to /api/tools/pdf-convert.
export const PdfConverterStudio: React.FC = () => {
  const [markdown, setMarkdown] = useState<string>(PLACEHOLDER_MARKDOWN);
  const [title, setTitle] = useState<string>('');
  const [renderDiagramsWithLlm, setRenderDiagramsWithLlm] = useState<boolean>(true);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const fileName = `${(title || 'document').toLowerCase().replace(/\s+/g, '_')}.pdf`;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setMarkdown(text);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    e.target.value = '';
  };

  const handleConvert = async () => {
    if (!markdown.trim()) return;
    setStatus('loading');
    setErrorMessage('');
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setPdfBlob(null);

    try {
      const blob = await convertMarkdownToPdf(markdown, title || undefined, renderDiagramsWithLlm);
      const url = URL.createObjectURL(blob);
      setPdfBlob(blob);
      setPdfUrl(url);
      setStatus('idle');
    } catch (err: any) {
      setErrorMessage(err.message || 'PDF conversion failed');
      setStatus('error');
    }
  };

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = pdfUrl || URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-1">
          <FileCode2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Document / PDF Converter</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Convert any markdown into a polished PDF, independent of the agentic research workflow. LaTeX math
          (<code className="font-mono">$...$</code> / <code className="font-mono">$$...$$</code>) renders
          via KaTeX and <code className="font-mono">```mermaid</code> diagrams render locally &mdash; both
          deterministic, no LLM call. Plain-text <code className="font-mono">```diagram</code> blocks are
          optionally converted to real SVG via a single LLM call per diagram.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Input Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Document title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                <span>Upload .md/.txt</span>
                <input type="file" accept=".md,.markdown,.txt" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            <textarea
              id="pdf-converter-markdown-input"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={16}
              placeholder="Paste markdown here, including LaTeX math and diagrams..."
              className="w-full rounded-xl border border-slate-300 p-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={renderDiagramsWithLlm}
                  onChange={(e) => setRenderDiagramsWithLlm(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                <span>Convert plain-text diagrams to SVG via LLM</span>
              </label>

              <button
                id="btn-convert-pdf"
                onClick={handleConvert}
                disabled={status === 'loading' || !markdown.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 shrink-0"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Rendering...</span>
                  </>
                ) : (
                  <>
                    <FileCode2 className="h-3.5 w-3.5" />
                    <span>Convert to PDF</span>
                  </>
                )}
              </button>
            </div>

            {status === 'error' && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center gap-4 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><Sigma className="h-3 w-3" /> KaTeX math</span>
              <span className="flex items-center gap-1"><Workflow className="h-3 w-3" /> Mermaid + LLM SVG diagrams</span>
            </div>
          </div>

          {/* Preview Column */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 min-h-[420px]">
            {pdfUrl ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 p-2 dark:border-slate-800">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 pl-1">
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </span>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
                <iframe title="PDF Preview" src={pdfUrl} className="flex-1 w-full rounded-b-xl" />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-600 p-8 text-center">
                <FileCode2 className="h-8 w-8" />
                <p className="text-xs">The rendered PDF preview will appear here after conversion.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
