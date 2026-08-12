# Needle 2 - Chrome AI Browser Agent

基于 [Needle 2](https://huggingface.co/Cactus-Compute/needle2) (45M 参数 LLM) 的 Chrome 浏览器扩展，模型完全在本地 WASM 中运行。

## 功能

- **16 个内置浏览器工具** — 页面读取、点击、填表、标签管理、书签、截图、通知、剪切板、HTTP 请求、自定义脚本
- **中文输入支持** — iciba 翻译 API 自动中→英翻译
- **自定义脚本工具** — 可视化编辑器，编写自己的 JS 工具函数
- **完全离线** — 模型引擎 + 权重本地打包，首次加载后无需网络
- **置信度评分** — 每次工具调用附带 confidence 分数

## 安装

1. 打开 Chrome → `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `chrome-extension/` 文件夹

## 项目结构

```
├── chrome-extension/          # Chrome 扩展
│   ├── lib/                   # 模型文件 (needle.js + needle.wasm + needle2.cact)
│   ├── js/                    # 前端逻辑
│   │   ├── sidepanel.js       # 主界面 + Agent 循环
│   │   ├── needle-agent.js    # WASM 模型加载与推理
│   │   ├── tools-builtin.js   # 16 个内置浏览器工具
│   │   ├── tools-editor.js    # 自定义脚本编辑器
│   │   ├── translator.js      # 中→英翻译 (iciba API)
│   │   └── store.js           # chrome.storage 持久化
│   └── css/style.css          # 暗色主题 UI
└── python/                    # Python SDK 版本 (参考)
```

## 技术栈

- **推理引擎**: Cactus Compute Needle 2 (C++ → WebAssembly)
- **模型大小**: 13MB `.cact` + 307KB WASM 引擎
- **内存占用**: ~28MB 运行时
- **UI**: Vanilla JS + CSS Custom Properties (暗色主题)
