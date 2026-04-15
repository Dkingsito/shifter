## Approach
- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- User instructions always override this file.

## Deploy folder — OBLIGATORIO
After every change to any source file, always sync the deploy/ folder by copying the modified files:

```bash
cp src/App.jsx      deploy/src/App.jsx
cp src/index.css    deploy/src/index.css
cp src/main.jsx     deploy/src/main.jsx
cp index.html       deploy/index.html
cp package.json     deploy/package.json
cp vite.config.js   deploy/vite.config.js
cp tailwind.config.js deploy/tailwind.config.js
cp postcss.config.js  deploy/postcss.config.js
cp index.js         deploy/index.js
cp sync-api.js      deploy/sync-api.js
```

The user uses WinSCP to sync deploy/ → AMP instance root (/).
Never skip this step after making code changes.

## Sync API — .env en el servidor
El fichero `.env` NO se copia con el script anterior (está en .gitignore).
Debe existir manualmente en el servidor AMP con las credenciales de MariaDB:
```
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=...
DB_PASS=...
DB_NAME=shifter_sync
```
Ver `.env.example` como plantilla.
