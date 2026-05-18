DeerFlow2

## 系统架构

### 整体架构

```
用户浏览器
   ↓
Nginx :2026（统一入口）
   ├── 代理页面请求 → 前端 Next.js :3000
   └── 代理 API 请求 /api/langgraph/* → Gateway API FastAPI :8001
       ↓
       LangGraph Server :2024
       ↓
       Lead Agent
       ↓
       IM 渠道（Feishu / Slack / Telegram）
```

### 分层治理

框架层（Harness）vs 应用层（App）

分层优势：可独立发布，高可测试性、高可复用性

```
backend/
│
├── packages/harness/deerflow/          # 框架层
│   │
│   ├── agents/                         # Agent系统
│   ├── sandbox/                        # 沙箱执行环境
│   ├── tools/                          # 工具系统
│   ├── models/                         # 模型工厂
│   └── config/                         # 配置系统
│
└── app/                                # 应用层
    │
    ├── gateway/                        # FastAPI REST API
    └── channels/                       # IM渠道集成（Feishu/Slack/Telegram）
```

CI强制分层：自动化测试，每次提交都执行

```
harness 允许导入 app，但是反过来不行
github workflow: tests/test_harness_boundary.py

1.使用 ast 解析 python ，提取所有导入信息
2.执行边界检查，判断导入是否包含 app
```

### 运行模式

```
标准模式（make dev） 4个独立子进程

Nginx（端口 2026）—— 统一入口
│
├── 前端 Next.js（端口 3000）
│
├── Gateway API FastAPI（端口 8001）
│   │
│   └── 调用 → LangGraph Server（端口 2024）
│                 │
│                 └── Lead Agent（独立进程）
│
└── （备注：Lead Agent 在独立进程中运行）
```

```
Gateway模式（make dev-pro），3个子进程

Nginx（端口 2026）—— 统一入口
│
├── 前端 Next.js（端口 3000）
│
└── Gateway API FastAPI（端口 8001）
    │
    ├── 内嵌 Agent 运行时
    │   ├── RunManager
    │   └── StreamBridge
    │
    └── （备注：Agent 运行时不再独立进程运行，而是内嵌进 Gateway）
```



### 技术选择

| 问题（while）  | LangGraph                                 |
| :------------- | :---------------------------------------- |
| 无法中断恢复   | Checkpointer 每步保存状态                 |
| 无法流式输出   | LangGraph 原生支持 streaming              |
| 无法可视化     | LangGraph 提供图结构                      |
| 难以扩展中间件 | LangGraph 的 middleware 钩子              |
| 无法并发       | LangGraph 支持 branch/join（Reducer机制） |



### 完整数据流

```
用户
  │
  │ 1. 发送消息
  ▼
前端（useSubmitThread）
  │
  │ 2. HTTP 请求（LangGraph SDK）
  ▼
Nginx（:2026）—— 统一入口
  │
  │ 3. 代理 /api/langgraph/*
  ▼
Gateway API FastAPI（:8001）
  │
  │ 4. 转发
  ▼
LangGraph Server（:2024）
  │
  │ 5. 触发
  ▼
Lead Agent Graph 开始执行
  │
  │ ═══════════════════════════════════════════════════════════════
  │                    中间件链执行（按顺序）
  │ ═══════════════════════════════════════════════════════════════
  │
  ├────────────────────────────────────────────────────────────────
  │              第一阶段：沙箱基础设施（feat.sandbox）
  ├────────────────────────────────────────────────────────────────
  │
  ├── 1. ThreadDataMiddleware
  │       ├── 功能：创建目录
  │       └── 动作：为当前对话线程准备工作目录（lazy_init=True）
  │
  ├── 2. UploadsMiddleware
  │       ├── 功能：注入上传文件
  │       └── 动作：将用户上传的文件注入到 Agent 上下文
  │
  ├── 3. SandboxMiddleware
  │       ├── 功能：分配沙箱
  │       └── 动作：为代码执行分配隔离的沙箱环境（lazy_init=True）
  │
  ├────────────────────────────────────────────────────────────────
  │              第二阶段：悬空工具调用（固定）
  ├────────────────────────────────────────────────────────────────
  │
  ├── 4. DanglingToolCallMiddleware
  │       ├── 功能：悬空工具调用处理
  │       └── 动作：处理未完成的工具调用（如中断后恢复）
  │
  ├────────────────────────────────────────────────────────────────
  │              第三阶段：护栏（feat.guardrail）
  ├────────────────────────────────────────────────────────────────
  │
  ├── 5. GuardrailMiddleware（自定义实例）
  │       ├── 功能：护栏检查
  │       └── 动作：内容安全、输入输出过滤、敏感词检测
  │
  ├────────────────────────────────────────────────────────────────
  │              第四阶段：工具错误处理（固定）
  ├────────────────────────────────────────────────────────────────
  │
  ├── 6. ToolErrorHandlingMiddleware
  │       ├── 功能：工具错误处理
  │       └── 动作：捕获工具执行异常，返回友好错误信息
  │
  ├────────────────────────────────────────────────────────────────
  │              第五阶段：摘要（feat.summarization）
  ├────────────────────────────────────────────────────────────────
  │
  ├── 7. SummarizationMiddleware（自定义实例，需 model 参数）
  │       ├── 功能：对话摘要
  │       └── 动作：当对话过长时生成摘要压缩上下文
  │
  ├────────────────────────────────────────────────────────────────
  │              第六阶段：计划模式（plan_mode）
  ├────────────────────────────────────────────────────────────────
  │
  ├── 8. TodoMiddleware（plan_mode=True 时启用）
  │       ├── 功能：任务待办管理
  │       ├── system_prompt: _TODO_SYSTEM_PROMPT
  │       ├── tool_description: _TODO_TOOL_DESCRIPTION
  │       └── 动作：管理复杂任务的步骤拆分和跟踪
  │
  ├────────────────────────────────────────────────────────────────
  │              第七阶段：自动标题（feat.auto_title）
  ├────────────────────────────────────────────────────────────────
  │
  ├── 9. TitleMiddleware
  │       ├── 功能：自动标题
  │       └── 动作：首次回复时自动生成对话标题
  │
  ├────────────────────────────────────────────────────────────────
  │              第八阶段：记忆（feat.memory）
  ├────────────────────────────────────────────────────────────────
  │
  ├── 10. MemoryMiddleware
  │       ├── 功能：记忆管理
  │       ├── agent_name: 当前 Agent 名称
  │       └── 动作：从对话中提取关键信息存入长期记忆
  │
  ├────────────────────────────────────────────────────────────────
  │              第九阶段：视觉（feat.vision）
  ├────────────────────────────────────────────────────────────────
  │
  ├── 11. ViewImageMiddleware
  │       ├── 功能：图像识别
  │       ├── 注入工具：view_image_tool
  │       └── 动作：处理用户发送的图片，调用视觉模型识别
  │
  ├────────────────────────────────────────────────────────────────
  │              第十阶段：子 Agent（feat.subagent）
  ├────────────────────────────────────────────────────────────────
  │
  ├── 12. SubagentLimitMiddleware
  │       ├── 功能：子 Agent 限制
  │       ├── 注入工具：task_tool
  │       └── 动作：管理子 Agent 的创建和执行，防止无限递归
  │
  ├────────────────────────────────────────────────────────────────
  │              第十一阶段：循环检测（固定）
  ├────────────────────────────────────────────────────────────────
  │
  ├── 13. LoopDetectionMiddleware
  │       ├── 功能：循环检测
  │       └── 动作：检测并防止 Agent 陷入无限循环
  │
  ├────────────────────────────────────────────────────────────────
  │              第十二阶段：澄清（固定，始终最后）
  ├────────────────────────────────────────────────────────────────
  │
  └── 14. ClarificationMiddleware
          ├── 功能：澄清请求
          ├── 注入工具：ask_clarification_tool
          └── 动作：当 Agent 需要用户补充信息时发起询问
  │
  │ ═══════════════════════════════════════════════════════════════
  │                    LLM 调用阶段
  │ ═══════════════════════════════════════════════════════════════
  │
  ▼
LLM（大模型）
  │
  ├── 输入：用户消息 + 上下文 + 中间件处理结果 + 工具定义
  │
  ├── 可用工具列表：
  │       ├── view_image_tool（feat.vision 时注入）
  │       ├── task_tool（feat.subagent 时注入）
  │       ├── ask_clarification_tool（始终注入）
  │       └── 其他自定义工具
  │
  ├── 输出决策：
  │       │
  │       ├── 工具执行
  │       │       ├── 调用相应工具
  │       │       ├── 获取执行结果
  │       │       └── 返回 LLM 继续推理（可能触发 ToolErrorHandlingMiddleware 错误处理）
  │       │
  │       └── 直接回复
  │               └── 进入响应返回阶段
  │
  │ ═══════════════════════════════════════════════════════════════
  │                    响应返回
  │ ═══════════════════════════════════════════════════════════════
  │
  ▼
响应逐层返回
  │
  ├── ClarificationMiddleware 可能拦截并转换为澄清问题
  ├── 各中间件的 after_agent 钩子依次执行
  │
  ▼
LangGraph Server（:2024）
  │
  ▼
Gateway API（:8001）
  │
  ▼
Nginx（:2026）
  │
  ▼
前端（收到响应）
  │
  ▼
用户（看到最终回复）
```



## 配置系统

配置文件分为两部分（`config.yml、extension_config.json`）：

- 安全边界：前者包含的是比较敏感的信息
- 修改频率：前者是部署时人工手动配置，修改频率地；后者可通过API对其修改（动态启用/禁用），频率高
- 格式匹配：前者格式对人类友好，支持注释、多行字符串；后者对机器友好，易于序列化，适合频繁读写

```yml
def get_app_config() -> AppConfig:
    """Get the DeerFlow config instance.

    Returns a cached singleton instance and automatically reloads it when the
    underlying config file path or modification time changes. Use
    `reload_app_config()` to force a reload, or `reset_app_config()` to clear
    the cache.
    """
    global _app_config, _app_config_path, _app_config_mtime

	# 配置文件路径
    resolved_path = AppConfig.resolve_config_path()
    # 获取配置文件修改时机
    current_mtime = _get_config_mtime(resolved_path)
	# 判断是否需要重新加载配置环境（路径改变/配置文件发生修改）
    should_reload = _app_config is None or _app_config_path != resolved_path or _app_config_mtime != current_mtime
    if should_reload:
        if _app_config_path == resolved_path and _app_config_mtime is not None and current_mtime is not None and _app_config_mtime != current_mtime:
            logger.info(
                "Config file has been modified (mtime: %s -> %s), reloading AppConfig",
                _app_config_mtime,
                current_mtime,
            )
            
         # 加载配置文件
         # 1.读取配置文件
         # 2.检查配置文件与示例配置文件版本是否一致，不一致时警告，提醒更新
         # 2.将配置中$开头的变量替换为环境变量值
        _load_and_cache_app_config(str(resolved_path))
    return _app_config
```



## 模型工厂

不同模型厂商的API存在差异，需要统一封装；采用工厂模式 + 反射加载 机制

只需要 `provider` 类底层继承于 `BaseChatModel` 即可，因此你可以扩展/补丁框架提供的 `provider` 或者自定义特殊的 `provider`

```python
def create_chat_model(name: str | None = None, thinking_enabled: bool = False, **kwargs) -> BaseChatModel:
    """Create a chat model instance from the config.
    
    # 配置列表中查找对应模型
    config = get_app_config()
    model_config = config.get_model_config(name)
    
    # 使用 importlib 动态导入 provider 类
    model_class = resolve_class(model_config.use, BaseChatModel)

    # 实例化模型
    model_instance = model_class(**{**model_settings_from_config, **kwargs})
```





## 状态管理

1、为何使用 `TypeDict` 而不是 `dataclass` 或 `Pydantic`

极致的运行时性能，它在运行时仅为普通字典，并且提供静态类型检查，无需实例化以及额外校验

2、为何不用全局字典

- schema 不明确：维护差，无法保证序列化/反序列化，可能包含 socket链接、文件句柄等
- 线程安全：多个并发请求同时修改字典，需要自己加锁；langgraph是更加节点接收的 state，返回新的更新字典，langgraph应用更新
- 无法使用 Reducer机制：禁止langgraph应用节点更新时触发，而全局变量绕过langgraph的状态管理

```python
class AgentState(TypedDict, Generic[ResponseT]):
    """State schema for the agent."""
	# 消息列表
    messages: Required[Annotated[list[AnyMessage], add_messages]]
    # 控制流程跳转
    jump_to: NotRequired[Annotated[JumpTo | None, EphemeralValue, PrivateStateAttr]]
    # 结构化输出
    structured_response: NotRequired[Annotated[ResponseT, OmitFromInput]]

class ThreadState(AgentState):
    # 沙箱标识
    sandbox: NotRequired[SandboxState | None]
    # 目录路径
    thread_data: NotRequired[ThreadDataState | None]
    # 对话标题
    title: NotRequired[str | None]
    # 产出文件
    artifacts: Annotated[list[str], merge_artifacts]
    # 待办任务
    todos: NotRequired[list | None]
    # 用户上传文件
    uploaded_files: NotRequired[list[dict] | None]
    # 查看图片文件
    viewed_images: Annotated[dict[str, ViewedImageData], merge_viewed_images]  # image_path  -> {base64, mime_type}
```

消息

- 自动追加消息，保证消息的完整性
- 自动替换相同ID的消息，这是流式输出的基础，对同一条消息仅修改内容

产出文件

- 使用列表存储，根据字典的键自动覆去重，保证唯一性
- 通过 Reducer 机制，自动合并产出的文件

```python
def merge_artifacts(existing: list[str] | None, new: list[str] | None) -> list[str]:
    """Reducer for artifacts list - merges and deduplicates artifacts."""
    if existing is None:
        return new or []
    if new is None:
        return existing
    # Use dict.fromkeys to deduplicate while preserving order
    return list(dict.fromkeys(existing + new))
```

图片查看（带内信令设计：通过数据本身内容传递控制信息）

```
图片查看流程

第一步：工具写入
state[view_iamges] = { "example1.png": {"base64": "xxx"}}

第二步：中间件注入
读取 state[view_images] 注入到 messages

第三步：
注入完成后返回空字典，触发清空逻辑，防止每轮对话重复注入图片
```

```python
def merge_viewed_images(existing: dict[str, ViewedImageData] | None, new: dict[str, ViewedImageData] | None) -> dict[str, ViewedImageData]:
    """Reducer for viewed_images dict - merges image dictionaries.

    Special case: If new is an empty dict {}, it clears the existing images.
    This allows middlewares to clear the viewed_images state after processing.
    """
    if existing is None:
        return new or {}
    if new is None:
        return existing
    # Special case: empty dict means clear all viewed images
    if len(new) == 0:
        return {}
    # Merge dictionaries, new values override existing ones for same keys
    return {**existing, **new}
```



## MCP协议

| 类型  | 通信方式                | 适用场景           |
| :---- | :---------------------- | :----------------- |
| stdio | 子进程 stdin/out        | 本地脚本、开发调试 |
| SSE   | HTTP Server-Sent Events | 内网服务、实时流   |
| HTTP  | HTTP Streamable         | 远程 API、企业服务 |

**选择原则：**

- 本地开发用 stdio（简单）
- 生产环境内网服务用 SSE
- 远程企业 API 用 HTTP（配合 OAuth）

```yml
  "mcpServers": {
    "github": {
      "enabled": true,
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {"GITHUB_TOKEN": "$GITHUB_TOKEN"}
    },
    "secure-http": {
      "enabled": true,
      "type": "http",
      "url": "https://api.example.com/mcp",
      "oauth": {
        "enabled": true,
        "token_url": "https://auth.example.com/oauth/token",
        "grant_type": "client_credentials",
        "client_id": "$MCP_OAUTH_CLIENT_ID",
        "client_secret": "$MCP_OAUTH_CLIENT_SECRET"
      }
    }
  },
```

懒加载：仅在LLM请求调用工具时才将其工具整体加入上下文中

热重载：仅需要修改配置文件，无需重启服务，即可立刻生效

OAuth自动刷新：内置OAuth管理器，自动请求Token并缓存，过期后自动刷新

MultiServerMCPClient：Langchain内置工具，将多个MCP服务器工具汇总成统一工具列表



## Skill技能

第一步：遍历 `skills` 目录下的所有技能，获取 名称、描述、路径...

第二部：组装为系统提示词的一部分

第三步：LLM决策使用某个技能时，选择读取文件工具，读取技能内容，将其放到上下文中

```python
def load_skills(skills_path: Path | None = None, use_config: bool = True, enabled_only: bool = False) -> list[Skill]:
    """
    Load all skills from the skills directory.

    Scans both public and custom skill directories, parsing SKILL.md files
    to extract metadata. The enabled state is determined by the skills_state_config.json file.

    Args:
        skills_path: Optional custom path to skills directory.
                     If not provided and use_config is True, uses path from config.
                     Otherwise defaults to deer-flow/skills
        use_config: Whether to load skills path from config (default: True)
        enabled_only: If True, only return enabled skills (default: False)

    Returns:
        List of Skill objects, sorted by name
    """
    
    # 读取skills目录路径
    if skills_path is None:
        if use_config:
            try:
                from deerflow.config import get_app_config

                config = get_app_config()
                skills_path = config.skills.get_skills_path()
            except Exception:
                # Fallback to default if config fails
                skills_path = get_skills_root_path()
        else:
            skills_path = get_skills_root_path()

    if not skills_path.exists():
        return []

    skills_by_name: dict[str, Skill] = {}

    # 扫描public/custom中的所有技能并以《skill-name， SKILL》方式存储
    for category in ["public", "custom"]:
        category_path = skills_path / category
        if not category_path.exists() or not category_path.is_dir():
            continue

        for current_root, dir_names, file_names in os.walk(category_path, followlinks=True):
            # Keep traversal deterministic and skip hidden directories.
            dir_names[:] = sorted(name for name in dir_names if not name.startswith("."))
            if "SKILL.md" not in file_names:
                continue

            skill_file = Path(current_root) / "SKILL.md"
            relative_path = skill_file.parent.relative_to(category_path)

            skill = parse_skill_file(skill_file, category=category, relative_path=relative_path)
            if skill:
                skills_by_name[skill.name] = skill
	# 读取所有技能（包含名称、描述...的对象）
    skills = list(skills_by_name.values())

    try:
        from deerflow.config.extensions_config import ExtensionsConfig
	    # 获取配置文件中SKILL的配置 { skill-name: false }
        extensions_config = ExtensionsConfig.from_file()
        for skill in skills:
            # 未配置时默认为True
            skill.enabled = extensions_config.is_skill_enabled(skill.name, skill.category)
    except Exception as e:
        logger.warning("Failed to load extensions config: %s", e)

    # 启用该配置表示禁用的技能会被过滤
    if enabled_only:
        skills = [skill for skill in skills if skill.enabled]

    skills.sort(key=lambda s: s.name)

    return skills
```



## 智能体工厂

每次请求都会使用工厂函数动态创建智能体，是为了支持每次请求动态配置、无共享可变状态；通过缓存机制，可以使得每次创建极快；通过热重载机制，可直接改变配置，无需重启服务，可再下次请求时生效



### 方案对比

| 方案                  | 核心问题               |
| :-------------------- | :--------------------- |
| 全局单例              | 无法支持每请求动态配置 |
| 每次请求完全创建      | 性能差（重复加载工具） |
| 工厂函数 + mtime 缓存 | ✅ 平衡最优解           |



### 创建分支

````python
# 用户自己创建的智能体
create_agent(
            model=create_chat_model(name=model_name, thinking_enabled=thinking_enabled),
            tools=get_available_tools(model_name=model_name, subagent_enabled=subagent_enabled) + [setup_agent],
            middleware=_build_middlewares(config, model_name=model_name),
            system_prompt=apply_prompt_template(subagent_enabled=subagent_enabled, max_concurrent_subagents=max_concurrent_subagents, available_skills=set(["bootstrap"])),
            state_schema=ThreadState,
        )

# 默认的智能体
create_agent(
        model=create_chat_model(name=model_name, thinking_enabled=thinking_enabled, reasoning_effort=reasoning_effort),
        tools=get_available_tools(model_name=model_name, groups=agent_config.tool_groups if agent_config else None, subagent_enabled=subagent_enabled),
        middleware=_build_middlewares(config, model_name=model_name, agent_name=agent_name),
        system_prompt=apply_prompt_template(
            subagent_enabled=subagent_enabled, max_concurrent_subagents=max_concurrent_subagents, agent_name=agent_name, available_skills=set(agent_config.skills) if agent_config and agent_config.skills is not None else None
        ),
        state_schema=ThreadState,
    )
````



### 模型解析

```python
def _resolve_model_name(requested_model_name: str | None = None) -> str:
    """Resolve a runtime model name safely, falling back to default if invalid. Returns None if no models are configured."""
    app_config = get_app_config()
    default_model_name = app_config.models[0].name if app_config.models else None
    if default_model_name is None:
        raise ValueError("No chat models are configured. Please configure at least one model in config.yaml.")
	# 请求指定模型
    if requested_model_name and app_config.get_model_config(requested_model_name):
        return requested_model_name
    if requested_model_name and requested_model_name != default_model_name:
        logger.warning(f"Model '{requested_model_name}' not found in config; fallback to default model '{default_model_name}'.")
    # 全局默认模型
    return default_model_name
```

```python
    # thinking 兼容处理
    if thinking_enabled and not model_config.supports_thinking:
        logger.warning(f"Thinking mode is enabled but model '{model_name}' does not support it; fallback to non-thinking mode.")
        thinking_enabled = False
```



### 工具组装

在工厂函数中组件，而非全局加载，可实现修改配置不重启服务（热重载）；内部检查 `config.yaml` 文件修改时间（mtime）

- 改变：重新加载，更新缓存
- 不变：命中缓存，几乎零开销

```
工具来源层次
│
├── Config-defined tools (config.yaml)
│     ├── tavily_search
│     ├── jina_reader
│     ├── bash
│     └── ...
│
├── MCP tools（懒加载）
│     └── 第一次使用时初始化
│
├── Built-in tools
│     ├── present_files：展示文件
│     ├── ask_clarification：向用户提问
│     └── view_image：读取图片
│
└── Subagent tool (subagent_enabled=True)
      └── task：委派给子智能体
```



### 中间件组装

必须按照顺序将所有中间件组件

```python
class AgentMiddleware:
    async def before_model(self, state) -> dict | None:
        """LLM 调用之前触发(中间件按照顺序从前到后执行)"""
    
    async def after_model(self, state, response) -> dict | Command | None:
        """LLM 返回响应之后触发(中间件按照顺序从后到前执行)"""
    
    async def before_tool(self, state, tool_call) -> ToolMessage | None:
        """工具调用之前触发"""
    
    async def after_tool(self, state, tool_call, result) -> ToolMessage | None:
        """工具执行完之后触发"""
```



### 系统提示词组装

```python
prompt = SYSTEM_PROMPT_TEMPLATE.format(
    agent_name=agent_name or "DeerFlow 2.0",
    soul=get_agent_soul(agent_name),
    # 技能层
    skills_section=skills_section,
    # 工具层
    deferred_tools_section=deferred_tools_section,
    # 记忆层
    memory_context=memory_context,
    # 子智能体层
    subagent_section=subagent_section,
    subagent_reminder=subagent_reminder,
    subagent_thinking=subagent_thinking,
    acp_section=acp_and_mounts_section,
)
```



## 中间件链

洋葱模型：执行顺序开始时有外向内，结束时由内向前

| 钩子            | 时机             | 职责                                                       |
| --------------- | ---------------- | ---------------------------------------------------------- |
| before_agent    | Agent 执行开始前 | 全局初始化：注入系统提示词、设置会话级变量、加载持久化配置 |
| after_agent     | Agent 执行完成后 | 资源清理：汇总执行结果、保存最终状态、触发后续流程         |
| before_model    | LLM 调用前       | 输入增强：注入记忆、图片、过滤工具                         |
| after_model     | LLM 返回后       | 意图拦截：审查 LLM 决策、拦截特定调用                      |
| wrap_model_call | 整个 LLM 调用    | 控制流程：重试逻辑、模型降级/缓存、请求/响应拦截           |
| before_tool     | 工具执行前       | 权限检查：检查工具是否允许执行                             |
| after_tool      | 工具执行后       | 结果后处理：记录日志、捕获异常                             |
| wrap_tool_call  | 整个工具调用     | 控制流程：重试机制、权限校验短路、大结果驱逐、中断控制     |

| # | Middleware | `before_agent` | `before_model` | `after_model` | `after_agent` | `wrap_tool_call` | 主 Agent | Subagent | 来源 |
|---|-----------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|------|
| 0 | ThreadDataMiddleware | ✓ | | | | | ✓ | ✓ | `sandbox` |
| 1 | UploadsMiddleware | ✓ | | | | | ✓ | ✗ | `sandbox` |
| 2 | SandboxMiddleware | ✓ | | | ✓ | | ✓ | ✓ | `sandbox` |
| 3 | DanglingToolCallMiddleware | | | ✓ | | | ✓ | ✗ | 始终开启 |
| 4 | GuardrailMiddleware | | | | | ✓ | ✓ | ✓ | *Phase 2 纳入* |
| 5 | ToolErrorHandlingMiddleware | | | | | ✓ | ✓ | ✓ | 始终开启 |
| 6 | SummarizationMiddleware | | | ✓ | | | ✓ | ✗ | `summarization` |
| 7 | TodoMiddleware | | | ✓ | | | ✓ | ✗ | `plan_mode` 参数 |
| 8 | TitleMiddleware | | | ✓ | | | ✓ | ✗ | `auto_title` |
| 9 | MemoryMiddleware | | | | ✓ | | ✓ | ✗ | `memory` |
| 10 | ViewImageMiddleware | | ✓ | | | | ✓ | ✗ | `vision` |
| 11 | SubagentLimitMiddleware | | | ✓ | | | ✓ | ✗ | `subagent` |
| 12 | LoopDetectionMiddleware | | | ✓ | | | ✓ | ✗ | 始终开启 |
| 13 | ClarificationMiddleware | | | ✓ | | | ✓ | ✗ | 始终最后 |

### 基础设施

#### 1.ThreadDataMiddleware

```yml
# 创建目录结构
.deer-flow/threads/{thread_id}/
├── workspace/    Agent 的工作目录
├── uploads/      用户上传的文件
└── outputs/      最终产出
```

#### 2.UploadsMiddleware

```
用户上传文件后，将文件信息注入到上下文
```

```yml
# 第一步：调用 api/uploads 上传文件到 .deer-flow/threads/{thread_id}/uploads
# 第二步：返回的文件信息作为额外参数添加到运行时配置中
# 第三步：解析运行时配置中的额外参数将其作为 HumanMessage信息追加到提问内容之前
# HumanMessage(content=[{type: text, text: 'file-content'}, {type: text, text: 'your-qa'}])

<upload-files>
# 固定内容
	- image.png
	Path: /mnt/user-data/uploads/image.png
	-...
# 固定内容...
</upload-files>
```

#### 3.SandboxMiddleware

````python
@override
def before_agent(self, state: SandboxMiddlewareState, runtime: Runtime) -> dict | None:
    # Skip acquisition if lazy_init is enabled
    if self._lazy_init:
        return super().before_agent(state, runtime)

    # Eager initialization (original behavior)
    if "sandbox" not in state or state["sandbox"] is None:
        thread_id = (runtime.context or {}).get("thread_id")
        if thread_id is None:
            return super().before_agent(state, runtime)
        # 创建沙箱
        sandbox_id = self._acquire_sandbox(thread_id)
        logger.info(f"Assigned sandbox {sandbox_id} to thread {thread_id}")
        return {"sandbox": {"sandbox_id": sandbox_id}}
    return super().before_agent(state, runtime)

@override
def after_agent(self, state: SandboxMiddlewareState, runtime: Runtime) -> dict | None:
    sandbox = state.get("sandbox")
    if sandbox is not None:
        sandbox_id = sandbox["sandbox_id"]
        logger.info(f"Releasing sandbox {sandbox_id}")
        get_sandbox_provider().release(sandbox_id)
        return None

    if (runtime.context or {}).get("sandbox_id") is not None:
        sandbox_id = runtime.context.get("sandbox_id")
        logger.info(f"Releasing sandbox {sandbox_id} from context")
        # 释放沙箱
        get_sandbox_provider().release(sandbox_id)
        return None

    # No sandbox to release
    return super().after_agent(state, runtime)
````



### 历史问题

#### 4.DanglingToolCallMiddleware

修复悬空工具调用：`LLM API`对消息格式要求严格：如果` AIMessage`中存在`tool_calls`，必须有对应的`ToolMessage`

```python
# 用户突然发新消息，打断了正在执行的工具调用。
# 历史消息中有一个 AIMessage 包含 tool_calls，但没有对应的 ToolMessage 

# [正常情况]
AIMessage(tool_calls=[...])
ToolMessage(tool_call_id=xxx, content="result")

# [悬空情况]
AIMessage(tool_calls=[...])
<缺少 ToolMessage! >

# 修复：插入占位符
ToolMessage(
    content="[Tool call was interrupted and did not return a result.]",
    tool_call_id=tc_id,
    name=tc.get("name", "unknown"),
    status="error",
)
```



### 异常处理

#### 5.LLMErrorHandlingMiddleware

LLM调用可能会失败：服务繁忙、额度不足、未授权...

```
关闭(Closed) → 连续5次失败 → 打开(Open) → 等待60秒 → 半开(Half-Open) → 成功 → 关闭

- 单次请求，最多尝试三次
- 同个线程：每三次调用失败，累计加1，共五次
```

```python
def wrap_model_call(
    self,
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelCallResult:
    # 熔断检查
    if self._check_circuit():
        return AIMessage(content=self._build_circuit_breaker_message())

    attempt = 1
    while True:
        try:
            response = handler(request)
            self._record_success()
            return response
        # 人机交互
        except GraphBubbleUp:
            # Preserve LangGraph control-flow signals (interrupt/pause/resume).
            with self._circuit_lock:
                if self._circuit_state == "half_open":
                    self._circuit_probe_in_flight = False
            raise
        except Exception as exc:
            retriable, reason = self._classify_error(exc)
            if retriable and attempt < self.retry_max_attempts:
                wait_ms = self._build_retry_delay_ms(attempt, exc)
                logger.warning(
                    "Transient LLM error on attempt %d/%d; retrying in %dms: %s",
                    attempt,
                    self.retry_max_attempts,
                    wait_ms,
                    _extract_error_detail(exc),
                )
                self._emit_retry_event(attempt, wait_ms, reason)
                time.sleep(wait_ms / 1000)
                attempt += 1
                continue
            logger.warning(
                "LLM call failed after %d attempt(s): %s",
                attempt,
                _extract_error_detail(exc),
                exc_info=exc,
            )
            if retriable:
                self._record_failure()
            return AIMessage(content=self._build_user_message(exc, reason))
```



### 安全边界

#### 6.GuardrailMiddleware

工具权限检查（默认，可自定义提供器）：白/黑名单 -> OAP策略

```
- 设置白名单：只允许在白名单中的工具执行
- 未设置白名单：检查工具是否在黑名单中，在则不允许执行
```

```python
def wrap_tool_call(
    self,
    request: ToolCallRequest,
    handler: Callable[[ToolCallRequest], ToolMessage | Command],
) -> ToolMessage | Command:
    # 工具名称、参数..
    gr = self._build_request(request)
    try:
        # 默认通过白名单方式
        decision = self.provider.evaluate(gr)
        # 中断/暂停/恢复
    except GraphBubbleUp:
        # Preserve LangGraph control-flow signals (interrupt/pause/resume).
        raise
    except Exception:
        logger.exception("Guardrail provider error (sync)")
        # 默认：失败时直接拒绝执行，不允许访问
        if self.fail_closed:
            decision = GuardrailDecision(allow=False, reasons=[GuardrailReason(code="oap.evaluator_error", message="guardrail provider error (fail-closed)")])
        else:
            return handler(request)
    # 判断工具是否允许执行
    if not decision.allow:
        logger.warning("Guardrail denied: tool=%s policy=%s code=%s", gr.tool_name, decision.policy_id, decision.reasons[0].code if decision.reasons else "unknown")
        return self._build_denied_message(request, decision)
    return handler(request)
```



#### 7.SandboxAuditMiddleware

安全审计：拦截和处理 `bash` 工具调用，防止大模型执行危险的命令

```python
def wrap_tool_call(
    self,
    request: ToolCallRequest,
    handler: Callable[[ToolCallRequest], ToolMessage | Command],
) -> ToolMessage | Command:
    if request.tool_call.get("name") != "bash":
        return handler(request)
	# 预处理，判断命令风险等级（block、warn、pass）
    command, _, verdict, reject_reason = self._pre_process(request)
    if verdict == "block":
        reason = reject_reason or "security violation detected"
        return self._build_block_message(request, reason)
    result = handler(request)
    if verdict == "warn":
        result = self._append_warn_to_result(result, command)
    return result
```



#### 8.ToolErrorHandlingMiddleware

捕获工具执行抛出的异常，让智能体从错误中恢复而不是崩溃

```python
def wrap_tool_call(
    self,
    request: ToolCallRequest,
    handler: Callable[[ToolCallRequest], ToolMessage | Command],
) -> ToolMessage | Command:
    try:
        return handler(request)
    except GraphBubbleUp:
        # Preserve LangGraph control-flow signals (interrupt/pause/resume).
        raise
    except Exception as exc:
        logger.exception("Tool execution failed (sync): name=%s id=%s", request.tool_call.get("name"), request.tool_call.get("id"))
        return self._build_error_message(request, exc)
```



### 上下文与任务

#### 9.SummarizationMiddleware

历史消息太长时，自动压缩，对其摘要

```python
def before_model(self, state: AgentState, runtime: Runtime) -> dict | None:
    return self._maybe_summarize(state, runtime)

def _maybe_summarize(self, state: AgentState, runtime: Runtime) -> dict | None:
    messages = state["messages"]
    # 确保每条消息都具有唯一ID
    self._ensure_message_ids(messages)
	# token 超出阈值时触发
    total_tokens = self.token_counter(messages)
    if not self._should_summarize(messages, total_tokens):
        return None

    cutoff_index = self._determine_cutoff_index(messages)
    if cutoff_index <= 0:
        return None
	
    # 取出最旧的一批消息（保留最近的N条）
    messages_to_summarize, preserved_messages = self._partition_messages(messages, cutoff_index)
    # 执行自定义钩子，进行消息追踪
    self._fire_hooks(messages_to_summarize, preserved_messages, runtime)
    # 调用LLM对旧数据生成摘要
    summary = self._create_summary(messages_to_summarize)
    # 构造新的摘要信息并替换旧的那批消息
    new_messages = self._build_new_messages(summary)

    return {
        "messages": [
            RemoveMessage(id=REMOVE_ALL_MESSAGES),
            *new_messages,
            *preserved_messages,
        ]
    }
```



#### 10.TodoListMiddleware

仅在 Plan Mode 下启用：自动注入 write_todos 工具及专用系统提示词

```python
def before_model(
    self,
    state: PlanningState,
    runtime: Runtime,
) -> dict[str, Any] | None:
    """Inject a todo-list reminder when write_todos has left the context window."""
    todos: list[Todo] = state.get("todos") or []  # type: ignore[assignment]
    # 检查是否有待办列表，否则返回
    if not todos:
        return None

    messages = state.get("messages") or []
    # 检查待办列表是否已经调用 wirte_tods 工具生成，是则返回
    if _todos_in_messages(messages):
        # write_todos is still visible in context — nothing to do.
        return None
	# 检查是否已经注入过提醒，告知模型调用 write_tods 工具维护代办列表
    if _reminder_in_messages(messages):
        # A reminder was already injected and hasn't been truncated yet.
        return None

    # The todo list exists in state but the original write_todos call is gone.
    # Inject a reminder as a HumanMessage so the model stays aware.
    # 初始化待办列表状态
    formatted = _format_todos(todos)
    reminder = HumanMessage(
        name="todo_reminder",
        content=(
            "<system_reminder>\n"
            "Your todo list from earlier is no longer visible in the current context window, "
            "but it is still active. Here is the current state:\n\n"
            f"{formatted}\n\n"
            "Continue tracking and updating this todo list as you work. "
            "Call `write_todos` whenever the status of any item changes.\n"
            "</system_reminder>"
        ),
    )
    return {"messages": [reminder]}
```



#### 11.TokenUsageMiddleware

记录 Token 使用量：用于成本分析、模型效率对比、前端展示消耗进度条





### 状态同步

#### 12.TitleMiddleware

首次对话后自动生成标题

```python
# 同步版本，降级方案，不调用LLM
def after_model(self, state: TitleMiddlewareState, runtime: Runtime) -> dict | None:
    return self._generate_title_result(state)
    
def _generate_title_result(self, state: TitleMiddlewareState) -> dict | None:
    """Generate a local fallback title without blocking on an LLM call."""
    # 首次完整对话后生成【humain-ai】
    if not self._should_generate_title(state):
        return None

    _, user_msg = self._build_title_prompt(state)
    return {"title": self._fallback_title(user_msg)}
```

```python
# 异步版本，有效调用LLM，生成智能标题
async def aafter_model(self, state: TitleMiddlewareState, runtime: Runtime) -> dict | None:
    return await self._agenerate_title_result(state)

async def _agenerate_title_result(self, state: TitleMiddlewareState) -> dict | None:
    """Generate a title asynchronously and fall back locally on failure."""
    if not self._should_generate_title(state):
        return None

    config = get_title_config()
    prompt, user_msg = self._build_title_prompt(state)

    try:
        if config.model_name:
            model = create_chat_model(name=config.model_name, thinking_enabled=False)
        else:
            model = create_chat_model(thinking_enabled=False)
        response = await model.ainvoke(prompt)
        title = self._parse_title(response.content)
        if title:
            return {"title": title}
    except Exception:
        logger.debug("Failed to generate async title; falling back to local title", exc_info=True)
    return {"title": self._fallback_title(user_msg)}
```



#### 13.MemoryMiddleware

异步记忆提取，不阻塞主进程

```python
def after_agent(self, state: MemoryMiddlewareState, runtime: Runtime) -> dict | None:
    """在智能体完成后将对话排队以更新记忆。

    Args:
        state: 当前的智能体状态。
        runtime: 运行时上下文。

    Returns:
        None（此中间件不需要修改状态）。
    """
    config = get_memory_config()
    if not config.enabled:
        return None

    # 优先从运行时上下文中获取 thread_id，然后回退到 LangGraph 的可配置元数据
    thread_id = runtime.context.get("thread_id") if runtime.context else None
    if thread_id is None:
        config_data = get_config()
        thread_id = config_data.get("configurable", {}).get("thread_id")
    if not thread_id:
        logger.debug("上下文中没有 thread_id，跳过记忆更新")
        return None

    # 从状态中获取消息
    messages = state.get("messages", [])
    if not messages:
        logger.debug("状态中没有消息，跳过记忆更新")
        return None

    # 过滤只保留用户输入和最终的智能体响应
    filtered_messages = filter_messages_for_memory(messages)

    # 只有在有意义的对话时才排队
    # 至少需要一条用户消息和一条智能体回复
    user_messages = [m for m in filtered_messages if getattr(m, "type", None) == "human"]
    assistant_messages = [m for m in filtered_messages if getattr(m, "type", None) == "ai"]

    if not user_messages or not assistant_messages:
        return None

    # 将过滤后的对话排队以进行记忆更新
    correction_detected = detect_correction(filtered_messages)
    reinforcement_detected = not correction_detected and detect_reinforcement(filtered_messages)
    # 放入异步队列，指定时间后批量处理
    queue = get_memory_queue()
    queue.add(
        thread_id=thread_id,
        messages=filtered_messages,
        agent_name=self._agent_name,
        correction_detected=correction_detected,
        reinforcement_detected=reinforcement_detected,
    )

    return None
```



#### 14.ViewImageMiddleware

仅当模型支持 `suppoert_vision` 时启用

```python
def before_model(self, state: ViewImageMiddlewareState, runtime: Runtime) -> dict | None:
    """Inject image details message before LLM call if view_image tools have completed (sync version).

    This runs before each LLM call, checking if the previous turn included view_image
    tool calls that have all completed. If so, it injects a human message with the image
    details so the LLM can see and analyze the images.

    Args:
        state: Current state
        runtime: Runtime context (unused but required by interface)

    Returns:
        State update with additional human message, or None if no update needed
    """
    return self._inject_image_message(state)


def _inject_image_message(self, state: ViewImageMiddlewareState) -> dict | None:
    """Internal helper to inject image details message.

    Args:
        state: Current state

    Returns:
        State update with additional human message, or None if no update needed
    """
    # 最后一条消息是AI的并且包含调用工具信息
    # 查看图片工具已经执行完成
    # 检查是否已经插入过相同的图片信息
    if not self._should_inject_image_message(state):
        return None

    # 创建查看图片消息
    image_content = self._create_image_details_message(state)
    human_msg = HumanMessage(content=image_content)
    # { type: 'iamge_url', "image_url": {"url": f"data:{mime_type};base64,{base64_data}"},}
    return {"messages": [human_msg]}
```



### 工具过滤与并发

#### 15.DefterredToolFilterMiddleware

为了节省成本，不应该直接加载所有工具，而是将其加入工具注册中心，根据状态进行动态加载；这些动态加载的工具，工具名会被提取成整体字符串并将其添加到系统提示词中

```python
def _filter_tools(self, request: ModelRequest) -> ModelRequest:
    from deerflow.tools.builtins.tool_search import get_deferred_registry

    registry = get_deferred_registry()
    if not registry:
        return request

    deferred_names = {e.name for e in registry.entries}
    active_tools = [t for t in request.tools if getattr(t, "name", None) not in deferred_names]

    if len(active_tools) < len(request.tools):
        logger.debug(f"Filtered {len(request.tools) - len(active_tools)} deferred tool schema(s) from model binding")

    return request.override(tools=active_tools)

@override
def wrap_model_call(
    self,
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelCallResult:
    return handler(self._filter_tools(request))
```



#### 16.SubagentLimitMiddleware

限制并发子智能体数量，防止LLM消耗大量资源

```python
def _truncate_task_calls(self, state: AgentState) -> dict | None:
    """截断超过限制的 task 工具调用
    
    当模型一次性生成过多的 task 工具调用时（例如同时启动数十个子任务），
    此方法会截断多余的调用，只保留前 max_concurrent 个。
    
    Args:
        state: Agent 的当前状态，包含消息历史
        
    Returns:
        包含截断后消息的字典，如果没有截断则返回 None
    """
    messages = state.get("messages", [])
    if not messages:
        return None

    # 获取最后一条消息（应该是 AI 的响应）
    last_msg = messages[-1]
    # 只处理 AI 消息，忽略用户或工具消息
    if getattr(last_msg, "type", None) != "ai":
        return None

    # 获取 AI 消息中的工具调用列表
    tool_calls = getattr(last_msg, "tool_calls", None)
    if not tool_calls:
        return None

    # 找出所有名称为 "task" 的工具调用的索引位置
    # 例如：tool_calls = [tool1, task1, tool2, task2, task3]
    # task_indices 可能为 [1, 3, 4]
    task_indices = [i for i, tc in enumerate(tool_calls) if tc.get("name") == "task"]
    
    # 如果 task 调用数量未超过限制，无需截断
    if len(task_indices) <= self.max_concurrent:
        return None

    # 确定要丢弃的索引：超出限制的部分
    # 假设 max_concurrent=2，task_indices=[1,3,4]
    # indices_to_drop = [3,4]（保留索引1，丢弃3和4）
    indices_to_drop = set(task_indices[self.max_concurrent :])
    
    # 构建截断后的工具调用列表：只保留不在丢弃集合中的调用
    truncated_tool_calls = [tc for i, tc in enumerate(tool_calls) if i not in indices_to_drop]

    dropped_count = len(indices_to_drop)
    logger.warning(
        f"截断了 {dropped_count} 个多余的 task 工具调用 "
        f"(限制: {self.max_concurrent})"
    )

    # 创建新的 AI 消息，使用相同的 id 但替换工具调用列表
    # 相同的 id 可以确保 LangGraph 正确替换原消息
    updated_msg = last_msg.model_copy(update={"tool_calls": truncated_tool_calls})
    
    # 返回更新后的消息列表（替换最后一条消息）
    return {"messages": [updated_msg]}


@override
def after_model(self, state: AgentState, runtime: Runtime) -> dict | None:
    """模型调用后的回调方法
    
    在模型生成响应后立即执行，用于截断超量的 task 工具调用，
    防止子任务数量超过并发限制。
    """
    return self._truncate_task_calls(state)
```



### 死循环与澄清

#### 17.LoopDetectionMiddleware

LLM又是会陷模式：尝试读取不存在文件->报错->再读->再报错->循环

```
提供两层检测机制：
1. **基于哈希(工具名+调用参数)的检测**（已有）：捕获完全相同的工具调用集合。
例如：连续 3 次调用 {"read_file": ["a.txt"], "calculate": [2]} 的相同组合。

2. **基于频率的检测**（新增）：捕获同一工具类型被频繁调用但参数不同的情况。
例如：连续调用 40 次 read_file 读取不同文件，虽然是不同参数但工具类型相同。
```



```python
def _apply(self, state: AgentState, runtime: Runtime) -> dict | None:
    """
    应用工具调用限制策略：根据当前状态和运行时环境，决定是否添加警告或强制停止。

    主要逻辑：
    1. 检查当前工具调用的次数是否触发警告或硬停止条件。
    2. 若触发硬停止（hard_stop），则移除最后一条 AIMessage 中的 tool_calls，
       并追加停止提示文本，防止模型继续调用工具。
    3. 若仅触发警告（warning），则注入一条 HumanMessage 作为提醒，
       避免使用 SystemMessage 引发某些模型（如 Anthropic）的系统消息顺序限制错误。
    4. 若无需要处理的限制，则返回 None。

    Args:
        state: 当前代理状态，包含消息历史等信息。
        runtime: 运行时上下文，用于获取配置和运行时环境。

    Returns:
        若触发硬停止，返回包含修改后消息的字典；
        若触发警告，返回包含 HumanMessage 的字典；
        否则返回 None。
    """
    # 获取当前限制状态：warning 为非硬性提醒文本，hard_stop 为是否强制停止的标志
    warning, hard_stop = self._track_and_check(state, runtime)

    if hard_stop:
        # 强制停止：移除工具调用能力，确保模型输出纯文本
        messages = state.get("messages", [])
        last_msg = messages[-1]

        # 构建新的消息内容：原内容 + 停止提示（若无已有警告则使用默认硬停止消息）
        content = self._append_text(last_msg.content, warning or _HARD_STOP_MSG)

        # 构建更新后的 AIMessage（移除 tool_calls 字段）
        stripped_msg = last_msg.model_copy(update=self._build_hard_stop_update(last_msg, content))

        # 返回修改后的消息，覆盖原消息列表中的最后一条
        return {"messages": [stripped_msg]}

    if warning:
        # 仅触发警告：注入 HumanMessage 而非 SystemMessage
        # 原因：某些模型（如 Anthropic）要求系统消息只能出现在对话开头，
        # 中途插入 SystemMessage 会导致 langchain_anthropic 的 _format_messages() 崩溃。
        # 而 HumanMessage 在所有支持的模型提供商中均能正常工作（参见 issue #1299）。
        return {"messages": [HumanMessage(content=warning)]}

    # 无警告且无硬停止，无需修改状态
    return None
```



#### 18.ClarificationMiddleware

确保中断时所有后续副作用都不应该发生

```python
def _handle_clarification(self, request: ToolCallRequest) -> Command:
    """处理澄清请求并返回命令以中断执行。

    当工具被调用时，此方法会提取问题文本，构造一个格式化的工具消息，
    然后返回一个 `Command` 对象，该对象会：
    1. 将工具消息添加到消息历史中
    2. 将执行流程导向 `END`（中断图执行）

    Args:
        request: 工具调用请求对象，包含原始的工具调用数据

    Returns:
        Command: 用于中断执行并返回格式化澄清消息的命令
    """
    # 从工具调用的参数中提取澄清请求的内容
    # 示例: {"question": "请确认您的年龄？"}
    args = request.tool_call.get("args", {})
    question = args.get("question", "")

    logger.info("拦截到澄清请求 (ask_clarification)")
    logger.debug("澄清问题: %s", question)

    # 根据参数（例如问题、可选项、上下文等）格式化最终要展示给用户的消息
    formatted_message = self._format_clarification_message(args)

    # 获取本次工具调用的唯一ID，用于关联工具消息（ToolMessage）
    tool_call_id = request.tool_call.get("id", "")

    # 创建 ToolMessage 对象，内容为格式化后的澄清问题
    # 该消息会被追加到对话历史中，前端可识别 ask_clarification 工具消息并直接展示
    tool_message = ToolMessage(
        id=self._stable_message_id(tool_call_id, formatted_message),  # 稳定生成消息ID
        content=formatted_message,
        tool_call_id=tool_call_id,
        name="ask_clarification",
    )

    # 返回 Command 对象，指示 LangGraph 运行时：
    # - update: 将上述 tool_message 添加到消息状态中
    # - goto: 将控制流转到 END（即立即中断图执行，不再继续后续节点）
    # 
    # 注意：此处不额外添加 AIMessage，前端会直接检测 ask_clarification 类型的工具消息并显示给用户
    return Command(
        update={"messages": [tool_message]},
        goto=END,
    )

# ----------------------------------------------------------------------

 @override
def wrap_tool_call(
    self,
    request: ToolCallRequest,
    handler: Callable[[ToolCallRequest], ToolMessage | Command],
) -> ToolMessage | Command:
    """同步版本的工具调用包装器，拦截 ask_clarification 工具调用并中断执行。

    该方法会在工具实际执行前进行检查：
    - 如果当前调用的工具名称是 "ask_clarification"，则走自定义的澄清处理流程（中断执行）；
    - 否则，调用传入的 handler 正常执行原工具逻辑。

    Args:
        request: 工具调用请求对象
        handler: 原始工具执行处理器（默认的处理逻辑）

    Returns:
        如果拦截到澄清调用，返回中断命令（Command）；
        否则返回原始工具执行的结果（ToolMessage 或 Command）。
    """
    # 判断当前工具调用是否是我们需要特殊处理的 ask_clarification 工具
    if request.tool_call.get("name") != "ask_clarification":
        # 非澄清请求：交给原有的处理函数正常执行
        return handler(request)

    # 拦截到澄清请求：调用专用方法生成中断命令
    return self._handle_clarification(request)
```



## 工具系统

### 文件配置

采用反射加载机制，运行时使用`importlib`动态加载，扩展工具仅需要修改配置文件，对扩展开放，对修改关闭

`use: 模块路径:变量名`

```yml
tools:
  - name: web_search
    group: web
    use: deerflow.community.ddg_search.tools:web_search_tool
    max_results: 5
```

为何使用工具组的方式

- 新增/删除工具时配置简单，无需为所有智能体都配置一次
- 意图更清晰，确定智能体的能力范围





### 内置工具

#### present_file_tool

转换产出文件，使用户能够下载文件

```python
@tool("present_files", parse_docstring=True)
def present_file_tool(
    runtime: ToolRuntime[ContextT, ThreadState],
    filepaths: list[str],
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> Command:
    """Make files visible to the user for viewing and rendering in the client interface.

    When to use the present_files tool:

    - Making any file available for the user to view, download, or interact with
    - Presenting multiple related files at once
    - After creating files that should be presented to the user

    When NOT to use the present_files tool:
    - When you only need to read file contents for your own processing
    - For temporary or intermediate files not meant for user viewing

    Notes:
    - You should call this tool after creating files and moving them to the `/mnt/user-data/outputs` directory.
    - This tool can be safely called in parallel with other tools. State updates are handled by a reducer to prevent conflicts.

    Args:
        filepaths: List of absolute file paths to present to the user. **Only** files in `/mnt/user-data/outputs` can be presented.
    """
    try:
        # 标准化所有文件路径：
        # 1. 验证每个文件路径是否位于允许的目录（/mnt/user-data/outputs）中
        # 2. 将路径转换为统一的宿主机的绝对路径格式
        # 3. 如果路径无效或不在允许范围内，会抛出 ValueError
        normalized_paths = [_normalize_presented_filepath(runtime, filepath) for filepath in filepaths]
    except ValueError as exc:
        # 如果任何文件路径无效，返回错误消息
        # 使用 ToolMessage 让用户知道哪个路径有问题
        return Command(
            update={"messages": [ToolMessage(f"Error: {exc}", tool_call_id=tool_call_id)]},
        )

    # merge_artifacts reducer 会自动处理：
    # - 将新文件路径合并到现有的 artifacts 状态中
    # - 去重（避免重复添加相同的文件路径）
    # - 保持状态的一致性
    # 
    # 返回 Command 对象来更新两个状态字段：
    # - "artifacts": 存储要展示给用户的文件路径列表
    # - "messages": 记录工具执行成功的消息，用于对话历史
    return Command(
        update={
            "artifacts": normalized_paths,
            "messages": [ToolMessage("Successfully presented files", tool_call_id=tool_call_id)],
        },
    )
```



#### ask_clarification

对用户输入的问题进行澄清

```python
@tool("ask_clarification", parse_docstring=True, return_direct=True)
def ask_clarification_tool(
    question: str,
    clarification_type: Literal[
        "missing_info",          # 缺少信息
        "ambiguous_requirement", # 需求模糊
        "approach_choice",       # 方案选择
        "risk_confirmation",     # 风险确认
        "suggestion",            # 建议
    ],
    context: str | None = None,
    options: list[str] | None = None,
) -> str:
    """Ask the user for clarification when you need more information to proceed.
    当需要更多信息才能继续时，向用户请求澄清。

    Use this tool when you encounter situations where you cannot proceed without user input:
    当遇到没有用户输入就无法继续的情况时使用此工具：

    - **Missing information**: Required details not provided (e.g., file paths, URLs, specific requirements)
      缺少信息：未提供必需的详细信息（例如：文件路径、URL、具体要求）
    - **Ambiguous requirements**: Multiple valid interpretations exist
      需求模糊：存在多种合理的解释
    - **Approach choices**: Several valid approaches exist and you need user preference
      方案选择：存在多个有效方案，需要用户选择偏好
    - **Risky operations**: Destructive actions that need explicit confirmation (e.g., deleting files, modifying production)
      风险确认：需要明确确认的破坏性操作（例如：删除文件、修改生产环境）
    - **Suggestions**: You have a recommendation but want user approval before proceeding
      建议：您有推荐方案，但需用户批准后再继续

    The execution will be interrupted and the question will be presented to the user.
    执行将被中断，问题将呈现给用户。
    Wait for the user's response before continuing.
    请等待用户回复后再继续。

    When to use ask_clarification:
    何时使用 ask_clarification：
    - You need information that wasn't provided in the user's request
      用户请求中未提供所需信息时
    - The requirement can be interpreted in multiple ways
      需求可以从多种方式解释时
    - Multiple valid implementation approaches exist
      存在多个有效的实现方案时
    - You're about to perform a potentially dangerous operation
      即将执行潜在危险操作时
    - You have a recommendation but need user approval
      有推荐方案但需要用户批准时

    Best practices:
    最佳实践：
    - Ask ONE clarification at a time for clarity
      每次只问一个澄清问题，保持清晰
    - Be specific and clear in your question
      问题要具体、清晰
    - Don't make assumptions when clarification is needed
      需要澄清时不要做假设
    - For risky operations, ALWAYS ask for confirmation
      对于风险操作，始终要求确认
    - After calling this tool, execution will be interrupted automatically
      调用此工具后，执行将自动中断

    Args:
        question: The clarification question to ask the user. Be specific and clear.
                 向用户提出的澄清问题。要具体、清晰。
        clarification_type: The type of clarification needed (missing_info, ambiguous_requirement, approach_choice, risk_confirmation, suggestion).
                           所需的澄清类型。
        context: Optional context explaining why clarification is needed. Helps the user understand the situation.
                 可选的上下文信息，解释为何需要澄清。帮助用户理解情况。
        options: Optional list of choices (for approach_choice or suggestion types). Present clear options for the user to choose from.
                 可选的选项列表（用于 approach_choice 或 suggestion 类型）。为用户提供清晰的选项供选择。
    """
    # This is a placeholder implementation
    # 这是一个占位实现
    # The actual logic is handled by ClarificationMiddleware which intercepts this tool call
    # 实际逻辑由 ClarificationMiddleware 处理，该中间件会拦截此工具调用
    # and interrupts execution to present the question to the user
    # 并中断执行，将问题呈现给用户
    return "Clarification request processed by middleware"
    # 返回："澄清请求已由中间件处理"
```



#### skill_manage_tool

管理自定义技能，仅在配置文件中启用时自动注入

```python
@tool("skill_manage", parse_docstring=True) 
async def skill_manage_tool(
    runtime: ToolRuntime[ContextT, ThreadState],  # 运行时上下文，包含状态和配置信息
    action: str,                                   # 操作类型：create/patch/edit/delete/write_file/remove_file
    name: str,                                     # 技能名称，使用连字符格式（如 my-custom-skill）
    content: str | None = None,                    # 文件内容：用于 create、edit 或 write_file 操作
    path: str | None = None,                       # 辅助文件路径：用于 write_file 或 remove_file 操作
    find: str | None = None,                       # 要替换的现有文本：用于 patch 操作
    replace: str | None = None,                    # 替换文本：用于 patch 操作
    expected_count: int | None = None,             # 期望的替换次数：用于验证 patch 操作结果
) -> str:  # 返回操作结果的字符串描述
    """管理 skills/custom/ 目录下的自定义技能。

    Args:
        action: 操作类型，可选值：create（创建）、patch（修补）、edit（编辑）、
                delete（删除）、write_file（写入文件）、remove_file（删除文件）
        name: 技能名称，使用连字符命名规范（hyphen-case）
        content: 新文件内容，用于 create、edit 或 write_file 操作
        path: 辅助文件路径，用于 write_file 或 remove_file 操作
        find: 要替换的现有文本，用于 patch 操作
        replace: 替换文本，用于 patch 操作
        expected_count: 可选的期望替换次数，用于 patch 操作验证
    """
    # 调用内部实现函数，传递所有参数
    return await _skill_manage_impl(
        runtime=runtime,      # 运行时上下文
        action=action,        # 操作类型
        name=name,            # 技能名称
        content=content,      # 文件内容（可选）
        path=path,            # 文件路径（可选）
        find=find,            # 查找文本（可选）
        replace=replace,      # 替换文本（可选）
        expected_count=expected_count,  # 期望替换次数（可选）
    )
```



#### view_image_tool

查看图片工具，仅在模型支持是自动注入

```python
@tool("view_image", parse_docstring=True)
def view_image_tool(
    runtime: ToolRuntime[ContextT, ThreadState],
    image_path: str,
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> Command:
    """Read an image file.

    Use this tool to read an image file and make it available for display.

    When to use the view_image tool:
    - When you need to view an image file.

    When NOT to use the view_image tool:
    - For non-image files (use present_files instead)
    - For multiple files at once (use present_files instead)

    Args:
        image_path: Absolute path to the image file. Common formats supported: jpg, jpeg, png, webp.
    """
    from deerflow.sandbox.tools import get_thread_data, replace_virtual_path

    # Replace virtual path with actual path
    # /mnt/user-data/* paths are mapped to thread-specific directories
    thread_data = get_thread_data(runtime)
    actual_path = replace_virtual_path(image_path, thread_data)

    # Validate that the path is absolute
    path = Path(actual_path)
    if not path.is_absolute():
        return Command(
            update={"messages": [ToolMessage(f"Error: Path must be absolute, got: {image_path}", tool_call_id=tool_call_id)]},
        )

    # Validate that the file exists
    if not path.exists():
        return Command(
            update={"messages": [ToolMessage(f"Error: Image file not found: {image_path}", tool_call_id=tool_call_id)]},
        )

    # Validate that it's a file (not a directory)
    if not path.is_file():
        return Command(
            update={"messages": [ToolMessage(f"Error: Path is not a file: {image_path}", tool_call_id=tool_call_id)]},
        )

    # Validate image extension
    valid_extensions = {".jpg", ".jpeg", ".png", ".webp"}
    if path.suffix.lower() not in valid_extensions:
        return Command(
            update={"messages": [ToolMessage(f"Error: Unsupported image format: {path.suffix}. Supported formats: {', '.join(valid_extensions)}", tool_call_id=tool_call_id)]},
        )

    # Detect MIME type from file extension
    mime_type, _ = mimetypes.guess_type(actual_path)
    if mime_type is None:
        # Fallback to default MIME types for common image formats
        extension_to_mime = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }
        mime_type = extension_to_mime.get(path.suffix.lower(), "application/octet-stream")

    # Read image file and convert to base64
    try:
        with open(actual_path, "rb") as f:
            image_data = f.read()
            image_base64 = base64.b64encode(image_data).decode("utf-8")
    except Exception as e:
        return Command(
            update={"messages": [ToolMessage(f"Error reading image file: {str(e)}", tool_call_id=tool_call_id)]},
        )

    # Update viewed_images in state
    # The merge_viewed_images reducer will handle merging with existing images
    new_viewed_images = {image_path: {"base64": image_base64, "mime_type": mime_type}}

    return Command(
        update={"viewed_images": new_viewed_images, "messages": [ToolMessage("Successfully read image", tool_call_id=tool_call_id)]},
    )
```



#### tool_search

配置中启用时自动注入；查找注册中心中符合要求的工具，并将其移除，过滤工具中间件才不会将其过滤

```python
@tool
def tool_search(query: str) -> str:
    """Fetches full schema definitions for deferred tools so they can be called.

    Deferred tools appear by name in <available-deferred-tools> in the system
    prompt. Until fetched, only the name is known — there is no parameter
    schema, so the tool cannot be invoked. This tool takes a query, matches
    it against the deferred tool list, and returns the matched tools' complete
    definitions. Once a tool's schema appears in that result, it is callable.

    Query forms:
      - "select:Read,Edit,Grep" — fetch these exact tools by name
      - "notebook jupyter" — keyword search, up to max_results best matches
      - "+slack send" — require "slack" in the name, rank by remaining terms

    Args:
        query: Query to find deferred tools. Use "select:<tool_name>" for
               direct selection, or keywords to search.

    Returns:
        Matched tool definitions as JSON array.
    """
    registry = get_deferred_registry()
    if not registry:
        return "No deferred tools available."

    matched_tools = registry.search(query)
    if not matched_tools:
        return f"No tools found matching: {query}"

    # Use LangChain's built-in serialization to produce OpenAI function format.
    # This is model-agnostic: all LLMs understand this standard schema.
    tool_defs = [convert_to_openai_function(t) for t in matched_tools[:MAX_RESULTS]]

    # Promote matched tools so the DeferredToolFilterMiddleware stops filtering
    # them from bind_tools — the LLM now has the full schema and can invoke them.
    registry.promote({t.name for t in matched_tools[:MAX_RESULTS]})

    return json.dumps(tool_defs, indent=2, ensure_ascii=False)
```



### MCP工具

可启用工具懒加载，在需要时动态加载工具，避免消耗资源；其中所有懒加载的工具都会提取其名称加入到系统提示词中

```python
mcp_tools = []
    # 重置注册中心
    reset_deferred_registry()
    if include_mcp:
        try:
            from deerflow.config.extensions_config import ExtensionsConfig
            from deerflow.mcp.cache import get_cached_mcp_tools

            extensions_config = ExtensionsConfig.from_file()
            if extensions_config.get_enabled_mcp_servers():
                # MCP工具通过 mtime 实现缓存
                mcp_tools = get_cached_mcp_tools()
                if mcp_tools:
                    if config.tool_search.enabled:
                        from deerflow.tools.builtins.tool_search import DeferredToolRegistry, set_deferred_registry
                        from deerflow.tools.builtins.tool_search import tool_search as tool_search_tool
					  # 将所有MCP工具加入注册中心，在大模型使用 tool_search 查找工具符合工具时再将其加入到工具列表
                        # 注册中心中的工具，工具过滤中间件都会将其过滤
                        registry = DeferredToolRegistry()
                        for t in mcp_tools:
                            registry.register(t)
                        set_deferred_registry(registry)
                        builtin_tools.append(tool_search_tool)
                        logger.info(f"Tool search active: {len(mcp_tools)} tools deferred")
        except ImportError:
            logger.warning("MCP module not available. Install 'langchain-mcp-adapters' package to enable MCP tools.")
        except Exception as e:
            logger.error(f"Failed to get cached MCP tools: {e}")
```





## 沙箱系统

Agent（智能体）的行为具有不可预测性，且往往拥有执行代码或调用系统的权限，沙箱是隔离风险、保护宿主环境安全的必要手段

- **恶意提示词攻击**：用户可能输入类似“删除系统重要文件”或“下载并执行未知脚本”的指令。没有沙箱，Agent会忠实地执行，导致系统崩溃或感染病毒。
- **Agent自身代码漏洞**：Agent的代码可能存在漏洞（如命令注入）。攻击者可能利用漏洞，让Agent执行本不该做的危险操作。
- **第三方插件风险**：很多Agent依赖外部工具或插件。这些插件可能包含恶意代码。沙箱能限制插件的破坏范围。

```
┌─────────────────────────────────────────────────────────┐
│ 目录隔离解决了并发冲突，但还没有解决：                    │
│ “用户A 能不能访问用户B 的文件？”                         │
└─────────────────────────────────────────────────────────┘

【危险：如果 Agent 知道物理路径】
│
└─ backend/.deer-flow/threads/abc-123/user-data/workspace/
         │
         └─ 包含了 thread_id = abc-123  （可被枚举攻击）

【原始路径】
┌─────────────────────────────────────────────────────────┐
│ .../threads/abc-123/user-data/workspace/report.pdf      │
└─────────────────────────────────────────────────────────┘

【修改后的路径（仍然危险）】
┌─────────────────────────────────────────────────────────┐
│ ./.threads/def-456/user-data/workspace/report.pdf       │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ Agent 可以通过枚举 thread_id 来访问任意用户的文件        │
│ → 路径枚举攻击！                                         │
└─────────────────────────────────────────────────────────┘

【解决方案：让 Agent 永远不知道物理路径】
┌─────────────────────────────────────────────────────────┐
│ /mnt/user-data/workspace/   （不含任何 thread id 信息）  │
│ /mnt/user-data/uploads/                                  │
│ /mnt/user-data/outputs/                                  │
│ /mnt/skills/                                             │
└─────────────────────────────────────────────────────────┘
```



### 路径转换

正向翻译：工具执行前会将虚拟路径转换为物理路径

反向翻译：工具输出时需要将物理路径替换为虚拟路径

```python
VIRTUAL_PATH_MAPPINGS = {
    "/mnt/user-data/workspace": (tid) => `backend/.deer-flow/threads/${tid}/user-data/workspace`,
    "/mnt/user-data/uploads": (tid) => `backend/.deer-flow/threads/${tid}/user-data/uploads`,
    "/mnt/user-data/outputs": (tid) => `backend/.deer-flow/threads/${tid}/user-data/outputs`,
    "/mnt/skills": () => `backend/skills`,
};
```

```python
def _resolve_and_validate_user_data_path(path: str, thread_data: ThreadDataState) -> str:
    """Resolve a /mnt/user-data virtual path and validate it stays in bounds.

    Returns the resolved host path string.
    """
    # 替换为真实物理路径
    resolved_str = replace_virtual_path(path, thread_data)
    resolved = Path(resolved_str).resolve()
    # 边界校验：校验路径是否为虚拟路径所映射的物理路径，防止沙箱逃逸
    _validate_resolved_user_data_path(resolved, thread_data)
    return str(resolved)
```



### 本地沙箱

**LocalSandboxProvider** 使用单例模式，所有线程共用同一个 provider 实例。

目录级隔离：意味着所有对话共用一个本地沙箱，没有进程级隔离，没有内核级隔离。

**合理使用场景**：开发环境、私有部署、完全信任的用户群体。

**不该用它的场景**：公开服务、多租户部署、需要认真对待安全性的生产环境。

```python
class LocalSandboxProvider(SandboxProvider):
    _instance = None  # 单例

def acquire(self, thread_id: str | None = None) -> str:
    global _singleton
    if _singleton is None:
        _singleton = LocalSandbox("local", path_mappings=self._path_mappings)
    return _singleton.id

def get(self, sandbox_id: str) -> Sandbox | None:
    if sandbox_id == "local":
        if _singleton is None:
            self.acquire()
        return _singleton
    return None

def release(self, sandbox_id: str) -> None:
    # LocalSandbox uses singleton pattern - no cleanup needed.
    # Note: This method is intentionally not called by SandboxMiddleware
    # to allow sandbox reuse across multiple turns in a thread.
    # For Docker-based providers (e.g., AioSandboxProvider), cleanup
    # happens at application shutdown via the shutdown() method.
    pass
```



### 容器沙箱

**AioSandboxProvider**（Docker 沙箱）提供内核级隔离：每个线程一个独立的容器

- **本地 Docker / Apple Container 模式**（自动启动容器）
- **远程 / K8s（Kubernetes）模式**（连接到预先存在的沙箱 URL）

```yml
sandbox:
  use: deerflow.community.aio_sandbox:AioSandboxProvider
  # 镜像
  image: enterprise-public-cn-beijing.cr.volces.com/vefaas-public/all-in-one-sandbox:latest
  # 端口号
  port: 8080
  # 并行数量
  replicas: 3
  # 容器前缀
  container_prefix: deer-flow-sandbox
  # 卷挂载
  mounts:
    - host_path: /path/on/host
      container_path: /home/user/shared
      read_only: false
  # 环境变量
  environment:
    NODE_ENV: production
    DEBUG: "false"
    API_KEY: $MY_API_KEY        # Reads from host's MY_API_KEY env var
    DATABASE_URL: $DATABASE_URL  # Reads from host's DATABASE_URL env var
```

#### 初始化

```python
def __init__(self):
    self._lock = threading.Lock()
    # 正在活跃的容器
    self._sandboxes: dict[str, AioSandbox] = {}  # sandbox_id -> AioSandbox instance
    self._sandbox_infos: dict[str, SandboxInfo] = {}  # sandbox_id -> SandboxInfo (for destroy)
    self._thread_sandboxes: dict[str, str] = {}  # thread_id -> sandbox_id
    self._thread_locks: dict[str, threading.Lock] = {}  # thread_id -> in-process lock
    self._last_activity: dict[str, float] = {}  # sandbox_id -> last activity timestamp
    # Warm pool: released sandboxes whose containers are still running.
    # Maps sandbox_id -> (SandboxInfo, release_timestamp).
    # Containers here can be reclaimed quickly (no cold-start) or destroyed
    # when replicas capacity is exhausted.
    self._warm_pool: dict[str, tuple[SandboxInfo, float]] = {}
    self._shutdown_called = False
    self._idle_checker_stop = threading.Event()
    self._idle_checker_thread: threading.Thread | None = None

    self._config = self._load_config()
    self._backend: SandboxBackend = self._create_backend()

    # Register shutdown handler
    atexit.register(self.shutdown)
    self._register_signal_handlers()

    # Reconcile orphaned containers from previous process lifecycles
    self._reconcile_orphans()

    # Start idle checker if enabled
    if self._config.get("idle_timeout", DEFAULT_IDLE_TIMEOUT) > 0:
        self._start_idle_checker()
```



#### 线程安全

| 特性           | `self._lock`                      | `self._thread_locks`         |
| :------------- | :-------------------------------- | :--------------------------- |
| **锁的范围**   | 整个 provider 实例                | 每个 thread_id 一个独立的锁  |
| **保护的数据** | 全局共享状态（所有 sandbox 映射） | 特定 thread 的操作序列       |
| **粒度**       | 粗粒度                            | 细粒度                       |
| **并发性**     | 同一时间只能一个线程操作全局状态  | 不同 thread 可以并发执行     |
| **作用域**     | 保护所有线程的共享数据            | 保护同一个 thread 的多次操作 |

```python
def _get_thread_lock(self, thread_id: str) -> threading.Lock:
    """Get or create an in-process lock for a specific thread_id."""
    with self._lock:
        if thread_id not in self._thread_locks:
            self._thread_locks[thread_id] = threading.Lock()
        return self._thread_locks[thread_id]
```



#### 确定容器

LangGraph Server 在生产环境会启动多个 worker 进程（典型配置 4-8 个）。这些 worker 进程没有共享内存，同一个用户的请求可能落到任意一个 worker 上

随机UUID：

```python
# worker 1 创建了容器，worker 2 不知道，会尝试再创建一个——同一个 thread 有两个容器，状态不一致
str(uuid.uuid4())[:8]
```

确定性ID：同进程ID，任意 worker 都能计算出相同的容器ID

```python
# 完整 sha256 是 64 个字符，作为容器名太长。8 位十六进制提供 4,294,967,296 种可能值，碰撞概率极
hashlib.sha256(thread_id.encode()).hexdigest()[:8]
```





#### 容器温池

Docker 沙箱存在一个严重的性能问题：容器冷启动需要 2–5 秒。

没有温池时的用户体验：
用户发消息 → Agent 决定执行代码 → 拉起 Docker 容器（等 3 秒）→ 执行命令（0.1 秒）

温池（Warm Pool）设计思路：
容器执行完任务后，不立即销毁，而是放入温池继续运行。下次同一个线程需要执行时，直接从温池取出已经运行的容器，跳过启动过程。

```
容器生命周期：
用户请求 → acquire(thread_id)
→ 检查进程内缓存（最快）
→ 检查温池（快，容器还在运行）
→ 冷启动（慢，需要 2–5 秒）

任务完成 → release(sandbox_id)
→ 容器放入温池（继续运行）

空闲超过 600 秒 → 空闲检查器销毁容器
```



#### 孤儿容器

**产生**

worker进程被SIGKILL（机器停止、OOM、操作系统强制终止，进程内存瞬间消失；但是Remote Docker是独立的进程，不受影响，重启后新的worker进程对容器一无所知，进程中的缓存、温池是空的，无人认领的运行中容器称为孤儿容器

**危害**

占用宿主机内存和CPU，随着崩溃次数增加，导致资源耗尽

**错误解决**

启动时扫描所有`deer-flow-sanbox` 前缀容器并将其删除，单机部署时可行，反正不可。因为无法区分那些是孤儿容器，那些是正在活跃的容器，直接删除，会导致正在服务用户的请求容器也删除导致报错

**正确解决**

启动时无条件放入温池中，空闲检查器会定期扫描温池容器，将超过指定时间（默认600s）未活动的容器删除

```python
def _reconcile_orphans(self) -> None:
    try:
        running = self._backend.list_running()
    except Exception as e:
        logger.warning(f"Failed to enumerate running containers during startup reconciliation: {e}")
        return

    if not running:
        return

    current_time = time.time()

    for info in running:
        # 每次认领都获取锁，避免 TOCTOU（time of check time of use） 竞争，如果多个进程时会导致重复添加
        with self._lock:
            if info.sandbox_id in self._sandboxes or info.sandbox_id in self._warm_pool:
                continue
            self._warm_pool[info.sandbox_id] = (info, current_time)
```



#### 空闲双重检查器

没有双重检查的时可能会导致以下问题

```
t=0 空闲检查器：容器 x 已空闲 601 秒，决定删除
t=1 ← 就在这一毫秒之间 →
t=2 用户发消息，acquire(thread_id) 从温池取出容器 x
t=3 空闲检查器执行删除容器 x
t=4 用户的代码执行失败：容器不存在
```

```python
def _cleanup_idle_sandboxes(self, idle_timeout: float) -> None:
    current_time = time.time()
    active_to_destroy = []
    warm_to_destroy: list[tuple[str, SandboxInfo]] = []

    # 🔴 第一次检查（Time of Check）
    with self._lock:
        # 检查活跃容器
        for sandbox_id, last_activity in self._last_activity.items():
            idle_duration = current_time - last_activity
            if idle_duration > idle_timeout:
                active_to_destroy.append(sandbox_id)  # 标记待销毁
        
        # 检查暖池容器
        for sandbox_id, (info, release_ts) in list(self._warm_pool.items()):
            warm_duration = current_time - release_ts
            if warm_duration > idle_timeout:
                warm_to_destroy.append((sandbox_id, info))
                del self._warm_pool[sandbox_id]  # 从暖池移除

    # ⚠️ 危险窗口：锁已释放，但还未真正销毁
    # 这里可能被其他线程（acquire/release）插入执行
    
    # 销毁活跃容器（第二次检查 + 使用）
    for sandbox_id in active_to_destroy:
        try:
            # 🟢 第二次检查（Time of Use）
            with self._lock:
                last_activity = self._last_activity.get(sandbox_id)
                if last_activity is None:
                    continue  # 已被释放或销毁
                if (time.time() - last_activity) < idle_timeout:
                    continue  # 被重新激活了！
            
            # 真正销毁
            logger.info(f"Destroying idle sandbox {sandbox_id}")
            self.destroy(sandbox_id)  # Time of Use
        except Exception as e:
            logger.error(f"Failed to destroy idle sandbox {sandbox_id}: {e}")

    # 销毁暖池容器（已从_warm_pool移除，直接销毁）
    for sandbox_id, info in warm_to_destroy:
        try:
            self._backend.destroy(info)
        except Exception as e:
            logger.error(f"Failed to destroy idle warm-pool sandbox {sandbox_id}: {e}")
```



#### 数据卷挂载

通过容器的方式，工具运行的虚拟路径其实也是容器的真实路径，无需翻译以及反向翻译

````python
def _get_thread_mounts(thread_id: str) -> list[tuple[str, str, bool]]:
    """Get volume mounts for a thread's data directories.

    Creates directories if they don't exist (lazy initialization).
    Mount sources use host_base_dir so that when running inside Docker with a
    mounted Docker socket (DooD), the host Docker daemon can resolve the paths.
    """
    paths = get_paths()
    paths.ensure_thread_dirs(thread_id)

    return [
        (paths.host_sandbox_work_dir(thread_id), f"{VIRTUAL_PATH_PREFIX}/workspace", False),
        (paths.host_sandbox_uploads_dir(thread_id), f"{VIRTUAL_PATH_PREFIX}/uploads", False),
        (paths.host_sandbox_outputs_dir(thread_id), f"{VIRTUAL_PATH_PREFIX}/outputs", False),
        # ACP workspace: read-only inside the sandbox (lead agent reads results;
        # the ACP subprocess writes from the host side, not from within the container).
        (paths.host_acp_workspace_dir(thread_id), "/mnt/acp-workspace", True),
    ]
````





## 子智能体

`task_tool` 指导主智能体动态创建子智能体，通过子智能体执行任务并返回结果

```
task_tool
    ├── 1. 验证阶段
    ├── 2. 配置准备  
    ├── 3. 上下文继承
    ├── 4. 创建执行器
    ├── 5. 异步运行
    └── 6. 轮询结果
```

```
将任务委托给一个专门的子代理，该子代理在其自身的上下文中运行。

子代理可以帮助您：
通过将探索和实现分开来保留上下文
自主处理复杂的多步骤任务
在隔离的上下文中执行命令或操作
可用的子代理类型取决于当前激活的沙盒配置：
通用型：一个能力全面的代理，适用于需要同时进行探索和行动的复杂多步骤任务。当任务需要复杂的推理、多个依赖步骤，或因隔离上下文而受益时使用。
bash：用于运行 bash 命令的命令执行专家。仅在明确允许主机 bash 或使用诸如 AioSandboxProvider 等隔离 shell 沙盒时才可用。

何时使用此工具：
需要多个步骤或工具的复杂任务
会产生大量输出信息的任务
希望将上下文与主对话隔离开来时
并行的研究或探索任务
何时不应使用此工具：
简单的单步操作（请直接使用工具）
需要用户交互或澄清的任务

参数：
description：任务的简短描述（3-5 个词），用于记录/显示。请始终将此参数放在第一位。
prompt：给子代理的任务描述。请具体明确地说明需要做什么。请始终将此参数放在第二位。
subagent_type：要使用的子代理类型。请始终将此参数放在第三位。
max_turns：代理轮次的最大次数（可选）。默认使用子代理配置中的最大轮次
```



### 智能体类型

| 类型            | 工具集                                              | 适用场景   |
| :-------------- | :-------------------------------------------------- | :--------- |
| general-purpose | bash + search + read_file + write_file + view_image | 综合任务   |
| Bash            | 只有 bash                                           | 纯脚本执行 |

````python
# 获取所有可用的子智能体类型名称
available_subagent_names = get_available_subagent_names()

# 智能体类型 bash、purpose，均有对应的配置
config = get_subagent_config(subagent_type)
if config is None:
    return f"错误：未知的子智能体类型 '{subagent_type}'"

# 特殊检查：bash子智能体需要系统允许
if subagent_type == "bash" and not is_host_bash_allowed():
    return f"错误：{LOCAL_BASH_SUBAGENT_DISABLED_MESSAGE}"
````



### 配置覆盖

```python
overrides = {}

# 附加全局技能提示词
skills_section = get_skills_prompt_section()
if skills_section:
    overrides["system_prompt"] = config.system_prompt + "\n\n" + skills_section

# 限制最大交互轮数
if max_turns is not None:
    overrides["max_turns"] = max_turns

# 应用覆盖配置
if overrides:
    config = replace(config, **overrides)
```



### 继承父级上下文

```python
# 从父智能体获取运行时信息
sandbox_state = runtime.state.get("sandbox")      # 沙箱环境
thread_data = runtime.state.get("thread_data")    # 线程数据
thread_id = runtime.context.get("thread_id")       # 会话ID
parent_model = metadata.get("model_name")         # 使用的模型
trace_id = metadata.get("trace_id") or str(uuid.uuid4())[:8]  # 追踪ID
```



### 准备工具集

```python
# 继承父智能体的工具组限制
parent_tool_groups = metadata.get("tool_groups")

# 获取工具（禁用子智能体嵌套）
tools = get_available_tools(
    model_name=parent_model,
    groups=parent_tool_groups,
    subagent_enabled=False  # ⚠️ 禁止递归创建子智能体
)
```



### 创建并启动执行器

```python
# 创建执行器实例
executor = SubagentExecutor(
    config=config,
    tools=tools,
    parent_model=parent_model,
    sandbox_state=sandbox_state,
    thread_data=thread_data,
    thread_id=thread_id,
    trace_id=trace_id,
)

# 启动异步后台任务（立即返回task_id）
task_id = executor.execute_async(prompt, task_id=tool_call_id)

# 发送任务开始事件
writer({"type": "task_started", "task_id": task_id, "description": description})
```



### 轮询转发结果

```python
while True:
    result = get_background_task_result(task_id)
    
    # 实时转发子智能体的每条消息
    if len(result.ai_messages) > last_message_count:
        for message in new_messages:
            writer({"type": "task_running", "message": message})
    
    # 根据状态返回结果
    if result.status == COMPLETED:
        return f"成功：{result.result}"
    elif result.status == FAILED:
        return f"失败：{result.error}"
    elif result.status == CANCELLED:
        return "任务已取消"
    elif result.status == TIMED_OUT:
        return "任务超时"
    
    await asyncio.sleep(5)  # 等待5秒后继续轮询
```



### 多重线程池

调度池：任务调度/超时/状态管理

`没有调度池会怎么样？阻塞当前线程，调用方无法执行后续任何操作，如轮询查看状态，发送事件`

```python
def run_task():
    # 任务开始执行状态修改
    with _background_tasks_lock:
        _background_tasks[task_id].status = SubagentStatus.RUNNING
        _background_tasks[task_id].started_at = datetime.now()
        result_holder = _background_tasks[task_id]

    try:
        # 将任务提交到执行池
        # task: 任务描述
        # result_holder: 任务对象（实时更新，调用方轮询查看并发送给前端）
        execution_future: Future = _execution_pool.submit(self.execute, task, result_holder)
        try:
            # 等待执行器超时时间
            exec_result = execution_future.result(timeout=self.config.timeout_seconds)
            with _background_tasks_lock:
                # 更新最终任务结果（状态、结果...)
                _background_tasks[task_id].status = exec_result.status
        except FuturesTimeoutError:
            # 处理超时任务
            with _background_tasks_lock:
                if _background_tasks[task_id].status == SubagentStatus.RUNNING:
                    _background_tasks[task_id].status = SubagentStatus.TIMED_OUT
            # 取消任务
            result_holder.cancel_event.set()
            execution_future.cancel()
    except Exception as e:
        # 任务失败
        with _background_tasks_lock:
            _background_tasks[task_id].status = SubagentStatus.FAILED

  # 非阻塞，立马返回
 _scheduler_pool.submit(run_task)
 return task_id
```

执行池：执行任务（完整的Agent生命周期）

```python
def execute(self, task: str, result_holder: SubagentResult | None = None) -> SubagentResult:
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

       # 可能是在事件循环线程中被调用执行
        if loop is not None and loop.is_running():
            future = _isolated_loop_pool.submit(self._execute_in_isolated_loop, task, result_holder)
            return future.result()

        # 否则在当前线程中创建事件循环并执行任务
        return asyncio.run(self._aexecute(task, result_holder))
    except Exception as e:
        # 执行失败，更新任务对象信息并返回
        return result
```

隔离事件循环池：创建独立的运行环境，线程的事件循环是唯一的不允许嵌套

```python
def _execute_in_isolated_loop(self, task: str, result_holder: SubagentResult | None = None) -> SubagentResult:
    """
    在当前线程中隔离的事件循环里执行异步任务。
    
    创建一个完全独立的事件循环，避免与任何现有事件循环冲突，确保正确清理未完成的任务和资源，
    并在完成后恢复原始的事件循环状态。
    
    Args:
        task: 用于日志/调试的任务标识符或描述
        result_holder: 可选的用于存储结果的容器，如果提供，结果也会存储在这里
        
    Returns:
        执行异步任务后返回的 SubagentResult
        
    Note:
        这在需要从同步代码中调用异步代码时特别有用，尤其是在可能存在运行中事件循环的场景中
        （例如：Jupyter notebook、测试环境或嵌套的异步上下文）。
    """
    
    # 尝试获取当前线程中已存在的事件循环
    # 如果没有设置任何循环，这会失败（这种情况很正常）
    try:
        previous_loop = asyncio.get_event_loop()
    except RuntimeError:
        # 当前线程中没有事件循环
        previous_loop = None

    # 创建一个全新的、完全隔离的事件循环实例
    # 这个循环独立于其他线程或上下文中的任何现有循环
    loop = asyncio.new_event_loop()
    try:
        # 将这个新循环设置为当前线程的事件循环
        # 在操作期间，这会覆盖之前设置的任何循环
        asyncio.set_event_loop(loop)
        
        # 同步运行异步协程，阻塞直到完成
        # 循环会一直运行直到协程完成或抛出异常
        return loop.run_until_complete(self._aexecute(task, result_holder))
    finally:
        # 开始清理阶段 —— 确保即使发生异常也不会泄漏资源
        try:
            # 获取此循环中所有尚未完成的待处理任务
            pending = asyncio.all_tasks(loop)
            if pending:
                # 取消所有待处理任务，防止它们无限期挂起
                for task_obj in pending:
                    task_obj.cancel()
                
                # 等待所有被取消的任务实际完成/清理
                # 使用 return_exceptions=True 确保不会因为取消操作而抛出异常
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))

            # 正确关闭异步生成器
            # 这允许它们执行清理代码（aclose）
            loop.run_until_complete(loop.shutdown_asyncgens())
            
            # 关闭默认的线程池执行器
            # 等待所有由执行器支持的操作完成
            loop.run_until_complete(loop.shutdown_default_executor())
        except Exception:
            # 记录日志但不重新抛出 - 清理失败不应掩盖原始结果
            # 使用 debug 级别，因为这些失败通常不严重
            logger.debug(
                f"[trace={self.trace_id}] 清理子代理 {self.config.name} 的隔离事件循环时失败",
                exc_info=True,
            )
        finally:
            # 始终关闭循环以释放其资源
            try:
                loop.close()
            finally:
                # 恢复原始的事件循环（如果之前没有则设为 None）
                # 这确保线程返回到原始状态，防止对可能期望特定循环的调用代码产生副作用
                asyncio.set_event_loop(previous_loop)
```

