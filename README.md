# 基点

基点是一个本地运行的基金定投管理工具，用来记录基金、历史净值和买入/卖出交易，并根据 4% 定投法计算下一次买入触发条件。

项目是一个单体应用：前端使用 React + TypeScript，后端使用 Express + TypeScript，数据保存在本地 SQLite 文件中。

桌面版基于 Electron，采用“Electron 窗口 + 本地 Express 服务 + SQLite”结构。

## 应用截图

![基点应用截图](doc/001.png)

## 功能

- 按基金代码添加基金，并自动同步历史净值。
- 保存买入和卖出交易记录。
- 当交易日期的净值尚未公布时，交易会先进入“待确认”，后续同步到净值后自动确认。
- 计算当前持仓、成本价、触发买入净值和还需要下跌的比例。
- 在净值走势图中展示买入点、卖出点和成本价参考线。
- 支持隐藏已清仓或暂时不关注的基金，交易和净值数据不会被删除。
- 数据默认自动保存在本地 SQLite 数据库。
- 支持一键导出 / 导入整库备份，包含账户、持有资产（含隐藏资产）、交易历史和价格历史。

## 本地运行

安装依赖：

```bash
npm install
```

建议 Node 版本：

```bash
node >= 24
```

启动应用：

```bash
npm run dev
```

启动后打开：

```text
http://127.0.0.1:4173/
```

## 常用命令

```bash
npm run dev
npm run desktop:dev
npm run typecheck
npm run build
npm run start
npm run desktop:build
```

## 桌面版

桌面开发模式：

```bash
npm run desktop:dev
```

这个命令会启动：

- Vite 前端开发服务器
- Electron 桌面窗口
- Electron 内部拉起的本地 Express 服务

桌面版内置服务不会固定占用 `4173`，而是每次启动时自动选择一个本机空闲端口，避免和 `npm run dev` 冲突。

macOS 打包：

```bash
npm run desktop:build
```

这个命令默认生成 Apple Silicon `arm64` 安装包。

如果要额外生成通用包：

```bash
npm run desktop:build:universal
```

这个命令会先构建：

- 前端静态资源 `dist/`
- 桌面版内置服务端 JS 产物 `build/server/`
- 打包结束后自动恢复当前开发环境使用的 `better-sqlite3` 原生模块，避免影响后续 `npm run dev`

仅输出目录结构，便于检查打包内容：

```bash
npm run desktop:build:dir
```

### macOS 签名与公证

如果要生成正式签名并提交公证，需要提供这些环境变量：

```bash
APPLE_ID
APPLE_APP_SPECIFIC_PASSWORD
APPLE_TEAM_ID
```

未提供时，仍可先构建未公证的本地安装包用于开发验证。

## 数据说明

服务端模式下，本地数据文件默认保存在：

```text
data/fund-dca.sqlite
```

桌面模式下：

- 开发态 `npm run desktop:dev` 会继续复用仓库下的 `data/fund-dca.sqlite`
- 打包后的生产态才会切换到 Electron 的用户数据目录

桌面版日志默认保存在：

```text
~/Library/Application Support/jidian/logs
```

其中：

- `main.log`：Electron 主进程和桌面启动编排日志
- `server.log`：内置 Express 服务业务日志
- `errors.log`：未捕获异常和未处理 Promise 拒绝

这个文件包含个人基金、交易记录、历史净值等数据，不应该提交到 Git，也不应该分享给别人。

项目已经在 `.gitignore` 中忽略 SQLite 数据文件。仓库里只保留 `data/.gitkeep`，用于保留空目录。

别人拿到项目代码后，第一次启动应用时会根据下面的初始化脚本自动创建自己的本地数据库：

```text
database/schema.sql
```

## 项目结构

```text
database/        SQLite 表结构和数据库说明
server/          Express 后端、接口、数据库迁移和净值同步逻辑
src/             React 前端代码
electron/        Electron 主进程、preload 和桌面打包辅助逻辑
build/           桌面图标和安装包资源目录
data/            本地 SQLite 数据目录，真实数据不会进入 Git
```

## 注意

基点只做个人记录、计算和辅助参考，不构成投资建议。基金净值来自公开数据源，实际交易确认金额和份额请以基金平台或销售机构为准。
