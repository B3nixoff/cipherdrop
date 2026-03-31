#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist-desktop"
REPO_DIR="${ROOT_DIR}/packaging/repo/out"
REPO_NAME="cipherdrop"

mkdir -p "${REPO_DIR}"

latest_pkg="$(find "${DIST_DIR}" -maxdepth 1 -type f -name '*.pacman' | sort | tail -n 1)"

if [[ -z "${latest_pkg}" ]]; then
  echo "No .pacman package found in ${DIST_DIR}" >&2
  exit 1
fi

cp -f "${latest_pkg}" "${REPO_DIR}/"
repo-add "${REPO_DIR}/${REPO_NAME}.db.tar.gz" "${REPO_DIR}/$(basename "${latest_pkg}")"

echo "Repo updated in ${REPO_DIR}"
echo
echo "Add this to /etc/pacman.conf:"
echo "[${REPO_NAME}]"
echo "SigLevel = Optional TrustAll"
echo "Server = file://${REPO_DIR}"
