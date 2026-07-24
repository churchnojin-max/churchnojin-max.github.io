/* ============================================================
   XLSX 경량 리더 — 서버 없이 브라우저에서 .xlsx를 2차원 배열로 변환
   (SheetJS 등 외부 CDN 없이, 이미 로드된 JSZip + 브라우저 DOMParser만 사용)
   지원 범위: 공유 문자열(shared strings) · 인라인 문자열 · 숫자 · 시트 이름
   ============================================================ */
window.XlsxLite = (function () {
  "use strict";

  function colToIndex(col) {
    var idx = 0;
    for (var i = 0; i < col.length; i++) idx = idx * 26 + (col.charCodeAt(i) - 64);
    return idx - 1;
  }
  function parseCellRef(ref) {
    var m = /^([A-Z]+)(\d+)$/.exec(ref);
    return { col: colToIndex(m[1]), row: parseInt(m[2], 10) - 1 };
  }

  function readSheet(file) {
    var parser = new DOMParser();
    var zip;
    return JSZip.loadAsync(file)
      .then(function (z) {
        zip = z;
        return zip.file("xl/workbook.xml").async("string");
      })
      .then(function (wbXml) {
        var wbDoc = parser.parseFromString(wbXml, "application/xml");
        var sheetEls = Array.prototype.slice.call(wbDoc.getElementsByTagName("sheet"));
        var sheetNames = sheetEls.map(function (el) { return el.getAttribute("name"); });
        var rIds = sheetEls.map(function (el) {
          return el.getAttribute("r:id") ||
            el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
        });
        return zip.file("xl/_rels/workbook.xml.rels").async("string").then(function (relsXml) {
          var relsDoc = parser.parseFromString(relsXml, "application/xml");
          var relEls = Array.prototype.slice.call(relsDoc.getElementsByTagName("Relationship"));
          var relMap = {};
          relEls.forEach(function (el) { relMap[el.getAttribute("Id")] = el.getAttribute("Target"); });
          var sheetPaths = rIds.map(function (rid) {
            var t = relMap[rid] || "";
            return "xl/" + t.replace(/^\/?xl\//, "");
          });
          return { sheetNames: sheetNames, sheetPaths: sheetPaths };
        });
      })
      .then(function (info) {
        var ssFile = zip.file("xl/sharedStrings.xml");
        var sharedStringsP = ssFile
          ? ssFile.async("string").then(function (ssXml) {
              var ssDoc = parser.parseFromString(ssXml, "application/xml");
              var siEls = Array.prototype.slice.call(ssDoc.getElementsByTagName("si"));
              return siEls.map(function (si) {
                var tEls = si.getElementsByTagName("t");
                var s = "";
                for (var i = 0; i < tEls.length; i++) s += tEls[i].textContent;
                return s;
              });
            })
          : Promise.resolve([]);
        return sharedStringsP.then(function (sharedStrings) {
          return { info: info, sharedStrings: sharedStrings };
        });
      })
      .then(function (ctx) {
        function getSheetGrid(sheetIndex) {
          var path = ctx.info.sheetPaths[sheetIndex];
          var sheetFile = zip.file(path);
          if (!sheetFile) return Promise.reject(new Error("시트를 찾을 수 없습니다: " + path));
          return sheetFile.async("string").then(function (xml) {
            var doc = parser.parseFromString(xml, "application/xml");
            var rowEls = Array.prototype.slice.call(doc.getElementsByTagName("row"));
            var grid = [];
            var maxCol = 0;
            rowEls.forEach(function (rowEl) {
              var rIdx = parseInt(rowEl.getAttribute("r"), 10) - 1;
              var cEls = Array.prototype.slice.call(rowEl.getElementsByTagName("c"));
              if (!grid[rIdx]) grid[rIdx] = [];
              cEls.forEach(function (cEl) {
                var ref = cEl.getAttribute("r");
                if (!ref) return;
                var pos = parseCellRef(ref);
                var type = cEl.getAttribute("t");
                var value = null;
                if (type === "inlineStr") {
                  var isEl = cEl.getElementsByTagName("is")[0];
                  value = isEl ? isEl.textContent : "";
                } else {
                  var vEl = cEl.getElementsByTagName("v")[0];
                  var raw = vEl ? vEl.textContent : "";
                  if (type === "s") value = ctx.sharedStrings[parseInt(raw, 10)] || "";
                  else if (type === "str") value = raw;
                  else if (type === "b") value = raw === "1";
                  else value = raw === "" ? null : Number(raw);
                }
                grid[rIdx][pos.col] = value;
                if (pos.col > maxCol) maxCol = pos.col;
              });
            });
            return grid.map(function (row) {
              var r = row || [];
              for (var i = 0; i <= maxCol; i++) if (r[i] === undefined) r[i] = null;
              return r;
            });
          });
        }
        return { sheetNames: ctx.info.sheetNames, getSheetGrid: getSheetGrid };
      });
  }

  return { readSheet: readSheet };
})();
