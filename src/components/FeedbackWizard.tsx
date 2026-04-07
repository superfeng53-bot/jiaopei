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
  Sparkles
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
  const [performanceTags, setPerformanceTags] = useState<string[]>([]);
  const [homeworkTags, setHomeworkTags] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, { optionId: string; levelIndex: number }[]>>({});
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
      // Default select all points initially
      setSelectedPointIds(new Set(analysis.knowledgePoints.map(p => p.id)));
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
      setHomeworkTags(details.homeworkTags);
      
      // Initialize default ratings for selected points
      const initialRatings: Record<string, { optionId: string; levelIndex: number }[]> = {};
      details.knowledgePoints.forEach(kp => {
        if (kp.options && kp.options.length > 0) {
          initialRatings[kp.id] = [{ optionId: kp.options[0].id, levelIndex: 1 }];
        }
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
        .map(kp => ({
          point: kp.point,
          evaluations: (ratings[kp.id] || []).map(r => {
            const option = kp.options.find(o => o.id === r.optionId);
            return {
              optionId: r.optionId,
              levelIndex: r.levelIndex,
              text: option?.levels[r.levelIndex] || ''
            };
          })
        })),
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
              { id: 'opt1', levels: ['理解极佳', '理解较好', '理解一般', '理解模糊'] },
              { id: 'opt2', levels: ['应用熟练', '应用较好', '应用一般', '应用生疏'] },
              { id: 'opt3', levels: ['细节完美', '细节到位', '细节疏漏', '细节较多错误'] },
              { id: 'opt4', levels: ['逻辑严密', '逻辑清晰', '逻辑一般', '逻辑混乱'] },
            ];
            setKnowledgePoints([...knowledgePoints, { id: newId, point: '自定义知识点', description: '描述教学目标', options: defaultOptions }]);
            const newIds = new Set(selectedPointIds);
            newIds.add(newId);
            setSelectedPointIds(newIds);
            // Initialize rating for the new point
            setRatings({ ...ratings, [newId]: [{ optionId: 'opt1', levelIndex: 1 }] });
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
    
    const toggleOption = (kpId: string, optionId: string, index: number) => {
      const current = ratings[kpId] || [];
      const exists = current.find(r => r.optionId === optionId);
      
      if (exists) {
        setRatings({ ...ratings, [kpId]: current.filter(r => r.optionId !== optionId) });
      } else {
        // Default level: 1 (Good) for first two, 2 (Average) for last two
        const defaultLevel = index < 2 ? 1 : 2;
        setRatings({ ...ratings, [kpId]: [...current, { optionId, levelIndex: defaultLevel }] });
      }
    };

    const updateLevel = (kpId: string, optionId: string, levelIndex: number) => {
      const current = ratings[kpId] || [];
      setRatings({
        ...ratings,
        [kpId]: current.map(r => r.optionId === optionId ? { ...r, levelIndex } : r)
      });
    };

    const LEVEL_LABELS = ['极佳', '较好', '一般', '模糊'];

    return (
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">课堂评价</h2>
          <p className="text-gray-500">点击按钮选择评价维度，并调节掌握程度</p>
        </div>

        <div className="space-y-10">
          {selectedPoints.map((kp, idx) => (
            <div key={kp.id} className="space-y-4 p-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">知识点 {idx + 1}</span>
                <h3 className="font-bold text-gray-900">{kp.point}</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {kp.options?.map((opt, optIdx) => {
                  const selection = (ratings[kp.id] || []).find(r => r.optionId === opt.id);
                  const isActive = !!selection;
                  
                  return (
                    <div key={opt.id} className="space-y-2">
                      <button
                        onClick={() => toggleOption(kp.id, opt.id, optIdx)}
                        className={cn(
                          "w-full py-3 px-4 rounded-xl border-2 transition-all text-left flex justify-between items-center group",
                          isActive 
                            ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" 
                            : "border-gray-100 text-gray-500 hover:border-blue-200 hover:bg-gray-50"
                        )}
                      >
                        <span className="font-medium truncate mr-2">
                          {isActive ? opt.levels[selection.levelIndex] : opt.levels[1]}
                        </span>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                          isActive ? "bg-blue-500 border-blue-500" : "border-gray-300 group-hover:border-blue-400"
                        )}>
                          {isActive && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isActive && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="flex gap-1 p-1 bg-gray-50 rounded-lg border border-gray-100">
                              {LEVEL_LABELS.map((label, lIdx) => (
                                <button
                                  key={label}
                                  onClick={() => updateLevel(kp.id, opt.id, lIdx)}
                                  className={cn(
                                    "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all",
                                    selection.levelIndex === lIdx
                                      ? "bg-white text-blue-600 shadow-sm ring-1 ring-blue-100"
                                      : "text-gray-400 hover:text-gray-600"
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">课堂表现评价 (点击按钮快速选择)</label>
              <div className="flex flex-wrap gap-2">
                {(performanceTags.length > 0 ? performanceTags : ['专注投入', '互动积极', '思维活跃', '状态稳定', '稍有分心', '需更主动']).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setPerformance(prev => prev.includes(tag) ? prev : `${prev}，${tag}`)}
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
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none h-20 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">课后作业建议</label>
              <div className="flex flex-wrap gap-2">
                {(homeworkTags.length > 0 ? homeworkTags : ['完成专项习题', '复习核心公式', '整理错题本', '预习下节课', '背诵方程式']).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setHomework(prev => prev.includes(tag) ? prev : `${prev}，${tag}`)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs transition-colors",
                      homework.includes(tag) 
                        ? "bg-blue-600 text-white" 
                        : "bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <textarea
                value={homework}
                onChange={e => setHomework(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none h-20 text-sm"
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
            disabled={loading || selectedPoints.some(kp => !ratings[kp.id] || ratings[kp.id].length === 0)}
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
