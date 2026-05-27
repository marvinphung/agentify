
  # Agentify

  This is a code bundle for Agentify. The original project is available at https://www.figma.com/design/HcDZ3xLCqUGpHIGv4Z7zrp/Agentify.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Local API-backed demo

  Use the Vite dev server when testing chat, auth, KiotViet, or GHN locally:

  ```bash
  npm run dev -- --host 127.0.0.1 --port 5173
  ```

  `vite.config.ts` proxies `/api` and `/health` to `VITE_PROXY_API_TARGET`.

  Do not use `serve dist -l 5173` for local API smoke unless the app was built with `VITE_API_BASE_URL` pointing at a backend, because static serve does not apply Vite proxy or Vercel rewrites.
  
