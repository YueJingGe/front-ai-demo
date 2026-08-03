# AI 对话项目（ai-chat-demo）开发计划

## 本文档用途（给 DeepSeek 的说明）

你（DeepSeek）的角色是**导师**：开发者是一名 AI 前端工程师，将在 Cursor 中亲手实现本项目，你负责按本计划带他一步一步走。请遵守：

1. 严格按「分阶段计划」顺序推进，一次只做一个 Phase；每个 Phase 先讲清目标与原理，再给出让开发者贴进 Cursor 的任务 prompt（包含：要改的文件、约束、验收标准）。
2. 每个 Phase 结束必须让开发者运行验收命令（`npm run typecheck && npm run test`），全绿并 git commit 后才进入下一个 Phase。
3. 标注「纯函数，测试先行」的模块，必须先让 Cursor 写测试再写实现。
4. 不要更换本文档已定稿的技术选型与目录结构；发现 Cursor 产出偏离时，指导开发者用本文档对应章节纠正。
5. 一期不做「历史会话列表」侧栏（见二期计划），不要提前实现。

## Summary

- 项目位置：`~/Desktop/ai`（前端 `web/` + 后端 `server/` 双包），开发工具 Cursor，本地运行为主，不做 Electron（渲染层不依赖 Electron API，后续可直接套壳）。
- 架构：React 19 前端 + **Node 后端服务**（持有 API key，向阿里云百炼发起流式请求并以 SSE 转发给前端）。
- 一期核心卖点对齐 JD：真实 LLM SSE 流式渲染（Markdown + 卡片 + KaTeX）、手写虚拟列表消息流（动态行高/向上翻页/贴底跟随）、纯函数状态机可单测（验证 Agent 产出的叙事）、IndexedDB 消息持久化。
- 二期：历史会话列表（虚拟化侧栏）等，见文末「二期计划」。

## 关键决策

### 1. 技术栈定稿（在你给的基础上只做加法，不做替换）

| 项       | 选择                                                                                                        | 理由                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 框架     | React 19 + TS strict + Vite 6                                                                               | 保持你的选择                                                              |
| 样式     | Less                                                                                                        | 保持你的选择（贴合 sub 端 `.less` 经验）；不引 Tailwind，避免两套样式体系 |
| 状态     | useReducer + useSyncExternalStore                                                                           | 已定；流式状态机纯函数化，零 React 19 兼容风险                            |
| Markdown | react-markdown + remark-gfm + remark-math + rehype-katex + katex                                            | 与生产管线同构（千问仓同款 remark/rehype 组合）                           |
| 卡片     | 自定义流式协议（` ```card ` JSON 围栏块）→ InfoCard（纯 TSX）+ ChartCard（ECharts 按需引入 `echarts/core`） | 贴生产"图表卡片 + vendor-echarts 按需加载"经验                            |
| 虚拟列表 | 手写迷你版（约 150 行）                                                                                     | 面试讲原理价值最大；对外说明生产对应 @tanstack/react-virtual              |
| 持久化   | Dexie（IndexedDB）                                                                                          | 见决策 2                                                                  |
| 后端     | Node 20+ + Express（`server/` 独立包，TS + tsx 运行）                                                       | 持有 key、SSE 转发、屏蔽 CORS；生产级姿势（key 绝不下发前端）             |
| LLM      | 阿里云百炼 DashScope（通义千问）OpenAI 兼容模式 + SSE                                                       | 见决策 3                                                                  |
| 测试     | vitest + @testing-library/react + jsdom + fake-indexeddb + supertest                                        | fake-indexeddb 测仓储层；supertest 测后端 SSE 接口                        |

### 2. 数据库选型：IndexedDB（Dexie）

- localStorage：同步 API 阻塞主线程、约 5MB 上限、无索引无法做消息分页，排除。
- 本地文件：浏览器写不了磁盘，不做 Electron/后端的前提下不可行，排除。
- IndexedDB + Dexie：异步、容量大、支持复合索引 `[sessionId+createdAt]`，正好支撑"向上翻页加载"的 cursor 分页；Dexie 把原生 IDB 的回调地狱封装成 Promise，30 行就能建仓储层。
- 流式写回策略：token 先进内存渲染，**流结束后一次性落库**（每 token 写 IDB 太重；如需断线恢复可 500ms 节流落库，二期再加）。

### 3. 是否涉及大模型：是，接真实模型（经 Node 后端转发）

- 链路：前端 `fetch('/api/chat', { method: 'POST', body: { sessionId, messages } })` → **Node 后端** → DashScope **OpenAI 兼容端点** `POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`（`stream: true`，模型 `qwen-plus`，成本低速度快）→ 后端把上游 SSE 逐 chunk 转发回前端（`Content-Type: text/event-stream`）。
- **后端职责**（`server/`，Express）：
  - `POST /api/chat`：SSE 转发；注入 system prompt（卡片输出协议）；上游断流/非 200 时下发 `event: error` 帧；监听 `req.on('close')` 时 abort 上游请求（用户点「停止生成」）。
  - `GET /api/health`：健康检查。
  - key 管理：`server/.env` 放 `DASHSCOPE_API_KEY`（gitignore），**前端代码与产物中不出现 key**。
  - 开发期前端 `vite.config.ts` 用 `server.proxy` 把 `/api` 转发到 `http://localhost:3001`（这里只是 dev 端口转发，不再直连 DashScope）。
- **降级**：前端 LLM 接入层统一为 `AsyncGenerator<StreamChunk>` 接口，后端不可达 / 报错时自动切换本地 mock 流（内置 Markdown+KaTeX+卡片样例），演示永不断档；mock 流也是测试的 fast-forward 工具。
- 面试话术：这就是生产架构的最小复刻——key 收敛在服务端、SSE 中继、断线 abort 级联。

### 4. 卡片协议（流式期间如何渲染卡片）

- 约定模型在回答中输出 ` ```card ` 围栏块，内容为 JSON：`{"type":"info","title":"...","items":[...]}` 或 `{"type":"chart","chartType":"bar","data":[...]}`。
- 前端 `cardParser.ts` 把消息 content 切成 `segment[]`（text / card）：
  - 完整块 → 渲染对应卡片组件；JSON 非法 → 降级为代码块原样展示（容错）。
  - **流式半截态**：未闭合的围栏块在流式期间按纯文本渲染，闭合后才升级为卡片——这就是"流式半截语法处理"的面试考点。
- 会话与消息结构：`sessions(id, title, createdAt, updatedAt)`、`messages(id, sessionId, role, content, status, createdAt, tokenCount)`。

## 目录结构

```
~/Desktop/ai/
├── AGENTS.md                  # Agent/Cursor 上下文协议（面试加分项）
├── .cursor/rules.md           # Cursor 专属约束：技术栈/目录/验收命令/禁止事项
├── server/                    # Node 后端（独立 package）
│   ├── .env.example           # DASHSCOPE_API_KEY=
│   ├── src/
│   │   ├── index.ts           # Express 启动（端口 3001）
│   │   ├── chatRoute.ts       # POST /api/chat：SSE 中继 + abort 级联
│   │   ├── dashscope.ts       # 上游流式请求封装
│   │   └── systemPrompt.ts    # 卡片协议 system prompt
│   └── src/*.test.ts          # supertest 接口测试
└── web/                       # React 19 前端（独立 package）
    ├── vite.config.ts         # /api dev proxy → :3001 + manualChunks 拆 katex/echarts
    └── src/
        ├── llm/        types.ts(统一接口) sse.ts(SSE解析,纯函数) backend.ts(调 /api/chat) mock.ts
        ├── chat/       types.ts streamReducer.ts(纯) useChatStream.ts
        │               Markdown.tsx MessageItem.tsx cardParser.ts(纯) cards/{InfoCard,ChartCard}.tsx
        ├── virtual-list/ virtual.ts(纯:offsets/二分/range) VirtualList.tsx
        ├── db/         db.ts(Dexie schema) chatRepo.ts(分页/落库)
        ├── pages/      App.tsx ChatWindow.tsx Composer.tsx
        └── test/setup.ts      # jest-dom + ResizeObserver stub
（测试与源码同目录 *.test.ts(x)；根目录用 npm workspaces 或两个独立 npm 包均可，推荐 workspaces）
```

## 分阶段计划（每步有明确验收，跑绿再进下一步）

### Phase 0：脚手架与工程基线

- 根目录 npm workspaces（`web` + `server`）；`web` 用 `npm create vite@latest web -- --template react-ts` 生成，升到 React 19，装 less / vitest / jsdom / RTL；`server` 手建（express + tsx + typescript + supertest）。
- 根 `package.json` 加并发脚本：`npm run dev`（concurrently 起 web:5173 + server:3001）、`typecheck`、`test`。
- 写 `AGENTS.md` + `.cursor/rules.md`：技术栈、目录约定、"核心逻辑必须纯函数化"、验收命令（`npm run typecheck && npm run test`）、禁止引入未声明依赖、禁止在前端出现 API key。
- 验收：前后端 dev 同时启动、各一条空测试通过。

### Phase 1：流式状态机（纯函数，测试先行）

- `chat/streamReducer.ts`：`user_sent / stream_started / tokens_received / stream_completed / stream_failed / history_loaded / session_cleared`。
- 先让 Cursor 写单测再写实现：拼接顺序、`firstTokenAt` 只记一次、迟到/重复事件防御（找不到 id 或状态非 streaming 时返回原 state）、失败路径。
- 验收：reducer 单测全绿。

### Phase 2：Node 后端 + 前端 LLM 接入层

- 后端 `server/`：Express + `chatRoute.ts`（POST /api/chat SSE 中继：设置 `text/event-stream` 头、逐 chunk `res.write`、`req.on('close')` abort 上游）、`dashscope.ts`（fetch + ReadableStream 读上游）、`systemPrompt.ts`；`.env` 放 `DASHSCOPE_API_KEY`。
- 前端 `web/src/llm/`：`sse.ts` 纯函数 `parseSSELines`（正确处理跨 chunk 半行、`data: [DONE]`）；`backend.ts` 调 `/api/chat` 并 yield `{ text, tokens }`；`mock.ts` 同接口；`types.ts` 定义 `StreamSource` 统一接口与降级选择逻辑。
- `web/vite.config.ts` 加 `/api` → `localhost:3001` 的 dev proxy。
- 验收：SSE 解析单测（半行拼接用例必须过）；supertest 测 `/api/chat`（mock 上游）；前后端联跑真实调用通义出流。

### Phase 3：持久层（Dexie）

- `db/db.ts`：Dexie v1 schema（messages 建 `[sessionId+createdAt]` 复合索引；sessions 表建好但一期只用一个默认会话）。
- `db/chatRepo.ts`：`getOrCreateDefaultSession / appendMessage / finalizeMessage / loadMessagesBefore(sessionId, beforeCreatedAt, limit=30)`（listSessions 留到二期）。
- 用 fake-indexeddb 写单测：cursor 分页边界（正好 30 条、跨页、空页）。
- 验收：repo 单测全绿；刷新页面消息还在。

### Phase 4：渲染层（Markdown + KaTeX + 卡片）

- `Markdown.tsx`（memo + 管线 + `katex/dist/katex.min.css`）；`MessageItem.tsx`（memo + `useDeferredValue(content)`，流式光标）。
- `cardParser.ts` 纯函数三态（完整/半截/坏 JSON）+ InfoCard + ChartCard（echarts/core 按需注册 Bar/Line）。
- 验收：parser 单测三态全过；mock 流渲染出表格、`$E=mc^2$` 公式、信息卡、图表卡。

### Phase 5：虚拟列表（消息流）

- `virtual-list/virtual.ts` 纯函数：`buildOffsets`（前缀和）/ `findIndexAtOffset`（二分）/ `computeRange`（overscan 收敛）。
- `VirtualList.tsx`：单例 ResizeObserver 实测行高回写校正、`followOutput` 贴底跟随（用户上翻 >32px 不抢滚动条）、`onReachTop` 回调触发 `loadMessagesBefore` 向上翻页。
- 组件保持通用（items/itemKey/renderItem 泛型 API），二期 SessionList 直接复用。
- 验收：几何函数单测穷举；注入 5000 条消息滚动流畅；上翻分页正确拼接。

### Phase 6：页面组装 + React 19 输入框

- 单栏布局：ChatWindow + Composer（会话侧栏留二期，布局预留左栏插槽即可）。
- Composer 用 `<form action>` + `useActionState`（pending 托管、提交后自动重置）；Enter 发送、Shift+Enter 换行；流式期间显示"停止生成"（AbortController → 前端断开 → 后端 close 事件 abort 上游，级联取消）。
- 验收：完整闭环——发问 → 后端转发 → 真实流式渲染 → 结束落库 → 刷新恢复。

### Phase 7：打磨与面试材料

- `web/vite.config.ts` 加 `manualChunks`：katex / echarts 各拆独立 chunk（复刻生产 vendor-katex / vendor-echarts 策略，面试直接讲）。
- 错误态/空态/压测按钮（一键注入 5000 条历史消息）。
- README：架构图（前端-Node-DashScope 三段链路）、JD 映射表（每个考点对应哪个文件）、运行说明（`npm run dev` 并发起前后端）；录屏 GIF。
- 验收：`typecheck + test + build` 全绿；产物分析能看到 katex/echarts 独立 chunk。

## 二期计划（一期验收后再做）

1. **历史会话列表**：左侧栏 SessionList（复用 VirtualList，固定行高），`chatRepo.listSessions`（按 updatedAt 倒序分页）、新建/切换/删除会话、会话标题自动生成（取首问前 20 字或让模型总结）。
2. 流式期间 500ms 节流落库（断线恢复）。
3. Electron 套壳（渲染层零改动，加 main/preload 即可）。

## Cursor 协作方式（本身就是面试素材）

- 每 Phase 一条任务，把本计划对应段落 + `.cursor/rules.md` 贴给 Cursor，先让它出实现 plan 再写码。
- Phase 1/2/3/5 的纯函数一律"测试先行"；每步结束跑验收命令，绿了再 commit。
- 对 Cursor 产出不盲信：幻觉 API 靠 typecheck + 官方文档 + 最小验证三件套识别（面试可讲）。

## 主要风险

- key 安全：`DASHSCOPE_API_KEY` 只存在于 `server/.env`（gitignore），前端代码/产物/提交历史中都不能出现；DeepSeek 带教时每个 Phase commit 前提醒检查。
- SSE 中继的背压与断线：后端必须监听 `req.on('close')` 并 abort 上游，否则用户停止后上游仍在计费出 token。
- react-markdown v10 / rehype-katex 与 React 19 兼容良好，但 echarts 体积大，务必按需 `echarts/core` 引入并拆 chunk。
- 流式期间高频 setState：reducer dispatch 每 chunk 一次可接受；markdown 重解析靠 `useDeferredValue` + memo 压住。
