## 简短陈述

在 xx 团队做前端，维护一个 pnpm + turbo 的大型 monorepo ，一套代码覆盖 Web 主站、Electron 桌面端（主窗 + 小窗）、夸克等多端，日常用 AI Agent 深度协作——需求拆解、计划评审、测试验证都有固化流程。业务上我接触过 SSE 流式渲染全链路、虚拟列表、Markdown/KaTeX 渲染管线和埋点体系，也做过性能优化相关的工作。

## 项目介绍

产品：xx AI 助手，C 端对话产品，核心链路是「提问 → SSE 流式回答 → 富内容渲染（Markdown/公式/图表/卡片）」

工程形态：monorepo，apps 下面多个端，包括 pc、h5、桌面、小窗、国际版等，按边界拆分为对话引擎、列表、空间、UI 设计体系、埋点体系等

本人涉及到的端有：pc 和 h5 ，涉及到的开发有：空间、对话卡片、权益、反馈、AI 生图、AI 生视频、音视频速读、智能体、埋点、等模块

## 技术栈

pnpm + React 18 + TypeScript + MobX + Tailwind CSS

测试/质量：vitest、ESLint 9 flat config、stylelint、lint-staged + commitlint、knip（死代码）、fsd-baseline（分层架构守护）

## 涉及技能

### Electron 应用

桌面端是 Electron 容器，里面加载的是 Web 产物——主窗加载 xx-web，小窗 加载 xx-web-sub。也就是「同一套 React 代码，多端套壳复用」

能讲清主/preload/渲染三进程模型、contextIsolation，contextBridge

用 whistle + Zero Omega 做代理来调试本地代码

### react 19

项目中目前锁定的 react 版本是 18，但我也关注 React 19 的新范式并且在 demo 中实操过：

- Actions / useActionState：表单提交交给 action，pending 态框架托管，提交后自动重置非受控字段——正好用在聊天输入框
- useDeferredValue：流式场景主力，token 高频追加时让 markdown 重解析延迟到浏览器空闲，输入/滚动不被阻塞
- ref 回调清理函数：React 19 允许 ref 回调返回 cleanup，配合 ResizeObserver 做行高测量时不再需要手动存实例卸载
- 以及 use()、文档树/资源加载等周边改进

### 流式渲染

链路：fetch + SSE → chat-engine 的 middleware 管线（onOpen → onFirstContentful → onMessageReceived → onMessageComplete/onError），每个点位可插拔挂中间件（tracing、埋点、卡片处理等）

渲染策略：token 增量 添加的时候 不要 整段替换；消息组件 memo 化，流式期间只有当前那条消息重渲染；首帧体验有专门包（chat-first-frame）做优化

指标体系：TTFT（首 token 延迟）、首屏 T2、完答率，都有埋点点位对应（onFirstContentful 就是 TTFT 的采集点）

追问准备：SSE vs WebSocket（单向文本流、HTTP 友好、断线重连简单 vs 全双工）；半截 Markdown 语法在流式期间的处理

### 虚拟列表

生产方案：用插件 统一聊天列表 SDK，收敛滚动逻辑、虚拟化、数据适配；底层就是 react-virtual + infinite-scroll-hook，支持动态行高测量、向上翻页加载、贴底跟随；历史会话列表同样虚拟化

原理（白板级）：每行高度前缀和得到 offsets → 二分查找 scrollTop 落在哪行 → 只渲染视口 ± overscan → ResizeObserver 实测行高回写校正 → 「用户上翻时不抢滚动条」的 pin 判断

### Markdown / KaTeX

渲染管线：remark-gfm（表格/删除线）→ remark-math（$...$/$$...$$ 转数学 AST）→ rehype-katex（渲染公式）；代码高亮走 rehype-highlight

性能治理（很有说服力的细节）：KaTeX 体积约 1.2MB，在 rsbuild 里被拆成独立 vendor-katex chunk 按需加载——小窗场景触发率低，不进首屏；代码高亮、echarts（约 3.8MB）同理拆 chunk

流式难点：token 流可能截断在未闭合的 $ 或 中，渲染层需要对半截语法容错

### 性能优化

#### 聊天列表虚拟滚动 & 首帧优化

对话场景消息高度差异大且流式增长，实现了列表虚拟化方案，长对话（200+ 条消息）DOM 节点减少 85%+，滚动帧率从 35fps 提升到稳定 55fps 以上。同时设计首帧有意义性检测机制，首屏内容呈现耗时降低约 40%。

#### Markdown 流式渲染实现 LLM 流式回答的增量渲染，支持打字机和直接追加两种模式

通过分阶段耗时监控定位瓶颈，渲染 Jank 发生率降低 70%+，单帧渲染耗时稳定控制在 12ms 以内。多端适配了代码高亮、LaTeX 公式和 Mermaid 图表，解析异常率低于 0.1%。

#### AI 能力插件化 & 跨端复用将 10+ 种 AI 能力

（深研/PPT/生图/翻译等）抽象为独立 Feature 包，通过统一注册机制挂载。新能力接入周期从约 2 周缩短到 3 天，主应用零改动。底层基于自研 DI + FSD 分层实现四端共享，代码复用率超过 70%。

#### 工程化质量守护搭建变更感知的动态 CI 编排

相比全量执行平均流水线耗时减少 55%。开发埋点守卫系统（类型约束 + 静态巡检 + Playwright 验证），上线后累计提前拦截 50+ 个埋点缺陷，线上埋点异常率下降 80%。

### Agent 协作开发

#### 上下文工程（管理 Agent 上下文）

可以这样说：在仓库有明确的 agent harness：AGENTS.md 当地图和协议、docs/index.md 做记录系统入口、.agents/context/ 放机器友好的稳定事实摘要、每个任务类型有 SKILL.md 作为唯一事实源

原则：让 Agent「先读地图再读正文」，避免它每次从零探索几万文件；还有 docs:check 脚本防止文档漂移导致 Agent 读到过期知识

#### 任务拆分与 Plan Mode

仓库里有 qianwen-fsd 这类 skill 专门约束「新代码该落在哪一层」，防止 Agent 越界乱改；

复杂任务先让 Agent 出 plan（改哪些层、边界在哪、怎么验证），人审完再动手；

给背景的方式：直接贴相关文件路径 + 对应规范文档，而不是一句「帮我改下聊天功能」

#### 评审与验证

仓里有 harsh-current-branch-review（严厉自审当前 diff）、ai-check/ai-review/ai-preflight 脚本链，提交前自动过一遍

Agent 产出后必跑 typecheck + lint + 测试三件套；

#### 机械工作交给 Agent

比如：埋点 contract 同步、lint 自动修复、文档索引生成这类重复劳动都脚本化/skill 化了，人聚焦在理解与决策

> .agent 下面的东西需要去学习下，知道怎么编写这些文件

### 如何写测试验证 Agent 产出（JD 第 4 条，必考，给方法论）

- 约束前置：让 Agent 把核心逻辑写成纯函数/纯 reducer（流式状态机最典型），单测可以穷举边界（重复事件、迟到事件、错误路径）——可测试性是你设计 prompt 时就要提的要求
- 行为测试：组件层用 Testing Library 测用户可感知行为，不测实现细节，这样 Agent 重构内部实现时测试不过期
- 契约测试：埋点这类有 contract 的产出，contract sync + runtime 测试是强制门槛（reporting-guard 模式）
- 验收闭环：typecheck → lint → vitest 全绿才接受 diff； diff 过 harsh review；识别幻觉靠「类型系统 + 官方文档 + 最小验证」
- 实证：chat_entry 需求就是「Agent 产出 + 我补 null 边界断言 + contract 同步 + 跑绿合入」的完整循环

### 高频追问速答

- Hooks：useEffect 依赖与清理（订阅/定时器/observer 必须成对）、useMemo/useCallback 引用稳定性的前提是确实在渲染瓶颈上、useRef 不落渲染
- MobX vs Redux：响应式自动追踪 vs 显式单向流；流式事件多的场景 MobX+RxJS 模板代码少
- 为什么虚拟列表不用隐藏 DOM：节点仍在内存、事件监听与样式重算成本不消失，万级数据必须真正卸载
- React 18→19 迁移风险：peer 依赖兼容、第三方库（antd/MobX）支持矩阵、StrictMode 行为差异，需要逐包验证
