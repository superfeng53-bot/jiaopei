export type AIProvider = 'google' | 'openai' | 'deepseek' | 'qwen' | 'yi';

export interface AIModelConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  stage1Model: string; // Knowledge point extraction
  stage2Model: string; // Detailed options
  stage3Model: string; // Final report
}

export const DEFAULT_CONFIG: AIModelConfig = {
  provider: 'google',
  apiKey: '', // Will use process.env.GEMINI_API_KEY if empty and provider is google
  stage1Model: 'gemini-3-flash-preview',
  stage2Model: 'gemini-3.1-pro-preview',
  stage3Model: 'gemini-3.1-pro-preview',
};

export const PROVIDER_OPTIONS: { value: AIProvider; label: string; baseUrl?: string; defaultModels: string[] }[] = [
  { 
    value: 'google', 
    label: 'Google Gemini', 
    defaultModels: ['gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview'] 
  },
  { 
    value: 'openai', 
    label: 'OpenAI', 
    baseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'] 
  },
  { 
    value: 'deepseek', 
    label: 'DeepSeek (深度求索)', 
    baseUrl: 'https://api.deepseek.com',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'] 
  },
  { 
    value: 'qwen', 
    label: '阿里通义千问 (Qwen)', 
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModels: ['qwen-plus', 'qwen-max', 'qwen-turbo'] 
  },
  { 
    value: 'yi', 
    label: '零一万物 (Yi)', 
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    defaultModels: ['yi-lightning', 'yi-large', 'yi-medium'] 
  }
];

export function getAIConfig(): AIModelConfig {
  const saved = localStorage.getItem('ai_model_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

export function saveAIConfig(config: AIModelConfig) {
  localStorage.setItem('ai_model_config', JSON.stringify(config));
}
