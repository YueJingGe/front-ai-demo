# Cursor Rules for ai-chat-demo

- 技术栈：React 19 + TypeScript strict + Vite 6 + Less；后端 Node 20 + Express + tsx。
- 目录结构必须符合计划文档（web/ 和 server/ 分离）。
- 核心逻辑（流式状态机、SSE 解析、卡片解析、虚拟列表几何）必须实现为纯函数，且"测试先行"。
- 验收命令：`npm run typecheck && npm run test`，必须全绿才能提交。
- 禁止在前端代码中出现任何 API Key；API Key 只存在于 server/.env（且 gitignore）。
- 禁止引入未在计划中声明的依赖（如 Tailwind、Redux、其他 UI 库）。
- 一期不实现"历史会话列表"侧栏（二期）。
- 每次完成一个 Phase 后，必须提交 commit。
