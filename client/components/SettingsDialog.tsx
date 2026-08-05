import React, { useState } from 'react';
import { Sliders, ChevronDown } from 'lucide-react';
import { DOMAIN_SUB_AGENTS } from './ChatPanel';
import type { UserPreferences } from '../services/api';

interface SettingsDialogProps {
  preferences: UserPreferences;
  onSave: (patch: UserPreferences) => Promise<UserPreferences>;
}

const THEME_OPTIONS: { value: NonNullable<UserPreferences['theme']>; label: string }[] = [
  { value: 'system', label: 'Match System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
];

// Settings entry point for the preferences MemoryService already persists server-side
// (server/services/MemoryService.ts, server/api/preferences.routes.ts) but that previously had no
// UI - theme, which specialist agents a new run defaults to, and whether the Critic/Reviewer
// reflection loop runs by default (server/orchestration/ResearchPipeline.ts's reflectionOverride).
export const SettingsDialog: React.FC<SettingsDialogProps> = ({ preferences, onSave }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<UserPreferences>(preferences);
  const [saving, setSaving] = useState(false);

  const openDialog = () => {
    setDraft(preferences);
    setOpen(true);
  };

  const toggleDefaultAgent = (id: string) => {
    setDraft(prev => {
      const current = prev.defaultAgentIds ?? DOMAIN_SUB_AGENTS.map(a => a.id);
      if (current.includes(id)) {
        if (current.length === 1) return prev; // keep at least one domain specialist as a default
        return { ...prev, defaultAgentIds: current.filter(a => a !== id) };
      }
      return { ...prev, defaultAgentIds: [...current, id] };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setOpen(false);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  const selectedDefaultAgents = draft.defaultAgentIds ?? DOMAIN_SUB_AGENTS.map(a => a.id);

  return (
    <div className="relative">
      <button
        id="btn-open-settings"
        onClick={openDialog}
        title="Preferences"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <Sliders className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Preferences</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>

            <div className="space-y-4 px-3 py-3">
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Theme</div>
                <div className="flex gap-1.5">
                  {THEME_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDraft(prev => ({ ...prev, theme: opt.value }))}
                      className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-all ${
                        (draft.theme ?? 'system') === opt.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Default Specialist Agents
                </div>
                <div className="space-y-1">
                  {DOMAIN_SUB_AGENTS.map(agent => (
                    <label key={agent.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={selectedDefaultAgents.includes(agent.id)}
                        onChange={() => toggleDefaultAgent(agent.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
                      />
                      <span>{agent.name} <span className="text-slate-400">&middot; {agent.title}</span></span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                <span>
                  Critic/Reviewer reflection loop
                  <div className="text-[10px] font-normal text-slate-400">Audits findings before and after synthesis; slower but more rigorous.</div>
                </span>
                <input
                  type="checkbox"
                  checked={draft.reflectionEnabled ?? false}
                  onChange={e => setDraft(prev => ({ ...prev, reflectionEnabled: e.target.checked }))}
                  className="ml-2 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                id="btn-save-settings"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
