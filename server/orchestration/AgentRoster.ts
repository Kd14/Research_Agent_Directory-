import type { AgentNode } from '../../client/types';

export function getDefaultAgents(): Record<string, AgentNode> {
  return {
    lead: {
      id: 'lead',
      role: 'lead',
      name: 'Dr. Astra',
      title: 'Lead Chief Scientist & Orchestrator',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      description: 'Decomposes complex research queries, manages agent workflows, resolves conflicting findings, and synthesizes the final report.',
      status: 'idle',
      progress: 0,
      thoughtTrace: ['System initialized and awaiting research instructions.'],
      toolsAccess: ['mcp_doc_search', 'mcp_web_grounding', 'mcp_synthesis_engine', 'mcp_pdf_report_generator']
    },
    literature: {
      id: 'literature',
      role: 'literature',
      name: 'Agent Hypatia',
      title: 'Literature & Evidence Researcher',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      description: 'Surveys published literature, prior work, and authoritative sources for whatever domain the research question is actually in - extracting frameworks, precedents, definitions, and evidence, and cross-referencing claims across sources.',
      status: 'idle',
      progress: 0,
      thoughtTrace: ['Ready to survey literature, precedent, and authoritative sources for this domain.'],
      toolsAccess: ['mcp_doc_search', 'mcp_web_grounding']
    },
    pipeline: {
      id: 'pipeline',
      role: 'pipeline',
      name: 'Agent Turing',
      title: 'Quantitative & Technical Systems Analyst',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      description: 'Analyzes the technical, structural, and quantitative dimensions of the subject - system/process architecture, mechanisms, data and metrics - and reaches for the compute/memory-budget calculator specifically when the domain is ML or hardware infrastructure, not otherwise.',
      status: 'idle',
      progress: 0,
      thoughtTrace: ['Ready to analyze technical structure, quantitative data, and system constraints relevant to this domain.'],
      toolsAccess: ['mcp_doc_search', 'mcp_spec_analyzer']
    },
    validation: {
      id: 'validation',
      role: 'validation',
      name: 'Agent Veritas',
      title: 'Fact-Checking & Logic Auditor',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      description: 'Audits hypotheses and claims, checks for hallucination or unsupported overreach, validates reported figures and evidence against their sources, and ensures logical and quantitative rigor.',
      status: 'idle',
      progress: 0,
      thoughtTrace: ['Ready to audit agent outputs and cross-validate claims against evidence.'],
      toolsAccess: ['mcp_doc_search', 'mcp_hypothesis_tester']
    },
    synthesis: {
      id: 'synthesis',
      role: 'synthesis',
      name: 'Agent Nexus',
      title: 'Report Synthesis & Visualization Specialist',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      description: 'Formats finalized research findings into clean markdown, generates Mermaid.js architecture diagrams, and exports the polished final PDF.',
      status: 'idle',
      progress: 0,
      thoughtTrace: ['Ready to aggregate findings into report structures.'],
      toolsAccess: ['mcp_synthesis_engine', 'mcp_pdf_report_generator']
    }
  };
}
