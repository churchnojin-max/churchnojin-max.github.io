/* ============================================================
   ○○교회 — 파일 업로드 공용 모듈 (Cloudflare R2 Worker 연동)
   window.ChurchUpload.upload(file, {folder, compress}) → { url, key }
   window.ChurchUpload.remove(key)
   window.ChurchUpload.compressImage(file) → File(압축본)
   - 이미지는 업로드 전 자동 축소·압축(최대 변 1600px, JPEG 82%)
   - R2_UPLOAD_URL 미설정 시 isReady()=false
   ============================================================ */
window.ChurchUpload = (function () {
  function base() { return (window.R2_UPLOAD_URL || "").replace(/\/$/, ""); }
  function isReady() { return !!base(); }

  function token() {
    try {
      const ref = (window.SUPABASE_URL || "").split("//")[1].split(".")[0];
      const raw = localStorage.getItem(`sb-${ref}-auth-token`);
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

  async function remove(key) {
    if (!isReady() || !key) return false;
    try {
      const res = await fetch(base() + "/f/" + key.split("/").map(encodeURIComponent).join("/"), {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token() },
      });
      return res.ok;
    } catch (e) { return false; }
  }

  return { isReady, compressImage, upload, remove };
})();
