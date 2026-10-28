# Joker

个人站点，部署在 GitHub Pages：<https://sooojr.github.io/joker/>

- 默认分支 `master` 同时存放**页面产物**和**内容数据**
- 内容（文章 / 图库 / 简历）不再依赖 Hexo 重新生成，直接在网页上编辑即可

## 页面

| 路径 | 页面 | 说明 |
|---|---|---|
| `/joker/` | 主页 | 大标题、副标题、照片来自 `data/home.json`，站主可直接换照片 |
| `/joker/about/` | 简历 | 数据来自 `data/resume.json`，站主可在线编辑 |
| `/joker/articles/` | 文章 | 数据来自 `data/articles.json`，站主可在线发布 |
| `/joker/gallery/` | 图库 | 索引 `data/gallery.json`，图片在 `media/gallery/` |
| `/joker/group/` | — | 旧「团队」页，已跳转到文章 |
| `/joker/tag/`、`/joker/categories/` | — | 已取消，跳转到文章 |

## 内容怎么存

```
data/
├── home.json        主页：标题 / 副标题 / 照片路径
├── resume.json      简历数据
├── articles.json    文章列表（含正文）
└── gallery.json     图库索引
media/gallery/       图库图片文件（jpg）
media/home/          主页照片（jpg）
```

**读**：页面通过 `raw.githubusercontent.com` 拉取 JSON，所有访客都能看到。
**写**：页面调用 GitHub Contents API 直接把内容提交进仓库 —— 发布后约 1 分钟，
GitHub Pages 重新部署，内容对所有人可见。

## 站主怎么发布内容

第一次需要在页面上配一次令牌：

1. 打开 GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
2. Repository access 只选 `SoooJr/joker`
3. Permissions → Repository permissions → **Contents: Read and write**
4. 生成后复制 `github_pat_...`
5. 打开 <https://sooojr.github.io/joker/articles/>，点右上角「🔑 站主设置」，粘贴令牌，保存并验证

令牌只存在你自己浏览器的 localStorage，不会上传到任何地方。
访客打开页面看到的是只读模式，没有发布入口。

> 安全提示：令牌等同于该仓库的提交权限。建议只给这一个仓库、只给 Contents 权限，
> 泄漏了随时可以在 GitHub 里吊销。公用电脑用完请点「清除令牌」。

## 文章格式

正文支持简易 Markdown：

````markdown
# 一级标题
## 二级标题

**粗体**  *斜体*  `行内代码`

- 列表项
1. 有序列表

> 引用

[链接文字](https://example.com)

```代码块```
````

## 图库

在 `/joker/gallery/` 拖拽或点击上传，可多选。图片会在浏览器里自动压缩
（最长边 1600px、JPEG 0.85）再上传，避免仓库体积膨胀。
点击图片可放大，悬停右上角 `×` 删除。

## 本地预览

站点所有路径都带 `/joker/` 前缀，直接双击 HTML 打不开。在**上级目录**起一个服务器：

```bash
cd C:/Users/chanc/WorkBuddy/2026-10-27-22-29-42
python -m http.server 8701
# 打开 http://127.0.0.1:8701/joker/
```

## 目录说明

```
├── index.html               主页（Hexo 产物，勿手改）
├── about/ articles/ gallery/ 手写的功能页，可直接改
├── 2021/ archives/          Hexo 生成的文章与归档
├── css/
│   ├── mic_main.css         主题样式
│   └── site-extra.css       新增组件样式（简历/文章/图库）
├── js/
│   ├── site-store.js        存储层：读写仓库 JSON
│   ├── site-home.js         主页逻辑：更换照片
│   ├── site-articles.js     文章页逻辑
│   ├── site-gallery.js      图库页逻辑
│   └── site-resume.js       简历页逻辑
├── data/                    内容数据（网页上编辑的就是这里）
├── media/gallery/           上传的图库图片
├── media/home/              上传的主页照片
└── _config.yml, source/     Hexo 源码（备用，见下方警告）
```

## 警告

`index.html`、`2021/`、`archives/` 是 Hexo 生成的产物，**下次运行 `hexo generate` 会被覆盖**。
而 `about/`、`articles/`、`gallery/` 和 `data/` 是手写/数据目录，不受 Hexo 影响。

如果以后要重新用 Hexo 构建，请先把这几个手写目录备份出来，或在 Hexo 里改用对应插件实现，
否则会被清掉。
