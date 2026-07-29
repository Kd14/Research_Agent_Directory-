import { useEffect, useState } from 'react';
import * as api from '../services/api';
import type { MCPTool } from '../types';

export function useMcpTools() {
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.fetchMcpTools();
        if (data.tools) {
          setMcpTools(data.tools);
        }
      } catch (err) {
        console.error('Failed to fetch MCP tools:', err);
      }
    })();
  }, []);

  const executeToolDirect = async (toolName: string, args: Record<string, any>) => {
    return api.executeMcpTool(toolName, args, 'user_direct');
  };

  return { mcpTools, executeToolDirect };
}
