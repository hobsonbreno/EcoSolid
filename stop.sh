#!/bin/bash
# ===========================================
# stop.sh - Encerra todos os serviços EcoSolid
# Uso: ./stop.sh
# ===========================================

BACKEND_PORT=3005
FRONTEND_PORT=3000

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo ""
echo -e "${RED}╔══════════════════════════════════╗${NC}"
echo -e "${RED}║   EcoSolid - Encerrando Tudo    ║${NC}"
echo -e "${RED}╚══════════════════════════════════╝${NC}"
echo ""

# ─── 1. Parar Ngrok ──────────────────────────────────────────
echo "1/4 Parando Ngrok..."
if pgrep -f "ngrok start" > /dev/null; then
    pkill -f "ngrok start" 2>/dev/null && ok "Ngrok encerrado" || warn "Falha ao encerrar Ngrok"
else
    ok "Ngrok não estava rodando"
fi

# ─── 2. Parar Frontend ────────────────────────────────────────
echo "2/4 Parando Frontend (porta $FRONTEND_PORT)..."
FRONTEND_PID=$(ss -tlnp 2>/dev/null | grep ":$FRONTEND_PORT" | grep -oP 'pid=\K\d+' | head -1)
if [ -n "$FRONTEND_PID" ]; then
    kill "$FRONTEND_PID" 2>/dev/null && ok "Frontend (PID $FRONTEND_PID) encerrado"
    sleep 0.5
else
    ok "Frontend não estava rodando"
fi

# Mata qualquer next-server residual
pkill -f "next-server" 2>/dev/null

# ─── 3. Parar Backend ─────────────────────────────────────────
echo "3/4 Parando Backend (porta $BACKEND_PORT)..."
BACKEND_PID=$(ss -tlnp 2>/dev/null | grep ":$BACKEND_PORT" | grep -oP 'pid=\K\d+' | head -1)
if [ -n "$BACKEND_PID" ]; then
    kill "$BACKEND_PID" 2>/dev/null && ok "Backend (PID $BACKEND_PID) encerrado"
    sleep 0.5
else
    ok "Backend não estava rodando"
fi

# Mata qualquer node residual do backend
pkill -f "node.*ecosolid.*dist/main" 2>/dev/null

# ─── 4. Parar MongoDB ─────────────────────────────────────────
echo "4/4 Parando MongoDB..."
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
docker compose stop ecosolid-mongo 2>/dev/null && ok "MongoDB encerrado"

echo ""
echo -e "${RED}╔══════════════════════════════════════╗${NC}"
echo -e "${RED}║   Todos os serviços encerrados.      ║${NC}"
echo -e "${RED}║   Para iniciar de novo: ./start.sh   ║${NC}"
echo -e "${RED}╚══════════════════════════════════════╝${NC}"
echo ""
