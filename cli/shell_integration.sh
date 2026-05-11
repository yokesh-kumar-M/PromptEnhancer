#!/bin/bash
# PromptEnhancer Pro — Bash/Zsh Integration
# Add to ~/.bashrc or ~/.zshrc:
#   source /path/to/shell_integration.sh
#
# Or install permanently:
#   echo 'source /path/to/shell_integration.sh' >> ~/.zshrc
#
# Usage:
#   pe "my prompt"           — enhance and print
#   pe "my prompt" -a Code   — enhance for code
#   pec "my prompt"          — enhance then run with Claude Code
#   peg "my prompt"          — enhance then run with Gemini CLI

PE_SCRIPT="D:/Full-stack/Django/PromptEnhancer/cli/enhance.py"

# Base enhance — prints enhanced text to stdout
pe() {
    python "$PE_SCRIPT" "$@"
}

# Enhance then send to Claude Code
pec() {
    local action="${PE_ACTION:-Enhance}"
    local prompt="$*"
    local enhanced
    enhanced=$(python "$PE_SCRIPT" "$prompt" --action "$action" --quiet 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$enhanced" ]; then
        echo -e "\033[35m[PromptEnhancer] Sending to Claude Code...\033[0m" >&2
        claude "$enhanced"
    fi
}

# Enhance then send to Gemini CLI
peg() {
    local action="${PE_ACTION:-Enhance}"
    local prompt="$*"
    local enhanced
    enhanced=$(python "$PE_SCRIPT" "$prompt" --action "$action" --quiet 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$enhanced" ]; then
        echo -e "\033[34m[PromptEnhancer] Sending to Gemini CLI...\033[0m" >&2
        gemini "$enhanced"
    fi
}

# Enhance for code and send to Claude Code
pecode() {
    PE_ACTION=Code pec "$@"
}

# Enhance from stdin
pe-pipe() {
    python "$PE_SCRIPT"
}

echo "✨ PromptEnhancer Pro loaded. Commands: pe, pec, peg, pecode"
