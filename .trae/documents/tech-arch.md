## 1. 架构设计

```mermaid
flowchart TB
    "前端管理面板<br/>HTML/CSS/JS" --> "PHP API 层<br/>admin/api/"
    "PHP API 层" --> "数据层<br/>model_list.json"
    "PHP API 层 --> "文件系统<br/>model/"
    "前端管理面板" --> "Live2D 渲染<br/>live2d.js"
```

## 2. 技术说明

* 前端：原生 HTML5 + CSS3 + ES6+ JavaScript（无框架依赖，与现有 PHP 项目无缝集成）

* 样式：CSS Custom Properties + CSS Grid/Flexbox 响应式布局

* 后端：PHP 5.4+（复用现有 API 架构）

* Live2D 渲染：live2d.js（从 live2d\_demo 项目引入）

* 无需构建工具，直接部署到 PHP 服务器

### 技术选型理由

由于现有项目为纯 PHP 项目，无 Node.js 构建流程，前端管理面板采用原生 HTML/CSS/JS 实现，避免引入额外的构建依赖。所有前端资源作为静态文件直接由 PHP 服务器提供。

## 3. 路由定义

| 路由                                     | 用途           |
| -------------------------------------- | ------------ |
| /admin/                                | 管理面板主页（模型列表） |
| /admin/?view=detail\&model=Group/Model | 模型详情视图       |
| /admin/?view=upload                    | 模型上传视图       |

采用单页应用（SPA）模式，通过 URL 参数和 JavaScript 路由管理视图切换。

## 4. API 定义

### 4.1 模型列表 API

```
GET /admin/api/list.php
Response: { success: boolean, data: [{ id, name, message, group, is_multi, textures_count, has_moc, has_physics, has_pose, file_count, sub_models? }] }
```

### 4.2 模型详情 API

```
GET /admin/api/detail.php?model_name=Group/Model
Response: { success: boolean, data: { name, config, files, textures, motions } }
```

### 4.3 新增模型 API

```
POST /admin/api/create.php
Body: { name: "Group/Model", message: "描述" }
Response: { success: boolean, data: { name, message }, message: string }
```

### 4.4 更新模型 API

```
POST /admin/api/update.php
Body: { old_name: "Group/OldModel", new_name: "Group/NewModel", message: "新描述" }
Response: { success: boolean, data: { name }, message: string }
```

### 4.5 删除模型 API

```
POST /admin/api/delete.php
Body: { name: "Group/Model", confirm: boolean }
Response: { success: boolean, data: { name, files_deleted: boolean }, message: string }
```

### 4.6 上传模型 API

```
POST /admin/api/upload.php
Body: multipart/form-data { file, model_name }
Response: { success: boolean, data: { model_name, uploaded_files, all_files, index_generated }, message: string }
```

### 4.7 分组列表 API

```
GET /admin/api/groups.php
Response: { success: boolean, data: [{ name, model_count }] }
```

## 5. 文件结构

```
admin/
├── index.html              # 管理面板主页面
├── assets/
│   ├── css/
│   │   └── admin.css       # 管理面板样式
│   └── js/
│       ├── app.js          # 主应用逻辑、路由、状态管理
│       ├── api.js          # API 请求封装
│       ├── components.js   # UI 组件（卡片、对话框、通知等）
│       └── live2d.js       # Live2D 预览渲染模块
└── api/
    ├── config.php          # API 配置
    ├── list.php            # 模型列表
    ├── detail.php          # 模型详情
    ├── create.php          # 新增模型
    ├── update.php          # 更新模型
    ├── delete.php          # 删除模型
    ├── upload.php          # 上传模型
    └── groups.php          # 分组列表
```

