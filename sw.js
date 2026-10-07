/**
 * Service Worker - iOS 拨号键盘离线缓存
 * 版本号变更时自动更新缓存
 * @version 1.0.0
 */

const CACHE_VERSION = 'ios-dialer-v1.1.0';
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/ios_dialer.html',
    '/dialer_data_management.html',
    '/dialer_data_manager.js',
    '/ios_dialer.css',
    '/ios_dialer.js',
    '/wav001/1.wav', '/wav001/2.wav', '/wav001/3.wav',
    '/wav001/4.wav', '/wav001/5.wav', '/wav001/6.wav',
    '/wav001/7.wav', '/wav001/8.wav', '/wav001/9.wav',
    '/wav001/10.wav', '/wav001/11.wav', '/wav001/12.wav',
];

/**
 * 安装阶段：预缓存核心资源
 */
self.addEventListener('install', (event) => {
    console.log('[SW] 📦 Installing...', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => {
                console.log('[SW] ✅ Pre-cache complete');
                return self.skipWaiting();
            })
            .catch((err) => console.warn('[SW] ⚠️ Pre-cache partial:', err))
    );
});

/**
 * 激活阶段：清理旧版本缓存
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] 🔄 Activating...', CACHE_VERSION);
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CACHE_VERSION)
                    .map((oldKey) => {
                        console.log('[SW] 🗑️ Deleting old cache:', oldKey);
                        return caches.delete(oldKey);
                    })
            ))
            .then(() => self.clients.claim())
    );
});

/**
 * 请求拦截：缓存优先 + 网络回退
 * 策略：静态资源 → 缓存优先；HTML 页面 → 网络优先 + 缓存回退
 */
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // 只处理 GET 请求
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // 跳过 Google Fonts / CDN / Analytics
    if (url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('cdn.tailwindcss.com') ||
        url.hostname.includes('font-awesome')) {
        return; // 放行外部 CDN 请求
    }

    // HTML 页面：网络优先（保证最新），失败回退缓存
    if (req.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(req)
                .then((resp) => {
                    // 网络成功 → 更新缓存
                    const clone = resp.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
                    return resp;
                })
                .catch(() => {
                    // 网络失败 → 用缓存
                    console.log('[SW] 📡 Offline, serving cached HTML:', url.pathname);
                    return caches.match(req)
                        .then((cached) => cached || caches.match('/ios_dialer.html'));
                })
        );
        return;
    }

    // 静态资源（CSS/JS/WAV/图片）：缓存优先，失败回退网络
    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) {
                // 缓存命中 → 后台更新（stale-while-revalidate）
                fetch(req)
                    .then((resp) => {
                        if (resp.ok) {
                            const clone = resp.clone();
                            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
                        }
                    })
                    .catch(() => { /* 离线跳过后台更新 */ });
                return cached;
            }

            // 缓存未命中 → 请求网络 + 存入缓存
            return fetch(req)
                .then((resp) => {
                    if (resp.ok) {
                        const clone = resp.clone();
                        caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
                    }
                    return resp;
                })
                .catch((err) => {
                    console.warn('[SW] ❌ Network failed for:', url.pathname, err);
                    return new Response('Offline', { status: 503, statusText: 'Offline' });
                });
        })
    );
});

/**
 * 消息监听：支持手动触发缓存更新
 */
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data?.type === 'CACHE_VERSION') {
        event.ports[0]?.postMessage(CACHE_VERSION);
    }
});
