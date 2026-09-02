#!/usr/bin/env bash
# Provisionne une nouvelle instance Coolify de education-next.
#
#   scripts/provision-instance.sh <slug> [nom-affiche]
#
# Cree : base Postgres <slug> sur l'instance partagee, bucket MinIO
# education-next-<slug>, application Coolify education-<slug> sur
# <slug>.msadawaheri.fr. L'app herite de la GitHub App mkldevops et de
# is_auto_deploy_enabled, donc un push sur main la redeploie sans webhook
# supplementaire.
#
# Prerequis : docker, mc (alias edu-minio), curl, python3, .env avec
# COOLIFY_URL / COOLIFY_TOKEN / DATABASE_URL_PROD.

set -euo pipefail

SLUG="${1:?usage: provision-instance.sh <slug> [nom-affiche]}"

# Le slug devient un identifiant SQL, un label DNS, un nom de bucket et un nom
# d'application : le valider ici evite d'echouer a mi-parcours, une fois la base
# creee mais pas le reste.
if ! [[ "$SLUG" =~ ^[a-z][a-z0-9-]{1,30}[a-z0-9]$ ]]; then
  echo "slug invalide : minuscules, chiffres et tirets, 3 a 32 caracteres" >&2
  exit 1
fi

DISPLAY_NAME="${2:-$SLUG}"
DOMAIN="${SLUG}.msadawaheri.fr"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SOURCE_APP="ckgow4kgscw4s8404008wskk"
PROJECT_UUID="hc8ss0k8w4oo8gwc4wkwg884"
SERVER_UUID="p8k48gwgosco4c0oogwoog80"
DESTINATION_UUID="q0ks00co0ckkc8c40k8cww8o"
GITHUB_APP_UUID="z40csogc4kgwccokskccw8ws"
MINIO_ALIAS="edu-minio"

set -a
# shellcheck disable=SC1091
source .env
set +a

api() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "${COOLIFY_URL}${path}" \
      -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
      -H 'Content-Type: application/json' -d "$body"
  else
    curl -sS -X "$method" "${COOLIFY_URL}${path}" \
      -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
      -H 'Content-Type: application/json'
  fi
}

echo "==> base Postgres '${SLUG}'"
python3 - "$SLUG" <<'PY'
import os, subprocess, sys, urllib.parse as up

slug = sys.argv[1]
u = up.urlparse(os.environ['DATABASE_URL_PROD'])
env = dict(os.environ, PGPASSWORD=up.unquote(u.password))
r = subprocess.run(
    ['docker', 'run', '--rm', '-e', 'PGPASSWORD', 'postgres:18-alpine', 'psql',
     '-h', u.hostname, '-p', str(u.port), '-U', u.username, '-d', 'postgres',
     '-tAc', f'CREATE DATABASE "{slug}" OWNER {u.username}'],
    env=env, capture_output=True, text=True)
if r.returncode and 'already exists' not in r.stderr:
    sys.exit(r.stderr.strip())
print('   ', r.stdout.strip() or 'deja presente')
PY

echo "==> bucket MinIO 'education-next-${SLUG}'"
mc mb --ignore-existing "${MINIO_ALIAS}/education-next-${SLUG}"

echo "==> application Coolify 'education-${SLUG}'"
APP_UUID=$(api POST /applications/private-github-app "$(cat <<JSON
{
  "project_uuid": "${PROJECT_UUID}",
  "server_uuid": "${SERVER_UUID}",
  "destination_uuid": "${DESTINATION_UUID}",
  "environment_name": "production",
  "github_app_uuid": "${GITHUB_APP_UUID}",
  "git_repository": "mkldevops/education-next",
  "git_branch": "main",
  "build_pack": "dockerfile",
  "dockerfile_location": "/Dockerfile",
  "base_directory": "/",
  "ports_exposes": "3000",
  "domains": "https://${DOMAIN}",
  "name": "education-${SLUG}",
  "description": "Instance ${DISPLAY_NAME}",
  "health_check_enabled": true,
  "health_check_path": "/",
  "post_deployment_command": "pnpm exec prisma migrate deploy",
  "instant_deploy": false
}
JSON
)" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("uuid") or sys.exit(str(d)))')
echo "    uuid ${APP_UUID}"

echo "==> variables d'environnement"
COOLIFY_URL="$COOLIFY_URL" COOLIFY_TOKEN="$COOLIFY_TOKEN" \
python3 - "$SOURCE_APP" "$APP_UUID" "$SLUG" "$DISPLAY_NAME" "$DOMAIN" <<'PY'
import json, os, secrets, sys, urllib.parse as up, urllib.request

source_app, app_uuid, slug, display_name, domain = sys.argv[1:6]
base = os.environ['COOLIFY_URL'].rstrip('/')
token = os.environ['COOLIFY_TOKEN']


def api(method, path, payload=None):
    req = urllib.request.Request(f'{base}{path}', method=method, headers={
        'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    if payload:
        req.data = json.dumps(payload).encode()
    return json.loads(urllib.request.urlopen(req).read().decode())


src = {e['key']: e['value'] for e in api('GET', f'/applications/{source_app}/envs')}
db = up.urlparse(src['DATABASE_URL'])

copied = ['ADMIN_EMAIL', 'EMAIL_FROM', 'EMAIL_PROVIDER', 'GOOGLE_CLIENT_ID',
          'GOOGLE_CLIENT_SECRET', 'RESEND_API_KEY', 'S3_ACCESS_KEY',
          'S3_SECRET_KEY', 'S3_ENDPOINT', 'S3_REGION']

envs = {k: src[k] for k in copied if k in src}
envs.update({
    'DATABASE_URL': db._replace(path=f'/{slug}').geturl(),
    'S3_BUCKET': f'education-next-{slug}',
    'BETTER_AUTH_SECRET': secrets.token_hex(32),
    'BETTER_AUTH_URL': f'https://{domain}',
    'NEXT_PUBLIC_APP_URL': f'https://{domain}',
    'NEXT_PUBLIC_APP_DOMAIN': domain,
    'NEXT_PUBLIC_APP_NAME': display_name,
})

for key, value in sorted(envs.items()):
    api('POST', f'/applications/{app_uuid}/envs',
        {'key': key, 'value': value, 'is_preview': False})
    print('   ', key)
PY

echo "==> deploiement initial"
api POST "/deploy?uuid=${APP_UUID}&force=false"
echo
echo "OK — https://${DOMAIN} (verifier le DNS A vers le serveur Coolify)"
