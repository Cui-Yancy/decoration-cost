# 装修管家

装修过程管理工具，支持支出记录和注意事项追踪。

## 项目结构

```
├── index.html              # 首页
├── cost.html               # 支出记录
├── note.html               # 注意事项
├── app.py                  # Flask 后端（服务器模式）
├── requirements.txt        # Python 依赖
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
    ├── app-cost.js         # 支出记录页面逻辑
    └── app-note.js         # 注意事项页面逻辑
```

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
# 自动识别数据类型（支出记录 / 注意事项）
python app.py --import 旧数据.json

# 或指定类型
python app.py --import 支出记录.json --type expenses
python app.py --import 注意事项.json --type notes
```

也支持服务器运行中通过网页「导入数据」按钮导入。

## 命令行选项

| 参数 | 说明 |
|------|------|
| `--import FILE.json` | 导入 JSON 数据到数据库 |
| `--type expenses\|notes` | 指定数据类型（默认自动检测） |
| `--host 0.0.0.0` | 服务监听地址（默认 0.0.0.0） |
| `--port 5000` | 服务端口（默认 5000） |
| `--debug` | 开启 Flask 调试模式 |

## 数据备份

- **服务器模式**：复制 `decoration.db` 文件即可
- **本地模式**：点击页面「导出数据」按钮下载 JSON
