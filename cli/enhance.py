#!/usr/bin/env python3
"""
PromptEnhancer Pro — CLI Tool
Enhance prompts from the command line using your own API key (BYOK).

Usage:
  python enhance.py "write a function to sort a list"
  echo "my prompt" | python enhance.py
  python enhance.py "my prompt" --action Code
  python enhance.py "my prompt" --action Professional --clipboard

Setup (choose one):
  Groq (14,400 req/day free):
    Windows:  $env:GROQ_API_KEY = "gsk_..."
    Mac/Linux: export GROQ_API_KEY="gsk_..."
    Get key: https://console.groq.com/keys

  Gemini (free tier):
    Windows:  $env:GEMINI_API_KEY = "AIzaSy..."
    Mac/Linux: export GEMINI_API_KEY="AIzaSy..."
    Get key: https://aistudio.google.com/apikey

  Or create a .env file in this directory:
    GROQ_API_KEY=gsk_...
    # or
    GEMINI_API_KEY=AIzaSy...

Integration with Claude Code:
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


def enhance_with_groq(text: str, action: str, api_key: str, model: str = 'llama-3.3-70b-versatile') -> str:
    import urllib.request
    import urllib.error
    import json

    system = SYSTEM_PROMPTS.get(action, SYSTEM_PROMPTS['Enhance'])
    payload = json.dumps({
        'model': model,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': text},
        ],
        'temperature': 0.9 if action == 'Creative' else 0.7,
        'max_tokens': 4096,
    }).encode()

    req = urllib.request.Request(
        'https://api.groq.com/openai/v1/chat/completions',
        data=payload,
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        return data['choices'][0]['message']['content'].strip()
    except urllib.error.HTTPError as e:
        body = json.loads(e.read())
        msg = body.get('error', {}).get('message', f'Groq API error {e.code}')
        if e.code == 401:
            raise RuntimeError('Invalid Groq API key. Check GROQ_API_KEY.')
        if e.code == 429:
            raise RuntimeError('Groq rate limit reached. Try again in a moment.')
        raise RuntimeError(msg)


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


def enhance_with_backend(text: str, action: str, backend_url: str,
                         api_key: str = '', provider: str = 'gemini') -> str:
    import urllib.request
    import json

    body: dict = {'text': text, 'action': action}
    if api_key:
        body['api_key'] = api_key
        body['provider'] = provider

    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{backend_url.rstrip('/')}/api/enhance/",
        data=payload,
        headers={'Content-Type': 'application/json'},
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
        description='PromptEnhancer Pro CLI — BYOK enhancement with Groq or Gemini',
    )
    parser.add_argument('prompt', nargs='?', help='Text to enhance (omit to read from stdin)')
    parser.add_argument(
        '--action', '-a',
        choices=['Enhance', 'Professional', 'Code', 'Shorten', 'Creative'],
        default='Enhance',
        help='Enhancement action (default: Enhance)',
    )
    parser.add_argument(
        '--provider', '-p',
        choices=['groq', 'gemini'],
        default=None,
        help='AI provider: groq or gemini (auto-detected from env vars if not set)',
    )
    parser.add_argument('--clipboard', '-c', action='store_true', help='Copy result to clipboard')
    parser.add_argument('--quiet', '-q', action='store_true', help='Only output the enhanced text')
    parser.add_argument(
        '--backend', '-b',
        help='Use backend URL instead of calling the AI provider directly (BYOK — uses your local API key)',
    )
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

    # Resolve provider and API key
    groq_key = os.environ.get('GROQ_API_KEY', '')
    gemini_key = os.environ.get('GEMINI_API_KEY', '')

    if args.provider:
        provider = args.provider
    elif groq_key:
        provider = 'groq'
    elif gemini_key:
        provider = 'gemini'
    else:
        provider = 'gemini'  # will fail below with a helpful message

    if not args.quiet:
        print(f'[PromptEnhancer] Action: {args.action} | Provider: {provider} | Length: {len(text)} chars', file=sys.stderr)

    try:
        if args.backend:
            api_key = groq_key if provider == 'groq' else gemini_key
            if not api_key:
                env = 'GROQ_API_KEY' if provider == 'groq' else 'GEMINI_API_KEY'
                print(f'ERROR: {env} environment variable not set.', file=sys.stderr)
                sys.exit(1)
            enhanced = enhance_with_backend(text, args.action, args.backend, api_key, provider)
        elif provider == 'groq':
            if not groq_key:
                print(
                    'ERROR: GROQ_API_KEY environment variable not set.\n'
                    'Get a free key at https://console.groq.com/keys\n'
                    'Then run: export GROQ_API_KEY="gsk_..."',
                    file=sys.stderr,
                )
                sys.exit(1)
            enhanced = enhance_with_groq(text, args.action, groq_key)
        else:
            if not gemini_key:
                print(
                    'ERROR: No API key found. Set one of:\n'
                    '  GROQ_API_KEY=gsk_...      (https://console.groq.com/keys)\n'
                    '  GEMINI_API_KEY=AIzaSy...   (https://aistudio.google.com/apikey)',
                    file=sys.stderr,
                )
                sys.exit(1)
            enhanced = enhance_with_gemini(text, args.action, gemini_key)

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
