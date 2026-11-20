(function () {
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

  const VIZ_THEME_STORAGE_KEY = "icm_a2ui_theme";

  function parseVizHexRgb(hex) {
    const m = String(hex || "").trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!m) return null;
    const h =
      m[1].length === 3
        ? m[1][0] + m[1][0] + m[1][1] + m[1][1] + m[1][2] + m[1][2]
        : m[1];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  function computeRelativeLuminance(rgb) {
    function lin(v) {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  }

  function getAccessibleTypeChipBg(rawColor) {
    const rgb = parseVizHexRgb(rawColor);
    if (!rgb) return "#475569";
    const maxLum = 0.155;
    if (computeRelativeLuminance(rgb) <= maxLum) return rawColor;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      const scaled = [
        Math.round(rgb[0] * mid),
        Math.round(rgb[1] * mid),
        Math.round(rgb[2] * mid),
      ];
      if (computeRelativeLuminance(scaled) <= maxLum) lo = mid;
      else hi = mid;
    }
    const out = [
      Math.round(rgb[0] * lo),
      Math.round(rgb[1] * lo),
      Math.round(rgb[2] * lo),
    ];
    return (
      "#" +
      out
        .map(function (c) {
          return Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0");
        })
        .join("")
    );
  }

  function getGraphThemePalette(theme) {
    if (theme === "dark") {
      return {
        canvasBg: "#0b1120",
        nodeLabel: "#f1f5f9",
        nodeOutline: "#0b1120",
        nodeBorder: "#cbd5e1",
        staleBorder: "#f87171",
        selected: "#fbbf24",
        edgeLine: "#475569",
        edgeLabel: "#cbd5e1",
      };
    }
    return {
      canvasBg: "#f8fafc",
      nodeLabel: "#0f172a",
      nodeOutline: "#f8fafc",
      nodeBorder: "#0f172a",
      staleBorder: "#b91c1c",
      selected: "#d97706",
      edgeLine: "#94a3b8",
      edgeLabel: "#334155",
    };
  }

  function buildCytoscapeStyleSheet(theme) {
    const p = getGraphThemePalette(theme);
    return [
      {
        selector: "node",
        style: {
          "background-color": "data(color)",
          "label": "data(label)",
          "color": p.nodeLabel,
          "text-outline-width": 2.5,
          "text-outline-color": p.nodeOutline,
          "text-outline-opacity": 0.94,
          "font-size": 11,
          "font-weight": 500,
          "text-valign": "bottom",
          "text-margin-y": 4,
          "text-wrap": "wrap",
          "text-max-width": 120,
          "width": "data(size)",
          "height": "data(size)",
          "border-width": 1.5,
          "border-color": p.nodeBorder,
        },
      },
      {
        selector: "node[?stale]",
        style: {
          "border-width": 2.5,
          "border-color": p.staleBorder,
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
          "border-color": p.selected,
        },
      },
      {
        selector: "edge",
        style: {
          "width": 1.5,
          "line-color": p.edgeLine,
          "target-arrow-color": p.edgeLine,
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          "arrow-scale": 0.9,
          "color": p.edgeLabel,
          "font-size": 10,
          "text-outline-width": 2,
          "text-outline-color": p.nodeOutline,
          "text-outline-opacity": 0.92,
        },
      },
      {
        selector: "edge:selected",
        style: {
          "line-color": p.selected,
          "target-arrow-color": p.selected,
          "width": 2.5,
        },
      },
      {
        selector: ".dim",
        style: { "opacity": 0.15 },
      },
    ];
  }

  function resolveEffectiveVizTheme() {
    if (typeof document !== "undefined" && document.documentElement) {
      const explicit = document.documentElement.getAttribute("data-theme");
      if (explicit === "dark" || explicit === "light") return explicit;
    }
    try {
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem(VIZ_THEME_STORAGE_KEY) : null;
      if (stored === "dark" || stored === "light") return stored;
    } catch (_e) {
      // Ignore storage access errors in sandboxed contexts
    }
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  }

  if (typeof window !== "undefined" && window.__ICM_TEST_HOOKS__) {
    window.__ICM_TEST_HOOKS__.renderMarkdownWithOkfFootnotes = renderMarkdownWithOkfFootnotes;
    window.__ICM_TEST_HOOKS__.parseBuiltInVizMarkdown = parseBuiltInVizMarkdown;
    window.__ICM_TEST_HOOKS__.isInlineLatexMath = isInlineLatexMath;
    window.__ICM_TEST_HOOKS__.replaceInlineLatexSpans = replaceInlineLatexSpans;
    window.__ICM_TEST_HOOKS__.resolveInternalConceptId = resolveInternalConceptId;
    window.__ICM_TEST_HOOKS__.getAccessibleTypeChipBg = getAccessibleTypeChipBg;
    window.__ICM_TEST_HOOKS__.getGraphThemePalette = getGraphThemePalette;
    window.__ICM_TEST_HOOKS__.buildCytoscapeStyleSheet = buildCytoscapeStyleSheet;
    return;
  }
  const bundle = window.BUNDLE;
  const bundleName = window.BUNDLE_NAME;
  const uiLocale = (bundle && bundle.locale) || {};
  document.title = bundleName + " — OKF v0.3 Viewer";
  document.getElementById("bundle-name").textContent = bundleName;

  try {
    const savedTheme = localStorage.getItem(VIZ_THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  } catch (_e) {
    // Ignore storage access errors
  }

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
  const initialTheme = resolveEffectiveVizTheme();
  const graphContainer = document.getElementById("graph");
  const cy =
    typeof cytoscape === "function"
      ? cytoscape({
          container: graphContainer,
          elements: [...bundle.nodes, ...bundle.edges],
          style: buildCytoscapeStyleSheet(initialTheme),
          layout: { name: "cose", animate: false, padding: 30 },
          wheelSensitivity: 0.2,
        })
      : createSvgGraphFallback(graphContainer, bundle.nodes || [], bundle.edges || [], initialTheme);

  let themeToggleBtn = document.getElementById("theme-toggle");
  if (!themeToggleBtn) {
    const controlsEl = document.querySelector(".controls");
    if (controlsEl) {
      themeToggleBtn = document.createElement("button");
      themeToggleBtn.id = "theme-toggle";
      themeToggleBtn.type = "button";
      themeToggleBtn.className = "theme-toggle-btn";
      controlsEl.appendChild(themeToggleBtn);
    }
  }

  function syncThemeUi(effectiveTheme) {
    if (themeToggleBtn) {
      const isDark = effectiveTheme === "dark";
      const attrLight =
        typeof themeToggleBtn.getAttribute === "function"
          ? String(themeToggleBtn.getAttribute("data-label-light") || "").trim()
          : "";
      const attrDark =
        typeof themeToggleBtn.getAttribute === "function"
          ? String(themeToggleBtn.getAttribute("data-label-dark") || "").trim()
          : "";
      const attrTitle =
        typeof themeToggleBtn.getAttribute === "function"
          ? String(themeToggleBtn.getAttribute("aria-label") || "").trim()
          : "";
      const lightLabel = (uiLocale && uiLocale.themeLightLabel) || attrLight || "☀️ Light";
      const darkLabel = (uiLocale && uiLocale.themeDarkLabel) || attrDark || "🌙 Dark";
      const toggleTitle =
        (uiLocale && uiLocale.themeToggleTitle) ||
        (attrTitle && attrTitle !== "Switch theme" ? attrTitle : "") ||
        "Switch between Light and Dark theme";
      themeToggleBtn.textContent = isDark ? lightLabel : darkLabel;
      themeToggleBtn.title = toggleTitle;
      themeToggleBtn.setAttribute("aria-label", toggleTitle);
      themeToggleBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
    }
    if (cy && typeof cy.style === "function") {
      const s = cy.style();
      if (s && typeof s.fromJson === "function") {
        s.fromJson(buildCytoscapeStyleSheet(effectiveTheme)).update();
      }
    }
    if (cy && typeof cy.setTheme === "function") {
      cy.setTheme(effectiveTheme);
    }
  }

  function setVizTheme(nextTheme, persist) {
    if (nextTheme === "dark" || nextTheme === "light") {
      document.documentElement.setAttribute("data-theme", nextTheme);
      if (persist) {
        try {
          localStorage.setItem(VIZ_THEME_STORAGE_KEY, nextTheme);
        } catch (_e) {
          // Ignore storage write errors
        }
      }
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    syncThemeUi(resolveEffectiveVizTheme());
  }

  syncThemeUi(initialTheme);
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", function () {
      const next = resolveEffectiveVizTheme() === "dark" ? "light" : "dark";
      setVizTheme(next, true);
    });
  }
  if (typeof window !== "undefined") {
    if (typeof window.matchMedia === "function") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onSchemeChange = function () {
        const explicit = document.documentElement.getAttribute("data-theme");
        if (explicit !== "dark" && explicit !== "light") {
          syncThemeUi(resolveEffectiveVizTheme());
        }
      };
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onSchemeChange);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(onSchemeChange);
      }
    }
    window.addEventListener("storage", function (ev) {
      if (ev && ev.key === VIZ_THEME_STORAGE_KEY) {
        if (ev.newValue === "dark" || ev.newValue === "light") {
          setVizTheme(ev.newValue, false);
        } else {
          setVizTheme(null, false);
        }
      }
    });
  }

  function applyTypeFilter(selectedType) {
    if (!selectedType) {
      cy.elements().removeClass("dim");
    } else {
      cy.nodes().forEach(function (n) {
        n.toggleClass("dim", n.data("type") !== selectedType);
      });
      cy.edges().forEach(function (edge) {
        edge.toggleClass("dim", edge.source().hasClass("dim") || edge.target().hasClass("dim"));
      });
    }
    if (legendEl) {
      legendEl.querySelectorAll(".graph-legend-pill").forEach(function (pill) {
        const isAct = pill.getAttribute("data-type") === selectedType && Boolean(selectedType);
        pill.classList.toggle("is-active", isAct);
        pill.setAttribute("aria-pressed", isAct ? "true" : "false");
      });
    }
  }

  let legendEl = document.getElementById("graph-legend");
  if (!legendEl && graphContainer && Array.isArray(bundle.types) && bundle.types.length > 0) {
    legendEl = document.createElement("div");
    legendEl.id = "graph-legend";
    legendEl.className = "graph-legend";
    graphContainer.appendChild(legendEl);
  }
  if (legendEl && Array.isArray(bundle.types)) {
    legendEl.innerHTML = "";
    bundle.types.forEach(function (t) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "graph-legend-pill";
      btn.setAttribute("data-type", t);
      btn.setAttribute("aria-pressed", "false");
      const dot = document.createElement("span");
      dot.className = "graph-legend-dot";
      dot.style.background = (bundle.palette && bundle.palette[t]) || "#64748b";
      const txt = document.createElement("span");
      txt.textContent = t;
      btn.appendChild(dot);
      btn.appendChild(txt);
      btn.addEventListener("click", function () {
        const nextType = typeSelect.value === t ? "" : t;
        typeSelect.value = nextType;
        applyTypeFilter(nextType);
      });
      legendEl.appendChild(btn);
    });
  }

  cy.on("tap", "node", (evt) => showDetail(evt.target.id()));
  cy.on("tap", (evt) => {
    if (evt.target === cy) clearSelection();
  });

  document.getElementById("layout").addEventListener("change", (e) => {
    cy.layout({ name: e.target.value, animate: false, padding: 30 }).run();
  });

  document.getElementById("reset").addEventListener("click", () => {
    const searchEl = document.getElementById("search");
    if (searchEl && searchEl.value) searchEl.value = "";
    if (typeSelect && typeSelect.value) typeSelect.value = "";
    applyTypeFilter("");
    cy.fit(null, 30);
    clearSelection();
  });

  document.getElementById("search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      applyTypeFilter(typeSelect ? typeSelect.value : "");
      return;
    }
    cy.nodes().forEach((n) => {
      const d = n.data();
      const hay =
        (d.label || "").toLowerCase() + " " +
        d.id.toLowerCase() + " " +
        (d.tags || []).join(" ").toLowerCase();
      const typeOk = !typeSelect.value || d.type === typeSelect.value;
      n.toggleClass("dim", !typeOk || !hay.includes(q));
    });
    cy.edges().forEach((edge) => {
      const src = edge.source();
      const tgt = edge.target();
      edge.toggleClass("dim", src.hasClass("dim") || tgt.hasClass("dim"));
    });
  });

  document.getElementById("filter-type").addEventListener("change", (e) => {
    applyTypeFilter(e.target.value);
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
    const hashFragment =
      rawUrl && rawUrl.indexOf("#") !== -1 ? rawUrl.slice(rawUrl.indexOf("#") + 1).toLowerCase() : "";
    const isStructuredXmlResource =
      /\.(?:xml|xsd|bz2|gz|tgz|zip|tar|xz|txz|zst|7z)$/.test(cleanPath) ||
      /\.(?:xml|xsd)(?:$|[?&])/.test(hashFragment) ||
      /[?&](?:format|type|output)=xml\b/i.test(rawUrl);
    if (!rawMime && rawUrl) {
      if (/\.pdf$/.test(cleanPath) || /[?&](?:format|type|output)=pdf\b/i.test(rawUrl)) {
        rawMime = "application/pdf";
      } else if (
        /\.xml$|\.xsd$/.test(cleanPath) ||
        /\.(?:xml|xsd)(?:$|[?&])/.test(hashFragment) ||
        /[?&](?:format|type|output)=xml\b/i.test(rawUrl)
      ) {
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
    if (
      rawMime === "text/html" ||
      (rawMime === "application/xhtml+xml" && !isStructuredXmlResource)
    ) {
      return { mime: rawMime, label: "🌐 HTML · " + rawMime, cls: "mime-html" };
    }
    if (
      rawMime === "application/xml" ||
      rawMime === "text/xml" ||
      (rawMime === "application/xhtml+xml" && isStructuredXmlResource) ||
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

  function splitVizDiagramLines(rawLines, keepAllBullets) {
    const hdrs = [];
    const blts = [];
    for (let i = 0; i < rawLines.length; i++) {
      const p = String(rawLines[i] || "").replace(/\s+/g, " ").trim();
      if (!p) continue;
      if (/^[-*•]\s+/.test(p)) blts.push(p.replace(/^[-*•]\s+/, ""));
      else if (blts.length > 0) {
        const prev = blts[blts.length - 1];
        blts[blts.length - 1] = prev.endsWith("-") ? prev.slice(0, -1) + p : prev + " " + p;
      } else hdrs.push(p);
    }
    const title = hdrs[0] || (keepAllBullets ? "" : blts.shift()) || "";
    const subtitle = hdrs.slice(1).join(" · ").replace(/\s*\|\s*/g, " · ");
    return { title: title, subtitle: subtitle, bullets: blts };
  }

  function parseVizMermaidSpec(rawCode) {
    const cleaned = String(rawCode || "").replace(/^\s*%%.*$/gm, "").trim();
    const hdr = cleaned.match(/^\s*(?:flowchart|graph)(?:[ \t]+(TD|TB|BT|LR|RL))?\s*(?:;|\r?\n|$)/i);
    if (!hdr) return null;
    const rawDir = String(hdr[1] || "TD").toUpperCase();
    const direction = rawDir === "LR" || rawDir === "RL" ? rawDir : "TD";
    const src = cleaned.slice(hdr[0].length).replace(/\r\n/g, "\n");
    const lines = [];
    {
      let cur = "";
      let q = "";
      let depth = 0;
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (q) { cur += ch; if (ch === q && src[i - 1] !== "\\") q = ""; continue; }
        if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
        if (ch === "[" || ch === "(" || ch === "{") { depth++; cur += ch; continue; }
        if (ch === "]" || ch === ")" || ch === "}") { if (depth > 0) depth--; cur += ch; continue; }
        if (depth === 0 && (ch === "\n" || ch === ";")) { if (cur.trim()) lines.push(cur.trim()); cur = ""; continue; }
        cur += ch;
      }
      if (cur.trim()) lines.push(cur.trim());
    }
    const nodeMap = new Map();
    const nodes = [];
    const edges = [];
    function upsert(expr) {
      const m = String(expr || "").trim().match(/^([\p{L}\p{N}_-]+)\s*(?:(?:\(\[|\[\[|\(\(|\{\{|\[|\(|\{)([\s\S]*?)(?:\]\)|\]\]|\)\)|\}\}|\]|\)|\}))?$/u);
      if (!m) return null;
      const id = m[1];
      let inner = m[2] !== undefined ? String(m[2]).trim().replace(/^["']|["']$/g, "").replace(/<br\s*\/?>/gi, "\n").replace(/\\n/g, "\n") : "";
      let ex = nodeMap.get(id);
      if (!ex) {
        ex = { id: id, title: id, subtitle: "", bullets: [] };
        nodeMap.set(id, ex);
        nodes.push(ex);
      }
      if (inner) {
        const parts = splitVizDiagramLines(inner.split(/\r?\n/));
        ex.title = parts.title || id;
        ex.subtitle = parts.subtitle;
        ex.bullets = parts.bullets;
      }
      return ex;
    }
    function splitAmp(txt) {
      const out = [];
      let cur = "";
      let q = "";
      let depth = 0;
      for (let i = 0; i < txt.length; i++) {
        const ch = txt[i];
        if (q) { cur += ch; if (ch === q && txt[i - 1] !== "\\") q = ""; continue; }
        if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
        if (ch === "[" || ch === "(" || ch === "{") { depth++; cur += ch; continue; }
        if (ch === "]" || ch === ")" || ch === "}") { if (depth > 0) depth--; cur += ch; continue; }
        if (depth === 0 && ch === "&") { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
        cur += ch;
      }
      if (cur.trim()) out.push(cur.trim());
      return out;
    }
    lines.forEach(function (rawLine) {
      const st = rawLine.trim();
      if (!st || /^(?:subgraph|end|classDef|class|style|linkStyle|click|direction)\b/i.test(st)) return;
      const eMatch = st.match(/^(.+?)\s*(<--+>|--+>|==+>|-\.+->|---)(?:\s*\|([^|]*)\|)?\s*(.+)$/);
      if (eMatch) {
        const lefts = splitAmp(eMatch[1]).map(upsert).filter(Boolean);
        const rights = splitAmp(eMatch[4]).map(upsert).filter(Boolean);
        const lbl = (eMatch[3] || "").trim().replace(/^["']|["']$/g, "");
        const bi = eMatch[2].startsWith("<") && eMatch[2].endsWith(">");
        lefts.forEach(function (a) {
          rights.forEach(function (b) {
            edges.push({ from: a.id, to: b.id, label: lbl, bidirectional: bi });
          });
        });
      } else {
        splitAmp(st).forEach(upsert);
      }
    });
    return nodes.length > 0 ? { direction: direction, nodes: nodes, edges: edges } : null;
  }

  function reflowVizCollapsedBoxes(srcLines) {
    if (!Array.isArray(srcLines) || srcLines.length < 3) return null;
    const norm = srcLines.map(function (line) {
      return String(line || "")
        .replace(/[┌┐└┘├┤┬┴┼╭╮╯╰╔╗╚╝╠╣╦╩╬]/g, "+")
        .replace(/[─━═╌╍┄┅┈┉]/g, "-")
        .replace(/[│┃║╎╏┆┇┊┋]/g, "|")
        .replace(/[▼▾⬇↓]/g, "v")
        .replace(/[▲▴⬆↑]/g, "^")
        .replace(/[◄◂⬅←]/g, "<")
        .replace(/[►▸➡→]/g, ">");
    });
    const isPipeContent = function (idx) {
      if (idx < 0 || idx >= norm.length) return false;
      const t = norm[idx].trim();
      if (t.length < 3 || t[0] !== "|" || t[t.length - 1] !== "|") return false;
      return /[\p{L}\p{N}]/u.test(srcLines[idx]) || (t.match(/\|/g) || []).length >= 4;
    };
    const isBoxBorder = norm.map(function (line, idx) {
      const t = line.trim();
      if (!t || !/^[+\-\s]+$/.test(t) || !/\+[+\-]{7,}\+/.test(t)) return false;
      return isPipeContent(idx - 1) || isPipeContent(idx + 1);
    });
    const out = norm.slice();
    const rawOut = srcLines.map(function (l) { return String(l || ""); });
    let changed = false;
    let r = 0;
    while (r < norm.length) {
      if (!isBoxBorder[r]) { r++; continue; }
      let gEnd = r;
      while (gEnd + 1 < norm.length && (isBoxBorder[gEnd + 1] || isPipeContent(gEnd + 1))) gEnd++;
      if (gEnd <= r || !isBoxBorder[gEnd]) { r = gEnd + 1; continue; }
      const spans = [];
      const spanRe = /\+[+\-]{7,}\+/g;
      let sm;
      while ((sm = spanRe.exec(norm[r])) !== null) spans.push({ c1: sm.index, w: sm[0].length - 1 });
      const K = spans.length;
      if (K === 1) {
        let innerW = spans[0].w - 1;
        for (let rr = r; rr <= gEnd; rr++) {
          if (!isBoxBorder[rr] && isPipeContent(rr)) {
            const txt = rawOut[rr].trim().slice(1, -1).trim();
            if (txt.length + 2 > innerW) innerW = txt.length + 2;
          }
        }
        const c1 = spans[0].c1;
        for (let rr = r; rr <= gEnd; rr++) {
          if (isBoxBorder[rr]) {
            const chars = ("+" + "-".repeat(innerW) + "+").split("");
            for (let cc = c1 + 1; cc < Math.min(norm[rr].length - 1, c1 + innerW + 1); cc++) if (norm[rr][cc] === "+") chars[cc - c1] = "+";
            const nextLine = " ".repeat(c1) + chars.join("");
            if (nextLine !== rawOut[rr]) changed = true;
            rawOut[rr] = nextLine; out[rr] = nextLine;
          } else if (isPipeContent(rr)) {
            const txt = rawOut[rr].trim().slice(1, -1).trim();
            const nextLine = " ".repeat(c1) + "|" + (" " + txt).padEnd(innerW, " ") + "|";
            if (nextLine !== rawOut[rr]) changed = true;
            rawOut[rr] = nextLine; out[rr] = nextLine;
          }
        }
      } else if (K >= 2) {
        const boxW = spans.map(function (s) { return s.w - 1; });
        const gutW = [];
        for (let m = 0; m < K - 1; m++) gutW.push(Math.max(1, spans[m + 1].c1 - (spans[m].c1 + spans[m].w) - 1));
        for (let rr = r; rr <= gEnd; rr++) {
          if (!isBoxBorder[rr] && isPipeContent(rr)) {
            const toks = rawOut[rr].trim().split("|").slice(1, -1);
            if (toks.length === 2 * K - 1) {
              for (let m = 0; m < K; m++) if (toks[2 * m].trim().length + 2 > boxW[m]) boxW[m] = toks[2 * m].trim().length + 2;
              for (let m = 0; m < K - 1; m++) {
                const gt = norm[rr].trim().split("|").slice(1, -1)[2 * m + 1].trim();
                if (gt.length > gutW[m]) gutW[m] = gt.length;
              }
            }
          }
        }
        const padLead = " ".repeat(spans[0].c1);
        for (let rr = r; rr <= gEnd; rr++) {
          if (isBoxBorder[rr]) {
            let line = padLead;
            for (let m = 0; m < K; m++) { line += "+" + "-".repeat(boxW[m]) + "+"; if (m < K - 1) line += " ".repeat(gutW[m]); }
            if (line !== rawOut[rr]) changed = true;
            rawOut[rr] = line; out[rr] = line;
          } else if (isPipeContent(rr)) {
            const rawToks = rawOut[rr].trim().split("|").slice(1, -1);
            if (rawToks.length === 2 * K - 1) {
              let line = padLead;
              for (let m = 0; m < K; m++) {
                line += "|" + (" " + rawToks[2 * m].trim()).padEnd(boxW[m], " ") + "|";
                if (m < K - 1) line += rawToks[2 * m + 1].trim().padEnd(gutW[m], " ");
              }
              if (line !== rawOut[rr]) changed = true;
              rawOut[rr] = line; out[rr] = line;
            }
          }
        }
      }
      r = gEnd + 1;
    }
    for (let i = 0; i < out.length; i++) {
      if (isBoxBorder[i] || isPipeContent(i)) continue;
      const t = out[i].trim();
      if (!/^[|vV^](?:\s+[|vV^])+$/.test(t)) continue;
      const wireToks = t.split(/\s+/);
      let splitCols = null;
      for (let up = i - 1; up >= Math.max(0, i - 4); up--) {
        if (isBoxBorder[up] || isPipeContent(up)) break;
        if (/\+[+\-]{4,}\+/.test(out[up])) {
          const cols = [];
          for (let c = 0; c < out[up].length; c++) if (out[up][c] === "+") cols.push(c);
          if (cols.length >= 2) { splitCols = cols; break; }
        }
      }
      if (!splitCols) continue;
      const targetCols = wireToks.length === 2 ? [splitCols[0], splitCols[splitCols.length - 1]] : wireToks.length === splitCols.length ? splitCols : null;
      if (!targetCols) continue;
      const width = targetCols[targetCols.length - 1] + 1;
      if (out[i].trimEnd().length < width - 1) {
        const arr = new Array(width).fill(" ");
        for (let wi = 0; wi < wireToks.length; wi++) arr[targetCols[wi]] = wireToks[wi];
        const rebuilt = arr.join("");
        rawOut[i] = rebuilt; out[i] = rebuilt; changed = true;
      }
    }
    return changed ? rawOut : null;
  }

  function parseVizAsciiBoxSpec(rawCode) {
    const srcLines = String(rawCode || "").replace(/\r\n/g, "\n").split("\n");
    if (srcLines.length < 3) return null;
    const direct = parseVizAsciiBoxLines(srcLines);
    if (direct) return direct;
    const reflowed = reflowVizCollapsedBoxes(srcLines);
    return reflowed ? parseVizAsciiBoxLines(reflowed) : null;
  }

  function parseVizAsciiBoxLines(srcLines) {
    const rawLines = srcLines.map(function (line) {
      let out = "";
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        out += ch;
        if (/[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97C\uAC00-\uD7FF\uF900-\uFAFF\uFE10-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6]/.test(ch)) out += "\x00";
      }
      return out;
    });
    let maxCols = 0;
    for (let r = 0; r < rawLines.length; r++) if (rawLines[r].length > maxCols) maxCols = rawLines[r].length;
    if (maxCols < 12 || maxCols > 260) return null;
    const normLines = rawLines.map(function (line) {
      return line
        .padEnd(maxCols, " ")
        .replace(/[┌┐└┘├┤┬┴┼╭╮╯╰╔╗╚╝╠╣╦╩╬]/g, "+")
        .replace(/[─━═╌╍┄┅┈┉]/g, "-")
        .replace(/[│┃║╎╏┆┇┊┋]/g, "|")
        .replace(/[▼▾⬇↓]/g, "v")
        .replace(/[▲▴⬆↑]/g, "^")
        .replace(/[◄◂⬅←]/g, "<")
        .replace(/[►▸➡→]/g, ">");
    });
    function isHorizBorder(r, c1, c2) {
      if (c2 - c1 < 8) return false;
      const row = normLines[r];
      if (row[c1] !== "+" || row[c2] !== "+") return false;
      for (let c = c1 + 1; c < c2; c++) if (row[c] !== "-" && row[c] !== "+") return false;
      return true;
    }
    const compartments = [];
    for (let r1 = 0; r1 < normLines.length - 2; r1++) {
      const row1 = normLines[r1];
      if (row1.indexOf("+") === -1) continue;
      const plusCols = [];
      for (let c = 0; c < maxCols; c++) if (row1[c] === "+") plusCols.push(c);
      for (let pi = 0; pi < plusCols.length; pi++) {
        const c1 = plusCols[pi];
        for (let pj = pi + 1; pj < plusCols.length; pj++) {
          const c2 = plusCols[pj];
          if (!isHorizBorder(r1, c1, c2)) continue;
          let r2 = -1;
          let ok = true;
          for (let r = r1 + 1; r < normLines.length; r++) {
            const lCh = normLines[r][c1];
            const rCh = normLines[r][c2];
            if (r >= r1 + 2 && isHorizBorder(r, c1, c2)) { r2 = r; break; }
            if ((lCh !== "|" && lCh !== "+") || (rCh !== "|" && rCh !== "+")) { ok = false; break; }
          }
          if (!ok || r2 === -1) continue;
          let interiorWall = false;
          for (let cm = c1 + 2; cm <= c2 - 2; cm++) {
            let allV = true;
            for (let r = r1 + 1; r < r2; r++) if (normLines[r][cm] !== "|" && normLines[r][cm] !== "+") { allV = false; break; }
            if (allV && normLines[r1][cm] === "+" && normLines[r2][cm] === "+") { interiorWall = true; break; }
          }
          if (interiorWall) continue;
          const inner = [];
          let hasText = false;
          for (let r = r1 + 1; r < r2; r++) {
            const sl = (rawLines[r] || "").padEnd(maxCols, " ").slice(c1 + 1, c2).replace(/\x00/g, "");
            if (/[\p{L}\p{N}]/u.test(sl)) hasText = true;
            inner.push(sl);
          }
          if (!hasText) continue;
          compartments.push({ r1: r1, c1: c1, r2: r2, c2: c2, lines: inner });
          break;
        }
      }
    }
    if (compartments.length < 2) return null;
    compartments.sort(function (a, b) { return a.r1 - b.r1 || a.c1 - b.c1; });
    const merged = [];
    const used = new Set();
    for (let i = 0; i < compartments.length; i++) {
      if (used.has(i)) continue;
      used.add(i);
      const cur = { r1: compartments[i].r1, c1: compartments[i].c1, r2: compartments[i].r2, c2: compartments[i].c2, sections: [compartments[i].lines] };
      let ext = true;
      while (ext) {
        ext = false;
        for (let j = i + 1; j < compartments.length; j++) {
          if (!used.has(j) && compartments[j].r1 === cur.r2 && compartments[j].c1 === cur.c1 && compartments[j].c2 === cur.c2) {
            used.add(j);
            cur.r2 = compartments[j].r2;
            cur.sections.push(compartments[j].lines);
            ext = true;
          }
        }
      }
      merged.push(cur);
    }
    if (merged.length < 2) return null;
    const owner = Array.from({ length: normLines.length }, function () { return new Int16Array(maxCols).fill(-1); });
    merged.forEach(function (b, bi) {
      for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) owner[r][c] = bi;
    });
    let hasArrow = false;
    for (let r = 0; r < normLines.length && !hasArrow; r++) {
      for (let c = 0; c < maxCols; c++) if (owner[r][c] === -1 && /[vV^<>]/.test(normLines[r][c])) { hasArrow = true; break; }
    }
    if (!hasArrow) return null;
    const nodes = merged.map(function (b, idx) {
      const hdr = splitVizDiagramLines(b.sections[0]);
      let blts = hdr.bullets.slice();
      for (let si = 1; si < b.sections.length; si++) {
        const sec = splitVizDiagramLines(b.sections[si], true);
        if (sec.title) blts.push(sec.title);
        if (sec.subtitle) blts.push(sec.subtitle);
        blts = blts.concat(sec.bullets);
      }
      return { id: "box_" + idx, title: hdr.title || "Node " + (idx + 1), subtitle: hdr.subtitle, bullets: blts };
    });
    const edges = [];
    const seen = new Set();
    let hDir = 0;
    let vDir = 0;
    function addE(f, t, lbl, bi) {
      if (f === t || f < 0 || t < 0) return false;
      const k = bi ? Math.min(f, t) + "<->" + Math.max(f, t) : f + "->" + t;
      if (seen.has(k)) return false;
      seen.add(k);
      edges.push({ from: "box_" + f, to: "box_" + t, label: lbl || "", bidirectional: Boolean(bi) });
      return true;
    }
    for (let i = 0; i < merged.length; i++) {
      for (let j = 0; j < merged.length; j++) {
        if (i === j) continue;
        const L = merged[i];
        const R = merged[j];
        if (L.c2 >= R.c1 || R.c1 - L.c2 > 48) continue;
        const rs = Math.max(L.r1, R.r1);
        const re = Math.min(L.r2, R.r2);
        if (re - rs < 2) continue;
        let blk = false;
        for (let r = rs; r <= re && !blk; r++) for (let c = L.c2 + 1; c < R.c1; c++) if (owner[r][c] !== -1) blk = true;
        if (blk) continue;
        let lt = false;
        let rt = false;
        const toks = [];
        for (let r = rs; r <= re; r++) {
          const ns = normLines[r].slice(L.c2 + 1, R.c1).replace(/\x00/g, "").trim();
          const raws = (rawLines[r] || "").padEnd(maxCols, " ").slice(L.c2 + 1, R.c1).replace(/\x00/g, "").trim();
          if (!ns) continue;
          if (/^<?[-=]+>?$/.test(ns)) {
            if (ns.startsWith("<")) lt = true;
            if (ns.endsWith(">")) rt = true;
          } else {
            const ia = ns.match(/^(<)?[-=]+\s*(.+?)\s*[-=]+(>)?$/);
            if (ia && (ia[1] || ia[3])) {
              if (ia[1]) lt = true;
              if (ia[3]) rt = true;
              const rc = raws.replace(/^[<>=\-|]+\s*/, "").replace(/\s*[<>=\-|]+$/, "").trim();
              if (rc) toks.push(rc);
            } else {
              const cl = raws.replace(/^[<>=\-|]+|(?:--+|==+|[<>|])+$/g, "").trim();
              if (cl) toks.push(cl);
            }
          }
        }
        if (lt || rt) {
          let jl = "";
          toks.forEach(function (tk) { jl = !jl ? tk : jl.endsWith("-") ? jl.slice(0, -1) + tk : jl + " " + tk; });
          if (lt && rt) addE(i, j, jl, true);
          else if (rt) { if (addE(i, j, jl, false)) hDir++; }
          else { if (addE(j, i, jl, false)) hDir++; }
        }
      }
    }
    const vis = Array.from({ length: normLines.length }, function () { return new Uint8Array(maxCols); });
    const isWire = function (ch) { return ch === "|" || ch === "+" || ch === "-" || ch === "v" || ch === "V" || ch === "^"; };
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let r = 0; r < normLines.length; r++) {
      for (let c = 0; c < maxCols; c++) {
        if (owner[r][c] !== -1 || vis[r][c] || !isWire(normLines[r][c])) continue;
        const q = [[r, c]];
        vis[r][c] = 1;
        const srcs = new Set();
        const tgts = new Set();
        for (let h = 0; h < q.length; h++) {
          const cr = q[h][0];
          const cc = q[h][1];
          const ch = normLines[cr][cc];
          if (cr + 1 < normLines.length && owner[cr + 1][cc] !== -1 && (ch === "v" || ch === "V" || ch === "|" || ch === "+")) tgts.add(owner[cr + 1][cc]);
          if (cr - 1 >= 0 && owner[cr - 1][cc] !== -1) {
            if (ch === "^") tgts.add(owner[cr - 1][cc]);
            else if (ch === "|" || ch === "+") srcs.add(owner[cr - 1][cc]);
          }
          for (let di = 0; di < 4; di++) {
            const nr = cr + dirs[di][0];
            const nc = cc + dirs[di][1];
            if (nr >= 0 && nr < normLines.length && nc >= 0 && nc < maxCols && owner[nr][nc] === -1 && !vis[nr][nc] && isWire(normLines[nr][nc])) {
              vis[nr][nc] = 1;
              q.push([nr, nc]);
            }
          }
        }
        srcs.forEach(function (s) { tgts.forEach(function (t) { if (s !== t && addE(s, t, "", false)) vDir++; }); });
      }
    }
    return edges.length > 0 ? { direction: vDir === 0 && hDir > 0 ? "LR" : "TD", nodes: nodes, edges: edges } : null;
  }

  function renderVizFlowDiagram(spec) {
    if (!spec || !Array.isArray(spec.nodes) || spec.nodes.length === 0) return "";
    const isLR = spec.direction === "LR" || spec.direction === "RL";
    const nodes = spec.nodes;
    const edges = Array.isArray(spec.edges) ? spec.edges : [];
    const adj = new Map();
    const inDeg = new Map();
    const orderIdx = new Map();
    nodes.forEach(function (n, idx) { adj.set(n.id, []); inDeg.set(n.id, 0); orderIdx.set(n.id, idx); });
    edges.forEach(function (e) {
      if (!adj.has(e.from) || !adj.has(e.to) || e.from === e.to || e.bidirectional) return;
      adj.get(e.from).push(e.to);
      inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
    });
    const rankById = new Map();
    const q = [];
    nodes.forEach(function (n) { if ((inDeg.get(n.id) || 0) === 0) { rankById.set(n.id, 0); q.push(n.id); } });
    if (q.length === 0) { rankById.set(nodes[0].id, 0); q.push(nodes[0].id); }
    const visits = new Map();
    for (let h = 0; h < q.length; h++) {
      const u = q[h];
      const ur = rankById.get(u) || 0;
      (adj.get(u) || []).forEach(function (v) {
        const vc = (visits.get(v) || 0) + 1;
        visits.set(v, vc);
        if (vc > nodes.length * 2) return;
        if (!rankById.has(v) || ur + 1 > rankById.get(v)) { rankById.set(v, ur + 1); q.push(v); }
      });
    }
    for (let p = 0; p < 3; p++) {
      edges.forEach(function (e) {
        if (!e.bidirectional) return;
        if (rankById.has(e.from) && !rankById.has(e.to)) rankById.set(e.to, rankById.get(e.from));
        else if (rankById.has(e.to) && !rankById.has(e.from)) rankById.set(e.from, rankById.get(e.to));
      });
    }
    let maxR = 0;
    nodes.forEach(function (n) {
      if (!rankById.has(n.id)) rankById.set(n.id, 0);
      if (rankById.get(n.id) > maxR) maxR = rankById.get(n.id);
    });
    const rows = Array.from({ length: maxR + 1 }, function () { return []; });
    nodes.forEach(function (n) { rows[rankById.get(n.id) || 0].push(n); });
    const nonEmpty = rows.filter(function (r) { return r.length > 0; });
    const rowIdx = new Map();
    const colPos = new Map();
    nonEmpty.forEach(function (row, ri) {
      row.sort(function (a, b) { return (orderIdx.get(a.id) || 0) - (orderIdx.get(b.id) || 0); });
      row.forEach(function (n, ci) { rowIdx.set(n.id, ri); colPos.set(n.id, (ci + 0.5) / row.length); });
    });
    const siblingMap = new Map();
    edges.forEach(function (e) {
      if (rowIdx.has(e.from) && rowIdx.get(e.from) === rowIdx.get(e.to)) {
        siblingMap.set([e.from, e.to].sort().join("::"), e);
      }
    });
    let out = '<div class="a2ui-flow-diagram" data-a2ui-component="FlowDiagram"><div class="a2ui-flow-ranks' + (isLR ? " dir-lr" : "") + '">';
    for (let ri = 0; ri < nonEmpty.length; ri++) {
      const row = nonEmpty[ri];
      const isRoot = ri === 0 && row.length === 1 && nonEmpty.length > 1;
      out += '<div class="a2ui-flow-rank-row">';
      for (let ci = 0; ci < row.length; ci++) {
        const n = row[ci];
        out += '<div class="a2ui-flow-node-card' + (isRoot ? " is-root" : "") + '"><div class="a2ui-flow-node-title">' + escapeHtmlAttr(n.title) + "</div>";
        if (n.subtitle) {
          const subs = String(n.subtitle).split(/\s*(?:·|\|)\s*/).filter(Boolean);
          out += '<div class="a2ui-flow-node-subtitles">' + subs.map(function (s) { return '<span class="a2ui-flow-node-subtitle">' + escapeHtmlAttr(s) + "</span>"; }).join("") + "</div>";
        }
        if (n.bullets && n.bullets.length > 0) {
          out += '<ul class="a2ui-flow-node-bullets">' + n.bullets.map(function (b) { return "<li>" + escapeHtmlAttr(b) + "</li>"; }).join("") + "</ul>";
        }
        out += "</div>";
        if (ci + 1 < row.length) {
          const br = siblingMap.get([n.id, row[ci + 1].id].sort().join("::"));
          if (br) {
            const bi = Boolean(br.bidirectional);
            const ltr = br.from === n.id;
            let svg = '<svg viewBox="0 0 44 16" aria-hidden="true"><line x1="6" y1="8" x2="38" y2="8" stroke="var(--flow-accent)" stroke-width="1.8" />';
            if (bi || !ltr) svg += '<polygon points="9,4 3,8 9,12" fill="var(--flow-accent)" />';
            if (bi || ltr) svg += '<polygon points="35,4 41,8 35,12" fill="var(--flow-accent)" />';
            svg += "</svg>";
            out += '<div class="a2ui-flow-bridge">' + svg + (br.label ? '<span class="a2ui-flow-edge-pill">' + escapeHtmlAttr(br.label) + "</span>" : "") + "</div>";
          }
        }
      }
      out += "</div>";
      if (ri + 1 < nonEmpty.length && !isLR) {
        const band = edges.filter(function (e) { return rowIdx.get(e.from) === ri && rowIdx.get(e.to) === ri + 1; });
        if (band.length > 0) {
          out += '<div class="a2ui-flow-connector-band" aria-hidden="true"><svg viewBox="0 0 1000 34" preserveAspectRatio="none">';
          const tips = new Set();
          band.forEach(function (be) {
            const x1 = Math.round((colPos.get(be.from) || 0.5) * 1000);
            const x2 = Math.round((colPos.get(be.to) || 0.5) * 1000);
            out += '<path d="' + (x1 === x2 ? "M " + x1 + " 0 V 28" : "M " + x1 + " 0 V 17 H " + x2 + " V 28") + '" fill="none" stroke="var(--flow-wire)" stroke-width="1.8" vector-effect="non-scaling-stroke" />';
            tips.add(x2);
          });
          out += "</svg>";
          tips.forEach(function (x2) {
            out += '<svg style="position:absolute;bottom:0;left:calc(' + (x2 / 10).toFixed(2) + '% - 5px);width:10px;height:7px" viewBox="0 0 10 7"><polygon points="0,0 10,0 5,7" fill="var(--flow-wire)" /></svg>';
          });
          out += "</div>";
        }
      } else if (ri + 1 < nonEmpty.length && isLR) {
        out += '<div class="a2ui-flow-bridge" aria-hidden="true"><svg viewBox="0 0 40 16"><line x1="4" y1="8" x2="32" y2="8" stroke="var(--flow-wire)" stroke-width="1.8" /><polygon points="29,4 37,8 29,12" fill="var(--flow-wire)" /></svg></div>';
      }
    }
    out += "</div></div>";
    return out;
  }

  function renderVizFenceDiagram(infoStr, codeBody) {
    const lang = String(infoStr || "").trim().toLowerCase().split(/\s+/)[0] || "";
    if (lang === "mermaid") {
      return renderVizFlowDiagram(parseVizMermaidSpec(codeBody));
    }
    if (!lang || lang === "text" || lang === "plaintext" || lang === "ascii" || lang === "diagram") {
      return renderVizFlowDiagram(parseVizAsciiBoxSpec(codeBody));
    }
    return "";
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
    text = text.replace(/^\x60\x60\x60([^\n]*)\n([\s\S]*?)^\x60\x60\x60\s*$/gm, function (_m, infoStr, codeBody) {
      const idx = fenceStash.length;
      const diagHtml = renderVizFenceDiagram(infoStr, codeBody);
      if (diagHtml) {
        fenceStash.push(diagHtml);
        return "\x00FENCE_" + idx + "\x00";
      }
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

  function createSvgGraphFallback(container, nodes, edges, initialTheme) {
    const tapNodeHandlers = [];
    const tapBgHandlers = [];
    const nodeWrappers = {};
    const edgeWrappers = [];
    let selectedId = null;
    let curTheme = initialTheme || resolveEffectiveVizTheme();
    const ns = "http://www.w3.org/2000/svg";
    const W = 820;
    const H = 560;
    const svg = container ? document.createElementNS(ns, "svg") : null;

    function applyNodeCircleStroke(nw, palette) {
      const isSel = nw._id === selectedId;
      const isStale = Boolean(nw._stale);
      nw._circle.setAttribute(
        "stroke",
        isSel ? palette.selected : isStale ? palette.staleBorder : palette.nodeBorder
      );
      nw._circle.setAttribute("stroke-width", isSel ? "3.5" : isStale ? "2.5" : "1.5");
      if (isStale && !isSel) {
        nw._circle.setAttribute("stroke-dasharray", "4 2");
      } else {
        nw._circle.removeAttribute("stroke-dasharray");
      }
      nw._label.setAttribute("fill", palette.nodeLabel);
      nw._label.setAttribute("stroke", palette.nodeOutline);
    }

    if (svg && container) {
      const oldSvg = container.querySelector("svg");
      if (oldSvg) oldSvg.remove();
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.display = "block";
      svg.style.userSelect = "none";
      const initPalette = getGraphThemePalette(curTheme);
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
        if (d.status === "deprecated") g.style.opacity = "0.55";
        const r = Math.max(11, Math.min(24, Number(d.size || 24) / 2));
        const circle = document.createElementNS(ns, "circle");
        circle.setAttribute("cx", String(p.x));
        circle.setAttribute("cy", String(p.y));
        circle.setAttribute("r", String(r));
        circle.setAttribute("fill", d.color || "#0284c7");
        const label = document.createElementNS(ns, "text");
        label.setAttribute("x", String(p.x));
        label.setAttribute("y", String(p.y + r + 13));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-size", "10.5");
        label.setAttribute("font-weight", "500");
        label.setAttribute("stroke-width", "3");
        label.setAttribute("stroke-linejoin", "round");
        label.style.paintOrder = "stroke fill";
        const rawLbl = String(d.label || d.id || "");
        label.textContent = rawLbl.length > 26 ? rawLbl.slice(0, 25) + "…" : rawLbl;
        g.appendChild(circle);
        g.appendChild(label);
        nodeGroup.appendChild(g);
        let dimmed = false;
        const baseOpacity = d.status === "deprecated" ? "0.55" : "1";
        const wrapper = {
          _id: d.id,
          _stale: Boolean(d.stale),
          _circle: circle,
          _label: label,
          id: function () { return d.id; },
          data: function (k) { return k ? d[k] : d; },
          hasClass: function (cls) { return cls === "dim" ? dimmed : false; },
          toggleClass: function (cls, state) {
            if (cls === "dim") {
              dimmed = Boolean(state);
              g.style.opacity = dimmed ? "0.15" : baseOpacity;
            }
          },
          removeClass: function (cls) {
            if (cls === "dim") { dimmed = false; g.style.opacity = baseOpacity; }
          },
          select: function () {
            selectedId = d.id;
            const pal = getGraphThemePalette(curTheme);
            Object.keys(nodeWrappers).forEach(function (k) {
              applyNodeCircleStroke(nodeWrappers[k], pal);
            });
          },
        };
        applyNodeCircleStroke(wrapper, initPalette);
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
        line.setAttribute("stroke", initPalette.edgeLine);
        line.setAttribute("stroke-width", "1.5");
        edgeGroup.appendChild(line);
        edgeWrappers.push({
          _line: line,
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
      container.insertBefore(svg, container.firstChild);
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
      setTheme: function (nextTheme) {
        curTheme = nextTheme || resolveEffectiveVizTheme();
        const pal = getGraphThemePalette(curTheme);
        Object.keys(nodeWrappers).forEach(function (k) {
          applyNodeCircleStroke(nodeWrappers[k], pal);
        });
        edgeWrappers.forEach(function (ew) {
          if (ew._line) ew._line.setAttribute("stroke", pal.edgeLine);
        });
      },
      elements: function () {
        return {
          unselect: function () {
            selectedId = null;
            const pal = getGraphThemePalette(curTheme);
            Object.keys(nodeWrappers).forEach(function (k) {
              applyNodeCircleStroke(nodeWrappers[k], pal);
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
    const vizDiagStash = [];
    const bodyWithSup = bodyWithMath
      .replace(/\r\n/g, "\n")
      .replace(/^\x60\x60\x60([^\n]*)\n([\s\S]*?)^\x60\x60\x60\s*$/gm, function (full, infoStr, codeBody) {
        const rendered = renderVizFenceDiagram(infoStr, codeBody);
        if (!rendered) return full;
        const idx = vizDiagStash.length;
        vizDiagStash.push(rendered);
        return "\n\nVIZDIAGSTASH" + idx + "END\n\n";
      })
      .replace(
        /\[\^([A-Za-z0-9_\-]+)\]/g,
        '<sup class="fn-ref"><a href="#fn-$1" data-fn="$1">[$1]</a></sup>'
      );
    let html =
      typeof marked !== "undefined" && marked && typeof marked.parse === "function"
        ? marked.parse(bodyWithSup, { breaks: false, gfm: true })
        : parseBuiltInVizMarkdown(bodyWithSup);
    if (vizDiagStash.length > 0) {
      html = html.replace(/(?:<p>\s*)?VIZDIAGSTASH(\d+)END(?:\s*<\/p>)?/g, function (_m, a) {
        return vizDiagStash[Number(a)] || "";
      });
    }
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
    chip.style.background = getAccessibleTypeChipBg(data.color || getTypeColor(data.type));

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
        '<div class="viz-back-row"><button type="button" id="viz-source-back-btn" class="viz-back-btn">' +
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
            '<div class="viz-stub-card">' +
            '<div class="viz-stub-header">' +
            '<span class="badge status-draft">Linked Concept (Stub)</span>' +
            '<button type="button" id="viz-stub-back-btn" class="viz-back-btn">' +
            backBtnLabel +
            "</button>" +
            "</div>" +
            "<h2>" +
            escapeHtmlAttr(linkLabel) +
            "</h2>" +
            "<p class='muted'>Concept ID: <code>/" +
            escapeHtmlAttr(target) +
            ".md</code></p>" +
            "<p>" +
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
