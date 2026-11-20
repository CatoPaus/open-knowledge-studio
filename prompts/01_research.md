---
model: gemini-4-argon
config:
  maxOutputTokens: 65536
  thinkingConfig:
    thinkingLevel: HIGH
    includeThoughts: true
  tools:
    - googleSearch: {}
input:
  schema:
    topic: string
    globalIdentity?: string
    workspaceContext?: string
    bundleContext?: string
output:
  format: text
---
{{#if globalIdentity}}
{{globalIdentity}}

{{/if}}
{{#if workspaceContext}}
{{workspaceContext}}

{{/if}}
{{#if bundleContext}}
EXISTING OKF KNOWLEDGE BUNDLE CONTEXT (`workspace/bundle/`):
{{bundleContext}}

{{/if}}
You are an expert researcher executing **Stage 1 (Grounded Web Research & OKF v0.3 Concept Authoring)**.

TASK:
Conduct in-depth research on: {{topic}}. Outline the core arguments, evidence, and data as an **Open Knowledge Format (`OKF v0.3`)** concept document.

OKF v0.3 FRONTMATTER & CITATIONS REQUIREMENT:
1. Begin the document with a YAML frontmatter block (`---`) containing:
   - `type`: A descriptive concept type (e.g., `Research Concept`, `Regulatory Guide`, `Reference`, `Specification`, `Playbook`, `Metric`).
   - `title`: Clear human-readable title for the research concept.
   - `description`: A concise one-sentence summary of the concept.
   - `tags`: A YAML list of 3–6 lowercase topic tags (e.g., `[tag-one, tag-two, tag-three]`).
   - `sources`: A YAML list of external sources retrieved via Google Search (or hydrated from `workspace/bundle/references/`), where each entry has `id` (a short kebab-case key like `primary-source-2026`), `resource` (the exact URL returned by Google Search — including `vertexaisearch.cloud.google.com/grounding-api-redirect/...` URLs, which the OKF provenance engine automatically resolves to canonical URLs — or a canonical `resource` URL supplied in `workspace/bundle/references/`; never guess or fabricate URLs, and perform 1–2 focused search batches without re-searching solely to unwrap redirect URLs), and `title` (human-readable source title). Apply Layer 0's **Source-Authority Hierarchy**: cross-check hosting domain, format, and edition currency before naming `id`/`title` (never append an authority/publisher suffix unless hosted on that authority's domain), treat hydrated `workspace/bundle/references/` `sources[]` and `Authoritative Content` excerpts as ground truth (retrieving the official `text/html` guidance section directly if a clause or lookup table is outside the excerpt), and prefer consolidated live `text/html` pages over unversioned or `CSP: object-src 'none'` static PDFs without repeating `site:` queries against `robots.txt`-blocked hosts that return `0` hits. (The OKF provenance engine automatically stamps `mime_type`, `retrieved_at`, and HTTP/HTML/PDF `last_modified`.)
2. In the Markdown body, attribute every key fact, statistic, or claim using a Markdown footnote label matching `sources[].id` placed after sentence punctuation or clause text (for example: `<Verified claim or metric>[^primary-source-2026].` — never write double-caret `^[^id]`, and when citing multiple sources use adjacent brackets `[^id1][^id2]` rather than comma-separated `[^id1, ^id2]`). Do NOT repeat raw URLs inline in prose paragraphs.
3. Follow Layer 0's **Structured Markdown Standards** for bundle-root cross-links (`/research/<concept>.md`, `/references/<reference-slug>.md`) and fenced ```` ```mermaid ```` (`flowchart TD`/`LR`) or GFM table diagrams (zero `+---+` ASCII box-art).
4. At the very bottom of the Markdown body, include the matching footnote definitions (`[^source-id]: Source Title`).
5. Strictly enforce Layer 0's **Epistemic Rigor** rules: surface source conflicts and evidence gaps explicitly (`[^source-a]` vs. `[^source-b]`) for Stage 1 Intermission review, formulate neutral concept/title search queries without parametric ID or classification self-echo (citing formal alphanumeric identifiers only when verbatim in a retrieved source and verifying exact lookup-table row/column mappings), and clearly distinguish binding statutory/standard duties from non-binding advisory guidance.

NOTE:
Maintain strict Unicode script consistency in the target language—never emit stray subwords or characters from unrelated writing systems inside prose. If specific sub-questions, private figures, or real-time details cannot be verified via grounded sources, do not return a generic refusal and never fabricate unverified numbers, dates, statutory/standard identifiers, or citations. Instead, synthesize what is verifiably established and explicitly note any unconfirmed or open points so the human reviewer can inspect or supplement sources at Intermission. Always output a complete, structured OKF v0.3 research document.
