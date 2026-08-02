# Google Cloud deployment

Scuttlebutt ships as one Cloud Run web/API container backed by Cloud SQL for PostgreSQL. LiveKit and coturn remain separate because real-time voice and screen sharing require UDP ports that Cloud Run does not expose; deploy them on a small Compute Engine VM or use LiveKit Cloud.

## Prerequisites

1. Install and authenticate the Google Cloud CLI with `gcloud auth login` and `gcloud auth application-default login`.
2. Choose a globally unique project ID and attach a billing account.
3. In Google Cloud Console, configure the OAuth consent screen and create a **Web application** OAuth client.
4. Add `http://localhost:5173`, `http://localhost:8080`, and the final Cloud Run URL as authorized JavaScript origins.
5. Never commit the OAuth client secret. Google Identity Services only needs the client ID in this app; ID tokens are verified by the API.

## Local production stack

Copy `.env.example` to `.env`, set `GOOGLE_CLIENT_ID`, then run:

```powershell
docker compose up --build
```

The containerized app is served on port 8080, PostgreSQL on 5433, and LiveKit on 7880.

## Google Cloud

Create and select a project, attach billing, then run the deployment helper from the repository root:

```powershell
gcloud projects create YOUR_UNIQUE_PROJECT_ID --name Scuttlebutt
gcloud billing projects link YOUR_UNIQUE_PROJECT_ID --billing-account YOUR_BILLING_ACCOUNT_ID
.\infrastructure\gcp\deploy.ps1 -ProjectId YOUR_UNIQUE_PROJECT_ID -GoogleClientId YOUR_CLIENT_ID -DatabasePassword A_LONG_RANDOM_PASSWORD
```

After the first deployment, copy the Cloud Run URL into the OAuth client's authorized JavaScript origins and redeploy with `WEB_ORIGIN` set to that exact HTTPS origin.

## Voice production boundary

Use `infrastructure/livekit` on a Compute Engine VM with a static IP and DNS. Open TCP 7880, TCP 7881, UDP 7882, UDP 3478, and the configured UDP media ranges. Replace every development key and TURN secret before exposing it publicly. For 4K screen share, let LiveKit simulcast/adaptive-stream settings choose the effective quality; clients and bandwidth ultimately determine whether 4K is sustainable.
