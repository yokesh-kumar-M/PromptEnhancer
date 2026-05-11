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

// ======================== HELPERS ========================

function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('promptenhancer');
}

async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  const fromConfig = getConfig().get<string>('geminiApiKey');
  if (fromConfig?.trim()) return fromConfig.trim();

  const fromSecrets = await context.secrets.get('promptenhancer.geminiApiKey');
  if (fromSecrets?.trim()) return fromSecrets.trim();

  return undefined;
}

function getModel(apiKey: string): GenerativeModel {
  const modelName = getConfig().get<string>('model') || 'gemini-2.5-flash';
  const client = new GoogleGenerativeAI(apiKey);
  return client.getGenerativeModel({ model: modelName });
}

async function enhance(
  text: string,
  action: string,
  apiKey: string,
): Promise<string> {
  const model = getModel(apiKey);
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

    const apiKey = await getApiKey(context);
    if (!apiKey) {
      const choice = await vscode.window.showErrorMessage(
        'PromptEnhancer: No Gemini API key configured.',
        'Set API Key',
        'Get Free Key',
      );
      if (choice === 'Set API Key') {
        vscode.commands.executeCommand('promptenhancer.setApiKey');
      } else if (choice === 'Get Free Key') {
        vscode.env.openExternal(vscode.Uri.parse('https://aistudio.google.com/apikey'));
      }
      return;
    }

    const originalSelection = editor.selection;
    const text = await getSelectionOrInput(editor);
    if (!text?.trim()) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `✨ PromptEnhancer: ${action}ing...`,
        cancellable: false,
      },
      async () => {
        try {
          const result = await enhance(text, action, apiKey);
          await insertResult(editor, result, originalSelection);
          vscode.window.setStatusBarMessage(`✨ PromptEnhancer: ${action} complete!`, 3000);
        } catch (err: any) {
          vscode.window.showErrorMessage(`PromptEnhancer: ${err.message || 'Enhancement failed'}`);
        }
      },
    );
  };
}

// ======================== ACTIVATION ========================

export function activate(context: vscode.ExtensionContext): void {
  // Status bar item
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(sparkle) PE';
  statusBar.tooltip = 'PromptEnhancer Pro — Click to enhance selection';
  statusBar.command = 'promptenhancer.enhance';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Commands
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

  // Set API Key command
  context.subscriptions.push(
    vscode.commands.registerCommand('promptenhancer.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your Gemini API key',
        placeHolder: 'AIzaSy...',
        password: true,
        validateInput: (v) => (v.trim().length > 10 ? null : 'API key looks too short'),
      });
      if (!key) return;

      await context.secrets.store('promptenhancer.geminiApiKey', key.trim());
      vscode.window.showInformationMessage('✅ PromptEnhancer: API key saved securely!');
    }),
  );

  vscode.window.showInformationMessage('✨ PromptEnhancer Pro activated! Press Ctrl+Shift+E to enhance.');
}

export function deactivate(): void {}
