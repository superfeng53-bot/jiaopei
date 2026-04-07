/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import FeedbackWizard from './components/FeedbackWizard';
import { SettingsModal } from './components/SettingsModal';
import { Sparkles, BookOpen, GraduationCap, Settings } from 'lucide-react';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-700">
      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI 课后反馈助手</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Teacher's Smart Assistant</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-500">
          <a href="#" className="hover:text-blue-600 transition-colors">使用指南</a>
          <a href="#" className="hover:text-blue-600 transition-colors">学生管理</a>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-200 hover:text-blue-600 transition-all group"
          >
            <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
            AI 配置
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Intro */}
          <div className="lg:col-span-4 space-y-8 pt-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> 智能生成反馈
              </div>
              <h2 className="text-4xl font-extrabold text-slate-900 leading-tight">
                让每一次反馈<br />
                都充满<span className="text-blue-600">温度与智慧</span>
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                上传课件，AI 自动提取知识点。通过简单的点击，为每位学生生成专业、详细且具有针对性的课后报告。
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">多模态分析</h3>
                  <p className="text-sm text-slate-500">支持 PDF, Word, 图片等多种课件格式</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">上下文增强</h3>
                  <p className="text-sm text-slate-500">结合历史反馈，生成更具连续性的建议</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Wizard */}
          <div className="lg:col-span-8">
            <FeedbackWizard />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <GraduationCap className="w-5 h-5" />
            <span className="font-bold">AI 课后反馈助手</span>
          </div>
          <p className="text-sm text-slate-500">© 2026 教师智能助手. 让教学更轻松，让反馈更高效。</p>
        </div>
      </footer>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}
