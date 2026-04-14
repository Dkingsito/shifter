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
```

The user uses WinSCP to sync deploy/ → AMP instance root (/).
Never skip this step after making code changes.
