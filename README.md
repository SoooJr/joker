# Joker

个人博客，基于 [Hexo](https://hexo.io/) + Mic_Theme，部署在 GitHub Pages。

- 线上地址：https://sooojr.github.io/joker/
- 默认分支 `master` 存放**构建产物**（直接对外提供页面）
- 源码建议放在 `source` 分支，由 GitHub Actions 自动构建并推回 `master`

## 目录说明

```
├── _config.yml          Hexo 主配置（url / root 决定资源路径，注意别改错）
├── package.json         依赖与脚本
├── source/
│   ├── _posts/          文章（Markdown 源文件）
│   ├── about/           关于页
│   ├── group/           团队页
│   ├── gallery/         图库页
│   └── tags/            标签页
├── .github/workflows/   自动构建部署
│
├── index.html           ↓ 以下均为 Hexo 生成的产物，不要手改
├── css/  js/  img/  fonts/  images/
├── 2021/  archives/  about/  group/  gallery/  tag/
```

## 本地开发

```bash
npm install
npm run server      # http://localhost:4000/joker/
npm run build       # 生成到 public/
```

## 部署

推送到 `source` 分支后，GitHub Actions 会自动构建并推 `public/` 到 `master`。
也可以本地手动：

```bash
npm run clean && npm run build
# 然后把 public/ 内容推到 master
```

## 注意事项

1. **绝对不要手改 `index.html`、`css/`、`js/` 等产物文件**——下次 `hexo generate` 会全部覆盖。
   要改样式改主题模板，要改内容改 `source/` 下的 Markdown。
2. `_config.yml` 里的 `url` 和 `root` 必须一起正确：
   ```yaml
   url: https://sooojr.github.io/joker
   root: /joker/
   ```
   只改其中一个会导致全站 CSS/JS 404。
3. 图片统一放 `img/`（站点装饰）或 `source/images/`（文章配图），不要两边混用。
