import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  User, 
  BookOpen, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  Plus, 
  Trash2, 
  FileText, 
  Image as ImageIcon, 
  File as FileIcon,
  Copy,
  RefreshCw,
  Sparkles,
  Eraser
} from 'lucide-react';
import { cn } from '../lib/utils';
import { parseFile } from '../lib/fileParser';
import { analyzeCourseContent, generateDetailedOptions, generateFeedbackReport, KnowledgePoint, FeedbackData, EvaluationOption } from '../lib/gemini';

type Step = 'student' | 'upload' | 'points' | 'rating' | 'result';

interface Student {
  id: string;
  name: string;
  history: string;
}

const SAMPLE_STUDENTS: Student[] = [
  { id: '1', name: '万麟炫', history: '工艺流程真题逐题精讲，带孩子梳理工艺流程的整体步骤' },
  { id: '2', name: '吴梓萱', history: '对上节课晶胞及其计算进行了简短复盘，系统梳理了四大晶体' },
  { id: '3', name: '黄峻崎', history: '醛、酮的结构与性质，并完成了部分羧酸相关内容的教学' },
];

const RATINGS = [
  { label: '优秀', value: 'Excellent', color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' },
  { label: '良好', value: 'Good', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
  { label: '一般', value: 'Average', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200' },
  { label: '需加强', value: 'Needs Improvement', color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' },
] as const;

export default function FeedbackWizard() {
  const [step, setStep] = useState<Step>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [customStudentName, setCustomStudentName] = useState('');
  const [historicalContext, setHistoricalContext] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<{ text: string; isImage: boolean; base64?: string } | null>(null);
  const [courseSummary, setCourseSummary] = useState('');
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [selectedPointIds, setSelectedPointIds] = useState<Set<string>>(new Set());
  const [selectedDimensions, setSelectedDimensions] = useState<Record<string, Set<string>>>({});
  const [performanceTags, setPerformanceTags] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, { aiLevels: number[]; customDimension: string; customLevel: number | null }>>({});
  const [performance, setPerformance] = useState('专注投入，课堂互动良好');
  const [homework, setHomework] = useState('完成课后练习，复习本次核心知识点');
  const [finalReport, setFinalReport] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setLoading(true);
    setError(null);

    try {
      const parsed = await parseFile(file);
      setFileContent(parsed);
      
      if (!parsed.isImage && !parsed.text.trim()) {
        throw new Error('无法从该文件中提取文字。如果是扫描版 PDF，请尝试将其转换为图片后上传。');
      }

      const analysis = await analyzeCourseContent(parsed.isImage ? parsed.base64! : parsed.text, parsed.isImage);
      setKnowledgePoints(analysis.knowledgePoints);
      setCourseSummary(analysis.summary);
      
      // Default select first 3 points initially
      const firstThreeIds = analysis.knowledgePoints.slice(0, 3).map(p => p.id);
      setSelectedPointIds(new Set(firstThreeIds));
      
      setStep('points');
    } catch (err: any) {
      setError(err.message || '文件解析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPoints = async () => {
    if (!fileContent || selectedPointIds.size === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const selectedPoints = knowledgePoints.filter(kp => selectedPointIds.has(kp.id));

      const details = await generateDetailedOptions(
        selectedPoints, 
        fileContent.isImage ? fileContent.base64! : fileContent.text, 
        fileContent.isImage
      );
      
      // Update knowledge points with generated options
      setKnowledgePoints(prev => prev.map(p => {
        const d = details.knowledgePoints.find(dp => dp.id === p.id);
        return d ? { ...p, options: d.options } : p;
      }));
      
      setPerformanceTags(details.performanceTags);
      
      // Initialize selected dimensions (default select the first one for each point)
      const initialDims: Record<string, Set<string>> = {};
      details.knowledgePoints.forEach(kp => {
        if (kp.options && kp.options.length > 0) {
          initialDims[kp.id] = new Set([kp.options[0].dimension]);
        } else {
          initialDims[kp.id] = new Set(['掌握程度']);
        }
      });
      setSelectedDimensions(initialDims);
      
      // Initialize default ratings for selected points
      const initialRatings: Record<string, { aiLevels: number[]; customDimension: string; customLevel: number | null }> = {};
      details.knowledgePoints.forEach(kp => {
        const numDims = kp.options?.length || 0;
        initialRatings[kp.id] = { aiLevels: Array(numDims).fill(1), customDimension: '', customLevel: null };
      });
      setRatings(initialRatings);
      
      setStep('rating');
    } catch (err: any) {
      setError(err.message || '生成评价维度失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedStudent && !customStudentName) return;
    setLoading(true);
    setError(null);

    const data: FeedbackData = {
      studentName: selectedStudent?.name || customStudentName,
      courseSummary: courseSummary,
      points: knowledgePoints
        .filter(kp => selectedPointIds.has(kp.id))
        .map(kp => {
          const rating = ratings[kp.id];
          const evaluations: any[] = [];
          const genericLevels = ['极佳', '较好', '一般', '模糊'];
          
          if (kp.options) {
            kp.options.forEach((opt, idx) => {
              // Only include if this dimension is selected
              if (selectedDimensions[kp.id]?.has(opt.dimension)) {
                const levelIdx = rating.aiLevels[idx];
                evaluations.push({
                  optionId: `ai-${idx}`,
                  levelIndex: levelIdx,
                  text: `${opt.dimension}：${opt.levels[levelIdx]}`
                });
              }
            });
          }
          
          if (rating.customDimension && rating.customLevel !== null) {
            evaluations.push({
              optionId: 'custom',
              levelIndex: rating.customLevel,
              text: `${rating.customDimension}：${genericLevels[rating.customLevel]}`
            });
          }

          return {
            point: kp.point,
            evaluations
          };
        }),
      performance,
      homework,
      historicalContext: selectedStudent?.history || historicalContext
    };

    try {
      const report = await generateFeedbackReport(data);
      setFinalReport(report);
      setStep('result');
    } catch (err: any) {
      setError(err.message || '报告生成失败');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    const handleSuccess = () => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(finalReport)
        .then(handleSuccess)
        .catch(() => fallbackCopy(finalReport, handleSuccess));
    } else {
      fallbackCopy(finalReport, handleSuccess);
    }
  };

  const fallbackCopy = (text: string, onSuccess: () => void) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      onSuccess();
    } catch (err) {
      console.error('Fallback copy failed', err);
      alert('复制失败，请手动选择文字复制。');
    }
    document.body.removeChild(textArea);
  };

  // Render Steps
  const renderStudentStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">选择学生</h2>
        <p className="text-gray-500">请选择或输入本次课程的学生信息</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SAMPLE_STUDENTS.map(s => (
          <button
            key={s.id}
            onClick={() => {
              setSelectedStudent(s);
              setHistoricalContext(s.history);
            }}
            className={cn(
              "p-4 rounded-xl border-2 text-left transition-all",
              selectedStudent?.id === s.id 
                ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" 
                : "border-gray-100 hover:border-blue-200 hover:bg-gray-50"
            )}
          >
            <User className="w-6 h-6 mb-2 text-blue-500" />
            <div className="font-semibold text-gray-900">{s.name}</div>
            <div className="text-xs text-gray-500 line-clamp-2 mt-1">{s.history}</div>
          </button>
        ))}
        <button
          onClick={() => setSelectedStudent(null)}
          className={cn(
            "p-4 rounded-xl border-2 border-dashed text-left transition-all",
            !selectedStudent ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"
          )}
        >
          <Plus className="w-6 h-6 mb-2 text-gray-400" />
          <div className="font-semibold text-gray-900">新学生</div>
          <div className="text-xs text-gray-500 mt-1">手动输入学生姓名</div>
        </button>
      </div>

      {!selectedStudent && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <input
            type="text"
            placeholder="请输入学生姓名"
            value={customStudentName}
            onChange={e => setCustomStudentName(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <textarea
            placeholder="历史反馈背景 (可选，帮助 AI 增强分析)"
            value={historicalContext}
            onChange={e => setHistoricalContext(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none h-24"
          />
        </motion.div>
      )}

      <div className="flex justify-end">
        <button
          disabled={!selectedStudent && !customStudentName}
          onClick={() => setStep('upload')}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          下一步 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderUploadStep = () => (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">上传课件</h2>
        <p className="text-gray-500">上传本次课程的 PPT、PDF、Word 或图片，AI 将自动分析知识点</p>
      </div>

      <div 
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf,.doc,.docx,.txt,image/*" 
          onChange={handleFileChange}
        />
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            {loading ? <Loader2 className="w-8 h-8 text-blue-600 animate-spin" /> : <Upload className="w-8 h-8 text-blue-600" />}
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-gray-900">点击或拖拽文件上传</p>
            <p className="text-sm text-gray-500">支持 PDF, Word, 图片 (JPG/PNG), 文本</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setStep('student')}
          className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-semibold transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> 上一步
        </button>
      </div>
    </div>
  );

  const renderPointsStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">选择本节课知识点</h2>
        <p className="text-gray-500">AI 已为您提取以下细致知识点，请勾选本次课程实际涵盖的内容</p>
      </div>

      <div className="flex justify-between items-center px-2">
        <div className="text-sm text-gray-500">已选择 {selectedPointIds.size} 个知识点</div>
        <div className="flex gap-4">
          <button 
            onClick={() => setSelectedPointIds(new Set(knowledgePoints.map(p => p.id)))}
            className="text-sm text-blue-600 hover:underline"
          >
            全选
          </button>
          <button 
            onClick={() => setSelectedPointIds(new Set())}
            className="text-sm text-gray-500 hover:underline"
          >
            全不选
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {knowledgePoints.map((kp, idx) => {
          const isSelected = selectedPointIds.has(kp.id);
          return (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={kp.id} 
              onClick={() => {
                const newIds = new Set(selectedPointIds);
                if (isSelected) newIds.delete(kp.id);
                else newIds.add(kp.id);
                setSelectedPointIds(newIds);
              }}
              className={cn(
                "flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer",
                isSelected 
                  ? "border-blue-500 bg-blue-50 shadow-sm" 
                  : "border-gray-100 bg-white hover:border-blue-200"
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300"
              )}>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="font-semibold text-gray-900">{kp.point}</div>
                <div className="text-xs text-gray-500">{kp.description}</div>
              </div>
            </motion.div>
          );
        })}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const newId = Date.now().toString();
            const defaultOptions: EvaluationOption[] = [
              { dimension: '核心概念理解与应用', levels: ['理解透彻应用自如', '理解清晰基本准确', '理解尚可偶有偏差', '理解模糊需加深印象'] },
              { dimension: '解题逻辑与思维严密性', levels: ['逻辑严密无懈可击', '逻辑清晰过程完整', '逻辑欠严密有小疏漏', '逻辑混乱错误较多'] },
              { dimension: '实验现象观察与描述', levels: ['观察细致描述科学', '观察到位描述准确', '观察不全描述欠妥', '观察缺失描述错误'] },
              { dimension: '计算准确度与单位规范', levels: ['计算精准书写规范', '计算准确基本规范', '计算有误书写不全', '计算混乱错误频发'] }
            ];
            const potentialDimensions = ['核心概念', '解题逻辑', '实验现象', '计算准确度'];
            setKnowledgePoints([...knowledgePoints, { id: newId, point: '自定义知识点', description: '描述教学目标', options: defaultOptions, potentialDimensions }]);
            const newIds = new Set(selectedPointIds);
            newIds.add(newId);
            setSelectedPointIds(newIds);
            // Initialize rating for the new point
            setRatings({ ...ratings, [newId]: { aiLevels: [1, 1, 1, 1], customDimension: '', customLevel: null } });
          }}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-blue-500 hover:border-blue-200 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> 手动添加知识点
        </button>
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={() => setStep('upload')}
          className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-semibold transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> 上一步
        </button>
        <button
          disabled={loading || selectedPointIds.size === 0}
          onClick={handleConfirmPoints}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          确认并下一步 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderRatingStep = () => {
    const selectedPoints = knowledgePoints.filter(kp => selectedPointIds.has(kp.id));
    
    const updateAILevel = (kpId: string, dimIdx: number, levelIndex: number) => {
      setRatings(prev => {
        const current = prev[kpId] || { aiLevels: [], customDimension: '', customLevel: null };
        const newLevels = [...current.aiLevels];
        newLevels[dimIdx] = levelIndex;
        return {
          ...prev,
          [kpId]: { ...current, aiLevels: newLevels }
        };
      });
    };

    const updateCustomDimension = (kpId: string, dimension: string) => {
      setRatings(prev => ({
        ...prev,
        [kpId]: { ...prev[kpId], customDimension: dimension }
      }));
    };

    const updateCustomLevel = (kpId: string, levelIndex: number) => {
      setRatings(prev => ({
        ...prev,
        [kpId]: { ...prev[kpId], customLevel: levelIndex }
      }));
    };

    const GENERIC_LEVELS = ['极佳', '较好', '一般', '模糊'];

    return (
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">课堂评价</h2>
          <p className="text-gray-500">针对每个知识点，从多个维度评价掌握程度</p>
        </div>

        <div className="space-y-10">
          {selectedPoints.map((kp, idx) => {
            const rating = ratings[kp.id] || { aiLevels: [], customDimension: '', customLevel: null };
            
            return (
              <div key={kp.id} className="space-y-6 p-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">知识点 {idx + 1}</span>
                  <h3 className="font-bold text-gray-900">{kp.point}</h3>
                </div>
                
                <div className="space-y-6">
                <div className="space-y-4">
                  {kp.options && kp.options.map((opt, optIdx) => {
                    const isDimSelected = selectedDimensions[kp.id]?.has(opt.dimension);
                    const originalIdx = kp.options!.findIndex(o => o.dimension === opt.dimension);
                    
                    return (
                      <div 
                        key={opt.dimension} 
                        className={cn(
                          "p-4 rounded-2xl border transition-all duration-300",
                          isDimSelected 
                            ? "bg-blue-50/50 border-blue-200 shadow-sm" 
                            : "bg-gray-50/30 border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <button
                          onClick={() => {
                            const newDims = new Set(selectedDimensions[kp.id]);
                            if (isDimSelected) {
                              if (newDims.size > 1) newDims.delete(opt.dimension);
                            } else {
                              newDims.add(opt.dimension);
                            }
                            setSelectedDimensions({ ...selectedDimensions, [kp.id]: newDims });
                          }}
                          className="flex items-center gap-3 w-full text-left group"
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200",
                            isDimSelected 
                              ? "bg-blue-600 border-blue-600 shadow-sm" 
                              : "border-gray-300 group-hover:border-blue-400"
                          )}>
                            {isDimSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <span className={cn(
                            "text-sm font-bold transition-colors",
                            isDimSelected ? "text-blue-900" : "text-gray-500"
                          )}>
                            {opt.dimension}
                          </span>
                        </button>

                        <AnimatePresence>
                          {isDimSelected && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 pt-4 border-t border-blue-100/50">
                                <div className="flex flex-wrap gap-2">
                                  {opt.levels.map((level, lIdx) => (
                                    <button
                                      key={lIdx}
                                      onClick={() => updateAILevel(kp.id, originalIdx, lIdx)}
                                      className={cn(
                                        "flex-1 min-w-[100px] py-2.5 px-3 text-[11px] font-bold rounded-xl transition-all duration-200 leading-tight text-center",
                                        rating.aiLevels[originalIdx] === lIdx
                                          ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-100 transform scale-[1.02]"
                                          : "bg-white text-gray-500 border border-gray-100 hover:border-blue-200 hover:text-blue-600 hover:shadow-sm"
                                      )}
                                    >
                                      {level}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                  {/* Custom Dimension */}
                  <div className="space-y-3 pt-4 border-t border-gray-50">
                    <div className="text-sm font-bold text-gray-700">自定义评价维度 (可选)</div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="例如：书写规范、计算速度..."
                        value={rating.customDimension}
                        onChange={e => updateCustomDimension(kp.id, e.target.value)}
                        className="flex-1 p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      />
                      {rating.customDimension && (
                        <div className="flex gap-1 p-1 bg-gray-50 rounded-lg border border-gray-100 shrink-0">
                          {GENERIC_LEVELS.map((label, lIdx) => (
                            <button
                              key={label}
                              onClick={() => updateCustomLevel(kp.id, lIdx)}
                              className={cn(
                                "px-3 py-1.5 text-[10px] font-bold rounded-md transition-all",
                                rating.customLevel === lIdx
                                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-blue-100"
                                  : "text-gray-400 hover:text-gray-600"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="space-y-6 pt-4 border-t border-gray-100">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-gray-700">课堂表现评价 (点击标签快速添加)</label>
                <button 
                  onClick={() => setPerformance('')}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                  title="清空内容"
                >
                  <Eraser className="w-3 h-3" /> 清空
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(performanceTags.length > 0 ? performanceTags : [
                  '全程专注投入', '学习态度认真', '紧跟授课节奏', '积极思考回答', 
                  '主动表达疑问', '吸收速度快', '知识应用力强', '笔记详实工整', 
                  '执行力非常强', '思维活跃敏捷', '需加强记忆复盘', '解题速度待提高'
                ]).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setPerformance(prev => prev.includes(tag) ? prev : (prev ? `${prev}，${tag}` : tag))}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs transition-colors",
                      performance.includes(tag) 
                        ? "bg-blue-600 text-white" 
                        : "bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <textarea
                value={performance}
                onChange={e => setPerformance(e.target.value)}
                placeholder="请输入课堂表现评价..."
                className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none h-32 text-sm leading-relaxed"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-gray-700">课后作业建议</label>
                <button 
                  onClick={() => setHomework('')}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                  title="清空内容"
                >
                  <Eraser className="w-3 h-3" /> 清空
                </button>
              </div>
              <textarea
                value={homework}
                onChange={e => setHomework(e.target.value)}
                placeholder="请输入课后作业建议..."
                className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none h-32 text-sm leading-relaxed"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setStep('points')}
            className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg font-semibold transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> 上一步
          </button>
          <button
            disabled={loading}
            onClick={handleGenerate}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-200"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            生成反馈报告
          </button>
        </div>
      </div>
    );
  };

  const renderResultStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">生成成功！</h2>
        <p className="text-gray-500">这是为您生成的课后反馈，您可以直接复制使用</p>
      </div>

      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 relative group">
        <div className="prose prose-blue max-w-none overflow-auto max-h-[500px] text-sm">
          <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
            {finalReport}
          </pre>
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <div className="relative">
            <AnimatePresence>
              {copySuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: -40, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute left-1/2 -translate-x-1/2 px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full shadow-lg whitespace-nowrap"
                >
                  复制成功！
                </motion.div>
              )}
            </AnimatePresence>
            <button 
              onClick={copyToClipboard}
              className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-blue-600 transition-all"
              title="复制到剪贴板"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
          <button 
            onClick={handleGenerate}
            className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-green-600 transition-all"
            title="重新生成"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => {
            setStep('student');
            setFinalReport('');
            setRatings({});
            setKnowledgePoints([]);
            setUploadedFile(null);
          }}
          className="flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-black transition-all"
        >
          开始新反馈
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl shadow-blue-100/50 overflow-hidden border border-gray-100">
      {/* Progress Bar */}
      <div className="h-2 bg-gray-100 flex">
        {['student', 'upload', 'points', 'rating', 'result'].map((s, i) => {
          const steps = ['student', 'upload', 'points', 'rating', 'result'];
          const currentIndex = steps.indexOf(step);
          return (
            <div 
              key={s} 
              className={cn(
                "flex-1 transition-all duration-500",
                i <= currentIndex ? "bg-blue-500" : "bg-gray-100"
              )}
            />
          );
        })}
      </div>

      <div className="p-8 sm:p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {step === 'student' && renderStudentStep()}
            {step === 'upload' && renderUploadStep()}
            {step === 'points' && renderPointsStep()}
            {step === 'rating' && renderRatingStep()}
            {step === 'result' && renderResultStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
