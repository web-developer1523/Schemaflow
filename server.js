// server.js — SchemaFlow backend proxy
// Receives { storeUrl, adminApiToken, jsonSchema } from the frontend and runs the
// real metaobjectDefinitionCreate mutations server-to-server (no browser CORS).
// Also serves the built Vite frontend (dist/) so Render runs as a single web service.

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 3000;                 // Render injects PORT
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-04";

app.use(cors());                                       // same-origin in prod; handy in dev
app.use(express.json({ limit: "2mb" }));

const META_MUTATION = `mutation SchemaFlowCreate($definition: MetaobjectDefinitionCreateInput!) {
  metaobjectDefinitionCreate(definition: $definition) {
    metaobjectDefinition { id type name }
    userErrors { field message code }
  }
}`;

const THEMES_QUERY = `query SchemaFlowThemes { themes(first: 50) { nodes { id name role } } }`;

const THEME_FILES_MUTATION = `mutation SchemaFlowThemeFiles($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $themeId, files: $files) {
    upsertedThemeFiles { filename }
    userErrors { field message }
  }
}`;

const THEME_FILES_EXIST_QUERY = `query SchemaFlowThemeFilesExist($id: ID!, $names: [String!]) {
  theme(id: $id) { files(filenames: $names, first: 50) { nodes { filename } } }
}`;

const normalizeStore = (raw = "") =>
  String(raw).trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").replace(/\s+/g, "");

// A minimal but valid section file so a template referencing it can validate.
const stubSection = (type) => {
  const title = type.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 24) || "Section";
  return `{%- comment -%} sections/${type}.liquid — auto-created by SchemaFlow {%- endcomment -%}
<div class="${type}" {{ section.shopify_attributes }}></div>

{% schema %}
{
  "name": ${JSON.stringify(title)},
  "settings": [],
  "presets": [{ "name": ${JSON.stringify(title)} }]
}
{% endschema %}
`;
};

// One place to POST GraphQL and normalize HTTP / GraphQL-level errors.
async function shopifyGraphQL(endpoint, token, query, variables) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Shopify HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 400)}` : ""}`);
    err.status = res.status === 401 || res.status === 403 ? res.status : 502;
    throw err;
  }
  const data = await res.json();
  if (Array.isArray(data.errors) && data.errors.length) {
    const err = new Error(data.errors.map((e) => e.message).join(" · "));
    err.status = 502;
    throw err;
  }
  return data.data;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, apiVersion: API_VERSION }));

app.post("/api/deploy", async (req, res) => {
  try {
    const { storeUrl, adminApiToken, jsonSchema, themeFiles } = req.body || {};

    // Token may come from the request OR a server-side env var (keeps it out of the browser).
    const token = (adminApiToken && String(adminApiToken).trim()) || process.env.SHOPIFY_ADMIN_TOKEN;
    const host = normalizeStore(storeUrl);

    const defs = Array.isArray(jsonSchema) ? jsonSchema : [];
    const files = Array.isArray(themeFiles) ? themeFiles : [];

    if (!host) return res.status(400).json({ ok: false, error: "Missing storeUrl (your-store.myshopify.com)." });
    if (!token) return res.status(400).json({ ok: false, error: "Missing Admin API access token." });
    if (defs.length === 0 && files.length === 0)
      return res.status(400).json({ ok: false, error: "Nothing to deploy — send at least one metaobject definition or theme file." });

    const endpoint = `https://${host}/admin/api/${API_VERSION}/graphql.json`;
    const results = [];

    // ---- 1) Metaobject definitions (Admin GraphQL) ----
    for (const definition of defs) {
      const data = await shopifyGraphQL(endpoint, token, META_MUTATION, { definition });
      const payload = data?.metaobjectDefinitionCreate;
      const userErrors = payload?.userErrors || [];
      if (userErrors.length) {
        return res.status(422).json({
          ok: false,
          error: `${definition.name}: ${userErrors
            .map((e) => `${e.message}${e.field ? ` (${Array.isArray(e.field) ? e.field.join(".") : e.field})` : ""}`)
            .join(" · ")}`,
          results,
        });
      }
      results.push({
        kind: "metaobject",
        name: payload?.metaobjectDefinition?.name || definition.name,
        id: payload?.metaobjectDefinition?.id || "created",
      });
    }

    // ---- 2) Theme files: sections + templates (themeFilesUpsert) ----
    if (files.length) {
      // Resolve the published (MAIN) theme to write into.
      const themesData = await shopifyGraphQL(endpoint, token, THEMES_QUERY, {});
      const nodes = themesData?.themes?.nodes || [];
      const main = nodes.find((t) => t.role === "MAIN") || nodes[0];
      if (!main) {
        return res.status(404).json({ ok: false, error: "No theme found on this store to write into.", results });
      }

      // Collect every section type referenced by the template files in this batch.
      const referenced = new Set();
      for (const f of files) {
        if (/^templates\/.+\.json$/.test(f.filename)) {
          try {
            const tpl = JSON.parse(String(f.value || "{}"));
            Object.values(tpl.sections || {}).forEach((s) => { if (s && s.type) referenced.add(s.type); });
          } catch { /* ignore unparseable template */ }
        }
      }

      // Section files we're already deploying don't need a stub.
      const deploying = new Set(files.filter((f) => f.filename.startsWith("sections/")).map((f) => f.filename));
      const candidates = [...referenced]
        .map((t) => `sections/${t}.liquid`)
        .filter((fn) => !deploying.has(fn));

      // Of the remaining, only stub the ones that DON'T already exist in the theme
      // (so we never overwrite the theme's built-in sections like main-product).
      let stubFiles = [];
      if (candidates.length) {
        const existData = await shopifyGraphQL(endpoint, token, THEME_FILES_EXIST_QUERY, {
          id: main.id, names: candidates.slice(0, 50),
        });
        const existing = new Set((existData?.theme?.files?.nodes || []).map((n) => n.filename));
        stubFiles = candidates
          .filter((fn) => !existing.has(fn))
          .map((fn) => ({ filename: fn, value: stubSection(fn.slice("sections/".length, -".liquid".length)), _stub: true }));
      }

      const allFiles = [...files, ...stubFiles];
      const data = await shopifyGraphQL(endpoint, token, THEME_FILES_MUTATION, {
        themeId: main.id,
        files: allFiles.map((f) => ({ filename: f.filename, body: { type: "TEXT", value: String(f.value ?? "") } })),
      });
      const payload = data?.themeFilesUpsert;
      const userErrors = payload?.userErrors || [];
      if (userErrors.length) {
        return res.status(422).json({
          ok: false,
          error: `Theme files (${main.name}): ${userErrors.map((e) => `${e.message}${e.field ? ` (${e.field})` : ""}`).join(" · ")}`,
          results,
        });
      }
      const stubSet = new Set(stubFiles.map((f) => f.filename));
      for (const f of payload?.upsertedThemeFiles || []) {
        results.push({ kind: "theme", name: stubSet.has(f.filename) ? `${f.filename} (auto-created)` : f.filename, id: `${main.name} (theme)` });
      }
    }

    return res.json({ ok: true, store: host, apiVersion: API_VERSION, results });
  } catch (err) {
    return res.status(err?.status || 500).json({ ok: false, error: err?.message || "Unexpected server error." });
  }
});

// ---- Serve the built frontend (production) ----
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));

// SPA fallback — anything that isn't /api/* returns index.html
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`SchemaFlow server listening on :${PORT} (Shopify Admin API ${API_VERSION})`);
});
