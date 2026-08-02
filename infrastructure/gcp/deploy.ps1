param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$GoogleClientId,
  [Parameter(Mandatory = $true)][string]$DatabasePassword,
  [string]$Region = 'us-east1'
)

$ErrorActionPreference = 'Stop'
$Service = 'scuttlebutt'
$Repository = 'scuttlebutt'
$SqlInstance = 'scuttlebutt-postgres'

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories describe $Repository --location $Region 2>$null
if ($LASTEXITCODE -ne 0) { gcloud artifacts repositories create $Repository --repository-format docker --location $Region }
gcloud sql instances describe $SqlInstance 2>$null
if ($LASTEXITCODE -ne 0) { gcloud sql instances create $SqlInstance --database-version POSTGRES_17 --cpu 1 --memory 3840MiB --region $Region }
gcloud sql databases describe scuttlebutt --instance $SqlInstance 2>$null
if ($LASTEXITCODE -ne 0) { gcloud sql databases create scuttlebutt --instance $SqlInstance }
gcloud sql users set-password postgres --instance $SqlInstance --password $DatabasePassword

$ConnectionName = gcloud sql instances describe $SqlInstance --format='value(connectionName)'
$DatabaseUrl = "postgresql://postgres:$DatabasePassword@localhost/scuttlebutt?host=/cloudsql/$ConnectionName"
gcloud builds submit --config infrastructure/gcp/cloudbuild.yaml --substitutions "_REGION=$Region,_SERVICE=$Service,_REPOSITORY=$Repository"
$Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/app:latest"
gcloud run deploy $Service --image $Image --region $Region --allow-unauthenticated --add-cloudsql-instances $ConnectionName --set-env-vars "NODE_ENV=production,API_HOST=0.0.0.0,WEB_ORIGIN=https://placeholder.invalid,GOOGLE_CLIENT_ID=$GoogleClientId,DATABASE_URL=$DatabaseUrl"
