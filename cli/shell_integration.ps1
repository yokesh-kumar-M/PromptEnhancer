# PromptEnhancer Pro — PowerShell Integration
# Add this to your PowerShell profile ($PROFILE) to get pe/pec/peg commands.
#
# To install:
#   1. Run: notepad $PROFILE
#   2. Paste this entire file content (or `. "path\to\shell_integration.ps1"`)
#   3. Restart your terminal
#
# Usage:
#   pe "my prompt"              — enhance and print
#   pe "my prompt" -a Code      — enhance for code
#   pec "my prompt"             — enhance then run with Claude Code
#   peg "my prompt"             — enhance then run with Gemini CLI
#   pe "my prompt" -clipboard   — enhance and copy to clipboard

$PE_SCRIPT = "D:\Full-stack\Django\PromptEnhancer\cli\enhance.py"

# Base enhance function — prints enhanced text
function pe {
    param(
        [Parameter(Position=0)]
        [string]$prompt,
        [string]$a = "Enhance",
        [switch]$clipboard
    )

    $args_list = @()
    if ($prompt) { $args_list += $prompt }
    $args_list += "--action", $a
    if ($clipboard) { $args_list += "--clipboard" }

    python $PE_SCRIPT @args_list
}

# Enhance then pipe to Claude Code
function pec {
    param(
        [Parameter(Position=0)]
        [string]$prompt,
        [string]$a = "Enhance"
    )
    $enhanced = python $PE_SCRIPT $prompt --action $a --quiet
    if ($LASTEXITCODE -eq 0 -and $enhanced) {
        Write-Host "[PromptEnhancer] Sending to Claude Code..." -ForegroundColor Magenta
        claude $enhanced
    }
}

# Enhance then pipe to Gemini CLI
function peg {
    param(
        [Parameter(Position=0)]
        [string]$prompt,
        [string]$a = "Enhance"
    )
    $enhanced = python $PE_SCRIPT $prompt --action $a --quiet
    if ($LASTEXITCODE -eq 0 -and $enhanced) {
        Write-Host "[PromptEnhancer] Sending to Gemini CLI..." -ForegroundColor Blue
        gemini $enhanced
    }
}

# Enhance for code then run with Claude Code
function pecode {
    param([Parameter(Position=0)][string]$prompt)
    pec -prompt $prompt -a Code
}

# Enhance stdin and pipe to any command
# Usage: "my prompt" | pe-pipe | claude
filter pe-pipe {
    $enhanced = $_ | python $PE_SCRIPT
    if ($LASTEXITCODE -eq 0) { $enhanced }
}

Write-Host "PromptEnhancer Pro loaded. Commands: pe, pec, peg, pecode, pe-pipe" -ForegroundColor Green
