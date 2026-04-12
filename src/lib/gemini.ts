import { GoogleGenAI, Type } from "@google/genai";
import { getAIConfig } from "./aiConfig";

export interface EvaluationOption {
  dimension: string;
  levels: [string, string, string, string]; // 4 specific levels for this dimension
}

export interface KnowledgePoint {
  id: string;
  point: string;
  description: string;
  potentialDimensions?: string[]; // Potential dimensions to choose from
  options?: EvaluationOption[]; // 4 dimensions with levels (final)
}

export interface CourseAnalysis {
  knowledgePoints: KnowledgePoint[];
  summary: string;
}

export interface DetailedAnalysis {
  knowledgePoints: KnowledgePoint[];
  performanceTags: string[];
}

export interface SelectedOption {
  optionId: string;
  levelIndex: number; // 0-3
  text: string;
}

export interface FeedbackData {
  studentName: string;
  courseSummary: string;
  points: { 
    point: string; 
    evaluations: SelectedOption[];
  }[];
  performance: string;
  homework: string;
  historicalContext?: string;
  historicalFeedbacks?: string[]; // Last 3 feedback reports
}

async function callAI(prompt: string, stage: 1 | 2 | 3, systemInstruction?: string, responseSchema?: any, imageContent?: string, textContent?: string): Promise<string> {
  const config = getAIConfig();
  const modelName = stage === 1 ? config.stage1Model : stage === 2 ? config.stage2Model : config.stage3Model;
  
  console.log(`[AI Stage ${stage}] Using provider: ${config.provider}, model: ${modelName}`);

  if (config.provider === 'google') {
    const apiKey = config.apiKeys.google || process.env.GEMINI_API_KEY || '';
    const ai = new GoogleGenAI({ apiKey });
    
    const parts: any[] = [{ text: prompt }];
    
    if (imageContent) {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: imageContent } });
    }
    
    if (textContent) {
      parts.push({ text: `\n\n课件文本内容：\n${textContent}` });
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts }],
      config: {
        systemInstruction,
        responseMimeType: responseSchema ? "application/json" : "text/plain",
        responseSchema: responseSchema,
      },
    });

    return response.text || "";
  } else {
    // OpenAI compatible providers
    const apiKey = config.apiKeys[config.provider];
    const baseUrl = config.baseUrls[config.provider] || (
      config.provider === 'deepseek' ? 'https://api.deepseek.com' :
      config.provider === 'qwen' ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' :
      config.provider === 'doubao' ? 'https://ark.cn-beijing.volces.com/api/v3' :
      config.provider === 'zhipu' ? 'https://open.bigmodel.cn/api/paas/v4' :
      'https://api.openai.com/v1'
    );

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    
    let fullPrompt = prompt;
    if (textContent) {
      fullPrompt += `\n\n课件文本内容：\n${textContent}`;
    }

    const userContent: any[] = [{ type: 'text', text: fullPrompt }];
    if (imageContent) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageContent}` }
      });
    }
    messages.push({ role: 'user', content: userContent });

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        response_format: responseSchema ? { type: 'json_object' } : undefined,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'AI API call failed');
    }

    const data = await response.json();
    return data.choices[0].message.content || "";
  }
}

export async function analyzeCourseContent(content: string, isImage: boolean = false): Promise<CourseAnalysis> {
  const prompt = `
    作为一名极其资深且细致的化学教师，请深度分析以下课件内容。
    
    任务：
    1. 提取 8-12 个细致的知识点（用于后续详细评价）。
    2. 为每个知识点提供 4-6 个专业的评价维度选项（例如：概念理解深度、方程式书写规范、实验现象分析、计算逻辑严密性等）。
    3. 为本次课程撰写一个精炼的“课堂内容汇总”，概括本次课程讲解的核心板块。
    
    要求：
    - 汇总条目控制在 2-3 条以内，不要过于琐碎。
    - 必须使用 “1. 2.” 这种带数字编号的格式，或者是一段极简的描述。
    - 参考风格：
        * “1. 对上节课晶胞及其计算进行了简短复盘。 2. 系统梳理了四大晶体的易混淆知识点。 3. 讲解配位键相关知识。”
        * “1. 梳理硫酸的性质。 2. 完整展开氮及氮的氧化物核心知识点，重点强化一氧化氮、二氧化氮相关计算。”
    
    请务必以 JSON 格式输出，输出格式为：
    {
      "knowledgePoints": [
        { 
          "point": "知识点名称", 
          "description": "具体的教学要求",
          "potentialDimensions": ["维度1", "维度2", "维度3", "维度4"]
        }
      ],
      "summary": "1. 核心板块一。 2. 核心板块二。"
    }
  `;

  const schema = {
    type: Type.OBJECT,
    properties: {
      knowledgePoints: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            point: { type: Type.STRING },
            description: { type: Type.STRING },
            potentialDimensions: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 4, maxItems: 6 }
          },
          required: ["point", "description", "potentialDimensions"]
        }
      },
      summary: { type: Type.STRING }
    },
    required: ["knowledgePoints", "summary"]
  };

  const result = await callAI(prompt, 1, undefined, schema, isImage ? content : undefined, isImage ? undefined : content);
  const parsed = JSON.parse(result);
  
  return {
    knowledgePoints: (parsed.knowledgePoints || []).map((p: any, index: number) => ({
      id: `kp-${index}`,
      ...p
    })),
    summary: parsed.summary || ""
  };
}

export async function generateDetailedOptions(
  selectedPoints: KnowledgePoint[], 
  content: string, 
  isImage: boolean = false
): Promise<DetailedAnalysis> {
  const prompt = `
    作为一名极其资深且细致的化学教师，请针对以下选定的知识点及其【备选评价维度】，为每个维度生成专业的程度标签。
    
    任务：
    1. 为每个知识点列出的所有【备选维度】生成 4 个反映掌握程度的评价短语（从优到劣）。
    2. 评价短语应自然、专业且具有针对性，不局限于简单的“优良中差”，可以根据维度内容灵活表述（例如：针对“逻辑严密性”，标签可以是“逻辑严密无误、逻辑清晰基本准确、逻辑欠严密有小疏漏、逻辑混乱错误较多”）。
    3. 评价短语字数建议在 2-8 个字之间，保持灵活性以确保表达的专业性。
    4. 生成 12-15 个针对“课堂表现”的专业短标签。
    
    选定内容：
    ${selectedPoints.map(p => `- 知识点：${p.point}\n  备选维度：${p.potentialDimensions?.join("、")}`).join("\n")}
    
    请务必以 JSON 格式输出，输出格式为：
    {
      "knowledgePoints": [
        { 
          "point": "知识点名称", 
          "options": [
            { "dimension": "维度名称", "levels": ["优标签", "良标签", "中标签", "差标签"] }
          ]
        }
      ],
      "performanceTags": ["标签1", "标签2", "..."]
    }
  `;

  const schema = {
    type: Type.OBJECT,
    properties: {
      knowledgePoints: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            point: { type: Type.STRING },
            options: { 
              type: Type.ARRAY, 
              items: {
                type: Type.OBJECT,
                properties: {
                  dimension: { type: Type.STRING },
                  levels: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 4, maxItems: 4 }
                },
                required: ["dimension", "levels"]
              }
            }
          },
          required: ["point", "options"]
        }
      },
      performanceTags: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["knowledgePoints", "performanceTags"]
  };

  const result = await callAI(prompt, 2, undefined, schema, isImage ? content : undefined, isImage ? undefined : content);
  const parsed = JSON.parse(result);
  
  return {
    knowledgePoints: selectedPoints.map(p => {
      const details = parsed.knowledgePoints.find((dp: any) => dp.point === p.point);
      return {
        ...p,
        options: details ? details.options : (p.potentialDimensions || []).map(d => ({
          dimension: d,
          levels: ['表现极佳', '表现较好', '表现一般', '表现模糊']
        }))
      };
    }),
    performanceTags: parsed.performanceTags || []
  };
}

export async function generateFeedbackReport(data: FeedbackData): Promise<string> {
  const systemInstruction = `
    你是一位极具亲和力、专业且细致的化学私教。你的任务是根据老师提供的结构化评价数据，撰写一份让家长感到专业、放心且深受感动的课后反馈。
    
    写作风格参考（学习以下优秀范例）：
    - “孩子本节课学习状态积极，全程专注投入，课堂互动良好，能紧跟讲解节奏主动思考、积极回答问题。”
    - “对核心内容的吸收速度快，知识应用能力强。展现出良好的学习适应性，对于不熟悉的地方会及时批注，做对的地方有疑问也会及时提问。”
    - “上节课布置的专项作业完成质量好，正确率高达 95%，能看出孩子课后认真落实知识点，学习执行力很强。”
    - “面对抽象的结构知识能主动思考，对不熟悉、理解不透彻的内容及时向老师表达疑问，求知欲强，经讲解后能快速理解吸收。”
    - “经过上节课课后知识的梳理与记忆，孩子对前期学过的知识熟悉度明显提升，知识连贯性更好。”
    - “有机化学知识体系性强但知识点细碎、方程式多且相似性高，记忆和反复巩固是关键，孩子课上能听懂、记录，一周后稍有遗忘属正常规律。”
    - “目前薄弱点主要集中在...相关计算不够熟练，做题速度偏慢，后续会通过针对性练习逐步提升。”
    
    写作要求：
    1. 语气：亲切、专业、充满鼓励、细节丰富。
    2. 深度：不要只罗列知识点，要描述孩子在课堂上的具体表现细节。
    3. 真实性：体现出老师对孩子的深度观察，提到具体的正确率（如 85%-95% 之间波动）和互动细节。
    4. 逻辑：结构清晰，重点突出。
    5. 创新性：参考提供的【历史反馈记录】，避免使用完全相同的句式和词汇，在保持风格一致的同时，为本次反馈注入新鲜的描述。
  `;

  const prompt = `
    请根据以下信息撰写反馈报告。
    
    要求：
    1. 课堂内容：直接使用提供的“课堂内容汇总”，不要重新生成，只需确保其符合最终报告的语境。
    2. 课堂表现：这是最核心的部分。请将勾选的评价维度（如“理解极佳”、“应用较好”）转化为生动、具体的描述。
       - 必须包含：整体学习状态（如“专注投入”、“紧跟节奏”）、对上节课知识的落实复盘（如“作业完成质量高”、“正确率达95%”）、本节课新知识的吸收细节（如“主动思考”、“及时提问”）、具体的正确率评价（参考 80%-95%）、以及对孩子学习习惯的肯定。
    3. 细节描述：描述孩子在面对新知识时的反应（例如：“面对抽象的...知识能主动思考”、“对不熟悉的地方及时批注”）。
    4. 逻辑清晰：分析孩子的薄弱点及后续改进方向。
    5. 避免重复：参考【历史反馈记录】，确保本次报告的措辞与前几次有所区别，不要机械重复。

    输入信息：
    - 学生姓名：${data.studentName}
    - 课堂内容汇总：${data.courseSummary}
    - 知识点评价：${data.points.map(p => `${p.point}: ${p.evaluations.map(e => e.text).join(", ")}`).join("; ")}
    - 课堂表现标签：${data.performance}
    - 课后作业建议：${data.homework}
    ${data.historicalContext ? `- 历史背景/上节课内容：${data.historicalContext}` : ""}
    ${data.historicalFeedbacks && data.historicalFeedbacks.length > 0 ? `- 历史反馈记录（参考以避免重复）：\n${data.historicalFeedbacks.map((f, i) => `记录${i + 1}：${f}`).join("\n")}` : ""}
    
    必须严格按照以下格式输出：
    ${data.studentName}化学课后反馈，请查收[愉快]
    一、课堂内容
    [此处基于“课堂内容汇总”进行整理，使用 1. 2. 格式]
    二、课堂表现
    [此处为深度评价段落，字数180-300字。结构：1.本节课整体状态；2.上节课作业/知识落实情况复盘；3.本节课新知识吸收情况与互动细节；4.准确率评价与习惯肯定；5.薄弱点提示。语气要诚恳、专业、充满鼓励]
    三、课后作业
    [此处列出作业建议，使用 1. 2. 格式]
    四、下节课重点内容
    [此处描述下节课的教学计划或重点突破方向]

    注意：
    - 标点符号统一使用中文全角，如“，”和“。”，但二级列表的数字后请使用半角点号“.”（例如 1. 2.）。
    - 严禁使用 Markdown 表格或加粗语法，直接输出纯文本。
  `;

  const result = await callAI(prompt, 3, systemInstruction);
  return result || "生成失败，请重试。";
}
