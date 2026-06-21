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
app.use(express.json({ limit: "1mb" }));

const MUTATION = `mutation SchemaFlowCreate($definition: MetaobjectDefinitionCreateInput!) {
  metaobjectDefinitionCreate(definition: $definition) {
    metaobjectDefinition { id type name }
    userErrors { field message code }
  }
}`;

const normalizeStore = (raw = "") =>
  String(raw).trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").replace(/\s+/g, "");

app.get("/api/health", (_req, res) => res.json({ ok: true, apiVersion: API_VERSION }));

app.post("/api/deploy", async (req, res) => {
  try {
    const { storeUrl, adminApiToken, jsonSchema } = req.body || {};

    // Token may come from the request OR a server-side env var (keeps it out of the browser).
    const token = (adminApiToken && String(adminApiToken).trim()) || process.env.SHOPIFY_ADMIN_TOKEN;
    const host = normalizeStore(storeUrl);

    if (!host) return res.status(400).json({ ok: false, error: "Missing storeUrl (your-store.myshopify.com)." });
    if (!token) return res.status(400).json({ ok: false, error: "Missing Admin API access token." });
    if (!Array.isArray(jsonSchema) || jsonSchema.length === 0)
      return res.status(400).json({ ok: false, error: "jsonSchema must be a non-empty array of metaobject definitions." });

    const endpoint = `https://${host}/admin/api/${API_VERSION}/graphql.json`;
    const results = [];

    for (const definition of jsonSchema) {
      const shopifyRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query: MUTATION, variables: { definition } }),
      });

      // Surface non-2xx (bad token => 401, wrong domain => 404, throttling => 429, etc.)
      if (!shopifyRes.ok) {
        const text = await shopifyRes.text().catch(() => "");
        return res.status(502).json({
          ok: false,
          error: `Shopify HTTP ${shopifyRes.status} ${shopifyRes.statusText}${text ? ` — ${text.slice(0, 400)}` : ""}`,
          results,
        });
      }

      const data = await shopifyRes.json();

      // Top-level GraphQL errors (e.g. invalid query, access scope missing)
      if (Array.isArray(data.errors) && data.errors.length) {
        return res.status(502).json({
          ok: false,
          error: data.errors.map((e) => e.message).join(" · "),
          results,
        });
      }

      const payload = data.data?.metaobjectDefinitionCreate;
      const userErrors = payload?.userErrors || [];

      // Validation errors (e.g. duplicate type, reference needs a definition GID)
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
        name: payload?.metaobjectDefinition?.name || definition.name,
        type: payload?.metaobjectDefinition?.type || definition.type,
        id: payload?.metaobjectDefinition?.id || "created",
      });
    }

    return res.json({ ok: true, store: host, apiVersion: API_VERSION, results });
  } catch (err) {
    // Network/DNS failures from the server to Shopify land here.
    return res.status(500).json({ ok: false, error: err?.message || "Unexpected server error." });
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
