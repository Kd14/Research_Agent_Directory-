import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Play, 
  Edit3, 
  Plus, 
  Trash2, 
  MessageSquare, 
  Bot, 
  Zap, 
  ChevronDown, 
  ChevronUp,
  RotateCcw,
  Sliders,
  Send
} from 'lucide-react';
import { InstructionStep, AgentNode } from '../types';

interface InstructionSetEditorProps {
  instructionSet: InstructionStep[];
  currentStepIndex: number;
  isExecuting: boolean;
  isPaused: boolean;
  agents: Record<string, AgentNode>;
  onUpdateStep: (updatedStep: InstructionStep) => void;
  onAddStep: (newStep: InstructionStep) => void;
  onDeleteStep: (stepId: string) => void;
  onExecuteStepManual: (stepIndex: number, userFeedback?: string) => void;
}

export const InstructionSetEditor: React.FC<InstructionSetEditorProps> = ({
  instructionSet,
  currentStepIndex,
  isExecuting,
  isPaused,
  agents,
  onUpdateStep,
  onAddStep,
  onDeleteStep,
  onExecuteStepManual
}) => {
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editInstructionText, setEditInstructionText] = useState<string>('');
  const [interventionFeedback, setInterventionFeedback] = useState<string>('');
  const [activeInterventionStepId, setActiveInterventionStepId] = useState<string | null>(null);

  // Only agents actually deployed in this session can be assigned steps.
  const assignableAgentIds = ['literature', 'pipeline', 'validation', 'synthesis'].filter(id => agents[id]);
  const agentShortLabel: Record<string, string> = {
    literature: 'Literature',
    pipeline: 'Pipeline Spec',
    validation: 'Fact-Checker',
    synthesis: 'Synthesis'
  };

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newStepTitle, setNewStepTitle] = useState<string>('');
  const [newStepAgent, setNewStepAgent] = useState<string>(() => assignableAgentIds[0] || 'synthesis');
  const [newStepDirective, setNewStepDirective] = useState<string>('');

  const handleStartEdit = (step: InstructionStep) => {
    setEditingStepId(step.id);
    setEditInstructionText(step.instruction);
  };

  const handleSaveEdit = (step: InstructionStep) => {
    onUpdateStep({
      ...step,
      instruction: editInstructionText,
      status: step.status === 'completed' ? 'modified' : step.status
    });
    setEditingStepId(null);
  };

  const handleAddNewStep = () => {
    if (!newStepTitle || !newStepDirective) return;
    const agentObj = agents[newStepAgent];
    const newStep: InstructionStep = {
      id: `step_${Date.now()}`,
      stepNumber: instructionSet.length + 1,
      assignedAgentId: newStepAgent,
      agentName: agentObj?.name || 'Agent',
      title: newStepTitle,
      instruction: newStepDirective,
      requiredTools: agentObj?.toolsAccess || ['mcp_doc_search'],
      status: 'pending'
    };
    onAddStep(newStep);
    setShowAddModal(false);
    setNewStepTitle('');
    setNewStepDirective('');
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Research Instruction Set</h2>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {instructionSet.length} Steps
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Managed Agentic Plan • Click edit or intervene to adjust execution directives
          </p>
        </div>

        <button
          id="btn-add-step"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Manual Step</span>
        </button>
      </div>

      {/* Instruction Steps List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {instructionSet.map((step, index) => {
          const isCurrent = index === currentStepIndex && isExecuting;
          const isCompleted = step.status === 'completed' || step.status === 'modified';
          const agentObj = agents[step.assignedAgentId];
          const isEditing = editingStepId === step.id;
          const isIntervening = activeInterventionStepId === step.id;

          return (
            <div
              key={step.id}
              className={`rounded-xl border p-3.5 transition-all ${
                isCurrent 
                  ? 'border-indigo-500 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/20 shadow-md ring-1 ring-indigo-500/50' 
                  : isCompleted
                  ? 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Step Number & Check Status */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : isCurrent ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white animate-pulse">
                        {step.stepNumber}
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500 dark:border-slate-700">
                        {step.stepNumber}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {step.title}
                      </span>

                      {/* Agent Badge */}
                      <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <img src={agentObj?.avatar} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                        <span>{step.agentName}</span>
                      </span>

                      {/* Step Status Badge */}
                      {step.status === 'modified' && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.2 rounded font-mono">
                          User Modified
                        </span>
                      )}
                    </div>

                    {/* Step Instruction text / edit area */}
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editInstructionText}
                          onChange={(e) => setEditInstructionText(e.target.value)}
                          className="w-full rounded-lg border border-indigo-300 p-2 text-xs text-slate-900 focus:outline-none dark:border-indigo-700 dark:bg-slate-950 dark:text-slate-100"
                          rows={3}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(step)}
                            className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                          >
                            Save Instruction
                          </button>
                          <button
                            onClick={() => setEditingStepId(null)}
                            className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {step.instruction}
                      </p>
                    )}

                    {/* Tools badges */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold text-slate-400">MCP Tools:</span>
                      {step.requiredTools.map(t => (
                        <span key={t} className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[9.5px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Step Action Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStartEdit(step)}
                    title="Edit Directive"
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => setActiveInterventionStepId(isIntervening ? null : step.id)}
                    title="Inject Guidance"
                    className="p-1 text-amber-500 hover:text-amber-600 dark:hover:text-amber-400"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>

                  {!isExecuting && (
                    <button
                      onClick={() => onExecuteStepManual(index)}
                      title="Run Step Manually"
                      className="flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
                    >
                      <Play className="h-3 w-3" />
                      <span>Run</span>
                    </button>
                  )}

                  <button
                    onClick={() => onDeleteStep(step.id)}
                    title="Remove Step"
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Human Intervention Box */}
              {isIntervening && (
                <div className="mt-3 rounded-lg bg-amber-50/80 p-3 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50">
                  <span className="text-xs font-semibold text-amber-900 dark:text-amber-300 block mb-1">
                    Inject Human Feedback to {step.agentName}:
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Focus specifically on FP8 scaling rather than INT4 quantization..."
                      value={interventionFeedback}
                      onChange={(e) => setInterventionFeedback(e.target.value)}
                      className="flex-1 rounded-md border border-amber-300 px-2.5 py-1 text-xs dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      onClick={() => {
                        onExecuteStepManual(index, interventionFeedback);
                        setInterventionFeedback('');
                        setActiveInterventionStepId(null);
                      }}
                      className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500"
                    >
                      <Send className="h-3 w-3" />
                      <span>Execute</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Add Step Modal / Form */}
      {showAddModal && (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/40">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2">Create Custom Instruction Step</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              placeholder="Step Title (e.g. Memory Bandwidth Audit)"
              value={newStepTitle}
              onChange={(e) => setNewStepTitle(e.target.value)}
              className="rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <select
              value={newStepAgent}
              onChange={(e) => setNewStepAgent(e.target.value)}
              className="rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {assignableAgentIds.map(id => (
                <option key={id} value={id}>
                  {agents[id]?.name} ({agentShortLabel[id]})
                </option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Detailed Instruction Directive for Agent..."
            value={newStepDirective}
            onChange={(e) => setNewStepDirective(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 mb-2"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddModal(false)}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNewStep}
              className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Add Step
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
