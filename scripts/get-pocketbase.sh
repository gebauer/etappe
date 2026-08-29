#!/usr/bin/env bash
# Fetch the pinned PocketBase binary into ./bin for local development.
# Version is kept in sync with the Dockerfile's PB_VERSION.
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.40.1}"
DEST_DIR="$(cd "$(dirname "$0")/.." && pwd)/bin"

os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Linux) pbos="linux" ;;
  Darwin) pbos="darwin" ;;
  *) echo "Unsupported OS: $os" >&2; exit 1 ;;
esac
case "$arch" in
  x86_64 | amd64) pbarch="amd64" ;;
  aarch64 | arm64) pbarch="arm64" ;;
  *) echo "Unsupported arch: $arch" >&2; exit 1 ;;
esac

url="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${pbos}_${pbarch}.zip"
mkdir -p "$DEST_DIR"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading PocketBase ${PB_VERSION} (${pbos}/${pbarch})..."
curl -fsSL "$url" -o "$tmp/pb.zip"

# PocketBase ships as .zip only. Extract the binary with whatever is available.
if command -v unzip >/dev/null 2>&1; then
  unzip -o "$tmp/pb.zip" pocketbase -d "$DEST_DIR" >/dev/null
elif command -v bsdtar >/dev/null 2>&1; then
  bsdtar -xf "$tmp/pb.zip" -C "$DEST_DIR" pocketbase
elif command -v python3 >/dev/null 2>&1; then
  python3 -c "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extract('pocketbase', sys.argv[2])" "$tmp/pb.zip" "$DEST_DIR"
else
  echo "Need 'unzip', 'bsdtar', or 'python3' to extract the archive." >&2
  exit 1
fi
chmod +x "$DEST_DIR/pocketbase"

echo "Installed: $DEST_DIR/pocketbase"
"$DEST_DIR/pocketbase" --version
