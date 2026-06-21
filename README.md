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
Admin API access scopes. Enable:
- `write_metaobject_definitions` + `read_metaobject_definitions` — for metaobjects.
- `write_themes` — for deploying sections & page templates (theme files).

Install the app, then copy the `shpat_…` Admin API token into the deploy modal
(or set it as the `SHOPIFY_ADMIN_TOKEN` env var).

> Theme files (sections / templates) are written to your **published theme** via the
> `themeFilesUpsert` mutation, which additionally requires a Shopify-granted
> theme-files **exemption**. Until that's approved, metaobjects still deploy fine and
> theme files return a clear access error in the modal.

> Metaobject references validate against a definition **GID**, so create base
> definitions first, then the ones that point at them.
