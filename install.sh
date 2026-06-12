#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${BLUE}[ghost-mcp]${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
fatal()   { echo -e "${RED}✗ $*${RESET}" >&2; exit 1; }

# ─── macOS gate ──────────────────────────────────────────────────────────────

[[ "$(uname)" == "Darwin" ]] || fatal "This install script supports macOS only."

echo ""
echo -e "${BOLD}ghost-mcp installer${RESET}"
echo "──────────────────────────────────────────"
echo ""

# ─── Homebrew ────────────────────────────────────────────────────────────────

if ! command -v brew &>/dev/null; then
  info "Homebrew not found — installing..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Apple Silicon puts Homebrew at /opt/homebrew; add it to this session's PATH
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  success "Homebrew installed"
else
  success "Homebrew found ($(brew --version | head -1))"
fi

# ─── Node.js ─────────────────────────────────────────────────────────────────

NODE_MIN_MAJOR=20

check_node() {
  if command -v node &>/dev/null; then
    local major
    major=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
    [[ "$major" -ge "$NODE_MIN_MAJOR" ]]
  else
    return 1
  fi
}

if ! check_node; then
  info "Node.js v${NODE_MIN_MAJOR}+ not found — installing node@22 via Homebrew..."
  brew install node@22
  # node@22 is keg-only, so we need to prepend its bin for this session
  NODE22_BIN="$(brew --prefix node@22)/bin"
  export PATH="${NODE22_BIN}:$PATH"
  if ! check_node; then
    fatal "Node.js v${NODE_MIN_MAJOR}+ could not be installed. Install it manually and re-run."
  fi
  success "Node.js installed ($(node --version))"
else
  success "Node.js found ($(node --version))"
fi

# ─── Install dependencies ─────────────────────────────────────────────────────

info "Installing npm dependencies..."
cd "$SCRIPT_DIR"
npm install 2>&1 | grep -v '^npm warn' || true
success "Dependencies installed"

# ─── Build ───────────────────────────────────────────────────────────────────

info "Building TypeScript..."
cd "$SCRIPT_DIR"
npm run build

[[ -f "${SCRIPT_DIR}/build/server.js" ]] || fatal "Build completed but build/server.js is missing — check tsconfig.json."
success "Build complete"

# ─── Ghost credentials ───────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Ghost CMS Configuration${RESET}"
echo ""

read -rp "  Ghost API URL (e.g. https://yourblog.com): " GHOST_API_URL
while [[ -z "$GHOST_API_URL" ]]; do
  warn "GHOST_API_URL cannot be empty."
  read -rp "  Ghost API URL: " GHOST_API_URL
done

read -rsp "  Ghost Admin API Key: " GHOST_ADMIN_API_KEY
echo ""
while [[ -z "$GHOST_ADMIN_API_KEY" ]]; do
  warn "GHOST_ADMIN_API_KEY cannot be empty."
  read -rsp "  Ghost Admin API Key: " GHOST_ADMIN_API_KEY
  echo ""
done

read -rp "  Ghost API Version [v5.0]: " GHOST_API_VERSION_INPUT
GHOST_API_VERSION="${GHOST_API_VERSION_INPUT:-v5.0}"

# ─── Update ~/.claude.json ───────────────────────────────────────────────────

info "Registering ghost-mcp in ~/.claude.json..."

# JSON-encode every value before interpolating into the heredoc so that special
# characters (quotes, backslashes, unicode) in user input can't break the script.
serverPath="${SCRIPT_DIR}/build/server.js"
ghostApiUrlJson=$(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$GHOST_API_URL")
ghostAdminApiKeyJson=$(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$GHOST_ADMIN_API_KEY")
ghostApiVersionJson=$(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$GHOST_API_VERSION")
serverPathJson=$(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$serverPath")

result=$(node << NODEJS
const fs = require('fs');
const claudeJsonPath = process.env.HOME + '/.claude.json';

// All values arrive as JSON literals (pre-encoded by bash above)
const actualServerPath = ${serverPathJson};
const ghostApiUrl      = ${ghostApiUrlJson};
const ghostAdminApiKey = ${ghostAdminApiKeyJson};
const ghostApiVersion  = ${ghostApiVersionJson};

// Load existing config (full object) or start fresh
let config = {};
if (fs.existsSync(claudeJsonPath)) {
  const raw = fs.readFileSync(claudeJsonPath, 'utf8');
  try {
    config = JSON.parse(raw);
  } catch (e) {
    process.stderr.write('ERROR: ~/.claude.json exists but is not valid JSON. Fix it manually and re-run.\n');
    process.exit(1);
  }
}

// Ensure mcpServers key exists without disturbing any other top-level keys
if (!config.mcpServers) config.mcpServers = {};

// Upsert only the ghost-mcp entry — all other mcpServers entries are untouched
config.mcpServers['ghost-mcp'] = {
  command: 'node',
  args: [actualServerPath],
  env: {
    GHOST_API_URL: ghostApiUrl,
    GHOST_ADMIN_API_KEY: ghostAdminApiKey,
    GHOST_API_VERSION: ghostApiVersion,
  }
};

// Write the full config back (pretty-printed, trailing newline, owner-only permissions)
fs.writeFileSync(claudeJsonPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
process.stdout.write('OK');
NODEJS
)

[[ "$result" == "OK" ]] || fatal "Failed to update ~/.claude.json"
success "~/.claude.json updated (ghost-mcp entry registered)"

# ─── Done ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}Setup complete!${RESET}"
echo ""
echo -e "  ${BOLD}Server path:${RESET}  ${SCRIPT_DIR}/build/server.js"
echo -e "  ${BOLD}Config file:${RESET}  ~/.claude.json  (mcpServers.ghost-mcp)"
echo ""
echo -e "${BLUE}Next steps:${RESET}"
echo "  1. Restart Claude Code (quit and reopen, or run: claude mcp restart)"
echo "  2. Verify the server is active:  /mcp"
echo "  3. Try: \"List my Ghost posts\""
echo ""
echo -e "${YELLOW}To update your Ghost credentials, re-run:${RESET}  ./install.sh"
echo ""
