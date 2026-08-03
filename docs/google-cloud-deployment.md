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

The Google Cloud project is `scuttlebutt-504320`. Confirm billing is attached, then run the deployment helper from the repository root:

```powershell
gcloud config set project scuttlebutt-504320
.\infrastructure\gcp\deploy.ps1 -GoogleClientId YOUR_CLIENT_ID -DatabasePassword A_LONG_RANDOM_PASSWORD -DeploymentSize test
```

`test` uses the smallest shared-core Cloud SQL tier and is not covered by the Cloud SQL SLA. Use `standard` for the larger instance. The script stores the database URL in Secret Manager, deploys the service, and updates `WEB_ORIGIN` to the resulting Cloud Run URL.

Current test deployment: <https://scuttlebutt-d5v23kpsfa-ue.a.run.app>

## Continuous deployment

`.github/workflows/deploy-cloud-run.yml` builds and deploys the existing Cloud Run service whenever the `development` branch is pushed to GitHub. It authenticates with a repository-restricted Workload Identity Federation provider instead of a long-lived service-account key, preserves the service's database and environment configuration, and verifies `/health` after deployment.

The workflow requires these GitHub repository secrets:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_SERVICE_ACCOUNT`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `VITE_GIPHY_API_KEY` (optional; enables GIF and sticker search in the picker)

A local commit does not trigger GitHub Actions until it is pushed to `origin/development`.

The GIPHY key is embedded in the browser bundle when enabled, so treat it as a restricted client
key and configure its domain/rate limits in GIPHY. If it is omitted, Unicode and server emoji still
work and GIF/sticker tabs show a setup message instead of failing.

After the first deployment, copy the Cloud Run URL into the OAuth client's authorized JavaScript origins. The deployed service already uses that exact HTTPS origin for CORS.

## Voice production boundary

Use `infrastructure/livekit` on a Compute Engine VM with a static IP and DNS. Open TCP 7880, TCP 7881, UDP 7882, UDP 3478, and the configured UDP media ranges. Replace every development key and TURN secret before exposing it publicly. For 4K screen share, let LiveKit simulcast/adaptive-stream settings choose the effective quality; clients and bandwidth ultimately determine whether 4K is sustainable.
