import { createRoot } from 'react-dom/client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, Briefcase, Scissors, Loader2, Zap, Code, Copy, Check, RotateCcw } from 'lucide-react';
import styleText from './index.css?inline';

console.log('[PromptEnhancer Pro] Content script loaded on', window.location.hostname);

// ======================== PLATFORM-SPECIFIC SELECTORS ========================
// These are the exact selectors for each AI platform's input field.
// This is the KEY to making the extension work on every AI platform.

const AI_PLATFORM_SELECTORS = [
  // ChatGPT (chat.openai.com & chatgpt.com)
  'div#prompt-textarea[contenteditable="true"]',
  'div[data-placeholder="Message ChatGPT"][contenteditable="true"]',
  'textarea[data-id="root"]',
  
  // Claude (claude.ai)
  'div.ProseMirror[contenteditable="true"]',
  'div[contenteditable="true"][data-placeholder]',
  'fieldset div[contenteditable="true"]',
  
  // Gemini (gemini.google.com)
  'div.ql-editor[contenteditable="true"]',
  'rich-textarea div[contenteditable="true"]',
  'div[role="textbox"][contenteditable="true"]',
  
  // Perplexity (perplexity.ai)
  'textarea[placeholder*="Ask"]',
  'textarea.overflow-auto',
  
  // Microsoft Copilot
  'textarea[data-testid]',
  'cib-serp textarea',
  
  // Poe
  'div[class*="ChatMessageInputView"] textarea',
  'textarea[class*="TextArea"]',
  
  // Generic fallbacks
  'textarea',
  'div[contenteditable="true"][role="textbox"]',
  'input[type="text"]',
];

// ======================== TEXT UTILITIES ========================

function getTextFromElement(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  return el.innerText || el.textContent || '';
}

function injectText(element: HTMLElement, newText: string) {
  element.focus();

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    // Native textarea/input
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement?.prototype || window.HTMLInputElement?.prototype,
      'value'
    )?.set;
    
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, newText);
    } else {
      element.value = newText;
    }
    
    // Fire all the events React listens to
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    // For React 16+ synthetic events
    const nativeEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: newText,
    });
    element.dispatchEvent(nativeEvent);
  } else if (element.isContentEditable) {
    // ContentEditable (ChatGPT, Claude, Gemini)
    const selection = window.getSelection();
    const range = document.createRange();
    
    // Select all content
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    // Try execCommand first (works best with ProseMirror/React)
    const success = document.execCommand('insertText', false, newText);
    
    if (!success) {
      // Fallback: direct DOM manipulation
      element.innerHTML = '';
      const textNode = document.createTextNode(newText);
      element.appendChild(textNode);
      
      // Move cursor to end
      const newRange = document.createRange();
      newRange.selectNodeContents(element);
      newRange.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(newRange);
    }
    
    // Fire events
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    
    // Dispatch InputEvent for frameworks
    try {
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: newText,
      }));
    } catch(_) { /* some browsers don't support all InputEvent options */ }
  }
}

// ======================== ELEMENT DETECTION ========================

function isValidInputElement(el: HTMLElement): boolean {
  if (!el) return false;
  
  // Skip tiny inputs (like search boxes)
  const rect = el.getBoundingClientRect();
  if (rect.width < 100 || rect.height < 20) return false;
  
  // Skip hidden elements
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  
  // Check if it's a valid text input
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement && el.type === 'text') return true;
  if (el.isContentEditable && el.getAttribute('role') !== 'option') return true;
  
  return false;
}

function findActiveInput(): HTMLElement | null {
  // First: try the currently focused element
  const active = document.activeElement as HTMLElement;
  if (active && isValidInputElement(active)) return active;
  
  // Second: try platform-specific selectors (most reliable)
  for (const selector of AI_PLATFORM_SELECTORS) {
    try {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      for (const el of elements) {
        if (isValidInputElement(el)) return el;
      }
    } catch(e) {
      // Invalid selector, skip
    }
  }
  
  return null;
}

// Check if we're on an AI platform for enhanced behavior
function isAIPlatform(): boolean {
  const hostname = window.location.hostname;
  return [
    'chatgpt.com', 'chat.openai.com',
    'claude.ai',
    'gemini.google.com',
    'perplexity.ai', 'www.perplexity.ai',
    'copilot.microsoft.com',
    'poe.com',
  ].some(h => hostname.includes(h));
}

// ======================== PROMPT ACTIONS ========================

interface PromptAction {
  id: string;
  label: string;
  icon: 'enhance' | 'professional' | 'shorten' | 'code' | 'creative';
  color: string;
  description: string;
}

const PROMPT_ACTIONS: PromptAction[] = [
  {
    id: 'Enhance',
    label: 'Enhance Prompt',
    icon: 'enhance',
    color: '#8B5CF6',
    description: 'Structured & detailed',
  },
  {
    id: 'Professional',
    label: 'Make Professional',
    icon: 'professional',
    color: '#3B82F6',
    description: 'Corporate & polished',
  },
  {
    id: 'Shorten',
    label: 'Shorten & Refine',
    icon: 'shorten',
    color: '#10B981',
    description: 'Concise & punchy',
  },
  {
    id: 'Code',
    label: 'Code Prompt',
    icon: 'code',
    color: '#F59E0B',
    description: 'Technical & precise',
  },
  {
    id: 'Creative',
    label: 'Creative Boost',
    icon: 'creative',
    color: '#EC4899',
    description: 'Imaginative & vivid',
  },
];

// ======================== REACT OVERLAY ========================

function PromptEnhancerOverlay({ hostElement }: { hostElement: HTMLElement }) {
  const [activeEl, setActiveEl] = useState<HTMLElement | null>(null);
  const [buttonPos, setButtonPos] = useState({ top: -9999, left: -9999 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [showUndo, setShowUndo] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const positionIntervalRef = useRef<number | null>(null);

  const updatePosition = useCallback((el: HTMLElement) => {
    if (!el || !document.body.contains(el)) return;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      setButtonPos({
        top: rect.bottom + window.scrollY - 40,
        left: rect.right + window.scrollX - 40,
      });
    } catch(e) {
      // Element may be detached
    }
  }, []);

  // ---- Main Effect: detect inputs ----
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (hostElement.contains(target)) return;
      
      if (isValidInputElement(target)) {
        setActiveEl(target);
        updatePosition(target);
        setIsMenuOpen(false);
        setShowUndo(false);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (hostElement.contains(target)) return;
      
      const clickedInsideMenu = menuRef.current?.contains(target);
      if (!clickedInsideMenu) {
        setIsMenuOpen(false);
      }
    };
    
    // Periodic scan for AI platform inputs (they load dynamically)
    const scanForInputs = () => {
      if (activeEl && document.body.contains(activeEl)) {
        updatePosition(activeEl);
        return;
      }
      
      // On AI platforms, actively find the input
      if (isAIPlatform()) {
        const input = findActiveInput();
        if (input) {
          setActiveEl(input);
          updatePosition(input);
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('click', handleClick, true);
    
    // Scan every 500ms on AI platforms to catch dynamically loaded editors
    const scanInterval = setInterval(scanForInputs, 500);
    
    // Also observe DOM changes
    const observer = new MutationObserver(() => {
      if (isAIPlatform() && !activeEl) {
        const input = findActiveInput();
        if (input) {
          setActiveEl(input);
          updatePosition(input);
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['contenteditable', 'class'],
    });

    const handleResizeOrScroll = () => {
      if (activeEl) updatePosition(activeEl);
    };
    
    window.addEventListener('resize', handleResizeOrScroll);
    document.addEventListener('scroll', handleResizeOrScroll, true);

    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('resize', handleResizeOrScroll);
      document.removeEventListener('scroll', handleResizeOrScroll, true);
      clearInterval(scanInterval);
      observer.disconnect();
    };
  }, [activeEl, hostElement, updatePosition]);

  // ---- Keep button position updated ----
  useEffect(() => {
    if (activeEl) {
      positionIntervalRef.current = window.setInterval(() => {
        updatePosition(activeEl);
      }, 200);
    }
    return () => {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
    };
  }, [activeEl, updatePosition]);

  const handleAction = async (actionId: string) => {
    if (!activeEl) return;
    
    const currentText = getTextFromElement(activeEl);
    if (!currentText.trim()) return;

    setOriginalText(currentText);
    setIsProcessing(true);
    setIsMenuOpen(false);
    
    // Show processing indicator in the input
    injectText(activeEl, '✨ Enhancing your prompt...');

    try {
      const port = chrome.runtime.connect({ name: 'enhance-stream' });
      
      port.postMessage({
        action: 'startStream',
        promptType: actionId,
        text: currentText,
      });

      port.onMessage.addListener((msg) => {
        if (msg.type === 'chunk' && msg.text) {
          injectText(activeEl, msg.text);
        } else if (msg.type === 'done') {
          setIsProcessing(false);
          setShowUndo(true);
          
          // Save to history
          chrome.runtime.sendMessage({
            action: 'saveHistory',
            original: currentText,
            enhanced: msg.text,
            type: actionId,
          });
          
          port.disconnect();
          
          // Auto-hide undo after 10 seconds
          setTimeout(() => setShowUndo(false), 10000);
        } else if (msg.type === 'error') {
          console.error('[PromptEnhancer Pro] Error:', msg.error);
          injectText(activeEl, currentText);
          setIsProcessing(false);
          port.disconnect();
        }
      });
    } catch (err) {
      console.error('[PromptEnhancer Pro] Connection error:', err);
      injectText(activeEl, currentText);
      setIsProcessing(false);
    }
  };

  const handleUndo = () => {
    if (activeEl && originalText) {
      injectText(activeEl, originalText);
      setShowUndo(false);
    }
  };

  const handleCopy = () => {
    if (activeEl) {
      const text = getTextFromElement(activeEl);
      navigator.clipboard.writeText(text).then(() => {
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 1500);
      });
    }
  };

  const getActionIcon = (iconType: string) => {
    const props = { className: 'pe-action-icon', strokeWidth: 1.5 };
    switch (iconType) {
      case 'enhance': return <Wand2 {...props} />;
      case 'professional': return <Briefcase {...props} />;
      case 'shorten': return <Scissors {...props} />;
      case 'code': return <Code {...props} />;
      case 'creative': return <Zap {...props} />;
      default: return <Sparkles {...props} />;
    }
  };

  if (!activeEl) return null;

  return (
    <div 
      style={{ 
        position: 'absolute', 
        top: buttonPos.top, 
        left: buttonPos.left, 
        zIndex: 2147483647,
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, system-ui, sans-serif",
      }}
    >
      {/* ---- Main Sparkle Button ---- */}
      <AnimatePresence>
        {!isMenuOpen && !isProcessing && !showUndo && (
          <motion.button 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(true); }}
            style={{
              width: 36, height: 36,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isHovered ? '1px solid #8B5CF6' : '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              background: isHovered 
                ? 'linear-gradient(135deg, #8B5CF6, #6D28D9)' 
                : 'rgba(24, 24, 27, 0.85)',
              boxShadow: isHovered 
                ? '0 0 20px rgba(139, 92, 246, 0.5), 0 4px 12px rgba(0,0,0,0.4)' 
                : '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
              outline: 'none',
              padding: 0,
            }}
            title="PromptEnhancer Pro"
          >
            <Sparkles 
              style={{ 
                width: 18, height: 18, 
                color: isHovered ? '#fff' : '#A78BFA',
                filter: isHovered ? 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' : 'none',
              }} 
              strokeWidth={1.5} 
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ---- Loading Spinner ---- */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            style={{
              width: 36, height: 36,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              background: 'rgba(24, 24, 27, 0.9)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 0 15px rgba(139, 92, 246, 0.3)',
            }}
          >
            <Loader2 
              style={{ width: 18, height: 18, color: '#8B5CF6', animation: 'spin 1s linear infinite' }}
              strokeWidth={2}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Undo/Copy Bar ---- */}
      <AnimatePresence>
        {showUndo && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              borderRadius: 12,
              background: 'rgba(24, 24, 27, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            <button
              onMouseDown={(e) => { e.preventDefault(); handleUndo(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', borderRadius: 8,
                background: 'transparent', border: 'none',
                color: '#A1A1AA', cursor: 'pointer', fontSize: 12,
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A1A1AA'; }}
            >
              <RotateCcw style={{ width: 14, height: 14 }} strokeWidth={1.5} />
              Undo
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleCopy(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', borderRadius: 8,
                background: 'transparent', border: 'none',
                color: '#A1A1AA', cursor: 'pointer', fontSize: 12,
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A1A1AA'; }}
            >
              {showCopied ? <Check style={{ width: 14, height: 14, color: '#10B981' }} strokeWidth={2} /> : <Copy style={{ width: 14, height: 14 }} strokeWidth={1.5} />}
              {showCopied ? 'Copied!' : 'Copy'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Action Menu ---- */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              position: 'absolute',
              bottom: 4,
              right: 0,
              background: 'rgba(15, 15, 18, 0.98)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 16,
              padding: 6,
              width: 220,
              boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 30px rgba(139, 92, 246, 0.08)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '8px 12px 6px',
              fontSize: 10,
              fontWeight: 600,
              color: 'rgba(161, 161, 170, 0.8)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'inherit',
            }}>
              Magic Actions
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {PROMPT_ACTIONS.map((action) => (
                <ActionButton
                  key={action.id}
                  icon={getActionIcon(action.icon)}
                  label={action.label}
                  description={action.description}
                  color={action.color}
                  onClick={() => handleAction(action.id)}
                />
              ))}
            </div>

            {/* Footer */}
            <div style={{
              marginTop: 6,
              padding: '6px 12px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#10B981',
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
              }} />
              <span style={{ fontSize: 10, color: 'rgba(161,161,170,0.6)', fontFamily: 'inherit' }}>
                PromptEnhancer Pro v2.0
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyframe for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ======================== ACTION BUTTON ========================

function ActionButton({ 
  icon, label, description, color, onClick 
}: { 
  icon: React.ReactNode; label: string; description: string; color: string; onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button 
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        fontSize: 13,
        color: '#FAFAFA',
        background: isHovered ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: 'none',
        borderRadius: 10,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        transition: 'all 0.15s ease',
        fontFamily: 'inherit',
        outline: 'none',
      }}
    >
      <span style={{ 
        color: color,
        display: 'flex',
        alignItems: 'center',
        transition: 'transform 0.15s ease',
        transform: isHovered ? 'scale(1.15)' : 'scale(1)',
        width: 18, height: 18,
      }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ fontWeight: 500, letterSpacing: '-0.01em', display: 'block', lineHeight: 1.3 }}>
          {label}
        </span>
        <span style={{ 
          fontSize: 10, color: 'rgba(161,161,170,0.6)', 
          display: 'block', lineHeight: 1.2, marginTop: 1,
        }}>
          {description}
        </span>
      </span>
    </button>
  );
}

// ======================== INITIALIZATION ========================

function init() {
  // Prevent double-initialization
  if (document.getElementById('prompt-enhancer-root')) return;
  
  const container = document.createElement('div');
  container.id = 'prompt-enhancer-root';
  container.style.cssText = 'position: absolute; top: 0; left: 0; z-index: 2147483647; pointer-events: none;';
  document.body.appendChild(container);
  
  const shadowRoot = container.attachShadow({ mode: 'open' });
  
  // Inject styles
  const style = document.createElement('style');
  style.textContent = styleText + `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    div, button, span { pointer-events: auto; }
    .pe-action-icon { width: 16px; height: 16px; }
  `;
  shadowRoot.appendChild(style);

  const reactRoot = document.createElement('div');
  reactRoot.style.cssText = 'position: relative;';
  shadowRoot.appendChild(reactRoot);
  
  const root = createRoot(reactRoot);
  root.render(<PromptEnhancerOverlay hostElement={container} />);
  
  console.log('[PromptEnhancer Pro] Overlay initialized');
}

// Start when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
