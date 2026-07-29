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
      toolsAccess: ['mcp_doc_search', 'mcp_web_grounding', 'mcp_synthesis_engine']
    },
    literature: {
      id: 'literature',
      role: 'literature',
      name: 'Agent Hypatia',
      title: 'Literature & Theory Researcher',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      description: 'Extracts theoretical frameworks, research paper proofs, scaling laws, and cross-references academic literature.',
      status: 'idle',
      progress: 0,
      thoughtTrace: ['Ready to query literature and academic references.'],
      toolsAccess: ['mcp_doc_search', 'mcp_web_grounding']
    },
    pipeline: {
      id: 'pipeline',
      role: 'pipeline',
      name: 'Agent Turing',
      title: 'Model Pipeline & Compute Architect',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      description: 'Analyzes model spec sheets, memory budgets, VRAM allocations, throughput FLOPs, and 3D parallelism topology.',
      status: 'idle',
      progress: 0,
      thoughtTrace: ['Ready to compute hardware budgets and pipeline constraints.'],
      toolsAccess: ['mcp_doc_search', 'mcp_spec_analyzer']
    },
    validation: {
      id: 'validation',
      role: 'validation',
      name: 'Agent Veritas',
      title: 'Fact-Checking & Logic Auditor',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      description: 'Audit hypotheses, checks for hallucinations, validates benchmark numbers, and ensures mathematical rigor.',
      status: 'idle',
      progress: 0,
      thoughtTrace: ['Ready to audit agent outputs and cross-validate data.'],
      toolsAccess: ['mcp_doc_search', 'mcp_hypothesis_tester']
    },
    synthesis: {
      id: 'synthesis',
      role: 'synthesis',
      name: 'Agent Nexus',
      title: 'Report Synthesis & Visualization Specialist',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      description: 'Formats finalized research findings into clean markdown, generates Mermaid.js architecture diagrams, and formats citations.',
      status: 'idle',
      progress: 0,
      thoughtTrace: ['Ready to aggregate findings into report structures.'],
      toolsAccess: ['mcp_synthesis_engine']
    }
  };
}
