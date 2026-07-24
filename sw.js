/* ○○교회 서비스 워커 — 항상 최신 파일 강제
   HTML/CSS/JS는 브라우저 HTTP 캐시까지 우회(no-store)해 항상 새로 받습니다.
   (업데이트 후 옛 화면이 남는 캐시 문제 방지)
   SW_VERSION: 이 값을 바꾸면 브라우저가 서비스워커를 새로 설치→모든 캐시 삭제→즉시 적용. */
const SW_VERSION = "20260724-hero-fullphoto-v6";
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── 공유 대상(Web Share Target): 인스타/사진 앱에서 '공유 → ○○교회' ──
   정적 사이트라 서버가 없으므로, 공유된 파일/링크를 서비스워커가 가로채
   IndexedDB에 잠시 저장한 뒤 share.html 로 리다이렉트해 업로드 폼을 채운다. */
function idbSavePending(payload) {
  return new Promise((resolve) => {
    let done = false; const ok = () => { if (!done) { done = true; resolve(); } };
    try {
      const req = indexedDB.open("wpc-share", 1);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains("pending")) db.createObjectStore("pending", { keyPath: "id" }); };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction("pending", "readwrite");
          tx.objectStore("pending").put({ id: 1, ...payload });
          tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok;
        } catch (_) { ok(); }
      };
      req.onerror = ok;
    } catch (_) { ok(); }
  });
}

self.addEventListener("fetch", (e) => {
  let url;
  try { url = new URL(e.request.url); } catch (_) { return; }

  // 공유 대상 POST(share.html) 가로채기 → IndexedDB 저장 후 폼으로 리다이렉트
  if (e.request.method === "POST" && url.origin === self.location.origin && /\/share\.html$/.test(url.pathname)) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const files = (form.getAll("photos") || []).filter((f) => f && f.size);
        await idbSavePending({
          text: form.get("text") || "",
          title: form.get("title") || "",
          url: form.get("url") || "",
          files: files,
          ts: Date.now(),
        });
      } catch (_) { /* 저장 실패해도 폼은 연다 */ }
      return Response.redirect("./share.html?shared=1", 303);
    })());
    return;
  }

  if (e.request.method !== "GET") return;

  // 페이지·스크립트·스타일은 항상 네트워크에서 새로(브라우저 캐시 우회)
  const freshNeeded =
    e.request.mode === "navigate" ||
    (url.origin === self.location.origin && /\.(?:html|js|css)(?:\?|$)/.test(url.pathname + url.search));

  if (freshNeeded) {
    e.respondWith(
      fetch(e.request.url, { cache: "no-store" }).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  }
});
