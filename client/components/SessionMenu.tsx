import React, { useEffect, useState } from 'react';
import { History, Pencil, Copy, Download, Trash2, ChevronDown } from 'lucide-react';

interface SessionSummary {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

interface SessionMenuProps {
  onResumeSession: (sessionId: string) => void;
}

export const SessionMenu: React.FC<SessionMenuProps> = ({ onResumeSession }) => {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const refresh = async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    await fetch(`/api/sessions/${id}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: renameValue })
    });
    setRenamingId(null);
    refresh();
  };

  const handleDuplicate = async (id: string) => {
    await fetch(`/api/sessions/${id}/duplicate`, { method: 'POST' });
    refresh();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    refresh();
  };

  return (
    <div className="relative">
      <button
        id="btn-sessions-menu"
        onClick={() => setOpen(v => !v)}
        title="Saved Sessions"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <History className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Saved Sessions</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {sessions.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-slate-400">No saved sessions yet.</div>
            )}
            {sessions.map(s => (
              <div key={s.id} className="border-b border-slate-50 px-3 py-2 last:border-0 dark:border-slate-800/60">
                {renamingId === s.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRename(s.id)}
                      className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                    />
                    <button onClick={() => handleRename(s.id)} className="text-xs text-indigo-600">Save</button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { onResumeSession(s.id); setOpen(false); }}
                      className="block w-full truncate text-left text-xs font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-200"
                    >
                      {s.title}
                    </button>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{s.status}</span>
                      <div className="flex items-center gap-1.5">
                        <button title="Rename" onClick={() => { setRenamingId(s.id); setRenameValue(s.title); }}>
                          <Pencil className="h-3 w-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
                        </button>
                        <button title="Duplicate" onClick={() => handleDuplicate(s.id)}>
                          <Copy className="h-3 w-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
                        </button>
                        <a title="Export" href={`/api/sessions/${s.id}/export`} download={`${s.id}.json`}>
                          <Download className="h-3 w-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
                        </a>
                        <button title="Delete" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="h-3 w-3 text-slate-400 hover:text-red-600" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
