# 设计探索：把 MCP 与 Skill 做成 app 的产品功能

> 状态：**探索阶段**，落地前需用户拍板若干关键决策（尤其「部署模型」）。
> 目标：让小说 app 的**最终用户**能在生成时配置并使用 (1) 外部 MCP 工具、(2) 可复用的「写作技能包 / Skill」。
> 本文不是实施计划，是把可行性、架构、风险、成本和必须先定的决策摊开。

---

## 0. 一句话结论

- **Skill（写作技能包）**：低风险、与模型无关、独立可发、价值立竿见影——**建议先做**。本质是把现有 `PromptTemplate` 扩成用户可编排、可挂到小说 / 动作上的指令包。
- **MCP（生成时调外部工具）**：高价值但**强依赖工具调用循环**（即 `agentic-retrieval-refactor-plan.md` 里明确推迟的 **v2**），且带两个硬约束——**用户自配端点的 tool-calling 支持度未知** + **stdio MCP 的服务端 RCE 安全风险**。建议在 v2 工具循环落地后、且**先定部署模型**再做。

两者可解耦：Skill 不需要工具循环，能立刻上；MCP 排在 v2 之后。

---

## 1. 现有地基（已具备 / 已缺失）

**已具备：**
- 配置链 `User → AiProvider(apiUrl/apiKey) → AiModel(maxTokens) → AiConfig(purpose)`，小说可覆盖（[ai-configs.ts](../server/utils/ai-configs.ts)）。新增「MCP 服务器」「技能包」可平行复用这套「用户级实体 + 小说级覆盖」的范式。
- **工具注入通道已通**：`extraBody` 原样并入 OpenAI 兼容请求体（[ai-client.ts:81-88](../server/utils/ai-client.ts#L81-L88)），可注入 `tools` / `tool_choice`。
- **提示词模板实体已存在**：`PromptTemplateSchema` 已有 `category`（如 `character_generation`，见 [characters/generate.post.ts:30-38](../server/api/novels/[id]/characters/generate.post.ts#L30-L38)）——Skill 可在此之上扩展，不必从零造。
- 后处理 / 任务队列、流式三封装、按用途解析配置，均可复用。

**已缺失（MCP 的前置）：**
- **没有工具调用循环**。现 `callAi` / `streamAi` 只读 `choices[0].message.content`，**不解析 `tool_calls`**（[ai-client.ts:128-242](../server/utils/ai-client.ts#L128-L242)）。`agentic-retrieval-refactor-plan.md` 的 v2 段已规划 `callAiWithTools(options,{tools,handlers,maxRounds})` + `supportsTools` 探测 + 静默忽略检测——**MCP 产品功能 = 这个 v2 + 外部 MCP 桥接**。

---

## 2. Skill（写作技能包）— 建议先做

### 2.1 产品形态

用户可创建 / 启用「技能包」，每个包是一组**注入式指令**（非工具），例如：
- 风格类：「网文爽文节奏」「古风对白规范」「冷硬派叙事」
- 方法类：「悬疑布线（伏笔密度 / 回收节奏）」「多线叙事切换规则」
- 约束类：「分级 / 敏感词回避」「人称与时态一致性」

技能包可：按小说默认启用、按单次生成动作临时勾选、可组合（多个叠加）、可分享 / 导入（导出 JSON）。

### 2.2 与现有结构的关系

把 `PromptTemplate` 泛化为「技能包」：`category` 扩展、内容结构化为 `{ systemAddon, fewShots?, checklist?, appliesTo: [generate|outline|rewrite|...] }`。生成时按「小说启用的 + 本次勾选的」技能包，把 `systemAddon` 注入 system prompt（接在 `styleGuide` 之后，[ai-prompts.ts:167-169](../server/utils/ai-prompts.ts#L167-L169)），`checklist` 作为生成后自检项（可挂到一致性 / review 流程）。

### 2.3 为什么先做

- **与模型无关**：纯文本注入，任何 OpenAI 兼容端点都生效，无 tool-calling 依赖。
- **零新外部攻击面**：不连外部进程 / 网络。
- **复用度高**：实体、CRUD、注入点全有现成骨架。

### 2.4 工作量梗概

实体扩展 + CRUD 端点 + 注入点改造（`buildGenerationPrompt` 等加 `skillAddons` 入参）+ 设置页 UI + 生成对话框的「技能勾选」。无架构风险。

---

## 3. MCP（生成时调外部工具）— 依赖 v2，排在其后

### 3.1 产品形态

用户注册 **MCP 服务器**（如：世界观 wiki、设定数据库、起名器、联网检索、历史 / 地理事实校验），生成正文时 AI 可**按需调用**这些工具取真实资料，减少「编设定 / 记错设定」。

### 3.2 架构（三块）

```
模型(支持 function calling) ──tool_calls──► Nuxt 服务端 MCP 桥接
   ▲                                              │ 按 server 路由
   │ tools=[内部记忆工具 + 各 MCP server 暴露的工具]  ▼
   └────────── tool 结果回灌 ◄──────── MCP Client(stdio / HTTP / SSE)──► 用户配置的 MCP Server
```

1. **工具循环 `callAiWithTools`（= v2）**：解析 `choices[0].message.tool_calls`，分派 → 执行 → 把结果作为 `role:'tool'` 消息回灌 → 循环至模型停止或 `maxRounds`。经 `extraBody.tools` 注入（通道已验证）。
2. **MCP Client（新）**：服务端用官方 MCP SDK 连接已启用的 MCP 服务器，`listTools` → 转成 OpenAI `tools` schema；收到 `tool_calls` 按归属 server `callTool`，结果回灌。
3. **新实体 `McpServer`**（用户级，仿 `AiProvider`）：`name / transport(stdio|http|sse) / command|url / auth / enabled / 能力缓存`；可按小说覆盖「本书启用哪些 MCP」。

### 3.3 两个硬约束（必须正面处理）

**(A) 用户自配端点的 tool-calling 支持度未知**（记忆 `agentic-retrieval-refactor` 已锁定的风险）
- 兼容端点可能：① 对 `tools` 直接 400；② **静默忽略**、返回普通正文。
- 需 `supportsTools` 探测 + 缓存（复用 `AiModel` 的连通性记录字段思路），并识别「发了 tools 但 0 个 tool_calls」为软失败。
- **降级链**：MCP/full → 不支持 / 报错 / 静默忽略 → 回落到 v1 的 `query-only` 检索（纯文本，不需工具）→ `seed-only`。即「MCP 锦上添花，不可用时退回现有检索，绝不中断生成」。

**(B) 安全：stdio MCP = 服务端 RCE**
- stdio 传输会在**服务器**上起子进程跑任意命令。本 app 有多用户 / 管理员 / 鉴权体系——多租户下放开 stdio MCP = 任意用户在你服务器上执行任意代码。
- 因此**部署模型决定 MCP 形态**（见 §5 决策）：
  - **单用户自托管**：可允许 stdio（用户即服务器主人，风险自担）。
  - **多租户 SaaS**：**禁用 stdio**，只允许远程 HTTP/SSE MCP，并加 SSRF 防护（禁内网地址）、超时、调用频次 / 结果体积上限、按用户隔离凭据。

### 3.4 其他工程点

- **延迟 / 成本**：每轮工具往返都加首 token 前延迟与 token 成本；需 `maxRounds` 上限、工具结果截断、把 MCP 调用做成可选（默认关，用户显式开）。
- **流式**：工具循环里穿插的 SSE 事件（`type:'tool_call' / 'tool_result'`）要让前端能显示「正在查阅 XX…」——需扩 `useAI.streamGenerate` → `consumeSSEStream` 的 typed-event 透传（现仅透 `onChunk/onError`，[useAI.ts:24](../app/composables/useAI.ts#L24)）。
- **内部工具先行**：v2 本就规划 `memory-tools.ts`（`search_memory / get_character / get_foreshadowing / find_first_mention`）。建议**先把内部记忆做成工具**跑通工具循环，再接外部 MCP——外部 MCP 只是多注册一批工具来源。

---

## 4. 建议的阶段路线

| 阶段 | 内容 | 依赖 | 风险 |
|---|---|---|---|
| **S1** | Skill 写作技能包（实体扩展 + 注入 + UI） | 无 | 低 |
| **S2** | v2 工具循环 `callAiWithTools` + `supportsTools` 探测 + 内部 `memory-tools` | 兼容端点工具支持 | 中 |
| **S3** | MCP Client 桥接 + `McpServer` 实体 + 远程(HTTP/SSE) MCP | S2 + 部署模型决策 | 中高（安全） |
| **S4** | （仅单用户自托管）stdio 本地 MCP | S3 + 明确单租户 | 高（RCE，需隔离） |

S1 与 S2/S3 完全解耦，可立即并行于「生成质量优化计划」推进。

---

## 5. 需要你拍板的决策

1. **部署模型**：本 app 是**单用户自托管**为主，还是**多租户 SaaS**？——直接决定 MCP 能否支持 stdio、安全设计强度。（这条不定，MCP 无法动工。）
2. **Skill 的定义**：是「写作技能包（注入式指令，本文 §2 推荐）」，还是必须对齐 Claude 那种「指令 + 可带工具」的完整 Skill？前者独立可发，后者要等 MCP。
3. **MCP 优先级**：是「生成质量优化」之后再排，还是与 Skill 并行启动 v2？
4. **范围**：MCP 是只用于**正文生成取料**，还是也覆盖大纲 / 角色 / 世界观生成？

---

## 6. 与现有计划的关系

- 本设计的 MCP 部分 **= `agentic-retrieval-refactor-plan.md` 的 v2（已推迟的工具循环）+ 外部 MCP 桥接**，不另起炉灶；v2 的 `supportsTools` / 静默忽略 / 降级链设计直接复用。
- Skill 与 `generation-quality-plan.md` 互补：技能包的 `checklist` 可接入那边的一致性 / review；技能包的指令注入与 B3 结构化摘要、C2 结构化大纲不冲突。
