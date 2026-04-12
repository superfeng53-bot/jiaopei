export type AIProvider = 'google' | 'openai' | 'deepseek' | 'qwen' | 'doubao' | 'zhipu';

export interface AIModelConfig {
  provider: AIProvider;
  apiKeys: Record<string, string>;
  baseUrls: Record<string, string>;
  stage1Model: string; // Knowledge point extraction
  stage2Model: string; // Detailed options
  stage3Model: string; // Final report
}

export const DEFAULT_CONFIG: AIModelConfig = {
  provider: 'google',
  apiKeys: {
    google: '',
    openai: '',
    deepseek: '',
    qwen: '',
    doubao: '',
    zhipu: '',
  },
  baseUrls: {
    google: '',
    openai: 'https://api.openai.com/v1',
    deepseek: 'https://api.deepseek.com',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    doubao: 'https://ark.cn-beijing.volces.com/api/v3',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  },
  stage1Model: 'gemini-1.5-flash',
  stage2Model: 'gemini-1.5-pro',
  stage3Model: 'gemini-1.5-pro',
};

export const PROVIDER_OPTIONS: { 
  value: AIProvider; 
  label: string; 
  baseUrl: string; 
  defaultModels: string[];
  recommendedModels: { stage1: string; stage2: string; stage3: string };
}[] = [
  { 
    value: 'google', 
    label: 'Google Gemini', 
    baseUrl: '',
    defaultModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
    recommendedModels: { stage1: 'gemini-1.5-flash', stage2: 'gemini-1.5-pro', stage3: 'gemini-1.5-pro' }
  },
  { 
    value: 'openai', 
    label: 'OpenAI', 
    baseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini'],
    recommendedModels: { stage1: 'gpt-4o-mini', stage2: 'gpt-4o', stage3: 'gpt-4o' }
  },
  { 
    value: 'deepseek', 
    label: 'DeepSeek (深度求索)', 
    baseUrl: 'https://api.deepseek.com',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    recommendedModels: { stage1: 'deepseek-chat', stage2: 'deepseek-chat', stage3: 'deepseek-chat' }
  },
  { 
    value: 'qwen', 
    label: '阿里通义千问 (Qwen)', 
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModels: ['qwen-flash', 'qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'],
    recommendedModels: { stage1: 'qwen-flash', stage2: 'qwen-plus', stage3: 'qwen-plus' }
  },
  { 
    value: 'doubao', 
    label: '字节豆包 (Doubao)', 
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModels: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-pro-128k', 'doubao-lite-4k'],
    recommendedModels: { stage1: 'doubao-lite-4k', stage2: 'doubao-pro-32k', stage3: 'doubao-pro-32k' }
  },
  { 
    value: 'zhipu', 
    label: '智谱 AI (GLM)', 
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModels: ['glm-4-plus', 'glm-4-0520', 'glm-4-air', 'glm-4-flash'],
    recommendedModels: { stage1: 'glm-4-flash', stage2: 'glm-4-plus', stage3: 'glm-4-plus' }
  }
];

export function getAIConfig(): AIModelConfig {
  const saved = localStorage.getItem('ai_model_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Migration logic for old config structure
      if (parsed.apiKey !== undefined) {
        const newConfig: AIModelConfig = {
          ...DEFAULT_CONFIG,
          provider: parsed.provider || DEFAULT_CONFIG.provider,
          stage1Model: parsed.stage1Model || DEFAULT_CONFIG.stage1Model,
          stage2Model: parsed.stage2Model || DEFAULT_CONFIG.stage2Model,
          stage3Model: parsed.stage3Model || DEFAULT_CONFIG.stage3Model,
        };
        if (parsed.provider) {
          newConfig.apiKeys[parsed.provider] = parsed.apiKey;
          if (parsed.baseUrl) newConfig.baseUrls[parsed.provider] = parsed.baseUrl;
        }
        return newConfig;
      }
      return parsed;
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

export function saveAIConfig(config: AIModelConfig) {
  localStorage.setItem('ai_model_config', JSON.stringify(config));
}
