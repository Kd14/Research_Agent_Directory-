import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  FileText, 
  Copy, 
  Check, 
  Download, 
  Share2, 
  Sparkles, 
  MessageSquare, 
  ArrowLeft,
  Printer
} from 'lucide-react';

interface ReportViewerProps {
  reportMarkdown: string;
  sessionId?: string;
  sessionTitle?: string;
  userPrompt?: string;
  onAskFollowUp?: (query: string) => void;
  onBackToStudio?: () => void;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({
  reportMarkdown,
  sessionId,
  sessionTitle,
  userPrompt,
  onAskFollowUp,
  onBackToStudio
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [followUpText, setFollowUpText] = useState<string>('');
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const handleCopy = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pdfFileName = `${(sessionTitle || 'research_report').toLowerCase().replace(/\s+/g, '_')}.pdf`;

  const handleDownloadPdf = async () => {
    if (!sessionId) return;
    setPdfStatus('loading');
    try {
      const res = await fetch(`/api/sessions/${sessionId}/report.pdf`);
      if (!res.ok) throw new Error('PDF not available');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', pdfFileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setPdfStatus('idle');
    } catch {
      setPdfStatus('error');
    }
  };

  const handleViewPdf = () => {
    if (!sessionId) return;
    window.open(`/api/sessions/${sessionId}/report.pdf`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-slate-100 max-w-5xl mx-auto">
      
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6 dark:border-slate-800">
        <div className="flex items-center gap-3">
          {onBackToStudio && (
            <button
              onClick={onBackToStudio}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Studio</span>
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                {sessionTitle || 'Synthesized Technical Research Report'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compiled by Lead Orchestrator Dr. Astra & NexusAgent Network
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Markdown'}</span>
          </button>

          {sessionId && (
            <button
              onClick={handleViewPdf}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              title="Open the polished PDF in a new tab"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>View PDF</span>
            </button>
          )}

          <button
            onClick={handleDownloadPdf}
            disabled={!sessionId || pdfStatus === 'loading'}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{pdfStatus === 'loading' ? 'Rendering PDF…' : 'Export PDF Report'}</span>
          </button>
        </div>
      </div>

      {pdfStatus === 'error' && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          The polished PDF isn't ready for this session yet (it's generated automatically right after synthesis). Try again in a moment, or re-run synthesis.
        </div>
      )}

      {/* User Context Banner */}
      {userPrompt && (
        <div className="mb-6 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs dark:bg-slate-850 dark:border-slate-800">
          <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">Original Research Query:</span>
          <p className="text-slate-700 dark:text-slate-300 italic">"{userPrompt}"</p>
        </div>
      )}

      {/* Markdown Content Container */}
      <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h2:border-b prose-h2:pb-1 prose-h2:mt-6 prose-p:text-sm prose-p:leading-relaxed prose-table:text-xs prose-code:font-mono prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded">
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {reportMarkdown}
          </ReactMarkdown>
        </div>
      </div>

      {/* Follow-up Prompt Box */}
      {onAskFollowUp && (
        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-indigo-500" />
            <span>Ask Follow-up or Request Architecture Refinement</span>
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Conduct a deeper breakdown of memory bandwidth bottleneck for 1M context..."
              value={followUpText}
              onChange={(e) => setFollowUpText(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              onClick={() => {
                if (!followUpText) return;
                onAskFollowUp(followUpText);
                setFollowUpText('');
              }}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-sm"
            >
              Submit Query
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
