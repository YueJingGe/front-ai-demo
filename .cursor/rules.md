# Cursor Rules for ai-chat-demo

- 技术栈：React 19 + TypeScript strict + Vite 6 + Less；后端 Node 20 + Express + tsx。
- 目录结构必须符合计划文档（web/ 和 server/ 分离）。
- 核心逻辑（流式状态机、SSE 解析、卡片解析、虚拟列表几何）必须实现为纯函数，且"测试先行"。
- 验收命令：`npm run typecheck && npm run test`，必须全绿才能提交。
- 禁止在前端代码中出现任何 API Key；API Key 只存在于 server/.env（且 gitignore）。
- 禁止引入未在计划中声明的依赖（如 Tailwind、Redux、其他 UI 库）。
- 一期不实现"历史会话列表"侧栏（二期）。
- 每次完成一个 Phase 后，必须提交 commit。

## 代码规范

- 代码缩进使用 2 个空格，不使用 Tab。
- 字符串优先使用单引号，JSX 属性使用双引号。
- 每个文件末尾保留一个换行符。
- 生成代码前，先检查项目根目录是否有 .prettierrc，按其中规则输出。
- 禁止在代码中使用 `any` 类型（TypeScript strict 原则）。

## 语言与行为规范

- 所有代码注释、commit message、文档、Agent 生成的内容必须使用**中文**。
- 代码变量名、函数名、类型名使用**英文**（保持代码通用性）。
- 所有新生成的 `.md` 文档必须使用中文编写，除非文件本身是专门给英文开发者看的。
- 与用户交互时的提示信息、错误信息必须使用中文。