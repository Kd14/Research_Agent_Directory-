import fs from 'fs';
import path from 'path';

const PROMPTS_DIR = path.join(process.cwd(), 'server', 'prompts');
const VERSION_COMMENT_PATTERN = /^<!--\s*version:\s*\d+\s*-->\n?/;

const promptCache = new Map<string, string>();

export function loadPrompt(name: string): string {
  const cached = promptCache.get(name);
  if (cached !== undefined) return cached;

  const filePath = path.join(PROMPTS_DIR, `${name}.md`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const template = raw.replace(VERSION_COMMENT_PATTERN, '').trimEnd();

  promptCache.set(name, template);
  return template;
}

export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match;
  });
}
