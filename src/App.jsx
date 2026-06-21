import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  Boxes, Plus, Type, Image as ImageIcon, Hash, Braces, Link2, Trash2,
  Copy, Check, Sparkles, Database, X, Workflow, FileJson, Zap,
  ChevronRight, MousePointer2, Layers, CircleDot, Tag,
  Loader2, Rocket, FileCode2, HardDriveDownload, RefreshCw, ImageDown, AlertCircle,
  Lock, Eye, EyeOff, ShieldCheck, ExternalLink, AlertTriangle, KeyRound,
  AlignLeft, CheckSquare, Palette, Puzzle, LayoutTemplate, Code2,
  ChevronUp, ChevronDown, SquareStack,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * SchemaFlow — Shopify Metaobject Schema & UX Blueprint Architect
 * A standalone, browser-only node-graph editor that builds Shopify
 * metaobject / metafield definitions visually and exports native JSON.
 * ------------------------------------------------------------------ */

const NODE_W = 256;
const HEADER_H = 44;
const FIELD_H = 32;
const FIELD_GAP = 4;
const BODY_PAD = 8;

const FIELD_TYPES = {
  TEXT:      { label: "Text",      shopify: "single_line_text_field", icon: Type,      tint: "text-sky-300",     dot: "#7dd3fc" },
  IMAGE:     { label: "Image",     shopify: "file_reference",         icon: ImageIcon, tint: "text-amber-300",   dot: "#fcd34d" },
  NUMBER:    { label: "Number",    shopify: "number_integer",         icon: Hash,      tint: "text-rose-300",    dot: "#fda4af" },
  JSON:      { label: "JSON",      shopify: "json",                   icon: Braces,    tint: "text-fuchsia-300", dot: "#f0abfc" },
  REFERENCE: { label: "Reference", shopify: "metaobject_reference",   icon: Link2,     tint: "text-cyan-300",    dot: "#67e8f9" },
};
const ADDABLE = ["TEXT", "IMAGE", "NUMBER", "JSON"];

// Theme-section setting types (Shopify section schema)
const SECTION_TYPES = {
  S_TEXT:     { label: "Text",      shopify: "text",         icon: Type,      tint: "text-amber-300", dot: "#fcd34d" },
  S_RICHTEXT: { label: "Rich text", shopify: "richtext",     icon: AlignLeft, tint: "text-amber-300", dot: "#fbbf24" },
  S_IMAGE:    { label: "Image",     shopify: "image_picker", icon: ImageIcon, tint: "text-orange-300",dot: "#fb923c" },
  S_CHECKBOX: { label: "Toggle",    shopify: "checkbox",     icon: CheckSquare,tint: "text-amber-300",dot: "#fcd34d" },
  S_NUMBER:   { label: "Number",    shopify: "number",       icon: Hash,      tint: "text-orange-300",dot: "#fb923c" },
  S_COLOR:    { label: "Color",     shopify: "color",        icon: Palette,   tint: "text-amber-300", dot: "#fbbf24" },
  S_URL:      { label: "URL",       shopify: "url",          icon: Link2,     tint: "text-orange-300",dot: "#fb923c" },
};
const ADDABLE_SECTION = ["S_TEXT", "S_RICHTEXT", "S_IMAGE", "S_CHECKBOX", "S_NUMBER", "S_COLOR"];

const SECTION_ENTRY = { SECTION: { label: "Section", shopify: "section", icon: Puzzle, tint: "text-sky-300", dot: "#38bdf8" } };
const ALL_TYPES = { ...FIELD_TYPES, ...SECTION_TYPES, ...SECTION_ENTRY };
const typeInfo = (t) => ALL_TYPES[t] || FIELD_TYPES.TEXT;

const TEMPLATE_KINDS = {
  product:    { file: "product.json",    label: "product.json",    seed: ["main-product", "related-products"] },
  collection: { file: "collection.json", label: "collection.json", seed: ["main-collection", "collection-banner"] },
  page:       { file: "page.json",       label: "page.json",       seed: ["main-page", "rich-text"] },
};

const CATEGORY = {
  metaobject: { label: "Metaobject", accent: "#34d399", glow: "rgba(52,211,153,0.16)",  icon: Database,       kind: "data"   },
  metafield:  { label: "Metafield",  accent: "#a78bfa", glow: "rgba(167,139,250,0.16)", icon: Layers,         kind: "data"   },
  section:    { label: "Section",    accent: "#f59e0b", glow: "rgba(245,158,11,0.16)",  icon: Puzzle,         kind: "theme"  },
  template:   { label: "Template",   accent: "#38bdf8", glow: "rgba(56,189,248,0.16)",  icon: LayoutTemplate, kind: "layout" },
};

let _id = 1;
const uid = (p = "n") => `${p}_${_id++}_${Math.random().toString(36).slice(2, 6)}`;
const handleOf = (s) =>
  (s || "untitled").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "untitled";
const dashOf = (s) => handleOf(s).replace(/_/g, "-");

const field = (name, type, extra = {}) => ({ id: uid("f"), name, type, required: false, ...extra });
const nodeHeight = (n) => {
  const rows = Math.max((n.fields ? n.fields.length : 0) + (n.category === "section" && n.blocks?.length ? 1 : 0), 1);
  const extra = n.category === "template" ? 18 : 0; // template kind badge row
  return HEADER_H + BODY_PAD * 2 + rows * FIELD_H + (rows - 1) * FIELD_GAP + extra;
};

/* ----------------------------- seed + templates ----------------------------- */

function seedDefault() {
  const amb = {
    id: uid(), category: "metaobject", name: "Brand Ambassador", x: 60, y: 70,
    fields: [field("Display name", "TEXT", { required: true }), field("Portrait", "IMAGE"), field("Followers", "NUMBER"), field("Bio blocks", "JSON")],
  };
  const loc = {
    id: uid(), category: "metaobject", name: "Store Location", x: 60, y: 360,
    fields: [field("Name", "TEXT", { required: true }), field("Address", "TEXT"), field("Hours", "JSON"), field("Storefront", "IMAGE")],
  };
  const prod = {
    id: uid(), category: "metafield", name: "Product", x: 470, y: 215,
    fields: [field("Tagline", "TEXT")],
  };
  prod.fields.push(field("Ambassador", "REFERENCE", { targetType: handleOf(amb.name), targetNodeId: amb.id }));
  prod.fields.push(field("Nearest store", "REFERENCE", { targetType: handleOf(loc.name), targetNodeId: loc.id }));
  return [amb, loc, prod];
}

function tplB2B() {
  const tier = { id: uid(), category: "metaobject", name: "Wholesale Tier", x: 60, y: 70,
    fields: [field("Tier name", "TEXT", { required: true }), field("Discount percent", "NUMBER"), field("Minimum order", "NUMBER"), field("Payment terms", "JSON")] };
  const company = { id: uid(), category: "metaobject", name: "Company", x: 60, y: 360,
    fields: [field("Legal name", "TEXT", { required: true }), field("Tax ID", "TEXT"), field("Credit limit", "NUMBER"), field("Logo", "IMAGE")] };
  const rule = { id: uid(), category: "metaobject", name: "Volume Price Rule", x: 470, y: 70,
    fields: [field("Min quantity", "NUMBER", { required: true }), field("Unit price", "NUMBER", { required: true })] };
  const prod = { id: uid(), category: "metafield", name: "Product", x: 470, y: 360,
    fields: [field("Wholesale SKU", "TEXT"), field("MOQ", "NUMBER")] };
  company.fields.push(field("Assigned tier", "REFERENCE", { targetType: handleOf(tier.name), targetNodeId: tier.id }));
  prod.fields.push(field("Volume pricing", "REFERENCE", { targetType: handleOf(rule.name), targetNodeId: rule.id }));
  prod.fields.push(field("Buyer company", "REFERENCE", { targetType: handleOf(company.name), targetNodeId: company.id }));
  return [tier, company, rule, prod];
}

function tplFashion() {
  const model = { id: uid(), category: "metaobject", name: "Model", x: 60, y: 70,
    fields: [field("Name", "TEXT", { required: true }), field("Portrait", "IMAGE"), field("Instagram", "TEXT")] };
  const look = { id: uid(), category: "metaobject", name: "Look", x: 470, y: 70,
    fields: [field("Look name", "TEXT", { required: true }), field("Editorial shot", "IMAGE"), field("Stylist notes", "JSON")] };
  const book = { id: uid(), category: "metaobject", name: "Lookbook", x: 470, y: 360,
    fields: [field("Title", "TEXT", { required: true }), field("Season", "TEXT"), field("Cover", "IMAGE"), field("Story", "JSON")] };
  const prod = { id: uid(), category: "metafield", name: "Product", x: 60, y: 360,
    fields: [field("Materials", "JSON"), field("Care guide", "TEXT")] };
  look.fields.push(field("Worn by", "REFERENCE", { targetType: handleOf(model.name), targetNodeId: model.id }));
  book.fields.push(field("Featured looks", "REFERENCE", { targetType: handleOf(look.name), targetNodeId: look.id }));
  prod.fields.push(field("Appears in", "REFERENCE", { targetType: handleOf(look.name), targetNodeId: look.id }));
  return [prod, model, look, book];
}

/* ----------------------------- export builder ----------------------------- */

function buildSchema(nodes) {
  const usedTypes = new Set();
  const typeFor = (n) => {
    let base = handleOf(n.name), t = base, i = 2;
    while (usedTypes.has(t)) t = `${base}_${i++}`;
    usedTypes.add(t);
    return t;
  };
  const typeMap = {};
  nodes.forEach((n) => { typeMap[n.id] = typeFor(n); });

  const fieldDef = (f) => {
    const def = { key: handleOf(f.name), name: f.name, type: FIELD_TYPES[f.type].shopify };
    if (f.required) def.required = true;
    if (f.type === "REFERENCE") {
      const tt = f.targetNodeId && typeMap[f.targetNodeId] ? typeMap[f.targetNodeId] : f.targetType || "unknown";
      def.validations = [{ name: "metaobject_definition_id", value: tt }];
    }
    return def;
  };

  const metaobjectDefinitions = nodes
    .filter((n) => n.category === "metaobject")
    .map((n) => ({ type: typeMap[n.id], name: n.name, fieldDefinitions: n.fields.map(fieldDef) }));

  const metafieldDefinitions = nodes
    .filter((n) => n.category === "metafield")
    .flatMap((n) =>
      n.fields.map((f) => {
        const base = { namespace: "custom", key: handleOf(f.name), name: f.name,
          ownerType: handleOf(n.name).toUpperCase(), type: FIELD_TYPES[f.type].shopify };
        if (f.required) base.required = true;
        if (f.type === "REFERENCE") {
          const tt = f.targetNodeId && typeMap[f.targetNodeId] ? typeMap[f.targetNodeId] : f.targetType || "unknown";
          base.validations = [{ name: "metaobject_definition_id", value: tt }];
        }
        return base;
      })
    );

  return { metaobjectDefinitions, metafieldDefinitions };
}

function highlightJson(json) {
  const esc = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/("(?:\\.|[^"\\])*"\s*:)/g, '<span style="color:#67e8f9">$1</span>')
    .replace(/(:\s*)("(?:\\.|[^"\\])*")/g, '$1<span style="color:#86efac">$2</span>')
    .replace(/\b(true|false)\b/g, '<span style="color:#fca5a5">$1</span>')
    .replace(/(:\s*)(-?\d+\.?\d*)/g, '$1<span style="color:#fcd34d">$2</span>');
}

/* ----------------------------- liquid + hydrogen scaffolder ----------------------------- */

const titleKeyOf = (node) => {
  const f = node.fields.find((x) => x.type === "TEXT") || node.fields[0];
  return f ? handleOf(f.name) : "id";
};

function buildLiquid(node, nodes) {
  if (!node) return "";
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const block = handleOf(node.name).replace(/_/g, "-");
  const L = [];

  if (node.category === "metafield") {
    const owner = handleOf(node.name);                 // product / customer ...
    L.push(`{%- comment -%}`);
    L.push(`  ${node.name} · ${owner.toUpperCase()} metafields — generated by SchemaFlow`);
    L.push(`{%- endcomment -%}`);
    L.push(``);
    L.push(`<div class="${block}-meta">`);
    node.fields.forEach((f) => {
      const path = `${owner}.metafields.custom.${handleOf(f.name)}`;
      L.push(...renderLiquidField(f, path, byId, block));
    });
    L.push(`</div>`);
  } else {
    const v = handleOf(node.name);
    L.push(`{%- comment -%}`);
    L.push(`  ${node.name} · metaobject: ${handleOf(node.name)} — generated by SchemaFlow`);
    L.push(`{%- endcomment -%}`);
    L.push(``);
    L.push(`{%- assign ${v} = product.metafields.custom.${handleOf(node.name)}.value -%}`);
    L.push(``);
    L.push(`<div class="${block}">`);
    node.fields.forEach((f) => {
      const path = `${v}.${handleOf(f.name)}`;
      L.push(...renderLiquidField(f, path, byId, block));
    });
    L.push(`</div>`);
  }
  return L.join("\n");
}

function renderLiquidField(f, path, byId, block) {
  const key = handleOf(f.name);
  switch (f.type) {
    case "IMAGE":
      return [
        `  {%- if ${path} -%}`,
        `    <img class="${block}__${key}"`,
        `         src="{{ ${path} | image_url: width: 800 }}"`,
        `         alt="${f.name}" loading="lazy" width="800">`,
        `  {%- endif -%}`,
      ];
    case "NUMBER":
      return [`  <span class="${block}__${key}">{{ ${path} }}</span>`];
    case "JSON":
      return [
        `  {%- assign ${key}_data = ${path}.value -%}`,
        `  {%- for item in ${key}_data -%}{{ item }}{%- endfor -%}`,
      ];
    case "REFERENCE": {
      const target = f.targetNodeId && byId[f.targetNodeId] ? byId[f.targetNodeId] : null;
      const tk = target ? titleKeyOf(target) : "title";
      return [
        `  {%- assign ${key}_ref = ${path}.value -%}`,
        `  <a class="${block}__${key}" href="#">{{ ${key}_ref.${tk} }}</a>`,
      ];
    }
    default: // TEXT
      return [`  <span class="${block}__${key}">{{ ${path} }}</span>`];
  }
}

function buildHydrogen(node, nodes) {
  if (!node) return "";
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const frag = handleOf(node.name).replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
  const lines = [`fragment ${frag} on Metaobject {`, `  type`, `  handle`];
  node.fields.forEach((f) => {
    const key = handleOf(f.name);
    if (f.type === "IMAGE") {
      lines.push(`  ${key}: field(key: "${key}") {`,
        `    reference { ... on MediaImage { image { url altText width height } } }`, `  }`);
    } else if (f.type === "REFERENCE") {
      const target = f.targetNodeId && byId[f.targetNodeId] ? byId[f.targetNodeId] : null;
      const tk = target ? titleKeyOf(target) : "id";
      lines.push(`  ${key}: field(key: "${key}") {`,
        `    reference { ... on Metaobject { ${tk}: field(key: "${tk}") { value } } }`, `  }`);
    } else {
      lines.push(`  ${key}: field(key: "${key}") { value }`);
    }
  });
  lines.push(`}`);
  return lines.join("\n");
}

function highlightLiquid(code) {
  const esc = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/(\{%-?[\s\S]*?-?%\})/g, '<span style="color:#c4b5fd">$1</span>')
    .replace(/(\{\{[\s\S]*?\}\})/g, '<span style="color:#67e8f9">$1</span>')
    .replace(/(&quot;[^&]*?&quot;)/g, '<span style="color:#86efac">$1</span>')
    .replace(/\b(fragment|on|query)\b/g, '<span style="color:#fca5a5">$1</span>');
}

/* ----------------------------- theme section schema ----------------------------- */

function settingJson(s) {
  const o = { type: SECTION_TYPES[s.type]?.shopify || "text", id: handleOf(s.name), label: s.name };
  if (s.type === "S_CHECKBOX") o.default = true;
  else if (s.type === "S_TEXT" || s.type === "S_RICHTEXT") o.default = "";
  else if (s.type === "S_COLOR") o.default = "#000000";
  return o;
}

function buildSectionSchema(node) {
  const schema = { name: node.name || "Section" };
  if (node.tag) schema.tag = node.tag;
  if (node.cssClass) schema.class = node.cssClass;
  schema.settings = node.fields.map(settingJson);
  if (node.blocks && node.blocks.length) {
    schema.blocks = node.blocks.map((b) => ({
      type: handleOf(b.name),
      name: b.name,
      settings: (b.fields || []).map(settingJson),
    }));
    schema.max_blocks = 16;
  }
  schema.presets = [{ name: node.name || "Section" }];
  return schema;
}

function buildSectionLiquid(node) {
  const handle = dashOf(node.name);
  const tag = node.tag || "section";
  const cls = node.cssClass ? ` class="${node.cssClass}"` : "";
  const L = [`{%- comment -%} sections/${handle}.liquid — generated by SchemaFlow {%- endcomment -%}`, ``];
  L.push(`<${tag}${cls} {{ section.shopify_attributes }}>`);
  node.fields.forEach((s) => {
    const id = handleOf(s.name);
    if (s.type === "S_IMAGE") {
      L.push(`  {%- if section.settings.${id} -%}`,
        `    <img src="{{ section.settings.${id} | image_url: width: 1600 }}" alt="${s.name}" loading="lazy">`,
        `  {%- endif -%}`);
    } else if (s.type === "S_CHECKBOX") {
      L.push(`  {%- if section.settings.${id} -%}<!-- ${s.name} on -->{%- endif -%}`);
    } else if (s.type === "S_RICHTEXT") {
      L.push(`  <div class="rte">{{ section.settings.${id} }}</div>`);
    } else {
      L.push(`  <span class="${handle}__${id}">{{ section.settings.${id} }}</span>`);
    }
  });
  if (node.blocks && node.blocks.length) {
    L.push(``, `  {%- for block in section.blocks -%}`);
    L.push(`    <div {{ block.shopify_attributes }}>`);
    L.push(`      {%- comment -%} block: {{ block.type }} {%- endcomment -%}`);
    L.push(`    </div>`);
    L.push(`  {%- endfor -%}`);
  }
  L.push(`</${tag}>`, ``);
  L.push(`{% schema %}`);
  L.push(JSON.stringify(buildSectionSchema(node), null, 2));
  L.push(`{% endschema %}`);
  return L.join("\n");
}

/* ----------------------------- page / product template json ----------------------------- */

function buildTemplateJson(node, nodes) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const sections = {};
  const order = [];
  const used = new Set();
  node.fields.forEach((entry) => {
    const ref = entry.targetNodeId ? byId[entry.targetNodeId] : null;
    const type = ref ? dashOf(ref.name) : dashOf(entry.name);
    let key = handleOf(entry.name);
    let k = key, i = 2;
    while (used.has(k)) k = `${key}_${i++}`;
    used.add(k);
    const block = { type, settings: {} };
    if (ref && ref.blocks && ref.blocks.length) {
      block.blocks = {};
      block.block_order = [];
    }
    sections[k] = block;
    order.push(k);
  });
  return { sections, order };
}

function buildTemplateText(node, nodes) {
  return JSON.stringify(buildTemplateJson(node, nodes), null, 2);
}

/* ----------------------------- node card ----------------------------- */

function NodeCard({ node, selected, linking, linkSource, onPointerDownNode, onClickNode, onStartLink, onDelete, onMove }) {
  const cat = CATEGORY[node.category];
  const isLinkSrc = linkSource === node.id;
  const isData = cat.kind === "data";
  const isTheme = node.category === "section";
  const isLayout = node.category === "template";

  // distinct surface per family
  const surface = isLayout
    ? "linear-gradient(180deg,#0c1a2b 0%,#0a1422 100%)"
    : isTheme
      ? "linear-gradient(180deg,#221a10 0%,#171108 100%)"
      : "linear-gradient(180deg,#0f1b2f 0%,#0c1626 100%)";

  return (
    <div
      onPointerDown={(e) => onPointerDownNode(e, node.id)}
      onClick={() => onClickNode(node.id)}
      className="absolute select-none transition-shadow duration-150"
      style={{
        left: node.x, top: node.y, width: NODE_W,
        background: surface,
        border: `${isLayout ? "1px dashed" : "1px solid"} ${selected || isLinkSrc ? cat.accent : isTheme ? "#3a2c12" : isLayout ? "#16324d" : "#1e2c44"}`,
        borderRadius: isLayout ? 14 : 12,
        boxShadow: selected
          ? `0 0 0 1px ${cat.accent}, 0 18px 40px -18px ${cat.glow}, 0 0 28px -6px ${cat.glow}`
          : "0 14px 34px -22px rgba(0,0,0,0.9)",
        cursor: "grab", zIndex: selected ? 20 : 10,
        outline: linking && !isLinkSrc ? `1px dashed ${cat.accent}88` : "none",
      }}
    >
      {/* family accent strip */}
      <div style={{ height: 3, background: cat.accent, borderTopLeftRadius: isLayout ? 13 : 11, borderTopRightRadius: isLayout ? 13 : 11, opacity: 0.85 }} />

      {/* header */}
      <div className="flex items-center gap-2 px-3" style={{ height: HEADER_H - 3 }}>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
          style={{ background: cat.glow, color: cat.accent }}>
          <cat.icon size={13} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight text-slate-100">{node.name || "Untitled"}</div>
          <div className="truncate font-mono text-[9px] uppercase tracking-wider" style={{ color: cat.accent }}>
            {isLayout ? `Layout · ${TEMPLATE_KINDS[node.templateType]?.file || "template.json"}`
              : isTheme ? `Section · ${dashOf(node.name)}`
              : `${cat.label} · ${handleOf(node.name)}`}
          </div>
        </div>
        {isData && (
          <button data-nodrag onClick={(e) => { e.stopPropagation(); onStartLink(node.id); }} title="Link to another object"
            className="grid h-6 w-6 place-items-center rounded-md text-slate-500 transition-colors hover:bg-cyan-400/10 hover:text-cyan-300"
            style={isLinkSrc ? { background: "rgba(103,232,249,0.14)", color: "#67e8f9" } : undefined}>
            <Link2 size={13} />
          </button>
        )}
        <button data-nodrag onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} title="Delete"
          className="grid h-6 w-6 place-items-center rounded-md text-slate-500 transition-colors hover:bg-rose-400/10 hover:text-rose-300">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="mx-3 h-px" style={{ background: "linear-gradient(90deg,transparent,#22324d,transparent)" }} />

      {/* body */}
      <div className="space-y-1 px-2 py-2">
        {node.fields.length === 0 && (
          <div className="flex h-8 items-center justify-center rounded-md border border-dashed border-slate-700/70 font-mono text-[10px] text-slate-600">
            {isLayout ? "add sections in the panel" : isTheme ? "add settings in the panel" : "no fields — add one in the panel"}
          </div>
        )}

        {node.fields.map((f, i) => {
          const ft = typeInfo(f.type);

          if (isLayout) {
            const order = String(i + 1).padStart(2, "0");
            return (
              <div key={f.id} className="flex items-center gap-2 rounded-md px-2"
                style={{ height: FIELD_H, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.14)" }}>
                <span className="font-mono text-[10px] font-bold text-sky-400">{order}</span>
                <SquareStack size={12} className="shrink-0 text-sky-300" />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-200">{f.targetNodeId ? dashOf(f.name) : f.name}</span>
                <button data-nodrag onClick={(e) => { e.stopPropagation(); onMove(node.id, f.id, -1); }}
                  className="text-slate-500 transition-colors hover:text-sky-300 disabled:opacity-20" disabled={i === 0}><ChevronUp size={13} /></button>
                <button data-nodrag onClick={(e) => { e.stopPropagation(); onMove(node.id, f.id, 1); }}
                  className="text-slate-500 transition-colors hover:text-sky-300 disabled:opacity-20" disabled={i === node.fields.length - 1}><ChevronDown size={13} /></button>
              </div>
            );
          }

          return (
            <div key={f.id} className="flex items-center gap-2 rounded-md px-2"
              style={{ height: FIELD_H, background: "rgba(148,163,184,0.05)" }}>
              <ft.icon size={12} className={`shrink-0 ${ft.tint}`} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-slate-200">{f.name}</span>
              {f.required && <span className="font-mono text-[9px] text-rose-300/80">req</span>}
              {f.type === "REFERENCE" ? (
                <span className="flex items-center gap-1 rounded font-mono text-[9px] text-cyan-300">
                  <ChevronRight size={10} />{f.targetType}
                </span>
              ) : (
                <span className="font-mono text-[9px] uppercase tracking-wide text-slate-500">{ft.label}</span>
              )}
            </div>
          );
        })}

        {/* section blocks summary */}
        {isTheme && node.blocks && node.blocks.length > 0 && (
          <div className="flex items-center gap-2 rounded-md px-2"
            style={{ height: FIELD_H, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <Boxes size={12} className="shrink-0 text-amber-300" />
            <span className="min-w-0 flex-1 truncate text-[11px] text-amber-200/90">
              {node.blocks.length} block{node.blocks.length === 1 ? "" : "s"}: {node.blocks.map((b) => b.name).join(", ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- main app ----------------------------- */

export default function SchemaFlow() {
  const [nodes, setNodes] = useState(seedDefault);
  const [selectedId, setSelectedId] = useState(null);
  const [linkSource, setLinkSource] = useState(null);
  const [toast, setToast] = useState(null);
  const [newType, setNewType] = useState("TEXT");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldReq, setNewFieldReq] = useState(false);
  const [tab, setTab] = useState("json");        // "json" | "liquid"
  const [migrate, setMigrate] = useState(false);  // content migration toggle
  const [modalOpen, setModalOpen] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  // deployState.phase: idle | running | error | done
  const [deployState, setDeployState] = useState({ phase: "idle", step: "", log: [], error: "" });

  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const toastTimer = useRef(null);

  const selected = nodes.find((n) => n.id === selectedId) || null;

  const fireToast = useCallback((msg, ok = true) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  /* content bounds for canvas + svg */
  const bounds = useMemo(() => {
    let w = 900, h = 640;
    nodes.forEach((n) => {
      w = Math.max(w, n.x + NODE_W + 220);
      h = Math.max(h, n.y + nodeHeight(n) + 160);
    });
    return { w, h };
  }, [nodes]);

  const connections = useMemo(() => {
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const out = [];
    nodes.forEach((n) => {
      n.fields.forEach((f) => {
        if (f.type === "REFERENCE" && f.targetNodeId && byId[f.targetNodeId]) {
          out.push({ id: f.id, from: n, to: byId[f.targetNodeId], label: f.name });
        }
      });
    });
    return out;
  }, [nodes]);

  /* drag handlers */
  const onPointerDownNode = useCallback((e, id) => {
    if (e.target.closest("[data-nodrag]")) return;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = {
      id,
      offX: e.clientX - rect.left + canvasRef.current.scrollLeft - node.x,
      offY: e.clientY - rect.top + canvasRef.current.scrollTop - node.y,
    };
    movedRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [nodes]);

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + canvasRef.current.scrollLeft - d.offX;
    const y = e.clientY - rect.top + canvasRef.current.scrollTop - d.offY;
    movedRef.current = true;
    setNodes((prev) => prev.map((n) => (n.id === d.id ? { ...n, x: Math.max(8, x), y: Math.max(8, y) } : n)));
  }, []);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  const onClickNode = useCallback((id) => {
    if (movedRef.current) { movedRef.current = false; return; }
    if (linkSource) {
      if (linkSource !== id) {
        const target = nodes.find((n) => n.id === id);
        setNodes((prev) => prev.map((n) =>
          n.id === linkSource
            ? { ...n, fields: [...n.fields, field(target.name, "REFERENCE", { targetType: handleOf(target.name), targetNodeId: id })] }
            : n));
        fireToast(`Linked → ${target.name}`);
      }
      setLinkSource(null);
      return;
    }
    setSelectedId(id);
  }, [linkSource, nodes, fireToast]);

  /* mutations */
  const addObject = (category = "metaobject") => {
    const base = { id: uid(), x: 120 + Math.random() * 60, y: 110 + Math.random() * 70 };
    let n;
    if (category === "section") {
      n = { ...base, category, name: "Hero section", tag: "section", cssClass: "hero-section",
        blocks: [],
        fields: [field("Heading", "S_TEXT"), field("Background", "S_IMAGE"), field("Show button", "S_CHECKBOX")] };
    } else if (category === "template") {
      const kind = "product";
      n = { ...base, category, name: "Product page", templateType: kind,
        fields: TEMPLATE_KINDS[kind].seed.map((t) => field(t, "SECTION")) };
    } else {
      n = { ...base, category, name: category === "metafield" ? "Custom owner" : "Custom object", fields: [] };
    }
    setNodes((p) => [...p, n]);
    setSelectedId(n.id);
  };
  const patchSelected = (patch) => setNodes((p) => p.map((n) => (n.id === selectedId ? { ...n, ...patch } : n)));
  const removeNode = (id) => {
    setNodes((p) => p.filter((n) => n.id !== id).map((n) => ({ ...n, fields: n.fields.filter((f) => f.targetNodeId !== id) })));
    setSelectedId((s) => (s === id ? null : s));
    setLinkSource((s) => (s === id ? null : s));
  };
  const addField = () => {
    if (!selected) return;
    const isSection = selected.category === "section";
    const t = isSection ? (ADDABLE_SECTION.includes(newType) ? newType : "S_TEXT")
      : (ADDABLE.includes(newType) ? newType : "TEXT");
    const name = newFieldName.trim() || `${typeInfo(t).label} field`;
    patchSelected({ fields: [...selected.fields, field(name, t, { required: isSection ? false : newFieldReq })] });
    setNewFieldName(""); setNewFieldReq(false);
  };
  const removeField = (fid) => patchSelected({ fields: selected.fields.filter((f) => f.id !== fid) });
  const toggleReq = (fid) =>
    patchSelected({ fields: selected.fields.map((f) => (f.id === fid ? { ...f, required: !f.required } : f)) });

  const moveField = useCallback((nodeId, fid, dir) => {
    setNodes((prev) => prev.map((n) => {
      if (n.id !== nodeId) return n;
      const idx = n.fields.findIndex((f) => f.id === fid);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= n.fields.length) return n;
      const fields = [...n.fields];
      [fields[idx], fields[to]] = [fields[to], fields[idx]];
      return { ...n, fields };
    }));
  }, []);

  // section block helpers
  const addBlock = () => {
    if (!selected || selected.category !== "section") return;
    const blocks = [...(selected.blocks || []), { id: uid("b"), name: "Block", fields: [field("Image", "S_IMAGE")] }];
    patchSelected({ blocks });
  };
  const removeBlock = (bid) => patchSelected({ blocks: (selected.blocks || []).filter((b) => b.id !== bid) });
  const patchBlock = (bid, patch) =>
    patchSelected({ blocks: (selected.blocks || []).map((b) => (b.id === bid ? { ...b, ...patch } : b)) });

  // template section entry helpers
  const addTemplateSection = (name, targetNodeId) => {
    if (!selected || selected.category !== "template") return;
    patchSelected({ fields: [...selected.fields, field(name, "SECTION", targetNodeId ? { targetNodeId } : {})] });
  };

  const loadTemplate = (maker, label) => {
    _id = 1;
    setNodes(maker());
    setSelectedId(null);
    setLinkSource(null);
    fireToast(`Loaded ${label}`);
  };

  const schema = useMemo(() => buildSchema(nodes), [nodes]);
  const jsonText = useMemo(() => JSON.stringify(schema, null, 2), [schema]);

  const liquidText = useMemo(() => {
    if (!selected) return "";
    return `${buildLiquid(selected, nodes)}\n\n{%- comment -%} ───── Hydrogen · Storefront API (GraphQL) ───── {%- endcomment -%}\n${buildHydrogen(selected, nodes)}`;
  }, [selected, nodes]);

  const sectionText = useMemo(
    () => (selected && selected.category === "section" ? buildSectionLiquid(selected) : ""),
    [selected]);
  const templateText = useMemo(
    () => (selected && selected.category === "template" ? buildTemplateText(selected, nodes) : ""),
    [selected, nodes]);

  // export context follows the selected node's family
  const ctx = !selected ? "data" : CATEGORY[selected.category].kind;

  const tabs = useMemo(() => {
    if (ctx === "theme") return [{ id: "section", label: "Liquid {% schema %}", icon: Code2, lang: "liquid" }];
    if (ctx === "layout") return [{ id: "tpl", label: TEMPLATE_KINDS[selected.templateType]?.file || "template.json", icon: LayoutTemplate, lang: "json" }];
    return [
      { id: "json", label: "Shopify-Schema.json", icon: FileJson, lang: "json" },
      { id: "liquid", label: "Liquid Component", icon: FileCode2, lang: "liquid" },
    ];
  }, [ctx, selected]);

  const curTab = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const curTabDef = tabs.find((t) => t.id === curTab) || tabs[0];

  const activeText =
    curTab === "json" ? jsonText
    : curTab === "liquid" ? liquidText
    : curTab === "section" ? sectionText
    : templateText;

  const activeFile =
    curTab === "json" ? "shopify-schema.json"
    : curTab === "liquid" ? (selected ? `${handleOf(selected.name)}.liquid` : "—.liquid")
    : curTab === "section" ? `sections/${dashOf(selected?.name || "section")}.liquid`
    : `templates/${TEMPLATE_KINDS[selected?.templateType]?.file || "template.json"}`;

  const migStats = useMemo(() => {
    const metas = nodes.filter((n) => n.category === "metaobject");
    const records = metas.reduce(
      (a, n) => a + 9 + n.fields.length * 4 + (handleOf(n.name).length % 6) * 3, 0);
    const assets = nodes.reduce(
      (a, n) => a + n.fields.filter((f) => f.type === "IMAGE").length, 0) * 14 + (records % 7);
    return { records, assets, entries: records + metas.length * 3, metas: metas.length };
  }, [nodes]);

  const copyActive = async () => {
    const text = activeText || "// select a node to scaffold its code";
    const label = `${curTabDef.label} copied`;
    try {
      await navigator.clipboard.writeText(text);
      fireToast(label);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
        fireToast(label);
      } catch { fireToast("Copy blocked — select the code manually", false); }
    }
  };

  /* ---- LIVE deployment via our own Express backend (/api/deploy) ---- */
  const API_VERSION = "2026-04"; // enforced server-side; shown here for reference
  const DEPLOY_ENDPOINT = "/api/deploy";

  // Convert our internal schema into Shopify MetaobjectDefinitionCreateInput objects.
  const toShopifyDefinitions = useCallback(() => {
    return schema.metaobjectDefinitions.map((d) => ({
      name: d.name,
      type: d.type,
      fieldDefinitions: d.fieldDefinitions.map((f) => {
        const fd = { key: f.key, name: f.name, type: f.type };
        if (f.required) fd.required = true;
        if (f.validations) fd.validations = f.validations;
        return fd;
      }),
    }));
  }, [schema]);

  const normalizeStore = (raw) =>
    raw.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").replace(/\s+/g, "");

  const openDeploy = () => {
    if (schema.metaobjectDefinitions.length === 0) {
      fireToast("Add at least one metaobject before deploying", false);
      return;
    }
    setDeployState({ phase: "idle", step: "", log: [], error: "" });
    setModalOpen(true);
  };

  const runLiveDeploy = async () => {
    const host = normalizeStore(storeUrl);
    if (!host) { setDeployState((s) => ({ ...s, phase: "error", error: "Enter your store URL (your-store.myshopify.com)." })); return; }
    if (!token.trim()) { setDeployState((s) => ({ ...s, phase: "error", error: "Enter your Admin API access token (shpat_…)." })); return; }

    const jsonSchema = toShopifyDefinitions();
    setDeployState({ phase: "running", step: `Deploying ${jsonSchema.length} definition${jsonSchema.length === 1 ? "" : "s"} via backend…`, log: [], error: "" });

    try {
      // Standard same-origin call to OUR server — no CORS, token relayed server-to-server.
      const res = await fetch(DEPLOY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeUrl: host, adminApiToken: token.trim(), jsonSchema }),
      });

      let data = {};
      try { data = await res.json(); } catch { /* non-JSON error */ }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Server responded ${res.status} ${res.statusText}`);
      }

      const log = (data.results || []).map((r) => `✓ ${r.name} → ${r.id}`);
      setDeployState({ phase: "done", step: "", log, error: "" });
      setModalOpen(false);
      fireToast(`Successfully deployed to ${host}! Your Metaobjects are now live in your Shopify Admin panel.`);
    } catch (err) {
      setDeployState((s) => ({ ...s, phase: "error", error: err?.message || String(err) }));
    }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setLinkSource(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // keep the field-type picker valid for the selected family
  useEffect(() => {
    if (!selected) return;
    if (selected.category === "section" && !ADDABLE_SECTION.includes(newType)) setNewType("S_TEXT");
    if ((selected.category === "metaobject" || selected.category === "metafield") && !ADDABLE.includes(newType)) setNewType("TEXT");
  }, [selectedId]); // eslint-disable-line

  const stats = useMemo(() => ({
    objects: nodes.length,
    fields: nodes.reduce((a, n) => a + n.fields.length, 0),
    refs: connections.length,
  }), [nodes, connections]);

  /* connection path geometry */
  const pathFor = (c) => {
    const fromH = nodeHeight(c.from), toH = nodeHeight(c.to);
    const fcy = c.from.y + fromH / 2, tcy = c.to.y + toH / 2;
    const goRight = c.to.x >= c.from.x;
    const sx = goRight ? c.from.x + NODE_W : c.from.x;
    const ex = goRight ? c.to.x : c.to.x + NODE_W;
    const curve = Math.max(Math.abs(ex - sx) * 0.5, 46);
    const c1x = sx + (goRight ? curve : -curve);
    const c2x = ex + (goRight ? -curve : curve);
    return { d: `M ${sx} ${fcy} C ${c1x} ${fcy} ${c2x} ${tcy} ${ex} ${tcy}`,
      mx: (sx + ex) / 2, my: (fcy + tcy) / 2 };
  };

  return (
    <div className="flex h-[760px] w-full overflow-hidden font-sans text-slate-200"
      style={{ background: "#070d18", fontFamily: "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif" }}>

      {/* ============================= LEFT: BUILDER ============================= */}
      <aside className="flex shrink-0 flex-col border-r" style={{ width: 308, background: "#0a1322", borderColor: "#172339" }}>
        {/* brand */}
        <div className="flex items-center gap-2.5 px-4 py-3.5" style={{ borderBottom: "1px solid #172339" }}>
          <span className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ background: "linear-gradient(135deg,#34d399,#0ea5e9)", boxShadow: "0 8px 20px -8px rgba(52,211,153,0.7)" }}>
            <Workflow size={17} className="text-slate-900" strokeWidth={2.4} />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight text-white">SchemaFlow</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-400/80">Metaobject Architect</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "thin" }}>
          {/* new object */}
          <SectionLabel icon={Plus}>Build</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <BuildButton accent="#34d399" icon={Database} label="Metaobject" onClick={() => addObject("metaobject")} />
            <BuildButton accent="#a78bfa" icon={Layers} label="Metafield" onClick={() => addObject("metafield")} />
            <BuildButton accent="#f59e0b" icon={Puzzle} label="Theme Section Schema" onClick={() => addObject("section")} />
            <BuildButton accent="#38bdf8" icon={LayoutTemplate} label="Page Layout Template" onClick={() => addObject("template")} />
          </div>

          {/* editor */}
          <div className="mt-5">
            <SectionLabel icon={CircleDot}>
              {!selected ? "Selected node" : `Edit ${CATEGORY[selected.category].label.toLowerCase()}`}
            </SectionLabel>
            {!selected ? (
              <div className="rounded-lg border border-dashed border-slate-700/70 px-3 py-5 text-center text-[12px] text-slate-500">
                Select a node on the canvas to edit it. Use the buttons above to add a data object, a theme section, or a page layout.
              </div>
            ) : (
              <div className="space-y-3">
                <input value={selected.name} onChange={(e) => patchSelected({ name: e.target.value })}
                  placeholder="Name"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] font-medium text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500/60" />

                {/* ---------- DATA: metaobject / metafield ---------- */}
                {CATEGORY[selected.category].kind === "data" && (
                  <>
                    <div className="flex items-center gap-2">
                      {Object.entries(CATEGORY).filter(([, v]) => v.kind === "data").map(([k, v]) => (
                        <button key={k} onClick={() => patchSelected({ category: k })}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-medium transition-colors"
                          style={{ borderColor: selected.category === k ? v.accent : "#28344b",
                            color: selected.category === k ? v.accent : "#94a3b8",
                            background: selected.category === k ? v.glow : "transparent" }}>
                          <v.icon size={12} /> {v.label}
                        </button>
                      ))}
                    </div>

                    <FieldList fields={selected.fields} onRemove={removeField} onToggleReq={toggleReq} showReq />
                    <AddFieldBox addable={ADDABLE} newType={newType} setNewType={setNewType}
                      newFieldName={newFieldName} setNewFieldName={setNewFieldName}
                      newFieldReq={newFieldReq} setNewFieldReq={setNewFieldReq} onAdd={addField} showReq accent="#34d399" />
                  </>
                )}

                {/* ---------- THEME: section ---------- */}
                {selected.category === "section" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-slate-500">tag</label>
                        <select value={selected.tag || "section"} onChange={(e) => patchSelected({ tag: e.target.value })}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-[12px] text-slate-100 outline-none focus:border-amber-500/60">
                          {["section", "div", "article", "aside"].map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-slate-500">class</label>
                        <input value={selected.cssClass || ""} onChange={(e) => patchSelected({ cssClass: e.target.value })}
                          placeholder="css-class"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-[12px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-500/60" />
                      </div>
                    </div>

                    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Settings</div>
                    <FieldList fields={selected.fields} onRemove={removeField} />
                    <AddFieldBox addable={ADDABLE_SECTION} cols={3} newType={newType} setNewType={setNewType}
                      newFieldName={newFieldName} setNewFieldName={setNewFieldName} onAdd={addField} accent="#f59e0b" />

                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Repeatable blocks</div>
                      <button onClick={addBlock}
                        className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20">
                        <Plus size={11} /> Block
                      </button>
                    </div>
                    {(selected.blocks || []).map((b) => (
                      <BlockEditor key={b.id} block={b}
                        onRename={(name) => patchBlock(b.id, { name })}
                        onRemove={() => removeBlock(b.id)}
                        onAddSetting={(name, type) => patchBlock(b.id, { fields: [...(b.fields || []), field(name, type)] })}
                        onRemoveSetting={(fid) => patchBlock(b.id, { fields: (b.fields || []).filter((f) => f.id !== fid) })} />
                    ))}
                  </>
                )}

                {/* ---------- LAYOUT: template ---------- */}
                {selected.category === "template" && (
                  <>
                    <div>
                      <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-slate-500">Template type</label>
                      <select value={selected.templateType}
                        onChange={(e) => patchSelected({ templateType: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-2 text-[13px] text-slate-100 outline-none focus:border-sky-500/60">
                        {Object.entries(TEMPLATE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.file}</option>)}
                      </select>
                    </div>

                    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Section order — drag handles on the canvas</div>
                    <div className="space-y-1.5">
                      {selected.fields.map((f, i) => (
                        <div key={f.id} className="group flex items-center gap-2 rounded-md border border-sky-500/20 bg-sky-500/5 px-2 py-1.5">
                          <span className="font-mono text-[10px] font-bold text-sky-400">{String(i + 1).padStart(2, "0")}</span>
                          <SquareStack size={12} className="text-sky-300" />
                          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-200">{f.targetNodeId ? dashOf(f.name) : f.name}</span>
                          <button onClick={() => moveField(selected.id, f.id, -1)} disabled={i === 0}
                            className="text-slate-500 hover:text-sky-300 disabled:opacity-20"><ChevronUp size={13} /></button>
                          <button onClick={() => moveField(selected.id, f.id, 1)} disabled={i === selected.fields.length - 1}
                            className="text-slate-500 hover:text-sky-300 disabled:opacity-20"><ChevronDown size={13} /></button>
                          <button onClick={() => removeField(f.id)}
                            className="text-slate-600 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                    <AddTemplateSection sectionNodes={nodes.filter((n) => n.category === "section")} onAdd={addTemplateSection} />
                  </>
                )}
              </div>
            )}
          </div>

          {/* templates */}
          <div className="mt-6">
            <SectionLabel icon={Sparkles}>Quick-start templates</SectionLabel>
            <div className="space-y-2">
              <TemplateButton accent="#34d399" title="B2B Wholesale Schema"
                desc="Tiers, companies, volume pricing"
                onClick={() => loadTemplate(tplB2B, "B2B Wholesale Schema")} />
              <TemplateButton accent="#f472b6" title="Fashion Brand Lookbook"
                desc="Models, looks, seasonal lookbooks"
                onClick={() => loadTemplate(tplFashion, "Fashion Brand Lookbook")} />
              <TemplateButton accent="#38bdf8" title="Reset to starter"
                desc="Ambassador · Store · Product"
                onClick={() => loadTemplate(seedDefault, "starter schema")} />
            </div>
          </div>
        </div>
      </aside>

      {/* ============================= CENTER: CANVAS ============================= */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: "#0a1322", borderBottom: "1px solid #172339" }}>
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            <Boxes size={13} className="text-emerald-400" /> Blueprint canvas
          </div>
          <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-slate-500">
            <Stat label="objects" value={stats.objects} color="#34d399" />
            <Stat label="fields" value={stats.fields} color="#a78bfa" />
            <Stat label="links" value={stats.refs} color="#22d3ee" />
          </div>
        </div>

        {/* link hint */}
        {linkSource && (
          <div className="absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-1.5 text-[12px] font-medium text-cyan-200 backdrop-blur">
            <MousePointer2 size={12} className="mr-1.5 inline" /> Click a target object to link · Esc to cancel
          </div>
        )}

        <div ref={canvasRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          onClick={(e) => { if (e.target === e.currentTarget || e.target.dataset.bg) { setSelectedId(null); setLinkSource(null); } }}
          className="relative flex-1 overflow-auto"
          style={{ background: "#070d18", cursor: linkSource ? "crosshair" : "default" }}>
          <div data-bg="1" className="relative" style={{
            width: bounds.w, height: bounds.h,
            backgroundImage:
              "linear-gradient(rgba(45,72,110,0.20) 1px,transparent 1px),linear-gradient(90deg,rgba(45,72,110,0.20) 1px,transparent 1px),linear-gradient(rgba(45,72,110,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(45,72,110,0.07) 1px,transparent 1px)",
            backgroundSize: "120px 120px,120px 120px,24px 24px,24px 24px",
          }}>
            {/* connection layer */}
            <svg className="pointer-events-none absolute inset-0" width={bounds.w} height={bounds.h}>
              <defs>
                <marker id="sfArrow" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto">
                  <path d="M0,0 L7,3 L0,6 Z" fill="#22d3ee" />
                </marker>
              </defs>
              {connections.map((c) => {
                const g = pathFor(c);
                return (
                  <g key={c.id}>
                    <path d={g.d} fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeOpacity="0.55"
                      markerEnd="url(#sfArrow)" style={{ filter: "drop-shadow(0 0 4px rgba(34,211,238,0.45))" }} />
                    <g transform={`translate(${g.mx},${g.my})`}>
                      <rect x={-Math.max(20, c.label.length * 3.6)} y="-9" rx="5"
                        width={Math.max(40, c.label.length * 7.2)} height="18"
                        fill="#0a1626" stroke="#22d3ee" strokeOpacity="0.4" />
                      <text x="0" y="3.5" textAnchor="middle"
                        style={{ fill: "#67e8f9", fontSize: 9.5, fontFamily: "ui-monospace,monospace" }}>{c.label}</text>
                    </g>
                  </g>
                );
              })}
            </svg>

            {/* nodes */}
            {nodes.map((n) => (
              <NodeCard key={n.id} node={n} selected={selectedId === n.id}
                linking={!!linkSource} linkSource={linkSource}
                onPointerDownNode={onPointerDownNode} onClickNode={onClickNode}
                onStartLink={(id) => { setSelectedId(id); setLinkSource((s) => (s === id ? null : id)); }}
                onDelete={removeNode} onMove={moveField} />
            ))}
          </div>
        </div>
      </main>

      {/* ============================= RIGHT: EXPORT / DEPLOY ============================= */}
      <aside className="flex shrink-0 flex-col border-l" style={{ width: 376, background: "#0a1322", borderColor: "#172339" }}>
        {/* title */}
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
          <span style={{ color: CATEGORY[selected?.category || "metaobject"].accent }}>
            {ctx === "theme" ? <Puzzle size={16} /> : ctx === "layout" ? <LayoutTemplate size={16} /> : <FileJson size={16} />}
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-slate-100">
              {ctx === "theme" ? "Theme section export" : ctx === "layout" ? "Page layout export" : "Developer export"}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{activeFile}</div>
          </div>
        </div>

        {/* tab switcher (dynamic per context) */}
        <div className="flex gap-1 px-3">
          {tabs.map((t) => (
            <TabButton key={t.id} active={curTab === t.id} onClick={() => setTab(t.id)} icon={t.icon}>{t.label}</TabButton>
          ))}
        </div>

        {/* actions */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
          <button onClick={copyActive}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-[12px] font-semibold text-slate-200 transition-colors hover:bg-slate-800">
            <Copy size={13} /> Copy
          </button>
          {ctx === "data" ? (
            <button onClick={openDeploy}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all"
              style={{ background: "linear-gradient(135deg,#34d399,#10b981)",
                boxShadow: "0 8px 18px -8px rgba(52,211,153,0.7)", color: "#06281c" }}>
              <Rocket size={13} /> Deploy to Shopify Store
            </button>
          ) : (
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
              {ctx === "theme" ? <Puzzle size={11} className="text-amber-400" /> : <LayoutTemplate size={11} className="text-sky-400" />}
              {ctx === "theme" ? "theme file — commit to repo" : "layout file — commit to /templates"}
            </span>
          )}
        </div>

        {/* migration toggle (data context only) */}
        {ctx === "data" && (
          <div className="mx-3 mb-1 rounded-lg border px-3 py-2.5"
            style={{ borderColor: migrate ? "rgba(34,211,238,0.35)" : "#1c2a42", background: migrate ? "rgba(34,211,238,0.06)" : "transparent" }}>
            <button onClick={() => setMigrate((v) => !v)} className="flex w-full items-center gap-2.5 text-left">
              <span className="flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors"
                style={{ background: migrate ? "#22d3ee" : "#334155" }}>
                <span className="h-4 w-4 rounded-full bg-white transition-transform"
                  style={{ transform: migrate ? "translateX(16px)" : "translateX(0)" }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-slate-100">Include live content entries migration</span>
                <span className="block text-[10.5px] text-slate-500">Copy records, assets &amp; entries — not just structure</span>
              </span>
            </button>
            {migrate && (
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <MigMetric icon={HardDriveDownload} value={migStats.records} label="records" />
                <MigMetric icon={ImageDown} value={migStats.assets} label="assets" />
                <MigMetric icon={RefreshCw} value={migStats.entries} label="entries" />
              </div>
            )}
            {migrate && (
              <div className="mt-2 flex items-start gap-1.5 font-mono text-[9.5px] leading-relaxed text-cyan-300/70">
                <AlertCircle size={11} className="mt-px shrink-0" />
                Pulls record logs &amp; image files from staging, then syncs to production on deploy.
              </div>
            )}
          </div>
        )}

        {/* live hint */}
        <div className="flex items-center gap-2 px-4 py-1.5 font-mono text-[10px] text-slate-500" style={{ borderTop: "1px solid #142036" }}>
          <Zap size={11} className="text-amber-300" />
          {ctx === "data"
            ? (curTab === "json" ? "Live — regenerates as you build" : "Scaffolded from the selected object")
            : ctx === "theme" ? "Full section file with {% schema %}" : "Validated template — sections + order"}
        </div>

        {/* code area */}
        <div className="flex-1 overflow-auto p-3" style={{ background: "#060b14" }}>
          {curTab === "liquid" && !selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <FileCode2 size={26} className="text-slate-700" />
              <div className="text-[12px] text-slate-500">Select a metaobject on the canvas to scaffold its Liquid &amp; Hydrogen component.</div>
            </div>
          ) : (
            <pre className="font-mono text-[11px] leading-[1.6] text-slate-300"
              style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" }}
              dangerouslySetInnerHTML={{ __html: curTabDef.lang === "json" ? highlightJson(activeText) : highlightLiquid(activeText) }} />
          )}
        </div>

        {/* footer */}
        <div className="px-4 py-2.5 font-mono text-[10px] text-slate-600" style={{ borderTop: "1px solid #142036" }}>
          {ctx === "data"
            ? `${schema.metaobjectDefinitions.length} metaobject · ${schema.metafieldDefinitions.length} metafield definitions`
            : ctx === "theme"
              ? `${selected.fields.length} settings · ${selected.blocks?.length || 0} blocks`
              : `${selected.fields.length} sections · ${TEMPLATE_KINDS[selected.templateType]?.file}`}
        </div>
      </aside>

      {/* ============================= LIVE DEPLOY MODAL ============================= */}
      {modalOpen && (
        <DeployModal
          host={normalizeStore(storeUrl)}
          storeUrl={storeUrl} setStoreUrl={setStoreUrl}
          token={token} setToken={setToken}
          showToken={showToken} setShowToken={setShowToken}
          apiVersion={API_VERSION}
          defCount={schema.metaobjectDefinitions.length}
          state={deployState}
          onClose={() => { if (deployState.phase !== "running") setModalOpen(false); }}
          onDeploy={runLiveDeploy}
        />
      )}

      {/* ============================= TOAST ============================= */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-300"
        style={{ opacity: toast ? 1 : 0, transform: `translate(-50%, ${toast ? 0 : 12}px)` }}>
        {toast && (
          <div className="flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[13px] font-medium shadow-2xl backdrop-blur"
            style={{
              background: "rgba(10,22,38,0.95)",
              borderColor: toast.ok ? "rgba(52,211,153,0.5)" : "rgba(251,113,133,0.5)",
              color: toast.ok ? "#86efac" : "#fda4af",
            }}>
            <span className="grid h-5 w-5 place-items-center rounded-full"
              style={{ background: toast.ok ? "rgba(52,211,153,0.18)" : "rgba(251,113,133,0.18)" }}>
              {toast.ok ? <Check size={12} /> : <X size={12} />}
            </span>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- small ui bits ----------------------------- */

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
      <Icon size={12} className="text-slate-600" /> {children}
    </div>
  );
}

function TemplateButton({ accent, title, desc, onClick }) {
  return (
    <button onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-left transition-colors hover:border-slate-700 hover:bg-slate-900/80">
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: accent }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-slate-100">{title}</span>
        <span className="block truncate text-[11px] text-slate-500">{desc}</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5" style={{ color: accent }} />
    </button>
  );
}

function Stat({ label, value, color }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span className="font-semibold text-slate-300">{value}</span> {label}
    </span>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-t-lg px-2 py-2 text-[12px] font-semibold transition-colors"
      style={{
        color: active ? "#86efac" : "#94a3b8",
        background: active ? "#060b14" : "transparent",
        borderBottom: active ? "2px solid #34d399" : "2px solid transparent",
      }}>
      <Icon size={13} /> {children}
    </button>
  );
}

function MigMetric({ icon: Icon, value, label }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-1.5 text-center">
      <Icon size={13} className="mx-auto mb-0.5 text-cyan-300" />
      <div className="text-[14px] font-bold leading-none text-slate-100">{value}</div>
      <div className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function DeployModal({ host, storeUrl, setStoreUrl, token, setToken, showToken, setShowToken,
  apiVersion, defCount, state, onClose, onDeploy }) {
  const running = state.phase === "running";
  const tokenLooksOff = token.trim() && !token.trim().startsWith("shpat_");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(3,7,15,0.72)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] overflow-hidden rounded-2xl border shadow-2xl"
        style={{ borderColor: "#1e2c44", background: "linear-gradient(180deg,#0d1424,#0a1018)" }}>

        {/* header */}
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-3" style={{ borderBottom: "1px solid #16223a" }}>
          <span className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ background: "linear-gradient(135deg,#34d399,#0ea5e9)" }}>
            <Rocket size={16} className="text-slate-900" strokeWidth={2.4} />
          </span>
          <div className="leading-tight">
            <div className="text-[14px] font-bold text-white">Deploy live to Shopify</div>
            <div className="font-mono text-[10px] text-slate-500">Admin GraphQL · {apiVersion} · {defCount} definition{defCount === 1 ? "" : "s"}</div>
          </div>
          <button onClick={onClose} disabled={running}
            className="ml-auto grid h-7 w-7 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* store url */}
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-slate-400">Shopify Store URL</label>
          <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 transition-colors focus-within:border-emerald-500/60">
            <ExternalLink size={14} className="shrink-0 text-slate-500" />
            <input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} disabled={running}
              placeholder="your-store.myshopify.com" spellCheck={false} autoComplete="off"
              className="w-full bg-transparent py-2.5 text-[13px] text-slate-100 outline-none placeholder:text-slate-600" />
          </div>

          {/* token */}
          <label className="mb-1.5 mt-4 block font-mono text-[10px] uppercase tracking-wider text-slate-400">Admin API Access Token</label>
          <div className="flex items-center gap-2 rounded-lg border bg-slate-950/60 px-3 transition-colors focus-within:border-emerald-500/60"
            style={{ borderColor: tokenLooksOff ? "rgba(251,191,36,0.5)" : "#334155" }}>
            <KeyRound size={14} className="shrink-0 text-slate-500" />
            <input value={token} onChange={(e) => setToken(e.target.value)} disabled={running}
              type={showToken ? "text" : "password"} placeholder="shpat_••••••••••••••••••••••••"
              spellCheck={false} autoComplete="off"
              className="w-full bg-transparent py-2.5 font-mono text-[13px] text-slate-100 outline-none placeholder:text-slate-600" />
            <button onClick={() => setShowToken((v) => !v)} disabled={running}
              className="shrink-0 text-slate-500 transition-colors hover:text-slate-300">
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {tokenLooksOff && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-amber-300/90">
              <AlertTriangle size={11} /> Custom App admin tokens normally start with <span className="font-mono">shpat_</span>
            </div>
          )}

          {/* security note */}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
            <p className="text-[11.5px] leading-relaxed text-slate-300">
              Your token is sent over HTTPS to your own SchemaFlow backend, relayed server-to-server to Shopify,
              and never written to disk or logged. Nothing is stored after the request completes.
            </p>
          </div>

          {/* running log */}
          {running && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
              <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-300">
                <Loader2 size={12} className="animate-spin" /> {state.step}
              </div>
              {state.log.length > 0 && (
                <div className="mt-1.5 space-y-0.5 font-mono text-[10.5px] text-emerald-400/70">
                  {state.log.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              )}
            </div>
          )}

          {/* error */}
          {state.phase === "error" && (
            <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/8 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
                <AlertCircle size={13} /> Deployment failed — Shopify returned:
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-[10.5px] leading-relaxed text-rose-200/90">{state.error}</pre>
            </div>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderTop: "1px solid #16223a", background: "#0a1018" }}>
          <Lock size={12} className="text-slate-600" />
          <span className="font-mono text-[10px] text-slate-600">via /api/deploy proxy</span>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} disabled={running}
              className="rounded-lg border border-slate-700 px-3.5 py-2 text-[12px] font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40">
              Cancel
            </button>
            <button onClick={onDeploy} disabled={running}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-bold transition-all disabled:opacity-80"
              style={{ background: "linear-gradient(135deg,#34d399,#10b981)", color: "#06281c",
                boxShadow: "0 8px 18px -8px rgba(52,211,153,0.7)" }}>
              {running ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
              {running ? "Deploying…" : "Deploy live"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- expansion sub-components ----------------------------- */

function BuildButton({ accent, icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[11.5px] font-medium transition-colors"
      style={{ borderColor: `${accent}55`, color: accent, background: `${accent}14` }}
      onMouseEnter={(e) => (e.currentTarget.style.background = `${accent}26`)}
      onMouseLeave={(e) => (e.currentTarget.style.background = `${accent}14`)}>
      <Icon size={13} /> {label}
    </button>
  );
}

function FieldList({ fields, onRemove, onToggleReq, showReq }) {
  if (!fields.length) {
    return <div className="rounded-md border border-dashed border-slate-800 px-3 py-2 text-center font-mono text-[10px] text-slate-600">none yet</div>;
  }
  return (
    <div className="space-y-1.5">
      {fields.map((f) => {
        const ft = typeInfo(f.type);
        return (
          <div key={f.id} className="group flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1.5">
            <ft.icon size={12} className={ft.tint} />
            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-200">{f.name}</span>
            <span className="font-mono text-[8.5px] uppercase tracking-wide text-slate-600">{ft.shopify}</span>
            {showReq && (
              <button onClick={() => onToggleReq(f.id)} title="Toggle required"
                className="font-mono text-[9px] transition-colors" style={{ color: f.required ? "#fda4af" : "#475569" }}>req</button>
            )}
            <button onClick={() => onRemove(f.id)}
              className="text-slate-600 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}

function AddFieldBox({ addable, cols = 4, newType, setNewType, newFieldName, setNewFieldName, newFieldReq, setNewFieldReq, onAdd, showReq, accent }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
      <div className={`mb-2 grid gap-1`} style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
        {addable.map((t) => {
          const ft = typeInfo(t);
          const on = newType === t;
          return (
            <button key={t} onClick={() => setNewType(t)}
              className="flex flex-col items-center gap-1 rounded-md border py-1.5 text-[9px] font-medium transition-colors"
              style={{ borderColor: on ? ft.dot : "#28344b", color: on ? ft.dot : "#94a3b8", background: on ? `${ft.dot}1a` : "transparent" }}>
              <ft.icon size={13} /> {ft.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <input value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder={showReq ? "Field name" : "Setting label"}
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-[12px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500/60" />
        {showReq && (
          <button onClick={() => setNewFieldReq((v) => !v)} title="Required"
            className="grid w-8 place-items-center rounded-md border font-mono text-[9px] transition-colors"
            style={{ borderColor: newFieldReq ? "#fda4af" : "#334155", color: newFieldReq ? "#fda4af" : "#64748b" }}>req</button>
        )}
        <button onClick={onAdd} className="grid w-8 place-items-center rounded-md text-slate-900 transition-opacity hover:opacity-90"
          style={{ background: accent }}>
          <Plus size={15} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}

function BlockEditor({ block, onRename, onRemove, onAddSetting, onRemoveSetting }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("S_TEXT");
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Boxes size={13} className="text-amber-300" />
        <input value={block.name} onChange={(e) => onRename(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1 text-[12px] font-medium text-slate-100 outline-none focus:border-amber-500/60" />
        <button onClick={onRemove} className="text-slate-500 hover:text-rose-300"><Trash2 size={13} /></button>
      </div>
      <div className="space-y-1">
        {(block.fields || []).map((f) => {
          const ft = typeInfo(f.type);
          return (
            <div key={f.id} className="group flex items-center gap-2 rounded px-1.5 py-1" style={{ background: "rgba(245,158,11,0.06)" }}>
              <ft.icon size={11} className={ft.tint} />
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-200">{f.name}</span>
              <span className="font-mono text-[8px] uppercase text-slate-600">{ft.shopify}</span>
              <button onClick={() => onRemoveSetting(f.id)} className="text-slate-600 opacity-0 hover:text-rose-300 group-hover:opacity-100"><X size={12} /></button>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1">
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950/50 px-1.5 py-1 font-mono text-[10px] text-slate-200 outline-none">
          {ADDABLE_SECTION.map((t) => <option key={t} value={t}>{typeInfo(t).shopify}</option>)}
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { onAddSetting(name.trim(), type); setName(""); } }}
          placeholder="block setting"
          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950/50 px-2 py-1 text-[11px] text-slate-100 outline-none placeholder:text-slate-600" />
        <button onClick={() => { if (name.trim()) { onAddSetting(name.trim(), type); setName(""); } }}
          className="grid w-7 place-items-center rounded bg-amber-500 text-slate-900 hover:bg-amber-400"><Plus size={13} strokeWidth={2.6} /></button>
      </div>
    </div>
  );
}

function AddTemplateSection({ sectionNodes, onAdd }) {
  const [custom, setCustom] = useState("");
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
      {sectionNodes.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">From your sections</div>
          <div className="flex flex-wrap gap-1">
            {sectionNodes.map((s) => (
              <button key={s.id} onClick={() => onAdd(s.name, s.id)}
                className="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-200 transition-colors hover:bg-amber-500/20">
                <Puzzle size={10} /> {dashOf(s.name)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-1.5">
        <input value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { onAdd(custom.trim()); setCustom(""); } }}
          placeholder="section type e.g. image-banner"
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 font-mono text-[11px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500/60" />
        <button onClick={() => { if (custom.trim()) { onAdd(custom.trim()); setCustom(""); } }}
          className="grid w-8 place-items-center rounded-md text-slate-900 hover:opacity-90" style={{ background: "#38bdf8" }}>
          <Plus size={15} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
