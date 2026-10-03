/* ============================================================
   ○○교회 — 파일 업로드 공용 모듈
   window.ChurchUpload.upload(file, {folder, compress}) → { url, key }
   window.ChurchUpload.remove(key)
   window.ChurchUpload.compressImage(file) → File(압축본)
   - 이미지는 업로드 전 자동 축소·압축(최대 변 1600px, JPEG 82%)
   - 저장소: R2_UPLOAD_URL(Cloudflare R2)이 설정돼 있으면 R2,
     아니면 Supabase Storage 공개 버킷('uploads')을 사용합니다.
   - R2·Supabase 둘 다 없을 때만 isReady()=false
   - 민감한 폴더(성도 문서·심방/상담 첨부·교적 사진·직인·설교 원고·자료실)는 공개 버킷이 아니라
     비공개 버킷('private_files', supabase/private_files_bucket.sql)에 올린다. 주소는
     …/storage/v1/object/authenticated/private_files/<경로> 로 저장되고(그대로는 안 열림),
     화면에서는 로그인한 사람의 권한으로 '1시간짜리 주소'를 받아 연다:
       · <a href>는 누를 때, <img>·<iframe> 등은 화면에 나타날 때 자동으로 바꿔 준다(이 파일 맨 아래).
       · 새 창에 직접 그려 넣는 인쇄물 등은 ChurchUpload.resolve(url) 로 먼저 바꿔서 쓴다.
   ============================================================ */
window.ChurchUpload = (function () {
  var SB_BUCKET = "uploads"; // Supabase Storage 공개 버킷 (supabase/uploads-bucket.sql 참고)
  var PRIVATE_BUCKET = "private_files"; // 비공개 버킷 (supabase/private_files_bucket.sql 참고)
  var PRIVATE_TOP = { archive: 1, affairs: 1, gyojeok: 1, finance: 1, sermons: 1, resources: 1 };
  var PRIV_MARK = "/storage/v1/object/authenticated/" + PRIVATE_BUCKET + "/";
  // 이 폴더(경로)는 비공개 버킷에 두는가. sermons/img 는 설교 글 속 그림(QT 화면에 그대로 나옴)이라 공개.
  function isPrivateFolder(folder) {
    folder = String(folder || "");
    if (/^sermons\/img(\/|$)/.test(folder)) return false;
    return !!PRIVATE_TOP[folder.split("/")[0]];
  }
  function privatePath(url) {
    url = String(url || "");
    var i = url.indexOf(PRIV_MARK);
    return i < 0 ? "" : url.slice(i + PRIV_MARK.length).split(/[?#]/)[0];
  }
  function isPrivateUrl(url) { return !!privatePath(url); }
  function base() { return (window.R2_UPLOAD_URL || "").replace(/\/$/, ""); }
  function hasR2() { return !!base(); }
  function hasSB() { return !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY); }
  function sbBase() { return (window.SUPABASE_URL || "").replace(/\/$/, ""); }
  function isReady() { return hasR2() || hasSB(); }

  function token() {
    try {
      const ref = (window.SUPABASE_URL || "").split("//")[1].split(".")[0];
      const raw = sessionStorage.getItem(`sb-${ref}-auth-token`);
      if (!raw) return "";
      const obj = JSON.parse(raw);
      return obj.access_token || (obj.currentSession && obj.currentSession.access_token) || "";
    } catch (e) { return ""; }
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const u = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(u); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(u); reject(e); };
      img.src = u;
    });
  }

  // 이미지 자동 압축(휴대폰 사진 5MB → 보통 200~400KB)
  async function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 1600;
    quality = quality || 0.82;
    if (!file || !/^image\//.test(file.type)) return file;          // 이미지 아님
    if (/gif|svg|x-icon/.test(file.type)) return file;               // GIF/SVG는 원본 유지
    try {
      const img = await loadImage(file);
      let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (Math.max(w, h) > maxDim) {
        const s = maxDim / Math.max(w, h);
        w = Math.round(w * s); h = Math.round(h * s);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);              // 투명 PNG → 흰 배경
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
      if (!blob || blob.size >= file.size) return file;             // 효과 없으면 원본
      const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
    } catch (e) {
      return file; // 압축 실패 시 원본 업로드
    }
  }

  async function upload(file, opts) {
    opts = opts || {};
    if (!isReady()) throw new Error("업로드 서버가 아직 설정되지 않았습니다.");
    if (!token()) throw new Error("로그인이 필요합니다.");
    const folder = opts.folder || "uploads";
    const f = (opts.compress === false) ? file : await compressImage(file);
    if (hasR2()) {
      const res = await fetch(base() + "/upload", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token(),
          "Content-Type": f.type || "application/octet-stream",
          "x-filename": encodeURIComponent(f.name || "file"),
          "x-folder": folder,
        },
        body: f,
      });
      let data = {};
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) throw new Error(data.error || ("업로드 실패 (" + res.status + ")"));
      return data; // { url, key }
    }
    return sbUpload(f, folder);
  }

  // ── Supabase Storage 업로드(민감한 폴더는 비공개 버킷, 나머지는 공개 버킷) ──
  async function sbUpload(f, folder) {
    const ext = ((f.name || "").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const rand = Math.random().toString(36).slice(2, 10);
    const path = (folder || "uploads") + "/" + Date.now() + "_" + rand + "." + ext;
    const priv = isPrivateFolder(folder);
    const bucket = priv ? PRIVATE_BUCKET : SB_BUCKET;
    const res = await fetch(sbBase() + "/storage/v1/object/" + bucket + "/" + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token(),
        apikey: window.SUPABASE_ANON_KEY,
        "Content-Type": f.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: f,
    });
    if (!res.ok) {
      let msg = "업로드 실패 (" + res.status + ")";
      try { const j = await res.json(); if (j && (j.message || j.error)) msg = j.message || j.error; } catch (e) {}
      if (res.status === 404 || /bucket/i.test(msg)) msg = "업로드 버킷이 없습니다. 관리자에게 문의해 주세요. (supabase/uploads-bucket.sql 실행 필요)";
      else if (priv && (res.status === 400 || res.status === 403) && /row-level security|policy|Unauthorized/i.test(msg)) msg = "이 종류의 파일을 올릴 권한이 없습니다. (담당 권한이 있는 분만 올릴 수 있습니다)";
      throw new Error(msg);
    }
    if (priv) return { url: sbBase() + PRIV_MARK + path, key: path };
    return { url: sbBase() + "/storage/v1/object/public/" + SB_BUCKET + "/" + path, key: path };
  }

  // ── 비공개 파일 주소 → 지금 로그인한 사람의 권한으로 받은 '1시간짜리 주소' ──
  //    비공개 주소가 아니면 그대로 돌려준다. 받은 주소는 50분 동안 기억해 다시 묻지 않는다.
  var signCache = {};
  async function resolve(url) {
    const p = privatePath(url);
    if (!p) return url;
    const c = signCache[p];
    if (c && c.exp > Date.now()) return c.url;
    if (!token()) throw new Error("로그인한 뒤에 열 수 있는 파일입니다.");
    const res = await fetch(sbBase() + "/storage/v1/object/sign/" + PRIVATE_BUCKET + "/" + p, {
      method: "POST",
      headers: { Authorization: "Bearer " + token(), apikey: window.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    let d = null;
    try { d = await res.json(); } catch (e) {}
    if (!res.ok || !d || !(d.signedURL || d.signedUrl)) throw new Error("이 파일을 볼 권한이 없거나 파일이 없습니다.");
    const full = sbBase() + "/storage/v1" + (d.signedURL || d.signedUrl);
    signCache[p] = { url: full, exp: Date.now() + 50 * 60 * 1000 };
    return full;
  }

  async function remove(key) {
    if (!key) return false;
    if (hasR2()) {
      try {
        const res = await fetch(base() + "/f/" + key.split("/").map(encodeURIComponent).join("/"), {
          method: "DELETE",
          headers: { Authorization: "Bearer " + token() },
        });
        return res.ok;
      } catch (e) { return false; }
    }
    try {
      // 경로의 첫 폴더로 어느 버킷에 있는지 안다. (옛 공개 버킷에 남아 있을 수 있어 비공개에서 못 지우면 공개도 본다)
      const enc = key.split("/").map(encodeURIComponent).join("/");
      const hdr = { Authorization: "Bearer " + token(), apikey: window.SUPABASE_ANON_KEY };
      const first = isPrivateFolder(key) ? PRIVATE_BUCKET : SB_BUCKET;
      let res = await fetch(sbBase() + "/storage/v1/object/" + first + "/" + enc, { method: "DELETE", headers: hdr });
      if (!res.ok && first === PRIVATE_BUCKET) res = await fetch(sbBase() + "/storage/v1/object/" + SB_BUCKET + "/" + enc, { method: "DELETE", headers: hdr });
      return res.ok;
    } catch (e) { return false; }
  }

  return { isReady, compressImage, upload, remove, resolve, isPrivateUrl };
})();

/* ── 화면 속 비공개 파일 주소를 알아서 열어 주기 ──
   · 링크(<a href>)는 누르는 순간 1시간짜리 주소를 받아 새 창으로 연다.
   · 그림·문서 틀(<img>·<iframe>·<embed>·<audio>·<video>·<source>)은 화면에 나타날 때 주소를 바꿔 준다.
   그래서 목록·상세 화면 코드는 주소를 그대로 href/src 에 넣기만 하면 된다. */
(function () {
  if (!window.ChurchUpload || window.__privateFileShim) return;
  window.__privateFileShim = true;
  var U = window.ChurchUpload;
  var MEDIA = "img,iframe,embed,audio,video,source";

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || !U.isPrivateUrl(a.getAttribute("href"))) return;
    e.preventDefault();
    var w = window.open("", "_blank");           // 팝업 차단을 피하려고 누른 즉시 빈 창을 먼저 연다
    U.resolve(a.getAttribute("href")).then(function (u) {
      if (w) w.location.replace(u); else location.href = u;
    }).catch(function (err) {
      if (w) w.close();
      alert(err && err.message ? err.message : "파일을 열지 못했습니다.");
    });
  }, true);

  function fix(el) {
    var src = el.getAttribute("src");
    if (!U.isPrivateUrl(src) || el.__privBusy === src) return;
    el.__privBusy = src;
    U.resolve(src).then(function (u) {
      if (el.getAttribute("src") === src) el.setAttribute("src", u);
    }).catch(function () { /* 권한이 없으면 깨진 그림으로 남는다 */ });
  }
  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches && node.matches(MEDIA)) fix(node);
    if (node.querySelectorAll) Array.prototype.forEach.call(node.querySelectorAll(MEDIA), fix);
  }
  function start() {
    scan(document.documentElement);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "attributes") scan(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
