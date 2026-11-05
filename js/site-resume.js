/* ==========================================================================
   Joker · 简历模块
   数据源：仓库 data/resume.json
   站主可在线编辑（需要令牌），访客只读
   ========================================================================== */
(function () {
	'use strict';

	var S = window.JokerStore;
	var root = document.getElementById('resume-app');
	if (!root || !S) return;

	var state = { data: null, loading: true, editing: false, preview: '', busy: false };

	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;')
			.replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function uid() {
		return 'av' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
	}

	function toast(msg, isErr) {
		var t = document.getElementById('joker-toast');
		if (!t) {
			t = document.createElement('div');
			t.id = 'joker-toast';
			t.className = 'jk-toast';
			document.body.appendChild(t);
		}
		t.className = 'jk-toast show' + (isErr ? ' err' : '');
		t.textContent = msg;
		clearTimeout(t._timer);
		t._timer = setTimeout(function () { t.className = 'jk-toast'; }, isErr ? 5200 : 2600);
	}

	var DEFAULTS = {
		name: 'SoooJr',
		role: '',
		avatar: 'images/me.jpg',
		about: '',
		contacts: [],
		skills: [],
		timeline: []
	};

	/* ---------------- 渲染 ---------------- */
	function render() {
		if (state.loading) { root.innerHTML = '<div class="empty">正在读取…</div>'; return; }
		if (state.editing) return renderEditor();

		var d = state.data || DEFAULTS;

		var contacts = (d.contacts || []).map(function (c) {
			var val = c.href
				? '<a href="' + esc(c.href) + '" target="_blank" rel="noopener">' + esc(c.value) + '</a>'
				: esc(c.value);
			return '<div>' + esc(c.label) + '：' + val + '</div>';
		}).join('');

		var skills = (d.skills || []).map(function (s) {
			return '<span class="skill-chip">' + esc(s) + '</span>';
		}).join('');

		var timeline = (d.timeline || []).map(function (t) {
			return '<div class="timeline-item">' +
				'<div class="t-date">' + esc(t.date) + '</div>' +
				'<div class="t-title">' + esc(t.title) + '</div>' +
				(t.desc ? '<p class="t-desc">' + esc(t.desc) + '</p>' : '') +
				'</div>';
		}).join('');

		var html = '<div class="toolbar" style="justify-content:flex-end">';
		if (S.hasToken()) {
			html += '<button class="btn btn-sm" id="btn-edit-resume">编辑简历</button>';
		}
		html += '</div>';

		var avatarPath = d.avatar || 'images/me.jpg';
		var avatarHtml = '<div class="resume-avatar-wrap" id="avatar-wrap">' +
			'<img class="resume-avatar" id="resume-avatar" ' +
			'src="' + esc(state.preview || ('/joker/' + avatarPath)) + '" ' +
			'data-path="' + esc(avatarPath) + '" alt="' + esc(d.name) + '">' +
			(S.hasToken() ? '<button type="button" class="avatar-btn" id="btn-avatar"><span>更换头像</span></button>' : '') +
			'</div>';

		html += '<div class="resume-head">' + avatarHtml +
			'<div class="resume-id">' +
			'<h1>' + esc(d.name || '未命名') + '</h1>' +
			(d.role ? '<p class="role">' + esc(d.role) + '</p>' : '') +
			'<div class="contact">' + contacts + '</div>' +
			'</div></div>';

		if (d.about) {
			html += '<div class="resume-block"><h2>简介</h2><p style="line-height:1.85;color:#444;margin:0">' +
				esc(d.about).replace(/\n/g, '<br>') + '</p></div>';
		}

		if (skills) {
			html += '<div class="resume-block"><h2>技能</h2><div class="skill-row">' + skills + '</div></div>';
		}

		if (timeline) {
			html += '<div class="resume-block"><h2>经历</h2><div class="timeline">' + timeline + '</div></div>';
		}

		if (!d.about && !skills && !timeline) {
			html += '<div class="empty"><span class="empty-icon">📄</span>' +
				'简历还是空的。' + (S.hasToken() ? '点右上角「编辑简历」填写。' : '站主登录后可以填写。') + '</div>';
		}

		html += '<p class="resume-note">数据保存在仓库 <code>data/resume.json</code>，' +
			(S.hasToken() ? '编辑后即刻生效。' : '仅站主可编辑。') + '</p>';

		root.innerHTML = html;

		var eb = document.getElementById('btn-edit-resume');
		if (eb) eb.onclick = function () { state.editing = true; renderEditor(); };

		bindAvatar();
	}

	/* ---------------- 头像更换（站主） ---------------- */
	function attachFallback(img) {
		img.addEventListener('error', function () {
			var step = parseInt(img.getAttribute('data-step') || '0', 10);
			var path = img.getAttribute('data-path') || '';
			if (step === 0 && path) {
				img.setAttribute('data-step', '1');
				img.src = S.imageFallback(path);
			} else if (step < 2) {
				img.setAttribute('data-step', '2');
				img.src = '/joker/images/me.jpg';
			}
		});
	}

	function ensureAvatarInput() {
		var input = document.getElementById('resume-avatar-input');
		if (input) return input;
		input = document.createElement('input');
		input.type = 'file';
		input.id = 'resume-avatar-input';
		input.accept = 'image/*';
		input.hidden = true;
		input.addEventListener('change', function () {
			if (input.files && input.files[0]) handleAvatar(input.files[0]);
			input.value = '';
		});
		document.body.appendChild(input);
		return input;
	}

	function bindAvatar() {
		var img = document.getElementById('resume-avatar');
		if (img) attachFallback(img);

		var wrap = document.getElementById('avatar-wrap');
		var btn = document.getElementById('btn-avatar');
		if (!wrap || !btn) return;

		btn.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			if (state.busy) return;
			ensureAvatarInput().click();
		});

		['dragenter', 'dragover'].forEach(function (ev) {
			wrap.addEventListener(ev, function (e) {
				if (state.busy) return;
				e.preventDefault();
				e.stopPropagation();
				wrap.classList.add('is-dragover');
			});
		});
		['dragleave', 'drop'].forEach(function (ev) {
			wrap.addEventListener(ev, function (e) {
				e.preventDefault();
				e.stopPropagation();
				wrap.classList.remove('is-dragover');
				if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
					if (state.busy) return;
					handleAvatar(e.dataTransfer.files[0]);
				}
			});
		});
	}

	function setAvatarBusy(on, text) {
		state.busy = on;
		var wrap = document.getElementById('avatar-wrap');
		if (wrap) wrap.classList.toggle('is-busy', on);
		var btn = document.getElementById('btn-avatar');
		if (!btn) return;
		btn.disabled = on;
		var t = btn.querySelector('span');
		if (t) t.textContent = on ? (text || '上传中…') : '更换头像';
	}

	function compressAvatar(file) {
		return new Promise(function (resolve, reject) {
			if (!/^image\//.test(file.type)) return reject(new Error('这不是图片文件'));
			if (file.size > 12 * 1024 * 1024) return reject(new Error('图片超过 12MB'));

			var el = new Image();
			var url = URL.createObjectURL(file);
			el.onload = function () {
				URL.revokeObjectURL(url);
				var w = el.naturalWidth, h = el.naturalHeight;
				var side = Math.min(w, h);
				var out = Math.min(640, side);

				var cv = document.createElement('canvas');
				cv.width = out;
				cv.height = out;
				var ctx = cv.getContext('2d');
				ctx.fillStyle = '#fff';
				ctx.fillRect(0, 0, out, out);
				ctx.drawImage(el, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out, out);

				var dataUrl = cv.toDataURL('image/jpeg', 0.9);
				resolve({ b64: dataUrl.split(',')[1], dataUrl: dataUrl });
			};
			el.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片无法解码')); };
			el.src = url;
		});
	}

	function handleAvatar(file) {
		if (state.busy) return;
		var d = state.data || DEFAULTS;
		var oldPath = d.avatar || '';
		var id = uid();

		setAvatarBusy(true, '处理中…');

		compressAvatar(file)
			.then(function (out) {
				setAvatarBusy(true, '上传中…');
				return S.uploadAvatar(id, out.b64, 'content: 更换简历头像').then(function () {
					var next = {};
					Object.keys(d).forEach(function (k) { next[k] = d[k]; });
					next.avatar = 'media/avatar/' + id + '.jpg';
					return S.saveResume(next, 'content: 更新简历头像').then(function () {
						return { next: next, preview: out.dataUrl };
					});
				});
			})
			.then(function (res) {
				state.data = res.next;
				state.preview = res.preview;
				state.busy = false;
				render();
				toast('头像已更新，部署完成后全站可见（约 1 分钟）');

				if (oldPath.indexOf('media/avatar/') === 0) {
					var oldId = oldPath.replace('media/avatar/', '').replace(/\.jpg$/, '');
					if (oldId && oldId !== id) {
						S.deleteAvatar(oldId, 'content: 清理旧简历头像').catch(function () {});
					}
				}
			})
			.catch(function (err) {
				state.busy = false;
				render();
				toast('头像更换失败：' + err.message, true);
			});
	}

	/* ---------------- 编辑器 ---------------- */
	function renderEditor() {
		var d = state.data || DEFAULTS;

		var contactsText = (d.contacts || []).map(function (c) {
			return [c.label, c.value, c.href || ''].join(' | ');
		}).join('\n');

		var timelineText = (d.timeline || []).map(function (t) {
			return [t.date, t.title, t.desc || ''].join(' | ');
		}).join('\n');

		root.innerHTML =
			'<div class="toolbar"><button class="btn" id="btn-cancel-resume">← 取消</button></div>' +
			'<h1>编辑简历</h1>' +
			'<div class="field"><label>姓名</label><input type="text" id="r-name" value="' + esc(d.name) + '"></div>' +
			'<div class="field"><label>职位 / 头衔</label><input type="text" id="r-role" value="' + esc(d.role || '') + '"></div>' +
			'<div class="field"><label>头像路径（相对站点根）</label>' +
			'<input type="text" id="r-avatar" value="' + esc(d.avatar || 'images/me.jpg') + '">' +
			'<div class="field-hint">一般不用改：返回简历页点「更换头像」上传更省事</div></div>' +
			'<div class="field"><label>简介</label>' +
			'<textarea id="r-about" style="min-height:120px">' + esc(d.about || '') + '</textarea></div>' +
			'<div class="field"><label>联系方式（每行一条：标签 | 值 | 链接）</label>' +
			'<textarea id="r-contacts" style="min-height:100px">' + esc(contactsText) + '</textarea>' +
			'<div class="field-hint">例：GitHub | github.com/SoooJr | https://github.com/SoooJr</div></div>' +
			'<div class="field"><label>技能（逗号分隔）</label>' +
			'<input type="text" id="r-skills" value="' + esc((d.skills || []).join(', ')) + '"></div>' +
			'<div class="field"><label>经历（每行一条：日期 | 标题 | 描述）</label>' +
			'<textarea id="r-timeline" style="min-height:140px">' + esc(timelineText) + '</textarea>' +
			'<div class="field-hint">例：2021 — 至今 | 技术美术 | 负责角色材质与特效</div></div>' +
			'<div class="toolbar"><button class="btn btn-primary" id="btn-save-resume">保存</button>' +
			'<span class="article-meta" id="r-hint"></span></div>';

		document.getElementById('btn-cancel-resume').onclick = function () {
			state.editing = false;
			render();
		};

		document.getElementById('btn-save-resume').onclick = function () {
			var hint = document.getElementById('r-hint');
			hint.textContent = '提交中…';

			function lines(id) {
				return (document.getElementById(id).value || '').split('\n')
					.map(function (l) { return l.trim(); })
					.filter(Boolean);
			}

			var contacts = lines('r-contacts').map(function (line) {
				var p = line.split('|').map(function (x) { return x.trim(); });
				return { label: p[0] || '', value: p[1] || '', href: p[2] || '' };
			});

			var timeline = lines('r-timeline').map(function (line) {
				var p = line.split('|').map(function (x) { return x.trim(); });
				return { date: p[0] || '', title: p[1] || '', desc: p[2] || '' };
			});

			var skills = (document.getElementById('r-skills').value || '')
				.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);

			var data = {
				name: (document.getElementById('r-name').value || '').trim(),
				role: (document.getElementById('r-role').value || '').trim(),
				avatar: (document.getElementById('r-avatar').value || '').trim() || 'images/me.jpg',
				about: document.getElementById('r-about').value || '',
				contacts: contacts,
				skills: skills,
				timeline: timeline
			};

			if (!data.name) { hint.textContent = ''; alert('姓名不能为空'); return; }

			S.saveResume(data).then(function () {
				state.data = data;
				state.editing = false;
				render();
			}).catch(function (err) {
				hint.textContent = '';
				alert('保存失败：' + err.message);
			});
		};
	}

	/* ---------------- 启动 ---------------- */
	S.loadResume().then(function (d) {
		state.data = d || DEFAULTS;
		state.loading = false;
		render();
	}).catch(function () {
		state.data = DEFAULTS;
		state.loading = false;
		render();
	});
})();
