import * as vscode from 'vscode';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// ======================== SYSTEM PROMPTS ========================

const SYSTEM_PROMPTS: Record<string, string> = {
  Enhance: `You are a world-class prompt engineer. Transform the user's vague request into a highly structured, context-rich prompt optimized for AI models.

Rules:
- Add clear context, constraints, and desired output format
- Include role definition, task description, and success criteria
- Use markdown formatting where appropriate
- Return ONLY the enhanced prompt, no explanations or preambles
- Make it 3-5x more detailed than the original`,

  Professional: `You are an expert business communications specialist. Rewrite the user's text to be highly professional, articulate, and suitable for corporate environments.

Rules:
- Use formal but natural language
- Maintain the original meaning
- Fix grammar, tone, and structure
- Return ONLY the rewritten text
- Keep it concise yet impactful`,

  Code: `You are a senior software architect. Transform the user's request into a precise, technical prompt optimized for code generation.

Rules:
- Specify programming language, framework, and version if known
- Include input/output specifications
- Add error handling and edge case requirements
- Request code documentation and type annotations
- Return ONLY the enhanced technical prompt`,

  Shorten: `You are a concise writing expert. Shorten the user's text while preserving ALL key information.

Rules:
- Cut unnecessary words and redundancies
- Use active voice
- Maintain the core message
- Return ONLY the shortened text
- Aim for 40-60% of original length`,

  Creative: `You are a creative writing virtuoso. Transform the user's text into something vivid, imaginative, and emotionally engaging.

Rules:
- Use sensory language and powerful metaphors
- Add emotional depth and narrative flair
- Maintain the original intent
- Return ONLY the enhanced text
- Make it memorable and share-worthy`,
};

// ======================== GROQ (OpenAI-compatible) ========================

async function callGroqEnhance(apiKey: string, text: string, action: string, model: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const https = require('https') as typeof import('https');
  const m = model || 'llama-3.3-70b-versatile';
  const body = JSON.stringify({
    model: m,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS[action] || SYSTEM_PROMPTS['Enhance'] },
      { role: 'user', content: text },
    ],
    temperature: action === 'Creative' ? 0.9 : 0.7,
    max_tokens: 4096,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            const msg: string = parsed.error?.message || `Groq API error ${res.statusCode}`;
            if (res.statusCode === 401) { reject(new Error('Invalid Groq API key. Run "PromptEnhancer: Set API Key".')); return; }
            if (res.statusCode === 429) { reject(new Error('Groq rate limit reached. Try again in a moment.')); return; }
            reject(new Error(msg));
          } else {
            resolve(parsed.choices[0].message.content as string);
          }
        } catch (e) {
          reject(new Error('Failed to parse Groq response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ======================== HELPERS ========================

function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('promptenhancer');
}

async function getApiKeyAndProvider(context: vscode.ExtensionContext): Promise<{ apiKey: string; provider: string } | undefined> {
  const cfg = getConfig();
  const provider = cfg.get<string>('provider') || 'gemini';

  if (provider === 'groq') {
    const fromConfig = cfg.get<string>('groqApiKey');
    if (fromConfig?.trim()) return { apiKey: fromConfig.trim(), provider: 'groq' };
    const fromSecrets = await context.secrets.get('promptenhancer.groqApiKey');
    if (fromSecrets?.trim()) return { apiKey: fromSecrets.trim(), provider: 'groq' };
  } else {
    const fromConfig = cfg.get<string>('geminiApiKey');
    if (fromConfig?.trim()) return { apiKey: fromConfig.trim(), provider: 'gemini' };
    const fromSecrets = await context.secrets.get('promptenhancer.geminiApiKey');
    if (fromSecrets?.trim()) return { apiKey: fromSecrets.trim(), provider: 'gemini' };
  }

  return undefined;
}

function getGeminiModel(apiKey: string): GenerativeModel {
  const modelName = getConfig().get<string>('geminiModel') || 'gemini-2.5-flash';
  const client = new GoogleGenerativeAI(apiKey);
  return client.getGenerativeModel({ model: modelName });
}

async function enhance(text: string, action: string, apiKey: string, provider: string): Promise<string> {
  if (provider === 'groq') {
    const model = getConfig().get<string>('groqModel') || 'llama-3.3-70b-versatile';
    return callGroqEnhance(apiKey, text, action, model);
  }
  const model = getGeminiModel(apiKey);
  const systemPrompt = SYSTEM_PROMPTS[action] || SYSTEM_PROMPTS['Enhance'];
  const result = await model.generateContent([systemPrompt, text]);
  return result.response.text();
}

async function getSelectionOrInput(editor: vscode.TextEditor): Promise<string | undefined> {
  const selection = editor.selection;
  if (!selection.isEmpty) {
    return editor.document.getText(selection);
  }
  return vscode.window.showInputBox({
    prompt: 'Enter the prompt to enhance',
    placeHolder: 'Type your prompt here...',
  });
}

async function insertResult(
  editor: vscode.TextEditor,
  result: string,
  originalSelection: vscode.Selection,
): Promise<void> {
  const insertMode = getConfig().get<string>('insertMode') || 'replace';

  if (insertMode === 'clipboard') {
    await vscode.env.clipboard.writeText(result);
    vscode.window.showInformationMessage('✨ Enhanced text copied to clipboard!');
    return;
  }

  await editor.edit((editBuilder) => {
    if (insertMode === 'append') {
      const endPos = originalSelection.isEmpty
        ? editor.document.lineAt(originalSelection.end.line).range.end
        : originalSelection.end;
      editBuilder.insert(endPos, `\n\n${result}`);
    } else {
      if (originalSelection.isEmpty) {
        const lineRange = editor.document.lineAt(originalSelection.start.line).range;
        editBuilder.replace(lineRange, result);
      } else {
        editBuilder.replace(originalSelection, result);
      }
    }
  });
}

// ======================== COMMAND FACTORY ========================

function makeEnhanceCommand(
  action: string,
  context: vscode.ExtensionContext,
): () => Promise<void> {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('PromptEnhancer: No active editor found.');
      return;
    }

    const keyAndProvider = await getApiKeyAndProvider(context);
    if (!keyAndProvider) {
      const cfg = getConfig();
      const provider = cfg.get<string>('provider') || 'gemini';
      const getKeyUrl = provider === 'groq'
        ? 'https://console.groq.com/keys'
        : 'https://aistudio.google.com/apikey';
      const choice = await vscode.window.showErrorMessage(
        `PromptEnhancer: No ${provider === 'groq' ? 'Groq' : 'Gemini'} API key configured.`,
        'Set API Key',
        'Get Free Key',
      );
      if (choice === 'Set API Key') {
        vscode.commands.executeCommand('promptenhancer.setApiKey');
      } else if (choice === 'Get Free Key') {
        vscode.env.openExternal(vscode.Uri.parse(getKeyUrl));
      }
      return;
    }

    const originalSelection = editor.selection;
    const text = await getSelectionOrInput(editor);
    if (!text?.trim()) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `✨ PromptEnhancer (${keyAndProvider.provider}): ${action}ing...`,
        cancellable: false,
      },
      async () => {
        try {
          const result = await enhance(text, action, keyAndProvider.apiKey, keyAndProvider.provider);
          await insertResult(editor, result, originalSelection);
          vscode.window.setStatusBarMessage(`✨ PromptEnhancer: ${action} complete!`, 3000);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Enhancement failed';
          vscode.window.showErrorMessage(`PromptEnhancer: ${msg}`);
        }
      },
    );
  };
}

// ======================== ACTIVATION ========================

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(sparkle) PE';
  statusBar.tooltip = 'PromptEnhancer Pro — Click to enhance selection';
  statusBar.command = 'promptenhancer.enhance';
  statusBar.show();
  context.subscriptions.push(statusBar);

  const commands: [string, string][] = [
    ['promptenhancer.enhance', 'Enhance'],
    ['promptenhancer.professional', 'Professional'],
    ['promptenhancer.code', 'Code'],
    ['promptenhancer.shorten', 'Shorten'],
    ['promptenhancer.creative', 'Creative'],
  ];

  for (const [id, action] of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, makeEnhanceCommand(action, context)),
    );
  }

  // Set API Key command — handles both Groq and Gemini based on current provider setting
  context.subscriptions.push(
    vscode.commands.registerCommand('promptenhancer.setApiKey', async () => {
      const providerChoice = await vscode.window.showQuickPick(
        [
          { label: '⚡ Groq', description: 'llama-3.3-70b-versatile · 14,400 req/day free', value: 'groq' },
          { label: '✦ Gemini', description: 'gemini-2.5-flash · free tier available', value: 'gemini' },
        ],
        { placeHolder: 'Select AI provider' },
      );
      if (!providerChoice) return;

      const providerLabel = providerChoice.value === 'groq' ? 'Groq' : 'Gemini';
      const placeholder = providerChoice.value === 'groq' ? 'gsk_…' : 'AIzaSy…';

      const key = await vscode.window.showInputBox({
        prompt: `Enter your ${providerLabel} API key`,
        placeHolder: placeholder,
        password: true,
        validateInput: (v) => (v.trim().length > 10 ? null : 'API key looks too short'),
      });
      if (!key) return;

      const secretKey = `promptenhancer.${providerChoice.value}ApiKey`;
      await context.secrets.store(secretKey, key.trim());

      await vscode.workspace.getConfiguration('promptenhancer').update(
        'provider',
        providerChoice.value,
        vscode.ConfigurationTarget.Global,
      );

      vscode.window.showInformationMessage(
        `✅ PromptEnhancer: ${providerLabel} API key saved! Provider set to ${providerChoice.value}.`,
      );
    }),
  );

  vscode.window.showInformationMessage('✨ PromptEnhancer Pro activated! Press Ctrl+Shift+E to enhance.');
}

export function deactivate(): void {}
