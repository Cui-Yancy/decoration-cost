# 装修支出管家

装修支出管理工具，支持采购记录、状态跟进、分类统计、图片凭证和数据导入导出。

## 项目结构

```
├── index.html              # 首页
├── cost.html               # 支出管理
├── app.py                  # Flask 后端（服务器模式）
├── manifest.json           # PWA 应用清单
├── service-worker.js       # 离线缓存与页面回退
├── requirements.txt        # Python 依赖
├── icons/                  # PWA 与 iOS 应用图标
├── css/
│   └── shared.css          # 共享样式
└── js/
    ├── shared-config.js    # Tailwind 配置
    ├── indexeddb-manager.js # IndexedDB 管理（本地模式）
    ├── api-client.js       # HTTP API 客户端（服务器模式）
    ├── modal-utils.js      # 模态框工具
    ├── image-upload.js     # 图片上传
    ├── notification.js     # 通知系统
    ├── import-export.js    # 数据导入导出 + 迁移适配器
    ├── pwa-register.js     # Service Worker 注册
    └── app-cost.js         # 支出管理页面逻辑
```

## PWA 安装与离线使用

- **Android Chrome**：打开网站后，通过浏览器菜单选择「安装应用」或「添加到主屏幕」。
- **iOS Safari**：点击分享按钮，选择「添加到主屏幕」。
- 安装后应用以独立窗口启动，页面与静态资源在首次访问后可离线打开。
- 服务器模式下，离线时页面仍可打开，但服务器 API 数据读写需要网络连接。

Service Worker 仅能在 HTTPS 或 `localhost` 安全上下文中运行。局域网通过
`http://<服务器IP>:5000` 访问时，应在 Flask 前配置 HTTPS 反向代理，才能启用
完整的安装与离线能力。

## 两种使用模式

### 本地模式（单机）

直接双击打开 `index.html`，数据存储在浏览器 IndexedDB 中。

- 支持导出 JSON 备份
- 支持从 JSON 导入恢复
- 不需要网络和服务器

### 服务器模式（局域网多设备）

```bash
pip install -r requirements.txt
./app.sh start
# → http://0.0.0.0:5000
```

局域网内手机、电脑访问 `http://<服务器IP>:5000`，多设备共享 SQLite 数据库。

启动时自动切换：Flask 向页面注入配置，前端检测到服务器模式后使用 HTTP API 替代 IndexedDB。

常用管理命令：

```bash
./app.sh start    # 后台启动
./app.sh stop     # 停止服务
./app.sh restart  # 重启服务
./app.sh status   # 查看状态
./app.sh logs     # 实时查看日志
```

默认监听 `0.0.0.0:5000`，可通过环境变量调整：

```bash
APP_HOST=0.0.0.0 APP_PORT=8080 ./app.sh start
```

## 旧数据迁移

如果之前用过旧版，可以将导出的 JSON 导入到共享数据库：

```bash
# 自动识别数据类型
python app.py --import 旧数据.json

# 或指定类型
python app.py --import 支出记录.json --type expenses
```

也支持服务器运行中通过网页「导入数据」按钮导入。

## 命令行选项

| 参数 | 说明 |
|------|------|
| `--import FILE.json` | 导入 JSON 数据到数据库 |
| `--type expenses` | 指定数据类型（默认自动检测） |
| `--host 0.0.0.0` | 服务监听地址（默认 0.0.0.0） |
| `--port 5000` | 服务端口（默认 5000） |
| `--debug` | 开启 Flask 调试模式 |

## 数据备份

- **服务器模式**：复制 `decoration.db` 文件即可
- **本地模式**：点击页面「导出数据」按钮下载 JSON
