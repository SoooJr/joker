/* ==========================================================================
   Joker · 存储层
   数据存在仓库里（data/articles.json、data/gallery.json），图片存 media/gallery/
   - 读：走 raw.githubusercontent（CDN，带缓存穿透参数），任何访客都能看
   - 写：走 GitHub Contents API，需要站主在页面上粘贴一次 Personal Access Token
   ========================================================================== */
(function () {
	'use strict';

	var OWNER = 'SoooJr';
	var REPO = 'joker';
	var BRANCH = 'master';

	var RAW_BASE = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/';
	var API_BASE = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/';
	var SITE_BASE = '/joker/';

	var TOKEN_KEY = 'joker.gh.token';
	var CACHE_ARTICLES = 'joker.cache.articles';
	var CACHE_GALLERY = 'joker.cache.gallery';

	/* ---------------- Token ---------------- */
	function getToken() {
		try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
	}
	function setToken(t) {
		try {
			if (t) localStorage.setItem(TOKEN_KEY, t);
			else localStorage.removeItem(TOKEN_KEY);
		} catch (e) {}
	}
	function hasToken() { return !!getToken(); }

	/* ---------------- 底层请求 ---------------- */
	function rawUrl(path) {
		return RAW_BASE + path + '?t=' + Date.now();
	}

	function readJson(path, fallback) {
		// 先读 raw（提交后立刻可见），失败再回落到同源（本地预览 / 离线）
		return fetch(rawUrl(path), { cache: 'no-store' })
			.then(function (r) {
				if (r.ok) return r.json();
				return fetch(SITE_BASE + path + '?t=' + Date.now(), { cache: 'no-store' })
					.then(function (r2) { return r2.ok ? r2.json() : fallback; });
			})
			.catch(function () {
				return fetch(SITE_BASE + path, { cache: 'no-store' })
					.then(function (r2) { return r2.ok ? r2.json() : fallback; })
					.catch(function () { return fallback; });
			});
	}

	function authHeaders() {
		return {
			'Authorization': 'Bearer ' + getToken(),
			'Accept': 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		};
	}

	function ghGetMeta(path) {
		// 返回 { sha, content } 或 null（文件不存在）
		return fetch(API_BASE + path + '?ref=' + BRANCH + '&t=' + Date.now(), {
			headers: authHeaders(),
			cache: 'no-store'
		}).then(function (r) {
			if (r.status === 404) return null;
			if (r.status === 401) throw new Error('令牌无效或已过期');
			if (r.status === 403) throw new Error('令牌权限不足，需要该仓库的 Contents 读写权限');
			if (!r.ok) throw new Error('读取仓库失败（HTTP ' + r.status + '）');
			return r.json();
		}).then(function (j) {
			if (!j) return null;
			var content = '';
			if (j.content && j.encoding === 'base64') {
				content = decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))));
			}
			return { sha: j.sha, content: content };
		});
	}

	function ghPut(path, base64Content, message, sha) {
		var body = {
			message: message,
			content: base64Content,
			branch: BRANCH
		};
		if (sha) body.sha = sha;

		return fetch(API_BASE + path, {
			method: 'PUT',
			headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
			body: JSON.stringify(body)
		}).then(function (r) {
			if (r.status === 401) throw new Error('令牌无效或已过期，请重新设置');
			if (r.status === 403) throw new Error('令牌没有该仓库的写入权限');
			if (r.status === 409) throw new Error('文件冲突（可能刚被别人改过），请刷新页面重试');
			if (!r.ok) {
				return r.json().catch(function () { return {}; }).then(function (j) {
					throw new Error(j.message || ('写入失败（HTTP ' + r.status + '）'));
				});
			}
			return r.json();
		});
	}

	function ghDelete(path, message, sha) {
		return fetch(API_BASE + path, {
			method: 'DELETE',
			headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
			body: JSON.stringify({ message: message, sha: sha, branch: BRANCH })
		}).then(function (r) {
			if (!r.ok && r.status !== 404) throw new Error('删除失败（HTTP ' + r.status + '）');
			return true;
		});
	}

	/* ---------------- 编码工具 ---------------- */
	function utf8ToBase64(str) {
		return btoa(unescape(encodeURIComponent(str)));
	}

	function arrayBufferToBase64(buf) {
		var bytes = new Uint8Array(buf);
		var chunk = 0x8000;
		var parts = [];
		for (var i = 0; i < bytes.length; i += chunk) {
			parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
		}
		return btoa(parts.join(''));
	}

	/* ---------------- 本地缓存 ---------------- */
	function readCache(key, fallback) {
		try {
			var raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : fallback;
		} catch (e) { return fallback; }
	}
	function writeCache(key, val) {
		try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
	}

	/* ---------------- 文章 ---------------- */
	function loadArticles() {
		return readJson('data/articles.json', []).then(function (list) {
			if (!Array.isArray(list)) list = [];
			list.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
			writeCache(CACHE_ARTICLES, list);
			return list;
		});
	}

	function saveArticles(list, message) {
		writeCache(CACHE_ARTICLES, list);
		var json = JSON.stringify(list, null, 2) + '\n';
		return ghGetMeta('data/articles.json').then(function (meta) {
			return ghPut('data/articles.json', utf8ToBase64(json),
				message || 'content: 更新文章列表', meta ? meta.sha : null);
		});
	}

	/* ---------------- 图库 ---------------- */
	function loadGallery() {
		return readJson('data/gallery.json', []).then(function (list) {
			if (!Array.isArray(list)) list = [];
			list.sort(function (a, b) { return (b.created || 0) - (a.created || 0); });
			writeCache(CACHE_GALLERY, list);
			return list;
		});
	}

	function saveGallery(list, message) {
		writeCache(CACHE_GALLERY, list);
		var json = JSON.stringify(list, null, 2) + '\n';
		return ghGetMeta('data/gallery.json').then(function (meta) {
			return ghPut('data/gallery.json', utf8ToBase64(json),
				message || 'content: 更新图库索引', meta ? meta.sha : null);
		});
	}

	function uploadImage(id, base64, message) {
		return ghPut('media/gallery/' + id + '.jpg', base64,
			message || ('content: 新增图片 ' + id), null);
	}

	function deleteImage(id, message) {
		return ghGetMeta('media/gallery/' + id + '.jpg').then(function (meta) {
			if (!meta) return true;
			return ghDelete('media/gallery/' + id + '.jpg',
				message || ('content: 删除图片 ' + id), meta.sha);
		});
	}

	/* ---------------- 简历 ---------------- */
	function loadResume() {
		return readJson('data/resume.json', null).then(function (d) {
			if (d && typeof d === 'object') writeCache('joker.cache.resume', d);
			return d;
		});
	}

	function saveResume(data, message) {
		writeCache('joker.cache.resume', data);
		var json = JSON.stringify(data, null, 2) + '\n';
		return ghGetMeta('data/resume.json').then(function (meta) {
			return ghPut('data/resume.json', utf8ToBase64(json),
				message || 'content: 更新简历', meta ? meta.sha : null);
		});
	}

	/* ---------------- 首页（头像 / 标题） ---------------- */
	function loadHome() {
		return readJson('data/home.json', null).then(function (d) {
			if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
			writeCache('joker.cache.home', d);
			return d;
		});
	}

	function saveHome(data, message) {
		writeCache('joker.cache.home', data);
		var json = JSON.stringify(data, null, 2) + '\n';
		return ghGetMeta('data/home.json').then(function (meta) {
			return ghPut('data/home.json', utf8ToBase64(json),
				message || 'content: 更新首页', meta ? meta.sha : null);
		});
	}

	function uploadHome(id, base64, message) {
		return ghPut('media/home/' + id + '.jpg', base64,
			message || ('content: 更新首页照片 ' + id), null);
	}

	function deleteHomeImage(id, message) {
		return ghGetMeta('media/home/' + id + '.jpg').then(function (meta) {
			if (!meta) return true;
			return ghDelete('media/home/' + id + '.jpg',
				message || ('content: 删除首页照片 ' + id), meta.sha);
		});
	}

	function imageUrl(path) {
		// 优先同源（部署后最快），失败再回落到 raw
		return SITE_BASE + path;
	}

	function imageFallback(path) {
		return RAW_BASE + path;
	}

	/* ---------------- 对外 ---------------- */
	window.JokerStore = {
		owner: OWNER,
		repo: REPO,
		branch: BRANCH,
		getToken: getToken,
		setToken: setToken,
		hasToken: hasToken,
		loadArticles: loadArticles,
		saveArticles: saveArticles,
		loadGallery: loadGallery,
		saveGallery: saveGallery,
		loadResume: loadResume,
		saveResume: saveResume,
		loadHome: loadHome,
		saveHome: saveHome,
		uploadHome: uploadHome,
		deleteHomeImage: deleteHomeImage,
		uploadImage: uploadImage,
		deleteImage: deleteImage,
		imageUrl: imageUrl,
		imageFallback: imageFallback,
		cacheArticles: function () { return readCache(CACHE_ARTICLES, null); },
		cacheGallery: function () { return readCache(CACHE_GALLERY, null); },
		toBase64: utf8ToBase64,
		bufToBase64: arrayBufferToBase64,
		verify: function () {
			// 用一次写权限探测验证令牌（读一个不存在的路径拿 404 说明鉴权通过）
			return fetch('https://api.github.com/repos/' + OWNER + '/' + REPO, {
				headers: authHeaders()
			}).then(function (r) {
				if (r.status === 401) throw new Error('令牌无效或已过期');
				if (!r.ok) throw new Error('验证失败（HTTP ' + r.status + '）');
				return r.json();
			}).then(function (j) {
				if (!j.permissions || !j.permissions.push) {
					throw new Error('令牌能读但不能写，请检查是否给了 Contents: Read and write 权限');
				}
				return true;
			});
		}
	};
})();
