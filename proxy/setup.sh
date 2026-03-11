#!/usr/bin/env bash
# ============================================================
#  Compendium Importer — CORS Proxy Auto-Start Setup (Linux)
#  Run this ONCE on the Foundry server machine.
#  Creates a systemd user service (no root needed).
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_SCRIPT="$SCRIPT_DIR/server.mjs"
SERVICE_NAME="compendium-importer-proxy"

# Find node
NODE_BIN="$(command -v node 2>/dev/null || true)"
if [ -z "$NODE_BIN" ]; then
    echo "ERROR: Node.js not found in PATH. Install it first."
    exit 1
fi

echo ""
echo "=== Compendium Importer CORS Proxy Setup ==="
echo "Node:   $NODE_BIN"
echo "Script: $PROXY_SCRIPT"
echo ""

# Create systemd user service
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Compendium Importer CORS Proxy
After=network.target

[Service]
Type=simple
ExecStart=$NODE_BIN $PROXY_SCRIPT
Restart=on-failure
RestartSec=5
Environment=PORT=3001

[Install]
WantedBy=default.target
EOF

# Enable and start
systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME"
systemctl --user start "$SERVICE_NAME"

echo "Service '$SERVICE_NAME' installed and started."
echo "Status:  systemctl --user status $SERVICE_NAME"
echo "Logs:    journalctl --user -u $SERVICE_NAME -f"
echo ""
echo "The proxy will auto-start on login. Setup complete!"
