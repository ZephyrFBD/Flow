# Flow — AI 知识点梳理

从文本或 PDF 自动生成知识结构树，支持交互式学习和例题练习。

![Tech Stack](https://img.shields.io/badge/backend-FastAPI-009688)
![Tech Stack](https://img.shields.io/badge/frontend-React%2019-61DAFB)
![Tech Stack](https://img.shields.io/badge/LLM-OpenAI%20%7C%20Claude%20%7C%20Ollama-FF6F00)

---

## 目录

- [核心功能](#核心功能)
- [页面预览](#页面预览)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [API 文档](#api-文档)
- [数据格式](#knowtree-文件格式)
- [开发路线图](#开发路线图)

---

## 核心功能

### 📚 知识树生成
输入 Prompt 或上传 PDF，AI 自动提取知识点并生成结构化知识树。支持：
- **纯文本输入** — 直接描述想要学习的主题
- **PDF 上传** — 从教材/论文中自动提取知识结构
- **图文混合** — Prompt + PDF 同时提交，Prompt 指导侧重点
- **流式生成** — 节点逐个出现，无需等待全部生成完成即可浏览

### 🎯 交互式学习
- **树形浏览** — 展开/折叠节点，全局搜索
- **完成追踪** — 每个节点带复选框，根节点显示完成进度百分比
- **Markdown 讲解** — 节点详情支持 Markdown + LaTeX 公式 + 代码块
- **Mermaid 图表** — 自动生成知识结构示意图
- **节点编辑** — 双击重命名，在线编辑描述和关键词

### ✏️ 例题练习
- **选择题** — 单选，提交即时判断对错
- **解答题** — 自由输入，AI 语义评分 (0-10) + 改进建议
- **AI 逐字解析** — 答案解析以打字机效果流式输出
- **难度选择** — 简单 / 中等 / 困难三级
- **自定义要求** — 额外指定出题侧重点（如"侧重实际应用"）

### 🔄 树精炼与衍生
- **原地精炼** — 在原树上增删改节点
- **分支衍生** — 创建独立版本分支，形成版本链
- **版本切换** — 在树页面下拉切换不同版本

### 📦 单文件持久化
所有数据存储在一个 `.knowtree` JSON 文件中：
- 知识树（含完成状态）
- 例题（含用户作答记录）
- Prompt 历史
- 版本衍生关系

文件可随意移动、备份、分享，打开即恢复全部状态。

---

## 页面预览

### 首页 (/)
| 区域 | 内容 |
|------|------|
| 项目卡片 | 最近打开的项目，含完成进度条 |
| 统计栏 | 项目总数、总知识点数、整体完成率 |
| 操作 | 新建知识树、打开 `.knowtree` 文件 |

### 生成页 (/generate)
| 区域 | 内容 |
|------|------|
| LLM 选择 | 切换 OpenAI / Claude / Ollama |
| 输入区 | Prompt 文本框 + PDF 文件拖拽上传 |
| 结果预览 | 树结构逐步生成，完成后进入学习 |

### 知识树页 (/tree/:treeId)
| 区域 | 内容 |
|------|------|
| 树视图 | 全页知识树，每个节点带完成复选框 |
| 详情面板 | 选中节点的描述和关键词 |
| 操作栏 | 版本切换、保存、AI修改、衍生、管理 |

### 知识点详解页 (/node/:treeId/:nodeId)
| 区域 | 内容 |
|------|------|
| 讲解区 | Markdown 渲染 + LaTeX 公式 + Mermaid 图表 |
| 出题表单 | 题型/数量/难度/额外要求配置 |
| 题目列表 | 已生成题目，标注对错状态 |

### 答题页 (/practice/:questionId)
| 区域 | 内容 |
|------|------|
| 答题区 | 选择题点选 / 解答题自由输入 |
| 评判区 | AI 逐字流式输出解析 |
| 进度条 | 已答/总数统计 |

### 设置页 (/settings)
| 区域 | 内容 |
|------|------|
| LLM 配置 | OpenAI / Claude / Ollama 独立配置 |
| 连接测试 | 每个 Provider 的测试连接按钮 |

---

## 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| **后端框架** | FastAPI | 异步高性能，自动 OpenAPI 文档 |
| **LLM - OpenAI** | openai SDK | GPT-4o / GPT-4o-mini |
| **LLM - Claude** | anthropic SDK | Claude Sonnet / Opus，支持 thinking 模式 |
| **LLM - Ollama** | httpx 直接调用 | qwen2.5 / llama3 等本地模型 |
| **结构化输出** | Pydantic | 校验 LLM 返回的 JSON，失败重试 |
| **PDF 解析** | PyMuPDF (fitz) | 文本提取 + 分块处理 |
| **前端框架** | React 19 + TypeScript | Vite 构建 |
| **UI 组件库** | Ant Design 5 | Tree、Upload、Form、Layout 等 |
| **路由** | react-router-dom v6 | 多页面路由 |
| **Markdown 渲染** | react-markdown + remark-math + rehype-katex | 讲解内容 + LaTeX 公式 |
| **Mermaid 图表** | mermaid | 知识结构示意图 |
| **存储格式** | JSON 单文件 (.knowtree) | 所有数据在一个文件中 |

---

## 快速开始

### 前提

- Python 3.10+
- Node.js 18+
- 至少一个 LLM 的 API Key

### 后端启动

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# Windows:
source venv/Scripts/activate
# 或: venv\Scripts\activate
# macOS / Linux:
# source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 API Key

# 启动服务
uvicorn app.main:app --reload --port 8000
```

服务启动后访问 `http://localhost:8000/docs` 查看交互式 API 文档。

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

访问 `http://localhost:5173`

### 一键启动

项目根目录提供了 `start.bat`（Windows）和 `start.sh`（macOS/Linux），可同时启动前后端：

```bash
# Windows
.\start.bat

# macOS / Linux
chmod +x start.sh
./start.sh
```

---

## 项目结构

```
E:\Flow/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI 入口，CORS 配置
│   │   ├── config.py               # LLM 配置管理
│   │   ├── routers/
│   │   │   ├── knowledge.py        # 知识树 CRUD + 生成/精炼
│   │   │   ├── questions.py        # 例题生成 + 评判
│   │   │   ├── project.py          # .knowtree 保存/加载
│   │   │   └── config.py           # LLM 配置切换 API
│   │   ├── models/
│   │   │   └── domain.py           # 所有 Pydantic 模型
│   │   ├── services/
│   │   │   ├── tree_service.py     # 树生成 + 精炼 + 衍生
│   │   │   ├── question_service.py # 例题生成 + 评判
│   │   │   ├── pdf_service.py      # PDF 解析
│   │   │   └── llm_service.py      # LLM 路由/工厂
│   │   └── core/
│   │       ├── llm/
│   │       │   ├── base.py         # BaseLLM 抽象基类
│   │       │   ├── openai_llm.py   # OpenAI 实现
│   │       │   ├── claude_llm.py   # Claude 实现
│   │       │   └── ollama_llm.py   # Ollama 实现
│   │       └── chunking.py         # PDF 分块策略
│   ├── requirements.txt
│   ├── .env.example                # 环境变量模板
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # React Router 路由配置
│   │   ├── main.tsx                # 入口文件
│   │   ├── pages/
│   │   │   ├── HomePage.tsx        # 首页 (/)
│   │   │   ├── GeneratePage.tsx    # 生成页 (/generate)
│   │   │   ├── TreePage.tsx        # 知识树页 (/tree/:treeId)
│   │   │   ├── NodeDetailPage.tsx  # 知识点详解页 (/node/:treeId/:nodeId)
│   │   │   ├── PracticePage.tsx    # 答题页 (/practice/:questionId)
│   │   │   ├── ManagePage.tsx      # 管理页 (/manage/:treeId)
│   │   │   └── SettingsPage.tsx    # 设置页 (/settings)
│   │   ├── components/
│   │   │   ├── KnowledgeTree.tsx   # 树组件（复选框 + 搜索）
│   │   │   ├── QuestionForm.tsx    # 出题表单
│   │   │   ├── ChoiceQuestion.tsx  # 选择题组件
│   │   │   ├── EssayQuestion.tsx   # 解答题组件
│   │   │   ├── ProjectCard.tsx     # 项目卡片
│   │   │   ├── MermaidChart.tsx    # Mermaid 图表渲染
│   │   │   ├── PdfUploader.tsx     # PDF 上传
│   │   │   └── ui/                # 通用 UI 组件
│   │   │       ├── AnimatedCounter.tsx
│   │   │       ├── FadeIn.tsx
│   │   │       └── SpotlightCard.tsx
│   │   ├── services/
│   │   │   └── api.ts             # API 客户端（含 SSE 解析）
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript 类型定义
│   │   └── assets/
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── .gitignore
├── start.bat                       # Windows 一键启动
├── start.sh                        # macOS/Linux 一键启动
└── README.md
```

---

## API 文档

启动后端后访问 `http://localhost:8000/docs` 查看 Swagger 文档。

### 知识树 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/knowledge-trees` | 获取所有知识树列表 |
| GET | `/api/v1/knowledge-tree/{id}` | 获取完整树数据 |
| POST | `/api/v1/knowledge-tree/generate` | ★ 生成新树（SSE 流式） |
| PUT | `/api/v1/knowledge-tree/{id}/refine` | ★ 精炼已有树（SSE 流式，可衍生） |
| PUT | `/api/v1/knowledge-tree/{id}/node/{node_id}` | 更新节点（标题/描述/关键词/完成状态） |
| DELETE | `/api/v1/knowledge-tree/{id}` | 删除整棵树 |
| DELETE | `/api/v1/knowledge-tree/{id}/node/{node_id}` | 删除节点 |
| POST | `/api/v1/knowledge-tree/{id}/node` | 添加子节点 |

### 例题 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/questions/generate` | ★ 生成例题（SSE 流式逐题输出） |
| POST | `/api/v1/questions/{id}/submit` | ★ 提交答案（SSE 流式评判） |
| PUT | `/api/v1/questions/{id}` | 更新题目信息 |

### 项目文件 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/project/save` | 下载 .knowtree 文件 |
| POST | `/api/v1/project/load` | 从 .knowtree 文件恢复 |

### LLM 配置 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/config/llm-providers` | 可用 LLM 列表 |
| GET | `/api/v1/config` | 当前配置 |
| PUT | `/api/v1/config/active-provider` | 切换活跃 Provider |
| PUT | `/api/v1/config/provider` | 更新 Provider 配置 |

### SSE 流式协议

所有标注 ★ 的接口均使用 Server-Sent Events 流式传输。

**生成知识树事件流：**
```
event: node_added
data: {"node": {...}, "path": ["root-id", "child-id"]}

event: progress
data: {"percent": 60}

event: done
data: {"tree_id": "uuid"}

event: error
data: {"message": "..."}
```

**提交答案事件流：**
```
event: judgment_start
data: {"type": "choice", "correct": true}

event: explanation_chunk
data: {"text": "矩阵乘法不满足交换律..."}

event: essay_feedback
data: {"score": 8, "suggestion": "建议补充..."}

event: token_progress
data: {"elapsed": 3.2, "estimated_tokens": 450}

event: metadata
data: {"duration_sec": 5.2, "input_tokens": 1200, "output_tokens": 350, "thinking_tokens": 0}
```

---

## .knowtree 文件格式

所有知识树数据存储在一个 JSON 文件中，格式示例如下：

```json
{
  "format_version": "1.0",
  "tree_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "线性代数",
  "version": 3,
  "parent_id": "uuid-yyy",
  "children_ids": [],
  "prompt_history": [
    {
      "timestamp": "2026-04-30T10:00:00",
      "prompt_text": "帮我整理线性代数的核心知识点",
      "pdf_filename": null,
      "mode": "generate"
    }
  ],
  "nodes": {
    "id": "root-uuid",
    "title": "线性代数",
    "description": "...# 整体概述",
    "keywords": ["矩阵", "向量", "特征值"],
    "completed": false,
    "children": [
      {
        "id": "node-1",
        "title": "矩阵运算",
        "description": "## 矩阵加法\n两个同型矩阵对应元素相加...",
        "keywords": ["加法", "乘法", "转置"],
        "completed": true,
        "children": []
      }
    ]
  },
  "questions": [
    {
      "id": "q-1",
      "node_id": "node-1",
      "type": "choice",
      "question": "矩阵乘法满足交换律吗？",
      "options": ["满足", "不满足", "视情况而定"],
      "answer": "不满足",
      "explanation": "矩阵乘法一般不满足交换律...",
      "difficulty": "medium",
      "user_answer": "不满足",
      "is_correct": true,
      "ai_score": null
    }
  ],
  "created_at": "2026-04-30T10:00:00",
  "updated_at": "2026-04-30T11:00:00"
}
```

---

## 开发路线图

- [x] 项目骨架 + LLM 多后端支持
- [x] 最小闭环：输入 → 知识树生成 → 展示
- [x] 单文件持久化 (.knowtree)
- [x] 知识点讲解增强（Markdown + LaTeX + Mermaid）
- [x] 反馈式例题系统（选择题/解答题 + AI 评判）
- [x] 错题复习模式
- [ ] PDF 深度处理（300+ 页长文档分块 + Map-Reduce）
- [ ] 树流式生成（渐进式节点出现）

---

## License

MIT
