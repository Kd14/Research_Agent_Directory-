import React from 'react';
import { Sparkles, Cpu, BookOpen, Layers, Terminal } from 'lucide-react';

interface SamplePromptsGridProps {
  onSelectPrompt: (promptText: string) => void;
}

export const SamplePromptsGrid: React.FC<SamplePromptsGridProps> = ({ onSelectPrompt }) => {
  const samplePrompts = [
    {
      icon: Cpu,
      title: 'Context Window & Memory Bandwidth Audit',
      prompt: 'Audit 1M Token Context Window Memory Bandwidth & VRAM Budget for 70B Dense Transformer based on provided spec sheet vs 8x H100 GPU cluster capabilities.',
      badge: 'Pipeline Spec',
      color: 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60'
    },
    {
      icon: BookOpen,
      title: 'RLHF Alignment & DPO Scaling Laws',
      prompt: 'Compare Direct Preference Optimization (DPO) vs SimPO scaling laws on reasoning benchmarks and evaluate reward model over-optimization risks.',
      badge: 'Research Paper',
      color: 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500/60'
    },
    {
      icon: Layers,
      title: '3D Parallelism Cluster Sizing',
      prompt: 'Analyze FlashAttention-3 FP8 kernel benchmarks and compute optimal 3D Parallelism topology (TP, PP, DP) for 512-node InfiniBand cluster.',
      badge: 'Cluster Architecture',
      color: 'border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/60'
    },
    {
      icon: Terminal,
      title: 'Quantization & KV-Cache Strategy',
      prompt: 'Formulate a comprehensive deployment specification for FP8 block-wise quantization with PagedAttention block size 64.',
      badge: 'Benchmark Spec',
      color: 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60'
    }
  ];

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
        Featured Technical Research Scenarios
      </span>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {samplePrompts.map((item, idx) => {
          const IconComponent = item.icon;

          return (
            <button
              key={idx}
              onClick={() => onSelectPrompt(item.prompt)}
              className={`text-left rounded-xl border p-3.5 transition-all flex flex-col justify-between group ${item.color}`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {item.title}
                    </span>
                  </div>
                  <span className="rounded px-1.5 py-0.2 text-[9.5px] font-semibold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {item.badge}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                  "{item.prompt}"
                </p>
              </div>

              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Launch Research Query</span>
                <span>→</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
