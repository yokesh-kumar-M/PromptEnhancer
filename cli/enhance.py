#!/usr/bin/env python3
"""
PromptEnhancer Pro — CLI Tool
Enhance prompts from the command line. Works with Claude Code, Gemini CLI, and any terminal.

Usage:
  python enhance.py "write a function to sort a list"
  echo "my prompt" | python enhance.py
  python enhance.py "my prompt" --action Code
  python enhance.py "my prompt" --action Professional --clipboard

Setup:
  Set your Gemini API key:
    Windows:  $env:GEMINI_API_KEY = "AIzaSy..."
    Mac/Linux: export GEMINI_API_KEY="AIzaSy..."
    Or create a .env file in this directory with: GEMINI_API_KEY=AIzaSy...

Integration with Claude Code:
  Add an alias to your shell profile:
    pe() { enhanced=$(python /path/to/enhance.py "$@"); echo "$enhanced"; }
    pec() { python /path/to/enhance.py "$@" --action Code | claude; }

Integration with Gemini CLI:
    peg() { python /path/to/enhance.py "$@" | gemini; }
"""

import sys
import os
import argparse
import subprocess

# Load .env from this directory if present
_env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                os.environ.setdefault(k.strip(), v.strip())

SYSTEM_PROMPTS = {
    'Enhance': (
        "You are a world-class prompt engineer. Transform the user's vague request into a highly structured, "
        "context-rich prompt optimized for AI models.\n\n"
        "Rules:\n"
        "- Add clear context, constraints, and desired output format\n"
        "- Include role definition, task description, and success criteria\n"
        "- Use markdown formatting where appropriate\n"
        "- Return ONLY the enhanced prompt, no explanations or preambles\n"
        "- Make it 3-5x more detailed than the original"
    ),
    'Professional': (
        "You are an expert business communications specialist. Rewrite to be highly professional.\n\n"
        "Rules:\n"
        "- Use formal but natural language\n"
        "- Maintain the original meaning\n"
        "- Fix grammar, tone, and structure\n"
        "- Return ONLY the rewritten text"
    ),
    'Code': (
        "You are a senior software architect. Transform the request into a precise, technical prompt "
        "optimized for code generation.\n\n"
        "Rules:\n"
        "- Specify language, framework, and version if known\n"
        "- Include input/output specifications\n"
        "- Add error handling and edge case requirements\n"
        "- Return ONLY the enhanced technical prompt"
    ),
    'Shorten': (
        "You are a concise writing expert. Shorten while preserving ALL key information.\n\n"
        "Rules:\n"
        "- Cut unnecessary words and redundancies\n"
        "- Use active voice\n"
        "- Return ONLY the shortened text\n"
        "- Aim for 40-60% of original length"
    ),
    'Creative': (
        "You are a creative writing virtuoso. Transform into something vivid and emotionally engaging.\n\n"
        "Rules:\n"
        "- Use sensory language and powerful metaphors\n"
        "- Add emotional depth\n"
        "- Return ONLY the enhanced text"
    ),
}


def enhance_with_gemini(text: str, action: str, api_key: str) -> str:
    try:
        import google.generativeai as genai
    except ImportError:
        print(
            "ERROR: google-generativeai package not installed.\n"
            "Install it: pip install google-generativeai",
            file=sys.stderr,
        )
        sys.exit(1)

    genai.configure(api_key=api_key)
    system = SYSTEM_PROMPTS.get(action, SYSTEM_PROMPTS['Enhance'])
    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash',
        system_instruction=system,
    )
    response = model.generate_content(
        text,
        generation_config=genai.types.GenerationConfig(
            temperature=0.9 if action == 'Creative' else 0.7,
            max_output_tokens=4096,
        ),
    )
    return response.text.strip()


def enhance_with_backend(text: str, action: str, invite_code: str, backend_url: str) -> str:
    import urllib.request
    import json

    payload = json.dumps({'text': text, 'action': action}).encode()
    req = urllib.request.Request(
        f"{backend_url.rstrip('/')}/api/enhance/",
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'X-Invite-Code': invite_code,
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    if 'error' in data:
        raise RuntimeError(data['error'])
    return data['enhanced'].strip()


def copy_to_clipboard(text: str) -> None:
    if sys.platform == 'darwin':
        subprocess.run(['pbcopy'], input=text.encode(), check=True)
    elif sys.platform == 'win32':
        subprocess.run(['clip'], input=text.encode('utf-16'), check=True)
    else:
        try:
            subprocess.run(['xclip', '-selection', 'clipboard'], input=text.encode(), check=True)
        except FileNotFoundError:
            subprocess.run(['xsel', '--clipboard', '--input'], input=text.encode(), check=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description='PromptEnhancer Pro CLI — enhance prompts with Gemini AI',
    )
    parser.add_argument('prompt', nargs='?', help='Text to enhance (omit to read from stdin)')
    parser.add_argument(
        '--action', '-a',
        choices=['Enhance', 'Professional', 'Code', 'Shorten', 'Creative'],
        default='Enhance',
        help='Enhancement action (default: Enhance)',
    )
    parser.add_argument('--clipboard', '-c', action='store_true', help='Copy result to clipboard')
    parser.add_argument('--quiet', '-q', action='store_true', help='Only output the enhanced text')
    parser.add_argument(
        '--backend', '-b',
        help='Use backend URL instead of direct Gemini API (requires --invite-code)',
    )
    parser.add_argument('--invite-code', '-i', help='Invite code for backend API')
    args = parser.parse_args()

    # Get input text
    if args.prompt:
        text = args.prompt
    elif not sys.stdin.isatty():
        text = sys.stdin.read()
    else:
        print(
            'Usage: python enhance.py "your prompt"\n'
            '   or: echo "prompt" | python enhance.py\n'
            '\nRun with --help for more options.',
            file=sys.stderr,
        )
        sys.exit(1)

    text = text.strip()
    if not text:
        print('ERROR: Empty input.', file=sys.stderr)
        sys.exit(1)

    if not args.quiet:
        print(f'[PromptEnhancer] Action: {args.action} | Length: {len(text)} chars', file=sys.stderr)

    try:
        if args.backend:
            invite = args.invite_code or os.environ.get('PE_INVITE_CODE', '')
            if not invite:
                print(
                    'ERROR: --backend requires --invite-code or PE_INVITE_CODE env var.',
                    file=sys.stderr,
                )
                sys.exit(1)
            enhanced = enhance_with_backend(text, args.action, invite, args.backend)
        else:
            api_key = os.environ.get('GEMINI_API_KEY', '')
            if not api_key:
                print(
                    'ERROR: GEMINI_API_KEY environment variable not set.\n'
                    'Get a free key at https://aistudio.google.com/apikey\n'
                    'Then run: export GEMINI_API_KEY="AIzaSy..."',
                    file=sys.stderr,
                )
                sys.exit(1)
            enhanced = enhance_with_gemini(text, args.action, api_key)

        if args.clipboard:
            copy_to_clipboard(enhanced)
            if not args.quiet:
                print('[PromptEnhancer] Enhanced text copied to clipboard!', file=sys.stderr)
        else:
            print(enhanced)

    except KeyboardInterrupt:
        print('\nCancelled.', file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
