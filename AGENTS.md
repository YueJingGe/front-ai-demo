# AGENTS.md — ai-chat-demo

## 项目目标

构建一个 AI 对话演示项目，对齐项目需求：真实 LLM SSE 流式渲染（Markdown + KaTeX + 卡片）、手写虚拟列表消息流、纯函数状态机可单测、IndexedDB 消息持久化。架构为 React 19 前端 + Node 后端（持有 API Key，SSE 转发）。

## 技术栈

| 层       | 技术                                                                 |
| -------- | -------------------------------------------------------------------- |
| 前端     | React 19 + TypeScript strict + Vite 6 + Less                         |
| 状态     | useReducer + useSyncExternalStore                                    |
| Markdown | react-markdown + remark-gfm + remark-math + rehype-katex             |
| 卡片     | 自定义 ` ```card ` JSON 围栏协议                                     |
| 虚拟列表 | 手写迷你版（约 150 行纯函数 + 组件）                                 |
| 持久化   | Dexie（IndexedDB）                                                   |
| 后端     | Node 20+ + Express + tsx                                             |
| LLM      | 阿里云百炼 DashScope OpenAI 兼容模式                                 |
| 测试     | vitest + @testing-library/react + jsdom + fake-indexeddb + supertest |

## 目录结构

```
├── AGENTS.md
├── .cursor/rules.md
├── package.json          # npm workspaces 根
├── server/               # Node 后端（端口 3001）
│   └── src/
│       ├── index.ts      # Express 启动 + /api/health
│       ├── chatRoute.ts  # POST /api/chat SSE 中继（Phase 2）
│       ├── dashscope.ts  # 上游流式请求（Phase 2）
│       └── systemPrompt.ts
└── web/                  # React 19 前端（端口 5173）
    └── src/
        ├── llm/          # SSE 解析、backend/mock 接入层
        ├── chat/         # 流式状态机、Markdown、卡片
        ├── virtual-list/ # 虚拟列表几何 + 组件
        ├── db/           # Dexie schema + chatRepo
        ├── pages/        # App、ChatWindow、Composer
        └── test/setup.ts
```

## 开发流程

### 验收命令（每个 Phase 结束前必须全绿）

```bash
npm run typecheck && npm run test
```

### 并发开发

```bash
npm run dev   # web :5173 + server :3001
```

### Phase 计划

| Phase | 内容                              | 验收                       |
| ----- | --------------------------------- | -------------------------- |
| 0     | 脚手架与工程基线                  | dev 双端启动、空测试通过   |
| 1     | 流式状态机（纯函数，测试先行）    | reducer 单测全绿           |
| 2     | Node 后端 + 前端 LLM 接入层       | SSE 解析单测 + supertest   |
| 3     | Dexie 持久层                      | repo 单测 + 刷新恢复       |
| 4     | 渲染层（Markdown + KaTeX + 卡片） | parser 三态单测            |
| 5     | 虚拟列表                          | 几何函数单测 + 5000 条流畅 |
| 6     | 页面组装 + React 19 输入框        | 完整闭环                   |
| 7     | 打磨与面试材料                    | build 全绿 + manualChunks  |

### 核心原则

1. **纯函数 + 测试先行**：流式状态机、SSE 解析、卡片解析、虚拟列表几何必须实现为纯函数，先写测试再写实现。
2. **API Key 安全**：key 只存在于 `server/.env`（gitignore），前端代码禁止出现 key。
3. **一期不做历史会话列表侧栏**（二期）。
4. **禁止引入未声明依赖**（Tailwind、Redux 等）。
5. **每 Phase 完成后 git commit**。

## Cursor 协作

- 每 Phase 一条任务，贴本文件 + `.cursor/rules.md` 给 Cursor。
- 对 Cursor 产出不盲信：typecheck + test + 官方文档三件套验证。
