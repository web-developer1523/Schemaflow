# SchemaFlow — Shopify Metaobject Schema & Blueprint Suite

Full-stack Vite + Express app. The React frontend builds Shopify metaobject /
metafield schemas, theme section `{% schema %}` files, and page-layout templates.
The Express backend proxies the real `metaobjectDefinitionCreate` mutation to
Shopify's Admin GraphQL API, so the "Deploy to Shopify Store" button works without
hitting the browser CORS wall.

## Architecture
- `src/App.jsx` — the SchemaFlow UI. Deploy posts to `/api/deploy` (same origin).
- `server.js` — Express. `POST /api/deploy` relays server-to-server to Shopify and
  serves the built `dist/` in production.
- Dev: Vite (5173) proxies `/api/*` to Express (3000). Prod: Express serves both.

## Local development
```bash
npm install
cp .env.example .env      # optional: set SHOPIFY_ADMIN_TOKEN to keep it off the browser
npm run dev               # runs Vite + Express together
# open http://localhost:5173
```

## Deploy to Render
1. Push this folder to GitHub.
2. Render → New → Web Service → pick the repo (or use the included `render.yaml`).
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. (Optional) add env var `SHOPIFY_ADMIN_TOKEN` in the dashboard.

## Shopify setup
In your store: Settings → Apps and sales channels → Develop apps → create an app →
Admin API access scopes: enable `write_metaobject_definitions` (and
`read_metaobject_definitions`). Install it, then copy the `shpat_…` Admin API token
into the deploy modal (or the env var).

> Note: references between metaobjects validate against a definition **GID**, so
> create the base definitions first, then the ones that point at them.
