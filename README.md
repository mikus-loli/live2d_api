# Live2D API

Live2D 看板娘插件后端 API，支持 Cubism 2.x 和 Cubism 4.x 模型，提供完整的 Web 管理后台和 Docker 部署方案。

## 特性

- **双版本支持**：兼容 Cubism 2.x（`.moc`）和 Cubism 4.x（`.moc3`/`.model3.json`）模型
- **原生 PHP API**：无需伪静态，开箱即用
- **模型切换**：支持顺序切换和随机切换
- **皮肤系统**：支持单皮肤、多皮肤切换，多组皮肤递归穷举
- **分组管理**：支持同分组多个模型或多路径加载切换
- **Web 管理后台**：现代化管理界面，支持模型上传、预览、编辑
- **Docker 部署**：一键容器化部署，支持 GitHub Actions 自动构建

## 环境要求

### 传统 PHP 部署
- PHP >= 5.2
- PHP 扩展：json

### Docker 部署
- Docker >= 20.10
- Docker Compose >= 2.0（可选）

### 开发环境
- Node.js >= 22（用于管理后台开发服务器）

## 目录结构

```
│  model_list.json              // 模型列表配置
│  Dockerfile                   // Docker 构建文件
│  docker-compose.yml           // Docker Compose 配置
│  docker-entrypoint.sh         // Docker 入口脚本
│  package.json                 // Node.js 依赖配置
│
├─add/                          // 更新皮肤缓存 API
│      index.php
│
├─get/                          // 获取模型配置 API
│      index.php
│
├─rand/                         // 随机切换模型 API
│      index.php
│
├─rand_textures/                // 随机切换皮肤 API
│      index.php
│
├─switch/                       // 顺序切换模型 API
│      index.php
│
├─switch_textures/              // 顺序切换皮肤 API
│      index.php
│
├─tools/                        // 工具类
│      modelList.php            // 模型列表处理
│      modelTextures.php        // 皮肤列表处理
│      jsonCompatible.php       // JSON 兼容处理
│      name-to-lower.php        // 文件名格式化
│
├─admin/                        // 管理后台
│  │  index.html                // 管理面板主页
│  │  login.html                // 登录页面
│  │  dev-server.js             // Node.js 开发服务器
│  │
│  ├─api/                       // 后台 API
│  │      config.php            // 配置常量
│  │      login.php             // 登录接口
│  │      logout.php            // 登出接口
│  │      status.php            // 会话状态
│  │      change_password.php   // 修改密码
│  │      list.php              // 模型列表
│  │      detail.php            // 模型详情
│  │      groups.php            // 分组列表
│  │      create.php            // 创建模型记录
│  │      update.php            // 更新模型
│  │      delete.php            // 删除模型
│  │      upload.php            // 上传文件
│  │      scan-dirs.php         // 扫描未注册目录
│  │      users.json            // 用户数据
│  │
│  ├─assets/                    // 前端资源
│  │  ├─css/
│  │  │      admin.css          // 管理面板样式
│  │  │      login.css          // 登录页样式
│  │  │
│  │  └─js/
│  │      api.js                // API 请求封装
│  │      app.js                // 主应用逻辑
│  │      components.js         // UI 组件
│  │      live2d.js             // Live2D 预览
│  │      login.js              // 登录逻辑
│  │      live2d.min.js         // Live2D SDK
│  │      live2dcubismcore.min.js
│  │      cubism4.min.js        // Cubism 4 支持
│  │      pixi.min.js           // PIXI.js
│  │
├─model/                        // 模型目录
│  └─GroupName/                 // 模型分组
│      └─ModelName/             // 具体模型
│
└─.github/                      // GitHub 配置
    └─workflows/
        docker-build.yml        // Docker 自动构建
```

## 快速开始

### Docker 部署（推荐）

```bash
# 使用 Docker Compose
docker-compose up -d

# 或直接运行
docker build -t live2d-api .
docker run -d -p 8080:8080 \
  -v api_data:/app/admin/api \
  -v model_data:/app/model \
  live2d-api
```

访问 `http://localhost:8080/admin/` 进入管理后台。

**默认账号**：
- 用户名：`admin`
- 密码：`admin123`

### 传统 PHP 部署

1. 将项目放置到 Web 服务器目录
2. 确保 `model` 目录可写
3. 配置 `model_list.json`
4. 访问对应路径使用 API

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
node admin/dev-server.js
```

访问 `http://localhost:8080/admin/`

## 添加模型

### 方式一：通过管理后台上传

1. 登录管理后台
2. 点击「上传模型」按钮
3. 输入目标模型名称（格式：`分组/模型名`）
4. 选择 ZIP 文件或单个模型文件
5. 系统自动解压并生成配置

支持的文件类型：`.zip`, `.moc`, `.moc3`, `.json`, `.mtn`, `.png`, `.jpg`, `.avif`

### 方式二：手动添加模型文件

#### Cubism 2.x 单皮肤模型

皮肤放在 `textures` 文件夹，自动识别：

```
ModelName/
│  index.json
│  model.moc
│  textures.cache       // 自动生成
│
├─motions/
│      idle_01.mtn
│      idle_02.mtn
│
└─textures/
      default-costume.png
      school-costume.png
```

#### Cubism 4.x 模型

使用 `.model3.json` 配置文件：

```
ModelName/
│  modelName.model3.json    // 主配置文件
│  modelName.moc3           // 模型数据
│  modelName.physics3.json  // 物理设置
│
├─textures/
      texture_00.png
      texture_01.png
```

#### 多组皮肤递归穷举

皮肤文件夹按 `texture_XX` 命名，添加 `textures_order.json`：

```
ModelName/
│  index.json
│  model.moc
│  textures.cache
│  textures_order.json
│
├─texture_00/
│      00.png
│
├─texture_01/
│      00.png
│      01.png
│      02.png
│
└─texture_02/
      00.png
      01.png
```

`textures_order.json` 示例：

```json
[
    ["texture_00"],
    ["texture_01", "texture_02"]
]
```

### 方式三：同分组多模型切换

修改 `model_list.json`：

```json
{
    "models": [
        "GroupName/ModelName",
        [
            "Group1/Model1",
            "Group1/Model2",
            "Group2/Model1"
        ]
    ],
    "messages": [
        "Example 1",
        "Example 2"
    ]
}
```

## API 接口

### 模型 API

| 接口 | 说明 | 参数 |
|------|------|------|
| `/add/` | 检测新增皮肤并更新缓存 | 无 |
| `/get/?id=1-23` | 获取模型配置 | `id`: 分组号-皮肤号 |
| `/get/?name=Group/Model&textures_id=1` | 按名称获取配置 | `name`, `textures_id` |
| `/rand/?id=1` | 随机切换模型 | `id`: 当前分组号 |
| `/switch/?id=1` | 顺序切换模型 | `id`: 当前分组号 |
| `/rand_textures/?id=1-23` | 随机切换皮肤 | `id`: 分组号-皮肤号 |
| `/switch_textures/?id=1-23` | 顺序切换皮肤 | `id`: 分组号-皮肤号 |

### 管理后台 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/admin/api/login` | POST | 用户登录 |
| `/admin/api/logout` | POST | 用户登出 |
| `/admin/api/status` | GET | 检查登录状态 |
| `/admin/api/change_password` | POST | 修改密码 |
| `/admin/api/list` | GET | 获取模型列表 |
| `/admin/api/detail?model_name=xxx` | GET | 获取模型详情 |
| `/admin/api/groups` | GET | 获取分组列表 |
| `/admin/api/create` | POST | 创建模型记录 |
| `/admin/api/update` | POST | 更新模型信息 |
| `/admin/api/delete` | POST | 删除模型 |
| `/admin/api/upload` | POST | 上传模型文件 |
| `/admin/api/scan-dirs` | GET | 扫描未注册目录 |

## 管理后台功能

### 模型管理
- 模型列表展示（卡片式布局）
- 模型实时预览（支持皮肤切换）
- 模型上传（ZIP 包自动解压）
- 模型编辑和删除
- 未注册目录扫描
- **移动端适配**：手机端自动隐藏 Live2D 预览（屏幕宽度 ≤ 768px）

### 用户管理
- 用户登录/登出
- 密码修改
- 用户名修改
- 登录失败锁定（5 次失败后锁定 15 分钟）

### 代码生成
- 自动生成前端调用代码
- 可配置位置、尺寸、缩放
- 支持自定义提示消息

### 其他特性
- 深色/浅色主题切换
- 响应式设计（移动端优化）
- WebSocket 实时更新（自动降级为轮询）

## 安全特性

- **密码加密**：使用 bcrypt 加密存储
- **密码强度**：要求至少 8 位，包含字母和数字
- **登录限制**：5 次失败后锁定账户 15 分钟
- **会话管理**：24 小时会话有效期
- **速率限制**：防止暴力破解

## Docker 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `TZ` | 时区设置 | `Asia/Shanghai` |

### 数据卷

| 卷 | 说明 |
|------|------|
| `api_data` | 用户数据和配置 |
| `model_data` | 模型文件存储 |

### 健康检查

容器每 30 秒检查管理后台是否可访问。

## 前端调用示例

```html
<!-- 引入 Live2D SDK -->
<script src="/live2d.min.js"></script>
<script src="/live2dcubismcore.min.js"></script>
<script src="/cubism4.min.js"></script>
<script src="/pixi.min.js"></script>

<!-- 加载模型 -->
<script>
const apiBase = 'http://your-api-server';
let modelId = 1;

function loadModel(id, texturesId) {
    fetch(`${apiBase}/get/?id=${id}-${texturesId}`)
        .then(r => r.json())
        .then(config => {
            // 使用 PIXI.Live2D 加载配置
            // ...
        });
}

// 随机切换模型
function randModel() {
    fetch(`${apiBase}/rand/?id=${modelId}`)
        .then(r => r.json())
        .then(data => {
            modelId = data.model.id;
            loadModel(modelId, 0);
        });
}
</script>
```

## 常见问题

### Q: 如何修改默认管理员密码？
A: 登录后点击侧边栏底部的设置按钮，进入账号设置修改密码。

### Q: 上传 ZIP 文件后模型无法显示？
A: 确保 ZIP 包内包含必要的模型文件（`.moc`/`.moc3` 和配置文件）。如果使用 Cubism 4.x 模型，需要包含 `.model3.json` 文件。

### Q: 如何添加新的模型分组？
A: 在 `model` 目录下创建新文件夹，然后通过管理后台「添加模型」功能注册，或手动编辑 `model_list.json`。

### Q: Docker 容器内如何持久化数据？
A: 使用 Docker 卷 `api_data` 和 `model_data`，数据会自动持久化。

### Q: 如何在已有 PHP 环境中使用？
A: 直接将项目放到 Web 目录即可，管理后台需要 Node.js 环境或使用 Docker。

## 版权声明

**API 内所有模型版权均属于原作者，仅供研究学习，不得用于商业用途**

MIT License © FGHRSH