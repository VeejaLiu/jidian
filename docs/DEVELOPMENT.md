# 开发与打包

## 环境与检查

使用 `.nvmrc` 中的 Node.js 24 版本。首次安装执行 `npm ci`，开发执行 `npm run dev`，入口为 `http://127.0.0.1:4173/`。

```bash
npm run check:public
npm run typecheck
npm test
npm run build
npm run build:server
```

`npm test` 强制使用临时数据、数据库、备份和日志目录，退出时自动清理，不会打开个人数据库。

提交前使用 [Gitleaks](https://github.com/gitleaks/gitleaks) 扫描全部历史：

```bash
gitleaks git --log-opts="--all" --redact --no-banner .
```

公开文件检查不能代替人工核对截图、视频和样例。截图应使用独立、明确标注的虚构数据。

## 桌面开发

```bash
npm run desktop:dev
```

同时运行 Express（4173）、Vite（5173）和 Electron。浏览器与桌面窗口复用开发后端及数据库；打包后的桌面服务选择空闲端口，使用 Electron 用户数据目录。

## macOS 构建

```bash
npm run desktop:build             # Apple Silicon arm64
npm run desktop:build:x64         # Intel x64
npm run desktop:build:universal   # 两种架构通用包
npm run desktop:build:dir         # arm64 应用目录，不制作安装介质
npm run desktop:build:dir:x64     # x64 应用目录
```

脚本在系统临时目录中安装依赖、编译前后端并重建 Electron 原生模块。产物输出到 `release/`，成功或失败后清理临时目录。不要直接在项目根目录运行 `electron-builder` 或 `electron-rebuild`，以免覆盖网页开发使用的原生模块。

### 原生模块验收

Node.js 和 Electron 的原生模块 ABI 不同。必须用打包应用自己的运行时打开临时数据库。例如 Intel 目录包：

```bash
ELECTRON_RUN_AS_NODE=1 release/mac/基点.app/Contents/MacOS/基点 \
  -e "const D=require(process.argv[1]);const db=new D(':memory:');db.prepare('select 1').get();db.close();console.log('SQLite OK')" \
  "$PWD/release/mac/基点.app/Contents/Resources/app.asar/node_modules/better-sqlite3"
```

其他架构请替换路径。检查 `app.asar` 与 `app.asar.unpacked` 中是否留下旧的 `better_sqlite3.node`；仅修复 unpacked 目录仍可能出现 `ERR_DLOPEN_FAILED`。通用包还要检查可执行文件和 SQLite 原生模块的两种架构。

### 签名与公证

本地构建默认关闭自动发现签名身份。Developer ID 签名可通过私有构建环境中的 `CSC_LINK`、`CSC_KEY_PASSWORD` 配置；提交 Apple 公证还需要 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`。配置细节参见 [electron-builder](https://www.electron.build/code-signing-mac.html)。

这些仅为变量名。证书、口令和环境文件不得提交。缺少签名或公证条件时，Release 必须如实标明状态。

## 发布流程

1. 更新 `package.json`、锁文件与 `CHANGELOG.md`，确保版本一致。
2. 完成类型检查、测试、前后端构建、公开文件检查及完整历史密钥扫描。
3. 构建安装包，检查归档不含数据库、JSON 备份、环境文件、日志或个人截图。
4. 用打包运行时验证 SQLite、全新数据库初始化、本地 API 和前端页面。
5. 为 DMG 和 ZIP 生成 `SHA256SUMS.txt`。
6. 给通过检查的提交打 `vX.Y.Z` 标签，发布安装包、校验文件与发布说明。

各架构应在对应设备上运行验证；仅检查 Mach-O 架构不等于完成设备实测。

## 数据位置与环境变量

`APP_DATA_DIR`、`APP_DB_PATH` 调整数据与数据库位置；`APP_BACKUP_DIR`、`APP_LOG_DIR` 覆盖备份和日志目录；`PORT` 修改端口。

服务默认监听本机。容器可使用 `APP_HOST=0.0.0.0` 监听容器网络，再由宿主机限制发布地址。应用没有面向公网的身份认证。桌面内置服务固定使用回环地址。
