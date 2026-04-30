# Flow — AI 知识点梳理

从文本或 PDF 自动生成知识结构树，支持交互式学习和例题练习。

## 功能

- **知识树生成**: 输入 Prompt 或上传 PDF，AI 自动生成结构化知识点树
- **交互式学习**: 展开/折叠节点，勾选完成状态，查看详细讲解
- **例题练习**: 选择题 + 解答题，AI 自动评判并生成解析
- **错题复习**: 筛选错题集中练习
- **多 LLM 支持**: OpenAI / Claude / Ollama 可切换
- **单文件持久化**: 所有数据保存在 `.knowtree` 文件中，方便移动和备份

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | FastAPI (Python) |
| 前端 | React 19 + TypeScript + Ant Design 5 |
| LLM | OpenAI / Claude / Ollama (统一接口) |
| 渲染 | Markdown + KaTeX + Mermaid |
| 存储 | JSON 单文件 (.knowtree) |

## 快速开始

### 前提

- Python 3.10+
- Node.js 18+
- 至少一个 LLM 的 API Key（OpenAI / Claude / Ollama）

### 后端

```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # 填入 API Key
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问 `http://localhost:5173`

## 项目结构

```
backend/
├── app/
│   ├── core/llm/       # LLM 适配层 (OpenAI / Claude / Ollama)
│   ├── models/         # Pydantic 数据模型
│   ├── routers/        # API 路由
│   └── services/       # 业务逻辑
└── requirements.txt

frontend/
├── src/
│   ├── components/     # UI 组件
│   ├── pages/          # 页面
│   ├── services/       # API 客户端
│   └── types/          # TypeScript 类型定义
└── package.json
```
