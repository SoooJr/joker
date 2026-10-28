/* ==========================================================================
   Joker · 文章模块
   数据源：仓库 data/articles.json（所有人可见）
   发布/编辑/删除：需要站主令牌（GitHub Contents 写入权限）
   ========================================================================== */
(function () {
	'use strict';

	var S = window.JokerStore;
	var root = document.getElementById('articles-app');
	if (!root || !S) return;

	/* ---------------- 内置旧文章 ---------------- */
	var BUILTIN = [{
		id: 'builtin-hello',
		title: 'Hello World',
		tags: ['hexo'],
		date: '2021-12-10',
		builtin: true,
		url: '/joker/2021/12/10/hello-world/',
		summary: '站点建起来之后的第一篇，Hexo 默认模板。'
	}];

	/* ---------------- 状态 ---------------- */
	var state = {
		view: 'list',
		items: [],
		current: null,
		editing: null,
		loading: true,
		busy: false
	};

	/* ---------------- 工具 ---------------- */
	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;')
			.replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function today() {
		var d = new Date();
		var p = function (n) { return n < 10 ? '0' + n : '' + n; };
		return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
	}

	function uid() {
		return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	}

	/* ---------------- 简易 Markdown ---------------- */
	function inlineMd(text) {
		var s = esc(text);
		s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
		s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
		s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
		s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
			var safe = /^(https?:|mailto:|\/|#)/i.test(u) ? u : '#';
			return '<a href="' + safe + '"' + (/^https?:/i.test(safe) ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>';
		});
		return s;
	}

	function renderMd(src) {
		var lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
		var out = [], para = [], i = 0;

		function flush() {
			if (para.length) { out.push('<p>' + para.map(inlineMd).join('<br>') + '</p>'); para = []; }
		}

		while (i < lines.length) {
			var line = lines[i];

			if (/^```/.test(line)) {
				flush();
				var buf = [];
				i++;
				while (i < lines.length && !/^```/.test(lines[i])) { buf.push(esc(lines[i])); i++; }
				i++;
				out.push('<pre><code>' + buf.join('\n') + '</code></pre>');
				continue;
			}

			var h = /^(#{1,4})\s+(.*)$/.exec(line);
			if (h) {
				flush();
				var lv = h[1].length;
				out.push('<h' + lv + '>' + inlineMd(h[2]) + '</h' + lv + '>');
				i++; continue;
			}

			if (/^>\s?/.test(line)) {
				flush();
				var q = [];
				while (i < lines.length && /^>\s?/.test(lines[i])) {
					q.push(inlineMd(lines[i].replace(/^>\s?/, ''))); i++;
				}
				out.push('<blockquote>' + q.join('<br>') + '</blockquote>');
				continue;
			}

			if (/^[-*+]\s+/.test(line)) {
				flush();
				var ul = [];
				while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
					ul.push('<li>' + inlineMd(lines[i].replace(/^[-*+]\s+/, '')) + '</li>'); i++;
				}
				out.push('<ul>' + ul.join('') + '</ul>');
				continue;
			}

			if (/^\d+\.\s+/.test(line)) {
				flush();
				var ol = [];
				while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
					ol.push('<li>' + inlineMd(lines[i].replace(/^\d+\.\s+/, '')) + '</li>'); i++;
				}
				out.push('<ol>' + ol.join('') + '</ol>');
				continue;
			}

			if (/^\s*$/.test(line)) { flush(); i++; continue; }

			para.push(line); i++;
		}
		flush();
		return out.join('\n');
	}

	/* ---------------- 渲染 ---------------- */
	function allItems() {
		return BUILTIN.concat(state.items);
	}

	function render() {
		if (state.view === 'detail') return renderDetail();
		if (state.view === 'form') return renderForm(state.editing);
		return renderList();
	}

	function renderList() {
		var list = allItems();
		var canWrite = S.hasToken();

		var html = '<div class="toolbar">';
		if (canWrite) {
			html += '<button class="btn btn-primary" id="btn-new">+ 写文章</button>';
		} else {
			html += '<span class="article-meta">浏览模式 · 仅站主可发布</span>';
		}
		html += '<span class="spacer"></span>';
		html += '<span class="article-meta">' + (state.loading ? '加载中…' : '共 ' + list.length + ' 篇') + '</span>';
		html += '<button class="btn btn-sm" id="btn-token" title="设置发布令牌">' + (canWrite ? '⚙ 令牌' : '🔑 站主设置') + '</button>';
		html += '</div>';

		if (state.loading) {
			html += '<div class="empty">正在读取…</div>';
		} else if (!list.length) {
			html += '<div class="empty"><span class="empty-icon">✎</span>还没有文章。</div>';
		} else {
			html += '<ul class="article-list">';
			list.forEach(function (a) {
				var tags = (a.tags || []).map(function (t) {
					return '<span class="tag">' + esc(t) + '</span>';
				}).join('');

				html += '<li class="article-item" data-id="' + esc(a.id) + '">' +
					'<div class="article-item-main">' +
					'<h3><a href="#" data-act="open">' + esc(a.title) + '</a></h3>' +
					'<div class="article-meta">' + esc(a.date) + ' ' + tags + '</div>' +
					(a.summary ? '<p class="article-summary">' + esc(a.summary) + '</p>' : '') +
					'</div><div class="article-item-actions">';

				if (a.builtin) {
					html += '<a class="btn btn-sm" href="' + a.url + '">原页面</a>';
				} else if (canWrite) {
					html += '<button class="btn btn-sm" data-act="edit">编辑</button>' +
						'<button class="btn btn-sm btn-danger" data-act="del">删除</button>';
				}
				html += '</div></li>';
			});
			html += '</ul>';
		}
		root.innerHTML = html;
	}

	function renderDetail() {
		var a = state.current;
		if (!a) { state.view = 'list'; return renderList(); }

		var body = a.builtin
			? '<p class="article-summary">这是 Hexo 生成的旧文章，正文在独立页面中。</p>' +
			  '<p style="margin-top:1rem"><a class="btn btn-primary" href="' + a.url + '">打开原页面 →</a></p>'
			: '<div class="article-body">' + renderMd(a.content) + '</div>';

		root.innerHTML = '<div class="toolbar"><button class="btn" data-act="back">← 返回列表</button></div>' +
			'<h1>' + esc(a.title) + '</h1>' +
			'<div class="article-meta" style="margin-bottom:1.6rem">' + esc(a.date) + ' ' +
			(a.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
			'</div>' + body;
	}

	function renderForm(edit) {
		var a = edit || { title: '', tags: [], summary: '', content: '' };
		root.innerHTML =
			'<div class="toolbar"><button class="btn" data-act="cancel">← 取消</button></div>' +
			'<h1>' + (edit ? '编辑文章' : '写文章') + '</h1>' +
			'<div class="field"><label>标题</label>' +
			'<input type="text" id="f-title" placeholder="给文章起个标题" value="' + esc(a.title) + '"></div>' +
			'<div class="field"><label>标签（逗号分隔，可留空）</label>' +
			'<input type="text" id="f-tags" placeholder="例如：笔记, 图形学" value="' + esc((a.tags || []).join(', ')) + '"></div>' +
			'<div class="field"><label>摘要（可留空，自动取正文前 60 字）</label>' +
			'<input type="text" id="f-summary" placeholder="一句话概括" value="' + esc(a.summary || '') + '"></div>' +
			'<div class="field"><label>正文</label>' +
			'<textarea id="f-content" placeholder="# 标题&#10;&#10;支持 **粗体**、`代码`、- 列表、&gt; 引用、```代码块```">' +
			esc(a.content || '') + '</textarea>' +
			'<div class="field-hint">支持简易 Markdown。保存后会提交到 GitHub 仓库，所有人可见。</div></div>' +
			'<div class="toolbar"><button class="btn btn-primary" data-act="save">发布</button>' +
			'<span class="article-meta" id="save-hint"></span></div>';

		var t = document.getElementById('f-title');
		if (t) t.focus();
	}

	/* ---------------- 令牌弹窗 ---------------- */
	function openTokenDialog() {
		var cur = S.getToken();
		var has = !!cur;
		var html = '<div class="modal-mask" id="tk-mask">' +
			'<div class="modal-box">' +
			'<h3 style="margin-top:0">站主设置</h3>' +
			'<p class="article-meta" style="margin-bottom:1rem">' +
			'发布文章需要 GitHub 令牌（只存在本机浏览器，不会上传）。' +
			'在 GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens 新建，' +
			'只勾选本仓库 <b>' + S.owner + '/' + S.repo + '</b> 的 <b>Contents: Read and write</b>。' +
			'</p>' +
			'<div class="field"><label>个人访问令牌' + (has ? '（当前已保存，可直接复制）' : '') + '</label>' +
			'<input type="text" id="tk-input" placeholder="github_pat_..." value="' + esc(cur) + '"></div>' +
			'<div class="toolbar" style="margin-bottom:0">' +
			'<button class="btn btn-primary" id="tk-save">保存并验证</button>' +
			(has ? '<button class="btn" id="tk-copy">复制令牌</button>' : '') +
			(has ? '<button class="btn btn-danger" id="tk-clear">清除令牌</button>' : '') +
			'<span class="spacer"></span><button class="btn" id="tk-cancel">关闭</button></div>' +
			'<p class="field-hint" id="tk-msg"></p>' +
			'</div></div>';

		var div = document.createElement('div');
		div.innerHTML = html;
		document.body.appendChild(div.firstChild);

		var mask = document.getElementById('tk-mask');
		var msg = document.getElementById('tk-msg');

		function close() { if (mask && mask.parentNode) mask.parentNode.removeChild(mask); }

		document.getElementById('tk-cancel').onclick = close;
		mask.addEventListener('click', function (e) { if (e.target === mask) close(); });

		document.getElementById('tk-save').onclick = function () {
			var v = document.getElementById('tk-input').value.trim();
			if (!v) { msg.textContent = '请先填入令牌'; return; }
			msg.textContent = '验证中…';
			S.setToken(v);
			S.verify().then(function () {
				msg.textContent = '✓ 验证通过，可以发布了';
				setTimeout(function () { close(); state.view = 'list'; render(); }, 700);
			}).catch(function (err) {
				S.setToken('');
				msg.textContent = '✗ ' + err.message;
			});
		};

		var clr = document.getElementById('tk-clear');
		if (clr) clr.onclick = function () {
			S.setToken('');
			close();
			state.view = 'list';
			render();
		};

		var cpy = document.getElementById('tk-copy');
		if (cpy) cpy.onclick = function () {
			S.copyText(S.getToken())
				.then(function () { msg.textContent = '✓ 令牌已复制到剪贴板'; })
				.catch(function () { msg.textContent = '自动复制失败，请手动全选输入框内容复制'; });
		};
	}

	/* ---------------- 事件 ---------------- */
	root.addEventListener('click', function (ev) {
		var actEl = ev.target.closest('[data-act]');
		var newBtn = ev.target.closest('#btn-new');
		var tkBtn = ev.target.closest('#btn-token');

		if (tkBtn) { ev.preventDefault(); return openTokenDialog(); }

		if (newBtn) {
			ev.preventDefault();
			state.editing = null;
			state.view = 'form';
			return render();
		}
		if (!actEl) return;

		var act = actEl.getAttribute('data-act');
		var item = actEl.closest('.article-item');
		var id = item ? item.getAttribute('data-id') : null;

		if (act === 'open') {
			ev.preventDefault();
			state.current = allItems().filter(function (x) { return String(x.id) === String(id); })[0];
			state.view = 'detail';
			return render();
		}
		if (act === 'back' || act === 'cancel') {
			ev.preventDefault();
			state.view = 'list';
			state.current = null;
			state.editing = null;
			return render();
		}
		if (act === 'edit') {
			state.editing = state.items.filter(function (x) { return String(x.id) === String(id); })[0];
			state.view = 'form';
			return renderForm(state.editing);
		}
		if (act === 'del') {
			if (!confirm('确定删除这篇文章？会同时提交到仓库，不可撤销。')) return;
			var next = state.items.filter(function (x) { return String(x.id) !== String(id); });
			setBusy('删除中…');
			S.saveArticles(next, 'content: 删除文章 ' + id)
				.then(function () {
					state.items = next;
					toast('已删除');
					render();
				})
				.catch(function (err) { toast('删除失败：' + err.message, true); render(); });
			return;
		}
		if (act === 'save') {
			var title = (document.getElementById('f-title').value || '').trim();
			var tagsRaw = (document.getElementById('f-tags').value || '').trim();
			var summary = (document.getElementById('f-summary').value || '').trim();
			var content = document.getElementById('f-content').value || '';

			if (!title) { alert('请填写标题'); return; }
			if (!content.trim()) { alert('正文不能为空'); return; }

			var tags = tagsRaw
				? tagsRaw.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean)
				: [];
			if (!summary) {
				summary = content.replace(/[#>*`\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
			}

			var list = state.items.slice();
			if (state.editing) {
				var idx = -1;
				list.forEach(function (x, k) { if (String(x.id) === String(state.editing.id)) idx = k; });
				if (idx >= 0) {
					list[idx] = Object.assign({}, list[idx], {
						title: title, tags: tags, summary: summary, content: content,
						updated: today()
					});
				}
			} else {
				list.unshift({
					id: uid(), title: title, tags: tags, summary: summary,
					content: content, date: today()
				});
			}

			var hint = document.getElementById('save-hint');
			if (hint) hint.textContent = '提交中…';

			S.saveArticles(list, (state.editing ? 'content: 更新文章 ' : 'content: 新增文章 ') + title)
				.then(function () {
					state.items = list;
					state.view = 'list';
					state.editing = null;
					toast('已发布');
					render();
				})
				.catch(function (err) {
					if (hint) hint.textContent = '';
					alert('发布失败：' + err.message);
				});
		}
	});

	/* ---------------- 小工具 ---------------- */
	function setBusy(text) {
		state.loading = true;
		render();
	}

	function toast(text, isErr) {
		var d = document.createElement('div');
		d.textContent = text;
		d.style.cssText = 'position:fixed;left:50%;bottom:2rem;transform:translateX(-50%);' +
			'background:' + (isErr ? '#c0392b' : '#1f2933') + ';color:#fff;padding:.7rem 1.4rem;' +
			'border-radius:5px;font-size:.85rem;z-index:10000;box-shadow:0 8px 24px rgba(0,0,0,.3);' +
			'opacity:0;transition:opacity .25s';
		document.body.appendChild(d);
		requestAnimationFrame(function () { d.style.opacity = '1'; });
		setTimeout(function () {
			d.style.opacity = '0';
			setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 300);
		}, 2200);
	}

	/* ---------------- 启动 ---------------- */
	var cached = S.cacheArticles();
	if (cached) { state.items = cached; state.loading = false; render(); }

	S.loadArticles().then(function (list) {
		state.items = list;
		state.loading = false;
		render();
	}).catch(function () {
		state.loading = false;
		render();
	});
})();
