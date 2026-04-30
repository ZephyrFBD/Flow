import type {
  KnowledgeTreeFile,
  TreeListItem,
  LLMProviderStatus,
  LLMConfig,
} from '../types';

const BASE = '/api/v1';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Knowledge Tree ---

export async function generateTree(
  prompt: string,
  pdfFile?: File,
  llmProvider?: string,
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const form = new FormData();
  if (prompt) form.append('prompt', prompt);
  if (pdfFile) form.append('pdf_file', pdfFile);
  if (llmProvider) form.append('llm_provider', llmProvider);

  const res = await fetch(`${BASE}/knowledge-tree/generate`, {
    method: 'POST',
    body: form,
    signal,
  });
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
  return res.body!;
}

export async function refineTree(
  treeId: string,
  prompt: string,
  pdfFile?: File,
  mode: 'inplace' | 'derive' = 'inplace',
  llmProvider?: string
): Promise<KnowledgeTreeFile> {
  const form = new FormData();
  if (prompt) form.append('prompt', prompt);
  if (pdfFile) form.append('pdf_file', pdfFile);
  form.append('mode', mode);
  form.append('stream', 'false');
  if (llmProvider) form.append('llm_provider', llmProvider);

  return request(`/knowledge-tree/${treeId}/refine`, {
    method: 'PUT',
    body: form,
  });
}

export async function refineTreeStream(
  treeId: string,
  prompt: string,
  pdfFile?: File,
  mode: 'inplace' | 'derive' = 'inplace',
  llmProvider?: string,
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const form = new FormData();
  if (prompt) form.append('prompt', prompt);
  if (pdfFile) form.append('pdf_file', pdfFile);
  form.append('mode', mode);
  form.append('stream', 'true');
  if (llmProvider) form.append('llm_provider', llmProvider);

  const res = await fetch(`${BASE}/knowledge-tree/${treeId}/refine`, {
    method: 'PUT',
    body: form,
    signal,
  });
  if (!res.ok) throw new Error(`Refine failed: ${res.status}`);
  return res.body!;
}

export async function getTree(treeId: string): Promise<KnowledgeTreeFile> {
  return request(`/knowledge-tree/${treeId}`);
}

export async function updateNode(
  treeId: string,
  nodeId: string,
  data: Partial<{ title: string; description: string; keywords: string[]; completed: boolean }>
): Promise<KnowledgeTreeFile> {
  return request(`/knowledge-tree/${treeId}/node/${nodeId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function addNode(treeId: string, title: string, parentId = ''): Promise<KnowledgeTreeFile> {
  const form = new FormData();
  form.append('title', title);
  if (parentId) form.append('parent_id', parentId);
  const res = await fetch(`${BASE}/knowledge-tree/${treeId}/node`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Add node failed: ${res.status}`);
  return res.json();
}

export async function deleteNode(treeId: string, nodeId: string): Promise<KnowledgeTreeFile> {
  return request(`/knowledge-tree/${treeId}/node/${nodeId}`, { method: 'DELETE' });
}

export async function listTrees(): Promise<TreeListItem[]> {
  return request('/knowledge-trees');
}

export async function deleteTree(treeId: string): Promise<void> {
  return request(`/knowledge-tree/${treeId}`, { method: 'DELETE' });
}

// --- Questions ---

export async function generateQuestions(data: {
  tree_id: string;
  node_id?: string;
  types: string[];
  count: number;
  difficulty: string;
  extra_requirements?: string;
}): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${BASE}/questions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Generate questions failed: ${res.status}`);
  return res.body!;
}

export async function submitAnswer(
  questionId: string,
  userAnswer: string,
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${BASE}/questions/${questionId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_answer: userAnswer }),
    signal,
  });
  if (!res.ok) throw new Error(`Submit answer failed: ${res.status}`);
  return res.body!;
}

export async function updateQuestion(
  questionId: string,
  data: Partial<{ user_answer: string; is_correct: boolean; ai_score: number; explanation: string; suggestion: string }>
): Promise<void> {
  return request(`/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// --- Project ---

export function getSaveUrl(treeId: string): string {
  return `${BASE}/project/save?tree_id=${treeId}`;
}

export async function loadProject(file: File): Promise<KnowledgeTreeFile> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/project/load`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Load project failed: ${res.status}`);
  return res.json();
}

// --- Config ---

export async function getProviders(): Promise<Record<string, LLMProviderStatus>> {
  return request('/config/llm-providers');
}

export async function getConfig(): Promise<LLMConfig> {
  return request('/config');
}

export async function setActiveProvider(provider: string): Promise<void> {
  return request('/config/active-provider', {
    method: 'PUT',
    body: JSON.stringify({ provider }),
  });
}

export async function updateProvider(
  provider: string,
  data: Partial<{ api_key: string; base_url: string; model: string }>
): Promise<void> {
  return request('/config/provider', {
    method: 'PUT',
    body: JSON.stringify({ provider, ...data }),
  });
}

// --- SSE helper ---

export function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: string, data: any) => void,
  onDone?: () => void,
  onError?: (err: Error) => void
) {
  const decoder = new TextDecoder();
  let buffer = '';

  function processLines() {
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent = '';
    let currentData = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        currentData = line.slice(6).trim();
      } else if (line === '') {
        if (currentEvent && currentData) {
          try {
            onEvent(currentEvent, JSON.parse(currentData));
          } catch {
            onEvent(currentEvent, currentData);
          }
        }
        currentEvent = '';
        currentData = '';
      }
    }
  }

  async function read() {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          processLines();
          onDone?.();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        processLines();
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  read();
}
