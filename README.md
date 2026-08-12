# ChromeNeedle - Local AI Browser Agent

基于 [Needle 2](https://huggingface.co/Cactus-Compute/needle2) (45M 参数 LLM) 的 Chrome 浏览器扩展，模型完全在本地 WASM 中运行。

## 功能

- **18 个内置浏览器工具** — 页面读取、点击、填表、标签管理、书签、截图、通知、剪切板、HTTP 请求、自定义脚本等（其中 5 个暴露给模型作为 Schema）
- **中文输入支持** — iciba 翻译 API 自动中→英翻译
- **自定义脚本工具** — 可视化编辑器，编写自己的 JS 工具函数
- **完全离线** — 模型引擎 + 权重本地打包，首次加载后无需网络
- **置信度评分** — 每次工具调用附带 confidence 分数

## 安装

1. 打开 Chrome → `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录文件夹

## 对话示例

**基础导航**
```
你: Go to google.com and search for AI news
AI: [tab.goto] ✓ → [tab.fill] ✓ → [tab.submit] ✓ (confidence: 0.91)
```

**页面理解**
```
你: Summarize this page
AI: [tab.read] ✓ → This page is about... (confidence: 0.85)
```

**多标签操作**
```
你: Open youtube.com in a new tab
AI: [tab.new] ✓ Tab #4 created and navigated to youtube.com (confidence: 0.94)
```

**表单填写**
```
你: Fill this form with random test data and submit
AI: [tab.read] ✓ Found 5 fields → [tab.fill] ✓ → Ask: Confirm submit? y/n
```

**数据提取**
```
你: Extract all product names and prices from this page as a table
AI: [tab.eval] ✓ Found 12 products → [table output] (confidence: 0.78)
```

## 项目结构

```
├── lib/                        # 模型文件 (needle.js + needle.wasm + needle2.cact)
├── js/                         # 前端逻辑
│   ├── sidepanel.js            # 主界面 + Agent 循环
│   ├── needle-agent.js         # WASM 模型加载与推理
│   ├── tools-builtin.js        # 内置浏览器工具（schema + 执行）
│   ├── tools-editor.js         # 自定义脚本编辑器
│   ├── translator.js           # 中→英翻译 (iciba API)
│   ├── store.js                # chrome.storage 持久化
│   └── utils.js                # 共享工具函数
├── css/style.css               # UI 样式
├── icons/                      # 扩展图标
├── manifest.json               # Chrome 扩展配置
├── background.js               # Service Worker（工具后端）
├── content.js                  # Content Script
├── popup.html                  # 弹窗页面
├── popup.js                    # 弹窗逻辑
└── sidepanel.html              # 侧边栏界面（主入口）
```

## 技术栈

- **推理引擎**: Cactus Compute Needle 2 (C++ → WebAssembly)
- **模型大小**: 13MB `.cact` + 307KB WASM 引擎
- **内存占用**: ~28MB 运行时
- **UI**: Vanilla JS + CSS Custom Properties (浅色主题)
