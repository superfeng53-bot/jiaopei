import React, { useState, useEffect } from 'react';
import { X, Save, Settings, Key, Cpu, Globe } from 'lucide-react';
import { AIModelConfig, PROVIDER_OPTIONS, getAIConfig, saveAIConfig, AIProvider } from '../lib/aiConfig';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<AIModelConfig>(getAIConfig());
  const [showSuccess, setShowSuccess] = useState(false);

  const currentProvider = PROVIDER_OPTIONS.find(p => p.value === config.provider);

  const handleSave = () => {
    saveAIConfig(config);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 1500);
  };

  const handleProviderChange = (provider: AIProvider) => {
    const option = PROVIDER_OPTIONS.find(p => p.value === provider);
    if (option) {
      setConfig({
        ...config,
        provider,
        stage1Model: option.recommendedModels.stage1,
        stage2Model: option.recommendedModels.stage2,
        stage3Model: option.recommendedModels.stage3,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">AI 模型配置</h2>
                <p className="text-sm text-gray-500">配置不同阶段使用的 AI 服务商与模型</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
            {/* Provider Selection */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <Globe className="w-4 h-4 text-blue-500" /> 服务提供商
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PROVIDER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleProviderChange(opt.value)}
                    className={`p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                      config.provider === opt.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-100 hover:border-blue-200 text-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key & Base URL */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <Key className="w-4 h-4 text-blue-500" /> API 密钥 (API Key)
                </label>
                <input
                  type="password"
                  value={config.apiKeys[config.provider] || ''}
                  onChange={e => setConfig({ 
                    ...config, 
                    apiKeys: { ...config.apiKeys, [config.provider]: e.target.value } 
                  })}
                  placeholder={config.provider === 'google' ? '留空则使用系统默认密钥' : '请输入您的 API Key'}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>

              {config.provider !== 'google' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">API 代理地址 (Base URL)</label>
                  <input
                    type="text"
                    value={config.baseUrls[config.provider] || ''}
                    onChange={e => setConfig({ 
                      ...config, 
                      baseUrls: { ...config.baseUrls, [config.provider]: e.target.value } 
                    })}
                    placeholder="https://api.example.com/v1"
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              )}
            </div>

            {/* Model Selection for Stages */}
            <div className="space-y-6">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <Cpu className="w-4 h-4 text-blue-500" /> 阶段模型配置
              </label>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-700">阶段 1: 知识点提取</span>
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">建议使用快速模型</span>
                  </div>
                  <select
                    value={config.stage1Model}
                    onChange={e => setConfig({ ...config, stage1Model: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {currentProvider?.defaultModels.map(m => <option key={m} value={m}>{m}</option>)}
                    <option value={config.stage1Model}>自定义: {config.stage1Model}</option>
                  </select>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-700">阶段 2: 评价维度生成</span>
                    <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">建议使用平衡模型</span>
                  </div>
                  <select
                    value={config.stage2Model}
                    onChange={e => setConfig({ ...config, stage2Model: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {currentProvider?.defaultModels.map(m => <option key={m} value={m}>{m}</option>)}
                    <option value={config.stage2Model}>自定义: {config.stage2Model}</option>
                  </select>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-700">阶段 3: 最终报告生成</span>
                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">建议使用最强模型</span>
                  </div>
                  <select
                    value={config.stage3Model}
                    onChange={e => setConfig({ ...config, stage3Model: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {currentProvider?.defaultModels.map(m => <option key={m} value={m}>{m}</option>)}
                    <option value={config.stage3Model}>自定义: {config.stage3Model}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              {showSuccess ? '已保存！' : <><Save className="w-4 h-4" /> 保存配置</>}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
