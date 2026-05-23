#!/bin/bash
# ===========================================
# start.sh - Inicia todos os serviços EcoSolid
# Uso: ./start.sh
# ===========================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_PORT=3005
FRONTEND_PORT=3000
BACKEND_LOG="/tmp/ecosolid-backend.log"
FRONTEND_LOG="/tmp/ecosolid-frontend.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[EcoSolid]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERRO]${NC} $1"; }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     EcoSolid - Iniciando Tudo       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── 1. MongoDB (Docker) ───────────────────────────────────────────
log "1/4 Iniciando MongoDB via Docker..."
cd "$PROJECT_DIR"

if docker ps --format '{{.Names}}' | grep -q "ecosolid_mongo"; then
    ok "MongoDB já está rodando"
else
    docker compose up -d ecosolid-mongo 2>&1 | while read line; do log "  $line"; done
    sleep 2
    if docker ps --format '{{.Names}}' | grep -q "ecosolid_mongo"; then
        ok "MongoDB iniciado na porta 27777"
    else
        err "Falha ao iniciar MongoDB"
        exit 1
    fi
fi

# ─── 2. Backend (NestJS) ───────────────────────────────────────────
log "2/4 Compilando e iniciando Backend na porta $BACKEND_PORT..."

# Mata processo antigo se existir
OLD_BACKEND=$(ss -tlnp 2>/dev/null | grep ":$BACKEND_PORT" | grep -oP 'pid=\K\d+' | head -1)
if [ -n "$OLD_BACKEND" ]; then
    kill "$OLD_BACKEND" 2>/dev/null && warn "Backend antigo (PID $OLD_BACKEND) encerrado"
    sleep 0.5
fi

cd "$BACKEND_DIR"
npm run build 2>&1 | while read line; do :; done
nohup node --enable-source-maps dist/main > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
sleep 2

if kill -0 "$BACKEND_PID" 2>/dev/null; then
    ok "Backend rodando (PID $BACKEND_PID, porta $BACKEND_PORT)"
else
    err "Falha ao iniciar Backend. Veja o log: $BACKEND_LOG"
    exit 1
fi

# ─── 3. Frontend (Next.js) ─────────────────────────────────────────
log "3/4 Compilando e iniciando Frontend na porta $FRONTEND_PORT..."

OLD_FRONTEND=$(ss -tlnp 2>/dev/null | grep ":$FRONTEND_PORT" | grep -oP 'pid=\K\d+' | head -1)
if [ -n "$OLD_FRONTEND" ]; then
    kill "$OLD_FRONTEND" 2>/dev/null && warn "Frontend antigo (PID $OLD_FRONTEND) encerrado"
    sleep 0.5
fi

cd "$FRONTEND_DIR"
npm run build 2>&1 | while read line; do :; done
nohup npx next start -p "$FRONTEND_PORT" > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
sleep 3

if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    ok "Frontend rodando (PID $FRONTEND_PID, porta $FRONTEND_PORT)"
else
    err "Falha ao iniciar Frontend. Veja o log: $FRONTEND_LOG"
    exit 1
fi

# ─── 4. Ngrok (Túneis públicos) ────────────────────────────────────
log "4/4 Iniciando túneis Ngrok..."

if pgrep -f "ngrok start" > /dev/null; then
    ok "Ngrok já está rodando"
else
    NGROK_CONFIG="$PROJECT_DIR/ngrok.yml"
    if [ -f "$NGROK_CONFIG" ]; then
        nohup ngrok start --all --config="$NGROK_CONFIG" > /tmp/ecosolid-ngrok.log 2>&1 &
        sleep 3
        if pgrep -f "ngrok start" > /dev/null; then
            ok "Ngrok iniciado"
        else
            warn "Ngrok pode não ter iniciado corretamente"
        fi
    else
        warn "Arquivo ngrok.yml não encontrado em $NGROK_CONFIG. Execute 'ngrok config add-authtoken <seu-token>' primeiro."
    fi
fi

# ─── Resumo Final ──────────────────────────────────────────────────
sleep 1
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     EcoSolid - Todos os serviços iniciados!          ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}                                                      "
echo -e "${GREEN}║${NC}  MongoDB:  ${CYAN}localhost:27777${NC}"

# Testa resposta do backend
if curl -s --max-time 1 http://localhost:$BACKEND_PORT/citizens/test > /dev/null 2>&1; then
    echo -e "${GREEN}║${NC}  Backend:   ${CYAN}http://localhost:$BACKEND_PORT${NC}       ${GREEN}✓${NC}"
else
    echo -e "${GREEN}║${NC}  Backend:   ${CYAN}http://localhost:$BACKEND_PORT${NC}       ${YELLOW}(iniciando...)${NC}"
fi

# Testa resposta do frontend
if curl -s --max-time 1 http://localhost:$FRONTEND_PORT | grep -q "EcoSolid" 2>/dev/null; then
    echo -e "${GREEN}║${NC}  Frontend:  ${CYAN}http://localhost:$FRONTEND_PORT${NC}       ${GREEN}✓${NC}"
else
    echo -e "${GREEN}║${NC}  Frontend:  ${CYAN}http://localhost:$FRONTEND_PORT${NC}       ${YELLOW}(iniciando...)${NC}"
fi

# Tenta obter URLs do ngrok
NGROK_FRONTEND=$(curl -s --max-time 1 http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; tunnels=json.load(sys.stdin)['tunnels']; [print(t['public_url']) for t in tunnels if t['config']['addr'].endswith('3000')]" 2>/dev/null)
NGROK_BACKEND=$(curl -s --max-time 1 http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; tunnels=json.load(sys.stdin)['tunnels']; [print(t['public_url']) for t in tunnels if t['config']['addr'].endswith('3005')]" 2>/dev/null)

if [ -n "$NGROK_FRONTEND" ]; then
    echo -e "${GREEN}║${NC}  Público:   ${CYAN}$NGROK_FRONTEND${NC}"
fi
if [ -n "$NGROK_BACKEND" ]; then
    echo -e "${GREEN}║${NC}  API Pública: ${CYAN}$NGROK_BACKEND${NC}"
fi

echo -e "${GREEN}║${NC}                                                      "
echo -e "${GREEN}║${NC}  Logs:"
echo -e "${GREEN}║${NC}    Backend:  tail -f $BACKEND_LOG"
echo -e "${GREEN}║${NC}    Frontend: tail -f $FRONTEND_LOG"
echo -e "${GREEN}║${NC}    Ngrok:    tail -f /tmp/ecosolid-ngrok.log"
echo -e "${GREEN}║${NC}                                                      "
echo -e "${GREEN}║${NC}  Para parar tudo: ./stop.sh${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
