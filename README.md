<p align="center">
  <img src="icons/icon-192.png" alt="NahfiMap" width="96" height="96">
</p>

<h1 align="center">NahfiMap · 户外足迹</h1>

<p align="center">
  <strong>记录你的每一步山水 — 露营 · 徒步 · 观星 · 美食</strong>
</p>

<p align="center">
  <a href="https://nahfimap.pages.dev" target="_blank">
    <img src="https://img.shields.io/badge/Live-Demo-2DB96A?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Live Demo">
  </a>
  <img src="https://img.shields.io/badge/License-MIT-1B4332?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/PWA-Ready-DDA15E?style=for-the-badge" alt="PWA">
</p>

---

## ✨ 功能概览

| 功能 | 说明 |
|------|------|
| 🗺️ **多底图切换** | 户外 Voyager / 卫星 ESRI / 地形 OpenTopo，带丝滑渐变过渡 |
| 📍 **6 种分类标记** | 露营 · 徒步 · 公园景点 · 观星摄影 · 美食 · 自定义 |
| 📷 **图片 EXIF 定位** | 上传照片自动读取 GPS 坐标，无需手动填坐标 |
| 🖱️ **右键添加地点** | 地图任意位置右键即可新增足迹，坐标自动填入 |
| 🔍 **双击聚焦** | 双击标记点自动 flyTo 放大 + 打开详情 |
| 📏 **难度 & 评分** | 轻松/中等/困难三级标注 + 五星评分 |
| 🛤️ **KML/GPX 路线** | 导入 GPS 路线文件叠加显示 |
| 🖼️ **全屏图片查看** | 多图滑动浏览，沉浸式查看 |
| 💾 **JSON 备份** | 一键导出/导入所有数据，换设备无忧 |
| 📱 **PWA 离线可用** | Service Worker 缓存，离线也能查看已加载内容 |

## 🛠️ 技术栈

- **Vue 3** (CDN) — 响应式 UI
- **Leaflet.js 1.9.4** — 地图渲染
- **Dexie 3** (IndexedDB) — 本地数据持久化
- **exifr** — EXIF/GPS 元数据解析
- **toGeoJSON** — KML/GPX 转换
- **Service Worker** — 离线缓存 & PWA

> 单文件架构 (`index.html`)，无需构建工具，无需服务器，浏览器直接打开即用。

## 🚀 快速开始

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/ZhangWeiGuang/NahfiMap.git
cd NahfiMap

# 直接用浏览器打开
open index.html

# 或使用本地服务器（推荐，避免 CORS 限制）
npx serve .
```

### 部署到 Cloudflare Pages

```bash
# 安装 wrangler
npm install

# 部署
npm run deploy
```

或直接在 Cloudflare Pages 控制台连接 GitHub 仓库，自动部署。

## 🎨 配色体系

NahfiMap 采用户外自然色调设计：

| 角色 | 色值 | 用途 |
|------|------|------|
| 森林绿 | `#1B4332` | 品牌主色、导航栏 |
| 翠绿 | `#2DB96A` | 主按钮、强调色 |
| 苔藓 | `#52796F` | 辅助色 |
| 沙金 | `#DDA15E` | 美食分类、暖色点缀 |
| 大地棕 | `#BC6C25` | 次要强调 |
| 米白底 | `#F5F5F0` | 页面背景 |

## 📂 项目结构

```
NahfiMap/
├── index.html       # 主应用（Vue 3 + Leaflet 单文件）
├── sw.js            # Service Worker 离线缓存
├── manifest.json    # PWA 清单
├── package.json     # 项目配置 & 部署脚本
├── .gitignore
└── icons/
    ├── icon.svg     # 矢量源图
    └── icon-*.png   # 各尺寸 PWA 图标
```

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交改动 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

<p align="center">
  Made with 🌿 by <a href="https://github.com/ZhangWeiGuang">ZhangWeiGuang</a>
</p>
