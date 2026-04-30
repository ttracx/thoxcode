#!/usr/bin/env bash
# Install the ThoxCode daemon on a ThoxOS / Linux host.
# Run as root: sudo ./install.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/opt/thoxcode"
ENV_DIR="/etc/thoxcode"
USER_NAME="thoxcode"
GROUP_NAME="thoxcode"

if [[ "${EUID}" -ne 0 ]]; then
  echo "must run as root" >&2
  exit 1
fi

echo "→ creating user/group ${USER_NAME}"
getent group "${GROUP_NAME}" >/dev/null || groupadd --system "${GROUP_NAME}"
id -u "${USER_NAME}" >/dev/null 2>&1 || \
  useradd --system --gid "${GROUP_NAME}" --home-dir "${INSTALL_DIR}" \
    --shell /usr/sbin/nologin "${USER_NAME}"

echo "→ installing files into ${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}" "${ENV_DIR}" /var/log/thoxcode /run/thoxcode
cp -r "${PKG_DIR}/dist" "${INSTALL_DIR}/"
cp -r "${PKG_DIR}/node_modules" "${INSTALL_DIR}/" 2>/dev/null || true
chown -R "${USER_NAME}:${GROUP_NAME}" "${INSTALL_DIR}" /var/log/thoxcode /run/thoxcode

if [[ ! -f "${ENV_DIR}/environment" ]]; then
  echo "→ writing default environment template"
  cat >"${ENV_DIR}/environment" <<'EOF'
# ThoxCode daemon environment
# ANTHROPIC_API_KEY=sk-ant-...
# THOXCODE_DEFAULT_MODEL=claude-opus-4-7
# THOX_QUANTUM_URL=http://localhost:8200
EOF
  chmod 0640 "${ENV_DIR}/environment"
  chown root:"${GROUP_NAME}" "${ENV_DIR}/environment"
fi

echo "→ installing systemd unit"
install -m 0644 "${PKG_DIR}/systemd/thoxcoded.service" \
  /etc/systemd/system/thoxcoded.service
systemctl daemon-reload

echo "✓ done. Next steps:"
echo "    sudo edit ${ENV_DIR}/environment  # set ANTHROPIC_API_KEY"
echo "    sudo systemctl enable --now thoxcoded"
echo "    journalctl -u thoxcoded -f"
echo "    thoxcode --thoxos 'list files'  # from any user in the thoxcode group"
