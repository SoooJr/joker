/* ==========================================================================
   Joker · 图库模块
   索引：仓库 data/gallery.json   图片：media/gallery/<id>.jpg
   上传前在浏览器内压缩（最长边 1600px，JPEG 0.85），避免仓库爆掉
   ========================================================================== */
(function () {
	'use strict';

	var S = window.JokerStore;
	var root = document.getElementById('gallery-app');
	if (!root || !S) return;

	var MAX_EDGE = 1600;
	var QUALITY = 0.85;
	var MAX_FILE_MB = 20;

	var state = { items: [], loading: true, uploading: false };

	function esc(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;')
			.replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function uid() {
		return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
	}

	function kb(n) {
		return n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
	}

	/* ---------------- 渲染 ---------------- */
	function render() {
		var canWrite = S.hasToken();
		var html = '<div class="toolbar">';

		if (canWrite) {
			html += '<button class="btn btn-primary" id="btn-pick">+ 上传图片</button>';
		} else {
			html += '<span class="article-meta">浏览模式 · 仅站主可上传</span>';
		}
		html += '<span class="spacer"></span>';
		html += '<span class="article-meta">' + (state.loading ? '加载中…' : '共 ' + state.items.length + ' 张') + '</span>';
		html += '<button class="btn btn-sm" id="btn-token">' + (canWrite ? '⚙ 令牌' : '🔑 站主设置') + '</button>';
		html += '</div>';

		if (canWrite) {
			html += '<div class="dropzone" id="dropzone">' +
				'<span class="dz-icon">🖼</span>' +
				'<div>把图片拖到这里，或点击选择</div>' +
				'<div class="dz-hint">支持 JPG / PNG / WebP / GIF，单张不超过 ' + MAX_FILE_MB + 'MB，可多选</div>' +
				'<input type="file" id="file-input" accept="image/*" multiple hidden>' +
				'</div>';
		}

		if (state.uploading) {
			html += '<div class="upload-bar" id="upload-bar"><div class="upload-fill" id="upload-fill"></div>' +
				'<span id="upload-text">上传中…</span></div>';
		}

		if (state.loading) {
			html += '<div class="empty">正在读取…</div>';
		} else if (!state.items.length) {
			html += '<div class="empty"><span class="empty-icon">🖼</span>图库还是空的。</div>';
		} else {
			html += '<div class="gallery-grid">';
			state.items.forEach(function (img) {
				html += '<div class="gallery-item" data-id="' + esc(img.id) + '" data-src="' +
					esc(S.imageUrl(img.path)) + '">' +
					'<img src="' + esc(S.imageUrl(img.path)) + '" alt="' + esc(img.name) + '" loading="lazy" ' +
					'data-fallback="' + esc(S.imageFallback(img.path)) + '">' +
					'<span class="g-name">' + esc(img.name) + '</span>' +
					(canWrite ? '<button class="g-del" data-act="del" title="删除">×</button>' : '') +
					'</div>';
			});
			html += '</div>';
		}

		root.innerHTML = html;
		bind();
	}

	function bind() {
		var pick = document.getElementById('btn-pick');
		var input = document.getElementById('file-input');
		var dz = document.getElementById('dropzone');

		if (pick && input) pick.onclick = function () { input.click(); };

		if (input) {
			input.onchange = function () {
				if (input.files && input.files.length) handleFiles(input.files);
				input.value = '';
			};
		}

		if (dz && input) {
			dz.onclick = function (e) { if (e.target !== input) input.click(); };
			['dragenter', 'dragover'].forEach(function (t) {
				dz.addEventListener(t, function (e) {
					e.preventDefault(); e.stopPropagation();
					dz.classList.add('dragover');
				});
			});
			['dragleave', 'drop'].forEach(function (t) {
				dz.addEventListener(t, function (e) {
					e.preventDefault(); e.stopPropagation();
					dz.classList.remove('dragover');
				});
			});
			dz.addEventListener('drop', function (e) {
				var files = e.dataTransfer && e.dataTransfer.files;
				if (files && files.length) handleFiles(files);
			});
		}

		// 图片加载失败回落 raw
		root.querySelectorAll('.gallery-item img').forEach(function (im) {
			im.addEventListener('error', function once() {
				var fb = im.getAttribute('data-fallback');
				if (fb && im.src !== fb) { im.src = fb; }
				im.removeEventListener('error', once);
			});
		});

		root.querySelectorAll('.gallery-item').forEach(function (box) {
			box.addEventListener('click', function (e) {
				if (e.target.closest('[data-act="del"]')) return;
				openLightbox(box.getAttribute('data-src'));
			});
		});

		root.querySelectorAll('[data-act="del"]').forEach(function (btn) {
			btn.onclick = function (e) {
				e.stopPropagation();
				var id = btn.closest('.gallery-item').getAttribute('data-id');
				if (!confirm('确定删除这张图片？会同时从仓库移除。')) return;
				S.deleteImage(id).then(function () {
					var next = state.items.filter(function (x) { return String(x.id) !== String(id); });
					return S.saveGallery(next, 'content: 删除图片 ' + id).then(function () {
						state.items = next;
						toast('已删除');
						render();
					});
				}).catch(function (err) {
					alert('删除失败：' + err.message);
				});
			};
		});

		var tk = document.getElementById('btn-token');
		if (tk) tk.onclick = openTokenDialog;
	}

	/* ---------------- 灯箱 ---------------- */
	function openLightbox(src) {
		var lb = document.createElement('div');
		lb.className = 'lightbox open';
		lb.innerHTML = '<span class="lb-close">×</span><img src="' + esc(src) + '" alt="">';
		document.body.appendChild(lb);
		function close() { if (lb.parentNode) lb.parentNode.removeChild(lb); document.removeEventListener('keydown', onKey); }
		function onKey(e) { if (e.key === 'Escape') close(); }
		lb.onclick = close;
		document.addEventListener('keydown', onKey);
	}

	/* ---------------- 上传 ---------------- */
	function compress(file) {
		return new Promise(function (resolve, reject) {
			var img = new Image();
			var url = URL.createObjectURL(file);
			img.onload = function () {
				URL.revokeObjectURL(url);
				var w = img.naturalWidth, h = img.naturalHeight;
				var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
				var cw = Math.round(w * scale), ch = Math.round(h * scale);

				var cv = document.createElement('canvas');
				cv.width = cw; cv.height = ch;
				var ctx = cv.getContext('2d');
				ctx.fillStyle = '#fff';
				ctx.fillRect(0, 0, cw, ch);
				ctx.drawImage(img, 0, 0, cw, ch);

				var dataUrl = cv.toDataURL('image/jpeg', QUALITY);
				resolve({ dataUrl: dataUrl, b64: dataUrl.split(',')[1], width: cw, height: ch });
			};
			img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片无法解码')); };
			img.src = url;
		});
	}

	function handleFiles(files) {
		var list = Array.prototype.slice.call(files).filter(function (f) {
			return /^image\//.test(f.type);
		});
		if (!list.length) { alert('没有可用的图片文件'); return; }

		var tooBig = list.filter(function (f) { return f.size > MAX_FILE_MB * 1024 * 1024; });
		if (tooBig.length) {
			alert('以下文件超过 ' + MAX_FILE_MB + 'MB，已跳过：\n' + tooBig.map(function (f) { return f.name; }).join('\n'));
			list = list.filter(function (f) { return f.size <= MAX_FILE_MB * 1024 * 1024; });
		}
		if (!list.length) return;

		state.uploading = true;
		render();
		setProgress(0, '准备上传 ' + list.length + ' 张…');

		var next = state.items.slice();
		var done = 0;
		var failed = [];

		var chain = Promise.resolve();
		list.forEach(function (file) {
			chain = chain.then(function () {
				return compress(file).then(function (out) {
					var id = uid();
					var path = 'media/gallery/' + id + '.jpg';
					return S.uploadImage(id, out.b64, 'content: 上传图片 ' + file.name)
						.then(function () {
							next.unshift({
								id: id,
								name: file.name.replace(/\.[^.]+$/, ''),
								path: path,
								width: out.width,
								height: out.height,
								size: Math.round(out.b64.length * 0.75),
								created: Date.now()
							});
						});
				}).catch(function (err) {
					failed.push(file.name + '（' + err.message + '）');
				}).then(function () {
					done++;
					setProgress(done / list.length, '上传中 ' + done + ' / ' + list.length);
				});
			});
		});

		chain.then(function () {
			return S.saveGallery(next, 'content: 更新图库索引');
		}).then(function () {
			state.items = next;
			state.uploading = false;
			render();
			toast(failed.length ? ('完成，' + failed.length + ' 张失败') : '上传完成', failed.length > 0);
			if (failed.length) alert('部分图片上传失败：\n' + failed.join('\n'));
		}).catch(function (err) {
			state.uploading = false;
			render();
			alert('保存索引失败：' + err.message);
		});
	}

	function setProgress(ratio, text) {
		var fill = document.getElementById('upload-fill');
		var label = document.getElementById('upload-text');
		if (fill) fill.style.width = Math.round(ratio * 100) + '%';
		if (label) label.textContent = text;
	}

	/* ---------------- 令牌弹窗（与文章页一致） ---------------- */
	function openTokenDialog() {
		var cur = S.getToken();
		var has = !!cur;
		var div = document.createElement('div');
		div.innerHTML = '<div class="modal-mask" id="tk-mask"><div class="modal-box">' +
			'<h3 style="margin-top:0">站主设置</h3>' +
			'<p class="article-meta" style="margin-bottom:1rem">' +
			'上传图片需要 GitHub 令牌（只存在本机浏览器，不会上传）。' +
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
				msg.textContent = '✓ 验证通过，可以上传了';
				setTimeout(function () { close(); render(); }, 700);
			}).catch(function (err) {
				S.setToken('');
				msg.textContent = '✗ ' + err.message;
			});
		};

		var clr = document.getElementById('tk-clear');
		if (clr) clr.onclick = function () { S.setToken(''); close(); render(); };

		var cpy = document.getElementById('tk-copy');
		if (cpy) cpy.onclick = function () {
			S.copyText(S.getToken())
				.then(function () { msg.textContent = '✓ 令牌已复制到剪贴板'; })
				.catch(function () { msg.textContent = '自动复制失败，请手动全选输入框内容复制'; });
		};
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
	var cached = S.cacheGallery();
	if (cached) { state.items = cached; state.loading = false; render(); }

	S.loadGallery().then(function (list) {
		state.items = list;
		state.loading = false;
		render();
	}).catch(function () {
		state.loading = false;
		render();
	});
})();
