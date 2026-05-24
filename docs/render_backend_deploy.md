# Deploy Backend Agentify Len Render Free

Muc tieu: dua FastAPI backend len Render de Zalo OAuth co callback public HTTPS, khong can dung port 80/443 tren VPS.

URL chinh:

- Frontend: `https://agentify-olive.vercel.app`
- Backend: `https://api.agentify.io.vn`

## Phase 1: Chuan Bi

1. Push code moi len GitHub.
2. Vao Render Dashboard.
3. Chon **New** -> **Blueprint**.
4. Chon repository `agentify`.
5. Render se doc file `render.yaml` o root repo.

Render se tao:

- Web Service: `agentify-api`

Database dang dung PostgreSQL tren VPS:

```env
DATABASE_URL=postgresql+psycopg://agentify:agentify@131.153.239.187:5441/agentify
```

## Phase 2: Dien Bien Moi Truong Tren Render

Khi Render hoi secret/env co `sync: false`, dien:

```env
ZALO_APP_ID=<ID ung dung Zalo cua ban>
ZALO_APP_SECRET=<Khoa bi mat Zalo cua ban>
```

Neu muon dung LLM that, sau khi deploy xong vao **Environment** cua service `agentify-api` va them:

```env
LLM_API_KEY=<OpenRouter/OpenAI key>
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openrouter/owl-alpha
```

`DATABASE_URL` da duoc dien san trong `render.yaml` de ket noi PostgreSQL tren VPS `131.153.239.187:5441`.

Neu Render deploy loi ket noi database, kiem tra tren VPS:

1. Docker Postgres dang publish port `5441`.
2. Firewall VPS cho phep inbound TCP `5441`.
3. PostgreSQL container/user/password dung:

```env
POSTGRES_USER=agentify
POSTGRES_PASSWORD=agentify
POSTGRES_DB=agentify
```

Voi demo co the dung password nay. Neu public lau hon, nen doi password manh hon.

## Phase 3: Lay Backend URL

Sau khi deploy xong, Render se cap URL dang:

```text
https://agentify-api.onrender.com
```

Kiem tra:

```bash
curl https://agentify-api.onrender.com/health
```

Ket qua dung:

```json
{"status":"ok"}
```

## Phase 4: Cau Hinh Frontend Vercel

Trong Vercel project frontend, vao **Settings** -> **Environment Variables**, them:

```env
VITE_API_BASE_URL=https://api.agentify.io.vn
```

Sau khi ban add custom domain `api.agentify.io.vn` tren Render va DNS da active, redeploy frontend.

Repo da doi `frontend/vercel.json` de fallback `/api` proxy ve:

```text
https://api.agentify.io.vn
```

Nhung van nen set `VITE_API_BASE_URL` tren Vercel de URL backend ro rang va de doi sang custom domain de hon.

Neu chua kip add custom domain backend tren Render, co the tam thoi dung URL Render:

```env
VITE_API_BASE_URL=https://agentify-api.onrender.com
```

## Phase 5: Cau Hinh Zalo Developer

Trong Zalo Developer app:

1. Vao **Cai dat**.
2. O **Mien ung dung**, them domain backend:

```text
api.agentify.io.vn
```

3. Neu frontend da dung domain that, them:

```text
agentify-olive.vercel.app
```

Neu sau nay frontend chay tren domain mua, them ca:

```text
agentify.io.vn
www.agentify.io.vn
```

4. Neu Zalo co muc OAuth callback/redirect rieng, dien full callback:

```text
https://api.agentify.io.vn/api/channels/zalo/connect/callback
```

Neu chua add custom domain va muon test nhanh bang URL Render:

```text
https://agentify-api.onrender.com/api/channels/zalo/connect/callback
```

## Phase 6: Neu Muon Dung `api.agentify.io.vn`

Trong Render service `agentify-api`:

1. Vao **Settings** -> **Custom Domains**.
2. Add:

```text
api.agentify.io.vn
```

3. Render se hien DNS target. Vao DNS cua `agentify.io.vn` va them record Render yeu cau, thuong la CNAME:

```text
CNAME api <render-target>
```

4. File `render.yaml` da set san env backend:

```env
PUBLIC_BACKEND_URL=https://api.agentify.io.vn
```

5. Doi env frontend tren Vercel:

```env
VITE_API_BASE_URL=https://api.agentify.io.vn
```

6. Trong Zalo Developer, doi callback thanh:

```text
https://api.agentify.io.vn/api/channels/zalo/connect/callback
```

## Phase 7: Smoke Test Demo

1. Mo frontend:

```text
https://agentify-olive.vercel.app
```

2. Bam **Ket noi Zalo OA bang OAuth**.
3. Sau khi OAuth quay ve frontend voi `zalo_connected=1`, tiep tuc connect KiotViet.
4. Test chat qua Zalo/demo message.
5. Khi agent tao du thong tin don hang, response phai co event gui hoa don:

```text
Da gui hoa don cho khach
```

## Luu Y Free Tier

- Render Free Web Service se sleep sau mot luc khong co traffic, request dau tien co the cham.
- Truoc khi demo, mo:

```text
https://api.agentify.io.vn/health
```

de warm service truoc 1-2 phut.
- Render Free Postgres co gioi han free tier. Khong nen dung lam production data lau dai.
