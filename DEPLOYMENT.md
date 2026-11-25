# Deploying to Vercel and Render

The frontend is deployed to Vercel; the Flask API and SQLite database run on
Render. Push the project to a GitHub repository before starting.

The root `.gitignore` excludes local SQLite databases, virtual environments,
build output, and environment files. Keep it in place; do not upload local
patient records to GitHub.

## 1. Deploy the backend to Render

1. In Render, create a **Web Service** and connect the GitHub repository.
2. Set **Root Directory** to `backend`.
3. Set **Build Command** to `pip install -r requirements.txt`.
4. Set **Start Command** to `gunicorn app:app`.
5. Add a persistent disk mounted at `/var/data`. SQLite on Render's temporary
   filesystem can be erased when the service restarts or redeploys.
6. Add the environment variable `DATABASE_PATH` with value
   `/var/data/patients.db`.
7. After deploying, copy the Render service URL (for example,
   `https://your-service.onrender.com`).

Render persistent disks require a paid service plan. Do not skip the disk for
an app whose records need to survive restarts.

## 2. Deploy the frontend to Vercel

1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `frontend`; use the Vite defaults
   (`npm run build` and `dist`) if Vercel does not detect them automatically.
3. Add `VITE_API_URL` as an environment variable, using the Render URL followed
   by `/api`, e.g. `https://your-service.onrender.com/api`.
4. Deploy and copy the Vercel production URL.

## 3. Allow the Vercel site to call the API

In the Render service's environment settings, set `CORS_ALLOWED_ORIGINS` to
the exact Vercel production origin, e.g. `https://your-site.vercel.app` (no
trailing slash). For multiple allowed sites, separate origins with commas.
Save the setting and redeploy/restart the Render service.

Check `https://your-service.onrender.com/` to confirm the API responds, then
open the Vercel site and test loading and adding a record.

## Important data and privacy notes

- The local `backend/patients.db` file is not automatically copied to Render.
- This app currently has no login or access control. Do not put real patient
  information on a publicly reachable deployment until authentication,
  authorization, and applicable healthcare privacy requirements are addressed.
