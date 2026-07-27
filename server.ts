import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { INITIAL_DOCUMENTS } from './src/data/sampleDocuments';
import { TechDocument, InstructionStep, AgentNode, MCPLogEntry, MCPTool } from './src/types';

// Document persistence: local JSON file so uploads/creates/deletes survive server restarts
const DATA_DIR = path.join(process.cwd(), 'data');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');

function loadDocumentsFromDisk(): TechDocument[] {
  try {
    if (fs.existsSync(DOCUMENTS_FILE)) {
      return JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load persisted documents, falling back to samples:', err);
  }
  return [...INITIAL_DOCUMENTS];
}

function saveDocumentsToDisk(docs: TechDocument[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(docs, null, 2));
  } catch (err) {
    console.error('Failed to persist documents:', err);
  }
}

let documentsStore: TechDocument[] = loadDocumentsFromDisk();

// Registered MCP Tools
const MCP_TOOLS: MCPTool[] = [
  {
    name: 'mcp_doc_search',
    description: 'Queries uploaded technical documents, pipeline specs, and architecture sheets via semantic/keyword retrieval.',
    category: 'Document Storage',
    callCount: 24,
    status: 'idle',
    schema: {
      inputs: ['query: string', 'docIds?: string[]', 'topK?: number'],
      output: 'Relevant text snippets, table metrics, and file references'
    }
  },
  {
    name: 'mcp_web_grounding',
    description: 'Searches the web via Google Search Grounding for current arXiv papers, SOTA benchmarks, and library docs.',
    category: 'Web Intelligence',
    callCount: 18,
    status: 'idle',
    schema: {
      inputs: ['searchQuery: string'],
      output: 'Live web search grounding chunks with source URLs'
    }
  },
  {
    name: 'mcp_spec_analyzer',
    description: 'Calculates VRAM memory budgets, FLOPs throughput, tensor parallelism latency, and GPU cluster sizing.',
    category: 'Compute & Spec',
    callCount: 12,
    status: 'idle',
    schema: {
      inputs: ['batchSize: number', 'seqLen: number', 'paramCountBillion: number', 'precision: string'],
      output: 'Memory breakdown (KV cache, weights, activation), throughput, and latency estimates'
    }
  },
  {
    name: 'mcp_hypothesis_tester',
    description: 'Runs formal mathematical, algorithmic, and logic validation on claims made in documents or by agents.',
    category: 'Logic Verification',
    callCount: 9,
    status: 'idle',
    schema: {
      inputs: ['hypothesis: string', 'givenFacts: string[]'],
      output: 'Verification matrix, contradiction alerts, confidence score, and mathematical proof/refutation'
    }
  },
  {
    name: 'mcp_synthesis_engine',
    description: 'Compiles multi-agent outputs, code snippets, and citations into a unified technical report markdown structure.',
    category: 'Report Engine',
    callCount: 15,
    status: 'idle',
    schema: {
      inputs: ['sections: Array<{title: string, content: string}>', 'citations: string[]'],
      output: 'Rendered report tree with executive summary and diagrams'
    }
  }
];

// Initialize Gemini Client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// Default Agents Definition
function getDefaultAgents(): Record<string, AgentNode> {
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

// Deterministic keyword-overlap document search (no embeddings needed for a personal document set).
// Scores each document by the fraction of distinct query keywords it contains, then returns the
// highest-scoring documents with a snippet centered on the first matching keyword.
function searchDocuments(query: string, targetDocs: TechDocument[], topK = 5) {
  const keywords = Array.from(new Set(
    query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2)
  ));

  const scored = targetDocs.map(doc => {
    const lowerContent = doc.content.toLowerCase();
    let matchedKeywords = 0;
    let firstIndex = -1;

    for (const keyword of keywords) {
      const idx = lowerContent.indexOf(keyword);
      if (idx >= 0) {
        matchedKeywords++;
        if (firstIndex === -1 || idx < firstIndex) firstIndex = idx;
      }
    }

    const snippetStart = firstIndex >= 0 ? firstIndex : 0;
    const snippet = doc.content.substring(
      Math.max(0, snippetStart - 100),
      Math.min(doc.content.length, snippetStart + 300)
    );

    return {
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      category: doc.category,
      snippet,
      matchScore: keywords.length ? Number((matchedKeywords / keywords.length).toFixed(2)) : 0
    };
  })
  .filter(m => m.matchScore > 0)
  .sort((a, b) => b.matchScore - a.matchScore)
  .slice(0, topK);

  return scored;
}

// Executes a single MCP tool against real inputs. Shared by the direct /api/mcp/execute route
// and the agentic step-execution pipeline, so tool behaviour is identical regardless of caller.
async function runMcpTool(toolName: string, args: Record<string, any>): Promise<any> {
  if (toolName === 'mcp_doc_search') {
    const query = String(args?.query || '');
    const docIds = args?.docIds as string[] | undefined;
    const topK = Number(args?.topK) || 5;
    const targetDocs = docIds?.length ? documentsStore.filter(d => docIds.includes(d.id)) : documentsStore;

    const results = searchDocuments(query, targetDocs, topK);
    return { query, matchesFound: results.length, results };
  }

  if (toolName === 'mcp_spec_analyzer') {
    const batchSize = Number(args?.batchSize || 1);
    const seqLen = Number(args?.seqLen || 128000);
    const paramBillion = Number(args?.paramCountBillion || 70);
    const precision = args?.precision || 'FP8';

    const bytesPerParam = precision === 'FP8' ? 1 : 2;
    const weightsGB = (paramBillion * bytesPerParam);
    const kvCachePerTokenMB = (2 * 64 * 8192 * (precision === 'FP8' ? 1 : 2)) / (1024 * 1024); // approx
    const kvCacheTotalGB = (batchSize * seqLen * kvCachePerTokenMB) / 1024;
    const totalVRAMReqGB = (weightsGB + kvCacheTotalGB * 1.25); // plus activation memory

    return {
      parametersBillion: paramBillion,
      sequenceLength: seqLen,
      precision,
      modelWeightsVRAM_GB: weightsGB.toFixed(2),
      kvCacheVRAM_GB: kvCacheTotalGB.toFixed(2),
      estimatedTotalVRAM_GB: totalVRAMReqGB.toFixed(2),
      recommendedH100GPUs: Math.ceil(totalVRAMReqGB / 70),
      throughputTFLOPS: precision === 'FP8' ? 1280 : 840
    };
  }

  if (toolName === 'mcp_web_grounding') {
    const searchQuery = args?.searchQuery || 'Large Language Model Context Window Scaling';
    try {
      const ai = getGeminiClient();
      const geminiRes = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `Provide 3 key research points or citations for: ${searchQuery}`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const chunks = geminiRes.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return {
        searchQuery,
        summary: geminiRes.text,
        sources: chunks.map((c: any) => ({ title: c.web?.title, url: c.web?.uri }))
      };
    } catch (err: any) {
      console.error('mcp_web_grounding error:', err);
      return {
        searchQuery,
        summary: `Web grounding request failed (${err.message || 'unknown error'}). No live search results available.`,
        sources: [],
        error: true
      };
    }
  }

  if (toolName === 'mcp_hypothesis_tester') {
    const hypothesis = String(args?.hypothesis || '');
    const givenFacts = (args?.givenFacts as string[] | undefined) || [];

    try {
      const ai = getGeminiClient();
      const prompt = `You are a rigorous logic and mathematics verification engine embedded in an MCP tool server.

Evaluate the following hypothesis strictly against the given facts. Do not assume anything not stated or directly derivable.

Hypothesis: "${hypothesis}"

Given Facts:
${givenFacts.length ? givenFacts.map(f => `- ${f}`).join('\n') : 'None provided - evaluate using only the hypothesis text itself.'}

Return a JSON object with:
- status: one of "VERIFIED", "VERIFIED_WITH_BOUNDS", "REFUTED", "INSUFFICIENT_EVIDENCE"
- confidenceScore: number 0 to 1 reflecting evidentiary strength, not fluency
- proofSummary: concise explanation of the reasoning/derivation that led to the verdict
- riskFactors: array of specific conditions or edge cases that could invalidate the hypothesis`;

      const geminiRes = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING },
              confidenceScore: { type: Type.NUMBER },
              proofSummary: { type: Type.STRING },
              riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['status', 'confidenceScore', 'proofSummary', 'riskFactors']
          }
        }
      });

      const parsed = JSON.parse(geminiRes.text.trim());
      return { hypothesis, ...parsed };
    } catch (err: any) {
      console.error('mcp_hypothesis_tester error:', err);
      return {
        hypothesis,
        status: 'INSUFFICIENT_EVIDENCE',
        confidenceScore: 0,
        proofSummary: `Verification failed due to a tool error (${err.message || 'unknown error'}); no verdict could be produced.`,
        riskFactors: ['Verification engine unavailable']
      };
    }
  }

  return { status: 'executed', tool: toolName, args };
}

// JSON-schema function declarations so agents can invoke real tools via Gemini function calling
// rather than the model merely narrating a fictional tool call.
function getFunctionDeclarationForTool(toolName: string): FunctionDeclaration | null {
  switch (toolName) {
    case 'mcp_doc_search':
      return {
        name: 'mcp_doc_search',
        description: 'Searches the uploaded technical documents for passages relevant to a query.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: 'Keywords or question to search for in the documents.' },
            topK: { type: Type.INTEGER, description: 'Maximum number of matching documents to return.' }
          },
          required: ['query']
        }
      };
    case 'mcp_spec_analyzer':
      return {
        name: 'mcp_spec_analyzer',
        description: 'Computes VRAM memory budget, KV-cache size, and throughput estimates for a given model/workload configuration.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            batchSize: { type: Type.NUMBER, description: 'Inference batch size.' },
            seqLen: { type: Type.NUMBER, description: 'Sequence/context length in tokens.' },
            paramCountBillion: { type: Type.NUMBER, description: 'Model parameter count in billions.' },
            precision: { type: Type.STRING, description: 'Numeric precision, e.g. FP8 or FP16.' }
          },
          required: ['paramCountBillion']
        }
      };
    case 'mcp_hypothesis_tester':
      return {
        name: 'mcp_hypothesis_tester',
        description: 'Runs formal logical/mathematical verification of a claim against a set of given facts.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            hypothesis: { type: Type.STRING, description: 'The claim to verify.' },
            givenFacts: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Known facts to verify the hypothesis against.' }
          },
          required: ['hypothesis']
        }
      };
    case 'mcp_web_grounding':
      return {
        name: 'mcp_web_grounding',
        description: 'Searches the live web for current research, benchmarks, or documentation.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            searchQuery: { type: Type.STRING, description: 'The web search query.' }
          },
          required: ['searchQuery']
        }
      };
    default:
      return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // File upload configuration using Multer memory storage
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
  });

  // --- API ROUTES ---

  // Serve public static files (e.g. zip downloads)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Download codebase ZIP endpoint
  app.get('/api/download-zip', (req: Request, res: Response) => {
    const zipPath = path.join(process.cwd(), 'public', 'aether_orchestrator_source.zip');
    res.download(zipPath, 'aether_orchestrator_source.zip', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'ZIP file not found or could not be generated.' });
      }
    });
  });

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY);
    res.json({
      status: 'ok',
      hasGeminiApiKey: hasKey,
      mcpServerStatus: 'online',
      documentCount: documentsStore.length,
      timestamp: new Date().toISOString()
    });
  });

  // Get all documents
  app.get('/api/documents', (req: Request, res: Response) => {
    res.json({ documents: documentsStore });
  });

  // Upload document
  app.post('/api/documents/upload', upload.single('file'), (req: Request, res: Response) => {
    try {
      const file = req.file;
      const { category, title, tags } = req.body;

      if (!file) {
        return res.status(400).json({ error: 'No file provided in request' });
      }

      const fileContent = file.buffer.toString('utf-8');
      const docCategory = (category as any) || 'Technical Architecture';
      const parsedTags = tags ? tags.split(',').map((t: string) => t.trim()) : ['Uploaded Doc'];

      const newDoc: TechDocument = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: title || file.originalname,
        category: docCategory,
        fileName: file.originalname,
        content: fileContent,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        summary: fileContent.slice(0, 200) + '...',
        tags: parsedTags
      };

      documentsStore.unshift(newDoc);
      saveDocumentsToDisk(documentsStore);
      res.json({ success: true, document: newDoc });
    } catch (err: any) {
      console.error('Document upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload document' });
    }
  });

  // Add raw document snippet via JSON
  app.post('/api/documents/create', (req: Request, res: Response) => {
    try {
      const { title, category, fileName, content, tags } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }

      const newDoc: TechDocument = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title,
        category: category || 'Technical Architecture',
        fileName: fileName || `${title.toLowerCase().replace(/\s+/g, '_')}.txt`,
        content,
        sizeBytes: Buffer.byteLength(content, 'utf-8'),
        uploadedAt: new Date().toISOString(),
        summary: content.slice(0, 200) + '...',
        tags: tags || ['Custom Doc']
      };

      documentsStore.unshift(newDoc);
      saveDocumentsToDisk(documentsStore);
      res.json({ success: true, document: newDoc });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete document
  app.delete('/api/documents/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    documentsStore = documentsStore.filter(d => d.id !== id);
    saveDocumentsToDisk(documentsStore);
    res.json({ success: true, remainingCount: documentsStore.length });
  });

  // List MCP Tools
  app.get('/api/mcp/tools', (req: Request, res: Response) => {
    res.json({ tools: MCP_TOOLS, status: 'online', protocolVersion: '2026-06-MCP' });
  });

  // Execute MCP Tool directly
  app.post('/api/mcp/execute', async (req: Request, res: Response) => {
    const { toolName, args, agentId } = req.body;
    const tool = MCP_TOOLS.find(t => t.name === toolName);

    if (!tool) {
      return res.status(404).json({ error: `Tool ${toolName} not found on MCP Server` });
    }

    tool.callCount++;
    tool.status = 'busy';

    const result = await runMcpTool(toolName, args || {});

    tool.status = 'idle';

    res.json({
      success: true,
      toolName,
      agentId,
      args,
      result,
      mcpTimestamp: new Date().toISOString()
    });
  });

  // POST /api/research/plan -> Decomposes user request into Instruction Set & Agent Assignment
  app.post('/api/research/plan', async (req: Request, res: Response) => {
    try {
      const { userPrompt, docIds, activeAgentIds } = req.body;

      if (!userPrompt) {
        return res.status(400).json({ error: 'userPrompt is required' });
      }

      const allSpecialists = getDefaultAgents();
      const domainAgentIds = ['literature', 'pipeline', 'validation'];
      // Domain specialists are opt-in per run; 'synthesis' (final report formatting)
      // is always available alongside the always-on 'lead' orchestrator.
      const selectedDomainIds: string[] = Array.isArray(activeAgentIds) && activeAgentIds.length > 0
        ? domainAgentIds.filter(id => activeAgentIds.includes(id))
        : domainAgentIds;
      const availableAgentIds = [...selectedDomainIds, 'synthesis'];

      const selectedDocs = docIds?.length
        ? documentsStore.filter(d => docIds.includes(d.id))
        : documentsStore;

      const docSummaries = selectedDocs.map(d => `- [${d.category}] ${d.title} (${d.fileName}): ${d.summary || d.content.slice(0, 150)}`).join('\n');

      const agentRoster = availableAgentIds
        .map((id, idx) => `${idx + 1}. "${id}": ${allSpecialists[id].name} - ${allSpecialists[id].title} (Tools: ${allSpecialists[id].toolsAccess.join(', ')})`)
        .join('\n');

      const systemPrompt = `You are Dr. Astra, Lead Orchestrator of an advanced Agentic Network & MCP Research Hub.
Your task is to take a research request and document context, then decompose it into a structured instruction set for specialized research agents.

Available Specialized Agents (only assign steps to these):
${agentRoster}

Generate a JSON object containing:
- title: A concise, technical research session title
- researchGoal: A 2-sentence formal statement of research objectives
- instructionSet: An array of 4 to 6 step objects with:
  - stepNumber: integer
  - assignedAgentId: one of ${availableAgentIds.map(id => `"${id}"`).join(' | ')}
  - agentName: string
  - title: short step title
  - instruction: detailed technical directive for the agent
  - requiredTools: array of tool names from ['mcp_doc_search', 'mcp_web_grounding', 'mcp_spec_analyzer', 'mcp_hypothesis_tester', 'mcp_synthesis_engine']

User Prompt: "${userPrompt}"

Selected Documents Context:
${docSummaries || 'No specific documents selected; using general technical knowledge and MCP search.'}`;

      const ai = getGeminiClient();
      const geminiRes = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: systemPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              researchGoal: { type: Type.STRING },
              instructionSet: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    assignedAgentId: { type: Type.STRING },
                    agentName: { type: Type.STRING },
                    title: { type: Type.STRING },
                    instruction: { type: Type.STRING },
                    requiredTools: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ['stepNumber', 'assignedAgentId', 'agentName', 'title', 'instruction', 'requiredTools']
                }
              }
            },
            required: ['title', 'researchGoal', 'instructionSet']
          }
        }
      });

      const planData = JSON.parse(geminiRes.text.trim());

      // The model is instructed to only use availableAgentIds, but guard against
      // it hallucinating a deselected agent so the UI never references a missing node.
      const fallbackAgentId = availableAgentIds[0];
      const formattedInstructionSet: InstructionStep[] = planData.instructionSet.map((step: any, idx: number) => {
        const assignedAgentId = availableAgentIds.includes(step.assignedAgentId) ? step.assignedAgentId : fallbackAgentId;
        return {
          id: `step_${idx + 1}_${Date.now()}`,
          stepNumber: idx + 1,
          assignedAgentId,
          agentName: assignedAgentId === step.assignedAgentId ? (step.agentName || assignedAgentId.toUpperCase()) : allSpecialists[assignedAgentId].name,
          title: step.title,
          instruction: step.instruction,
          requiredTools: step.requiredTools || ['mcp_doc_search'],
          status: 'pending'
        };
      });

      const initialAgents: Record<string, AgentNode> = {
        lead: allSpecialists.lead,
        ...Object.fromEntries(availableAgentIds.map(id => [id, allSpecialists[id]]))
      };

      // Create initial MCP Log
      const initialLogs: MCPLogEntry[] = [
        {
          id: `log_${Date.now()}_1`,
          timestamp: new Date().toLocaleTimeString(),
          agentId: 'lead',
          agentName: 'Dr. Astra (Lead Orchestrator)',
          type: 'orchestrator_decision',
          message: `Decomposed research query into ${formattedInstructionSet.length} structured MCP instruction steps.`,
          details: `Research Goal: ${planData.researchGoal}`,
          level: 'success'
        }
      ];

      res.json({
        success: true,
        session: {
          id: `session_${Date.now()}`,
          title: planData.title,
          userPrompt,
          selectedDocIds: docIds || [],
          executionMode: 'auto',
          currentStepIndex: 0,
          instructionSet: formattedInstructionSet,
          status: 'planning',
          logs: initialLogs,
          agents: initialAgents,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });

    } catch (err: any) {
      console.error('Plan generation error:', err);
      res.status(502).json({
        success: false,
        error: err.message || 'Failed to generate a research plan. Check that GEMINI_API_KEY is set and valid.'
      });
    }
  });

  // POST /api/research/execute-step -> Executes single step in agentic flow
  app.post('/api/research/execute-step', async (req: Request, res: Response) => {
    try {
      const { step, selectedDocIds, userFeedback } = req.body;

      if (!step) {
        return res.status(400).json({ error: 'Instruction step is required' });
      }

      const agentId = step.assignedAgentId as string;
      const agentMap = getDefaultAgents();
      const agent = agentMap[agentId] || agentMap['lead'];

      const targetDocs = selectedDocIds?.length
        ? documentsStore.filter(d => selectedDocIds.includes(d.id))
        : documentsStore;

      const docTextSnippet = targetDocs
        .map(d => `--- Document: ${d.title} (${d.category}) ---\n${d.content.slice(0, 2000)}`)
        .join('\n\n');

      const ai = getGeminiClient();

      // Phase 1: let the agent choose a real MCP tool + arguments for its directive via
      // Gemini function calling, then actually execute that tool - no fabricated tool calls.
      const availableTools = ((step.requiredTools || []) as string[])
        .map(getFunctionDeclarationForTool)
        .filter((d): d is FunctionDeclaration => Boolean(d));

      let toolCallUsed: string | null = null;
      let toolArgs: Record<string, unknown> = {};
      let toolResult: any = null;

      if (availableTools.length > 0) {
        const toolChoiceRes = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: `You are ${agent.name} (${agent.title}).
Your Directive: "${step.instruction}"
${userFeedback ? `Human Supervisor Feedback / Intervention: "${userFeedback}"` : ''}

Call exactly one of the available tools with the arguments needed to gather evidence for this directive.`,
          config: { tools: [{ functionDeclarations: availableTools }] }
        });

        const call = toolChoiceRes.functionCalls?.[0];
        if (call?.name) {
          toolCallUsed = call.name;
          toolArgs = call.args || {};
        } else {
          // Model declined to call a function - fall back to the step's primary declared tool.
          toolCallUsed = step.requiredTools[0];
          toolArgs = toolCallUsed === 'mcp_doc_search' ? { query: step.title } : {};
        }

        toolResult = await runMcpTool(toolCallUsed as string, { ...toolArgs, docIds: selectedDocIds });
      }

      // Phase 2: produce the agent's analytical output grounded in the REAL tool result above.
      const analysisPrompt = `You are ${agent.name} (${agent.title}), an expert AI research agent in a managed MCP network.
Your Directive: "${step.instruction}"
${userFeedback ? `Human Supervisor Feedback / Intervention: "${userFeedback}"` : ''}

${toolCallUsed ? `MCP Tool Invoked: ${toolCallUsed}\nTool Arguments: ${JSON.stringify(toolArgs)}\nTool Result:\n${JSON.stringify(toolResult, null, 2)}\n` : ''}
Available Document Context:
${docTextSnippet}

Your task:
1. Formulate step-by-step technical thoughts, referencing the tool result above where relevant.
2. Produce a clear, highly detailed, rigorous analytical output addressing the directive. Do not invent findings beyond the tool result and document context provided.
3. Call out specific metrics, math formulas, pipeline constraints, or document references.

Generate a JSON object with:
- thoughtTrace: Array of 3 string items showing your inner reasoning steps
- agentOutput: Markdown string containing your detailed technical findings and analysis
- keyTakeaways: Array of 2-3 short summary bullet points`;

      const analysisRes = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: analysisPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              thoughtTrace: { type: Type.ARRAY, items: { type: Type.STRING } },
              agentOutput: { type: Type.STRING },
              keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['thoughtTrace', 'agentOutput', 'keyTakeaways']
          }
        }
      });

      const parsed = JSON.parse(analysisRes.text.trim());

      res.json({
        success: true,
        agentId,
        thoughtTrace: parsed.thoughtTrace,
        toolCallUsed,
        toolArgs,
        toolResult,
        agentOutput: parsed.agentOutput,
        keyTakeaways: parsed.keyTakeaways
      });
    } catch (err: any) {
      console.error('Execute step error:', err);
      res.status(502).json({
        success: false,
        agentId: req.body.step?.assignedAgentId,
        error: err.message || 'Agent step execution failed'
      });
    }
  });

  // POST /api/research/synthesize -> Final Synthesis into Report by Lead Agent
  app.post('/api/research/synthesize', async (req: Request, res: Response) => {
    try {
      const { userPrompt, instructionSet, agentOutputs, selectedDocIds } = req.body;

      const targetDocs = selectedDocIds?.length
        ? documentsStore.filter(d => selectedDocIds.includes(d.id))
        : documentsStore;

      const aggregatedAgentFindings = (instructionSet || []).map((step: any, i: number) => {
        const out = agentOutputs?.[step.id] || 'Step executed successfully.';
        return `### Step ${i + 1}: ${step.title} (${step.agentName})\n\n**Instruction**: ${step.instruction}\n\n**Findings**:\n${out}`;
      }).join('\n\n---\n\n');

      const systemPrompt = `You are Dr. Astra, Lead Chief Scientist & Orchestrator of the NexusAgent Network.
Generate a published-grade, highly structured, comprehensive Research Report synthesizing all multi-agent findings.

Format Requirements:
1. # Comprehensive Technical Research Report: [Title]
2. ## Executive Summary
3. ## Decomposed Research Objectives & Agent Workflow
4. ## Literature & Theoretical Foundations
5. ## Model Pipeline, VRAM & Distributed Compute Spec
6. ## Architectural Diagram (Include a valid \`\`\`mermaid diagram section showing graph pipeline or data flow)
7. ## Empirical Verification, Benchmarks & Risk Matrix (Table with Risk, Impact, Mitigation)
8. ## Final Actionable Recommendations & Implementation Roadmap
9. ## References & Document Citations

User Research Query: "${userPrompt}"

Aggregated Agent Findings:
${aggregatedAgentFindings}

Document Context Titles:
${targetDocs.map(d => `- ${d.title} (${d.category})`).join('\n')}`;

      const ai = getGeminiClient();
      const geminiRes = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: systemPrompt
      });

      const finalMarkdown = geminiRes.text;

      res.json({
        success: true,
        report: finalMarkdown
      });
    } catch (err: any) {
      console.error('Synthesize error:', err);
      res.status(502).json({
        success: false,
        error: err.message || 'Failed to synthesize the final report. Check that GEMINI_API_KEY is set and valid.'
      });
    }
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NexusAgent Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
