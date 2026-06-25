#!/usr/bin/env bash
# Deploy da Plataforma de Auditoria da Base de Pontos — Grupo Arqueo
# Uso na VPS:  cd /root/auditoria_base_pontos && ./deploy.sh
# (na 1ª vez:  chmod +x deploy.sh)
set -euo pipefail

APP_NAME="auditoria-pontos"   # nome do processo no pm2
PORT="${PORT:-3007}"          # porta (sobrescreva com: PORT=3009 ./deploy.sh)

cd "$(dirname "$0")"
echo "==> [1/5] Atualizando código (git pull)"
git pull --ff-only

echo "==> [2/5] Instalando dependências"
pnpm install --frozen-lockfile || pnpm install

echo "==> [3/5] Build de produção"
pnpm build

echo "==> [4/5] (Re)iniciando no pm2 — porta $PORT"
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  PORT="$PORT" pm2 restart "$APP_NAME" --update-env
else
  PORT="$PORT" pm2 start pnpm --name "$APP_NAME" -- start
fi
pm2 save

echo "==> [5/5] Status"
pm2 describe "$APP_NAME" | grep -E "status|script path|exec cwd" || true
echo ""
echo "OK! App no ar em http://localhost:$PORT  ->  https://auditoria.arqueotech.com.br"
echo "Logs:  pm2 logs $APP_NAME --lines 30"
