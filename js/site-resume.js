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

	var state = { data: null, loading: true, editing: false };

	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;')
			.replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

		html += '<div class="resume-head">' +
			'<img class="resume-avatar" src="/joker/' + esc(d.avatar || 'images/me.jpg') + '" alt="' + esc(d.name) + '" ' +
			'onerror="this.style.display=\'none\'">' +
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
			'<div class="field-hint">例如 images/me.jpg</div></div>' +
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
