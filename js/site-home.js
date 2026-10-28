/* ==========================================================================
   Joker · 首页模块
   站主可以在首页直接更换「Technical Artist of Games」下方那张照片
   - 数据：data/home.json（name / tagline / portrait）
   - 照片：media/home/*.jpg
   - 访客只读；只有设置了令牌的站主才看到「更换照片」按钮
   ========================================================================== */
(function () {
	'use strict';

	var S = window.JokerStore;
	var me = document.getElementById('me');
	if (!S || !me) return;

	var host = me.querySelector('a.jumplink.pic') || me;
	var img = host.querySelector('img');
	if (!img) return;

	var MAX_FILE_MB = 12;
	var MAX_EDGE = 1400;
	var QUALITY = 0.88;

	var state = {
		data: { name: '', tagline: '', portrait: 'images/me.jpg' },
		busy: false
	};

	/* ---------------- 工具 ---------------- */
	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;')
			.replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function uid() {
		return 'portrait-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
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

	/* ---------------- 渲染 ---------------- */
	function applyData(d) {
		if (!d || typeof d !== 'object') return;
		if (d.name) {
			state.data.name = d.name;
			var h1 = me.querySelector('header h1');
			if (h1) h1.textContent = d.name;
		}
		if (d.tagline) {
			state.data.tagline = d.tagline;
			var p = me.querySelector('header p');
			if (p) p.textContent = d.tagline;
		}
		if (d.portrait) {
			state.data.portrait = d.portrait;
			if (img.getAttribute('src') !== S.imageUrl(d.portrait)) {
				img.setAttribute('src', S.imageUrl(d.portrait));
			}
			img.setAttribute('data-fallback', S.imageFallback(d.portrait));
		}
	}

	function paint() {
		var canWrite = S.hasToken();
		host.classList.add('portrait-host');
		host.classList.toggle('portrait-can-write', canWrite);

		var old = document.getElementById('portrait-btn');
		if (old) old.parentNode.removeChild(old);

		if (!canWrite) return;

		var btn = document.createElement('button');
		btn.type = 'button';
		btn.id = 'portrait-btn';
		btn.className = 'portrait-btn';
		btn.innerHTML = '<span class="pb-dot"></span><span class="pb-text">更换照片</span>';
		btn.title = '更换这张照片（上传后自动提交到仓库）';
		btn.addEventListener('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			if (state.busy) return;
			pick();
		});
		host.appendChild(btn);

		var input = document.createElement('input');
		input.type = 'file';
		input.id = 'portrait-input';
		input.accept = 'image/*';
		input.hidden = true;
		// 挂在 body 上，避免 click 冒泡触发外层 a.jumplink 的滚动
		input.addEventListener('click', function (e) { e.stopPropagation(); });
		input.addEventListener('change', function () {
			if (input.files && input.files[0]) handleFile(input.files[0]);
			input.value = '';
		});
		document.body.appendChild(input);

		// 拖拽上传
		['dragenter', 'dragover'].forEach(function (ev) {
			host.addEventListener(ev, function (e) {
				if (state.busy) return;
				e.preventDefault();
				e.stopPropagation();
				host.classList.add('portrait-dragover');
			});
		});
		['dragleave', 'drop'].forEach(function (ev) {
			host.addEventListener(ev, function (e) {
				e.preventDefault();
				e.stopPropagation();
				host.classList.remove('portrait-dragover');
				if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
					if (state.busy) return;
					handleFile(e.dataTransfer.files[0]);
				}
			});
		});
	}

	function pick() {
		var input = document.getElementById('portrait-input');
		if (input) input.click();
	}

	function setBusy(on, text) {
		state.busy = on;
		host.classList.toggle('portrait-busy', on);
		var btn = document.getElementById('portrait-btn');
		if (!btn) return;
		btn.disabled = on;
		var t = btn.querySelector('.pb-text');
		if (t) t.textContent = on ? (text || '上传中…') : '更换照片';
	}

	/* ---------------- 压缩 ---------------- */
	function compress(file) {
		return new Promise(function (resolve, reject) {
			if (!/^image\//.test(file.type)) return reject(new Error('不是图片文件'));
			if (file.size > MAX_FILE_MB * 1024 * 1024) {
				return reject(new Error('图片超过 ' + MAX_FILE_MB + 'MB'));
			}
			var el = new Image();
			var url = URL.createObjectURL(file);
			el.onload = function () {
				URL.revokeObjectURL(url);
				var w = el.naturalWidth, h = el.naturalHeight;
				var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
				var cw = Math.round(w * scale), ch = Math.round(h * scale);

				var cv = document.createElement('canvas');
				cv.width = cw; cv.height = ch;
				var ctx = cv.getContext('2d');
				ctx.fillStyle = '#fff';
				ctx.fillRect(0, 0, cw, ch);
				ctx.drawImage(el, 0, 0, cw, ch);

				var dataUrl = cv.toDataURL('image/jpeg', QUALITY);
				resolve({ b64: dataUrl.split(',')[1], width: cw, height: ch });
			};
			el.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片无法解码')); };
			el.src = url;
		});
	}

	/* ---------------- 上传并保存 ---------------- */
	function handleFile(file) {
		if (state.busy) return;
		var oldPath = state.data.portrait || '';
		var id = uid();

		setBusy(true, '处理中…');

		compress(file)
			.then(function (out) {
				setBusy(true, '上传中…');
				return S.uploadHome(id, out.b64, 'content: 更换首页照片').then(function () {
					var next = {
						name: state.data.name || '',
						tagline: state.data.tagline || '',
						portrait: 'media/home/' + id + '.jpg'
					};
					return S.saveHome(next, 'content: 更新首页照片').then(function () { return next; });
				});
			})
			.then(function (next) {
				state.data = next;
				img.setAttribute('src', S.imageUrl(next.portrait));
				img.setAttribute('data-fallback', S.imageFallback(next.portrait));
				setBusy(false);
				toast('照片已更新，部署完成后所有人可见（约 1 分钟）');

				// 顺手清掉上一张，避免仓库越攒越大
				if (oldPath.indexOf('media/home/') === 0) {
					var oldId = oldPath.replace('media/home/', '').replace(/\.jpg$/, '');
					if (oldId && oldId !== id) {
						S.deleteHomeImage(oldId, 'content: 清理旧首页照片').catch(function () {});
					}
				}
			})
			.catch(function (err) {
				setBusy(false);
				toast('更换失败：' + err.message, true);
			});
	}

	/* ---------------- 启动 ---------------- */
	paint();
	S.loadHome().then(function (d) {
		if (d) applyData(d);
	});
})();
