// TypeScript type definitions matching backend Pydantic models

export interface KnowledgeNode {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  completed: boolean;
  children: KnowledgeNode[];
}

export interface PromptRecord {
  timestamp: string;
  prompt_text: string | null;
  pdf_filename: string | null;
  mode: 'generate' | 'refine';
}

export interface ExampleQuestion {
  id: string;
  node_id: string;
  type: 'choice' | 'essay';
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  user_answer: string | null;
  is_correct: boolean | null;
  ai_score: number | null;
  suggestion?: string;
}

export interface QuestionConfig {
  types: ('choice' | 'essay')[];
  count: number;
  difficulty: 'easy' | 'medium' | 'hard';
  extra_requirements?: string;
}

export interface KnowledgeTreeFile {
  format_version: string;
  tree_id: string;
  title: string;
  version: number;
  parent_id: string | null;
  children_ids: string[];
  prompt_history: PromptRecord[];
  nodes: KnowledgeNode;
  questions: ExampleQuestion[];
  created_at: string;
  updated_at: string;
}

export interface TreeListItem {
  tree_id: string;
  title: string;
  version: number;
  updated_at: string;
  node_count: number;
  completed_count: number;
}

export interface LLMProviderStatus {
  model: string;
  configured: boolean;
  active: boolean;
}

export interface LLMConfig {
  active_provider: string;
  providers: Record<string, { base_url: string; model: string; configured: boolean }>;
}
