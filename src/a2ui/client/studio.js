(function () {
  var DEFAULT_CLIENT_UI = {
    stubConceptInlineNote: "*This OKF concept (`/{id}.md`) is cross-referenced from the primary concept.*",
    backToConcept: "← Back to concept",
    backToPrimaryConcept: "← Back to primary concept",
    checklistDefaultHeading: "Checklist / Action Items",
    checklistDefaultGroup: "General",
    modulePrefix: "Module",
    pillarPrefix: "Pillar",
    casePrefix: "Case",
    scenarioPrefix: "Scenario",
    defaultVerifierActor: "human:reviewer",
    verifierPlaceholder: "human:Name or role",
    verifiedSourcesCount: "{count} verified sources",
    runLabelPrefix: "Run {n}: {title}",
    switchRunAriaLabel: "Switch active course / run",
    switchToRun: "🚀 Switch to Run",
    switchToRunWithId: "🚀 Switch to Run ({id})",
    completedSummary: "{completed} / {total} completed ({pct}%)",
    tabChecklistCount: "✅ Interactive Checklist ({count})",
    checklistShortTitle: "Interactive Checklist",
    quizShortTitle: "Knowledge Check",
    closeBtn: "Close",
    listenNarration: "🔊 Listen to narration ({desc})",
    stopNarration: "⏹ Stop",
    studioAudioBadge: "🎙️ Studio Audio",
    studioAudioVoicesBadge: "🎙️ Studio Audio ({voices})",
    missingBrowserVoiceHint:
      "⚠️ No browser Web Speech voice installed for {lang} — run Stage 4 (gemini-3.8-flash-tts) for native studio narration",
    checkAllBtn: "✓ Check all",
    resetChecklistBtn: "↺ Reset checklist",
    noModulesEmpty: "No modules or pillars found in Stage 2 artifact.",
    keyPointsCourse: "Key Learning Points & Slide Cues",
    keyPointsAnalysis: "Key Analytical Findings & Evidence",
    actionItemCourse: "⚡ Action Item / Practical Exercise:",
    actionItemAnalysis: "⚡ Recommendation / Decision Directive:",
    prevModuleCourse: "← Previous module",
    prevModuleAnalysis: "← Previous pillar",
    nextModuleCourse: "Next module →",
    nextModuleAnalysis: "Next pillar →",
    quizScoreBadge: "Score: {correct} / {total} correct ({answered} answered)",
    quizCorrect: "✓ Correct!",
    quizIncorrect: "✗ Not quite.",
    caseResponseLabelCourse: "Your proposed action plan (saved live in A2UI Data Model):",
    caseResponseLabelAnalysis: "Your analytical notes / decision stance (saved live in A2UI Data Model):",
    caseResponsePlaceholderCourse: "Write your assessment and recommended steps here...",
    caseResponsePlaceholderAnalysis: "Record committee notes, conditions, or risk mitigations...",
    showRecommendedAction: "Show recommended action",
    hideRecommendedAction: "Hide recommended action",
    recommendedActionHeader: "⚡ Recommended Action & Resolution:",
    copiedFeedback: "✓ Copied!",
    intermissionBannerStage1: "🛡️ Intermission Source Curation & Sign-Off (Stage 1 → Stage 2)",
    intermissionBannerFull: "🛡️ OKF v0.3 Source Curation & Verification",
    activeSourcesChip: "✅ {count} active sources",
    rejectedSourcesChip: "🚫 {count} rejected",
    replacedSourcesChip: "🔀 {count} replaced",
    addedSourcesChip: "➕ {count} added",
    jumpToSourcesBtn: "⬇️ Sources & Replace ({count})",
    verifierLabel: "Verifier:",
    approveAndSendBtn: "🚀 Approve & Send to AGY",
    sendingToAgyBtn: "⏳ Sending to AGY...",
    sentToAgyBtn: "✅ Sent to AGY! (Check chat)",
    copiedPasteInChatBtn: "📋 Copied! Paste in AGY chat",
    copyReplyForAgyBtn: "📋 Copy Reply for AGY",
    copyCliCommandBtn: "💻 Copy CLI Command",
    stage1KnowledgeBaseTitle: "Stage 1 OKF v0.3 Knowledge Base",
    previewOkfMarkdownBtn: "👁 Preview OKF Markdown",
    editOkfMarkdownBtn: "✏️ Edit OKF Markdown (Layer 4)",
    editableMarkdownLabel: "Editable OKF v0.3 Markdown (live-updates A2UI Data Model and Checklist):",
    sourcesAndProvenanceHeading: "Sources & Provenance ({count})",
    stage1SearchQueriesSummary: "🔎 Stage 1 Search Queries ({count} queries)",
    addMissingSourceLabel: "➕ Add Missing Source (URL + optional title)",
    optionalSourceTitlePlaceholder: "Optional title (e.g. Regulatory Standard § 12)",
    addSourceBtn: "➕ Add Source",
    showingSourcesCount: "Showing {visible} of {total} sources",
    filterAllPill: "All ({count})",
    filterReviewPill: "⚠️ Review ({count})",
    filterSourcesPlaceholder: "🔎 Filter sources by filename, URL, title, MIME, or [^id]…",
    resetFilterBtn: "Reset filter",
    rejectedBadge: "🚫 REJECTED",
    addedBadge: "➕ ADDED",
    historicalArchiveBadge: "Historical / archive path",
    domainMismatchPrefix: "Domain mismatch: ",
    citationsWord: "citations",
    soleSourceWarning: "Sole source for {count} claim(s)",
    copyUrlBtn: "📋 Copy URL",
    undoReplaceBtn: "↩ Undo replace",
    closeReplaceBtn: "✕ Close replace",
    replaceSourceBtn: "🔀 Replace source",
    undoRejectBtn: "↩ Undo reject",
    rejectSourceBtn: "🚫 Reject source",
    replaceCitationsWithLabel: "🔀 Replace {count} citation(s) with:",
    letAgyChooseOption: "(Let AGY choose / strip footnote)",
    selectOrPasteSourceOption: "(Select existing source or paste URL below…)",
    pasteCanonicalUrlPlaceholder: "Or paste canonical https:// URL directly (1 step)…",
    useUrlBtn: "Use URL",
    showSoleClaimsSummary: "Show {count} claim(s) backed solely by [^{id}]",
    graphClickHint: "Click an OKF node in the graph to inspect the concept and its citations.",
    sourcesCountHeading: "Sources ({count}):",
    citedByCountHeading: "Cited by ({count}):",
    noGraphNodesEmpty: "No nodes in OKF knowledge graph yet.",
    agyApproveStage1: "I have reviewed a2ui.html and approve all sources — run {cli} and proceed to Stage 2.",
    agyApproveFull: "I have reviewed a2ui.html and approve all sources — run {cli} and refresh the A2UI studio.",
    agyRejectPrefix: "Reject sources: [{list}].",
    agyReplacePrefix: "Replace citations: [{list}].",
    agyAddPrefix: "Add sources: [{list}].",
    agyCurateRunStage1:
      "Run {cli} (use --replace-source oldId=newId_or_URL in cli:verify to re-anchor citations from rejected sources to existing/added sources without rewriting research_summary.md; only edit specific sentences if factual claims must change) and proceed to Stage 2.",
    agyCurateRunFull:
      "Run {cli} (use --replace-source oldId=newId_or_URL in cli:verify to re-anchor citations without rewriting research_summary.md) to refresh the knowledge base and A2UI studio (without re-running Stage 2 unless claims changed).",
  };

  var DEFAULT_CLIENT_PROSODY = {
    to: "to",
    minus: "minus",
    negative: "negative",
    plus: "plus",
    approximately: "approximately",
    plusOrMinus: "plus or minus",
    lessOrEqual: "less than or equal to",
    greaterOrEqual: "greater than or equal to",
    notEqual: "not equal to",
    times: "times",
    dividedBy: "divided by",
    inEquilibriumWith: "in equilibrium with",
    section: "section",
    sections: "sections",
    degrees: "degrees",
    degreesCelsius: "degrees Celsius",
    degreesFahrenheit: "degrees Fahrenheit",
    specificImpulse: "specific impulse",
    squareMeters: "square meters",
    cubicMeters: "cubic meters",
    squareKilometers: "square kilometers",
    perHour: "per hour",
    perSecond: "per second",
    microG: "micro-g",
    micrometers: "micrometers",
    gramsPerCm3: "grams per cubic centimeter",
    kgPerM3: "kilograms per cubic meter",
    kmPerS: "kilometers per second",
    mPerS2: "meters per second squared",
    mPerS: "meters per second",
    wattsPerM2: "watts per square meter",
    kwPerKg: "kilowatts per kilogram",
    dollarSingular: "dollar",
    dollarPlural: "dollars",
    per: "per",
    magnitudes: { B: "billion", M: "million", T: "trillion", K: "thousand", bn: "billion", mn: "million" },
    unitSlashes: {
      kg: "kilogram",
      g: "gram",
      t: "metric ton",
      ton: "ton",
      tonne: "metric ton",
      oz: "ounce",
      sh: "share",
      share: "share",
      yr: "year",
      year: "year",
      mo: "month",
      month: "month",
      kwh: "kilowatt-hour",
      mwh: "megawatt-hour",
      kw: "kilowatt",
      mw: "megawatt",
    },
  };

  function formatClientTpl(template, vars) {
    const raw = String(template == null ? "" : template);
    if (!vars) return raw;
    return raw.replace(/\{([a-zA-Z0-9_]+)\}/g, function (m, k) {
      return vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m;
    });
  }

  function getClientLocalePack(surface) {
    if (surface && surface.locale && typeof surface.locale === "object") {
      return surface.locale;
    }
    if (surface && surface.dataModel && surface.dataModel.locale && typeof surface.dataModel.locale === "object") {
      return surface.dataModel.locale;
    }
    if (
      typeof window !== "undefined" &&
      window.A2UI_SURFACE_PAYLOAD &&
      window.A2UI_SURFACE_PAYLOAD.locale &&
      typeof window.A2UI_SURFACE_PAYLOAD.locale === "object"
    ) {
      return window.A2UI_SURFACE_PAYLOAD.locale;
    }
    if (typeof payload !== "undefined" && payload && payload.locale && typeof payload.locale === "object") {
      return payload.locale;
    }
    return null;
  }

  function getClientUiLocale(surface) {
    const pack = getClientLocalePack(surface);
    return (pack && pack.ui && typeof pack.ui === "object" && pack.ui) || DEFAULT_CLIENT_UI;
  }

  function tClient(surface, key, vars) {
    const ui = getClientUiLocale(surface);
    const tpl = ui[key] !== undefined && ui[key] !== "" ? ui[key] : DEFAULT_CLIENT_UI[key] || "";
    return formatClientTpl(tpl, vars);
  }

  function detectSpeechLang(text) {
    const sample = String(text || "").trim();
    if (!sample) return "en-US";
    if (/[\u3040-\u30ff]/.test(sample)) return "ja-JP";
    if (/[\uac00-\ud7af]/.test(sample)) return "ko-KR";
    if (/[\u4e00-\u9fff]/.test(sample)) return "zh-CN";
    if (/[\u0600-\u06ff]/.test(sample)) return "ar-SA";
    if (/[\u0400-\u04ff]/.test(sample)) return /[іїєґІЇЄҐ]/.test(sample) ? "uk-UA" : "ru-RU";
    if (/[\u0900-\u097f]/.test(sample)) return "hi-IN";
    if (/[\u0370-\u03ff]/.test(sample)) return "el-GR";
    if (/[\u0590-\u05ff]/.test(sample)) return "he-IL";
    if (/[\u0e00-\u0e7f]/.test(sample)) return "th-TH";
    if (/[ðþÐÞ]/.test(sample)) return "is-IS";
    if ((sample.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length >= 2) return "pl-PL";

    const count = function (re) {
      return (sample.match(re) || []).length;
    };
    const fiScore = count(/\b(ja|on|ei|että|mutta|kanssa|ovat|kuin|myös|sekä|tämä)\b/gi) * 3;
    const svScore =
      count(/\b(och|att|är|inte|från|också|detta|genom\w*|finns|mycket)\b/gi) * 3 +
      count(/[äöÄÖåÅ]/g);
    const deScore =
      count(/[ß]/g) * 4 +
      count(/\b(der|die|das|und|nicht|mit|für|von|auf|ist|sind|werden|auch|oder|durch|gemäß)\b/gi) * 2;
    const daScore =
      count(/\b(af|bliver|blevet|hvordan|også|gennem\w*|deres|mellem|skulle)\b/gi) * 3 +
      count(/\b\w{4,}hed(?:en|er|ens)?\b/gi) * 2 +
      count(/[æøåÆØÅ]/g);
    const nnScore =
      count(/\b(ikkje|korleis|kva|ein|eit|dei|frå\w*|mellom|også|vert)\b/gi) * 4 +
      count(/[æøåÆØÅ]/g);
    const nbScore =
      count(/\b(ikke|hvordan|hvorfor|mellom|gjennom\w*|dersom|blir|blitt|også|deres|annet|ulike)\b/gi) * 3 +
      count(/\b\w{4,}het(?:en|er|ens|ene)?\b/gi) * 2 +
      count(/\b(og|det|som|med|til|fra|har|i|skal|må|kan|ved|av|på)\b/g) +
      count(/[æøåÆØÅ]/g) * 2;
    const frScore =
      count(/[œçàèùâêîôû]/gi) +
      count(/\b(les|des|est|une|dans|pour|pas|plus|avec|sur|sont|cette|aux|mais)\b/gi) * 2;
    const esScore =
      count(/[ñ¿¡]/gi) * 4 +
      count(/\b(los|las|del|una|para|con|por|como|más|pero|sus|esta|entre|sobre)\b/gi) * 2;
    const ptScore =
      count(/[ãõ]/gi) * 4 +
      count(/\b(não|uma|para|com|dos|das|mais|como|pelo|pela|são|está|entre)\b/gi) * 2;
    const itScore =
      count(/\b(che|non|per|una|con|del|della|sono|anche|più|questo|questa|degli|delle)\b/gi) * 2;
    const nlScore =
      count(/\b(het|een|van|dat|niet|voor|met|zijn|worden|naar|ook|deze|door)\b/gi) * 2;
    const enScore =
      count(
        /\b(the|and|with|from|that|this|are|was|were|have|has|had|will|would|should|could|which|their|there|about|into|between|without|within|through|during|before|after|under)\b/gi
      ) * 2;

    const candidates = [
      ["fi-FI", fiScore],
      ["sv-SE", svScore],
      ["de-DE", deScore],
      ["nn-NO", nnScore],
      ["da-DK", daScore > nbScore ? daScore : 0],
      ["nb-NO", nbScore],
      ["fr-FR", frScore],
      ["es-ES", esScore],
      ["pt-BR", ptScore],
      ["it-IT", itScore],
      ["nl-NL", nlScore],
      ["en-US", enScore],
    ];
    candidates.sort(function (a, b) {
      return b[1] - a[1];
    });
    if (candidates[0][1] >= 3) {
      if (candidates[0][0] === "nb-NO" && enScore >= nbScore) return "en-US";
      return candidates[0][0];
    }
    return "en-US";
  }

  function detectTextLang(text) {
    const tag = detectSpeechLang(text);
    const primary = tag.split("-")[0].toLowerCase();
    return primary === "nb" || primary === "nn" ? "no" : primary;
  }

  function isInlineLatexMath(inner) {
    if (!inner || typeof inner !== "string") return false;
    if (/^\s|\s$/.test(inner)) return false;
    if (/[\r\n|]/.test(inner)) return false;
    if (inner.indexOf("[^") !== -1) return false;
    if (/\*\*|__/.test(inner)) return false;
    if (/(?:^|[^\\])~$/.test(inner)) return false;
    if (/^\d+\.\d{3,}$/.test(inner)) return true;
    if (/^\d[\d,.]*(?:\s*(?:[BMKTbmkt](?![\^_])\b|billion|million|trillion|thousand|bn\b|mn\b|\s+(?:per|to|and|or|in|at|for|from|of|vs)\b|\)|\s*$))/i.test(inner)) {
      return false;
    }
    if (/^\d[\d,.]*\s*\/\s*(?:sh|share|yr|year|mo|month|wk|week|day|hr|hour|oz|lb|lbs|kg|g|ton|tonne|t|bbl|gal|mwh|kwh|kw|mw|gw|user|sub|seat|unit|launch|flight|km|m|sqft|ft)\b/i.test(inner)) {
      return false;
    }
    if (/^\d[\d,.]*\s*[-–—]\s*(?:\$|~|$)/.test(inner)) {
      return false;
    }
    if (/^[A-Z]{1,5}\/[A-Z]{1,5}$/.test(inner)) {
      return true;
    }
    if (/^[a-zA-Z]$/.test(inner)) {
      return true;
    }
    if (/^[a-zA-Z](?:_[a-zA-Z0-9]+)?\s*[=<>≤≥≈~±+\-]\s*[+-]?\d[\d.,%a-zA-Z\s/\-]*$/.test(inner)) {
      return true;
    }
    const hasTeXOrSubSup = /(?:\\[a-zA-Z !,;:%$&_#]|[A-Za-z0-9)\]}][\^_](?:\{[^{}\r\n]+\}|[A-Za-z0-9+\-°]))/.test(inner);
    if (/^\d/.test(inner)) {
      if (hasTeXOrSubSup) return true;
      if (/^\d+(?:[.,]\d+)*(?:\s*(?:\\|[\^_+*=<>≤≥±×÷]|\/[a-zA-Z0-9]+)|\s+[a-zA-Z]{1,3}[\^_])/.test(inner)) {
        return true;
      }
      if (/^\d+\.\d+$/.test(inner) && !/^\d+\.\d{2}$/.test(inner)) {
        return true;
      }
      return false;
    }
    if (!hasTeXOrSubSup) {
      return false;
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
        let k = i + 2;
        const closeIdx = s.indexOf("$$", k);
        if (closeIdx !== -1) {
          while (k < closeIdx) {
            if (s[k] === "|" || (s[k] === "\n" && /^\r?\n\s*\r?\n/.test(s.slice(k)))) {
              break;
            }
            k++;
          }
          if (k === closeIdx) {
            const innerDisplay = s.slice(i + 2, closeIdx).replace(/\s+/g, " ").trim();
            if (innerDisplay && isInlineLatexMath(innerDisplay)) {
              out += replacer(s.slice(i, closeIdx + 2), innerDisplay);
              i = closeIdx + 2;
              continue;
            }
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

  function canonicalMacrolangBase(base) {
    if (base === "nb" || base === "nn" || base === "no") return "no";
    if (base === "cmn" || base === "yue" || base === "zh") return "zh";
    return base;
  }

  function resolveSpeechVoice(targetLang, availableVoices) {
    const rawTarget = String(targetLang || "en-US").trim();
    const targetNorm = rawTarget.replace(/_/g, "-").toLowerCase();
    const baseLang = targetNorm.split("-")[0] || "en";
    const macroTarget = canonicalMacrolangBase(baseLang);
    const voices = Array.isArray(availableVoices) ? availableVoices : [];
    let bestVoice = null;
    let bestScore = -1;

    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      if (!v) continue;
      const vNorm = String(v.lang || "").trim().replace(/_/g, "-").toLowerCase();
      const vBase = vNorm.split("-")[0] || "";
      const vMacro = canonicalMacrolangBase(vBase);
      const nameLower = String(v.name || "").toLowerCase();
      let langScore = 0;

      if (vNorm === targetNorm) {
        langScore = 50;
      } else if (vBase && vBase === baseLang) {
        langScore = 45;
      } else if (vMacro && vMacro === macroTarget) {
        langScore = 35;
      }

      if (langScore <= 0) continue;

      let qualityBonus = 0;
      if (
        nameLower.indexOf("natural") !== -1 ||
        nameLower.indexOf("neural") !== -1 ||
        nameLower.indexOf("online") !== -1 ||
        nameLower.indexOf("google") !== -1 ||
        nameLower.indexOf("premium") !== -1 ||
        nameLower.indexOf("enhanced") !== -1 ||
        nameLower.indexOf("siri") !== -1
      ) {
        qualityBonus += 25;
      }
      if (v.localService === false) qualityBonus += 10;
      if (v.default === true) qualityBonus += 5;
      if (nameLower.indexOf("espeak") !== -1 || nameLower.indexOf("compact") !== -1) {
        qualityBonus -= 20;
      }

      const totalScore = langScore + qualityBonus;
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestVoice = v;
      }
    }

    const effectiveLang =
      bestVoice && bestVoice.lang
        ? String(bestVoice.lang).trim().replace(/_/g, "-")
        : rawTarget;

    return {
      voice: bestVoice,
      matchedTargetLanguage: Boolean(bestVoice),
      effectiveLang: effectiveLang,
    };
  }

  function stripClientFootnotesPreservingBoundaries(text) {
    return String(text || "")
      .replace(/([A-Za-z0-9\u00C0-\u024F)%°²³¹⁰⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉])(?:\[\^[^\r\n\]]+\][ \t]*)+(?=[A-Za-z0-9\u00C0-\u024F($~€£])/g, "$1 ")
      .replace(/\[\^[^\r\n\]]+\]/g, "");
  }

  function mergeClientProsody(rawProsody) {
    if (!rawProsody || typeof rawProsody !== "object") return DEFAULT_CLIENT_PROSODY;
    const out = Object.assign({}, DEFAULT_CLIENT_PROSODY, rawProsody);
    out.magnitudes = Object.assign({}, DEFAULT_CLIENT_PROSODY.magnitudes, rawProsody.magnitudes || {});
    out.unitSlashes = Object.assign({}, DEFAULT_CLIENT_PROSODY.unitSlashes, rawProsody.unitSlashes || {});
    return out;
  }

  function normalizeTextForTts(text, localeOrLang) {
    const raw = String(text || "");
    let s = cleanClientChecklistLabel(raw);

    let targetTag = "";
    let explicitProsody = null;
    if (localeOrLang && typeof localeOrLang === "object") {
      targetTag = String(localeOrLang.bcp47 || "");
      if (localeOrLang.prosody && typeof localeOrLang.prosody === "object") {
        explicitProsody = mergeClientProsody(localeOrLang.prosody);
      }
    } else if (typeof localeOrLang === "string" && localeOrLang.trim()) {
      targetTag = localeOrLang.trim();
    }
    if (!targetTag) {
      targetTag = detectSpeechLang(raw);
    }
    const targetMacro = canonicalMacrolangBase(targetTag.toLowerCase().split(/[-_]/)[0] || "en");

    let p = explicitProsody;
    if (!p) {
      const surfacePack = getClientLocalePack(null);
      if (surfacePack && surfacePack.prosody && surfacePack.bcp47) {
        const packMacro = canonicalMacrolangBase(
          String(surfacePack.bcp47).toLowerCase().split(/[-_]/)[0] || ""
        );
        if (packMacro === targetMacro) {
          p = mergeClientProsody(surfacePack.prosody);
        }
      }
    }
    if (!p && targetMacro === "en") {
      p = DEFAULT_CLIENT_PROSODY;
    }

    if (p) {
      // Expand currency ranges ($10M–$25M, $1.5B–$2.0B) before individual currency tokens
      s = s.replace(/(\$[0-9][0-9,.]*(?:\s*(?:B|M|T|K|bn|mn|billion|million|trillion|thousand))?)\s*[–—-]\s*(\$[0-9])/gi, function (_m, left, right) {
        return left + " " + p.to + " " + right;
      });
      // Replace negative currency (-$12.5M), positive currency (+$4.0M), and approximate currency (~$150)
      s = s.replace(/(^|[\s(])-\s*\$(?=\d)/g, "$1" + p.negative + " $");
      s = s.replace(/(^|[\s(])\+\s*\$(?=\d)/g, "$1" + p.plus + " $");
      s = s.replace(/~\s*\$(?=\d)/g, p.approximately + " $");
      s = s.replace(/~(?=\d)/g, p.approximately + " ");
      // Expand currency with magnitude suffixes + optional unit slash ($50/kg, $12.5M, $2.5B)
      s = s.replace(/\$([0-9][0-9,.]*)\s*(B|M|T|K|bn|mn)\b(?:\s*\/\s*([a-zA-Z]+)\b)?/g, function (_m, num, mag, unit) {
        const magWord = p.magnitudes[mag] || mag;
        const base = num + " " + magWord + " " + p.dollarPlural;
        if (!unit) return base;
        const uLower = unit.toLowerCase();
        const uWord = p.unitSlashes[uLower] || unit;
        return base + " " + p.per + " " + uWord;
      });
      s = s.replace(/\$([0-9][0-9,.]*)\s*(billion|million|trillion|thousand)\b/gi, function (_m, num, word) {
        return num + " " + word.toLowerCase() + " " + p.dollarPlural;
      });
      s = s.replace(/\$([0-9][0-9,.]*)\s*\/\s*([a-zA-Z]+)\b/g, function (_m, num, unit) {
        const uLower = unit.toLowerCase();
        const uWord = p.unitSlashes[uLower] || unit;
        const dWord = num === "1" ? p.dollarSingular : p.dollarPlural;
        return num + " " + dWord + " " + p.per + " " + uWord;
      });
      s = s.replace(/\$([0-9][0-9,.]*)\b/g, function (_m, num) {
        const dWord = num === "1" ? p.dollarSingular : p.dollarPlural;
        return num + " " + dWord;
      });
      // Expand scientific units and symbols before generic subscript stripping
      s = s
        .replace(/(^|[^A-Za-z0-9])(?:Iₛₚ|I_sp|Isp)(?![A-Za-z0-9])/g, function (_m, pre) {
          return pre + p.specificImpulse;
        })
        .replace(/Δv\b/g, "delta-v")
        .replace(/Δ/g, "delta ")
        .replace(/±/g, " " + p.plusOrMinus + " ")
        .replace(/≥/g, " " + p.greaterOrEqual + " ")
        .replace(/≤/g, " " + p.lessOrEqual + " ")
        .replace(/≈/g, " " + p.approximately + " ")
        .replace(/≠/g, " " + p.notEqual + " ")
        .replace(/×/g, " " + p.times + " ")
        .replace(/÷/g, " " + p.dividedBy + " ")
        .replace(/⇌|↔|⇔/g, " " + p.inEquilibriumWith + " ")
        .replace(/→|⇒/g, " " + p.to + " ")
        .replace(/\bg\s*\/\s*cm(?:³|\^3|3)(?![a-zA-Z0-9])/g, p.gramsPerCm3)
        .replace(/\bkg\s*\/\s*m(?:³|\^3|3)(?![a-zA-Z0-9])/g, p.kgPerM3)
        .replace(/\bkm\s*\/\s*s(?![a-zA-Z0-9])/g, p.kmPerS)
        .replace(/\bm\s*\/\s*s(?:²|\^2|2)(?![a-zA-Z0-9])/g, p.mPerS2)
        .replace(/\bm\s*\/\s*s(?![a-zA-Z0-9])/g, p.mPerS)
        .replace(/\bW\s*\/\s*m(?:²|\^2|2)(?![a-zA-Z0-9])/g, p.wattsPerM2)
        .replace(/\bkW\s*\/\s*kg(?![a-zA-Z0-9])/g, p.kwPerKg)
        .replace(/\bkm(?:²|\^2)(?![a-zA-Z0-9])/g, p.squareKilometers)
        .replace(/\bm(?:²|\^2)(?![a-zA-Z0-9])/g, p.squareMeters)
        .replace(/\bm(?:³|\^3)(?![a-zA-Z0-9])/g, p.cubicMeters)
        .replace(/\bh⁻¹(?![a-zA-Z0-9])/g, p.perHour)
        .replace(/\bs⁻¹(?![a-zA-Z0-9])/g, p.perSecond)
        .replace(/(?:μ|µ)g\b/g, p.microG)
        .replace(/(?:μ|µ)m\b/g, p.micrometers)
        .replace(/§§\s*(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)\s*(?:[–—]|\s+-\s+)\s*(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)/g, function (_m, a, b) {
          return p.sections + " " + a + " " + p.to + " " + b;
        })
        .replace(/§§\s*(\d+)-(\d+)\b/g, function (full, a, b, offset, str) {
          const fullStr = String(str);
          const before = fullStr.slice(Math.max(0, Number(offset) - 28), Number(offset));
          const rest = fullStr.slice(Number(offset) + full.length);
          if (
            /\b(?:[\p{Lu}]{2,8}\s*\d+|[\p{L}]{2,6}\.)\s*$/u.test(before) ||
            /^\s*(?:,|[^\d\s,.]{1,8}\s+)\d+-/u.test(rest) ||
            Number(a) >= Number(b)
          ) {
            return p.sections + " " + a + "-" + b;
          }
          return p.sections + " " + a + " " + p.to + " " + b;
        })
        .replace(/§§\s*(?=\d)/g, p.sections + " ")
        .replace(/§\s*(?=\d)/g, p.section + " ")
        .replace(/(^|[\s(])[−-]\s*(\d+[0-9,.]*)\s*°([CF])\b/g, function (_m, pre, num, scale) {
          return pre + p.minus + " " + num + " °" + scale;
        })
        .replace(/°C\b/g, " " + p.degreesCelsius)
        .replace(/°F\b/g, " " + p.degreesFahrenheit)
        .replace(/°/g, " " + p.degrees + " ");
    }

    // Normalize subscript/superscript digits in identifiers (e.g. NPV₈ -> NPV 8, CO₂ -> CO2)
    const subDigits = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9", "ₓ": "x" };
    const supDigits = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-" };
    s = s.replace(/\b(NPV|IRR|TRL|Tier)_?([₀₁₂₃₄₅₆₇₈₉0-9]+)/gi, function (_m, prefix, digits) {
      const cleanD = String(digits).replace(/[₀₁₂₃₄₅₆₇₈₉]/g, function (d) { return subDigits[d] || d; });
      return prefix + " " + cleanD;
    });
    s = s.replace(/[₀₁₂₃₄₅₆₇₈₉ₓ]/g, function (d) { return subDigits[d] || d; });
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, function (d) { return supDigits[d] || d; });
    return s.replace(/\s+/g, " ").trim();
  }

  function cloneDataValue(val) {
    if (val === null || val === undefined || typeof val !== "object") return val;
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(val);
      } catch (_e) {}
    }
    try {
      return JSON.parse(JSON.stringify(val));
    } catch (_e) {
      return val;
    }
  }

  function resolveClientConceptId(href, currentConceptId) {
    const cleanHref = String(href || "").trim().split("#")[0].split("?")[0];
    if (
      !cleanHref ||
      /^[a-z][a-z0-9+.-]*:/i.test(cleanHref) ||
      cleanHref.startsWith("//")
    ) {
      return null;
    }
    if (cleanHref.startsWith("/")) {
      return cleanHref.replace(/^\/+/, "").replace(/\.md$/i, "") || null;
    }
    if (!cleanHref.toLowerCase().endsWith(".md")) {
      return null;
    }
    const baseId = String(currentConceptId || "research/current")
      .replace(/^\/+/, "")
      .replace(/\.md$/i, "");
    const baseParts = baseId.split("/").filter(Boolean);
    baseParts.pop();
    const relParts = cleanHref.replace(/\.md$/i, "").split("/");
    for (const part of relParts) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (baseParts.length > 0) baseParts.pop();
      } else {
        baseParts.push(part);
      }
    }
    return baseParts.join("/") || null;
  }

  function syncSurfaceBadgeTones(surface) {
    if (!surface || !surface.components) return;
    const status = String(resolvePointer(surface.dataModel, "/okf/status") || "draft");
    const trustTier = String(resolvePointer(surface.dataModel, "/okf/trustTier") || "unverified");
    const isStale = Boolean(resolvePointer(surface.dataModel, "/okf/isStale"));
    if (surface.components["badge_status"]) {
      surface.components["badge_status"].tone = status === "stable" ? "success" : "warn";
    }
    if (surface.components["badge_trust"]) {
      surface.components["badge_trust"].tone = trustTier === "human-reviewed" ? "accent" : "primary";
    }
    if (surface.components["badge_freshness"]) {
      surface.components["badge_freshness"].tone = isStale ? "danger" : "success";
    }
  }

  function switchActiveRun(surface, targetRunId, bundleRunsOverride) {
    if (!surface || !targetRunId) return false;
    const runs =
      bundleRunsOverride ||
      (typeof payload !== "undefined" && payload && Array.isArray(payload.bundleRuns)
        ? payload.bundleRuns
        : []);
    surface.runStates = surface.runStates || {};
    const curRunId = surface.activeRunId || resolvePointer(surface.dataModel, "/meta/runId");
    if (curRunId) {
      if (
        surface.viewingStubConcept ||
        Boolean(resolvePointer(surface.dataModel, "/okf/viewingStubConcept"))
      ) {
        if (typeof syncChecklistToOkfBody === "function") {
          syncChecklistToOkfBody(surface);
        }
        const primaryCid = resolvePointer(surface.dataModel, "/okf/primaryConceptId") || "";
        navigateOkfMarkdownConcept(surface, primaryCid);
        surface.viewingStubConcept = false;
      }
      surface.runStates[curRunId] = cloneDataValue(surface.dataModel);
    }
    const targetEntry = runs.find((r) => r && r.runId === targetRunId);
    if (!surface.runStates[targetRunId] && targetEntry && targetEntry.dataModel) {
      surface.runStates[targetRunId] = cloneDataValue(targetEntry.dataModel);
    }
    const nextState = surface.runStates[targetRunId];
    if (!nextState) return false;

    const prevIsStage1Only = Boolean(resolvePointer(surface.dataModel, "/meta/isStage1Only"));
    if (typeof stopActiveSpeech === "function") {
      stopActiveSpeech();
    }
    setPointer(surface.dataModel, "/", nextState);
    surface.activeRunId = targetRunId;
    surface.viewingStubConcept = Boolean(
      resolvePointer(surface.dataModel, "/okf/viewingStubConcept")
    );
    syncSurfaceBadgeTones(surface);

    const nextIsStage1Only = Boolean(
      resolvePointer(surface.dataModel, "/meta/isStage1Only") ||
        (targetEntry && targetEntry.isStage1Only)
    );
    if (surface.components) {
      if (surface.components["overview_narration_col"]) {
        const hasHeroComp = Boolean(surface.components["overview_hero_image"]);
        const hasTtsComp = Boolean(surface.components["overview_tts_player"]);
        surface.components["overview_narration_col"].children = nextIsStage1Only
          ? ["overview_narration_heading", "overview_narration_body"]
          : (hasHeroComp ? ["overview_hero_image"] : []).concat(
              hasTtsComp
                ? ["overview_narration_heading", "overview_tts_player", "overview_narration_body"]
                : ["overview_narration_heading", "overview_narration_body"]
            );
      }
      if (surface.components["tab_overview"]) {
        surface.components["tab_overview"].children = nextIsStage1Only
          ? ["overview_narration_card"]
          : surface.components["overview_highlights_card"]
            ? ["overview_narration_card", "overview_highlights_card"]
            : ["overview_narration_card"];
      }
    }
    if (
      surface.components &&
      surface.components["main_tabs"] &&
      Array.isArray(surface.components["main_tabs"].tabs)
    ) {
      if (
        (prevIsStage1Only !== nextIsStage1Only || nextIsStage1Only) &&
        targetEntry &&
        Array.isArray(targetEntry.tabs) &&
        targetEntry.tabs.length > 0
      ) {
        surface.components["main_tabs"].tabs = cloneDataValue(targetEntry.tabs);
        if (surface.uiState && surface.uiState.activeTabs) {
          surface.uiState.activeTabs["main_tabs"] = 0;
        }
      }
      const clCount = Number(resolvePointer(surface.dataModel, "/checklist/totalCount") || 0);
      for (const tab of surface.components["main_tabs"].tabs) {
        if (!tab || !tab.child) continue;
        if (targetEntry && targetEntry.tabTitles && targetEntry.tabTitles[tab.child]) {
          tab.title = targetEntry.tabTitles[tab.child];
        }
        if (tab.child === "tab_checklist" && typeof tab.title === "string") {
          tab.title = tab.title.replace(/\(\d+\)\s*$/, "(" + clCount + ")");
        }
      }
      updateSourcesBadgeInStudio(surface);
    }

    const nextTitle =
      resolvePointer(surface.dataModel, "/meta/title") ||
      (targetEntry && targetEntry.title) ||
      targetRunId;
    if (typeof document !== "undefined") {
      const topbarTitleEl = document.querySelector(".a2ui-topbar-title");
      if (topbarTitleEl) {
        topbarTitleEl.textContent = String(nextTitle);
      }
      if (document.title) {
        document.title = String(nextTitle) + " — A2UI v1.0 Studio";
      }
      const switcherEl = document.getElementById("a2ui-run-switcher-select");
      if (switcherEl && switcherEl.value !== targetRunId) {
        switcherEl.value = targetRunId;
      }
    }

    if (
      typeof renderSurface === "function" &&
      typeof document !== "undefined" &&
      document.getElementById &&
      document.getElementById("a2ui-surface-root")
    ) {
      renderSurface();
    }
    return true;
  }

  function navigateOkfMarkdownConcept(surface, targetConceptId, fallbackLabel, bundleGraphOverride) {
    if (!surface) return false;
    const bg =
      bundleGraphOverride ||
      (typeof bundleGraph !== "undefined" && bundleGraph ? bundleGraph : { bodies: {}, conceptMeta: {} });
    const primaryConceptId = String(resolvePointer(surface.dataModel, "/okf/primaryConceptId") || "");

    if (
      !surface.viewingStubConcept &&
      !resolvePointer(surface.dataModel, "/okf/viewingStubConcept")
    ) {
      setPointer(surface.dataModel, "/okf/primaryBody", resolvePointer(surface.dataModel, "/okf/body") || "");
      setPointer(surface.dataModel, "/okf/primaryTitle", resolvePointer(surface.dataModel, "/okf/title") || "");
      setPointer(surface.dataModel, "/okf/primarySources", resolvePointer(surface.dataModel, "/okf/sources") || []);
      setPointer(
        surface.dataModel,
        "/okf/primaryStatus",
        resolvePointer(surface.dataModel, "/okf/status") || "draft"
      );
      setPointer(
        surface.dataModel,
        "/okf/primaryTrustTier",
        resolvePointer(surface.dataModel, "/okf/trustTier") || "unverified"
      );
      setPointer(
        surface.dataModel,
        "/okf/primaryIsStale",
        Boolean(resolvePointer(surface.dataModel, "/okf/isStale"))
      );
      setPointer(
        surface.dataModel,
        "/okf/primaryStatusBadge",
        resolvePointer(surface.dataModel, "/okf/statusBadge") || ""
      );
      setPointer(
        surface.dataModel,
        "/okf/primaryTrustBadge",
        resolvePointer(surface.dataModel, "/okf/trustBadge") || ""
      );
      setPointer(
        surface.dataModel,
        "/okf/primaryFreshnessBadge",
        resolvePointer(surface.dataModel, "/okf/freshnessBadge") || ""
      );
      setPointer(
        surface.dataModel,
        "/okf/primarySourcesBadge",
        resolvePointer(surface.dataModel, "/okf/sourcesBadge") || ""
      );
    }

    if (!targetConceptId || (primaryConceptId && targetConceptId === primaryConceptId)) {
      const origBody = resolvePointer(surface.dataModel, "/okf/primaryBody");
      const origTitle = resolvePointer(surface.dataModel, "/okf/primaryTitle");
      const origSources = resolvePointer(surface.dataModel, "/okf/primarySources");
      const origStatus = resolvePointer(surface.dataModel, "/okf/primaryStatus");
      const origTrustTier = resolvePointer(surface.dataModel, "/okf/primaryTrustTier");
      const origIsStale = resolvePointer(surface.dataModel, "/okf/primaryIsStale");
      const origStatusBadge = resolvePointer(surface.dataModel, "/okf/primaryStatusBadge");
      const origTrustBadge = resolvePointer(surface.dataModel, "/okf/primaryTrustBadge");
      const origFreshnessBadge = resolvePointer(surface.dataModel, "/okf/primaryFreshnessBadge");
      const origSourcesBadge = resolvePointer(surface.dataModel, "/okf/primarySourcesBadge");
      if (origBody !== undefined) setPointer(surface.dataModel, "/okf/body", origBody);
      if (origTitle !== undefined) setPointer(surface.dataModel, "/okf/title", origTitle);
      if (origSources !== undefined) setPointer(surface.dataModel, "/okf/sources", origSources);
      if (origStatus !== undefined) setPointer(surface.dataModel, "/okf/status", origStatus);
      if (origTrustTier !== undefined) setPointer(surface.dataModel, "/okf/trustTier", origTrustTier);
      if (origIsStale !== undefined) setPointer(surface.dataModel, "/okf/isStale", Boolean(origIsStale));
      if (origStatusBadge) setPointer(surface.dataModel, "/okf/statusBadge", origStatusBadge);
      if (origTrustBadge) setPointer(surface.dataModel, "/okf/trustBadge", origTrustBadge);
      if (origFreshnessBadge) setPointer(surface.dataModel, "/okf/freshnessBadge", origFreshnessBadge);
      if (origSourcesBadge) setPointer(surface.dataModel, "/okf/sourcesBadge", origSourcesBadge);
      setPointer(surface.dataModel, "/okf/activeConceptId", primaryConceptId || targetConceptId || "");
      setPointer(surface.dataModel, "/okf/viewingStubConcept", false);
      surface.viewingStubConcept = false;
      setPointer(surface.dataModel, "/okf/editMode", false);
      syncSurfaceBadgeTones(surface);
      syncOkfBodyToChecklist(surface);
      return true;
    }

    const cMeta = (bg.conceptMeta && bg.conceptMeta[targetConceptId]) || null;
    const stubNote = "\n\n" + tClient(surface, "stubConceptInlineNote", { id: targetConceptId });
    const targetBody =
      (bg.bodies && bg.bodies[targetConceptId]) ||
      "# " + (fallbackLabel || (cMeta && cMeta.title) || targetConceptId).trim() + stubNote;

    setPointer(surface.dataModel, "/okf/activeConceptId", targetConceptId);
    setPointer(surface.dataModel, "/okf/body", targetBody);
    setPointer(
      surface.dataModel,
      "/okf/title",
      (cMeta && cMeta.title) || fallbackLabel || targetConceptId
    );
    setPointer(surface.dataModel, "/okf/sources", (cMeta && cMeta.sources) || []);
    setPointer(
      surface.dataModel,
      "/okf/status",
      (cMeta && cMeta.status) || "draft"
    );
    setPointer(
      surface.dataModel,
      "/okf/trustTier",
      (cMeta && cMeta.trustTier) || "unverified"
    );
    setPointer(surface.dataModel, "/okf/isStale", Boolean(cMeta && cMeta.isStale));
    if (cMeta) {
      if (cMeta.statusBadge) setPointer(surface.dataModel, "/okf/statusBadge", cMeta.statusBadge);
      if (cMeta.trustBadge) setPointer(surface.dataModel, "/okf/trustBadge", cMeta.trustBadge);
      if (cMeta.freshnessBadge) setPointer(surface.dataModel, "/okf/freshnessBadge", cMeta.freshnessBadge);
      if (cMeta.sourcesBadge) setPointer(surface.dataModel, "/okf/sourcesBadge", cMeta.sourcesBadge);
    }
    setPointer(surface.dataModel, "/okf/viewingStubConcept", true);
    surface.viewingStubConcept = true;
    setPointer(surface.dataModel, "/okf/editMode", false);
    syncSurfaceBadgeTones(surface);
    syncOkfBodyToChecklist(surface);
    return true;
  }

  function inspectSourceCitationsInBody(bodyMd, srcId, rejectedSourceIds) {
    if (Array.isArray(srcId)) {
      const mapRes = {};
      for (let idx = 0; idx < srcId.length; idx++) {
        const sItem = srcId[idx];
        const sid = sItem && typeof sItem === "object" ? sItem.id : sItem;
        if (sid) {
          mapRes[String(sid)] = inspectSourceCitationsInBody(bodyMd, String(sid), rejectedSourceIds);
        }
      }
      return mapRes;
    }
    const targetId = String(srcId || "").trim().replace(/^\[\^?/, "").replace(/\]$/, "");
    if (!targetId) {
      return { mentionCount: 0, soleClaimLines: [] };
    }
    const rejectedSet = new Set(
      Array.isArray(rejectedSourceIds)
        ? rejectedSourceIds.map(function (r) {
            return String(r || "").trim().replace(/^\[\^?/, "").replace(/\]$/, "");
          })
        : []
    );
    const lines = String(bodyMd || "").split(/\r?\n/);
    let mentionCount = 0;
    const soleClaimLines = [];
    function extractCitedIds(text) {
      const fnRegex = /\[\^([^\r\n\]]+)\]/g;
      const ids = [];
      let m;
      while ((m = fnRegex.exec(text)) !== null) {
        const cid = String(m[1] || "").trim();
        if (cid) ids.push(cid);
      }
      return ids;
    }
    function pushCleanClaim(rawSegment) {
      const cleanClaim = stripClientFootnotesPreservingBoundaries(rawSegment)
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleanClaim && soleClaimLines.indexOf(cleanClaim) === -1) {
        soleClaimLines.push(cleanClaim);
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^\s*\[\^[^\]]+\]:/.test(trimmed)) continue;
      const citedIds = extractCitedIds(trimmed);
      if (citedIds.length === 0) continue;
      let citesTargetCount = 0;
      for (let j = 0; j < citedIds.length; j++) {
        if (citedIds[j] === targetId) citesTargetCount++;
      }
      if (citesTargetCount === 0) continue;
      mentionCount += citesTargetCount;
      const remainingActive = citedIds.filter(function (id) {
        return id !== targetId && !rejectedSet.has(id);
      });
      if (remainingActive.length === 0) {
        pushCleanClaim(trimmed);
      } else {
        const subSegments =
          trimmed.startsWith("|") && trimmed.endsWith("|")
            ? trimmed
                .split("|")
                .map(function (s) {
                  return s.trim();
                })
                .filter(Boolean)
            : trimmed
                .split(/(?<=[.?!](?:\s*\[\^[^\]]+\])*)\s+/)
                .map(function (s) {
                  return s.trim();
                })
                .filter(Boolean);
        if (subSegments.length > 1) {
          for (let sIdx = 0; sIdx < subSegments.length; sIdx++) {
            const seg = subSegments[sIdx];
            const segIds = extractCitedIds(seg);
            if (segIds.indexOf(targetId) === -1) continue;
            const segRemaining = segIds.filter(function (id) {
              return id !== targetId && !rejectedSet.has(id);
            });
            if (segRemaining.length === 0) {
              pushCleanClaim(seg);
            }
          }
        }
      }
    }
    return { mentionCount: mentionCount, soleClaimLines: soleClaimLines };
  }

  function updateSourcesBadgeInStudio(surface) {
    if (!surface || !surface.dataModel) return;
    const sources = resolvePointer(surface.dataModel, "/okf/sources") || [];
    const rejected = resolvePointer(surface.dataModel, "/okf/rejectedSources") || [];
    const rejSet = new Set(rejected.map(String));
    const activeCount = sources.filter(function (s) {
      return s && !rejSet.has(String(s.id));
    }).length;
    const badgeText = tClient(surface, "verifiedSourcesCount", { count: activeCount });
    setPointer(surface.dataModel, "/okf/sourcesBadge", badgeText);
    if (
      !surface.viewingStubConcept &&
      !resolvePointer(surface.dataModel, "/okf/viewingStubConcept")
    ) {
      setPointer(surface.dataModel, "/okf/primarySourcesBadge", badgeText);
    }
    if (
      surface.components &&
      surface.components["main_tabs"] &&
      Array.isArray(surface.components["main_tabs"].tabs)
    ) {
      for (let i = 0; i < surface.components["main_tabs"].tabs.length; i++) {
        const tab = surface.components["main_tabs"].tabs[i];
        if (tab && tab.child === "tab_okf_markdown" && typeof tab.title === "string") {
          tab.title = tab.title.replace(/\(\d+\)\s*$/, "(" + activeCount + ")");
        }
      }
    }
  }

  function inspectClientSourceDomainProvenance(src) {
    const rawUrl = String((src && (src.url || src.resource)) || "").trim();
    if (!rawUrl || rawUrl.indexOf("vertexaisearch.cloud.google.com/grounding-api-redirect/") !== -1) {
      return { hostname: "", isDirectFileAsset: false, claimedPublisher: "", domainMismatch: false };
    }
    let parsed = null;
    try {
      parsed = new URL(rawUrl);
    } catch (_e) {
      return { hostname: "", isDirectFileAsset: false, claimedPublisher: "", domainMismatch: false };
    }
    const hostname = String(parsed.hostname || "").toLowerCase().replace(/^www\./, "");
    if (!hostname) {
      return { hostname: "", isDirectFileAsset: false, claimedPublisher: "", domainMismatch: false };
    }
    const isDirectFileAsset =
      /\.(?:pdf|docx?|xlsx?|pptx?)(?:$|[?#])/i.test(parsed.pathname || "") ||
      /\/(?:s3assets[^/]*|getfile(?:\.aspx)?|wp-content\/uploads|uploads|attachments)\b/i.test(
        parsed.pathname || ""
      ) ||
      /(?:amazonaws\.com|cloudfront\.net|blob\.core\.windows\.net|storage\.googleapis\.com)$/i.test(
        hostname
      );
    const rawTitle = String((src && src.title) || "").trim();
    if (!rawTitle) {
      return { hostname: hostname, isDirectFileAsset: isDirectFileAsset, claimedPublisher: "", domainMismatch: false };
    }
    const viaAnnotMatch = rawTitle.match(/\s*\(via\s+([a-z0-9.-]+\.[a-z]{2,})\)\s*$/i);
    const titleWithoutVia = viaAnnotMatch
      ? rawTitle.slice(0, rawTitle.length - viaAnnotMatch[0].length).trim()
      : rawTitle;
    const sepMatch = titleWithoutVia.match(/\s+(?:([|])|[–—]|-\s)\s*([^\s–—|](?:(?!\s+-\s)[^–—|]){1,59})\s*$/);
    if (!sepMatch) {
      return { hostname: hostname, isDirectFileAsset: isDirectFileAsset, claimedPublisher: "", domainMismatch: false };
    }
    const prefixHostCandidate = titleWithoutVia
      .slice(0, sepMatch.index || 0)
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
    if (
      prefixHostCandidate &&
      (prefixHostCandidate === hostname ||
        hostname.slice(-prefixHostCandidate.length - 1) === "." + prefixHostCandidate)
    ) {
      return { hostname: hostname, isDirectFileAsset: isDirectFileAsset, claimedPublisher: "", domainMismatch: false };
    }
    const isPipeSep = sepMatch[1] === "|";
    const candidatePub = sepMatch[2].trim();
    const pubWords = candidatePub.split(/\s+/).filter(Boolean);
    if (pubWords.length === 0 || pubWords.length > 6) {
      return { hostname: hostname, isDirectFileAsset: isDirectFileAsset, claimedPublisher: "", domainMismatch: false };
    }
    if (
      (/^\p{Ll}/u.test(candidatePub) && !/\.[a-z]{2,}$/i.test(candidatePub)) ||
      /^(?:§+|(?:ch(?:apter|\.)?|sec(?:tion|\.)?|art(?:icle|\.)?|part|mod(?:ule|\.)?|step|phase|rev(?:ision|\.)?)\s*\d|table\b|figure\b|appendix\b|v\d|\d{4}\b|q[1-4]\b)/i.test(
        candidatePub
      ) ||
      (!candidatePub.includes("(") &&
        /^(?:[\p{Lu}]{2,8}[-/]\d[\w./:-]*|(?:ISO|IEC|IEEE|ANSI|ASTM|NIST|NS|EN|BS|DIN|RFC|CVE)\s*[-:]?\s*\d[\w./:+:-]*)$/u.test(
          candidatePub
        )) ||
      /^\d+[\d\s.,:\-–/]*$/.test(candidatePub)
    ) {
      return { hostname: hostname, isDirectFileAsset: isDirectFileAsset, claimedPublisher: "", domainMismatch: false };
    }
    function normClientAscii(s) {
      return String(s || "")
        .toLowerCase()
        .replace(/æ/g, "ae")
        .replace(/ø/g, "oe")
        .replace(/å/g, "aa")
        .replace(/ß/g, "ss")
        .replace(/œ/g, "oe")
        .replace(/ł/g, "l")
        .replace(/[đð]/g, "d")
        .replace(/þ/g, "th")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }
    const pubSlug = normClientAscii(candidatePub)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const srcIdLower = String((src && src.id) || "").toLowerCase();
    const idEncodesPub = Boolean(
      pubSlug &&
        pubSlug.length >= 3 &&
        (srcIdLower.slice(-pubSlug.length - 1) === "-" + pubSlug ||
          srcIdLower.indexOf(pubSlug + "-") === 0)
    );
    const hasParenAcronym = /\([\p{Lu}0-9]{2,10}\)\s*$/u.test(candidatePub);
    const hasInstitutionalRoot =
      /(?:\b(?:ministr\w*|minister\w*|minist[eè]r\w*|depart\w*|directorat\w*|agenc\w*|authorit\w*|commiss\w*|institut\w*|council|board|office|bureau|court|bank\w*|universit\w*|administrat\w*|federat\w*|associat\w*|organi[sz]at\w*|societ\w*|foundat\w*)|(?:direktorat|departement|forening|förening|forbund|förbund|verein|verband|tilsyn|styrels|myndighet|anstalt|behörde)\w*)\b/i.test(
        candidatePub
      );
    const isSentenceCaseSubtitle =
      pubWords.length >= 2 &&
      !hasInstitutionalRoot &&
      /^\p{Ll}/u.test(pubWords[1]) &&
      !/^(?:for|of|in|on|to|by|at|de|du|des|la|le|les|van|von|zu|fur|für|af|av|og|and|und|och|et|del|della|para|con|por)$/i.test(
        pubWords[1]
      );
    if (
      !isPipeSep &&
      !hasParenAcronym &&
      !idEncodesPub &&
      (pubWords.length > 4 ||
        isSentenceCaseSubtitle ||
        (!hasInstitutionalRoot &&
          /\b(?:overview|introduction|summary|guide|guidance|guidelines|manual|handbook|whitepaper|circular|playbook|brief|standard|directive|checklist|analysis|assessment|requirements|actions|report|edition|key\s+points|veileder|veiledning|temaveiledning|rundskriv|rapport|forskrift|retningslinjer|handbok|håndbok|sjekkliste|oversikt|innledning|sammenstilling|richtlinie|leitfaden|handbuch|merkblatt|bericht|guide\s+pratique|manuel|guía|informe|manuale|relazione)\b/iu.test(
            candidatePub
          )))
    ) {
      return { hostname: hostname, isDirectFileAsset: isDirectFileAsset, claimedPublisher: "", domainMismatch: false };
    }
    if (
      /(?:^|\.)(?:gov|gov\.[a-z]{2}|gob\.[a-z]{2}|gouv\.[a-z]{2}|gv\.[a-z]{2}|go\.[a-z]{2}|mil|mil\.[a-z]{2}|int)$/i.test(
        hostname
      ) ||
      /(?:^|\.)(?:europa\.eu|canada\.ca|usa\.gov|bund\.de|bundesregierung\.de|admin\.ch|rijksoverheid\.nl|overheid\.nl|gouvernement\.fr|regeringen\.se|riksdagen\.se|regeringen\.dk|regjeringen\.no|stortinget\.no|who\.int|un\.org|oecd\.org|worldbank\.org)$/i.test(
        hostname
      )
    ) {
      return {
        hostname: hostname,
        isDirectFileAsset: isDirectFileAsset,
        claimedPublisher: candidatePub,
        domainMismatch: false,
      };
    }
    const sldRegistries = new Set([
      "co", "com", "org", "or", "net", "ne", "edu", "ed", "ac", "gov", "gob", "gouv", "gv", "go", "mil", "nic", "asn", "re", "lg", "nhs"
    ]);
    const infraPrefixes = new Set([
      "www", "www2", "wwwex", "web", "secure", "portal", "app", "api", "data", "opendata", "open", "developer", "developers", "docs", "cdn", "static", "files", "media"
    ]);
    const rawHostParts = hostname
      .split(".")
      .map(function (p) { return p.replace(/[^a-z0-9]/g, ""); })
      .filter(Boolean);
    const withoutTld = rawHostParts.length >= 2 ? rawHostParts.slice(0, -1) : rawHostParts;
    const withoutSld =
      withoutTld.length >= 2 && sldRegistries.has(withoutTld[withoutTld.length - 1])
        ? withoutTld.slice(0, -1)
        : withoutTld;
    const hostTokens = withoutSld.filter(function (p) { return p.length >= 2 && !infraPrefixes.has(p); });
    if (hostTokens.length === 0) {
      return {
        hostname: hostname,
        isDirectFileAsset: isDirectFileAsset,
        claimedPublisher: candidatePub,
        domainMismatch: false,
      };
    }
    const articleTokens = new Set(["the", "la", "le", "les", "de", "het", "een", "der", "die", "das"]);
    const prepTokens = new Set([
      "for", "of", "in", "on", "to", "by", "at", "from", "with", "about", "into", "over", "under",
      "om", "i", "pa", "til", "av", "ved", "fra", "hos", "mot",
      "fur", "von", "zu", "sur", "dans", "pour", "par", "con", "sobre", "van", "bij"
    ]);
    const pubStop = new Set([
      "the", "la", "le", "les", "de", "het", "een", "der", "die", "das",
      "for", "of", "in", "on", "to", "by", "at", "from", "with", "about", "into", "over", "under",
      "om", "i", "pa", "til", "av", "ved", "fra", "hos", "mot",
      "fur", "von", "zu", "sur", "dans", "pour", "par", "con", "sobre", "van", "bij",
      "og", "and", "och", "und", "et", "du", "des", "us", "uk"
    ]);
    function doesClientPubMatchHostToken(pubStr, hp, strictLeading, allowParenRecursion) {
      if (!strictLeading && allowParenRecursion !== false) {
        const parenFullRe = /\(([^()]{2,80})\)/g;
        let pfm;
        while ((pfm = parenFullRe.exec(String(pubStr || ""))) !== null) {
          const parenInner = pfm[1].trim();
          if (parenInner && doesClientPubMatchHostToken(parenInner, hp, false, false)) {
            return true;
          }
        }
      }
      const stripped = String(pubStr || "").replace(/\([^)]*\)/g, " ");
      const allTokens = normClientAscii(stripped)
        .split(/[^a-z0-9]+/)
        .filter(function (t) { return t.length >= 2; });
      const trimmedLead = allTokens.slice();
      while (trimmedLead.length > 1 && articleTokens.has(trimmedLead[0])) {
        trimmedLead.shift();
      }
      if (strictLeading && (trimmedLead.length === 0 || prepTokens.has(trimmedLead[0]))) {
        return false;
      }
      const rawPubTokens = allTokens.filter(function (t) { return !pubStop.has(t); });
      const pubJoined = rawPubTokens.join("");
      const acronyms = new Set();
      const parenRe = /\(([\p{L}\p{N}]{2,12})\)/gu;
      let pm;
      while ((pm = parenRe.exec(pubStr)) !== null) {
        acronyms.add(normClientAscii(pm[1]).replace(/[^a-z0-9]/g, ""));
      }
      const upperRe = /(?:^|[^\p{L}\p{N}])([\p{Lu}]{2,10})(?=$|[^\p{L}\p{N}])/gu;
      let um;
      while ((um = upperRe.exec(pubStr)) !== null) {
        acronyms.add(normClientAscii(um[1]).replace(/[^a-z0-9]/g, ""));
      }
      if (rawPubTokens.length >= 2) {
        acronyms.add(rawPubTokens.map(function (t) { return t[0]; }).join(""));
      }
      if (allTokens.length >= 2 && allTokens.length <= 6) {
        acronyms.add(allTokens.map(function (t) { return t[0]; }).join(""));
      }
      if (acronyms.has(hp)) return true;
      let acMatch = false;
      acronyms.forEach(function (ac) {
        if (ac.length >= 3 && (hp.indexOf(ac) !== -1 || ac.indexOf(hp) !== -1)) acMatch = true;
      });
      if (acMatch) return true;
      if (strictLeading) {
        let firstPrepIdx = -1;
        for (let fi = 0; fi < trimmedLead.length; fi++) {
          if (prepTokens.has(trimmedLead[fi])) {
            firstPrepIdx = fi;
            break;
          }
        }
        const prePrep = firstPrepIdx === -1 ? trimmedLead : trimmedLead.slice(0, firstPrepIdx);
        for (let k = 0; k < Math.min(2, prePrep.length); k++) {
          if (k === 1 && (prePrep.length !== 2 || firstPrepIdx !== -1)) continue;
          const pt = prePrep[k];
          if (pubStop.has(pt)) continue;
          if (pt === hp) return true;
          if (pt.length >= 4 && hp.indexOf(pt) !== -1) return true;
          if (hp.length >= 4 && pt.indexOf(hp) !== -1) return true;
        }
      } else {
        for (let k = 0; k < rawPubTokens.length; k++) {
          const pt = rawPubTokens[k];
          if (pt === hp) return true;
          if (pt.length >= 4 && hp.indexOf(pt) !== -1) return true;
          if (hp.length >= 4 && pt.indexOf(hp) !== -1) return true;
        }
      }
      if (hp.length >= 4 && pubJoined.indexOf(hp[0]) === 0 && pubJoined.indexOf(hp.slice(1)) !== -1) {
        return true;
      }
      for (let splitAt = 2; splitAt <= Math.min(4, hp.length - 3); splitAt++) {
        if (
          pubJoined.indexOf(hp.slice(0, splitAt)) === 0 &&
          pubJoined.indexOf(hp.slice(splitAt), splitAt) !== -1
        ) {
          return true;
        }
      }
      if (rawPubTokens.length >= 2 && hp.length >= 3 && hp.length <= 8) {
        function matchClientSyllabicTokens(tokIdx, hpIdx) {
          if (tokIdx === rawPubTokens.length) return hpIdx === hp.length;
          if (hpIdx >= hp.length) return false;
          const tok = rawPubTokens[tokIdx];
          if (tok[0] !== hp[hpIdx]) return false;
          const maxPrefix = Math.min(4, tok.length, hp.length - hpIdx);
          for (let len = 1; len <= maxPrefix; len++) {
            if (tok.slice(0, len) === hp.slice(hpIdx, hpIdx + len)) {
              if (matchClientSyllabicTokens(tokIdx + 1, hpIdx + len)) return true;
            }
          }
          if (tok.length >= 8) {
            const maxStem = Math.min(4, hp.length - hpIdx - 1);
            for (let remLen = 1; remLen <= maxStem; remLen++) {
              const sub = hp.slice(hpIdx + 1, hpIdx + 1 + remLen);
              const minOffset = remLen === 1 ? 3 : 2;
              if (tok.indexOf(sub, minOffset) !== -1) {
                if (matchClientSyllabicTokens(tokIdx + 1, hpIdx + 1 + remLen)) return true;
              }
            }
          }
          return false;
        }
        if (matchClientSyllabicTokens(0, 0)) return true;
      }
      return false;
    }
    const matchesHost = hostTokens.some(function (hp) {
      return doesClientPubMatchHostToken(candidatePub, hp, false);
    });
    if (!matchesHost && !viaAnnotMatch && !idEncodesPub && !hasParenAcronym) {
      const rawPrefix = titleWithoutVia.slice(0, sepMatch.index || 0).trim();
      if (rawPrefix && !/\s+(?:[|–—]\s*|-\s+)/.test(rawPrefix)) {
        const leadOrg = rawPrefix.split(/\s*[/:∕]\s*/)[0].trim();
        const leadWords = leadOrg.split(/\s+/).filter(Boolean);
        const leadNorm = normClientAscii(leadOrg);
        const primaryHostToken = hostTokens[hostTokens.length - 1];
        const srcIdStartsWithHost = srcIdLower.indexOf(primaryHostToken + "-") === 0;
        const leadAcronyms = new Set();
        const leadParenRe = /\(([\p{L}\p{N}]{2,12})\)/gu;
        let lpm;
        while ((lpm = leadParenRe.exec(leadOrg)) !== null) {
          leadAcronyms.add(normClientAscii(lpm[1]).replace(/[^a-z0-9]/g, ""));
        }
        const leadUpperRe = /(?:^|[^\p{L}\p{N}])([\p{Lu}]{2,10})(?=$|[^\p{L}\p{N}])/gu;
        let lum;
        while ((lum = leadUpperRe.exec(leadOrg)) !== null) {
          leadAcronyms.add(normClientAscii(lum[1]).replace(/[^a-z0-9]/g, ""));
        }
        const leadHasHostAcronym = leadAcronyms.has(primaryHostToken);
        const isStatuteOrDocTitle =
          !srcIdStartsWithHost &&
          !leadHasHostAcronym &&
          (/^(?:lov|forskrift|veileder|veiledning|retningslinjer|rundskriv|rapport|kapittel|del|act|law|regulation|statute|directive|ordinance|guidance|guide|report|form|gesetz|verordnung|loi|decret|ley|decreto)\b/.test(
            leadNorm
          ) ||
            /(?:loven|forskriften|\s+(?:act|law|statute|regulation|directive|ordinance|gesetz|verordnung))$/.test(
              leadNorm
            ));
        if (leadWords.length >= 1 && leadWords.length <= 7 && !isStatuteOrDocTitle) {
          const allHostTokensAccounted =
            hostTokens.length === 1 ||
            srcIdStartsWithHost ||
            leadHasHostAcronym ||
            hostTokens.every(function (hp) { return doesClientPubMatchHostToken(rawPrefix, hp, false); });
          if (
            allHostTokensAccounted &&
            (pubWords.length >= 2 || srcIdStartsWithHost || leadHasHostAcronym) &&
            doesClientPubMatchHostToken(leadOrg, primaryHostToken, true)
          ) {
            return {
              hostname: hostname,
              isDirectFileAsset: isDirectFileAsset,
              claimedPublisher: "",
              domainMismatch: false,
            };
          }
        }
      }
    }
    return {
      hostname: hostname,
      isDirectFileAsset: isDirectFileAsset,
      claimedPublisher: candidatePub,
      domainMismatch: !matchesHost || Boolean(viaAnnotMatch),
    };
  }

  function inferClientSourceMimeInfo(src) {
    if (!src || typeof src !== "object") {
      return {
        mimeType: "",
        group: "other",
        shortLabel: "",
        badgeLabel: "",
        cssClass: "mime-doc",
      };
    }
    let rawMime = String(src.mime_type || src.mimeType || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const rawUrl = String(src.url || src.resource || "").trim();
    const cleanUrlPath = rawUrl ? rawUrl.split("#")[0].split("?")[0].toLowerCase() : "";
    if (!rawMime && rawUrl) {
      if (/\.pdf$/.test(cleanUrlPath) || /[?&](?:format|type|output)=pdf\b/i.test(rawUrl)) {
        rawMime = "application/pdf";
      } else if (/\.xml$|\.xsd$/.test(cleanUrlPath) || /[?&](?:format|type|output)=xml\b/i.test(rawUrl)) {
        rawMime = "application/xml";
      } else if (/\.json$|\.jsonl$|\.geojson$/.test(cleanUrlPath) || /[?&](?:format|type|output)=json\b/i.test(rawUrl)) {
        rawMime = "application/json";
      } else if (/\.csv$|\.tsv$/.test(cleanUrlPath) || /[?&](?:format|type|output)=csv\b/i.test(rawUrl)) {
        rawMime = "text/csv";
      } else if (/\.bz2$/.test(cleanUrlPath)) {
        rawMime = "application/x-bzip2";
      } else if (/\.gz$|\.tgz$/.test(cleanUrlPath)) {
        rawMime = "application/gzip";
      } else if (/\.zip$/.test(cleanUrlPath)) {
        rawMime = "application/zip";
      } else if (/\.tar$/.test(cleanUrlPath)) {
        rawMime = "application/x-tar";
      } else if (/\.xz$|\.txz$/.test(cleanUrlPath)) {
        rawMime = "application/x-xz";
      } else if (/\.zst$/.test(cleanUrlPath)) {
        rawMime = "application/zstd";
      } else if (/\.7z$/.test(cleanUrlPath)) {
        rawMime = "application/x-7z-compressed";
      } else if (/\.parquet$/.test(cleanUrlPath)) {
        rawMime = "application/vnd.apache.parquet";
      } else if (/\.md$|\.markdown$/.test(cleanUrlPath)) {
        rawMime = "text/markdown";
      } else if (/\.docx$/.test(cleanUrlPath)) {
        rawMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (/\.xlsx$/.test(cleanUrlPath)) {
        rawMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else if (/\.pptx$/.test(cleanUrlPath)) {
        rawMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      } else if (/\.txt$/.test(cleanUrlPath)) {
        rawMime = "text/plain";
      } else if (/^https?:\/\//i.test(rawUrl)) {
        rawMime = "text/html";
      }
    }
    if (!rawMime) {
      return {
        mimeType: "",
        group: "other",
        shortLabel: "",
        badgeLabel: "",
        cssClass: "mime-doc",
      };
    }
    if (rawMime === "application/pdf") {
      return {
        mimeType: rawMime,
        group: "pdf",
        shortLabel: "PDF",
        badgeLabel: "📄 PDF · application/pdf",
        cssClass: "mime-pdf",
      };
    }
    if (rawMime === "text/html" || rawMime === "application/xhtml+xml") {
      return {
        mimeType: rawMime,
        group: "html",
        shortLabel: "HTML",
        badgeLabel: "🌐 HTML · " + rawMime,
        cssClass: "mime-html",
      };
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
      else if (rawMime === "application/x-bzip2") shortTag = /\.tar\.bz2$/.test(cleanUrlPath) ? "TAR.BZ2" : "BZ2";
      else if (rawMime === "application/gzip") shortTag = /\.(?:tar\.gz|tgz)$/.test(cleanUrlPath) ? "TAR.GZ" : "GZIP";
      else if (rawMime === "application/zip") shortTag = "ZIP";
      else if (rawMime === "application/x-tar") shortTag = "TAR";
      else if (rawMime === "application/x-xz") shortTag = /\.(?:tar\.xz|txz)$/.test(cleanUrlPath) ? "TAR.XZ" : "XZ";
      else if (rawMime === "application/zstd") shortTag = "ZSTD";
      else if (rawMime === "application/x-7z-compressed") shortTag = "7Z";
      else if (rawMime === "application/vnd.apache.parquet") shortTag = "PARQUET";
      return {
        mimeType: rawMime,
        group: "data",
        shortLabel: shortTag,
        badgeLabel: "🗂️ " + shortTag + " · " + rawMime,
        cssClass: "mime-data",
      };
    }
    let docTag = "DOC";
    if (rawMime.indexOf("wordprocessingml") !== -1 || rawMime === "application/msword") docTag = "DOCX";
    else if (rawMime.indexOf("spreadsheetml") !== -1 || rawMime === "application/vnd.ms-excel") docTag = "XLSX";
    else if (rawMime.indexOf("presentationml") !== -1) docTag = "PPTX";
    else if (rawMime === "text/markdown") docTag = "MD";
    else if (rawMime === "text/plain") docTag = "TXT";
    return {
      mimeType: rawMime,
      group: "doc",
      shortLabel: docTag,
      badgeLabel: "📝 " + docTag + " · " + rawMime,
      cssClass: "mime-doc",
    };
  }

  function formatClientUrlMiddleEllipsis(rawUrl, maxChars) {
    const limit = typeof maxChars === "number" && maxChars > 24 ? maxChars : 78;
    const s = String(rawUrl || "").trim();
    if (!s) return "";
    const stripped = s.replace(/^https?:\/\/(?:www\.)?/i, "");
    if (stripped.length <= limit) return stripped;
    const qIdx = stripped.indexOf("?");
    const pathPart = qIdx !== -1 ? stripped.slice(0, qIdx) : stripped;
    const querySuffix = qIdx !== -1 ? stripped.slice(qIdx) : "";
    const segments = pathPart.split("/").filter(Boolean);
    if (segments.length >= 3) {
      const host = segments[0];
      const firstDir = segments[1];
      const parentDir = segments[segments.length - 2];
      const lastSeg = segments[segments.length - 1] + (querySuffix.length <= 16 ? querySuffix : "");
      const tailMax = Math.max(24, Math.min(44, limit - host.length - 6));
      const tail = lastSeg.length > tailMax ? "…" + lastSeg.slice(-(tailMax - 1)) : lastSeg;
      const isGenericAssetBucket =
        /^(?:globalassets|contentassets|siteassets|assets|files|media|uploads|documents|static|blob|public)$/i.test(
          firstDir
        );
      if (isGenericAssetBucket && segments.length >= 5) {
        const withSemanticAndParent =
          segments.length === 5
            ? host + "/…/" + segments[2] + "/" + parentDir + "/" + tail
            : host + "/…/" + segments[2] + "/…/" + parentDir + "/" + tail;
        if (withSemanticAndParent.length <= limit + 4) return withSemanticAndParent;
      }
      if (!isGenericAssetBucket && segments.length >= 4) {
        const withFirstAndParent = host + "/" + firstDir + "/…/" + parentDir + "/" + tail;
        if (withFirstAndParent.length <= limit + 4) return withFirstAndParent;
        const withParentOnly = host + "/…/" + parentDir + "/" + tail;
        if (withParentOnly.length <= limit + 4) return withParentOnly;
      }
      if (isGenericAssetBucket && segments.length >= 4) {
        const withTwoDirs = host + "/" + firstDir + "/" + segments[2] + "/…/" + tail;
        if (withTwoDirs.length <= limit + 4) return withTwoDirs;
        const withParentDir = host + "/…/" + parentDir + "/" + tail;
        if (withParentDir.length <= limit + 4) return withParentDir;
        const withSemanticDir = host + "/…/" + segments[2] + "/…/" + tail;
        if (withSemanticDir.length <= limit + 4) return withSemanticDir;
      }
      const withFirstDir = host + "/" + firstDir + "/…/" + tail;
      if (withFirstDir.length <= limit + 4) return withFirstDir;
      const hostOnly = host + "/…/" + tail;
      if (hostOnly.length <= limit + 4) return hostOnly;
    }
    const tailKeep = Math.max(22, Math.floor((limit - 1) * 0.45));
    const headKeep = Math.max(16, limit - 1 - tailKeep);
    return stripped.slice(0, headKeep) + "…" + stripped.slice(-tailKeep);
  }

  function inspectClientSourceAttentionSignals(src, prov) {
    const rawUrl = String((src && (src.url || src.resource)) || "").trim();
    let decodedUrl = rawUrl;
    try {
      decodedUrl = decodeURIComponent(rawUrl);
    } catch (_e) {
      decodedUrl = rawUrl;
    }
    const archiveSegmentRe =
      /\/(?:[a-z_-]*(?:histor(?:y|ic|ical|ikk|ie)|archiv(?:e|es)?|arkiv|changelog|changetrack)|superseded|repealed|obsolete|deprecated|old-versions|prior-versions)(?:\/|$|[-_.])/i;
    let isHistoricalRangeFile = false;
    const nowYear = new Date().getUTCFullYear();
    const rangeMatch = decodedUrl.match(
      /(?:19\d{2}|20\d{2})(?:[._-]\d{2}[._-]\d{2})?\s*[-–_]\s*(?:\d{2}[._-]\d{2}[._-])?(19\d{2}|20\d{2})\b/
    );
    if (rangeMatch && rangeMatch[1]) {
      const endYear = parseInt(rangeMatch[1], 10);
      if (endYear >= 1970 && endYear <= nowYear - 2) {
        isHistoricalRangeFile = true;
      }
    } else {
      const dmyRangeMatch = decodedUrl.match(
        /\b\d{2}\.\d{2}\.(19\d{2}|20\d{2})\s*[-–_]\s*\d{2}\.\d{2}\.(19\d{2}|20\d{2})\b/
      );
      if (dmyRangeMatch && dmyRangeMatch[2]) {
        const endYear2 = parseInt(dmyRangeMatch[2], 10);
        if (endYear2 >= 1970 && endYear2 <= nowYear - 2) {
          isHistoricalRangeFile = true;
        }
      }
    }

    let isDatedStaticSnapshot = false;
    const rawMime = String((src && (src.mime_type || src.mimeType)) || "").trim().toLowerCase();
    const isStaticSnapshotFile =
      Boolean(prov && prov.isDirectFileAsset) ||
      rawMime.indexOf("application/pdf") === 0 ||
      /\.pdf(?:$|[?#])/i.test(decodedUrl);
    if (isStaticSnapshotFile) {
      const rawMod = String((src && (src.last_modified || src.lastModified)) || "").trim();
      const modYearMatch = rawMod.match(/^(19\d{2}|20\d{2})\b/);
      if (modYearMatch && modYearMatch[1]) {
        const modYear = parseInt(modYearMatch[1], 10);
        if (modYear >= 1970 && modYear <= nowYear - 5) {
          isDatedStaticSnapshot = true;
        }
      } else if (!rawMod) {
        const pathWithoutHost = decodedUrl
          .replace(/^https?:\/\/[^/?#]+/i, "")
          .split(/[?#]/)[0];
        const yearRe = /(?:^|[^0-9])(19[7-9]\d|20\d{2})(?=[^0-9]|$)/g;
        let ym;
        while ((ym = yearRe.exec(pathWithoutHost)) !== null) {
          const yr = parseInt(ym[1], 10);
          if (yr >= 1970 && yr <= nowYear - 5) {
            isDatedStaticSnapshot = true;
            break;
          }
        }
      }
    }

    const isHistoricalOrArchiveUrl =
      archiveSegmentRe.test(decodedUrl) || isHistoricalRangeFile || isDatedStaticSnapshot;
    const domainMismatch = Boolean(prov && prov.domainMismatch);
    return {
      domainMismatch: domainMismatch,
      isHistoricalOrArchiveUrl: isHistoricalOrArchiveUrl,
      isDatedStaticSnapshot: isDatedStaticSnapshot,
      needsAttention: domainMismatch || isHistoricalOrArchiveUrl,
    };
  }

  function buildCurationPrompts(surface) {
    if (!surface || !surface.dataModel) {
      return { agyText: "", cliText: "" };
    }
    const defaultActor = tClient(surface, "defaultVerifierActor") || "human:reviewer";
    const isStage1Only = Boolean(
      resolvePointer(surface.dataModel, "/stage1/isStage1Only") ||
        resolvePointer(surface.dataModel, "/meta/isStage1Only")
    );
    const runId = String(resolvePointer(surface.dataModel, "/meta/runId") || "<runId>");
    const rejectedRaw = (resolvePointer(surface.dataModel, "/okf/rejectedSources") || [])
      .filter(Boolean)
      .map(String);
    const rejectedSet = new Set(rejectedRaw);
    const addedRaw = (resolvePointer(surface.dataModel, "/okf/addedSources") || []).filter(function (a) {
      return a && a.url;
    });
    const addedIdSet = new Set(
      addedRaw
        .map(function (a) {
          return String(a.id || "");
        })
        .filter(Boolean)
    );
    const rejected = rejectedRaw.filter(function (id) {
      return !addedIdSet.has(id);
    });
    const added = addedRaw.filter(function (a) {
      return !a.id || !rejectedSet.has(String(a.id));
    });
    const replacedRaw = resolvePointer(surface.dataModel, "/okf/replacedSources") || {};
    const replaceKeySet = new Set();
    for (let rIdx = 0; rIdx < rejected.length; rIdx++) {
      replaceKeySet.add(rejected[rIdx]);
    }
    Object.keys(replacedRaw).forEach(function (k) {
      if (k) replaceKeySet.add(String(k));
    });
    const replacePairs = [];
    replaceKeySet.forEach(function (oldKey) {
      const replTarget = String(replacedRaw[oldKey] || "").trim();
      if (replTarget && replTarget !== oldKey && !rejectedSet.has(replTarget)) {
        replacePairs.push(oldKey + "=" + replTarget);
      }
    });
    let byActor = String(resolvePointer(surface.dataModel, "/okf/verifierActor") || "").trim();
    const isMachineVerifierActor = function (actorStr) {
      if (!actorStr) return false;
      return (
        /^(?:process|team):/i.test(actorStr) ||
        /^icm-co-architect\b/i.test(actorStr) ||
        (!/^human:/i.test(actorStr) && actorStr.indexOf("/") !== -1)
      );
    };
    const normalizeHumanActorId = function (rawStr, fallbackStr) {
      const cleaned = String(rawStr || "").trim();
      if (!cleaned) return String(fallbackStr || "human:reviewer").replace(/\s+/g, "-");
      const schemeMatch = cleaned.match(/^([A-Za-z][A-Za-z0-9+.-]*):(.*)$/);
      if (schemeMatch) {
        return schemeMatch[1].toLowerCase() + ":" + (schemeMatch[2].trim().replace(/\s+/g, "-") || "reviewer");
      }
      return "human:" + cleaned.replace(/\s+/g, "-");
    };
    if (
      !byActor ||
      isMachineVerifierActor(byActor) ||
      byActor === defaultActor ||
      byActor === "human:reviewer"
    ) {
      if (isMachineVerifierActor(byActor)) {
        byActor = "";
      }
      try {
        const savedActor =
          typeof localStorage !== "undefined"
            ? String(localStorage.getItem("icm_a2ui_verifier_actor") || "").trim()
            : "";
        if (savedActor && !isMachineVerifierActor(savedActor)) {
          byActor = savedActor;
        }
      } catch (_e) {}
    }
    byActor = normalizeHumanActorId(byActor, defaultActor);
    const byFlagPart = "--by " + byActor;

    const cliParts = ["npm run cli:verify -- " + runId];
    if (rejected.length > 0) {
      cliParts.push("--reject-source " + rejected.join(","));
    }
    for (let rpIdx = 0; rpIdx < replacePairs.length; rpIdx++) {
      const rp = replacePairs[rpIdx];
      cliParts.push(
        /[\s|&;()"]/.test(rp)
          ? '--replace-source "' + rp.replace(/"/g, '\\"') + '"'
          : "--replace-source " + rp
      );
    }
    for (let i = 0; i < added.length; i++) {
      const item = added[i];
      const spec =
        item.title && item.title !== item.url ? item.url + "|" + item.title : item.url;
      cliParts.push('--add-source "' + String(spec).replace(/"/g, '\\"') + '"');
    }
    cliParts.push(byFlagPart);
    const cliText = cliParts.join(" ");

    let agyText = "";
    if (rejected.length === 0 && added.length === 0 && replacePairs.length === 0) {
      agyText = tClient(surface, isStage1Only ? "agyApproveStage1" : "agyApproveFull", {
        cli: cliText,
      });
    } else {
      const rejList = rejected.join(", ");
      const addList = added
        .map(function (a) {
          return a.title && a.title !== a.url ? a.url + "|" + a.title : a.url;
        })
        .join(", ");
      const segs = [];
      if (rejected.length > 0) segs.push(tClient(surface, "agyRejectPrefix", { list: rejList }));
      if (replacePairs.length > 0) {
        segs.push(tClient(surface, "agyReplacePrefix", { list: replacePairs.join(", ") }));
      }
      if (added.length > 0) segs.push(tClient(surface, "agyAddPrefix", { list: addList }));
      segs.push(
        tClient(surface, isStage1Only ? "agyCurateRunStage1" : "agyCurateRunFull", {
          cli: cliText,
        })
      );
      agyText = segs.join(" ");
    }

    setPointer(surface.dataModel, "/okf/curationAgyText", agyText);
    setPointer(surface.dataModel, "/okf/curationCliText", cliText);
    return { agyText: agyText, cliText: cliText };
  }

  function slugifySourceIdInStudio(rawText, existingIds) {
    const existingSet =
      existingIds instanceof Set
        ? existingIds
        : new Set(Array.isArray(existingIds) ? existingIds.map(String) : []);
    const base =
      String(rawText || "")
        .toLowerCase()
        .replace(/æ/g, "ae")
        .replace(/ø/g, "oe")
        .replace(/å/g, "aa")
        .replace(/^https?:\/\/(?:www\.)?/i, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 28)
        .replace(/-+$/g, "") || "source";
    let candidate = base;
    let counter = 2;
    while (existingSet.has(candidate)) {
      candidate = base + "-" + counter;
      counter++;
    }
    return candidate;
  }

  function setReplaceSourceInStudio(surface, oldId, newTarget) {
    const cleanOld = String(oldId || "").trim();
    if (!surface || !surface.dataModel || !cleanOld) return {};
    const currentMap = Object.assign(
      {},
      resolvePointer(surface.dataModel, "/okf/replacedSources") || {}
    );
    const openMap = Object.assign(
      {},
      resolvePointer(surface.dataModel, "/okf/replaceOpenSources") || {}
    );
    let cleanTarget = String(newTarget || "").trim();
    if (
      cleanTarget &&
      !/^[A-Za-z0-9_\-]+$/.test(cleanTarget) &&
      !/^https?:\/\//i.test(cleanTarget) &&
      /^[a-z0-9.-]+\.[a-z]{2,}\/\S*$/i.test(cleanTarget)
    ) {
      cleanTarget = "https://" + cleanTarget;
    }
    if (!cleanTarget || cleanTarget === cleanOld) {
      delete currentMap[cleanOld];
    } else {
      currentMap[cleanOld] = cleanTarget;
      openMap[cleanOld] = true;
    }
    setPointer(surface.dataModel, "/okf/replacedSources", currentMap);
    setPointer(surface.dataModel, "/okf/replaceOpenSources", openMap);
    buildCurationPrompts(surface);
    if (
      typeof renderSurface === "function" &&
      typeof document !== "undefined" &&
      document.getElementById &&
      document.getElementById("a2ui-surface-root")
    ) {
      renderSurface();
    }
    return currentMap;
  }

  function toggleReplacePanelInStudio(surface, srcId) {
    const cleanId = String(srcId || "").trim();
    if (!surface || !surface.dataModel || !cleanId) return {};
    const openMap = Object.assign(
      {},
      resolvePointer(surface.dataModel, "/okf/replaceOpenSources") || {}
    );
    const replacedMap = Object.assign(
      {},
      resolvePointer(surface.dataModel, "/okf/replacedSources") || {}
    );
    const rejectedList = resolvePointer(surface.dataModel, "/okf/rejectedSources") || [];
    const isRej = rejectedList.indexOf(cleanId) !== -1;
    if (!isRej && replacedMap[cleanId]) {
      delete replacedMap[cleanId];
      delete openMap[cleanId];
    } else if (openMap[cleanId]) {
      delete openMap[cleanId];
    } else {
      openMap[cleanId] = true;
    }
    setPointer(surface.dataModel, "/okf/replacedSources", replacedMap);
    setPointer(surface.dataModel, "/okf/replaceOpenSources", openMap);
    buildCurationPrompts(surface);
    if (
      typeof renderSurface === "function" &&
      typeof document !== "undefined" &&
      document.getElementById &&
      document.getElementById("a2ui-surface-root")
    ) {
      renderSurface();
    }
    return openMap;
  }

  function toggleRejectSourceInStudio(surface, srcId) {
    const cleanId = String(srcId || "").trim();
    if (!surface || !surface.dataModel || !cleanId) return [];
    const current = (resolvePointer(surface.dataModel, "/okf/rejectedSources") || []).slice();
    const replacedMap = Object.assign(
      {},
      resolvePointer(surface.dataModel, "/okf/replacedSources") || {}
    );
    const openMap = Object.assign(
      {},
      resolvePointer(surface.dataModel, "/okf/replaceOpenSources") || {}
    );
    delete openMap[cleanId];
    const idx = current.indexOf(cleanId);
    if (idx === -1) {
      current.push(cleanId);
      const sourcesList = resolvePointer(surface.dataModel, "/okf/sources") || [];
      let rejUrl = "";
      for (let i = 0; i < sourcesList.length; i++) {
        if (sourcesList[i] && String(sourcesList[i].id) === cleanId) {
          rejUrl = String(sourcesList[i].url || sourcesList[i].resource || "");
          break;
        }
      }
      Object.keys(replacedMap).forEach(function (k) {
        if (replacedMap[k] === cleanId || (rejUrl && replacedMap[k] === rejUrl)) {
          delete replacedMap[k];
        }
      });
    } else {
      current.splice(idx, 1);
      delete replacedMap[cleanId];
    }
    setPointer(surface.dataModel, "/okf/rejectedSources", current);
    setPointer(surface.dataModel, "/okf/replacedSources", replacedMap);
    setPointer(surface.dataModel, "/okf/replaceOpenSources", openMap);

    const bodyMd = String(resolvePointer(surface.dataModel, "/okf/body") || "");
    const sources = resolvePointer(surface.dataModel, "/okf/sources") || [];
    const statsMap = {};
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      if (s && s.id) {
        statsMap[s.id] = inspectSourceCitationsInBody(bodyMd, s.id, current);
      }
    }
    setPointer(surface.dataModel, "/okf/sourceCitationStats", statsMap);
    updateSourcesBadgeInStudio(surface);
    buildCurationPrompts(surface);

    if (
      typeof renderSurface === "function" &&
      typeof document !== "undefined" &&
      document.getElementById &&
      document.getElementById("a2ui-surface-root")
    ) {
      renderSurface();
    }
    return current;
  }

  function addSourceInStudio(surface, url, title) {
    const cleanUrl = String(url || "").trim();
    if (!surface || !surface.dataModel || !cleanUrl) return null;
    const rawTitle = String(title || "").trim();
    const cleanTitle = rawTitle || cleanUrl;
    const sources = (resolvePointer(surface.dataModel, "/okf/sources") || []).slice();
    const existingIds = new Set(
      sources.map(function (s) {
        return String((s && s.id) || "");
      })
    );
    const id = slugifySourceIdInStudio(rawTitle || cleanUrl, existingIds);
    const retrievedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const inferredMime = inferClientSourceMimeInfo({ url: cleanUrl, resource: cleanUrl });
    const newSrc = {
      id: id,
      resource: cleanUrl,
      url: cleanUrl,
      title: cleanTitle,
      ...(inferredMime.mimeType ? { mime_type: inferredMime.mimeType } : {}),
      retrieved_at: retrievedAt,
      addedByHuman: true,
    };
    sources.push(newSrc);
    setPointer(surface.dataModel, "/okf/sources", sources);

    const added = (resolvePointer(surface.dataModel, "/okf/addedSources") || []).slice();
    added.push({ id: id, url: cleanUrl, title: rawTitle });
    setPointer(surface.dataModel, "/okf/addedSources", added);

    const curBody = String(resolvePointer(surface.dataModel, "/okf/body") || "");
    const updatedBody = curBody.replace(/\s*$/, "") + "\n[^" + id + "]: " + cleanTitle + "\n";
    setPointer(surface.dataModel, "/okf/body", updatedBody);
    if (
      !surface.viewingStubConcept &&
      !resolvePointer(surface.dataModel, "/okf/viewingStubConcept")
    ) {
      setPointer(surface.dataModel, "/okf/primaryBody", updatedBody);
      setPointer(surface.dataModel, "/okf/primarySources", sources);
    }

    updateSourcesBadgeInStudio(surface);
    buildCurationPrompts(surface);

    if (
      typeof renderSurface === "function" &&
      typeof document !== "undefined" &&
      document.getElementById &&
      document.getElementById("a2ui-surface-root")
    ) {
      renderSurface();
    }
    return newSrc;
  }

  var payload = (typeof window !== "undefined" && window.A2UI_SURFACE_PAYLOAD) || {};
  var messages = payload.messages || [];
  var bundleGraph = payload.bundleGraph || { nodes: [], edges: [], bodies: {}, types: [], palette: {}, conceptMeta: {}, sourceNodeByFnId: {}, sourceNodeByAnyFnId: {} };
  var bundleRuns = Array.isArray(payload.bundleRuns) ? payload.bundleRuns : [];
  var mediaUrisByRun = payload.mediaUrisByRun || {};

  // A2UI Client Surface State (Adjacency List + RFC 6901 JSON Pointer Data Model)
  const surfaces = {};
  const actionLog = [];
  let activeSurfaceId = payload.surfaceId || "icm_run_studio";

  function mountSurface(surface) {
    if (surface && surface.surfaceId) {
      surfaces[surface.surfaceId] = surface;
      activeSurfaceId = surface.surfaceId;
    }
    return surface;
  }

  function resolveClientMediaUri(rawUrl, surface, overrideMediaMap) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed || /^(?:https?:|data:)/i.test(trimmed)) return trimmed;
    const liveMap =
      overrideMediaMap ||
      (typeof window !== "undefined" &&
        window.A2UI_SURFACE_PAYLOAD &&
        window.A2UI_SURFACE_PAYLOAD.mediaUrisByRun) ||
      mediaUrisByRun;
    const runId = String(
      (surface &&
        surface.dataModel &&
        surface.dataModel.meta &&
        surface.dataModel.meta.runId) ||
        ""
    ).trim();
    if (runId && liveMap && liveMap[runId] && liveMap[runId][trimmed]) {
      return liveMap[runId][trimmed];
    }
    if (liveMap && typeof liveMap === "object") {
      const keys = Object.keys(liveMap);
      for (let i = 0; i < keys.length; i++) {
        const m = liveMap[keys[i]];
        if (m && m[trimmed]) return m[trimmed];
      }
    }
    return trimmed;
  }

  if (typeof window !== "undefined" && window.__ICM_TEST_HOOKS__) {
    window.__ICM_TEST_HOOKS__.formatInlineLatexAndFootnotes = formatInlineLatexAndFootnotes;
    window.__ICM_TEST_HOOKS__.cleanClientChecklistLabel = cleanClientChecklistLabel;
    window.__ICM_TEST_HOOKS__.extractChecklistGroupsClient = extractChecklistGroupsClient;
    window.__ICM_TEST_HOOKS__.isInlineLatexMath = isInlineLatexMath;
    window.__ICM_TEST_HOOKS__.replaceInlineLatexSpans = replaceInlineLatexSpans;
    window.__ICM_TEST_HOOKS__.detectSpeechLang = detectSpeechLang;
    window.__ICM_TEST_HOOKS__.resolveSpeechVoice = resolveSpeechVoice;
    window.__ICM_TEST_HOOKS__.normalizeTextForTts = normalizeTextForTts;
    window.__ICM_TEST_HOOKS__.resolvePointer = resolvePointer;
    window.__ICM_TEST_HOOKS__.setPointer = setPointer;
    window.__ICM_TEST_HOOKS__.cloneDataValue = cloneDataValue;
    window.__ICM_TEST_HOOKS__.resolveClientConceptId = resolveClientConceptId;
    window.__ICM_TEST_HOOKS__.switchActiveRun = switchActiveRun;
    window.__ICM_TEST_HOOKS__.navigateOkfMarkdownConcept = navigateOkfMarkdownConcept;
    window.__ICM_TEST_HOOKS__.syncChecklistToOkfBody = syncChecklistToOkfBody;
    window.__ICM_TEST_HOOKS__.syncOkfBodyToChecklist = syncOkfBodyToChecklist;
    window.__ICM_TEST_HOOKS__.inspectSourceCitationsInBody = inspectSourceCitationsInBody;
    window.__ICM_TEST_HOOKS__.inspectClientSourceDomainProvenance = inspectClientSourceDomainProvenance;
    window.__ICM_TEST_HOOKS__.inferClientSourceMimeInfo = inferClientSourceMimeInfo;
    window.__ICM_TEST_HOOKS__.formatClientUrlMiddleEllipsis = formatClientUrlMiddleEllipsis;
    window.__ICM_TEST_HOOKS__.inspectClientSourceAttentionSignals = inspectClientSourceAttentionSignals;
    window.__ICM_TEST_HOOKS__.buildCurationPrompts = buildCurationPrompts;
    window.__ICM_TEST_HOOKS__.setReplaceSourceInStudio = setReplaceSourceInStudio;
    window.__ICM_TEST_HOOKS__.toggleReplacePanelInStudio = toggleReplacePanelInStudio;
    window.__ICM_TEST_HOOKS__.toggleRejectSourceInStudio = toggleRejectSourceInStudio;
    window.__ICM_TEST_HOOKS__.addSourceInStudio = addSourceInStudio;
    window.__ICM_TEST_HOOKS__.parseBuiltInMarkdown = parseBuiltInMarkdown;
    window.__ICM_TEST_HOOKS__.renderMarkdownBlock = renderMarkdownBlock;
    window.__ICM_TEST_HOOKS__.renderInlineMarkdown = renderInlineMarkdown;
    window.__ICM_TEST_HOOKS__.renderComponent = renderComponent;
    window.__ICM_TEST_HOOKS__.renderSurface = renderSurface;
    window.__ICM_TEST_HOOKS__.mountSurface = mountSurface;
    window.__ICM_TEST_HOOKS__.resolveDynamic = resolveDynamic;
    window.__ICM_TEST_HOOKS__.evaluateFunctionCall = evaluateFunctionCall;
    window.__ICM_TEST_HOOKS__.isAllowedMediaUrl = isAllowedMediaUrl;
    window.__ICM_TEST_HOOKS__.resolveClientMediaUri = resolveClientMediaUri;
    window.__ICM_TEST_HOOKS__.processMessage = processMessage;
    window.__ICM_TEST_HOOKS__.surfaces = surfaces;
    return;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isAllowedMediaUrl(rawUrl) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed) return false;
    if (/^(?:https?:|data:)/i.test(trimmed)) return true;
    if (trimmed.indexOf("//") === 0) return false;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false;
    return true;
  }

  function resolvePointer(root, pointer, scopeData) {
    if (pointer === undefined || pointer === null) return undefined;
    if (typeof pointer !== "string") return pointer;
    if (!pointer.startsWith("/")) {
      const base = scopeData !== undefined ? scopeData : root;
      const parts = pointer.split("/").filter(Boolean);
      let cur = base;
      for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p.replace(/~1/g, "/").replace(/~0/g, "~")];
      }
      return cur;
    }
    if (pointer === "/") return root;
    const parts = pointer.slice(1).split("/");
    let cur = root;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p.replace(/~1/g, "/").replace(/~0/g, "~")];
    }
    return cur;
  }

  function setPointer(root, pointer, value, scopePath) {
    let fullPointer = pointer;
    if (!pointer.startsWith("/") && scopePath) {
      fullPointer = scopePath.replace(/\/$/, "") + "/" + pointer;
    }
    const clonedValue = cloneDataValue(value);
    if (!fullPointer || fullPointer === "/") {
      for (const k of Object.keys(root)) {
        delete root[k];
      }
      if (clonedValue && typeof clonedValue === "object" && !Array.isArray(clonedValue)) {
        Object.assign(root, clonedValue);
      }
      return;
    }
    const clean = fullPointer.startsWith("/") ? fullPointer.slice(1) : fullPointer;
    const parts = clean.split("/").map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      const nextK = parts[i + 1];
      if (cur[k] == null || typeof cur[k] !== "object") {
        cur[k] = /^\d+$/.test(nextK) ? [] : {};
      }
      cur = cur[k];
    }
    const lastPart = parts[parts.length - 1];
    if (clonedValue === undefined) {
      if (Array.isArray(cur) && /^\d+$/.test(lastPart)) {
        cur[Number(lastPart)] = undefined;
      } else if (cur && typeof cur === "object") {
        delete cur[lastPart];
      }
    } else {
      cur[lastPart] = clonedValue;
    }
  }

  function isAnalysisSurface(surface) {
    const dm = surface && resolvePointer(surface.dataModel, "/meta/domainMode");
    return dm === "analysis";
  }

  function stringifyInterpolated(val) {
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  }

  function evaluateFunctionCall(fnObj, surface, scopeData, itemIndex) {
    const callName = fnObj["@call"] || fnObj.call;
    const args = fnObj.args || {};
    if (callName === "@index") {
      const offsetRaw =
        args.offset !== undefined
          ? resolveDynamic(args.offset, surface, scopeData, itemIndex)
          : 0;
      const offsetNum = Number(offsetRaw || 0);
      return (typeof itemIndex === "number" ? itemIndex : 0) + (Number.isNaN(offsetNum) ? 0 : offsetNum);
    }
    if (callName === "formatString") {
      const rawTemplate = String(args.value ?? "");
      return rawTemplate.replace(/(\\?)\$\{([^}]+)\}/g, function (match, esc, expr) {
        if (esc === "\\") return match.slice(1);
        const trimmed = String(expr || "").trim();
        if (trimmed === "@index") {
          return String(typeof itemIndex === "number" ? itemIndex : 0);
        }
        const resolved = resolvePointer(surface.dataModel, trimmed, scopeData);
        return stringifyInterpolated(resolved);
      });
    }
    if (callName === "required") {
      const v = resolveDynamic(args.value, surface, scopeData, itemIndex);
      if (v === null || v === undefined) return false;
      if (typeof v === "string") return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      return Boolean(v);
    }
    if (callName === "regex") {
      const v = String(resolveDynamic(args.value, surface, scopeData, itemIndex) ?? "");
      try {
        return new RegExp(String(args.pattern || "")).test(v);
      } catch {
        return false;
      }
    }
    if (callName === "length") {
      const v = String(resolveDynamic(args.value, surface, scopeData, itemIndex) ?? "");
      if (typeof args.min === "number" && v.length < args.min) return false;
      if (typeof args.max === "number" && v.length > args.max) return false;
      return true;
    }
    if (callName === "numeric") {
      const n = Number(resolveDynamic(args.value, surface, scopeData, itemIndex));
      if (Number.isNaN(n)) return false;
      if (typeof args.min === "number" && n < args.min) return false;
      if (typeof args.max === "number" && n > args.max) return false;
      return true;
    }
    if (callName === "email") {
      const v = String(resolveDynamic(args.value, surface, scopeData, itemIndex) ?? "");
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }
    if (callName === "and") {
      const list = Array.isArray(args.values) ? args.values : [];
      return list.every((item) => Boolean(resolveDynamic(item, surface, scopeData, itemIndex)));
    }
    if (callName === "or") {
      const list = Array.isArray(args.values) ? args.values : [];
      return list.some((item) => Boolean(resolveDynamic(item, surface, scopeData, itemIndex)));
    }
    if (callName === "not") {
      return !Boolean(resolveDynamic(args.value, surface, scopeData, itemIndex));
    }
    if (callName === "openUrl") {
      const url = String(resolveDynamic(args.url, surface, scopeData, itemIndex) || "");
      if (url && typeof window !== "undefined" && window.open) {
        window.open(url, "_blank", "noopener");
      }
      return true;
    }
    return "";
  }

  function resolveDynamic(val, surface, scopeData, itemIndex) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const dynPath =
        typeof val["@path"] === "string"
          ? val["@path"]
          : typeof val.path === "string"
            ? val.path
            : undefined;
      if (dynPath !== undefined) {
        return resolvePointer(surface.dataModel, dynPath, scopeData);
      }
      const dynCall =
        typeof val["@call"] === "string"
          ? val["@call"]
          : typeof val.call === "string"
            ? val.call
            : undefined;
      if (dynCall !== undefined) {
        return evaluateFunctionCall(val, surface, scopeData, itemIndex);
      }
    }
    return val;
  }

  // Process A2UI v1.0 (with v0.9.1 backward-compat) Agent-to-Renderer Message Stream
  function processMessage(msg) {
    if (!msg || (msg.version !== "1.0" && msg.version !== "v0.9.1" && msg.version !== "v0.9")) return;
    if (msg.createSurface) {
      const s = msg.createSurface;
      const initialComponents = {};
      if (Array.isArray(s.components)) {
        for (const c of s.components) {
          if (c && c.id) initialComponents[c.id] = cloneDataValue(c);
        }
      }
      surfaces[s.surfaceId] = {
        surfaceId: s.surfaceId,
        catalogId: s.catalogId || "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
        sendDataModel: !!s.sendDataModel,
        metadata: cloneDataValue(s.metadata || {}),
        components: initialComponents,
        dataModel: s.dataModel && typeof s.dataModel === "object" ? cloneDataValue(s.dataModel) : {},
        runStates: {},
        uiState: { activeTabs: {} },
      };
      activeSurfaceId = s.surfaceId;
    } else if (msg.updateComponents) {
      const s = surfaces[msg.updateComponents.surfaceId];
      if (!s) return;
      for (const c of msg.updateComponents.components || []) {
        s.components[c.id] = cloneDataValue(c);
      }
    } else if (msg.updateDataModel) {
      const s = surfaces[msg.updateDataModel.surfaceId];
      if (!s) return;
      const p = msg.updateDataModel.path || "/";
      const rawVal = msg.updateDataModel.value;
      setPointer(s.dataModel, p, rawVal === null ? undefined : cloneDataValue(rawVal));
    } else if (msg.deleteSurface) {
      delete surfaces[msg.deleteSurface.surfaceId];
    } else if (msg.callRendererFunction) {
      const s = surfaces[msg.callRendererFunction.surfaceId];
      if (s && msg.callRendererFunction.callFunction) {
        evaluateFunctionCall(msg.callRendererFunction.callFunction, s, undefined, undefined);
      }
    }
  }

  for (const m of messages) {
    processMessage(m);
  }

  // Pre-seed per-run dataModels on the active surface and mount the topbar run/course switcher when >1 run exists
  const initialSurface = surfaces[activeSurfaceId];
  if (initialSurface && bundleRuns.length > 0) {
    initialSurface.runStates = initialSurface.runStates || {};
    for (const r of bundleRuns) {
      if (r && r.runId && r.dataModel) {
        initialSurface.runStates[r.runId] = cloneDataValue(r.dataModel);
      }
    }
    const activeRunId = resolvePointer(initialSurface.dataModel, "/meta/runId");
    if (activeRunId) {
      initialSurface.activeRunId = activeRunId;
      initialSurface.runStates[activeRunId] = cloneDataValue(initialSurface.dataModel);
    }
    if (bundleRuns.length > 1 && typeof document !== "undefined") {
      const brandEl = document.querySelector(".a2ui-topbar-brand");
      if (brandEl && !document.getElementById("a2ui-run-switcher-select")) {
        const selectEl = document.createElement("select");
        selectEl.id = "a2ui-run-switcher-select";
        selectEl.className = "a2ui-run-switcher";
        selectEl.setAttribute("aria-label", tClient(initialSurface, "switchRunAriaLabel"));
        bundleRuns.forEach((r, idx) => {
          const opt = document.createElement("option");
          opt.value = r.runId;
          opt.textContent =
            r.shortLabel ||
            tClient(initialSurface, "runLabelPrefix", {
              n: idx + 1,
              title: r.title || r.runId,
            });
          if (r.runId === activeRunId) {
            opt.selected = true;
          }
          selectEl.appendChild(opt);
        });
        selectEl.addEventListener("change", (ev) => {
          const nextRunId = ev.target && ev.target.value;
          if (nextRunId) {
            switchActiveRun(initialSurface, nextRunId);
          }
        });
        brandEl.appendChild(selectEl);
      }
    }
  }

  function stopActiveSpeech() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
      try {
        document.querySelectorAll("audio").forEach(function (el) {
          try {
            if (el && typeof el.pause === "function") el.pause();
          } catch (_e) {}
        });
      } catch (_e) {}
    }
  }

  function cleanClientChecklistLabel(rawText) {
    const supMap = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ" };
    const subMap = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ" };
    function cleanLatexFrag(frag, isInsideMathSpan) {
      let out = String(frag || "")
        .replace(/\\(?:left|right)\s*([()[\]|.])?/g, "$1")
        .replace(/\\mathcal\{R\}/g, "ℛ")
        .replace(/\\mathcal\{([A-Za-z])\}/g, "$1")
        .replace(/\\sqrt\{\s*([^{}]+?)\s*\}/g, "√($1)")
        .replace(/\\overline\{\s*([^{}]+?)\s*\}/g, "$1")
        .replace(/\\(?:hat|bar|tilde|vec)\{\s*([^{}]+?)\s*\}/g, "$1")
        .replace(/\\(?:[,;:]|\s+|quad\b|qquad\b)/g, " ")
        .replace(/\\!/g, "")
        .replace(/\\sim(?![a-zA-Z])/g, "~")
        .replace(/\\simeq(?![a-zA-Z])/g, "≃")
        .replace(/\\cong(?![a-zA-Z])/g, "≅")
        .replace(/\\propto(?![a-zA-Z])/g, "∝")
        .replace(/\\perp(?![a-zA-Z])/g, "⊥")
        .replace(/\\parallel(?![a-zA-Z])/g, "∥")
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
        .replace(/\\equiv(?![a-zA-Z])/g, "≡")
        .replace(/\\ll(?![a-zA-Z])/g, "≪")
        .replace(/\\gg(?![a-zA-Z])/g, "≫")
        .replace(/\\times(?![a-zA-Z])/g, "×")
        .replace(/\\div(?![a-zA-Z])/g, "÷")
        .replace(/\\pm(?![a-zA-Z])/g, "±")
        .replace(/\\mp(?![a-zA-Z])/g, "∓")
        .replace(/\\cdot(?![a-zA-Z])/g, "·")
        .replace(/\\(?:dots|ldots|cdots)(?![a-zA-Z])/g, "…")
        .replace(/\\infty(?![a-zA-Z])/g, "∞")
        .replace(/\\partial(?![a-zA-Z])/g, "∂")
        .replace(/\\nabla(?![a-zA-Z])/g, "∇")
        .replace(/\\sum(?![a-zA-Z])/g, "∑")
        .replace(/\\prod(?![a-zA-Z])/g, "∏")
        .replace(/\\int(?![a-zA-Z])/g, "∫")
        .replace(/\\Delta\s+([a-zA-Z])(?![a-zA-Z])/g, "Δ$1")
        .replace(/\\Delta(?![a-zA-Z])/g, "Δ")
        .replace(/\\delta(?![a-zA-Z])/g, "δ")
        .replace(/\\mu(?![a-zA-Z])/g, "μ")
        .replace(/\\Omega(?![a-zA-Z])/g, "Ω")
        .replace(/\\omega(?![a-zA-Z])/g, "ω")
        .replace(/\\alpha(?![a-zA-Z])/g, "α")
        .replace(/\\beta(?![a-zA-Z])/g, "β")
        .replace(/\\gamma(?![a-zA-Z])/g, "γ")
        .replace(/\\Gamma(?![a-zA-Z])/g, "Γ")
        .replace(/\\lambda(?![a-zA-Z])/g, "λ")
        .replace(/\\Lambda(?![a-zA-Z])/g, "Λ")
        .replace(/\\pi(?![a-zA-Z])/g, "π")
        .replace(/\\Pi(?![a-zA-Z])/g, "Π")
        .replace(/\\sigma(?![a-zA-Z])/g, "σ")
        .replace(/\\Sigma(?![a-zA-Z])/g, "Σ")
        .replace(/\\rho(?![a-zA-Z])/g, "ρ")
        .replace(/\\theta(?![a-zA-Z])/g, "θ")
        .replace(/\\Theta(?![a-zA-Z])/g, "Θ")
        .replace(/\\tau(?![a-zA-Z])/g, "τ")
        .replace(/\\phi(?![a-zA-Z])|\\varphi(?![a-zA-Z])/g, "φ")
        .replace(/\\Phi(?![a-zA-Z])/g, "Φ")
        .replace(/\\eta(?![a-zA-Z])/g, "η")
        .replace(/\\kappa(?![a-zA-Z])/g, "κ")
        .replace(/\\epsilon(?![a-zA-Z])|\\varepsilon(?![a-zA-Z])/g, "ε")
        .replace(/\\zeta(?![a-zA-Z])/g, "ζ")
        .replace(/\\nu(?![a-zA-Z])/g, "ν")
        .replace(/\\xi(?![a-zA-Z])/g, "ξ")
        .replace(/\\chi(?![a-zA-Z])/g, "χ")
        .replace(/\\psi(?![a-zA-Z])/g, "ψ")
        .replace(/\\Psi(?![a-zA-Z])/g, "Ψ")
        .replace(/\\(?:ln|exp|log|sin|cos|tan|min|max|lim|sup|inf)(?![a-zA-Z])/g, function (m) {
          return m.slice(1);
        })
        .replace(/\\(?:circ|degree)(?![a-z])/g, "°");
      for (let pass = 0; pass < 3; pass++) {
        out = out
          .replace(/\\(?:text|mathrm|textbf|textit|mathit|mathsf|emph|operatorname)\{([^{}]*)\}/g, "$1")
          .replace(/\\(?:xrightleftharpoons|rightleftharpoons)(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, "⇌")
          .replace(/\\(?:xrightarrow|xleftarrow)(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, "→")
          .replace(/\\frac\{\s*([^{}]+?)\s*\}\{\s*([^{}]+?)\s*\}/g, "$1/$2")
          .replace(/\^\{\s*(?:°|o)\s*([CFK])?\s*\}|\^°/g, "°$1")
          .replace(/\^\{\s*([0-9+\-=()a-pr-z]+)\s*\}|\^([0-9+\-a-pr-z])(?![a-zA-Z0-9])/g, function (_m, b, s) {
            return String(b || s).replace(/[0-9+\-=()a-pr-z]/g, function (d) {
              return supMap[d] || d;
            });
          })
          .replace(/_\{\s*([+-]?[0-9]+|[+-])\s*\}/g, function (_m, b) {
            return String(b).replace(/[0-9+-]/g, function (d) {
              return subMap[d] || d;
            });
          });
        if (isInsideMathSpan) {
          out = out
            .replace(/~/g, " ")
            .replace(/_([+-]?[0-9])(?![0-9])/g, function (_sub, s) {
              return String(s).replace(/[0-9+-]/g, function (d) {
                return subMap[d] || d;
              });
            })
            .replace(/_\{\s*([aehijklmnoprstuvx]+)\s*\}|_([aehijklmnoprstuvx])(?![a-zA-Z0-9])/g, function (_m, b, s) {
              return String(b || s).replace(/[aehijklmnoprstuvx]/g, function (d) {
                return subMap[d] || d;
              });
            })
            .replace(/_\{\s*([^{}]+?)\s*\}/g, "_$1")
            .replace(/\^\{\s*([^{}]+?)\s*\}/g, "^$1");
        }
      }
      return out
        .replace(/\\([$&%_#{}])/g, "$1")
        .replace(/\\(?:text|mathrm|textbf|textit|mathit|mathsf|emph|operatorname)\{([^{}]*)\}/g, "$1");
    }

    let text = String(rawText || "").trim();
    text = stripClientFootnotesPreservingBoundaries(text);
    text = replaceInlineLatexSpans(text, function (_m, inner) {
      return cleanLatexFrag(inner, true).trim();
    });
    text = cleanLatexFrag(text, false);
    text = text.replace(/\b([A-Z]{1,3}|Fe|Ni|Si|Mg|Al|Ca|Ti)_([0-9]+|x)(?![a-zA-Z0-9])/g, function (_m, prefix, s) {
      return prefix + String(s).replace(/[0-9x]/g, function (d) { return subMap[d] || d; });
    });
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    text = text
      .replace(/\x60([^\x60]+)\x60/g, "$1")
      .replace(/\*\*\*(?!\s)([^*]*?\S)\*\*\*/g, "$1")
      .replace(/\*\*(?!\s)([^*]*?\S)\*\*/g, "$1")
      .replace(/\*(?!\s)([^*]*?\S)\*/g, "$1");
    text = text.replace(/\s+/g, " ").replace(/\s+([.,;:?!])/g, "$1").trim();
    return text;
  }

  function extractChecklistGroupsClient(rawMarkdown, surface) {
    const sample = String(rawMarkdown || "");
    const defaultHeading = tClient(surface, "checklistDefaultHeading");
    const defaultFallback = tClient(surface, "checklistDefaultGroup");
    const lines = sample.split(/\r?\n/);
    const groups = [];
    let currentHeading = defaultHeading;
    const categoryStack = [];
    let sectionGroupStartIdx = 0;
    let itemCounter = 0;

    function getOrCreateGroup(title) {
      const cleanTitle =
        cleanClientChecklistLabel(title.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/:+\s*$/, "")) || defaultFallback;
      for (let gIdx = groups.length - 1; gIdx >= sectionGroupStartIdx; gIdx--) {
        if (groups[gIdx].title === cleanTitle) {
          return groups[gIdx];
        }
      }
      const created = {
        id: "chk_grp_" + (groups.length + 1),
        title: cleanTitle,
        items: [],
      };
      groups.push(created);
      return created;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{2,4})\s+(.+?)\s*$/);
      if (headingMatch) {
        currentHeading = headingMatch[2].replace(/^\d+(\.\d+)*\.?\s*/, "").trim();
        categoryStack.length = 0;
        sectionGroupStartIdx = groups.length;
        continue;
      }
      const checkboxMatch = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+?)\s*$/);
      if (!checkboxMatch) continue;

      const indent = checkboxMatch[1].length;
      const isChecked = checkboxMatch[2].toLowerCase() === "x";
      const rawContent = checkboxMatch[3].trim();

      while (categoryStack.length > 0 && categoryStack[categoryStack.length - 1].indent >= indent) {
        categoryStack.pop();
      }

      let hasIndentedSubItems = false;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (!nextLine.trim()) continue;
        const nextCheckbox = nextLine.match(/^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+?)\s*$/);
        if (nextCheckbox && nextCheckbox[1].length > indent) {
          hasIndentedSubItems = true;
        }
        break;
      }

      const contentWithoutFootnotes = stripClientFootnotesPreservingBoundaries(rawContent).trim();
      const isBoldColonHeader = /^\*\*[^*]+\*\*:?\s*$/.test(contentWithoutFootnotes);

      if (isBoldColonHeader || hasIndentedSubItems) {
        const headerTitle = cleanClientChecklistLabel(
          contentWithoutFootnotes.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/:+\s*$/, "").trim()
        );
        if (headerTitle) {
          categoryStack.push({ indent: indent, title: headerTitle });
        }
        continue;
      }

      let groupTitle = currentHeading;
      const rawItemText = rawContent;

      if (categoryStack.length > 0) {
        const stackTitle = categoryStack.map((c) => c.title).join(" — ");
        groupTitle =
          currentHeading &&
          currentHeading !== defaultHeading &&
          !stackTitle.startsWith(currentHeading)
            ? currentHeading + " — " + stackTitle
            : stackTitle;
      }

      const cleanedLabel = cleanClientChecklistLabel(rawItemText);
      if (!cleanedLabel) continue;
      itemCounter++;
      const group = getOrCreateGroup(groupTitle);

      group.items.push({
        id: "chk_item_" + itemCounter,
        label: cleanedLabel,
        checked: isChecked,
        category: group.title,
      });
    }

    return groups.filter((g) => g.items.length > 0);
  }

  function syncChecklistToOkfBody(surface) {
    if (resolvePointer(surface.dataModel, "/checklist/fromStage2")) {
      return;
    }
    const isViewingStub = Boolean(
      surface.viewingStubConcept || resolvePointer(surface.dataModel, "/okf/viewingStubConcept")
    );
    const targetBodyPath = isViewingStub ? "/okf/primaryBody" : "/okf/body";
    const body = resolvePointer(surface.dataModel, targetBodyPath);
    if (typeof body !== "string" || !body) return;
    const groups = resolvePointer(surface.dataModel, "/checklist/groups") || [];
    const flatChecked = [];
    const checkedByLeafNum = {};
    let hasLeafIds = false;
    for (const g of groups) {
      for (const it of g.items || []) {
        const val = Boolean(it.checked);
        flatChecked.push(val);
        const idMatch = String(it.id || "").match(/^chk_item_(\d+)$/);
        if (idMatch) {
          checkedByLeafNum[Number(idMatch[1])] = val;
          hasLeafIds = true;
        }
      }
    }
    if (flatChecked.length === 0) return;

    const lines = body.split(/\r?\n/);
    let leafIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\]\s+)(.+?)\s*$/);
      if (!m) continue;
      const indent = (lines[i].match(/^(\s*)/) || ["", ""])[1].length;
      const rawContent = m[4].trim();
      let hasIndentedSubItems = false;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (!nextLine.trim()) continue;
        const nextCheckbox = nextLine.match(/^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+?)\s*$/);
        if (nextCheckbox && nextCheckbox[1].length > indent) {
          hasIndentedSubItems = true;
        }
        break;
      }
      const contentWithoutFootnotes = stripClientFootnotesPreservingBoundaries(rawContent).trim();
      const isBoldColonHeader = /^\*\*[^*]+\*\*:?\s*$/.test(contentWithoutFootnotes);
      if (isBoldColonHeader || hasIndentedSubItems) {
        continue;
      }
      const leafNum = leafIdx + 1;
      if (hasLeafIds && Object.prototype.hasOwnProperty.call(checkedByLeafNum, leafNum)) {
        lines[i] = m[1] + (checkedByLeafNum[leafNum] ? "x" : " ") + m[3] + m[4];
        leafIdx++;
      } else if (leafIdx < flatChecked.length) {
        lines[i] = m[1] + (flatChecked[leafIdx] ? "x" : " ") + m[3] + m[4];
        leafIdx++;
      }
    }
    const updatedBody = lines.join("\n");
    setPointer(surface.dataModel, targetBodyPath, updatedBody);
    if (!isViewingStub) {
      setPointer(surface.dataModel, "/okf/primaryBody", updatedBody);
    }
  }

  function syncOkfBodyToChecklist(surface) {
    if (
      resolvePointer(surface.dataModel, "/checklist/fromStage2") ||
      surface.viewingStubConcept ||
      resolvePointer(surface.dataModel, "/okf/viewingStubConcept")
    ) {
      return;
    }
    const body = resolvePointer(surface.dataModel, "/okf/body");
    if (typeof body !== "string") return;
    const newGroups = extractChecklistGroupsClient(body, surface);
    if (newGroups.length > 0) {
      setPointer(surface.dataModel, "/checklist/groups", newGroups);
      recomputeChecklistSummary(surface);
      const total = resolvePointer(surface.dataModel, "/checklist/totalCount") || 0;
      if (
        surface.components &&
        surface.components["main_tabs"] &&
        Array.isArray(surface.components["main_tabs"].tabs)
      ) {
        for (const tab of surface.components["main_tabs"].tabs) {
          if (tab && tab.child === "tab_checklist") {
            tab.title = tClient(surface, "tabChecklistCount", { count: total });
          }
        }
      }
    }
  }

  function dispatchClientAction(surface, sourceComponentId, name, contextObj) {
    const evt = {
      version: "1.0",
      action: {
        name: name,
        surfaceId: surface.surfaceId,
        sourceComponentId: sourceComponentId,
        timestamp: new Date().toISOString(),
        context: contextObj || {},
      },
    };
    actionLog.unshift(evt);
    if (name === "resetChecklist") {
      const groups = resolvePointer(surface.dataModel, "/checklist/groups") || [];
      groups.forEach((g) => (g.items || []).forEach((it) => { it.checked = false; }));
      recomputeChecklistSummary(surface);
      syncChecklistToOkfBody(surface);
      renderSurface();
    } else if (name === "checkAllChecklist") {
      const groups = resolvePointer(surface.dataModel, "/checklist/groups") || [];
      groups.forEach((g) => (g.items || []).forEach((it) => { it.checked = true; }));
      recomputeChecklistSummary(surface);
      syncChecklistToOkfBody(surface);
      renderSurface();
    } else if (name === "speakText") {
      const txt = (contextObj && contextObj.text) || "";
      speakNarration(txt, null, surface);
    } else if (name === "stopSpeech") {
      stopActiveSpeech();
    } else if (name === "exportSurfaceJson") {
      downloadJson(
        surface.surfaceId + "_state.json",
        JSON.stringify({ messages, currentDataModel: surface.dataModel, actionLog }, null, 2)
      );
    }
  }

  function recomputeChecklistSummary(surface) {
    const groups = resolvePointer(surface.dataModel, "/checklist/groups") || [];
    let total = 0;
    let completed = 0;
    for (const g of groups) {
      for (const it of g.items || []) {
        total++;
        if (it.checked) completed++;
      }
    }
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    setPointer(surface.dataModel, "/checklist/completedCount", completed);
    setPointer(surface.dataModel, "/checklist/totalCount", total);
    setPointer(surface.dataModel, "/checklist/percent", pct);
    setPointer(
      surface.dataModel,
      "/checklist/summaryText",
      tClient(surface, "completedSummary", { completed: completed, total: total, pct: pct })
    );
  }

  if (typeof window !== "undefined" && window.speechSynthesis && typeof window.speechSynthesis.getVoices === "function") {
    try {
      window.speechSynthesis.getVoices();
      if (typeof window.speechSynthesis.addEventListener === "function") {
        window.speechSynthesis.addEventListener("voiceschanged", function () {
          try {
            window.speechSynthesis.getVoices();
          } catch (_e) {}
        });
      }
    } catch (_e) {}
  }

  function speakNarration(text, onVoiceResolved, surface) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const activePack = getClientLocalePack(surface);
    const lang =
      activePack && activePack.bcp47 && detectSpeechLang(text) !== "en-US"
        ? activePack.bcp47
        : detectSpeechLang(text);
    const spokenText = normalizeTextForTts(text, activePack || lang);

    function startUtterance(voicesList) {
      const resolved = resolveSpeechVoice(lang, voicesList);
      const utter = new SpeechSynthesisUtterance(spokenText);
      utter.lang = resolved.effectiveLang;
      if (resolved.voice) {
        utter.voice = resolved.voice;
      }
      if (typeof onVoiceResolved === "function") {
        onVoiceResolved({
          targetLang: lang,
          effectiveLang: resolved.effectiveLang,
          voice: resolved.voice,
          matchedTargetLanguage: resolved.matchedTargetLanguage,
          totalVoicesAvailable: Array.isArray(voicesList) ? voicesList.length : 0,
        });
      }
      window.speechSynthesis.speak(utter);
    }

    let initialVoices = [];
    try {
      initialVoices = window.speechSynthesis.getVoices() || [];
    } catch (_e) {}

    if (initialVoices.length > 0 || typeof window.speechSynthesis.addEventListener !== "function") {
      startUtterance(initialVoices);
      return;
    }

    let didStart = false;
    function onVoicesReady() {
      if (didStart) return;
      didStart = true;
      try {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesReady);
      } catch (_e) {}
      let loadedVoices = [];
      try {
        loadedVoices = window.speechSynthesis.getVoices() || [];
      } catch (_e) {}
      startUtterance(loadedVoices);
    }
    try {
      window.speechSynthesis.addEventListener("voiceschanged", onVoicesReady);
    } catch (_e) {}
    setTimeout(onVoicesReady, 250);
  }

  function downloadJson(filename, content) {
    const blob = new Blob([content], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  function formatInlineLatexAndFootnotes(md, sources, rejectedSourceIds, preserveLeadingH1) {
    const supMap = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ" };
    const subMap = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ" };
    let out = String(md || "");
    // Strip redundant leading H1 heading (# <Title>) in OkfMarkdown since the concept title is rendered in the card/panel header
    if (!preserveLeadingH1) {
      out = out.replace(/^\s*#\s+[^\r\n]+(?:\r?\n+---(?=\r?\n|$))?\r?\n*/, "");
    }
    // Strip standalone bottom footnote definitions ([^id]: Title) and any stranded trailing empty citation heading
    out = out.replace(/^\s*\[\^([A-Za-z0-9_\-]+)\]:\s*(.+)$/gm, "");
    out = out.replace(/\r?\n+---\s*$/g, "");
    out = out.replace(/(?:\r?\n+---)?\r?\n+#{2,4}\s+[^\r\n]+(?:\r?\n+---)?\s*$/, "");
    out = out.replace(/\r?\n+---\s*$/g, "").trim();
    // Normalize stray BPE space immediately after list-item opening bold marker (e.g. '2. ** label**:' -> '2. **label**:')
    out = out.replace(/^(\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)\*\*[ \t]+([^\s*\r\n][^*\r\n]*?\*\*)/gm, "$1**$2");
    // Format inline TeX math spans ($...$ and $$...$$) safely without matching currency $ pairs or table pipes
    out = replaceInlineLatexSpans(out, function (_, inner) {
      let cleaned = String(inner)
        .replace(/\\(?:left|right)\s*([()[\]|.])?/g, "$1")
        .replace(/\\mathcal\{R\}/g, "ℛ")
        .replace(/\\mathcal\{([A-Za-z])\}/g, "$1")
        .replace(/\\sqrt\{\s*([^{}]+?)\s*\}/g, "√($1)")
        .replace(/\\overline\{\s*([^{}]+?)\s*\}/g, "$1")
        .replace(/\\(?:hat|bar|tilde|vec)\{\s*([^{}]+?)\s*\}/g, "$1")
        .replace(/\\(?:[,;:]|\s+|quad\b|qquad\b)/g, " ")
        .replace(/~/g, " ")
        .replace(/\\!/g, "")
        .replace(/\\sim(?![a-zA-Z])/g, "~")
        .replace(/\\simeq(?![a-zA-Z])/g, "≃")
        .replace(/\\cong(?![a-zA-Z])/g, "≅")
        .replace(/\\propto(?![a-zA-Z])/g, "∝")
        .replace(/\\perp(?![a-zA-Z])/g, "⊥")
        .replace(/\\parallel(?![a-zA-Z])/g, "∥")
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
        .replace(/\\equiv(?![a-zA-Z])/g, "≡")
        .replace(/\\ll(?![a-zA-Z])/g, "≪")
        .replace(/\\gg(?![a-zA-Z])/g, "≫")
        .replace(/\\times(?![a-zA-Z])/g, "×")
        .replace(/\\div(?![a-zA-Z])/g, "÷")
        .replace(/\\pm(?![a-zA-Z])/g, "±")
        .replace(/\\mp(?![a-zA-Z])/g, "∓")
        .replace(/\\cdot(?![a-zA-Z])/g, "·")
        .replace(/\\(?:dots|ldots|cdots)(?![a-zA-Z])/g, "…")
        .replace(/\\infty(?![a-zA-Z])/g, "∞")
        .replace(/\\partial(?![a-zA-Z])/g, "∂")
        .replace(/\\nabla(?![a-zA-Z])/g, "∇")
        .replace(/\\sum(?![a-zA-Z])/g, "∑")
        .replace(/\\prod(?![a-zA-Z])/g, "∏")
        .replace(/\\int(?![a-zA-Z])/g, "∫")
        .replace(/\\Delta\s+([a-zA-Z])(?![a-zA-Z])/g, "Δ$1")
        .replace(/\\Delta(?![a-zA-Z])/g, "Δ")
        .replace(/\\delta(?![a-zA-Z])/g, "δ")
        .replace(/\\mu(?![a-zA-Z])/g, "μ")
        .replace(/\\Omega(?![a-zA-Z])/g, "Ω")
        .replace(/\\omega(?![a-zA-Z])/g, "ω")
        .replace(/\\alpha(?![a-zA-Z])/g, "α")
        .replace(/\\beta(?![a-zA-Z])/g, "β")
        .replace(/\\gamma(?![a-zA-Z])/g, "γ")
        .replace(/\\Gamma(?![a-zA-Z])/g, "Γ")
        .replace(/\\lambda(?![a-zA-Z])/g, "λ")
        .replace(/\\Lambda(?![a-zA-Z])/g, "Λ")
        .replace(/\\pi(?![a-zA-Z])/g, "π")
        .replace(/\\Pi(?![a-zA-Z])/g, "Π")
        .replace(/\\sigma(?![a-zA-Z])/g, "σ")
        .replace(/\\Sigma(?![a-zA-Z])/g, "Σ")
        .replace(/\\rho(?![a-zA-Z])/g, "ρ")
        .replace(/\\theta(?![a-zA-Z])/g, "θ")
        .replace(/\\Theta(?![a-zA-Z])/g, "Θ")
        .replace(/\\tau(?![a-zA-Z])/g, "τ")
        .replace(/\\phi(?![a-zA-Z])|\\varphi(?![a-zA-Z])/g, "φ")
        .replace(/\\Phi(?![a-zA-Z])/g, "Φ")
        .replace(/\\eta(?![a-zA-Z])/g, "η")
        .replace(/\\kappa(?![a-zA-Z])/g, "κ")
        .replace(/\\epsilon(?![a-zA-Z])|\\varepsilon(?![a-zA-Z])/g, "ε")
        .replace(/\\zeta(?![a-zA-Z])/g, "ζ")
        .replace(/\\nu(?![a-zA-Z])/g, "ν")
        .replace(/\\xi(?![a-zA-Z])/g, "ξ")
        .replace(/\\chi(?![a-zA-Z])/g, "χ")
        .replace(/\\psi(?![a-zA-Z])/g, "ψ")
        .replace(/\\Psi(?![a-zA-Z])/g, "Ψ")
        .replace(/\\(?:ln|exp|log|sin|cos|tan|min|max|lim|sup|inf)(?![a-zA-Z])/g, function (m) {
          return m.slice(1);
        })
        .replace(/\\(?:circ|degree)(?![a-z])/g, "°");
      for (let pass = 0; pass < 3; pass++) {
        cleaned = cleaned
          .replace(/\\(?:text|mathrm|textbf|textit|mathit|mathsf|emph|operatorname)\{([^{}]*)\}/g, "$1")
          .replace(/\\(?:xrightleftharpoons|rightleftharpoons)(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, "⇌")
          .replace(/\\(?:xrightarrow|xleftarrow)(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, "→")
          .replace(/\^\{\s*(?:°|o)\s*([CFK])?\s*\}|\^°/g, "°$1")
          .replace(/\^\{\s*([0-9+\-=()a-pr-z]+)\s*\}|\^([0-9+\-a-pr-z])(?![a-zA-Z0-9])/g, function (_m, b, s) {
            return String(b || s).replace(/[0-9+\-=()a-pr-z]/g, function (d) {
              return supMap[d] || d;
            });
          })
          .replace(/_\{\s*([+-]?[0-9]+|[+-])\s*\}|_([+-]?[0-9])(?![0-9])/g, function (_m, b, s) {
            return String(b || s).replace(/[0-9+-]/g, function (d) {
              return subMap[d] || d;
            });
          })
          .replace(/_\{\s*([aehijklmnoprstuvx]+)\s*\}|_([aehijklmnoprstuvx])(?![a-zA-Z0-9])/g, function (_m, b, s) {
            return String(b || s).replace(/[aehijklmnoprstuvx]/g, function (d) {
              return subMap[d] || d;
            });
          })
          .replace(/_\{\s*([^{}]+?)\s*\}|_([a-zA-Z0-9,]+)(?![a-zA-Z0-9])/g, function (_m, b, s) {
            return "<sub>" + escapeHtml(String(b || s)) + "</sub>";
          })
          .replace(/\^\{\s*([^{}]+?)\s*\}|\^([a-zA-Z0-9+\-]+)(?![a-zA-Z0-9])/g, function (_m, b, s) {
            return "<sup>" + escapeHtml(String(b || s)) + "</sup>";
          })
          .replace(/\\frac\{\s*([^{}]+?)\s*\}\{\s*([^{}]+?)\s*\}/g, "$1/$2");
      }
      cleaned = cleaned
        .replace(/\\([$&%_#{}])/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
      if (!/[\\{}^_]/.test(cleaned)) {
        return cleaned;
      }
      return "<code>" + escapeHtml(cleaned) + "</code>";
    });
    out = out.replace(/\x60(\/[A-Za-z0-9_\-\/]+\.md)\x60/g, '<a href="$1"><code>$1</code></a>');
    const rejectedFnSet = new Set(
      Array.isArray(rejectedSourceIds)
        ? rejectedSourceIds.map(function (r) {
            return String(r || "").trim();
          })
        : []
    );
    out = out.replace(/\[\^([^\]]+)\]/g, function (_, id) {
      const cleanId = String(id || "").trim();
      const safeId = escapeHtml(cleanId);
      const isRej = rejectedFnSet.has(cleanId);
      return (
        '<sup class="fn-ref' +
        (isRej ? " fn-rejected" : "") +
        '"><a href="#okf-src-' +
        safeId +
        '" data-fn="' +
        safeId +
        '">[' +
        safeId +
        "]</a></sup>"
      );
    });
    return out;
  }

  function renderInlineMarkdown(rawText) {
    const stash = [];
    function putStash(htmlFrag) {
      const idx = stash.length;
      stash.push(htmlFrag);
      return "\x00ISTASH_" + idx + "\x00";
    }
    let s = replaceInlineLatexSpans(String(rawText == null ? "" : rawText), function (_m, inner) {
      return escapeHtml(inner);
    });
    s = s.replace(/\x60([^\x60\r\n]+)\x60/g, function (_m, code) {
      return putStash("<code>" + escapeHtml(code) + "</code>");
    });
    s = escapeHtml(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, lbl, rawHref) {
      const cleanHref = rawHref.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      const isExt = /^https?:\/\//i.test(cleanHref);
      const safeHref = /^(?:https?:\/\/|mailto:|\/|\.\/|\.\.\/|#|[A-Za-z0-9_\-\/]+\.md)/i.test(cleanHref)
        ? escapeHtml(cleanHref)
        : "#";
      const extAttrs = isExt ? ' target="_blank" rel="noopener noreferrer"' : "";
      return putStash("<a" + extAttrs + ' href="' + safeHref + '">' + lbl + "</a>");
    });
    s = s
      .replace(/\*\*\*([^*\r\n]+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*([^*\r\n]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])__([^_\r\n]+?)__(?=$|[\s).,;:!?])/g, "$1<strong>$2</strong>")
      .replace(/(^|[^*])\*([^\s*][^*\r\n]*?)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])_([^\s_][^_\r\n]*?)_(?=$|[\s).,;:!?])/g, "$1<em>$2</em>")
      .replace(/~~([^~\r\n]+?)~~/g, "<del>$1</del>");
    for (let pass = 0; pass < 3; pass++) {
      if (s.indexOf("\x00ISTASH_") === -1) break;
      s = s.replace(/\x00ISTASH_(\d+)\x00/g, function (_m, n) {
        return stash[Number(n)] || "";
      });
    }
    return s;
  }

  function parseBuiltInMarkdown(rawMd) {
    const stash = [];
    function putStash(htmlFrag) {
      const idx = stash.length;
      stash.push(htmlFrag);
      return "\x00STASH_" + idx + "\x00";
    }
    let text = String(rawMd || "").replace(/\r\n/g, "\n");
    // Preserve trusted inline HTML emitted by formatInlineLatexAndFootnotes before escaping
    text = text.replace(
      /<sup class="fn-ref[^"]*"><a [^>]+>\[[^\]]+\]<\/a><\/sup>|<(?:sub|sup|code)>[^<]*<\/(?:sub|sup|code)>|<a href="[^"]+"><code>[^<]+<\/code><\/a>/g,
      function (m) {
        return putStash(m);
      }
    );
    const fenceStash = [];
    text = text.replace(/^\x60\x60\x60[^\n]*\n([\s\S]*?)^\x60\x60\x60\s*$/gm, function (_m, codeBody) {
      const idx = fenceStash.length;
      fenceStash.push("<pre><code>" + escapeHtml(codeBody.replace(/\n$/, "")) + "</code></pre>");
      return "\x00FENCE_" + idx + "\x00";
    });
    function formatInline(s) {
      let line = String(s || "");
      line = line.replace(/\x60([^\x60\n]+)\x60/g, function (_m, code) {
        return putStash("<code>" + escapeHtml(code) + "</code>");
      });
      line = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      line = line.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, lbl, rawHref) {
        const cleanHref = rawHref.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
        const isExt = /^https?:\/\//i.test(cleanHref);
        const safeHref = /^(?:https?:\/\/|mailto:|\/|\.\/|\.\.\/|#|[A-Za-z0-9_\-\/]+\.md)/i.test(cleanHref)
          ? escapeHtml(cleanHref)
          : "#";
        const extAttrs = isExt ? ' target="_blank" rel="noopener noreferrer"' : "";
        const unescapedLbl = lbl
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");
        return putStash("<a" + extAttrs + ' href="' + safeHref + '">' + formatInline(unescapedLbl) + "</a>");
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
      if (!trimmed) {
        i++;
        continue;
      }
      const fenceM = trimmed.match(/^\x00FENCE_(\d+)\x00$/);
      if (fenceM) {
        out.push(fenceStash[Number(fenceM[1])] || "");
        i++;
        continue;
      }
      if (/^(?:---+|\*\*\*+|___+)$/.test(trimmed)) {
        out.push("<hr>");
        i++;
        continue;
      }
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
          return rowStr
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map(function (c) {
              return c.trim();
            });
        };
        const headers = splitCells(rawLine);
        i += 2;
        let tbl =
          "<table><thead><tr>" +
          headers
            .map(function (h) {
              return "<th>" + formatInline(h) + "</th>";
            })
            .join("") +
          "</tr></thead><tbody>";
        while (i < lines.length && lines[i].trim() && lines[i].indexOf("|") !== -1) {
          const cells = splitCells(lines[i]);
          tbl +=
            "<tr>" +
            headers
              .map(function (_h, cIdx) {
                return "<td>" + formatInline(cells[cIdx] || "") + "</td>";
              })
              .join("") +
            "</tr>";
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
        out.push("<blockquote>" + parseBuiltInMarkdown(qLines.join("\n")) + "</blockquote>");
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
              if (i + 1 < lines.length && /^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i + 1])) {
                i++;
                continue;
              }
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
              prefix =
                '<input type="checkbox" disabled' +
                (taskM[1].toLowerCase() === "x" ? " checked" : "") +
                "> ";
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
        !(
          lines[i].indexOf("|") !== -1 &&
          i + 1 < lines.length &&
          /^\s*\|?\s*:?-{2,}:?(?:\s*\|\s*:?-{2,}:?)+\s*\|?\s*$/.test(lines[i + 1])
        )
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

  function renderMarkdownBlock(rawMd, sources, rejectedSourceIds, preserveLeadingH1) {
    const formatted = formatInlineLatexAndFootnotes(rawMd, sources || [], rejectedSourceIds, preserveLeadingH1);
    if (typeof window !== "undefined" && window.marked && typeof window.marked.parse === "function") {
      return window.marked.parse(formatted);
    }
    return parseBuiltInMarkdown(formatted);
  }

  // Component Renderer (Tier 1 A2UI v1.0 Basic Catalog + Tier 2 ICM/OKF Domain Catalog)
  function renderComponentById(surface, compId, scopeData, scopePath, itemIndex) {
    const comp = surface.components[compId];
    if (!comp) {
      const missing = document.createElement("div");
      missing.className = "a2ui-caption";
      missing.textContent = "[Missing component: " + compId + "]";
      return missing;
    }
    return renderComponent(surface, comp, scopeData, scopePath, itemIndex);
  }

  function renderChildList(surface, childrenSpec, containerEl, scopeData, scopePath, itemIndex) {
    if (Array.isArray(childrenSpec)) {
      for (const childId of childrenSpec) {
        containerEl.appendChild(renderComponentById(surface, childId, scopeData, scopePath, itemIndex));
      }
    } else if (childrenSpec && typeof childrenSpec === "object" && childrenSpec.path && childrenSpec.componentId) {
      const listData = resolvePointer(surface.dataModel, childrenSpec.path, scopeData);
      if (Array.isArray(listData)) {
        listData.forEach((itemData, idx) => {
          const itemScopePath = (childrenSpec.path.startsWith("/") ? childrenSpec.path : (scopePath || "") + "/" + childrenSpec.path) + "/" + idx;
          containerEl.appendChild(renderComponentById(surface, childrenSpec.componentId, itemData, itemScopePath, idx));
        });
      }
    }
  }

  function renderComponent(surface, comp, scopeData, scopePath, itemIndex) {
    const type = comp.component;

    // --- TIER 1: A2UI v1.0 BASIC CATALOG PRIMITIVES ---
    if (type === "Column") {
      const el = document.createElement("div");
      el.className = "a2ui-col";
      renderChildList(surface, comp.children, el, scopeData, scopePath, itemIndex);
      return el;
    }

    if (type === "Row") {
      const el = document.createElement("div");
      el.className = "a2ui-row" + (comp.justify === "spaceBetween" ? " justify-between" : "");
      renderChildList(surface, comp.children, el, scopeData, scopePath, itemIndex);
      return el;
    }

    if (type === "List") {
      const el = document.createElement("div");
      el.className = comp.direction === "horizontal" ? "a2ui-row" : "a2ui-col";
      renderChildList(surface, comp.children, el, scopeData, scopePath, itemIndex);
      return el;
    }

    if (type === "Card") {
      const el = document.createElement("div");
      el.className = "a2ui-card";
      if (typeof comp.child === "string") {
        el.appendChild(renderComponentById(surface, comp.child, scopeData, scopePath, itemIndex));
      } else if (comp.children) {
        renderChildList(surface, comp.children, el, scopeData, scopePath, itemIndex);
      }
      return el;
    }

    if (type === "Divider") {
      const hr = document.createElement("hr");
      hr.className = "a2ui-divider";
      return hr;
    }

    if (type === "Text") {
      const variant = resolveDynamic(comp.variant, surface, scopeData, itemIndex) || "body";
      const rawText = String(resolveDynamic(comp.text, surface, scopeData, itemIndex) ?? "");
      if (variant === "body" && rawText.indexOf("\n") === -1 && rawText.indexOf("\r") === -1) {
        const headingMatch = rawText.match(/^\s*(#{1,5})\s+(.+?)\s*#*\s*$/);
        if (headingMatch) {
          const hLvl = headingMatch[1].length;
          const hEl = document.createElement("h" + hLvl);
          hEl.className = "a2ui-h" + hLvl;
          hEl.innerHTML = renderInlineMarkdown(headingMatch[2]);
          return hEl;
        }
      }
      const tagMap = { h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", caption: "p", body: "div" };
      const el = document.createElement(tagMap[variant] || "div");
      el.className = "a2ui-" + (tagMap[variant] ? variant : "body");
      if (
        comp.markdown ||
        (variant === "body" &&
          (/[\r\n]/.test(rawText) ||
            /^(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s?|---+)/.test(rawText.trim())))
      ) {
        el.style.whiteSpace = "normal";
        el.classList.add("okf-md-body");
        el.innerHTML = renderMarkdownBlock(rawText, [], undefined, true);
      } else if (variant === "body" && /(\*\*[^*]+\*\*|\x60[^\x60]+\x60|\[[^\]]+\]\([^)\s]+\))/.test(rawText)) {
        el.innerHTML = renderInlineMarkdown(rawText);
      } else {
        el.textContent = rawText;
      }
      return el;
    }

    if (type === "Badge") {
      const el = document.createElement("span");
      const tone = resolveDynamic(comp.tone, surface, scopeData, itemIndex) || "neutral";
      el.className = "a2ui-badge " + tone;
      el.textContent = String(resolveDynamic(comp.text, surface, scopeData, itemIndex) ?? "");
      return el;
    }

    if (type === "Button") {
      const btn = document.createElement("button");
      const variant = comp.variant || "default";
      btn.className = "a2ui-btn " + variant;
      if (typeof comp.child === "string") {
        btn.appendChild(renderComponentById(surface, comp.child, scopeData, scopePath, itemIndex));
      } else {
        btn.textContent = String(resolveDynamic(comp.label ?? comp.text, surface, scopeData, itemIndex) || "Action");
      }
      btn.addEventListener("click", () => {
        if (comp.action && comp.action.event) {
          const ctx = {};
          const rawCtx = comp.action.event.context || {};
          for (const k of Object.keys(rawCtx)) {
            ctx[k] = resolveDynamic(rawCtx[k], surface, scopeData, itemIndex);
          }
          dispatchClientAction(surface, comp.id, comp.action.event.name, ctx);
        } else if (comp.action && comp.action.functionCall) {
          evaluateFunctionCall(comp.action.functionCall, surface, scopeData, itemIndex);
        }
      });
      return btn;
    }

    if (type === "CheckBox") {
      const labelEl = document.createElement("label");
      const checkedVal = Boolean(resolveDynamic(comp.value, surface, scopeData, itemIndex));
      labelEl.className = "a2ui-checkbox-label" + (checkedVal ? " checked" : "");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checkedVal;
      const span = document.createElement("span");
      span.textContent = String(resolveDynamic(comp.label, surface, scopeData, itemIndex) ?? "");
      input.addEventListener("change", () => {
        const bindPath =
          comp.value && typeof comp.value === "object"
            ? comp.value["@path"] || comp.value.path
            : undefined;
        if (bindPath) {
          setPointer(surface.dataModel, bindPath, input.checked, scopePath);
          recomputeChecklistSummary(surface);
          syncChecklistToOkfBody(surface);
          dispatchClientAction(surface, comp.id, "checkboxChanged", {
            path: bindPath,
            checked: input.checked,
          });
          renderSurface();
        }
      });
      labelEl.appendChild(input);
      labelEl.appendChild(span);
      return labelEl;
    }

    if (type === "TextField") {
      const wrap = document.createElement("div");
      wrap.className = "a2ui-textfield";
      const lbl = resolveDynamic(comp.label, surface, scopeData, itemIndex);
      if (lbl) {
        const l = document.createElement("label");
        l.textContent = String(lbl);
        wrap.appendChild(l);
      }
      const isLong = comp.variant === "longText";
      const input = document.createElement(isLong ? "textarea" : "input");
      if (isLong) {
        input.rows = 3;
      } else if (comp.variant === "number") {
        input.type = "number";
      } else if (comp.variant === "obscured") {
        input.type = "password";
      } else {
        input.type = "text";
      }
      input.value = String(resolveDynamic(comp.value, surface, scopeData, itemIndex) ?? "");
      if (comp.placeholder) input.placeholder = String(comp.placeholder);
      input.addEventListener("input", () => {
        const bindPath =
          comp.value && typeof comp.value === "object"
            ? comp.value["@path"] || comp.value.path
            : undefined;
        if (bindPath) {
          const nextVal = comp.variant === "number" ? Number(input.value) : input.value;
          setPointer(surface.dataModel, bindPath, nextVal, scopePath);
        }
      });
      wrap.appendChild(input);
      return wrap;
    }

    if (type === "ChoicePicker") {
      const wrap = document.createElement("div");
      wrap.className = "a2ui-choice-group";
      const lbl = resolveDynamic(comp.label, surface, scopeData, itemIndex);
      if (lbl) {
        const l = document.createElement("div");
        l.className = "a2ui-h4";
        l.textContent = String(lbl);
        wrap.appendChild(l);
      }
      const options = resolveDynamic(comp.options, surface, scopeData, itemIndex) || [];
      const currentVal = resolveDynamic(comp.value, surface, scopeData, itemIndex);
      const isMulti = comp.variant === "multipleSelection";
      const selectedArr = Array.isArray(currentVal)
        ? currentVal.map(String)
        : currentVal != null && currentVal !== ""
          ? [String(currentVal)]
          : [];

      options.forEach((opt) => {
        const valStr = String(opt.value);
        const isSel = selectedArr.includes(valStr);
        const row = document.createElement("label");
        row.className = "a2ui-choice-opt" + (isSel ? " selected" : "");
        const inp = document.createElement("input");
        inp.type = isMulti ? "checkbox" : "radio";
        inp.checked = isSel;
        inp.addEventListener("change", () => {
          const bindPath =
            comp.value && typeof comp.value === "object"
              ? comp.value["@path"] || comp.value.path
              : undefined;
          if (bindPath) {
            if (isMulti) {
              const nextSet = new Set(selectedArr);
              if (inp.checked) {
                nextSet.add(valStr);
              } else {
                nextSet.delete(valStr);
              }
              setPointer(surface.dataModel, bindPath, Array.from(nextSet), scopePath);
            } else if (Array.isArray(currentVal)) {
              setPointer(surface.dataModel, bindPath, [valStr], scopePath);
            } else {
              setPointer(surface.dataModel, bindPath, valStr, scopePath);
            }
            renderSurface();
          }
        });
        const txt = document.createElement("span");
        txt.textContent = String(resolveDynamic(opt.label, surface, scopeData, itemIndex) ?? opt.value);
        row.appendChild(inp);
        row.appendChild(txt);
        wrap.appendChild(row);
      });
      return wrap;
    }

    if (type === "SpeechPlayer" || type === "AudioPlayer") {
      const wrap = document.createElement("div");
      wrap.className = "a2ui-row";
      wrap.style.flexWrap = "wrap";
      wrap.style.alignItems = "center";
      wrap.style.gap = "8px";
      const desc = String(resolveDynamic(comp.description, surface, scopeData, itemIndex) || "Audio Narration");
      const textToSpeak = String(resolveDynamic(comp.ttsText, surface, scopeData, itemIndex) || "");
      const rawUrl = resolveDynamic(
        type === "SpeechPlayer" ? comp.audioUrl ?? comp.url : comp.url,
        surface,
        scopeData,
        itemIndex
      );

      function buildWebSpeechControls(container) {
        const voiceNote = document.createElement("span");
        voiceNote.className = "a2ui-tts-voice-status";
        voiceNote.style.fontSize = "12px";
        voiceNote.style.display = "none";

        const playBtn = document.createElement("button");
        playBtn.className = "a2ui-btn primary";
        playBtn.textContent = tClient(surface, "listenNarration", { desc: desc });
        playBtn.addEventListener("click", () => {
          speakNarration(
            textToSpeak,
            function (info) {
              voiceNote.style.display = "inline-block";
              if (info && info.matchedTargetLanguage && info.voice) {
                voiceNote.style.color = "var(--muted, #64748b)";
                voiceNote.textContent =
                  "🎙️ " + String(info.voice.name || info.effectiveLang) + " (" + info.effectiveLang + ")";
              } else if (info && !info.matchedTargetLanguage && info.targetLang && info.targetLang !== "en-US") {
                voiceNote.style.color = "#b45309";
                voiceNote.textContent = tClient(surface, "missingBrowserVoiceHint", {
                  lang: info.targetLang,
                });
              } else {
                voiceNote.style.color = "var(--muted, #64748b)";
                voiceNote.textContent = "🎙️ " + String((info && info.effectiveLang) || "TTS");
              }
            },
            surface
          );
        });
        const stopBtn = document.createElement("button");
        stopBtn.className = "a2ui-btn";
        stopBtn.textContent = tClient(surface, "stopNarration");
        stopBtn.addEventListener("click", () => {
          stopActiveSpeech();
          voiceNote.style.display = "none";
        });
        container.appendChild(playBtn);
        container.appendChild(stopBtn);
        container.appendChild(voiceNote);
      }

      const resolvedAudioSrc = resolveClientMediaUri(rawUrl, surface);
      const voicesLabel = String(
        resolveDynamic(comp.voicesLabel, surface, scopeData, itemIndex) || ""
      ).trim();

      if (resolvedAudioSrc && isAllowedMediaUrl(resolvedAudioSrc)) {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.preload = "metadata";
        audio.src = String(resolvedAudioSrc);
        audio.style.width = "100%";
        audio.style.maxWidth = "540px";
        audio.style.height = "40px";
        const studioBadge = document.createElement("span");
        studioBadge.className = "a2ui-badge neutral";
        studioBadge.textContent = voicesLabel
          ? tClient(surface, "studioAudioVoicesBadge", { voices: voicesLabel })
          : tClient(surface, "studioAudioBadge");
        audio.addEventListener("play", () => {
          if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
          if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
            try {
              document.querySelectorAll("audio").forEach(function (other) {
                if (other !== audio && other && typeof other.pause === "function") {
                  try {
                    other.pause();
                  } catch (_e) {}
                }
              });
            } catch (_e) {}
          }
        });
        wrap.appendChild(audio);
        wrap.appendChild(studioBadge);
        if (type === "SpeechPlayer" && textToSpeak) {
          const fallbackWrap = document.createElement("div");
          fallbackWrap.className = "a2ui-row";
          fallbackWrap.style.display = "none";
          fallbackWrap.style.flexWrap = "wrap";
          fallbackWrap.style.alignItems = "center";
          fallbackWrap.style.gap = "8px";
          buildWebSpeechControls(fallbackWrap);
          audio.addEventListener("error", () => {
            audio.style.display = "none";
            studioBadge.style.display = "none";
            fallbackWrap.style.display = "flex";
          });
          wrap.appendChild(fallbackWrap);
        }
      } else if (type === "SpeechPlayer" || textToSpeak) {
        buildWebSpeechControls(wrap);
      }
      return wrap;
    }

    if (type === "Image") {
      const rawImgUrl = String(resolveDynamic(comp.url, surface, scopeData, itemIndex) || "");
      const resolvedImgUrl = resolveClientMediaUri(rawImgUrl, surface);
      if (!isAllowedMediaUrl(resolvedImgUrl)) {
        const emptyImg = document.createElement("span");
        emptyImg.style.display = "none";
        return emptyImg;
      }
      const altText = String(resolveDynamic(comp.description ?? comp.alt, surface, scopeData, itemIndex) || "");
      const img = document.createElement("img");
      img.src = resolvedImgUrl;
      img.alt = altText;
      img.loading = "lazy";
      if (comp.variant === "header") {
        const fig = document.createElement("figure");
        fig.style.margin = "0 0 8px 0";
        fig.style.borderRadius = "10px";
        fig.style.overflow = "hidden";
        fig.style.border = "1px solid var(--border)";
        fig.style.background = "var(--bg)";
        img.style.width = "100%";
        img.style.aspectRatio = "16 / 9";
        img.style.objectFit = String(comp.fit || "cover");
        img.style.display = "block";
        img.addEventListener("error", () => {
          fig.style.display = "none";
        });
        fig.appendChild(img);
        return fig;
      }
      img.style.maxWidth = "100%";
      img.style.borderRadius = "8px";
      if (comp.fit) img.style.objectFit = String(comp.fit);
      img.addEventListener("error", () => {
        img.style.display = "none";
      });
      return img;
    }

    if (type === "Icon") {
      const span = document.createElement("span");
      span.className = "a2ui-badge neutral";
      const iconName = resolveDynamic(comp.name, surface, scopeData, itemIndex);
      span.textContent =
        typeof iconName === "object" && iconName && (iconName["@path"] || iconName.path)
          ? iconName["@path"] || iconName.path
          : String(iconName || "•");
      return span;
    }

    if (type === "Video") {
      const video = document.createElement("video");
      video.controls = true;
      const rawVidUrl = String(resolveDynamic(comp.url, surface, scopeData, itemIndex) || "");
      const resolvedVidUrl = resolveClientMediaUri(rawVidUrl, surface);
      if (isAllowedMediaUrl(resolvedVidUrl)) {
        video.src = resolvedVidUrl;
      }
      const rawPosterUrl = String(resolveDynamic(comp.posterUrl, surface, scopeData, itemIndex) || "");
      const resolvedPosterUrl = resolveClientMediaUri(rawPosterUrl, surface);
      if (resolvedPosterUrl && isAllowedMediaUrl(resolvedPosterUrl)) {
        video.poster = resolvedPosterUrl;
      }
      video.style.maxWidth = "100%";
      video.style.borderRadius = "8px";
      return video;
    }

    if (type === "Slider") {
      const wrap = document.createElement("div");
      wrap.className = "a2ui-textfield";
      const lbl = resolveDynamic(comp.label, surface, scopeData, itemIndex);
      const curVal = Number(resolveDynamic(comp.value, surface, scopeData, itemIndex) ?? comp.min ?? 0);
      if (lbl) {
        const l = document.createElement("label");
        l.textContent = String(lbl) + ": " + curVal;
        wrap.appendChild(l);
      }
      const inp = document.createElement("input");
      inp.type = "range";
      inp.min = String(comp.min ?? 0);
      inp.max = String(comp.max ?? 100);
      inp.value = String(curVal);
      inp.addEventListener("input", () => {
        const bindPath =
          comp.value && typeof comp.value === "object"
            ? comp.value["@path"] || comp.value.path
            : undefined;
        if (bindPath) {
          setPointer(surface.dataModel, bindPath, Number(inp.value), scopePath);
          renderSurface();
        }
      });
      wrap.appendChild(inp);
      return wrap;
    }

    if (type === "DateTimeInput") {
      const wrap = document.createElement("div");
      wrap.className = "a2ui-textfield";
      const lbl = resolveDynamic(comp.label, surface, scopeData, itemIndex);
      if (lbl) {
        const l = document.createElement("label");
        l.textContent = String(lbl);
        wrap.appendChild(l);
      }
      const inp = document.createElement("input");
      inp.type = comp.enableTime && comp.enableDate !== false ? "datetime-local" : comp.enableTime ? "time" : "date";
      inp.value = String(resolveDynamic(comp.value, surface, scopeData, itemIndex) || "");
      inp.addEventListener("change", () => {
        const bindPath =
          comp.value && typeof comp.value === "object"
            ? comp.value["@path"] || comp.value.path
            : undefined;
        if (bindPath) {
          setPointer(surface.dataModel, bindPath, inp.value, scopePath);
        }
      });
      wrap.appendChild(inp);
      return wrap;
    }

    if (type === "Modal") {
      const wrap = document.createElement("div");
      const trigId = comp.trigger || comp.entryPointChild;
      const contentId = comp.content || comp.contentChild;
      const isOpen = Boolean(surface.uiState["modal_" + comp.id]);
      if (typeof trigId === "string") {
        const trigEl = renderComponentById(surface, trigId, scopeData, scopePath);
        trigEl.addEventListener("click", () => {
          surface.uiState["modal_" + comp.id] = true;
          renderSurface();
        });
        wrap.appendChild(trigEl);
      }
      if (isOpen && typeof contentId === "string") {
        const backdrop = document.createElement("div");
        backdrop.className = "a2ui-modal-backdrop";
        const dialog = document.createElement("div");
        dialog.className = "a2ui-modal-dialog";
        const header = document.createElement("div");
        header.className = "a2ui-modal-header";
        header.innerHTML = "<strong>Modal</strong>";
        const closeBtn = document.createElement("button");
        closeBtn.className = "a2ui-btn";
        closeBtn.textContent = tClient(surface, "closeBtn");
        closeBtn.addEventListener("click", () => {
          surface.uiState["modal_" + comp.id] = false;
          renderSurface();
        });
        header.appendChild(closeBtn);
        const body = document.createElement("div");
        body.className = "a2ui-modal-body";
        body.appendChild(renderComponentById(surface, contentId, scopeData, scopePath));
        dialog.appendChild(header);
        dialog.appendChild(body);
        backdrop.appendChild(dialog);
        wrap.appendChild(backdrop);
      }
      return wrap;
    }

    if (type === "Tabs") {
      const wrap = document.createElement("div");
      const tabsList = comp.tabs || comp.tabItems || [];
      const activeIdx = surface.uiState.activeTabs[comp.id] || 0;

      const nav = document.createElement("div");
      nav.className = "a2ui-tabs-nav";
      tabsList.forEach((tab, idx) => {
        const btn = document.createElement("button");
        btn.className = "a2ui-tab-btn" + (idx === activeIdx ? " active" : "");
        btn.textContent = String(resolveDynamic(tab.title, surface, scopeData) || "Tab " + (idx + 1));
        btn.addEventListener("click", () => {
          stopActiveSpeech();
          surface.uiState.activeTabs[comp.id] = idx;
          renderSurface();
        });
        nav.appendChild(btn);
      });
      wrap.appendChild(nav);

      const activeTab = tabsList[activeIdx] || tabsList[0];
      if (activeTab && typeof activeTab.child === "string") {
        wrap.appendChild(renderComponentById(surface, activeTab.child, scopeData, scopePath));
      }
      return wrap;
    }

    // --- TIER 2: ICM + OKF v0.3 DOMAIN CUSTOM COMPONENTS ---
    if (type === "InteractiveChecklist") {
      const wrap = document.createElement("div");
      wrap.className = "a2ui-col";
      const groups = resolvePointer(surface.dataModel, comp.groupsPath || "/checklist/groups") || [];
      const summaryText = resolvePointer(surface.dataModel, "/checklist/summaryText") || "";
      const pct = Number(resolvePointer(surface.dataModel, "/checklist/percent") || 0);

      const headerCard = document.createElement("div");
      headerCard.className = "a2ui-card a2ui-col";
      const topRow = document.createElement("div");
      topRow.className = "a2ui-row justify-between";
      const titleEl = document.createElement("h2");
      titleEl.className = "a2ui-h2";
      titleEl.textContent = String(
        resolveDynamic(comp.title, surface, scopeData) || tClient(surface, "checklistShortTitle")
      );
      const badge = document.createElement("span");
      badge.className = "a2ui-badge " + (pct === 100 ? "success" : "primary");
      badge.textContent = summaryText;
      topRow.appendChild(titleEl);
      topRow.appendChild(badge);
      headerCard.appendChild(topRow);

      const progWrap = document.createElement("div");
      progWrap.className = "a2ui-progress-wrap";
      const progFill = document.createElement("div");
      progFill.className = "a2ui-progress-fill";
      progFill.style.width = pct + "%";
      progWrap.appendChild(progFill);
      headerCard.appendChild(progWrap);

      const btnRow = document.createElement("div");
      btnRow.className = "a2ui-row";
      const checkAllBtn = document.createElement("button");
      checkAllBtn.className = "a2ui-btn";
      checkAllBtn.textContent = tClient(surface, "checkAllBtn");
      checkAllBtn.addEventListener("click", () => dispatchClientAction(surface, comp.id, "checkAllChecklist", {}));
      const resetBtn = document.createElement("button");
      resetBtn.className = "a2ui-btn";
      resetBtn.textContent = tClient(surface, "resetChecklistBtn");
      resetBtn.addEventListener("click", () => dispatchClientAction(surface, comp.id, "resetChecklist", {}));
      btnRow.appendChild(checkAllBtn);
      btnRow.appendChild(resetBtn);
      headerCard.appendChild(btnRow);
      wrap.appendChild(headerCard);

      groups.forEach((grp, gIdx) => {
        const grpCard = document.createElement("div");
        grpCard.className = "a2ui-card a2ui-col";
        const grpHeader = document.createElement("div");
        grpHeader.className = "a2ui-row justify-between";
        const h3 = document.createElement("h3");
        h3.className = "a2ui-h3";
        h3.textContent = grp.title;
        const doneInGrp = (grp.items || []).filter((i) => i.checked).length;
        const subBadge = document.createElement("span");
        subBadge.className = "a2ui-badge " + (doneInGrp === (grp.items || []).length ? "success" : "neutral");
        subBadge.textContent = doneInGrp + " / " + (grp.items || []).length;
        grpHeader.appendChild(h3);
        grpHeader.appendChild(subBadge);
        grpCard.appendChild(grpHeader);

        const itemsCol = document.createElement("div");
        itemsCol.className = "a2ui-col";
        itemsCol.style.gap = "4px";
        (grp.items || []).forEach((item, iIdx) => {
          const itemPath = (comp.groupsPath || "/checklist/groups") + "/" + gIdx + "/items/" + iIdx + "/checked";
          const chkComp = {
            id: comp.id + "_" + grp.id + "_" + item.id,
            component: "CheckBox",
            label: item.label,
            value: { "@path": itemPath },
          };
          itemsCol.appendChild(renderComponent(surface, chkComp, undefined, undefined));
        });
        grpCard.appendChild(itemsCol);
        wrap.appendChild(grpCard);
      });

      return wrap;
    }

    if (type === "ModuleCarousel") {
      const isAnalysis = isAnalysisSurface(surface);
      const wrap = document.createElement("div");
      wrap.className = "a2ui-col";
      const modules = resolvePointer(surface.dataModel, comp.modulesPath || "/stage2/modules") || [];
      const activeIdxPath = comp.activeIndexPath || "/stage2/activeModuleIndex";
      let idx = Number(resolvePointer(surface.dataModel, activeIdxPath) || 0);
      if (idx < 0 || idx >= modules.length) idx = 0;

      if (modules.length === 0) {
        const empty = document.createElement("div");
        empty.className = "a2ui-card a2ui-caption";
        empty.textContent = tClient(surface, "noModulesEmpty");
        return empty;
      }

      const mod = modules[idx];
      const navRow = document.createElement("div");
      navRow.className = "a2ui-row justify-between";
      const pillRow = document.createElement("div");
      pillRow.className = "a2ui-row";
      modules.forEach((m, mIdx) => {
        const b = document.createElement("button");
        b.className = "a2ui-btn" + (mIdx === idx ? " primary" : "");
        b.textContent = (m.number || mIdx + 1) + ". " + m.title;
        b.addEventListener("click", () => {
          stopActiveSpeech();
          setPointer(surface.dataModel, activeIdxPath, mIdx);
          renderSurface();
        });
        pillRow.appendChild(b);
      });
      navRow.appendChild(pillRow);
      wrap.appendChild(navRow);

      const card = document.createElement("div");
      card.className = "a2ui-card a2ui-col";
      const headRow = document.createElement("div");
      headRow.className = "a2ui-row justify-between";
      const h2 = document.createElement("h2");
      h2.className = "a2ui-h2";
      const itemLabel = tClient(surface, isAnalysis ? "pillarPrefix" : "modulePrefix") + " ";
      h2.textContent = itemLabel + (mod.number || idx + 1) + ": " + mod.title;
      headRow.appendChild(h2);
      const badgeWrap = document.createElement("div");
      badgeWrap.className = "a2ui-row";
      if (mod.durationOrMeta) {
        const durBadge = document.createElement("span");
        durBadge.className = "a2ui-badge neutral";
        const durTxt = String(mod.durationOrMeta).trim();
        durBadge.textContent = durTxt.startsWith("⏱") ? durTxt : "⏱️ " + durTxt;
        badgeWrap.appendChild(durBadge);
      }
      if (mod.subtitleOrBasis) {
        const basisBadge = document.createElement("span");
        basisBadge.className = "a2ui-badge accent";
        basisBadge.textContent = mod.subtitleOrBasis;
        badgeWrap.appendChild(basisBadge);
      }
      if (badgeWrap.childNodes.length > 0) {
        headRow.appendChild(badgeWrap);
      }
      card.appendChild(headRow);

      const modImgSrc = resolveClientMediaUri(mod.imageUrl, surface);
      if (modImgSrc && isAllowedMediaUrl(modImgSrc)) {
        const fig = document.createElement("figure");
        fig.style.margin = "0";
        fig.style.borderRadius = "10px";
        fig.style.overflow = "hidden";
        fig.style.border = "1px solid var(--border)";
        fig.style.background = "var(--bg)";
        const figImg = document.createElement("img");
        figImg.src = String(modImgSrc);
        figImg.alt = String(mod.imageCaption || mod.title || "");
        figImg.loading = "lazy";
        figImg.style.width = "100%";
        figImg.style.aspectRatio = "16 / 9";
        figImg.style.objectFit = "cover";
        figImg.style.display = "block";
        figImg.addEventListener("error", () => {
          fig.style.display = "none";
        });
        fig.appendChild(figImg);
        const figCap = document.createElement("figcaption");
        figCap.style.padding = "8px 12px";
        figCap.style.fontSize = "12px";
        figCap.style.color = "var(--muted, #64748b)";
        figCap.style.borderTop = "1px solid var(--border)";
        figCap.style.background = "var(--surface-subtle, #f8fafc)";
        figCap.textContent =
          "🎨 " + String(mod.imageCaption || itemLabel + (mod.number || idx + 1) + ": " + mod.title);
        fig.appendChild(figCap);
        card.appendChild(fig);
      }

      if (mod.narration) {
        const narBox = document.createElement("div");
        narBox.className = "a2ui-body okf-md-body";
        narBox.style.padding = "14px 16px";
        narBox.style.background = "var(--bg)";
        narBox.style.borderRadius = "8px";
        narBox.style.borderLeft = "4px solid var(--primary)";
        narBox.style.whiteSpace = "normal";
        narBox.innerHTML = renderMarkdownBlock(mod.narration, []);
        card.appendChild(narBox);

        const ttsPlayer = renderComponent(surface, {
          id: comp.id + "_tts_" + idx,
          component: "SpeechPlayer",
          "@catalogId": "https://a2ui.org/specification/v1_0/catalogs/icm-okf-v0.3/catalog.json",
          description: mod.title,
          ttsText: mod.spokenNarration || mod.narration,
          audioUrl: mod.audioUrl || "",
          voicesLabel: mod.audioVoices || "",
        });
        card.appendChild(ttsPlayer);
      }

      if (Array.isArray(mod.bullets) && mod.bullets.length > 0) {
        const ulWrap = document.createElement("div");
        ulWrap.className = "a2ui-col";
        const h4 = document.createElement("h4");
        h4.className = "a2ui-h4";
        h4.textContent = tClient(surface, isAnalysis ? "keyPointsAnalysis" : "keyPointsCourse");
        ulWrap.appendChild(h4);
        const ul = document.createElement("ul");
        ul.style.margin = "0";
        mod.bullets.forEach((bText) => {
          const li = document.createElement("li");
          li.innerHTML = renderInlineMarkdown(bText);
          ul.appendChild(li);
        });
        ulWrap.appendChild(ul);
        card.appendChild(ulWrap);
      }

      if (mod.actionItem) {
        const actBox = document.createElement("div");
        actBox.style.padding = "12px 14px";
        actBox.style.background = "var(--success-soft)";
        actBox.style.border = "1px solid var(--success-border)";
        actBox.style.borderRadius = "8px";
        const actTitle = tClient(surface, isAnalysis ? "actionItemAnalysis" : "actionItemCourse");
        actBox.innerHTML =
          "<strong>" +
          escapeHtml(actTitle) +
          "</strong><div class='okf-md-body' style='margin-top:4px'>" +
          renderMarkdownBlock(mod.actionItem, []) +
          "</div>";
        card.appendChild(actBox);
      }

      const pager = document.createElement("div");
      pager.className = "a2ui-row justify-between";
      const prevBtn = document.createElement("button");
      prevBtn.className = "a2ui-btn";
      prevBtn.disabled = idx === 0;
      prevBtn.textContent = tClient(surface, isAnalysis ? "prevModuleAnalysis" : "prevModuleCourse");
      prevBtn.addEventListener("click", () => {
        if (idx > 0) {
          stopActiveSpeech();
          setPointer(surface.dataModel, activeIdxPath, idx - 1);
          renderSurface();
        }
      });
      const nextBtn = document.createElement("button");
      nextBtn.className = "a2ui-btn primary";
      nextBtn.disabled = idx >= modules.length - 1;
      nextBtn.textContent = tClient(surface, isAnalysis ? "nextModuleAnalysis" : "nextModuleCourse");
      nextBtn.addEventListener("click", () => {
        if (idx < modules.length - 1) {
          stopActiveSpeech();
          setPointer(surface.dataModel, activeIdxPath, idx + 1);
          renderSurface();
        }
      });
      pager.appendChild(prevBtn);
      pager.appendChild(nextBtn);
      card.appendChild(pager);

      wrap.appendChild(card);
      return wrap;
    }

    if (type === "QuizRunner") {
      const wrap = document.createElement("div");
      wrap.className = "a2ui-col";
      const questions = resolvePointer(surface.dataModel, comp.questionsPath || "/stage2/quiz") || [];
      const answersPath = comp.answersPath || "/stage2/quizAnswers";
      const answers = resolvePointer(surface.dataModel, answersPath) || {};

      let answeredCount = 0;
      let correctCount = 0;
      questions.forEach((q) => {
        if (answers[q.id] !== undefined) {
          answeredCount++;
          const ansVal = Array.isArray(answers[q.id]) ? answers[q.id][0] : answers[q.id];
          if (String(ansVal) === String(q.correctValue)) correctCount++;
        }
      });

      const scoreCard = document.createElement("div");
      scoreCard.className = "a2ui-card a2ui-row justify-between";
      const scoreTitle = document.createElement("h2");
      scoreTitle.className = "a2ui-h2";
      scoreTitle.textContent = String(
        resolveDynamic(comp.title, surface, scopeData) || tClient(surface, "quizShortTitle")
      );
      const scoreBadge = document.createElement("span");
      scoreBadge.className = "a2ui-badge " + (correctCount === questions.length && questions.length > 0 ? "success" : "primary");
      scoreBadge.textContent = tClient(surface, "quizScoreBadge", {
        correct: correctCount,
        total: questions.length,
        answered: answeredCount,
      });
      scoreCard.appendChild(scoreTitle);
      scoreCard.appendChild(scoreBadge);
      wrap.appendChild(scoreCard);

      questions.forEach((q, qIdx) => {
        const qCard = document.createElement("div");
        qCard.className = "a2ui-card a2ui-col";
        const qHeadRow = document.createElement("div");
        qHeadRow.className = "a2ui-row justify-between";
        const qHead = document.createElement("h3");
        qHead.className = "a2ui-h3";
        qHead.innerHTML = renderInlineMarkdown((qIdx + 1) + ". " + q.question);
        qHeadRow.appendChild(qHead);
        if (q.sourceModule) {
          const srcModBadge = document.createElement("span");
          srcModBadge.className = "a2ui-badge neutral";
          srcModBadge.textContent = q.sourceModule;
          qHeadRow.appendChild(srcModBadge);
        }
        qCard.appendChild(qHeadRow);

        const picker = renderComponent(surface, {
          id: comp.id + "_q_" + q.id,
          component: "ChoicePicker",
          variant: "mutuallyExclusive",
          options: q.options,
          value: { "@path": answersPath + "/" + q.id },
        });
        qCard.appendChild(picker);

        const rawChosen = answers[q.id];
        const chosen = Array.isArray(rawChosen) ? rawChosen[0] : rawChosen;
        if (chosen !== undefined) {
          const isRight = String(chosen) === String(q.correctValue);
          const fb = document.createElement("div");
          fb.style.padding = "10px 12px";
          fb.style.borderRadius = "7px";
          fb.style.background = isRight ? "var(--success-soft)" : "var(--danger-soft)";
          fb.style.border = "1px solid " + (isRight ? "var(--success-border)" : "var(--danger-border)");
          fb.innerHTML =
            "<strong>" +
            escapeHtml(tClient(surface, isRight ? "quizCorrect" : "quizIncorrect")) +
            "</strong> " +
            renderInlineMarkdown(q.explanation || "");
          qCard.appendChild(fb);
        }
        wrap.appendChild(qCard);
      });
      return wrap;
    }

    if (type === "CaseSimulator") {
      const isAnalysis = isAnalysisSurface(surface);
      const wrap = document.createElement("div");
      wrap.className = "a2ui-col";
      const cases = resolvePointer(surface.dataModel, comp.casesPath || "/stage2/cases") || [];
      const responsesPath = comp.responsesPath || "/stage2/caseResponses";
      const revealedPath = "/stage2/caseRevealed";
      const revealed = resolvePointer(surface.dataModel, revealedPath) || {};

      cases.forEach((c, cIdx) => {
        const card = document.createElement("div");
        card.className = "a2ui-card a2ui-col";
        const top = document.createElement("div");
        top.className = "a2ui-row justify-between";
        const h3 = document.createElement("h3");
        h3.className = "a2ui-h3";
        const casePrefix = tClient(surface, isAnalysis ? "scenarioPrefix" : "casePrefix") + " ";
        h3.textContent = casePrefix + (cIdx + 1) + ": " + c.title;
        top.appendChild(h3);
        if (c.basisOrContext) {
          const b = document.createElement("span");
          b.className = "a2ui-badge accent";
          b.textContent = c.basisOrContext;
          top.appendChild(b);
        }
        card.appendChild(top);

        const scen = document.createElement("div");
        scen.className = "a2ui-body okf-md-body";
        scen.style.whiteSpace = "normal";
        scen.innerHTML = renderMarkdownBlock(c.scenario, []);
        card.appendChild(scen);

        const tf = renderComponent(surface, {
          id: comp.id + "_input_" + c.id,
          component: "TextField",
          variant: "longText",
          label: tClient(surface, isAnalysis ? "caseResponseLabelAnalysis" : "caseResponseLabelCourse"),
          placeholder: tClient(
            surface,
            isAnalysis ? "caseResponsePlaceholderAnalysis" : "caseResponsePlaceholderCourse"
          ),
          value: { "@path": responsesPath + "/" + c.id },
        });
        card.appendChild(tf);

        if (c.recommendedAction) {
          const toggleBtn = document.createElement("button");
          toggleBtn.className = "a2ui-btn";
          const isRev = Boolean(revealed[c.id]);
          toggleBtn.textContent = tClient(
            surface,
            isRev ? "hideRecommendedAction" : "showRecommendedAction"
          );
          toggleBtn.addEventListener("click", () => {
            setPointer(surface.dataModel, revealedPath + "/" + c.id, !isRev);
            renderSurface();
          });
          card.appendChild(toggleBtn);

          if (isRev) {
            const rec = document.createElement("div");
            rec.style.padding = "12px";
            rec.style.background = "var(--success-soft)";
            rec.style.border = "1px solid var(--success-border)";
            rec.style.borderRadius = "8px";
            const recHeader = tClient(surface, "recommendedActionHeader");
            rec.innerHTML =
              "<strong>" +
              escapeHtml(recHeader) +
              "</strong><div class='okf-md-body' style='margin-top:6px'>" +
              renderMarkdownBlock(c.recommendedAction, []) +
              "</div>";
            card.appendChild(rec);
          }
        }
        wrap.appendChild(card);
      });
      return wrap;
    }

    if (type === "OkfMarkdown") {
      const defaultVerifier = tClient(surface, "defaultVerifierActor") || "human:reviewer";
      const outerWrap = document.createElement("div");
      outerWrap.className = "okf-md-outer";
      const wrap = document.createElement("div");
      wrap.className = "okf-md-container okf-split";
      const bodyMd = String(resolveDynamic(comp.body, surface, scopeData) || "");
      const sources = resolveDynamic(comp.sources, surface, scopeData) || [];
      const trustTier = String(resolveDynamic(comp.trustTier, surface, scopeData) || "unverified");
      const statusVal = String(resolvePointer(surface.dataModel, "/okf/status") || "draft");
      const isStale = Boolean(resolveDynamic(comp.isStale, surface, scopeData));
      const editModePath = "/okf/editMode";
      const isEditing = Boolean(resolvePointer(surface.dataModel, editModePath));
      const viewingStub = Boolean(resolvePointer(surface.dataModel, "/okf/viewingStubConcept"));
      if (resolvePointer(surface.dataModel, "/okf/rejectedSources") === undefined) {
        setPointer(surface.dataModel, "/okf/rejectedSources", []);
      }
      if (resolvePointer(surface.dataModel, "/okf/replacedSources") === undefined) {
        setPointer(surface.dataModel, "/okf/replacedSources", {});
      }
      if (resolvePointer(surface.dataModel, "/okf/replaceOpenSources") === undefined) {
        setPointer(surface.dataModel, "/okf/replaceOpenSources", {});
      }
      if (resolvePointer(surface.dataModel, "/okf/addedSources") === undefined) {
        setPointer(surface.dataModel, "/okf/addedSources", []);
      }
      const rejectedSources = (resolvePointer(surface.dataModel, "/okf/rejectedSources") || []).map(String);
      const rejectedSet = new Set(rejectedSources);
      const replacedSources = resolvePointer(surface.dataModel, "/okf/replacedSources") || {};
      const replaceOpenSources = resolvePointer(surface.dataModel, "/okf/replaceOpenSources") || {};
      const addedSources = resolvePointer(surface.dataModel, "/okf/addedSources") || [];
      const activeSourcesList = sources.filter(function (s) {
        return s && !rejectedSet.has(String(s.id || ""));
      });
      const activeSourceCount = activeSourcesList.length;
      const replacedSourceCount = Object.keys(replacedSources).filter(function (k) {
        const tgt = String(replacedSources[k] || "").trim();
        return Boolean(tgt) && tgt !== k && !rejectedSet.has(tgt);
      }).length;
      const curationPrompts = buildCurationPrompts(surface);

      function bindCopyBtn(btn, getText, defaultLabel) {
        btn.addEventListener("click", function () {
          const txt = getText();
          if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).catch(function () {});
          }
          btn.textContent = tClient(surface, "copiedFeedback");
          setTimeout(function () {
            btn.textContent = defaultLabel;
          }, 1800);
        });
      }

      if (!viewingStub) {
        const curationBanner = document.createElement("div");
        curationBanner.className = "a2ui-card okf-curation-banner";
        curationBanner.id = "okf-curation-banner";

        const bannerTop = document.createElement("div");
        bannerTop.className = "a2ui-row justify-between";
        const bannerLeft = document.createElement("div");
        bannerLeft.className = "a2ui-row";
        const isStage1OnlyBanner = Boolean(
          resolvePointer(surface.dataModel, "/stage1/isStage1Only") ||
            resolvePointer(surface.dataModel, "/meta/isStage1Only")
        );
        const bannerTitle = document.createElement("strong");
        bannerTitle.style.fontSize = "14px";
        bannerTitle.textContent = tClient(
          surface,
          isStage1OnlyBanner ? "intermissionBannerStage1" : "intermissionBannerFull"
        );
        bannerLeft.appendChild(bannerTitle);

        const statusChip = document.createElement("span");
        statusChip.className = "a2ui-badge " + (statusVal === "stable" ? "success" : "warn");
        statusChip.textContent = "status: " + statusVal;
        bannerLeft.appendChild(statusChip);

        const trustChip = document.createElement("span");
        trustChip.className = "a2ui-badge " + (trustTier === "human-reviewed" ? "accent" : "primary");
        trustChip.textContent = "trust: " + trustTier;
        bannerLeft.appendChild(trustChip);

        const activeChip = document.createElement("span");
        activeChip.className = "a2ui-badge primary";
        activeChip.textContent = tClient(surface, "activeSourcesChip", { count: activeSourceCount });
        bannerLeft.appendChild(activeChip);

        if (rejectedSources.length > 0) {
          const rejChip = document.createElement("span");
          rejChip.className = "a2ui-badge danger";
          rejChip.textContent = tClient(surface, "rejectedSourcesChip", { count: rejectedSources.length });
          bannerLeft.appendChild(rejChip);
        }
        if (replacedSourceCount > 0) {
          const replChip = document.createElement("span");
          replChip.className = "a2ui-badge accent";
          replChip.textContent = tClient(surface, "replacedSourcesChip", { count: replacedSourceCount });
          bannerLeft.appendChild(replChip);
        }
        if (addedSources.length > 0) {
          const addChip = document.createElement("span");
          addChip.className = "a2ui-badge success";
          addChip.textContent = tClient(surface, "addedSourcesChip", { count: addedSources.length });
          bannerLeft.appendChild(addChip);
        }

        const jumpSourcesBtn = document.createElement("button");
        jumpSourcesBtn.type = "button";
        jumpSourcesBtn.className = "a2ui-btn";
        jumpSourcesBtn.id = "okf-jump-sources-btn";
        jumpSourcesBtn.style.padding = "3px 9px";
        jumpSourcesBtn.style.fontSize = "11.5px";
        jumpSourcesBtn.textContent = tClient(surface, "jumpToSourcesBtn", { count: sources.length });
        jumpSourcesBtn.addEventListener("click", function () {
          const panelEl = document.getElementById("okf-sources-panel");
          if (panelEl && panelEl.scrollIntoView) {
            panelEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
        bannerLeft.appendChild(jumpSourcesBtn);

        const bannerRight = document.createElement("div");
        bannerRight.className = "a2ui-row";

        const verifierWrap = document.createElement("label");
        verifierWrap.className = "a2ui-row";
        verifierWrap.style.gap = "6px";
        verifierWrap.style.fontSize = "12px";
        verifierWrap.style.color = "var(--text-muted)";
        verifierWrap.textContent = tClient(surface, "verifierLabel");
        const verifierInput = document.createElement("input");
        verifierInput.type = "text";
        verifierInput.className = "a2ui-input";
        verifierInput.id = "okf-verifier-actor-input";
        verifierInput.style.width = "175px";
        verifierInput.style.padding = "4px 8px";
        verifierInput.style.fontSize = "12px";
        let initialVerifier = String(resolvePointer(surface.dataModel, "/okf/verifierActor") || "").trim();
        const isMachineActorStr = function (actorStr) {
          if (!actorStr) return false;
          return (
            /^(?:process|team):/i.test(actorStr) ||
            /^icm-co-architect\b/i.test(actorStr) ||
            (!/^human:/i.test(actorStr) && actorStr.indexOf("/") !== -1)
          );
        };
        if (
          !initialVerifier ||
          isMachineActorStr(initialVerifier) ||
          initialVerifier === defaultVerifier ||
          initialVerifier === "human:reviewer"
        ) {
          if (isMachineActorStr(initialVerifier)) {
            initialVerifier = "";
          }
          try {
            const savedV =
              typeof localStorage !== "undefined"
                ? String(localStorage.getItem("icm_a2ui_verifier_actor") || "").trim()
                : "";
            if (savedV && !isMachineActorStr(savedV)) initialVerifier = savedV;
          } catch (_e) {}
        }
        const resolvedHumanVerifier = initialVerifier || defaultVerifier;
        verifierInput.value = resolvedHumanVerifier;
        setPointer(surface.dataModel, "/okf/verifierActor", resolvedHumanVerifier);
        verifierInput.placeholder = tClient(surface, "verifierPlaceholder");
        verifierInput.addEventListener("input", function () {
          const val = String(verifierInput.value || "").trim();
          setPointer(surface.dataModel, "/okf/verifierActor", val);
          try {
            if (typeof localStorage !== "undefined" && val && !isMachineActorStr(val)) {
              localStorage.setItem("icm_a2ui_verifier_actor", val);
            }
          } catch (_e) {}
          const updated = buildCurationPrompts(surface);
          const agyEl = document.getElementById("okf-curation-agy-text");
          if (agyEl) agyEl.textContent = updated.agyText;
          const cliEl = document.getElementById("okf-curation-cli-text");
          if (cliEl) cliEl.textContent = updated.cliText;
        });
        verifierWrap.appendChild(verifierInput);
        bannerRight.appendChild(verifierWrap);

        const canPingPong = Boolean(resolvePointer(surface.dataModel, "/meta/canPingPong"));
        if (canPingPong) {
          const pingPongLabel = tClient(surface, "approveAndSendBtn");
          const pingPongBtn = document.createElement("button");
          pingPongBtn.className = "a2ui-btn primary";
          pingPongBtn.id = "okf-pingpong-agy-btn";
          pingPongBtn.style.background = "linear-gradient(135deg, #059669, #10b981)";
          pingPongBtn.style.borderColor = "#059669";
          pingPongBtn.textContent = pingPongLabel;
          pingPongBtn.addEventListener("click", function () {
            const rawInputActor = String(
              verifierInput.value || resolvePointer(surface.dataModel, "/okf/verifierActor") || ""
            ).trim();
            const normalizedHumanActor =
              !rawInputActor || isMachineActorStr(rawInputActor)
                ? String(defaultVerifier || "human:reviewer").replace(/\s+/g, "-")
                : /^human:/i.test(rawInputActor)
                  ? "human:" + rawInputActor.replace(/^human:/i, "").trim().replace(/\s+/g, "-")
                  : "human:" + rawInputActor.replace(/\s+/g, "-");
            setPointer(surface.dataModel, "/okf/verifierActor", normalizedHumanActor);
            const currentPrompts = buildCurationPrompts(surface);
            const payloadObj = {
              runId: String(resolvePointer(surface.dataModel, "/meta/runId") || ""),
              verifierActor: normalizedHumanActor,
              rejectedSources: (resolvePointer(surface.dataModel, "/okf/rejectedSources") || []).map(String),
              replacedSources: resolvePointer(surface.dataModel, "/okf/replacedSources") || {},
              addedSources: resolvePointer(surface.dataModel, "/okf/addedSources") || [],
              agyText: currentPrompts.agyText,
              cliText: currentPrompts.cliText,
              timestamp: new Date().toISOString(),
            };
            const jsonStr = JSON.stringify(payloadObj);
            const rpcCallObj = {
              version: "1.0",
              callAgentFunction: {
                surfaceId: surface.surfaceId,
                functionCallId: "verify_" + Date.now(),
                callFunction: {
                  "@call": "verifyOkfSources",
                  catalogId: "https://a2ui.org/specification/v1_0/catalogs/icm-okf-v0.3/catalog.json",
                  args: payloadObj,
                },
              },
            };
            actionLog.unshift(rpcCallObj);
            const url =
              "http://127.0.0.1:44820/ping-pong?payload=" + encodeURIComponent(jsonStr);
            if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(currentPrompts.agyText).catch(function () {});
            }
            pingPongBtn.textContent = tClient(surface, "sendingToAgyBtn");

            let settled = false;
            function markDelivered() {
              if (settled) return;
              settled = true;
              pingPongBtn.textContent = tClient(surface, "sentToAgyBtn");
            }
            function markClipboardFallback() {
              if (settled) return;
              settled = true;
              pingPongBtn.textContent = tClient(surface, "copiedPasteInChatBtn");
            }

            const fetchOpts = {
              method: "POST",
              mode: "cors",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify(rpcCallObj),
            };
            let abortTimer = null;
            if (typeof AbortController !== "undefined") {
              const ctrl = new AbortController();
              fetchOpts.signal = ctrl.signal;
              abortTimer = setTimeout(function () {
                try {
                  ctrl.abort();
                } catch (_e) {}
              }, 1200);
            }

            fetch(url, fetchOpts)
              .then(function (res) {
                if (abortTimer) clearTimeout(abortTimer);
                if (res && res.ok) {
                  markDelivered();
                } else {
                  throw new Error("Non-OK Ping-Pong status");
                }
              })
              .catch(function () {
                if (abortTimer) clearTimeout(abortTimer);
                try {
                  const img = new Image();
                  const beaconTimer = setTimeout(function () {
                    markClipboardFallback();
                  }, 900);
                  img.onload = function () {
                    clearTimeout(beaconTimer);
                    markDelivered();
                  };
                  img.onerror = function () {
                    clearTimeout(beaconTimer);
                    markClipboardFallback();
                  };
                  img.src = url + "&format=gif";
                } catch (_e) {
                  markClipboardFallback();
                }
              });
          });
          bannerRight.appendChild(pingPongBtn);
        }

        const copyAgyLabel = tClient(surface, "copyReplyForAgyBtn");
        const copyAgyBtn = document.createElement("button");
        copyAgyBtn.className = canPingPong ? "a2ui-btn" : "a2ui-btn primary";
        copyAgyBtn.id = "okf-copy-agy-btn";
        copyAgyBtn.textContent = copyAgyLabel;
        bindCopyBtn(
          copyAgyBtn,
          function () {
            return String(resolvePointer(surface.dataModel, "/okf/curationAgyText") || curationPrompts.agyText);
          },
          copyAgyLabel
        );

        const copyCliLabel = tClient(surface, "copyCliCommandBtn");
        const copyCliBtn = document.createElement("button");
        copyCliBtn.className = "a2ui-btn";
        copyCliBtn.id = "okf-copy-cli-btn";
        copyCliBtn.textContent = copyCliLabel;
        bindCopyBtn(
          copyCliBtn,
          function () {
            return String(resolvePointer(surface.dataModel, "/okf/curationCliText") || curationPrompts.cliText);
          },
          copyCliLabel
        );

        bannerRight.appendChild(copyAgyBtn);
        bannerRight.appendChild(copyCliBtn);
        bannerTop.appendChild(bannerLeft);
        bannerTop.appendChild(bannerRight);
        curationBanner.appendChild(bannerTop);

        const agyBox = document.createElement("div");
        agyBox.className = "okf-curation-prompt-box";
        agyBox.id = "okf-curation-agy-text";
        agyBox.textContent = curationPrompts.agyText;
        curationBanner.appendChild(agyBox);

        const cliBox = document.createElement("div");
        cliBox.className = "okf-curation-prompt-box";
        cliBox.id = "okf-curation-cli-text";
        cliBox.style.opacity = "0.9";
        cliBox.textContent = curationPrompts.cliText;
        curationBanner.appendChild(cliBox);

        outerWrap.appendChild(curationBanner);
      }

      const mainCard = document.createElement("div");
      mainCard.className = "a2ui-card a2ui-col";
      const toolbar = document.createElement("div");
      toolbar.className = "a2ui-row justify-between";
      const leftHead = document.createElement("div");
      leftHead.className = "a2ui-row";
      const tTitle = document.createElement("h3");
      tTitle.className = "a2ui-h3";
      tTitle.textContent = String(
        resolveDynamic(comp.title, surface, scopeData) ||
          tClient(surface, "stage1KnowledgeBaseTitle")
      );
      const trustBadge = document.createElement("span");
      trustBadge.className = "a2ui-badge " + (trustTier === "human-reviewed" ? "accent" : "primary");
      trustBadge.textContent = "trust: " + trustTier;
      const freshBadge = document.createElement("span");
      freshBadge.className = "a2ui-badge " + (isStale ? "danger" : "success");
      freshBadge.textContent = isStale ? "stale" : "fresh";
      leftHead.appendChild(tTitle);
      leftHead.appendChild(trustBadge);
      leftHead.appendChild(freshBadge);

      const rightActions = document.createElement("div");
      rightActions.className = "a2ui-row";
      if (viewingStub) {
        const activeCid = String(resolvePointer(surface.dataModel, "/okf/activeConceptId") || "");
        const cMeta = bundleGraph.conceptMeta && bundleGraph.conceptMeta[activeCid];
        const currentRunId = String(resolvePointer(surface.dataModel, "/meta/runId") || "");
        if (cMeta && cMeta.runId && cMeta.runId !== currentRunId && bundleRuns.some((r) => r.runId === cMeta.runId)) {
          const switchRunBtn = document.createElement("button");
          switchRunBtn.className = "a2ui-btn success";
          switchRunBtn.id = "okf-md-switch-run-btn";
          switchRunBtn.textContent = tClient(surface, "switchToRunWithId", { id: cMeta.runId });
          switchRunBtn.addEventListener("click", () => {
            switchActiveRun(surface, cMeta.runId);
          });
          rightActions.appendChild(switchRunBtn);
        }
        const backPrimaryBtn = document.createElement("button");
        backPrimaryBtn.className = "a2ui-btn primary";
        backPrimaryBtn.id = "okf-md-back-primary-btn";
        backPrimaryBtn.textContent = tClient(surface, "backToPrimaryConcept");
        backPrimaryBtn.addEventListener("click", () => {
          const primaryCid =
            resolvePointer(surface.dataModel, "/okf/primaryConceptId") ||
            "research/current";
          navigateOkfMarkdownConcept(surface, primaryCid);
          renderSurface();
        });
        rightActions.appendChild(backPrimaryBtn);
      }

      const editBtn = document.createElement("button");
      editBtn.className = "a2ui-btn";
      editBtn.textContent = tClient(
        surface,
        isEditing ? "previewOkfMarkdownBtn" : "editOkfMarkdownBtn"
      );
      editBtn.addEventListener("click", () => {
        if (isEditing) {
          syncOkfBodyToChecklist(surface);
        }
        setPointer(surface.dataModel, editModePath, !isEditing);
        renderSurface();
      });
      rightActions.appendChild(editBtn);
      toolbar.appendChild(leftHead);
      toolbar.appendChild(rightActions);
      mainCard.appendChild(toolbar);

      if (isEditing) {
        const editor = renderComponent(surface, {
          id: comp.id + "_editor",
          component: "TextField",
          variant: "longText",
          label: tClient(surface, "editableMarkdownLabel"),
          value: comp.body,
        });
        const ta = editor.querySelector("textarea");
        if (ta) {
          ta.rows = 22;
          ta.addEventListener("input", () => {
            syncOkfBodyToChecklist(surface);
          });
        }
        mainCard.appendChild(editor);
      } else {
        const mdBody = document.createElement("div");
        mdBody.className = "okf-md-body";
        mdBody.innerHTML = renderMarkdownBlock(bodyMd, sources, rejectedSources);
        // Wire internal /research/*.md concept links & [^id] footnote scroll/highlight
        mdBody.querySelectorAll("a[href]").forEach((a) => {
          const href = a.getAttribute("href") || "";
          const fnId = a.getAttribute("data-fn");
          if (fnId) {
            a.addEventListener("click", (e) => {
              e.preventDefault();
              const targetEl = document.getElementById("okf-src-" + fnId);
              if (targetEl) {
                targetEl.hidden = false;
                document.querySelectorAll(".okf-source-card").forEach((el) => el.classList.remove("highlight"));
                targetEl.classList.add("highlight");
                targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }
            });
            return;
          }
          const activeCid =
            resolvePointer(surface.dataModel, "/okf/activeConceptId") ||
            resolvePointer(surface.dataModel, "/okf/primaryConceptId") ||
            "research/current";
          const conceptId = resolveClientConceptId(href, activeCid);
          if (conceptId) {
            a.style.color = "var(--accent)";
            a.style.fontWeight = "600";
            a.addEventListener("click", (e) => {
              e.preventDefault();
              navigateOkfMarkdownConcept(surface, conceptId, (a.textContent || conceptId).trim());
              renderSurface();
            });
          }
        });
        mainCard.appendChild(mdBody);
      }

      const sideCard = document.createElement("div");
      sideCard.className = "a2ui-card a2ui-col";
      sideCard.id = "okf-sources-panel";
      const sHead = document.createElement("h3");
      sHead.className = "a2ui-h3";
      const countDisplay =
        rejectedSources.length > 0
          ? activeSourceCount + " / " + sources.length
          : String(sources.length);
      sHead.textContent = tClient(surface, "sourcesAndProvenanceHeading", { count: countDisplay });
      sideCard.appendChild(sHead);

      const stage1Trace = resolvePointer(surface.dataModel, "/okf/stage1Trace") || null;
      const searchQueries =
        stage1Trace && Array.isArray(stage1Trace.searchQueries)
          ? stage1Trace.searchQueries
          : [];
      if (searchQueries.length > 0 && !viewingStub) {
        const searchDetails = document.createElement("details");
        searchDetails.className = "okf-search-log-details";
        const searchSummary = document.createElement("summary");
        searchSummary.textContent = tClient(surface, "stage1SearchQueriesSummary", {
          count: searchQueries.length,
        });
        searchDetails.appendChild(searchSummary);
        const qList = document.createElement("ol");
        qList.style.margin = "8px 0 0 18px";
        qList.style.padding = "0";
        searchQueries.forEach(function (q) {
          const li = document.createElement("li");
          li.style.marginBottom = "3px";
          li.textContent = String(q);
          qList.appendChild(li);
        });
        searchDetails.appendChild(qList);
        sideCard.appendChild(searchDetails);
      }

      if (!viewingStub) {
        const addBox = document.createElement("div");
        addBox.className = "okf-add-source-box";
        const addLabel = document.createElement("div");
        addLabel.style.fontWeight = "600";
        addLabel.style.fontSize = "12px";
        addLabel.textContent = tClient(surface, "addMissingSourceLabel");
        const urlInput = document.createElement("input");
        urlInput.type = "url";
        urlInput.id = "okf-add-source-url";
        urlInput.placeholder = "https://...";
        const titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.id = "okf-add-source-title";
        titleInput.placeholder = tClient(surface, "optionalSourceTitlePlaceholder");
        const addBtn = document.createElement("button");
        addBtn.className = "a2ui-btn primary";
        addBtn.id = "okf-add-source-btn";
        addBtn.textContent = tClient(surface, "addSourceBtn");
        addBtn.addEventListener("click", function () {
          const u = (urlInput.value || "").trim();
          const t = (titleInput.value || "").trim();
          if (!u) return;
          addSourceInStudio(surface, u, t);
          urlInput.value = "";
          titleInput.value = "";
        });
        addBox.appendChild(addLabel);
        addBox.appendChild(urlInput);
        addBox.appendChild(titleInput);
        addBox.appendChild(addBtn);
        sideCard.appendChild(addBox);
      }

      const srcList = document.createElement("div");
      const statsMap = {};
      const preparedSources = sources.map((src) => {
        const rawId = String(src.id || "src");
        const isRej = rejectedSet.has(rawId);
        const rawReplacedTarget = String(replacedSources[rawId] || "").trim();
        const replacedTarget =
          rawReplacedTarget && rawReplacedTarget !== rawId && !rejectedSet.has(rawReplacedTarget)
            ? rawReplacedTarget
            : "";
        const citeStats = inspectSourceCitationsInBody(bodyMd, rawId, rejectedSources);
        statsMap[rawId] = citeStats;
        const prov = inspectClientSourceDomainProvenance(src);
        const mimeInfo = inferClientSourceMimeInfo(src);
        const attention = inspectClientSourceAttentionSignals(src, prov);
        return {
          src: src,
          rawId: rawId,
          isRej: isRej,
          replacedTarget: replacedTarget,
          citeStats: citeStats,
          prov: prov,
          mimeInfo: mimeInfo,
          attention: attention,
          isReviewCandidate: Boolean(attention.needsAttention || isRej || replacedTarget),
        };
      });

      let pdfCount = 0;
      let htmlCount = 0;
      let dataDocCount = 0;
      let reviewCount = 0;
      preparedSources.forEach((entry) => {
        if (entry.mimeInfo.group === "pdf") pdfCount++;
        else if (entry.mimeInfo.group === "html") htmlCount++;
        else if (entry.mimeInfo.group === "data" || entry.mimeInfo.group === "doc") dataDocCount++;
        if (entry.isReviewCandidate) reviewCount++;
      });

      let activeFilterMode = String(resolvePointer(surface.dataModel, "/okf/sourceFilterMode") || "all");
      if (
        (activeFilterMode === "data" && dataDocCount === 0) ||
        (activeFilterMode === "review" && reviewCount === 0)
      ) {
        activeFilterMode = "all";
      }
      let activeSearchQuery = String(resolvePointer(surface.dataModel, "/okf/sourceSearchQuery") || "");

      let filterStatusTextEl = null;
      let resetFilterBtnEl = null;
      let searchInputEl = null;
      const pillButtonsByMode = {};
      const pillBaseClassByMode = {};
      const sourceCardEls = [];

      function applySourceFiltersInPlace() {
        const qNorm = activeSearchQuery.trim().toLowerCase();
        let visibleCount = 0;
        sourceCardEls.forEach((cardEl) => {
          const mimeGroup = cardEl.getAttribute("data-mime-group") || "other";
          const isReview = cardEl.getAttribute("data-needs-review") === "1";
          const haystack = cardEl.getAttribute("data-search-haystack") || "";
          let modeMatches = true;
          if (activeFilterMode === "pdf") modeMatches = mimeGroup === "pdf";
          else if (activeFilterMode === "html") modeMatches = mimeGroup === "html";
          else if (activeFilterMode === "data") modeMatches = mimeGroup === "data" || mimeGroup === "doc";
          else if (activeFilterMode === "review") modeMatches = isReview;
          const queryMatches = !qNorm || haystack.indexOf(qNorm) !== -1;
          const show = modeMatches && queryMatches;
          cardEl.hidden = !show;
          if (show) visibleCount++;
        });
        Object.keys(pillButtonsByMode).forEach((m) => {
          const btn = pillButtonsByMode[m];
          if (btn) {
            const baseCls = pillBaseClassByMode[m] || "okf-filter-pill";
            btn.className = m === activeFilterMode ? baseCls + " active" : baseCls;
          }
        });
        const isFiltered = activeFilterMode !== "all" || Boolean(qNorm);
        if (filterStatusTextEl) {
          filterStatusTextEl.textContent = isFiltered
            ? tClient(surface, "showingSourcesCount", {
                visible: visibleCount,
                total: sources.length,
              })
            : "";
        }
        if (resetFilterBtnEl) {
          resetFilterBtnEl.hidden = !isFiltered;
        }
      }

      if (sources.length > 0) {
        const filterBar = document.createElement("div");
        filterBar.className = "okf-source-filter-bar";
        const pillRow = document.createElement("div");
        pillRow.className = "okf-filter-pills";

        const pillSpecs = [
          { mode: "all", label: tClient(surface, "filterAllPill", { count: sources.length }), cls: "" },
          { mode: "pdf", label: "📄 PDF (" + pdfCount + ")", cls: "" },
          { mode: "html", label: "🌐 HTML (" + htmlCount + ")", cls: "" },
        ];
        if (dataDocCount > 0) {
          pillSpecs.push({ mode: "data", label: "🗂️ XML/JSON (" + dataDocCount + ")", cls: "" });
        }
        if (reviewCount > 0) {
          pillSpecs.push({
            mode: "review",
            label: tClient(surface, "filterReviewPill", { count: reviewCount }),
            cls: "review-pill",
          });
        }

        pillSpecs.forEach((spec) => {
          const pBtn = document.createElement("button");
          pBtn.type = "button";
          const baseCls = "okf-filter-pill" + (spec.cls ? " " + spec.cls : "");
          pillBaseClassByMode[spec.mode] = baseCls;
          pBtn.className = baseCls + (activeFilterMode === spec.mode ? " active" : "");
          pBtn.setAttribute("data-filter-mode", spec.mode);
          pBtn.textContent = spec.label;
          pBtn.addEventListener("click", () => {
            activeFilterMode =
              activeFilterMode === spec.mode && spec.mode !== "all" ? "all" : spec.mode;
            setPointer(surface.dataModel, "/okf/sourceFilterMode", activeFilterMode);
            applySourceFiltersInPlace();
          });
          pillButtonsByMode[spec.mode] = pBtn;
          pillRow.appendChild(pBtn);
        });

        const searchRow = document.createElement("div");
        searchRow.className = "okf-source-search-row";
        searchInputEl = document.createElement("input");
        searchInputEl.type = "search";
        searchInputEl.className = "okf-source-search-input";
        searchInputEl.id = "okf-source-filter-input";
        searchInputEl.value = activeSearchQuery;
        searchInputEl.placeholder = tClient(surface, "filterSourcesPlaceholder");
        searchInputEl.addEventListener("input", () => {
          activeSearchQuery = searchInputEl.value || "";
          setPointer(surface.dataModel, "/okf/sourceSearchQuery", activeSearchQuery);
          applySourceFiltersInPlace();
        });
        searchRow.appendChild(searchInputEl);

        const statusRow = document.createElement("div");
        statusRow.className = "okf-source-filter-status";
        filterStatusTextEl = document.createElement("span");
        resetFilterBtnEl = document.createElement("button");
        resetFilterBtnEl.type = "button";
        resetFilterBtnEl.className = "a2ui-btn";
        resetFilterBtnEl.style.fontSize = "10.5px";
        resetFilterBtnEl.style.padding = "2px 7px";
        resetFilterBtnEl.hidden = true;
        resetFilterBtnEl.textContent = tClient(surface, "resetFilterBtn");
        resetFilterBtnEl.addEventListener("click", () => {
          activeFilterMode = "all";
          activeSearchQuery = "";
          if (searchInputEl) searchInputEl.value = "";
          setPointer(surface.dataModel, "/okf/sourceFilterMode", "all");
          setPointer(surface.dataModel, "/okf/sourceSearchQuery", "");
          applySourceFiltersInPlace();
        });
        statusRow.appendChild(filterStatusTextEl);
        statusRow.appendChild(resetFilterBtnEl);

        filterBar.appendChild(pillRow);
        filterBar.appendChild(searchRow);
        filterBar.appendChild(statusRow);
        sideCard.appendChild(filterBar);
      }

      preparedSources.forEach((entry) => {
        const src = entry.src;
        const sc = document.createElement("div");
        const rawId = entry.rawId;
        const isRej = entry.isRej;
        const replacedTarget = entry.replacedTarget;
        const isReplaceOpen = Boolean(replaceOpenSources[rawId]);
        sc.className =
          "okf-source-card" + (isRej ? " rejected" : replacedTarget ? " replaced" : "");
        const safeId = escapeHtml(rawId);
        const rawUrl = src.url || src.resource || "";
        const safeTitle = escapeHtml(src.title || rawUrl || "");
        const safeUrl = rawUrl ? escapeHtml(rawUrl) : "";
        const shortUrl = rawUrl ? escapeHtml(formatClientUrlMiddleEllipsis(rawUrl, 78)) : "";
        const citeStats = entry.citeStats;
        const prov = entry.prov;
        const mimeInfo = entry.mimeInfo;
        const attention = entry.attention;

        sc.setAttribute("data-mime-group", mimeInfo.group || "other");
        sc.setAttribute("data-needs-review", entry.isReviewCandidate ? "1" : "0");
        sc.setAttribute(
          "data-search-haystack",
          [
            rawId,
            src.title || "",
            rawUrl,
            prov.hostname || "",
            mimeInfo.mimeType || "",
            mimeInfo.shortLabel || "",
            attention.isHistoricalOrArchiveUrl
              ? "archive " + tClient(surface, "historicalArchiveBadge")
              : "",
            attention.domainMismatch ? "mismatch " + tClient(surface, "domainMismatchPrefix") : "",
          ]
            .join(" ")
            .toLowerCase()
        );

        sc.id = "okf-src-" + rawId;
        const headerHtml =
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
          '<div><strong>[^' +
          safeId +
          "]</strong> " +
          (safeUrl
            ? '<a class="okf-src-title" href="' +
              safeUrl +
              '" target="_blank" rel="noopener noreferrer" style="color:var(--primary);font-weight:600;text-decoration:none">' +
              safeTitle +
              " ↗</a>"
            : '<span class="okf-src-title">' + safeTitle + "</span>") +
          (isRej
            ? ' <span class="src-chip rejected-badge">' +
              escapeHtml(tClient(surface, "rejectedBadge")) +
              "</span>"
            : "") +
          (replacedTarget
            ? ' <span class="src-chip replaced-badge">🔀 → ' + escapeHtml(replacedTarget) + "</span>"
            : "") +
          (src.addedByHuman
            ? ' <span class="src-chip added-badge">' +
              escapeHtml(tClient(surface, "addedBadge")) +
              "</span>"
            : "") +
          "</div>" +
          "</div>" +
          (safeUrl
            ? '<div style="margin-top:2px;font-size:11px;word-break:break-all"><a href="' +
              safeUrl +
              '" title="' +
              safeUrl +
              '" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted)">' +
              shortUrl +
              "</a></div>"
            : "") +
          "<div>" +
          (mimeInfo.badgeLabel
            ? '<span class="src-chip mime-badge ' +
              escapeHtml(mimeInfo.cssClass) +
              '" title="MIME: ' +
              escapeHtml(mimeInfo.mimeType) +
              '">' +
              escapeHtml(mimeInfo.badgeLabel) +
              "</span>"
            : "") +
          (prov.hostname
            ? '<span class="src-chip domain-host">🌐 ' +
              escapeHtml(prov.hostname) +
              "</span>"
            : "") +
          (attention.isHistoricalOrArchiveUrl
            ? '<span class="src-chip archive-hint" title="' +
              escapeHtml(rawUrl) +
              '">🕰️ ' +
              escapeHtml(tClient(surface, "historicalArchiveBadge")) +
              "</span>"
            : "") +
          (prov.domainMismatch && prov.hostname && prov.claimedPublisher
            ? '<span class="src-chip domain-mismatch">⚠️ ' +
              escapeHtml(tClient(surface, "domainMismatchPrefix")) +
              escapeHtml(prov.hostname) +
              ' ≠ "' +
              escapeHtml(prov.claimedPublisher) +
              '"</span>'
            : "") +
          (src.retrieved_at
            ? '<span class="src-chip retrieved">retrieved: ' + escapeHtml(src.retrieved_at) + "</span>"
            : "") +
          (src.last_modified
            ? '<span class="src-chip modified">modified: ' + escapeHtml(src.last_modified) + "</span>"
            : "") +
          '<span class="src-chip citations">🔗 ' +
          citeStats.mentionCount +
          " " +
          escapeHtml(tClient(surface, "citationsWord")) +
          "</span>" +
          (citeStats.soleClaimLines.length > 0 && !replacedTarget
            ? '<span class="src-chip sole-warning">⚠️ ' +
              escapeHtml(
                tClient(surface, "soleSourceWarning", { count: citeStats.soleClaimLines.length })
              ) +
              "</span>"
            : "") +
          "</div>";
        sc.innerHTML = headerHtml;

        if (!viewingStub || rawUrl) {
          const actionRow = document.createElement("div");
          actionRow.style.marginTop = "6px";
          actionRow.style.display = "flex";
          actionRow.style.justifyContent = "flex-end";
          actionRow.style.gap = "6px";
          actionRow.style.flexWrap = "wrap";

          if (rawUrl) {
            const copyUrlLabel = tClient(surface, "copyUrlBtn");
            const copyUrlBtn = document.createElement("button");
            copyUrlBtn.type = "button";
            copyUrlBtn.className = "a2ui-btn okf-copy-url-btn";
            copyUrlBtn.setAttribute("data-src-id", rawId);
            copyUrlBtn.setAttribute("data-src-url", rawUrl);
            copyUrlBtn.title = rawUrl;
            copyUrlBtn.style.padding = "3px 8px";
            copyUrlBtn.style.fontSize = "11.5px";
            copyUrlBtn.textContent = copyUrlLabel;
            bindCopyBtn(
              copyUrlBtn,
              function () {
                return rawUrl;
              },
              copyUrlLabel
            );
            actionRow.appendChild(copyUrlBtn);
          }

          if (!viewingStub) {
            if (!isRej && citeStats.mentionCount > 0) {
              const swapBtn = document.createElement("button");
              swapBtn.type = "button";
              swapBtn.className = "a2ui-btn okf-open-replace-btn";
              swapBtn.setAttribute("data-src-id", rawId);
              swapBtn.style.padding = "3px 8px";
              swapBtn.style.fontSize = "11.5px";
              swapBtn.textContent = tClient(
                surface,
                replacedTarget
                  ? "undoReplaceBtn"
                  : isReplaceOpen
                    ? "closeReplaceBtn"
                    : "replaceSourceBtn"
              );
              swapBtn.addEventListener("click", function () {
                toggleReplacePanelInStudio(surface, rawId);
              });
              actionRow.appendChild(swapBtn);
            }

            const rejBtn = document.createElement("button");
            rejBtn.type = "button";
            rejBtn.className = "a2ui-btn okf-reject-btn" + (isRej ? "" : " danger");
            rejBtn.setAttribute("data-src-id", rawId);
            rejBtn.style.padding = "3px 8px";
            rejBtn.style.fontSize = "11.5px";
            rejBtn.textContent = tClient(surface, isRej ? "undoRejectBtn" : "rejectSourceBtn");
            rejBtn.addEventListener("click", function () {
              toggleRejectSourceInStudio(surface, rawId);
            });
            actionRow.appendChild(rejBtn);
          }
          sc.appendChild(actionRow);

          if (!viewingStub && (isRej || isReplaceOpen || Boolean(replacedTarget)) && citeStats.mentionCount > 0) {
            const replRow = document.createElement("div");
            replRow.className = "okf-replace-row" + (isRej ? "" : " swap-mode");
            const selectWrap = document.createElement("div");
            selectWrap.className = "okf-replace-select-wrap";
            const replLbl = document.createElement("label");
            replLbl.style.fontWeight = "600";
            replLbl.textContent = tClient(surface, "replaceCitationsWithLabel", {
              count: citeStats.mentionCount,
            });
            selectWrap.appendChild(replLbl);

            let matchedDropdownOption = false;
            if (activeSourcesList.length > 0 || replacedTarget) {
              const replSelect = document.createElement("select");
              replSelect.className = "okf-replace-select";
              replSelect.setAttribute("data-src-id", rawId);
              const defaultOpt = document.createElement("option");
              defaultOpt.value = "";
              defaultOpt.textContent = tClient(
                surface,
                isRej ? "letAgyChooseOption" : "selectOrPasteSourceOption"
              );
              replSelect.appendChild(defaultOpt);
              activeSourcesList.forEach(function (actSrc) {
                const actId = String(actSrc.id || "");
                const actUrl = String(actSrc.url || actSrc.resource || "");
                const optVal = actSrc.addedByHuman && actUrl ? actUrl : actId;
                if (!optVal || actId === rawId) return;
                if (replacedSources[actId] && actId !== replacedTarget && optVal !== replacedTarget) {
                  return;
                }
                const opt = document.createElement("option");
                opt.value = optVal;
                const shortT = String(actSrc.title || actUrl || actId);
                opt.textContent =
                  (actSrc.addedByHuman ? "➕ " : "") +
                  "[^" +
                  actId +
                  "] " +
                  (shortT.length > 52 ? shortT.slice(0, 52) + "…" : shortT);
                if (replacedTarget === optVal || replacedTarget === actId) {
                  opt.selected = true;
                  matchedDropdownOption = true;
                }
                replSelect.appendChild(opt);
              });
              if (replacedTarget && !matchedDropdownOption) {
                const customUrlOpt = document.createElement("option");
                customUrlOpt.value = replacedTarget;
                customUrlOpt.textContent =
                  "🌐 " +
                  (replacedTarget.length > 58
                    ? replacedTarget.slice(0, 58) + "…"
                    : replacedTarget);
                customUrlOpt.selected = true;
                replSelect.appendChild(customUrlOpt);
              }
              replSelect.addEventListener("change", function () {
                setReplaceSourceInStudio(surface, rawId, replSelect.value);
              });
              selectWrap.appendChild(replSelect);
            }
            replRow.appendChild(selectWrap);

            const urlWrap = document.createElement("div");
            urlWrap.className = "okf-replace-url-wrap";
            const urlInput = document.createElement("input");
            urlInput.type = "url";
            urlInput.className = "okf-replace-url-input";
            urlInput.setAttribute("data-src-id", rawId);
            urlInput.placeholder = tClient(surface, "pasteCanonicalUrlPlaceholder");
            if (replacedTarget && !matchedDropdownOption && /^https?:\/\//i.test(replacedTarget)) {
              urlInput.value = replacedTarget;
            }
            const urlBtn = document.createElement("button");
            urlBtn.type = "button";
            urlBtn.className = "a2ui-btn okf-replace-url-btn";
            urlBtn.textContent = tClient(surface, "useUrlBtn");
            urlBtn.addEventListener("click", function () {
              setReplaceSourceInStudio(surface, rawId, urlInput.value);
            });
            urlInput.addEventListener("keydown", function (ev) {
              if (ev && ev.key === "Enter") {
                ev.preventDefault();
                setReplaceSourceInStudio(surface, rawId, urlInput.value);
              }
            });
            urlWrap.appendChild(urlInput);
            urlWrap.appendChild(urlBtn);
            replRow.appendChild(urlWrap);
            sc.appendChild(replRow);
          }
        }

        if (citeStats.soleClaimLines.length > 0) {
          const soleDetails = document.createElement("details");
          soleDetails.className = "okf-sole-claims-details";
          const soleSummary = document.createElement("summary");
          soleSummary.textContent = tClient(surface, "showSoleClaimsSummary", {
            count: citeStats.soleClaimLines.length,
            id: rawId,
          });
          soleDetails.appendChild(soleSummary);
          const soleUl = document.createElement("ul");
          soleUl.style.margin = "5px 0 0 16px";
          soleUl.style.padding = "0";
          citeStats.soleClaimLines.forEach(function (cl) {
            const li = document.createElement("li");
            li.style.marginBottom = "3px";
            li.textContent = cl;
            soleUl.appendChild(li);
          });
          soleDetails.appendChild(soleUl);
          sc.appendChild(soleDetails);
        }

        sourceCardEls.push(sc);
        srcList.appendChild(sc);
      });
      setPointer(surface.dataModel, "/okf/sourceCitationStats", statsMap);
      applySourceFiltersInPlace();
      sideCard.appendChild(srcList);

      wrap.appendChild(mainCard);
      wrap.appendChild(sideCard);
      outerWrap.appendChild(wrap);
      return outerWrap;
    }

    if (type === "OkfKnowledgeGraph") {
      const backToConceptLabel = escapeHtml(tClient(surface, "backToConcept"));
      const wrap = document.createElement("div");
      wrap.className = "a2ui-col";
      const split = document.createElement("div");
      split.className = "okf-graph-split";
      const canvas = document.createElement("div");
      canvas.className = "okf-graph-canvas";
      const detail = document.createElement("div");
      detail.className = "okf-graph-detail";
      detail.id = "okf-graph-detail-view";
      detail.innerHTML =
        '<div class="a2ui-caption">' +
        escapeHtml(tClient(surface, "graphClickHint")) +
        "</div>";
      split.appendChild(canvas);
      split.appendChild(detail);
      wrap.appendChild(split);

      let cy = null;
      let lastConceptData = null;
      let currentSelectedNodeId = null;

      function renderGraphNodeDetail(d) {
        if (!d) return;
        currentSelectedNodeId = d.id || null;
        const rawBody = (bundleGraph.bodies && bundleGraph.bodies[d.id]) || "";
        const nodeSources = Array.isArray(d.sources) ? d.sources : [];
        const formattedBody = formatInlineLatexAndFootnotes(rawBody, nodeSources);
        const isSource = d.group === "source";
        const isSubNode = isSource || d.type === "Linked Concept";
        if (!isSubNode) {
          lastConceptData = d;
        }
        const displayTitle = d.fullTitle || d.label || d.id;

        let headerHtml = "";
        if (isSource) {
          headerHtml =
            '<div class="a2ui-row justify-between" style="margin-bottom:6px">' +
            '<div class="a2ui-row" style="gap:6px">' +
            '<span class="a2ui-badge success">' +
            escapeHtml(d.type || "Verified Source") +
            "</span>" +
            (d.trust_tier
              ? '<span class="a2ui-badge ' +
                (d.trust_tier === "human-reviewed" ? "accent" : "primary") +
                '">trust: ' +
                escapeHtml(d.trust_tier) +
                "</span>"
              : "") +
            "</div>" +
            '<button type="button" class="a2ui-btn" id="okf-graph-back-btn" style="padding:4px 10px;font-size:12px">' +
            backToConceptLabel +
            "</button>" +
            "</div>" +
            '<h3 class="a2ui-h3" style="margin-top:6px">' +
            escapeHtml(displayTitle) +
            "</h3>" +
            (d.description
              ? /^https?:\/\//i.test(d.description)
                ? '<p class="a2ui-caption" style="margin-top:4px;word-break:break-all"><a href="' +
                  escapeHtml(d.description) +
                  '" target="_blank" rel="noopener noreferrer" style="color:var(--primary);font-weight:600">' +
                  escapeHtml(d.description) +
                  " ↗</a></p>"
                : '<p class="a2ui-caption" style="margin-top:4px;word-break:break-all">' +
                  escapeHtml(d.description) +
                  "</p>"
              : "");
        } else {
          const badgesHtml =
            '<div class="a2ui-row" style="gap:6px">' +
            '<span class="a2ui-badge primary">' +
            escapeHtml(d.type || "Concept") +
            "</span>" +
            '<span class="a2ui-badge ' +
            (d.status === "stable" ? "success" : "warn") +
            '">status: ' +
            escapeHtml(d.status || "draft") +
            "</span>" +
            '<span class="a2ui-badge ' +
            (d.trust_tier === "human-reviewed" ? "accent" : "primary") +
            '">trust: ' +
            escapeHtml(d.trust_tier || "unverified") +
            "</span>" +
            '<span class="a2ui-badge ' +
            (d.stale ? "danger" : "success") +
            '">' +
            (d.stale ? "STALE" : "fresh") +
            "</span>" +
            "</div>";
          const activeRunId = resolvePointer(surface.dataModel, "/meta/runId");
          const canSwitchRun = Boolean(d.runId && d.runId !== activeRunId && bundleRuns.length > 1);
          headerHtml =
            (isSubNode
              ? '<div class="a2ui-row justify-between" style="margin-bottom:6px">' +
                badgesHtml +
                '<button type="button" class="a2ui-btn" id="okf-graph-back-btn" style="padding:4px 10px;font-size:12px">' +
                backToConceptLabel +
                "</button>" +
                "</div>"
              : '<div class="a2ui-row justify-between" style="margin-bottom:6px;flex-wrap:wrap;gap:6px">' +
                badgesHtml +
                (canSwitchRun
                  ? '<button type="button" class="a2ui-btn primary" id="okf-graph-switch-run-btn" style="padding:4px 10px;font-size:12px">' +
                    escapeHtml(tClient(surface, "switchToRun")) +
                    "</button>"
                  : "") +
                "</div>") +
            '<h3 class="a2ui-h3" style="margin-top:8px">' +
            escapeHtml(displayTitle) +
            "</h3>" +
            '<p class="a2ui-caption" style="margin-top:4px">' +
            escapeHtml(d.description || "") +
            "</p>";
        }

        let footerHtml = "";
        if (!isSource) {
          const backlinks = Array.isArray(d.backlinks) ? d.backlinks : [];
          if (nodeSources.length > 0 || backlinks.length > 0) {
            footerHtml += "<hr class='a2ui-divider'>";
            if (nodeSources.length > 0) {
              footerHtml +=
                '<div style="margin-bottom:10px"><strong style="font-size:12px;color:var(--text-muted)">' +
                escapeHtml(tClient(surface, "sourcesCountHeading", { count: nodeSources.length })) +
                "</strong><div style='margin-top:6px;display:flex;flex-direction:column;gap:4px'>";
              nodeSources.forEach((s) => {
                const sid = escapeHtml(s.id || "src");
                const stitle = escapeHtml(s.title || s.resource || s.url || sid);
                footerHtml +=
                  '<div style="font-size:12px"><a href="#fn-' +
                  sid +
                  '" data-fn="' +
                  sid +
                  '" style="color:var(--primary);font-weight:600;text-decoration:none">[^' +
                  sid +
                  "] " +
                  stitle +
                  "</a></div>";
              });
              footerHtml += "</div></div>";
            }
            if (backlinks.length > 0) {
              footerHtml +=
                '<div><strong style="font-size:12px;color:var(--text-muted)">' +
                escapeHtml(tClient(surface, "citedByCountHeading", { count: backlinks.length })) +
                "</strong><div style='margin-top:6px;display:flex;flex-direction:column;gap:4px'>";
              backlinks.forEach((bl) => {
                const bid = escapeHtml(bl.id || "");
                const btitle = escapeHtml(bl.title || bid);
                footerHtml +=
                  '<div style="font-size:12px"><a href="/' +
                  bid +
                  '.md" style="color:var(--accent);font-weight:600;text-decoration:none">← ' +
                  btitle +
                  "</a></div>";
              });
              footerHtml += "</div></div>";
            }
          }
        }

        detail.innerHTML =
          headerHtml +
          "<hr class='a2ui-divider'>" +
          '<div class="okf-md-body">' +
          (window.marked && typeof window.marked.parse === "function"
            ? window.marked.parse(formattedBody)
            : parseBuiltInMarkdown(formattedBody)) +
          "</div>" +
          footerHtml;

        const switchRunBtn = detail.querySelector("#okf-graph-switch-run-btn");
        if (switchRunBtn && d.runId) {
          switchRunBtn.addEventListener("click", () => {
            switchActiveRun(surface, d.runId);
          });
        }

        const backBtn = detail.querySelector("#okf-graph-back-btn");
        if (backBtn) {
          backBtn.addEventListener("click", () => {
            const parentWrapper = d.parentConceptId
              ? (bundleGraph.nodes || []).find((n) => (n.data && n.data.id === d.parentConceptId) || n.id === d.parentConceptId)
              : null;
            const fallbackWrapper = (bundleGraph.nodes || []).find(
              (n) =>
                (n.group === "concept" || (n.data && n.data.group === "concept")) &&
                (!n.data || n.data.type !== "Linked Concept")
            );
            const conceptData =
              lastConceptData ||
              (parentWrapper ? parentWrapper.data || parentWrapper : null) ||
              (fallbackWrapper ? fallbackWrapper.data || fallbackWrapper : null);
            if (conceptData) {
              if (cy) {
                cy.elements().unselect();
                cy.getElementById(conceptData.id).select();
              }
              renderGraphNodeDetail(conceptData);
              detail.scrollTop = 0;
            }
          });
        }

        detail.querySelectorAll("a[href^='http']").forEach((a) => {
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
        });
        detail.querySelectorAll("a[data-fn]").forEach((a) => {
          a.addEventListener("click", (ev) => {
            ev.preventDefault();
            const fnId = a.getAttribute("data-fn");
            const srcNodeId =
              (d.id &&
                bundleGraph.sourceNodeByFnId &&
                bundleGraph.sourceNodeByFnId[d.id] &&
                bundleGraph.sourceNodeByFnId[d.id][fnId]) ||
              (bundleGraph.sourceNodeByAnyFnId && bundleGraph.sourceNodeByAnyFnId[fnId]) ||
              "source:" + fnId;
            const found = (bundleGraph.nodes || []).find((n) => n.data && n.data.id === srcNodeId);
            const targetNode = found ? found.data : null;
            if (targetNode) {
              if (cy) {
                cy.elements().unselect();
                cy.getElementById(targetNode.id).select();
              }
              renderGraphNodeDetail(targetNode);
              detail.scrollTop = 0;
            }
          });
        });
        detail.querySelectorAll("a[href]").forEach((a) => {
          const href = a.getAttribute("href") || "";
          if (a.hasAttribute("data-fn") || href.startsWith("#") || /^https?:\/\//i.test(href)) {
            return;
          }
          const baseConceptForLink =
            d.group === "source" ? d.parentConceptId || "research/current" : d.id;
          const conceptId = resolveClientConceptId(href, baseConceptForLink);
          if (conceptId) {
            a.style.color = "var(--accent)";
            a.style.fontWeight = "600";
            a.addEventListener("click", (ev) => {
              ev.preventDefault();
              const found = (bundleGraph.nodes || []).find((n) => n.data && n.data.id === conceptId);
              const targetNode = found ? found.data : null;
              if (targetNode) {
                if (cy) {
                  cy.elements().unselect();
                  cy.getElementById(targetNode.id).select();
                }
                renderGraphNodeDetail(targetNode);
                detail.scrollTop = 0;
              }
            });
          }
        });
      }

      const nodesList = bundleGraph.nodes || [];
      const activeCidForGraph =
        resolvePointer(surface.dataModel, "/okf/activeConceptId") ||
        resolvePointer(surface.dataModel, "/okf/primaryConceptId");
      const initialNodeWrapper =
        (activeCidForGraph &&
          nodesList.find((n) => n.data && n.data.id === activeCidForGraph)) ||
        nodesList.find((n) => n.group === "concept" || (n.data && n.data.group === "concept")) ||
        nodesList[0];
      if (initialNodeWrapper && initialNodeWrapper.data) {
        renderGraphNodeDetail(initialNodeWrapper.data);
      }

      setTimeout(() => {
        if (!window.cytoscape) {
          const allNodes = bundleGraph.nodes || [];
          const allEdges = bundleGraph.edges || [];
          if (allNodes.length === 0) {
            canvas.innerHTML =
              '<div style="padding:20px" class="a2ui-caption">' +
              escapeHtml(tClient(surface, "noGraphNodesEmpty")) +
              "</div>";
            return;
          }
          const ns = "http://www.w3.org/2000/svg";
          const W = 760;
          const H = 520;
          const svg = document.createElementNS(ns, "svg");
          svg.setAttribute("viewBox", "0 0 " + W + " " + H);
          svg.style.width = "100%";
          svg.style.height = "100%";
          svg.style.display = "block";
          svg.style.userSelect = "none";
          const concepts = allNodes.filter((n) => n && n.data && n.data.group !== "source");
          const sources = allNodes.filter((n) => n && n.data && n.data.group === "source");
          const posById = {};
          concepts.forEach((c, idx) => {
            if (concepts.length === 1) {
              posById[c.data.id] = { x: W / 2, y: H / 2 };
            } else {
              const ang = (2 * Math.PI * idx) / concepts.length - Math.PI / 2;
              posById[c.data.id] = { x: W / 2 + 110 * Math.cos(ang), y: H / 2 + 90 * Math.sin(ang) };
            }
          });
          sources.forEach((s, idx) => {
            const ang = (2 * Math.PI * idx) / Math.max(1, sources.length) - Math.PI / 2;
            posById[s.data.id] = { x: W / 2 + 270 * Math.cos(ang), y: H / 2 + 195 * Math.sin(ang) };
          });
          const edgeGroup = document.createElementNS(ns, "g");
          const nodeGroup = document.createElementNS(ns, "g");
          svg.appendChild(edgeGroup);
          svg.appendChild(nodeGroup);
          allEdges.forEach((e) => {
            if (!e || !e.data) return;
            const sp = posById[e.data.source];
            const tp = posById[e.data.target];
            if (!sp || !tp) return;
            const line = document.createElementNS(ns, "line");
            line.setAttribute("x1", String(sp.x));
            line.setAttribute("y1", String(sp.y));
            line.setAttribute("x2", String(tp.x));
            line.setAttribute("y2", String(tp.y));
            line.setAttribute("stroke", "#94a3b8");
            line.setAttribute("stroke-width", "1.75");
            edgeGroup.appendChild(line);
          });
          const circleById = {};
          allNodes.forEach((n) => {
            if (!n || !n.data) return;
            const d = n.data;
            const p = posById[d.id] || { x: W / 2, y: H / 2 };
            const r = Math.max(11, Math.min(24, Number(d.size || 24) / 2));
            const g = document.createElementNS(ns, "g");
            g.style.cursor = "pointer";
            const circle = document.createElementNS(ns, "circle");
            circle.setAttribute("cx", String(p.x));
            circle.setAttribute("cy", String(p.y));
            circle.setAttribute("r", String(r));
            circle.setAttribute("fill", d.color || "#2563eb");
            circle.setAttribute("stroke", d.id === currentSelectedNodeId ? "#1d4ed8" : "#0f172a");
            circle.setAttribute("stroke-width", d.id === currentSelectedNodeId ? "3.5" : "1.5");
            circleById[d.id] = circle;
            const lbl = document.createElementNS(ns, "text");
            lbl.setAttribute("x", String(p.x));
            lbl.setAttribute("y", String(p.y + r + 13));
            lbl.setAttribute("text-anchor", "middle");
            lbl.setAttribute("font-size", "10.5");
            lbl.setAttribute("fill", "#0f172a");
            const rawLbl = String(d.label || d.id || "");
            lbl.textContent = rawLbl.length > 26 ? rawLbl.slice(0, 25) + "…" : rawLbl;
            g.appendChild(circle);
            g.appendChild(lbl);
            g.addEventListener("click", () => {
              Object.keys(circleById).forEach((k) => {
                circleById[k].setAttribute("stroke", k === d.id ? "#1d4ed8" : "#0f172a");
                circleById[k].setAttribute("stroke-width", k === d.id ? "3.5" : "1.5");
              });
              renderGraphNodeDetail(d);
            });
            nodeGroup.appendChild(g);
          });
          cy = {
            elements: () => ({
              unselect: () => {
                Object.keys(circleById).forEach((k) => {
                  circleById[k].setAttribute("stroke", "#0f172a");
                  circleById[k].setAttribute("stroke-width", "1.5");
                });
              },
            }),
            getElementById: (id) => ({
              select: () => {
                if (circleById[id]) {
                  circleById[id].setAttribute("stroke", "#1d4ed8");
                  circleById[id].setAttribute("stroke-width", "3.5");
                }
              },
            }),
          };
          canvas.innerHTML = "";
          canvas.appendChild(svg);
          return;
        }
        cy = window.cytoscape({
          container: canvas,
          elements: { nodes: bundleGraph.nodes || [], edges: bundleGraph.edges || [] },
          style: [
            {
              selector: "node",
              style: {
                "background-color": "data(color)",
                label: "data(label)",
                width: "data(size)",
                height: "data(size)",
                "font-size": 11,
                color: "#0f172a",
                "text-valign": "bottom",
                "text-margin-y": 5,
                "text-wrap": "wrap",
                "text-max-width": 140,
              },
            },
            {
              selector: "node:selected",
              style: {
                "border-width": 3,
                "border-color": "#1d4ed8",
              },
            },
            {
              selector: "edge",
              style: {
                width: 2,
                "line-color": "#94a3b8",
                "target-arrow-color": "#94a3b8",
                "target-arrow-shape": "triangle",
                "curve-style": "bezier",
              },
            },
          ],
          layout: { name: (bundleGraph.nodes || []).length > 1 ? "cose" : "grid", padding: 40 },
        });
        if (currentSelectedNodeId) {
          cy.getElementById(currentSelectedNodeId).select();
        }
        cy.on("tap", "node", (evt) => {
          renderGraphNodeDetail(evt.target.data());
        });
      }, 30);

      return wrap;
    }

    const fallback = document.createElement("div");
    fallback.className = "a2ui-card";
    fallback.textContent = "[" + type + ": " + comp.id + "]";
    return fallback;
  }

  function renderSurface() {
    const mount = document.getElementById("a2ui-surface-root");
    if (!mount) return;
    const prevScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const surface = surfaces[activeSurfaceId];
    if (!surface || !surface.components["root"]) {
      mount.textContent = "No active A2UI surface found.";
      return;
    }
    const nextTree = renderComponentById(surface, "root", undefined, "");
    mount.replaceChildren(nextTree);
    if (typeof window !== "undefined" && prevScrollY > 0) {
      window.scrollTo(0, prevScrollY);
    }
  }

  // Inspector Modal Wiring
  const modal = document.getElementById("a2ui-inspector-modal");
  const inspectBtn = document.getElementById("a2ui-open-inspector");
  const closeBtn = document.getElementById("a2ui-close-inspector");
  const exportBtn = document.getElementById("a2ui-export-json");

  if (inspectBtn && modal) {
    inspectBtn.addEventListener("click", () => {
      const surface = surfaces[activeSurfaceId];
      const pre = document.getElementById("a2ui-inspector-content");
      if (pre && surface) {
        pre.textContent = JSON.stringify(
          {
            protocolVersion: "1.0",
            surfaceId: surface.surfaceId,
            catalogId: surface.catalogId,
            componentCount: Object.keys(surface.components).length,
            dataModel: surface.dataModel,
            clientActionEvents: actionLog,
            serverToClientMessages: messages,
          },
          function (_k, v) {
            return typeof v === "string" && v.indexOf("data:") === 0 && v.length > 160
              ? v.slice(0, 64) + "... [inline base64, " + v.length + " chars]"
              : v;
          },
          2
        );
      }
      modal.hidden = false;
    });
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.hidden = true;
    });
  }
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const surface = surfaces[activeSurfaceId];
      if (surface) dispatchClientAction(surface, "topbar", "exportSurfaceJson", {});
    });
  }

  renderSurface();
})();
