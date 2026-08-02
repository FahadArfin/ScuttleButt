param(
  [string]$ProjectId = 'scuttlebutt-504320',
  [Parameter(Mandatory = $true)][string]$GoogleClientId,
  [Parameter(Mandatory = $true)][string]$DatabasePassword,
  [string]$Region = 'us-east1',
  [ValidateSet('test', 'standard')][string]$DeploymentSize = 'test'
)

$ErrorActionPreference = 'Stop'
$GcloudCommand = (Get-Command gcloud.cmd -ErrorAction Stop).Source

function Invoke-Gcloud {
  & $GcloudCommand @args
  if ($LASTEXITCODE -ne 0) {
    throw "Google Cloud CLI command failed with exit code $LASTEXITCODE."
  }
}

Set-Alias -Name gcloud -Value Invoke-Gcloud -Scope Script

function Test-GcloudResource {
  param([string[]]$Arguments)

  $ErrorActionPreference = 'SilentlyContinue'
  & $GcloudCommand @Arguments *> $null
  return $LASTEXITCODE -eq 0
}

$Service = 'scuttlebutt'
$Repository = 'scuttlebutt'
$SqlInstance = 'scuttlebutt-postgres'
$DatabaseSecret = 'scuttlebutt-database-url'

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com
if (-not (Test-GcloudResource @('artifacts', 'repositories', 'describe', $Repository, '--location', $Region))) {
  gcloud artifacts repositories create $Repository --repository-format docker --location $Region
}
if (-not (Test-GcloudResource @('sql', 'instances', 'describe', $SqlInstance))) {
  if ($DeploymentSize -eq 'test') {
    gcloud sql instances create $SqlInstance --database-version POSTGRES_17 --edition ENTERPRISE --tier db-f1-micro --storage-size 10 --region $Region --availability-type zonal --no-backup
  } else {
    gcloud sql instances create $SqlInstance --database-version POSTGRES_17 --edition ENTERPRISE --cpu 1 --memory 3840MiB --storage-size 20 --region $Region --availability-type zonal
  }
}
if (-not (Test-GcloudResource @('sql', 'databases', 'describe', 'scuttlebutt', '--instance', $SqlInstance))) {
  gcloud sql databases create scuttlebutt --instance $SqlInstance
}
gcloud sql users set-password postgres --instance $SqlInstance --password $DatabasePassword

$ConnectionName = gcloud sql instances describe $SqlInstance --format='value(connectionName)'
$DatabaseUrl = "postgresql://postgres:$DatabasePassword@localhost/scuttlebutt?host=/cloudsql/$ConnectionName"
$SecretFile = New-TemporaryFile
try {
  [System.IO.File]::WriteAllText($SecretFile.FullName, $DatabaseUrl)
  if (-not (Test-GcloudResource @('secrets', 'describe', $DatabaseSecret))) {
    gcloud secrets create $DatabaseSecret --replication-policy automatic --data-file $SecretFile.FullName
  } else {
    gcloud secrets versions add $DatabaseSecret --data-file $SecretFile.FullName
  }
} finally {
  Remove-Item -LiteralPath $SecretFile.FullName -Force
}

$ProjectNumber = gcloud projects describe $ProjectId --format='value(projectNumber)'
$RuntimeServiceAccount = "$ProjectNumber-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$RuntimeServiceAccount" --role roles/cloudbuild.builds.builder --quiet | Out-Null
gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$RuntimeServiceAccount" --role roles/cloudsql.client --quiet | Out-Null
gcloud secrets add-iam-policy-binding $DatabaseSecret --member "serviceAccount:$RuntimeServiceAccount" --role roles/secretmanager.secretAccessor --quiet | Out-Null

gcloud builds submit --config infrastructure/gcp/cloudbuild.yaml --substitutions "_REGION=$Region,_REPOSITORY=$Repository"
$Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/app:latest"
gcloud run deploy $Service --image $Image --region $Region --allow-unauthenticated --add-cloudsql-instances $ConnectionName --set-env-vars "NODE_ENV=production,API_HOST=0.0.0.0,WEB_ORIGIN=https://placeholder.invalid,GOOGLE_CLIENT_ID=$GoogleClientId" --set-secrets "DATABASE_URL=$DatabaseSecret`:latest"
$ServiceUrl = gcloud run services describe $Service --region $Region --format='value(status.url)'
gcloud run services update $Service --region $Region --update-env-vars "WEB_ORIGIN=$ServiceUrl"
Write-Output "Scuttlebutt deployed to $ServiceUrl"
