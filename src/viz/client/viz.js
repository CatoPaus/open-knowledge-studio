(function () {
  function detectTextLang(text) {
    const sample = String(text || "").trim();
    if (!sample) return "en";
    if (/[\u3040-\u30ff]/.test(sample)) return "ja";
    if (/[\uac00-\ud7af]/.test(sample)) return "ko";
    if (/[\u4e00-\u9fff]/.test(sample)) return "zh";
    if (/[\u0600-\u06ff]/.test(sample)) return "ar";
    if (/[\u0400-\u04ff]/.test(sample)) return /[іїєґІЇЄҐ]/.test(sample) ? "uk" : "ru";
    if (/[ðþÐÞ]/.test(sample)) return "is";
    if ((sample.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length >= 2) return "pl";
    const count = function (re) { return (sample.match(re) || []).length; };
    const scores = [
      ["fi", count(/\b(ja|on|ei|että|mutta|kanssa|ovat|kuin|myös|sekä|tämä)\b/gi) * 3],
      ["sv", count(/\b(och|att|är|inte|från|också|detta|genom\w*|finns|mycket)\b/gi) * 3 + count(/[äöÄÖåÅ]/g)],
      ["de", count(/[ß]/g) * 4 + count(/\b(der|die|das|und|nicht|mit|für|von|auf|ist|sind|werden|auch|oder|durch)\b/gi) * 2],
      ["da", count(/\b(af|bliver|blevet|hvordan|også|gennem\w*|deres|mellem|skulle)\b/gi) * 3 + count(/\b\w{4,}hed(?:en|er|ens)?\b/gi) * 2 + count(/[æøåÆØÅ]/g)],
      ["no", count(/\b(ikke|ikkje|hvordan|korleis|hvorfor|mellom|gjennom\w*|dersom|blir|blitt|også|deres)\b/gi) * 3 + count(/\b\w{4,}het(?:en|er|ens|ene)?\b/gi) * 2 + count(/\b(og|det|som|med|til|fra|har|i|skal|må|kan|ved|av|på)\b/g) + count(/[æøåÆØÅ]/g) * 2],
      ["fr", count(/[œçàèùâêîôû]/gi) + count(/\b(les|des|est|une|dans|pour|pas|plus|avec|sur|sont|cette|aux|mais)\b/gi) * 2],
      ["es", count(/[ñ¿¡]/gi) * 4 + count(/\b(los|las|del|una|para|con|por|como|más|pero|sus|esta|entre|sobre)\b/gi) * 2],
      ["pt", count(/[ãõ]/gi) * 4 + count(/\b(não|uma|para|com|dos|das|mais|como|pelo|pela|são|está|entre)\b/gi) * 2],
      ["it", count(/\b(che|non|per|una|con|del|della|sono|anche|più|questo|questa|degli|delle)\b/gi) * 2],
      ["nl", count(/\b(het|een|van|dat|niet|voor|met|zijn|worden|naar|ook|deze|door)\b/gi) * 2],
      ["en", count(/\b(the|and|with|from|that|this|are|was|were|have|has|had|will|would|should|could|which|their|there|about|into|between|without|within|through|during|before|after|under)\b/gi) * 2],
    ];
    scores.sort(function (a, b) { return b[1] - a[1]; });
    const enScore = scores.find(function (x) { return x[0] === "en"; })[1];
    if (scores[0][1] >= 3) {
      if (scores[0][0] === "no" && enScore >= scores[0][1]) return "en";
      return scores[0][0];
    }
    return "en";
  }

  function formatVizTpl(template, vars) {
    const raw = String(template || "");
    if (!vars) return raw;
    return raw.replace(/\{([a-zA-Z0-9_]+)\}/g, function (m, k) {
      return vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m;
    });
  }

  function isInlineLatexMath(inner) {
    if (!inner || typeof inner !== "string") return false;
    if (/^\s|\s$/.test(inner)) return false;
    if (/[\r\n|]/.test(inner)) return false;
    if (inner.indexOf("[^") !== -1) return false;
    if (/\*\*|__/.test(inner)) return false;
    if (/(?:^|[^\\])~$/.test(inner)) return false;
    if (/^[A-Z]{1,5}\/[A-Z]{1,5}$/.test(inner)) return true;
    if (/^[a-zA-Z]$/.test(inner)) return true;
    if (/^\d+\.\d{3,}$/.test(inner)) return true;
    if (/^[a-zA-Z](?:_[a-zA-Z0-9]+)?\s*(?:=|<|>|<=|>=|≈|~|±)\s*[+-]?\d+(?:[.,]\d+)?%?$/.test(inner)) return true;
    if (/^\d[\d,.]*(?:\s*(?:[BMKTbmkt](?![\^_])\b|billion|million|trillion|thousand|bn\b|mn\b|\/(?![a-zA-Z0-9_()]*[\^_\\])|\s+(?:per|to|and|or|in|at|for|from|of|vs)\b|-|–|—|\)|\s*$))/i.test(inner)) {
      return false;
    }
    if (!/(?:\\[a-zA-Z !,;:%$&_#]|[A-Za-z0-9)\]}][\^_](?:\{[^{}\r\n]+\}|[A-Za-z0-9+\-°]))/.test(inner)) {
      return false;
    }
    if (/^\d/.test(inner)) {
      if (
        !/^\d+(?:[.,]\d+)*(?:\s*[+\-*/]?\s*(?:\\|[\^_])|\s+[a-zA-Z]{1,4}[\^_]|\s*[*/]\s*[a-zA-Z0-9()]+\s*[\^_])/.test(
          inner
        ) &&
        !/^0\.\d{3,}$/.test(inner)
      ) {
        return false;
      }
    }
    return true;
  }

  function replaceInlineLatexSpans(str, replacer) {
    const s = String(str || "");
    let out = "";
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === "\\" && i + 1 < s.length && s[i + 1] === "$") {
        out += s.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (ch !== "$") {
        out += ch;
        i++;
        continue;
      }
      if (i + 1 < s.length && s[i + 1] === "$") {
        let j = i + 2;
        while (j + 1 < s.length) {
          if (s[j] === "\\" && j + 1 < s.length) {
            j += 2;
            continue;
          }
          if (s[j] === "$" && s[j + 1] === "$") {
            break;
          }
          if (s[j] === "|" || (s[j] === "\n" && /^\r?\n\s*\r?\n/.test(s.slice(j)))) {
            break;
          }
          j++;
        }
        if (j + 1 < s.length && s[j] === "$" && s[j + 1] === "$") {
          const innerDisp = s.slice(i + 2, j).replace(/\s+/g, " ").trim();
          if (isInlineLatexMath(innerDisp)) {
            out += replacer(s.slice(i, j + 2), innerDisp);
            i = j + 2;
            continue;
          }
        }
      }
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "\\" && j + 1 < s.length) {
          j += 2;
          continue;
        }
        if (s[j] === "$" || s[j] === "\n" || s[j] === "\r" || s[j] === "|") {
          break;
        }
        j++;
      }
      if (j < s.length && s[j] === "$") {
        const inner = s.slice(i + 1, j);
        if (isInlineLatexMath(inner)) {
          out += replacer(s.slice(i, j + 1), inner);
          i = j + 1;
          continue;
        }
      }
      out += "$";
      i++;
    }
    return out;
  }

  if (typeof window !== "undefined" && window.__ICM_TEST_HOOKS__) {
    window.__ICM_TEST_HOOKS__.renderMarkdownWithOkfFootnotes = renderMarkdownWithOkfFootnotes;
    window.__ICM_TEST_HOOKS__.parseBuiltInVizMarkdown = parseBuiltInVizMarkdown;
    window.__ICM_TEST_HOOKS__.isInlineLatexMath = isInlineLatexMath;
    window.__ICM_TEST_HOOKS__.replaceInlineLatexSpans = replaceInlineLatexSpans;
    window.__ICM_TEST_HOOKS__.detectTextLang = detectTextLang;
    window.__ICM_TEST_HOOKS__.resolveInternalConceptId = resolveInternalConceptId;
    return;
  }
  const bundle = window.BUNDLE;
  const bundleName = window.BUNDLE_NAME;
  const uiLocale = (bundle && bundle.locale) || {};
  document.title = bundleName + " — OKF v0.3 Viewer";
  document.getElementById("bundle-name").textContent = bundleName;

  const typeSelect = document.getElementById("filter-type");
  for (const t of bundle.types) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  }

  const backlinks = {};
  for (const edge of bundle.edges) {
    const { source, target } = edge.data;
    (backlinks[target] ||= []).push(source);
  }

  var nodeIndex = {};
  for (const n of bundle.nodes) nodeIndex[n.data.id] = n.data;

  const noopCollection = {
    unselect: () => {},
    removeClass: () => {},
    forEach: () => {},
    select: () => {},
  };
  const cy =
    typeof cytoscape === "function"
      ? cytoscape({
          container: document.getElementById("graph"),
          elements: [...bundle.nodes, ...bundle.edges],
          style: [
            {
              selector: "node",
              style: {
                "background-color": "data(color)",
                "label": "data(label)",
                "color": "#0f172a",
                "font-size": 11,
                "text-valign": "bottom",
                "text-margin-y": 4,
                "text-wrap": "wrap",
                "text-max-width": 120,
                "width": "data(size)",
                "height": "data(size)",
                "border-width": 1,
                "border-color": "#0f172a",
              },
            },
            {
              selector: "node[?stale]",
              style: {
                "border-width": 2,
                "border-color": "#b91c1c",
                "border-style": "dashed",
              },
            },
            {
              selector: 'node[status = "deprecated"]',
              style: { "opacity": 0.55 },
            },
            {
              selector: "node:selected",
              style: {
                "border-width": 3,
                "border-color": "#f59e0b",
              },
            },
            {
              selector: "edge",
              style: {
                "width": 1.5,
                "line-color": "#cbd5e1",
                "target-arrow-color": "#cbd5e1",
                "target-arrow-shape": "triangle",
                "curve-style": "bezier",
                "arrow-scale": 0.9,
              },
            },
            {
              selector: "edge:selected",
              style: {
                "line-color": "#f59e0b",
                "target-arrow-color": "#f59e0b",
                "width": 2.5,
              },
            },
            {
              selector: ".dim",
              style: { "opacity": 0.15 },
            },
          ],
          layout: { name: "cose", animate: false, padding: 30 },
          wheelSensitivity: 0.2,
        })
      : createSvgGraphFallback(document.getElementById("graph"), bundle.nodes || [], bundle.edges || []);

  cy.on("tap", "node", (evt) => showDetail(evt.target.id()));
  cy.on("tap", (evt) => {
    if (evt.target === cy) clearSelection();
  });

  document.getElementById("layout").addEventListener("change", (e) => {
    cy.layout({ name: e.target.value, animate: false, padding: 30 }).run();
  });

  document.getElementById("reset").addEventListener("click", () => {
    cy.fit(null, 30);
    clearSelection();
  });

  document.getElementById("search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      cy.elements().removeClass("dim");
      return;
    }
    cy.nodes().forEach((n) => {
      const d = n.data();
      const hay =
        (d.label || "").toLowerCase() + " " +
        d.id.toLowerCase() + " " +
        (d.tags || []).join(" ").toLowerCase();
      n.toggleClass("dim", !hay.includes(q));
    });
    cy.edges().forEach((edge) => {
      const src = edge.source();
      const tgt = edge.target();
      edge.toggleClass("dim", src.hasClass("dim") || tgt.hasClass("dim"));
    });
  });

  document.getElementById("filter-type").addEventListener("change", (e) => {
    const t = e.target.value;
    if (!t) {
      cy.elements().removeClass("dim");
      return;
    }
    cy.nodes().forEach((n) => {
      n.toggleClass("dim", n.data("type") !== t);
    });
    cy.edges().forEach((edge) => {
      edge.toggleClass("dim", edge.source().hasClass("dim") || edge.target().hasClass("dim"));
    });
  });

  function clearSelection() {
    cy.elements().unselect();
    document.getElementById("detail-empty").hidden = false;
    document.getElementById("detail-content").hidden = true;
  }

  function resolveInternalConceptId(href, currentConceptId) {
    if (
      !href ||
      /^[a-z][a-z0-9+.-]*:/i.test(href) ||
      href.startsWith("//") ||
      href.startsWith("#")
    ) {
      return null;
    }
    const rawHref = href.split("#")[0].split("?")[0].trim();
    if (!rawHref) return null;
    let cleanHref = rawHref;
    try {
      cleanHref = decodeURIComponent(rawHref);
    } catch (_e) {
      cleanHref = rawHref;
    }
    if (!cleanHref.endsWith(".md")) return null;
    if (cleanHref.startsWith("/")) {
      const rootId = cleanHref.replace(/^\/+/, "").slice(0, -3);
      if (!rootId || rootId.split("/").some(function (seg) { return seg === ".." || seg.startsWith("."); })) {
        return null;
      }
      return rootId;
    }
    const curParts = String(currentConceptId || "").split("/").filter(Boolean);
    curParts.pop();
    const relParts = cleanHref.slice(0, -3).split("/");
    for (const seg of relParts) {
      if (!seg || seg === ".") continue;
      if (seg === "..") {
        if (curParts.length === 0) return null;
        curParts.pop();
      } else if (seg.startsWith(".")) {
        return null;
      } else {
        curParts.push(seg);
      }
    }
    return curParts.length > 0 ? curParts.join("/") : null;
  }

  function formatSourceDateShort(isoStr) {
    if (!isoStr) return "";
    const s = String(isoStr).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : s;
  }

  function escapeHtmlAttr(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function inferVizSourceMime(src) {
    if (!src) return null;
    let rawMime = String(src.mime_type || src.mimeType || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const rawUrl = String(src.resource || src.url || "").trim();
    const cleanPath = rawUrl ? rawUrl.split("#")[0].split("?")[0].toLowerCase() : "";
    if (!rawMime && rawUrl) {
      if (/\.pdf$/.test(cleanPath) || /[?&](?:format|type|output)=pdf\b/i.test(rawUrl)) {
        rawMime = "application/pdf";
      } else if (/\.xml$|\.xsd$/.test(cleanPath) || /[?&](?:format|type|output)=xml\b/i.test(rawUrl)) {
        rawMime = "application/xml";
      } else if (/\.json$|\.jsonl$|\.geojson$/.test(cleanPath) || /[?&](?:format|type|output)=json\b/i.test(rawUrl)) {
        rawMime = "application/json";
      } else if (/\.csv$|\.tsv$/.test(cleanPath)) {
        rawMime = "text/csv";
      } else if (/\.bz2$/.test(cleanPath)) {
        rawMime = "application/x-bzip2";
      } else if (/\.gz$|\.tgz$/.test(cleanPath)) {
        rawMime = "application/gzip";
      } else if (/\.zip$/.test(cleanPath)) {
        rawMime = "application/zip";
      } else if (/\.tar$/.test(cleanPath)) {
        rawMime = "application/x-tar";
      } else if (/\.xz$|\.txz$/.test(cleanPath)) {
        rawMime = "application/x-xz";
      } else if (/\.zst$/.test(cleanPath)) {
        rawMime = "application/zstd";
      } else if (/\.7z$/.test(cleanPath)) {
        rawMime = "application/x-7z-compressed";
      } else if (/\.parquet$/.test(cleanPath)) {
        rawMime = "application/vnd.apache.parquet";
      } else if (/\.md$/.test(cleanPath)) {
        rawMime = "text/markdown";
      } else if (/\.docx$/.test(cleanPath)) {
        rawMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (/\.xlsx$/.test(cleanPath)) {
        rawMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else if (/^https?:\/\//i.test(rawUrl)) {
        rawMime = "text/html";
      }
    }
    if (!rawMime) return null;
    if (rawMime === "application/pdf") {
      return { mime: rawMime, label: "📄 PDF · application/pdf", cls: "mime-pdf" };
    }
    if (rawMime === "text/html" || rawMime === "application/xhtml+xml") {
      return { mime: rawMime, label: "🌐 HTML · " + rawMime, cls: "mime-html" };
    }
    if (
      rawMime === "application/xml" ||
      rawMime === "text/xml" ||
      rawMime === "application/json" ||
      rawMime === "application/x-ndjson" ||
      rawMime === "application/geo+json" ||
      rawMime === "text/csv" ||
      rawMime === "text/tab-separated-values" ||
      rawMime === "application/x-bzip2" ||
      rawMime === "application/gzip" ||
      rawMime === "application/zip" ||
      rawMime === "application/x-tar" ||
      rawMime === "application/x-xz" ||
      rawMime === "application/zstd" ||
      rawMime === "application/x-7z-compressed" ||
      rawMime === "application/vnd.apache.parquet"
    ) {
      let shortTag = "DATA";
      if (rawMime.indexOf("xml") !== -1) shortTag = "XML";
      else if (rawMime.indexOf("json") !== -1) shortTag = "JSON";
      else if (rawMime.indexOf("csv") !== -1 || rawMime.indexOf("tab-separated") !== -1) shortTag = "CSV";
      else if (rawMime === "application/x-bzip2") shortTag = /\.tar\.bz2$/.test(cleanPath) ? "TAR.BZ2" : "BZ2";
      else if (rawMime === "application/gzip") shortTag = /\.(?:tar\.gz|tgz)$/.test(cleanPath) ? "TAR.GZ" : "GZIP";
      else if (rawMime === "application/zip") shortTag = "ZIP";
      else if (rawMime === "application/x-tar") shortTag = "TAR";
      else if (rawMime === "application/x-xz") shortTag = /\.(?:tar\.xz|txz)$/.test(cleanPath) ? "TAR.XZ" : "XZ";
      else if (rawMime === "application/zstd") shortTag = "ZSTD";
      else if (rawMime === "application/x-7z-compressed") shortTag = "7Z";
      else if (rawMime === "application/vnd.apache.parquet") shortTag = "PARQUET";
      return { mime: rawMime, label: "🗂️ " + shortTag + " · " + rawMime, cls: "mime-data" };
    }
    return { mime: rawMime, label: "📝 " + rawMime, cls: "mime-doc" };
  }

  function renderSourceBadgesHtml(src) {
    if (!src) return "";
    let out = "";
    const mimeInfo = inferVizSourceMime(src);
    if (mimeInfo) {
      out +=
        ' <span class="src-badge ' +
        escapeHtmlAttr(mimeInfo.cls) +
        '" title="MIME ' +
        escapeHtmlAttr(mimeInfo.mime) +
        '">' +
        escapeHtmlAttr(mimeInfo.label) +
        "</span>";
    }
    if (src.retrieved_at) {
      const shortDate = formatSourceDateShort(src.retrieved_at);
      out +=
        ' <span class="src-badge retrieved" title="Retrieved at ' +
        escapeHtmlAttr(src.retrieved_at) +
        '">retrieved ' +
        escapeHtmlAttr(shortDate) +
        "</span>";
    }
    if (src.last_modified) {
      const shortMod = formatSourceDateShort(src.last_modified);
      out +=
        ' <span class="src-badge modified" title="Last-Modified ' +
        escapeHtmlAttr(src.last_modified) +
        '">last_modified ' +
        escapeHtmlAttr(shortMod) +
        "</span>";
    }
    return out;
  }

  function appendSourceBadges(container, src) {
    if (!src) return;
    const mimeInfo = inferVizSourceMime(src);
    if (mimeInfo) {
      const mb = document.createElement("span");
      mb.className = "src-badge " + mimeInfo.cls;
      mb.title = "MIME " + mimeInfo.mime;
      mb.textContent = mimeInfo.label;
      container.appendChild(document.createTextNode(" "));
      container.appendChild(mb);
    }
    if (src.retrieved_at) {
      const b = document.createElement("span");
      b.className = "src-badge retrieved";
      b.title = "Retrieved at " + src.retrieved_at;
      b.textContent = "retrieved " + formatSourceDateShort(src.retrieved_at);
      container.appendChild(document.createTextNode(" "));
      container.appendChild(b);
    }
    if (src.last_modified) {
      const b = document.createElement("span");
      b.className = "src-badge modified";
      b.title = "Last-Modified " + src.last_modified;
      b.textContent = "last_modified " + formatSourceDateShort(src.last_modified);
      container.appendChild(document.createTextNode(" "));
      container.appendChild(b);
    }
  }

  function parseBuiltInVizMarkdown(rawMd) {
    const stash = [];
    function putStash(htmlFrag) {
      const idx = stash.length;
      stash.push(htmlFrag);
      return "\x00STASH_" + idx + "\x00";
    }
    let text = String(rawMd || "").replace(/\r\n/g, "\n");
    text = text.replace(
      /<sup class="fn-ref[^"]*"><a [^>]+>\[[^\]]+\]<\/a><\/sup>|<(?:sub|sup|code)>[^<]*<\/(?:sub|sup|code)>|<a href="[^"]+"><code>[^<]+<\/code><\/a>/g,
      function (m) { return putStash(m); }
    );
    const fenceStash = [];
    text = text.replace(/^\x60\x60\x60[^\n]*\n([\s\S]*?)^\x60\x60\x60\s*$/gm, function (_m, codeBody) {
      const idx = fenceStash.length;
      fenceStash.push("<pre><code>" + escapeHtmlAttr(codeBody.replace(/\n$/, "")) + "</code></pre>");
      return "\x00FENCE_" + idx + "\x00";
    });
    function formatInline(s) {
      let line = String(s || "");
      line = line.replace(/\x60(\/[A-Za-z0-9_\-\/]+\.md)\x60/g, function (_m, p) {
        return putStash('<a href="' + escapeHtmlAttr(p) + '"><code>' + escapeHtmlAttr(p) + "</code></a>");
      });
      line = line.replace(/\x60([^\x60\n]+)\x60/g, function (_m, code) {
        return putStash("<code>" + escapeHtmlAttr(code) + "</code>");
      });
      line = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      line = line.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, lbl, rawHref) {
        const cleanHref = rawHref.replace(/&amp;/g, "&");
        const isExt = /^https?:\/\//i.test(cleanHref);
        const safeHref = /^(?:https?:\/\/|mailto:|\/|\.\/|\.\.\/|#|[A-Za-z0-9_\-\/]+\.md)/i.test(cleanHref)
          ? escapeHtmlAttr(cleanHref)
          : "#";
        const extAttrs = isExt ? ' class="external" target="_blank" rel="noopener noreferrer"' : "";
        return putStash("<a" + extAttrs + ' href="' + safeHref + '">' + formatInline(lbl.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")) + "</a>");
      });
      line = line
        .replace(/\*\*\*([^*\n]+?)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[\s(])__([^_\n]+?)__(?=$|[\s).,;:!?])/g, "$1<strong>$2</strong>")
        .replace(/(^|[^*])\*([^\s*][^*\n]*?)\*(?!\*)/g, "$1<em>$2</em>")
        .replace(/(^|[\s(])_([^\s_][^_\n]*?)_(?=$|[\s).,;:!?])/g, "$1<em>$2</em>")
        .replace(/~~([^~\n]+?)~~/g, "<del>$1</del>");
      for (let pass = 0; pass < 3; pass++) {
        if (line.indexOf("\x00STASH_") === -1) break;
        line = line.replace(/\x00STASH_(\d+)\x00/g, function (_m, n) {
          return stash[Number(n)] || "";
        });
      }
      return line;
    }
    const lines = text.split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      if (!trimmed) { i++; continue; }
      const fenceM = trimmed.match(/^\x00FENCE_(\d+)\x00$/);
      if (fenceM) { out.push(fenceStash[Number(fenceM[1])] || ""); i++; continue; }
      if (/^(?:---+|\*\*\*+|___+)$/.test(trimmed)) { out.push("<hr>"); i++; continue; }
      const hM = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (hM) {
        const lvl = hM[1].length;
        out.push("<h" + lvl + ">" + formatInline(hM[2]) + "</h" + lvl + ">");
        i++;
        continue;
      }
      if (
        trimmed.indexOf("|") !== -1 &&
        i + 1 < lines.length &&
        /^\s*\|?\s*:?-{2,}:?(?:\s*\|\s*:?-{2,}:?)+\s*\|?\s*$/.test(lines[i + 1])
      ) {
        const splitCells = function (rowStr) {
          return rowStr.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.trim(); });
        };
        const headers = splitCells(rawLine);
        i += 2;
        let tbl = "<table><thead><tr>" + headers.map(function (h) { return "<th>" + formatInline(h) + "</th>"; }).join("") + "</tr></thead><tbody>";
        while (i < lines.length && lines[i].trim() && lines[i].indexOf("|") !== -1) {
          const cells = splitCells(lines[i]);
          tbl += "<tr>" + headers.map(function (_h, cIdx) { return "<td>" + formatInline(cells[cIdx] || "") + "</td>"; }).join("") + "</tr>";
          i++;
        }
        tbl += "</tbody></table>";
        out.push(tbl);
        continue;
      }
      if (/^>\s?/.test(trimmed)) {
        const qLines = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          qLines.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        out.push("<blockquote>" + parseBuiltInVizMarkdown(qLines.join("\n")) + "</blockquote>");
        continue;
      }
      const listM = rawLine.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (listM) {
        const renderListBlock = function (baseIndent) {
          const firstM = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
          const isOrd = /^\d/.test(firstM[2]);
          const tag = isOrd ? "ol" : "ul";
          let listHtml = "<" + tag + ">";
          while (i < lines.length) {
            if (!lines[i].trim()) {
              if (i + 1 < lines.length && /^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i + 1])) { i++; continue; }
              break;
            }
            const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
            if (!m) break;
            const ind = m[1].length;
            if (ind < baseIndent) break;
            if (ind > baseIndent) {
              listHtml = listHtml.replace(/<\/li>$/, "") + renderListBlock(ind) + "</li>";
              continue;
            }
            let itemBody = m[3];
            const taskM = itemBody.match(/^\[([ xX])\]\s+(.*)$/);
            let prefix = "";
            if (taskM) {
              prefix = '<input type="checkbox" disabled' + (taskM[1].toLowerCase() === "x" ? " checked" : "") + "> ";
              itemBody = taskM[2];
            }
            i++;
            while (
              i < lines.length &&
              lines[i].trim() &&
              !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) &&
              !/^\s*(?:#{1,6}\s+|---+|\*\*\*+|>|\x60\x60\x60|\x00FENCE_)/.test(lines[i])
            ) {
              itemBody += " " + lines[i].trim();
              i++;
            }
            let subHtml = "";
            if (i < lines.length) {
              const nextM = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+/);
              if (nextM && nextM[1].length > baseIndent) {
                subHtml = renderListBlock(nextM[1].length);
              }
            }
            listHtml += "<li>" + prefix + formatInline(itemBody) + subHtml + "</li>";
          }
          listHtml += "</" + tag + ">";
          return listHtml;
        };
        out.push(renderListBlock(listM[1].length));
        continue;
      }
      const pLines = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^\s*(?:#{1,6}\s+|---+|\*\*\*+|___+|>\s?|[-*+]\s+|\d+[.)]\s+|\x00FENCE_)/.test(lines[i]) &&
        !(lines[i].indexOf("|") !== -1 && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?(?:\s*\|\s*:?-{2,}:?)+\s*\|?\s*$/.test(lines[i + 1]))
      ) {
        pLines.push(lines[i].trim());
        i++;
      }
      if (pLines.length > 0) {
        out.push("<p>" + formatInline(pLines.join(" ")) + "</p>");
      } else {
        i++;
      }
    }
    return out.join("\n");
  }

  function createSvgGraphFallback(container, nodes, edges) {
    const tapNodeHandlers = [];
    const tapBgHandlers = [];
    const nodeWrappers = {};
    const edgeWrappers = [];
    let selectedId = null;
    const ns = "http://www.w3.org/2000/svg";
    const W = 820;
    const H = 560;
    const svg = container ? document.createElementNS(ns, "svg") : null;
    if (svg && container) {
      container.innerHTML = "";
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.display = "block";
      svg.style.userSelect = "none";
      const concepts = nodes.filter(function (n) { return n && n.data && n.data.group !== "source"; });
      const sources = nodes.filter(function (n) { return n && n.data && n.data.group === "source"; });
      const posById = {};
      concepts.forEach(function (c, idx) {
        if (concepts.length === 1) {
          posById[c.data.id] = { x: W / 2, y: H / 2 };
        } else {
          const ang = (2 * Math.PI * idx) / concepts.length - Math.PI / 2;
          posById[c.data.id] = { x: W / 2 + 115 * Math.cos(ang), y: H / 2 + 95 * Math.sin(ang) };
        }
      });
      sources.forEach(function (s, idx) {
        const ang = (2 * Math.PI * idx) / Math.max(1, sources.length) - Math.PI / 2;
        posById[s.data.id] = { x: W / 2 + 300 * Math.cos(ang), y: H / 2 + 215 * Math.sin(ang) };
      });
      const edgeGroup = document.createElementNS(ns, "g");
      const nodeGroup = document.createElementNS(ns, "g");
      svg.appendChild(edgeGroup);
      svg.appendChild(nodeGroup);

      nodes.forEach(function (n) {
        if (!n || !n.data) return;
        const d = n.data;
        const p = posById[d.id] || { x: W / 2, y: H / 2 };
        const g = document.createElementNS(ns, "g");
        g.style.cursor = "pointer";
        const r = Math.max(11, Math.min(24, Number(d.size || 24) / 2));
        const circle = document.createElementNS(ns, "circle");
        circle.setAttribute("cx", String(p.x));
        circle.setAttribute("cy", String(p.y));
        circle.setAttribute("r", String(r));
        circle.setAttribute("fill", d.color || "#0284c7");
        circle.setAttribute("stroke", "#0f172a");
        circle.setAttribute("stroke-width", "1.5");
        const label = document.createElementNS(ns, "text");
        label.setAttribute("x", String(p.x));
        label.setAttribute("y", String(p.y + r + 13));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-size", "10.5");
        label.setAttribute("fill", "#0f172a");
        const rawLbl = String(d.label || d.id || "");
        label.textContent = rawLbl.length > 26 ? rawLbl.slice(0, 25) + "…" : rawLbl;
        g.appendChild(circle);
        g.appendChild(label);
        nodeGroup.appendChild(g);
        let dimmed = false;
        const wrapper = {
          id: function () { return d.id; },
          data: function (k) { return k ? d[k] : d; },
          hasClass: function (cls) { return cls === "dim" ? dimmed : false; },
          toggleClass: function (cls, state) {
            if (cls === "dim") {
              dimmed = Boolean(state);
              g.style.opacity = dimmed ? "0.15" : "1";
            }
          },
          removeClass: function (cls) {
            if (cls === "dim") { dimmed = false; g.style.opacity = "1"; }
          },
          select: function () {
            selectedId = d.id;
            Object.keys(nodeWrappers).forEach(function (k) {
              const nw = nodeWrappers[k];
              nw._circle.setAttribute("stroke", k === selectedId ? "#f59e0b" : "#0f172a");
              nw._circle.setAttribute("stroke-width", k === selectedId ? "3.5" : "1.5");
            });
          },
          _circle: circle,
        };
        nodeWrappers[d.id] = wrapper;
        g.addEventListener("click", function (ev) {
          ev.stopPropagation();
          tapNodeHandlers.forEach(function (fn) { fn({ target: wrapper }); });
        });
      });

      edges.forEach(function (e) {
        if (!e || !e.data) return;
        const sp = posById[e.data.source];
        const tp = posById[e.data.target];
        if (!sp || !tp) return;
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", String(sp.x));
        line.setAttribute("y1", String(sp.y));
        line.setAttribute("x2", String(tp.x));
        line.setAttribute("y2", String(tp.y));
        line.setAttribute("stroke", "#cbd5e1");
        line.setAttribute("stroke-width", "1.5");
        edgeGroup.appendChild(line);
        edgeWrappers.push({
          source: function () { return nodeWrappers[e.data.source] || { hasClass: function () { return false; } }; },
          target: function () { return nodeWrappers[e.data.target] || { hasClass: function () { return false; } }; },
          toggleClass: function (cls, state) {
            if (cls === "dim") line.style.opacity = state ? "0.15" : "1";
          },
          removeClass: function (cls) {
            if (cls === "dim") line.style.opacity = "1";
          },
        });
      });

      svg.addEventListener("click", function () {
        tapBgHandlers.forEach(function (fn) { fn({ target: api }); });
      });
      container.appendChild(svg);
    }
    const api = {
      on: function (evtName, selOrFn, maybeFn) {
        if (evtName === "tap" && selOrFn === "node" && typeof maybeFn === "function") {
          tapNodeHandlers.push(maybeFn);
        } else if (evtName === "tap" && typeof selOrFn === "function") {
          tapBgHandlers.push(selOrFn);
        }
      },
      layout: function () { return { run: function () {} }; },
      fit: function () {},
      elements: function () {
        return {
          unselect: function () {
            selectedId = null;
            Object.keys(nodeWrappers).forEach(function (k) {
              nodeWrappers[k]._circle.setAttribute("stroke", "#0f172a");
              nodeWrappers[k]._circle.setAttribute("stroke-width", "1.5");
            });
          },
          removeClass: function (cls) {
            Object.keys(nodeWrappers).forEach(function (k) { nodeWrappers[k].removeClass(cls); });
            edgeWrappers.forEach(function (ew) { ew.removeClass(cls); });
          },
        };
      },
      nodes: function () {
        return {
          forEach: function (fn) {
            Object.keys(nodeWrappers).forEach(function (k) { fn(nodeWrappers[k]); });
          },
        };
      },
      edges: function () {
        return {
          forEach: function (fn) { edgeWrappers.forEach(fn); },
        };
      },
      getElementById: function (id) {
        return nodeWrappers[id] || noopCollection;
      },
      animate: function () {},
      zoom: function () { return 1; },
    };
    return api;
  }

  function renderMarkdownWithOkfFootnotes(rawBody, sources) {
    const srcById = {};
    for (const s of sources || []) {
      if (s && s.id) srcById[s.id] = s;
    }
    const fnDefs = [];
    const seenFnIds = {};
    const bodyLines = [];
    for (const line of String(rawBody || "").split(/\r?\n/)) {
      const m = line.trim().match(/^\[\^([A-Za-z0-9_\-]+)\]:\s*(.+)$/);
      if (m) {
        seenFnIds[m[1]] = true;
        fnDefs.push({ id: m[1], label: m[2] });
      } else {
        bodyLines.push(line);
      }
    }
    const joinedBody = bodyLines
      .join("\n")
      .replace(/^\s*#\s+[^\r\n]+(?:\r?\n+---(?=\r?\n|$))?\r?\n*/, "")
      .replace(/\r?\n+---\s*$/g, "")
      .replace(/(?:\r?\n+---)?\r?\n+#{2,4}\s+[^\r\n]+(?:\r?\n+---)?\s*$/, "")
      .replace(/\r?\n+---\s*$/g, "");
    const inlineMatches = joinedBody.matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g);
    for (const im of inlineMatches) {
      const cid = im[1];
      if (!seenFnIds[cid] && srcById[cid]) {
        seenFnIds[cid] = true;
        fnDefs.push({
          id: cid,
          label: srcById[cid].title || srcById[cid].resource || cid,
        });
      }
    }
    const supMap = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ" };
    const subMap = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ" };
    const bodyWithMath = replaceInlineLatexSpans(joinedBody, function (_, inner) {
      let cleaned = String(inner)
        .replace(/\\(?:left|right)\s*([()[\]|.])?/g, "$1")
        .replace(/\\mathcal\{R\}/g, "ℛ")
        .replace(/\\mathcal\{([A-Za-z0-9]+)\}/g, "$1")
        .replace(/\\(?:[,;:]|\s+|quad\b|qquad\b)/g, " ")
        .replace(/~/g, " ")
        .replace(/\\!/g, "")
        .replace(/\\sim(?![a-zA-Z])/g, "~")
        .replace(/\\leftrightarrow/g, "↔")
        .replace(/\\Leftrightarrow|\\iff(?![a-zA-Z])/g, "⇔")
        .replace(/\\rightarrow|\\to(?![a-zA-Z])/g, "→")
        .replace(/\\Rightarrow|\\implies(?![a-zA-Z])/g, "⇒")
        .replace(/\\leftarrow/g, "←")
        .replace(/\\Leftarrow/g, "⇐")
        .replace(/\\(?:ge|geq)(?![a-zA-Z])/g, "≥")
        .replace(/\\(?:le|leq)(?![a-zA-Z])/g, "≤")
        .replace(/\\(?:neq|ne)(?![a-zA-Z])/g, "≠")
        .replace(/\\approx(?![a-zA-Z])/g, "≈")
        .replace(/\\times(?![a-zA-Z])/g, "×")
        .replace(/\\div(?![a-zA-Z])/g, "÷")
        .replace(/\\pm(?![a-zA-Z])/g, "±")
        .replace(/\\cdot(?![a-zA-Z])/g, "·")
        .replace(/\\(?:dots|ldots|cdots)(?![a-zA-Z])/g, "…")
        .replace(/\\infty(?![a-zA-Z])/g, "∞")
        .replace(/\\sum(?![a-zA-Z])/g, "∑")
        .replace(/\\prod(?![a-zA-Z])/g, "∏")
        .replace(/\\int(?![a-zA-Z])/g, "∫")
        .replace(/\\partial(?![a-zA-Z])/g, "∂")
        .replace(/\\nabla(?![a-zA-Z])/g, "∇")
        .replace(/\\propto(?![a-zA-Z])/g, "∝")
        .replace(/\\perp(?![a-zA-Z])/g, "⊥")
        .replace(/\\parallel(?![a-zA-Z])/g, "∥")
        .replace(/\\Delta\s+([a-zA-Z])(?![a-zA-Z])/g, "Δ$1")
        .replace(/\\Delta(?![a-zA-Z])/g, "Δ")
        .replace(/\\delta(?![a-zA-Z])/g, "δ")
        .replace(/\\mu(?![a-zA-Z])/g, "μ")
        .replace(/\\Omega(?![a-zA-Z])/g, "Ω")
        .replace(/\\omega(?![a-zA-Z])/g, "ω")
        .replace(/\\alpha(?![a-zA-Z])/g, "α")
        .replace(/\\beta(?![a-zA-Z])/g, "β")
        .replace(/\\gamma(?![a-zA-Z])/g, "γ")
        .replace(/\\lambda(?![a-zA-Z])/g, "λ")
        .replace(/\\pi(?![a-zA-Z])/g, "π")
        .replace(/\\sigma(?![a-zA-Z])/g, "σ")
        .replace(/\\rho(?![a-zA-Z])/g, "ρ")
        .replace(/\\theta(?![a-zA-Z])/g, "θ")
        .replace(/\\tau(?![a-zA-Z])/g, "τ")
        .replace(/\\phi(?![a-zA-Z])|\\varphi(?![a-zA-Z])/g, "φ")
        .replace(/\\eta(?![a-zA-Z])/g, "η")
        .replace(/\\kappa(?![a-zA-Z])/g, "κ")
        .replace(/\\epsilon(?![a-zA-Z])|\\varepsilon(?![a-zA-Z])/g, "ε")
        .replace(/\\(?:ln|exp|log|sin|cos|tan|min|max|lim|sup|inf)(?![a-zA-Z])/g, function (m) {
          return m.slice(1);
        })
        .replace(/\\(?:circ|degree)(?![a-z])/g, "°")
        .replace(/\\(?:xrightleftharpoons|rightleftharpoons)(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, "⇌")
        .replace(/\\(?:xrightarrow|xleftarrow)(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, "→")
        .replace(/\\([$&%_#])/g, "$1");
      for (let pass = 0; pass < 3; pass++) {
        cleaned = cleaned
          .replace(/\\(?:text|mathrm|textbf|textit|mathit|mathsf|emph|operatorname)\{([^{}]*)\}/g, "$1")
          .replace(/\\sqrt\{\s*([^{}]+?)\s*\}/g, "√($1)")
          .replace(/\\(?:overline|hat|bar|tilde|vec)\{\s*([^{}]+?)\s*\}/g, "$1")
          .replace(/\^\{\s*(?:°|o)\s*([CFK])?\s*\}|\^°/g, "°$1")
          .replace(/\^\{\s*([0-9+\-=()a-pr-z]+)\s*\}|\^([0-9+\-a-pr-z])(?![a-zA-Z0-9])/g, function (_m, b, s) {
            return String(b || s).replace(/[0-9+\-=()a-pr-z]/g, function (d) {
              return supMap[d] || d;
            });
          })
          .replace(/_\{\s*([+-]?[0-9]+|[+-=()]+)\s*\}|_([+-]?[0-9])(?![0-9])/g, function (_m, b, s) {
            return String(b || s).replace(/[0-9+\-=()]/g, function (d) {
              return subMap[d] || d;
            });
          })
          .replace(/_\{\s*([aehijklmnoprstuvx]+)\s*\}|_([aehijklmnoprstuvx])(?![a-zA-Z0-9])/g, function (_m, b, s) {
            return String(b || s).replace(/[aehijklmnoprstuvx]/g, function (d) {
              return subMap[d] || d;
            });
          })
          .replace(/_\{\s*([^{}]+?)\s*\}/g, function (_m, sub) {
            return "<sub>" + escapeHtmlAttr(sub) + "</sub>";
          })
          .replace(/\^\{\s*([^{}]+?)\s*\}/g, function (_m, sup) {
            return "<sup>" + escapeHtmlAttr(sup) + "</sup>";
          })
          .replace(/\\frac\{\s*([^{}]+?)\s*\}\{\s*([^{}]+?)\s*\}/g, "$1/$2");
      }
      cleaned = cleaned
        .replace(/\\([{}])/g, "$1")
        .replace(/_([a-zA-Z0-9()])(?![a-zA-Z0-9])/g, "<sub>$1</sub>")
        .replace(/\^([a-zA-Z0-9()])(?![a-zA-Z0-9])/g, "<sup>$1</sup>")
        .replace(/\s+/g, " ")
        .trim();
      if (!/[\\{}^_]/.test(cleaned)) {
        return cleaned;
      }
      return "<code>" + escapeHtmlAttr(cleaned) + "</code>";
    });
    const bodyWithSup = bodyWithMath.replace(
      /\[\^([A-Za-z0-9_\-]+)\]/g,
      '<sup class="fn-ref"><a href="#fn-$1" data-fn="$1">[$1]</a></sup>'
    );
    let html =
      typeof marked !== "undefined" && marked && typeof marked.parse === "function"
        ? marked.parse(bodyWithSup, { breaks: false, gfm: true })
        : parseBuiltInVizMarkdown(bodyWithSup);
    if (fnDefs.length > 0) {
      const items = fnDefs
        .map((fn) => {
          const src = srcById[fn.id];
          const url = src && src.resource && /^https?:\/\//.test(src.resource) ? src.resource : null;
          const text = url
            ? '<a class="external" target="_blank" rel="noopener" href="' +
              escapeHtmlAttr(url) +
              '">' +
              escapeHtmlAttr(fn.label) +
              "</a>"
            : escapeHtmlAttr(fn.label);
          const badges = renderSourceBadgesHtml(src);
          return '<li id="fn-' + escapeHtmlAttr(fn.id) + '"><code>[' + escapeHtmlAttr(fn.id) + "]</code> " + text + badges + "</li>";
        })
        .join("");
      html += '<section class="footnotes"><ul>' + items + "</ul></section>";
    }
    return html;
  }

  const fallbackPalette = ["#0284c7", "#e11d48", "#059669", "#ea580c", "#4f46e5", "#0891b2", "#c026d3", "#65a30d", "#dc2626", "#9333ea", "#ca8a04", "#0f766e"];
  function getTypeColor(type) {
    const clean = String(type || "").trim();
    if (!clean || clean.toLowerCase() === "unknown") return "#64748b";
    if (bundle.palette && bundle.palette[clean]) return bundle.palette[clean];
    let hash = 2166136261;
    for (let i = 0; i < clean.length; i++) {
      hash ^= clean.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return fallbackPalette[(hash >>> 0) % fallbackPalette.length];
  }

  let lastConceptId = null;

  function showDetail(conceptId) {
    const data = nodeIndex[conceptId];
    if (!data) return;
    const isSourceNode = data.group === "source" || String(conceptId).startsWith("source:");
    if (!isSourceNode) {
      lastConceptId = conceptId;
    }
    cy.elements().unselect();
    const node = cy.getElementById(conceptId);
    if (node) node.select();

    document.getElementById("detail-empty").hidden = true;
    const content = document.getElementById("detail-content");
    content.hidden = false;

    const chip = document.getElementById("detail-type");
    chip.textContent = data.type;
    chip.style.background = data.color || getTypeColor(data.type);

    document.getElementById("detail-title").textContent = data.fullTitle || data.label;
    document.getElementById("detail-id").textContent = conceptId;
    document.getElementById("detail-description").textContent = data.description || "—";

    const resourceEl = document.getElementById("detail-resource");
    resourceEl.innerHTML = "";
    if (data.resource) {
      const a = document.createElement("a");
      a.href = data.resource;
      a.textContent = data.resource;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "external";
      resourceEl.appendChild(a);
    } else {
      resourceEl.textContent = "—";
    }

    const tagsEl = document.getElementById("detail-tags");
    tagsEl.innerHTML = "";
    if (data.tags && data.tags.length) {
      for (const t of data.tags) {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
        tagsEl.appendChild(span);
      }
    } else {
      tagsEl.textContent = "—";
    }

    const badgesEl = document.getElementById("detail-badges");
    badgesEl.innerHTML = "";
    const status = data.status || "stable";
    badgesEl.appendChild(makeBadge(status, "status-" + status));
    const tier = data.trust_tier || "unverified";
    badgesEl.appendChild(makeBadge(tier.replace(/-/g, " "), "trust-" + tier));
    if (data.stale) {
      const label = data.stale_after ? "stale (since " + data.stale_after + ")" : "stale";
      badgesEl.appendChild(makeBadge(label, "stale"));
    } else if (data.stale_after) {
      badgesEl.appendChild(makeBadge("stale after " + data.stale_after, "fresh"));
    }

    document.getElementById("detail-generated").textContent = formatActorEvent(data.generated);

    const verifiedEl = document.getElementById("detail-verified");
    const verified = data.verified || [];
    if (verified.length) {
      verifiedEl.textContent = verified.map(formatActorEvent).join("; ");
    } else {
      verifiedEl.textContent = "—";
    }

    const sourcesEl = document.getElementById("detail-sources");
    sourcesEl.innerHTML = "";
    const sources = data.sources || [];
    if (sources.length) {
      const ul = document.createElement("ul");
      ul.className = "sources-list";
      for (const s of sources) {
        const li = document.createElement("li");
        const label = s.title || s.resource || s.id || "source";
        const idPrefix = s.id ? "[" + s.id + "] " : "";
        if (s.resource && /^https?:\/\//.test(s.resource)) {
          const a = document.createElement("a");
          a.href = s.resource;
          a.textContent = idPrefix + label;
          a.target = "_blank";
          a.rel = "noopener";
          a.className = "external";
          li.appendChild(a);
        } else {
          li.textContent = s.resource ? idPrefix + label + " (" + s.resource + ")" : idPrefix + label;
        }
        appendSourceBadges(li, s);
        ul.appendChild(li);
      }
      sourcesEl.appendChild(ul);
    } else {
      sourcesEl.textContent = "—";
    }

    const body = bundle.bodies[conceptId] || "";
    const html = renderMarkdownWithOkfFootnotes(body, sources);
    const bodyEl = document.getElementById("detail-body");
    const backBtnLabel = escapeHtmlAttr(uiLocale.backToConcept || "← Back to concept");
    if (isSourceNode) {
      bodyEl.innerHTML =
        '<div style="margin-bottom:10px"><button type="button" id="viz-source-back-btn" style="cursor:pointer;padding:4px 10px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;font-size:12px;font-weight:600">' +
        backBtnLabel +
        "</button></div>" +
        html;
      const srcBackBtn = document.getElementById("viz-source-back-btn");
      if (srcBackBtn) {
        const targetConcept =
          lastConceptId ||
          data.parentConceptId ||
          (backlinks[conceptId] && backlinks[conceptId][0]) ||
          (bundle.nodes[0] && bundle.nodes[0].data.id);
        srcBackBtn.addEventListener("click", () => {
          if (targetConcept) showDetail(targetConcept);
        });
      }
    } else {
      bodyEl.innerHTML = html;
    }
    rewriteInternalLinks(bodyEl, conceptId);

    const bl = backlinks[conceptId] || [];
    const blSection = document.getElementById("detail-backlinks");
    const blList = document.getElementById("backlinks-list");
    blList.innerHTML = "";
    if (bl.length) {
      blSection.hidden = false;
      for (const src of bl) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.textContent = nodeIndex[src]?.label || src;
        a.dataset.target = src;
        a.addEventListener("click", () => showDetail(src));
        li.appendChild(a);
        const muted = document.createElement("span");
        muted.className = "muted";
        muted.textContent = " (" + src + ")";
        li.appendChild(muted);
        blList.appendChild(li);
      }
    } else {
      blSection.hidden = true;
    }

    cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1.0) }, { duration: 200 });
  }

  function makeBadge(text, cls) {
    const span = document.createElement("span");
    span.className = "badge " + cls;
    span.textContent = text;
    return span;
  }

  function formatActorEvent(event) {
    if (!event || !event.by) return "—";
    return event.at ? event.by + " · " + event.at : String(event.by);
  }

  const selectNode = showDetail;

  function rewriteInternalLinks(root, currentConceptId) {
    const sourceNodeByFnId = bundle.sourceNodeByFnId || {};
    const sourceNodeByAnyFnId = bundle.sourceNodeByAnyFnId || {};
    root.querySelectorAll("a[data-fn]").forEach((a) => {
      const fnId = a.getAttribute("data-fn");
      if (!fnId) return;
      a.addEventListener("click", (e) => {
        const srcNodeId =
          (sourceNodeByFnId[currentConceptId] && sourceNodeByFnId[currentConceptId][fnId]) ||
          sourceNodeByAnyFnId[fnId] ||
          "source:" + fnId;
        if (nodeIndex[srcNodeId]) {
          e.preventDefault();
          showDetail(srcNodeId);
        }
      });
    });
    root.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const target = resolveInternalConceptId(href, currentConceptId);
      if (target && nodeIndex[target]) {
        a.className = "internal";
        a.setAttribute("href", "javascript:void(0)");
        a.addEventListener("click", (e) => {
          e.preventDefault();
          showDetail(target);
        });
        return;
      }
      if (target) {
        a.className = "internal stub-link";
        a.style.color = "#f59e0b";
        a.setAttribute("data-internal-href", href);
        a.setAttribute("href", "javascript:void(0)");
        const linkLabel = (a.textContent || target).trim();
        const backBtnLabel = escapeHtmlAttr(uiLocale.backToConcept || "← Back to concept");
        const stubHint = formatVizTpl(
          uiLocale.stubConceptVizHint ||
            'This OKF concept is cross-referenced from <code>{parent}</code>. Run <code>npm run cli:stage1 -- "{label}"</code> to generate and verify this concept in the knowledge bundle.',
          {
            parent: escapeHtmlAttr(currentConceptId),
            label: escapeHtmlAttr(linkLabel),
          }
        );
        a.addEventListener("click", (e) => {
          e.preventDefault();
          const titleEl = document.getElementById("detail-title");
          if (titleEl) titleEl.textContent = linkLabel;
          const idEl = document.getElementById("detail-id");
          if (idEl) idEl.textContent = target;
          const bodyEl = document.getElementById("detail-body");
          if (!bodyEl) return;
          bodyEl.innerHTML =
            '<div style="padding:14px;border:1px solid #fde68a;background:#fefce8;border-radius:8px;margin-bottom:12px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
            '<span class="badge status-draft">Linked Concept (Stub)</span>' +
            '<button type="button" id="viz-stub-back-btn" style="cursor:pointer;padding:4px 10px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;font-size:12px;font-weight:600">' +
            backBtnLabel +
            "</button>" +
            "</div>" +
            "<h2 style='margin:6px 0'>" +
            escapeHtmlAttr(linkLabel) +
            "</h2>" +
            "<p class='muted' style='margin:4px 0'>Concept ID: <code>/" +
            escapeHtmlAttr(target) +
            ".md</code></p>" +
            "<p style='margin:8px 0 0'>" +
            stubHint +
            "</p>" +
            "</div>";
          const backBtn = document.getElementById("viz-stub-back-btn");
          if (backBtn) {
            backBtn.addEventListener("click", () => selectNode(currentConceptId));
          }
        });
        return;
      }
      a.className = "external";
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
  }

  const initial =
    bundle.nodes.find((n) => n.data.group === "concept") ||
    bundle.nodes[0];
  if (initial) showDetail(initial.data.id);
})();
