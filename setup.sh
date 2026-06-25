#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup.sh — Rudder Sovereign Life Operating System Installer & Bootstrapper
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ANSI color escape codes
COLOR_RESET="\033[0m"
COLOR_CYAN="\033[1;36m"
COLOR_GREEN="\033[1;32m"
COLOR_RED="\033[1;31m"
COLOR_YELLOW="\033[1;33m"
COLOR_BOLD="\033[1m"

# Print banner
print_banner() {
  echo -e "${COLOR_CYAN}╔═══════════════════════════════════════════════════════════════╗${COLOR_RESET}"
  echo -e "${COLOR_CYAN}║             RUDDER — Sovereign Life Operating System          ║${COLOR_RESET}"
  echo -e "${COLOR_CYAN}║                     Installation & Setup                      ║${COLOR_RESET}"
  echo -e "${COLOR_CYAN}╚═══════════════════════════════════════════════════════════════╝${COLOR_RESET}"
  echo ""
}

print_help() {
  print_banner
  echo -e "${COLOR_BOLD}Usage:${COLOR_RESET}"
  echo -e "  ./setup.sh [options]"
  echo ""
  echo -e "${COLOR_BOLD}Options:${COLOR_RESET}"
  echo -e "  -h, --help    Show this help message and exit"
  echo -e "  -c, --check   Dry-run mode: verify all prerequisites without modifying anything"
  echo ""
  echo -e "${COLOR_BOLD}Prerequisites Verified:${COLOR_RESET}"
  echo -e "  • Node.js version 20 or higher"
  echo -e "  • Ollama service running on localhost:11434"
  echo -e "  • Ollama models: llama3.2 and nomic-embed-text"
  echo ""
}

# Check Node.js version >= 20
check_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo -e "  ${COLOR_RED}✗${COLOR_RESET} Node.js: Not found"
    return 1
  fi
  
  local node_version
  node_version=$(node -v | sed 's/v//')
  local major_version
  major_version=$(echo "$node_version" | cut -d. -f1)
  
  if [ "$major_version" -lt 20 ]; then
    echo -e "  ${COLOR_RED}✗${COLOR_RESET} Node.js: v$node_version (Version 20+ required)"
    return 1
  else
    echo -e "  ${COLOR_GREEN}✓${COLOR_RESET} Node.js: v$node_version"
    return 0
  fi
}

# Check if Ollama is running
check_ollama() {
  if ! command -v ollama >/dev/null 2>&1; then
    echo -e "  ${COLOR_RED}✗${COLOR_RESET} Ollama: CLI client not found"
    return 1
  fi

  # Ping the local port
  if ! curl -s -f http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo -e "  ${COLOR_RED}✗${COLOR_RESET} Ollama: Service not running on http://localhost:11434"
    return 1
  else
    echo -e "  ${COLOR_GREEN}✓${COLOR_RESET} Ollama: Service is active"
    return 0
  fi
}

# Check if specific model is pulled
check_model() {
  local model_name="$1"
  if ! curl -s -f http://localhost:11434/api/tags | grep -q "\"$model_name"; then
    echo -e "  ${COLOR_RED}✗${COLOR_RESET} Ollama model '$model_name': Not found"
    return 1
  else
    echo -e "  ${COLOR_GREEN}✓${COLOR_RESET} Ollama model '$model_name': Present"
    return 0
  fi
}

run_checks() {
  local exit_code=0
  
  echo -e "${COLOR_BOLD}Checking system prerequisites...${COLOR_RESET}"
  
  check_node || exit_code=1
  check_ollama || exit_code=1
  
  # Only check models if Ollama is running
  if curl -s -f http://localhost:11434/api/tags >/dev/null 2>&1; then
    check_model "llama3.2" || exit_code=1
    check_model "nomic-embed-text" || exit_code=1
  else
    echo -e "  ${COLOR_RED}✗${COLOR_RESET} Ollama models: Cannot verify (Ollama service offline)"
    exit_code=1
  fi
  
  echo ""
  return "$exit_code"
}

# Main script logic
main() {
  local mode="setup"
  
  # Parse arguments
  for arg in "$@"; do
    case "$arg" in
      -h|--help)
        print_help
        exit 0
        ;;
      -c|--check)
        mode="check"
        ;;
      *)
        echo -e "${COLOR_RED}Error: Unknown option '$arg'${COLOR_RESET}"
        echo -e "Run ${COLOR_BOLD}./setup.sh --help${COLOR_RESET} for usage."
        exit 1
        ;;
    esac
  done
  
  if [ "$mode" = "check" ]; then
    print_banner
    echo -e "${COLOR_YELLOW}▶ Running in DRY-RUN mode (checks only, no changes)${COLOR_RESET}\n"
    if run_checks; then
      echo -e "${COLOR_GREEN}🎉 All prerequisites met! The system is ready for setup.${COLOR_RESET}"
      exit 0
    else
      echo -e "${COLOR_RED}✗ Prerequisite checks failed. Please fix the issues above before running setup.${COLOR_RESET}"
      exit 1
    fi
  fi
  
  # Default installation mode
  print_banner
  
  if ! run_checks; then
    # Some prerequisites failed. Let's see if we can resolve models or if it's node/ollama offline
    if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]; then
      echo -e "${COLOR_RED}Error: Node.js 20+ is required. Setup cannot proceed.${COLOR_RESET}"
      exit 1
    fi
    if ! curl -s -f http://localhost:11434/api/tags >/dev/null 2>&1; then
      echo -e "${COLOR_RED}Error: Ollama service must be running. Start Ollama and try again.${COLOR_RESET}"
      exit 1
    fi
  fi
  
  # Pull models if needed
  echo -e "${COLOR_BOLD}Ensuring Ollama models are pulled...${COLOR_RESET}"
  if ! curl -s -f http://localhost:11434/api/tags | grep -q "\"llama3.2"; then
    echo -e "▶ Pulling llama3.2 model (this may take a few minutes)..."
    ollama pull llama3.2
    echo -e "  ${COLOR_GREEN}✓${COLOR_RESET} pulled llama3.2"
  fi
  if ! curl -s -f http://localhost:11434/api/tags | grep -q "\"nomic-embed-text"; then
    echo -e "▶ Pulling nomic-embed-text model (this may take a few minutes)..."
    ollama pull nomic-embed-text
    echo -e "  ${COLOR_GREEN}✓${COLOR_RESET} pulled nomic-embed-text"
  fi
  echo ""
  
  # Install npm dependencies
  echo -e "${COLOR_BOLD}Installing dependencies...${COLOR_RESET}"
  if [ -d "app" ]; then
    echo -e "▶ Installing Next.js app dependencies..."
    cd app
    npm install
    cd ..
    echo -e "  ${COLOR_GREEN}✓${COLOR_RESET} app dependencies installed"
  fi
  if [ -d "cli" ]; then
    echo -e "▶ Installing CLI dependencies..."
    cd cli
    npm install
    cd ..
    echo -e "  ${COLOR_GREEN}✓${COLOR_RESET} cli dependencies installed"
  fi
  echo ""
  
  # Configure environment variables
  echo -e "${COLOR_BOLD}Configuring environment...${COLOR_RESET}"
  if [ -d "app" ] && [ -f "app/.env.example" ]; then
    if [ ! -f "app/.env.local" ]; then
      cp app/.env.example app/.env.local
      echo -e "  ${COLOR_GREEN}✓${COLOR_RESET} created app/.env.local (copied from .env.example)"
    else
      echo -e "  ${COLOR_GREEN}✓${COLOR_RESET} app/.env.local already exists"
    fi
  fi
  echo ""
  
  echo -e "${COLOR_GREEN}🎉 Rudder setup complete!${COLOR_RESET}"
  echo -e "To start the development server:"
  echo -e "  ${COLOR_CYAN}./rudder dev${COLOR_RESET}"
  echo ""
}

main "$@"
