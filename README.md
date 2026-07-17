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

开发模式会同时启动后端服务 `http://127.0.0.1:4173`、Vite 前端 `http://127.0.0.1:5173` 和 Electron 窗口。Electron 和浏览器打开 `http://127.0.0.1:5173` 时都会访问同一个开发后端，因此备份导入等 `/api` 请求不需要手动改端口。

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

如果当前机器是 Intel Mac，请改用 `x64`：

```bash
npm run desktop:build:x64
```

如果要额外生成通用包：

```bash
npm run desktop:build:universal
```

这个命令会先构建：

- 前端静态资源 `dist/`
- 桌面版内置服务端 JS 产物 `build/server/`
- 在独立临时目录中安装依赖并为 Electron 编译原生模块，成品输出到 `release/`

桌面构建不会修改项目本地的 `node_modules`。因此，无论构建成功、失败或中途取消，`npm run dev` 都始终使用本地 Node 版本对应的 `better-sqlite3`，不会再被桌面打包覆盖。

仅输出目录结构，便于检查打包内容：

```bash
npm run desktop:build:dir
```

Intel Mac 对应的目录输出命令：

```bash
npm run desktop:build:dir:x64
```

### 桌面打包与 better-sqlite3 ABI

`better-sqlite3` 是原生模块，桌面包最容易出问题的地方就是它的 ABI 和 Electron 运行时不匹配。

桌面版和网页开发使用不同的 Node 运行时 ABI。构建脚本会自动将它们隔离，以下规则仍需遵守：

- 打包 Electron 桌面版时，必须使用仓库要求的 Node 版本，当前以 `.nvmrc` 为准。
- Intel Mac 不要使用默认的 `arm64` 打包命令，否则安装包内的原生模块架构会不对。
- 不要直接在项目根目录运行 `electron-builder` 或 `electron-rebuild`；请使用 `npm run desktop:build*` 命令，以保持开发依赖不受影响。
- 不能只检查 `app.asar.unpacked/node_modules/better-sqlite3/...`，还要确认 `app.asar` 内没有残留旧版本的 `better_sqlite3.node`。如果 `app.asar` 里还带着旧 ABI 的二进制，Electron 仍然可能把它解压到临时目录后加载，表现为：

```text
The module '/var/folders/.../.org.chromium.Chromium.*'
was compiled against a different Node.js version using NODE_MODULE_VERSION ...
```

推荐的本机打包流程：

```bash
. "$HOME/.nvm/nvm.sh"
nvm use
npm run desktop:build:x64     # Intel Mac
# 或
npm run desktop:build         # Apple Silicon
```

如果桌面版安装后出现 `better-sqlite3` 的 `ERR_DLOPEN_FAILED`：

1. 先确认 Electron 运行时 ABI：

```bash
ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron -p "process.versions.modules + ' ' + process.version"
```

2. 再确认本地 Node ABI：

```bash
node -p "process.versions.modules + ' ' + process.version"
```

3. 如果桌面应用已经安装到 `/Applications/基点.app`，检查它实际加载的是否还是旧 ABI：

```bash
ELECTRON_RUN_AS_NODE=1 /Applications/基点.app/Contents/MacOS/基点 \
  -e "const Database=require('/Applications/基点.app/Contents/Resources/app.asar/node_modules/better-sqlite3'); const db=new Database(':memory:'); db.close(); console.log('OK')"
```

4. 如果这里仍然失败，不要只重编译 `app.asar.unpacked` 里的文件，还要确认 `app.asar` 内的 `node_modules/better-sqlite3/build/Release/better_sqlite3.node` 也已经被替换。

这次我们实际踩到的坑就是：

- `app.asar.unpacked` 里的 `better-sqlite3` 已经修好
- 但 `app.asar` 里面还残留旧 ABI 的 `better_sqlite3.node`
- Electron 最终从 `app.asar` 解压旧文件到 `/var/folders/.../.org.chromium.Chromium.*` 后加载，导致桌面版继续报错

因此，桌面包验收时至少要做一次 Electron 运行时自检，而不是只看文件时间戳：

```bash
ELECTRON_RUN_AS_NODE=1 /Applications/基点.app/Contents/MacOS/基点 \
  -e "const Database=require('/Applications/基点.app/Contents/Resources/app.asar/node_modules/better-sqlite3'); const db=new Database(':memory:'); db.prepare('select 1').get(); db.close(); console.log('OK')"
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
