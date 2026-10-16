# 贡献指南

欢迎通过 Issue 反馈问题，或通过 Pull Request 提交改进。较大的行为或数据结构调整，请先描述场景与预期结果。

使用 `.nvmrc` 中的 Node.js 版本，执行 `npm ci` 与 `npm run dev`。构建与原生模块排错见 [开发说明](docs/DEVELOPMENT.md)。

提交前运行：

```bash
npm run check:public
npm run typecheck
npm test
npm run build
npm run build:server
```

测试自动使用临时数据库。涉及持仓、费用、分红或备份兼容性时，请补充行为回归测试。

## 隐私

- 只提交代码、文档和虚构样例，不提交数据库、整库 JSON、成交导出、密钥、环境文件或证书。
- 截图与日志先人工核查，使用独立的演示账户及虚构数据复现问题。
- 提交前可执行 `gitleaks git --log-opts="--all" --redact`。
- 安全问题按 [安全政策](SECURITY.md) 私下报告，不要在公开 Issue 中粘贴凭据或真实投资记录。

## Pull Request

说明具体问题、修改后的行为及验证方法。数据库迁移需要考虑已有数据、旧版备份与失败恢复。避免提交无关格式调整和构建产物。
