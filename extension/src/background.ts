console.log('[PromptEnhancer Pro] Background service worker initialized.');

// ======================== CONFIG ========================

const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://promptenhancer-backend.onrender.com';

// ======================== SYSTEM PROMPTS ========================

const SYSTEM_PROMPTS: Record<string, string> = {
  Enhance:
    "You are a world-class prompt engineer. Transform the user's vague request into a highly structured, context-rich prompt optimized for AI models. Add clear context, constraints, and desired output format. Include role definition, task description, and success criteria. Use markdown formatting where appropriate. Return ONLY the enhanced prompt, no explanations or preambles. Make it 3-5x more detailed than the original.",
  Professional:
    "You are an expert business communications specialist. Rewrite the user's text to be highly professional, articulate, and suitable for corporate environments. Use formal but natural language. Maintain the original meaning. Fix grammar, tone, and structure. Return ONLY the rewritten text. Keep it concise yet impactful.",
  Shorten:
    "You are a concise writing expert. Shorten the user's text while preserving ALL key information. Cut unnecessary words and redundancies. Use active voice. Maintain the core message. Return ONLY the shortened text. Aim for 40-60% of original length.",
  Code:
    "You are a senior software architect. Transform the user's request into a precise, technical prompt optimized for code generation. Specify programming language, framework, and version if known. Include input/output specifications. Add error handling and edge case requirements. Request code documentation and type annotations. Return ONLY the enhanced technical prompt.",
  Creative:
    "You are a creative writing virtuoso. Transform the user's text into something vivid, imaginative, and emotionally engaging. Use sensory language and powerful metaphors. Add emotional depth and narrative flair. Maintain the original intent. Return ONLY the enhanced text. Make it memorable and share-worthy.",
};

// ======================== INSTALLATION ========================

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[PromptEnhancer Pro] Extension installed:', details.reason);

  chrome.contextMenus.create({
    id: 'enhance-selection',
    title: '✨ Enhance with PromptEnhancer Pro',
    contexts: ['selection'],
  });

  if (details.reason === 'install') {
    chrome.storage.local.set({
      promptHistory: [],
      customTemplates: DEFAULT_TEMPLATES,
      settings: {
        autoDetect: true,
        historyLimit: 50,
        backendUrl: 'https://promptenhancer-backend.onrender.com',
      },
      apiSettings: {
        provider: 'gemini',
        apiKey: '',
        model: '',
      },
    });
  }
});

// ======================== DEFAULT TEMPLATES ========================

const DEFAULT_TEMPLATES = [
  { id: '1', shortcut: '//code', title: 'Code Expert', content: 'You are an expert programmer. Write clean, well-documented, production-ready code for: ', category: 'coding' },
  { id: '2', shortcut: '//debug', title: 'Debug Helper', content: 'Analyze the following code and identify bugs, performance issues, and suggest fixes with explanations: ', category: 'coding' },
  { id: '3', shortcut: '//review', title: 'Code Review', content: 'Perform a thorough code review. Check for security issues, edge cases, naming conventions, and best practices: ', category: 'coding' },
  { id: '4', shortcut: '//email', title: 'Professional Email', content: 'Write a professional, concise email about the following topic. Use appropriate tone and formatting: ', category: 'writing' },
  { id: '5', shortcut: '//blog', title: 'Blog Post', content: 'Write an engaging, SEO-optimized blog post about the following topic. Include headers, bullet points, and a call to action: ', category: 'writing' },
  { id: '6', shortcut: '//explain', title: 'Explain Simply', content: 'Explain the following concept in simple terms that a beginner would understand. Use analogies and examples: ', category: 'learning' },
  { id: '7', shortcut: '//compare', title: 'Compare & Contrast', content: 'Create a detailed comparison of the following items. Include a table, pros/cons, and a recommendation: ', category: 'analysis' },
  { id: '8', shortcut: '//brainstorm', title: 'Brainstorm Ideas', content: 'Generate 10 creative and unique ideas for the following. Think outside the box and include brief explanations: ', category: 'creative' },
  { id: '9', shortcut: '//summarize', title: 'Summarize', content: 'Provide a clear, structured summary of the following content. Include key points, takeaways, and action items: ', category: 'analysis' },
  { id: '10', shortcut: '//refactor', title: 'Refactor Code', content: 'Refactor the following code to improve readability, performance, and maintainability. Explain each change: ', category: 'coding' },
  { id: '11', shortcut: '//test', title: 'Write Tests', content: 'Write comprehensive unit tests for the following code. Cover edge cases, error handling, and happy paths: ', category: 'coding' },
  { id: '12', shortcut: '//pitch', title: 'Elevator Pitch', content: 'Create a compelling 60-second elevator pitch for the following product/idea. Focus on the value proposition: ', category: 'business' },
  { id: '13', shortcut: '//seo', title: 'SEO Content', content: 'Optimize the following content for SEO. Include keyword suggestions, meta description, and heading structure: ', category: 'marketing' },
  { id: '14', shortcut: '//tweet', title: 'Twitter Thread', content: 'Create an engaging Twitter/X thread (5-8 tweets) about the following topic. Make it viral-worthy: ', category: 'social' },
  { id: '15', shortcut: '//linkedin', title: 'LinkedIn Post', content: 'Write a professional LinkedIn post about the following. Include a hook, story, insight, and CTA: ', category: 'social' },
];

// ======================== BYOK API CALLERS ========================

async function callGroqEnhance(
  apiKey: string,
  text: string,
  action: string,
  model: string,
): Promise<string> {
  const m = model || 'llama-3.3-70b-versatile';
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: m,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[action] || SYSTEM_PROMPTS.Enhance },
        { role: 'user', content: text },
      ],
      temperature: action === 'Creative' ? 0.9 : 0.7,
      max_tokens: 4096,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const msg = data.error?.message || `Groq API error ${response.status}`;
    if (response.status === 401) throw new Error('Invalid Groq API key. Check Settings.');
    if (response.status === 429) throw new Error('Groq rate limit reached. Try again in a moment.');
    throw new Error(msg);
  }
  return data.choices[0].message.content;
}

async function callGeminiEnhance(
  apiKey: string,
  text: string,
  action: string,
  model: string,
): Promise<string> {
  const m = model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPTS[action] || SYSTEM_PROMPTS.Enhance }] },
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        temperature: action === 'Creative' ? 0.9 : 0.7,
        maxOutputTokens: 4096,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const msg = data.error?.message || `Gemini API error ${response.status}`;
    if (response.status === 400 && msg.includes('API_KEY')) throw new Error('Invalid Gemini API key. Check Settings.');
    if (response.status === 429) throw new Error('Gemini quota exceeded. Try again later or switch to Groq.');
    throw new Error(msg);
  }
  return data.candidates[0].content.parts[0].text;
}

// ======================== USAGE LOGGING ========================

async function logUsage(
  backendUrl: string,
  inviteCode: string,
  action: string,
  provider: string,
  model: string,
  originalLen: number,
  enhancedLen: number,
  domain: string,
): Promise<void> {
  try {
    await fetch(`${backendUrl}/api/log-usage/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite_code: inviteCode,
        action,
        provider,
        model,
        original_len: originalLen,
        enhanced_len: enhancedLen,
        domain,
      }),
    });
  } catch {
    // Fire-and-forget: don't fail the user experience if logging fails
  }
}

// ======================== ENHANCE PORT HANDLER ========================

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'enhance-stream') return;

  const domain = (() => {
    try {
      return port.sender?.tab?.url ? new URL(port.sender.tab.url).hostname : '';
    } catch {
      return '';
    }
  })();

  port.onMessage.addListener(async (msg) => {
    if (msg.action !== 'startStream') return;

    chrome.storage.local.get(['inviteCode', 'settings', 'apiSettings'], async (result) => {
      const inviteCode = (result.inviteCode as string) || '';
      const settings = (result.settings as Record<string, unknown>) || {};
      const backendUrl = (settings.backendUrl as string) || DEFAULT_BACKEND_URL;
      const apiSettings = (result.apiSettings as { provider?: string; apiKey?: string; model?: string }) || {};
      const provider = apiSettings.provider || 'gemini';
      const apiKey = apiSettings.apiKey || '';
      const model = apiSettings.model || '';

      if (!inviteCode) {
        port.postMessage({
          type: 'error',
          error: 'No invite code set. Click the extension icon and enter your code.',
        });
        return;
      }

      if (!apiKey) {
        port.postMessage({
          type: 'error',
          error: 'No API key configured. Open the extension → Settings tab → add your Groq or Gemini key.',
        });
        return;
      }

      try {
        let enhanced: string;

        if (provider === 'groq') {
          enhanced = await callGroqEnhance(apiKey, msg.text, msg.promptType, model);
        } else {
          enhanced = await callGeminiEnhance(apiKey, msg.text, msg.promptType, model);
        }

        port.postMessage({ type: 'done', text: enhanced });

        const resolvedModel = model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-2.0-flash');
        logUsage(backendUrl, inviteCode, msg.promptType, provider, resolvedModel, msg.text.length, enhanced.length, domain);

      } catch (err: any) {
        port.postMessage({ type: 'error', error: err.message || 'Enhancement failed. Check your API key in Settings.' });
      }
    });
  });
});

// ======================== MESSAGE HANDLERS ========================

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'saveHistory') {
    chrome.storage.local.get(['promptHistory', 'settings'], (result) => {
      const history = (result.promptHistory || []) as any[];
      const settings = (result.settings || { historyLimit: 50 }) as { historyLimit: number };
      history.unshift({
        id: Date.now().toString(),
        original: request.original,
        enhanced: request.enhanced,
        type: request.type,
        timestamp: Date.now(),
        domain: request.domain || 'unknown',
      });
      const trimmed = history.slice(0, settings.historyLimit || 50);
      chrome.storage.local.set({ promptHistory: trimmed });
    });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'getTemplates') {
    chrome.storage.local.get(['customTemplates'], (result) => {
      sendResponse({ templates: result.customTemplates || DEFAULT_TEMPLATES });
    });
    return true;
  }

  if (request.action === 'getHistory') {
    chrome.storage.local.get(['promptHistory'], (result) => {
      sendResponse({ history: result.promptHistory || [] });
    });
    return true;
  }

  if (request.action === 'clearHistory') {
    chrome.storage.local.set({ promptHistory: [] });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'validateInvite') {
    chrome.storage.local.get(['settings'], async (result) => {
      const settings = (result.settings as Record<string, unknown>) || {};
      const backendUrl = (settings.backendUrl as string) || DEFAULT_BACKEND_URL;

      const tryFetch = async (attempt: number): Promise<void> => {
        try {
          const resp = await fetch(`${backendUrl}/api/validate-invite/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: request.code }),
            signal: AbortSignal.timeout(20000),
          });
          sendResponse(await resp.json());
        } catch {
          if (attempt < 2) {
            setTimeout(() => tryFetch(attempt + 1), 6000);
          } else {
            sendResponse({ valid: false, message: 'Backend unreachable. It may still be starting — try again in 30s.' });
          }
        }
      };

      tryFetch(0);
    });
    return true;
  }

  if (request.action === 'verifyApiKey') {
    chrome.storage.local.get(['settings'], async (result) => {
      const settings = (result.settings as Record<string, unknown>) || {};
      const backendUrl = (settings.backendUrl as string) || DEFAULT_BACKEND_URL;

      const tryFetch = async (attempt: number): Promise<void> => {
        try {
          const resp = await fetch(`${backendUrl}/api/verify-key/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: request.apiKey, provider: request.provider }),
            signal: AbortSignal.timeout(20000),
          });
          sendResponse(await resp.json());
        } catch {
          if (attempt < 2) {
            setTimeout(() => tryFetch(attempt + 1), 6000);
          } else {
            sendResponse({ valid: false, error: 'Backend unreachable. It may be starting — try again in 30s.' });
          }
        }
      };

      tryFetch(0);
    });
    return true;
  }

  return false;
});

// ======================== CONTEXT MENU ========================

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'enhance-selection' && info.selectionText && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'enhanceSelection',
      text: info.selectionText,
    });
  }
});
