#!/usr/bin/env sh
#
# Curio Code install script (Phase 12).
# - Run from repo: ./scripts/install.sh  → build from source and install to ~/.curio-code/bin
# - Remote: curl -fsSL https://raw.githubusercontent.com/ujjalsharma100/curio-coding-tool/main/scripts/install.sh | sh
#   → clone curio-coding-tool + curio-agent-sdk-typescript, build, install binary, then remove clones
#
# Requires: (local) Bun >= 1.1.0  |  (remote) git, Bun >= 1.1.0
#

set -e

# GitHub repos (coding-tool depends on SDK via file:../curio-agent-sdk-typescript)
CURIO_CODE_REPO="https://github.com/ujjalsharma100/curio-coding-tool"
CURIO_SDK_REPO="https://github.com/ujjalsharma100/curio-agent-sdk-typescript"
INSTALL_DIR="${HOME}/.curio-code"
BIN_DIR="${INSTALL_DIR}/bin"
BINARY_NAME="curio-code"

# Optional: install from local repo (when run as ./scripts/install.sh from inside the repo)
is_local_repo() {
  [ -n "${REPO_ROOT}" ] && [ -f "${REPO_ROOT}/package.json" ] && [ -f "${REPO_ROOT}/src/index.ts" ] && \
    grep -q '"name"[[:space:]]*:[[:space:]]*"curio-code"' "${REPO_ROOT}/package.json" 2>/dev/null
}

ensure_bin_dir() {
  mkdir -p "${BIN_DIR}"
}

# Add ~/.curio-code/bin to PATH in the first existing of .zshrc, .bashrc, .profile
add_to_path() {
  LINE="export PATH=\"${BIN_DIR}:\$PATH\""
  for f in "${HOME}/.zshrc" "${HOME}/.bashrc" "${HOME}/.profile"; do
    if [ -f "$f" ]; then
      if grep -qF "${BIN_DIR}" "$f" 2>/dev/null; then
        : # already present
      else
        printf '\n# Curio Code\n%s\n' "$LINE" >> "$f"
        echo "  Added PATH to $f"
      fi
      return 0
    fi
  done
  # No standard file found; create .profile
  printf '\n# Curio Code\n%s\n' "$LINE" >> "${HOME}/.profile"
  echo "  Created ${HOME}/.profile and added PATH"
}

# Create cc symlink to curio-code (skip on Windows where ln may not work as expected)
install_symlink() {
  TARGET=""
  if [ -f "${BIN_DIR}/${BINARY_NAME}" ]; then
    TARGET="${BINARY_NAME}"
  elif [ -f "${BIN_DIR}/${BINARY_NAME}.exe" ]; then
    TARGET="${BINARY_NAME}.exe"
  fi
  if [ -n "$TARGET" ]; then
    case "$(uname -s)" in
      MINGW*|MSYS*|CYGWIN*) ;; # skip symlink on Windows
      *)
        rm -f "${BIN_DIR}/cc"
        ln -sf "$TARGET" "${BIN_DIR}/cc"
        ;;
    esac
  fi
}

# Verify installation
verify_install() {
  export PATH="${BIN_DIR}:${PATH}"
  if command -v curio-code >/dev/null 2>&1; then
    echo "  Version: $(curio-code --version 2>/dev/null || echo 'installed')"
    return 0
  fi
  return 1
}

# --- Local install: build from source and install
do_local_install() {
  echo "Installing Curio Code from local source (${REPO_ROOT})..."
  if ! command -v bun >/dev/null 2>&1; then
    echo "Error: Bun is required for local install. Install from https://bun.sh"
    exit 1
  fi
  cd "${REPO_ROOT}"
  echo "  Running: bun install"
  bun install
  echo "  Running: bun run build"
  bun run build
  if [ ! -f "${REPO_ROOT}/curio-code" ]; then
    echo "Error: Build did not produce ./curio-code"
    exit 1
  fi
  ensure_bin_dir
  cp -f "${REPO_ROOT}/curio-code" "${BIN_DIR}/${BINARY_NAME}"
  chmod +x "${BIN_DIR}/${BINARY_NAME}"
  install_symlink
  add_to_path
  echo "  Installed: ${BIN_DIR}/${BINARY_NAME}"
  if verify_install; then
    echo ""
    print_getting_started
    exit 0
  fi
  echo "  Install complete. Run: curio-code --version"
  print_getting_started
}

# --- Remote install: clone both repos, build, install binary, remove clones
do_remote_install() {
  if ! command -v git >/dev/null 2>&1; then
    echo "Error: git is required for remote install. Install git and try again."
    exit 1
  fi
  if ! command -v bun >/dev/null 2>&1; then
    echo "Error: Bun is required for remote install. Install from https://bun.sh and try again."
    exit 1
  fi
  BUILD_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t curio-code-install)
  trap 'rm -rf "${BUILD_DIR}"' EXIT
  echo "Installing Curio Code from GitHub (clone + build)..."
  echo "  Cloning curio-agent-sdk-typescript..."
  git clone --depth 1 "${CURIO_SDK_REPO}.git" "${BUILD_DIR}/curio-agent-sdk-typescript"
  echo "  Cloning curio-coding-tool..."
  git clone --depth 1 "${CURIO_CODE_REPO}.git" "${BUILD_DIR}/curio-coding-tool"
  echo "  Building (bun install + bun run build)..."
  cd "${BUILD_DIR}/curio-coding-tool"
  bun install
  bun run build
  if [ ! -f "${BUILD_DIR}/curio-coding-tool/curio-code" ]; then
    echo "Error: Build did not produce curio-code binary."
    exit 1
  fi
  ensure_bin_dir
  cp -f "${BUILD_DIR}/curio-coding-tool/curio-code" "${BIN_DIR}/${BINARY_NAME}"
  chmod +x "${BIN_DIR}/${BINARY_NAME}"
  install_symlink
  add_to_path
  echo "  Installed: ${BIN_DIR}/${BINARY_NAME}"
  echo "  Removed temporary build directory."
  if verify_install; then
    echo ""
    print_getting_started
    exit 0
  fi
  print_getting_started
}

print_getting_started() {
  echo "Getting started:"
  echo "  curio-code          # interactive REPL"
  echo "  curio-code \"prompt\" # one-shot"
  echo "  cc                  # short alias"
  echo ""
  echo "Config: ~/.curio-code/ and project .curio-code/config.json"
  echo "Docs:   ${CURIO_CODE_REPO}"
}

# --- Main
main() {
  REPO_ROOT=""
  # Only consider local install when script was run via a path (e.g. ./scripts/install.sh)
  case "$0" in
    */*)
      SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
      REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
      ;;
  esac
  if is_local_repo; then
    do_local_install
  else
    do_remote_install
  fi
}

main "$@"
