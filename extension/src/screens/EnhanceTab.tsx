import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wand2, Briefcase, Scissors, Code, Zap, Copy, Check,
  RotateCcw, AlertCircle, Sparkles,
} from 'lucide-react';
import { MODES, DEFAULT_MODEL, type ModeDef } from '../lib/constants';
import type { CloudSettings, HistoryItem } from '../lib/types';

const MODE_ICONS: Record<ModeDef['mode'], React.ReactNode> = {
  Enhance: <Wand2 style={{ width: 13, height: 13 }} strokeWidth={1.7} />,
  Professional: <Briefcase style={{ width: 13, height: 13 }} strokeWidth={1.7} />,
  Shorten: <Scissors style={{ width: 13, height: 13 }} strokeWidth={1.7} />,
  Code: <Code style={{ width: 13, height: 13 }} strokeWidth={1.7} />,
  Creative: <Zap style={{ width: 13, height: 13 }} strokeWidth={1.7} />,
};

interface Props {
  cloudSettings: CloudSettings;
  onResult: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => Promise<void>;
}

export function EnhanceTab({ cloudSettings, onResult }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [mode, setMode] = useState<ModeDef['mode']>('Enhance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const activeKey = cloudSettings.preferred_provider === 'groq'
    ? cloudSettings.groq_api_key
    : cloudSettings.gemini_api_key;
  const hasApiKey = activeKey.length > 0;

  const run = async () => {
    if (!text.trim() || loading) return;
    if (!hasApiKey) {
      setError('Add your Groq or Gemini API key in Settings first.');
      return;
    }
    setLoading(true);
    setError('');
    setResult('');
    try {
      const enhanced = await new Promise<string>((resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          reject(new Error('Chrome runtime not available.'));
          return;
        }
        const port = chrome.runtime.connect({ name: 'enhance-stream' });
        let received = false;
        port.onMessage.addListener((msg: { type?: string; text?: string; error?: string }) => {
          if (msg.type === 'done') {
            received = true;
            port.disconnect();
            resolve(msg.text || '');
          } else if (msg.type === 'error') {
            received = true;
            port.disconnect();
            reject(new Error(msg.error || 'Enhancement failed'));
          }
        });
        port.onDisconnect.addListener(() => {
          if (!received) reject(new Error('Connection closed unexpectedly.'));
        });
        port.postMessage({ action: 'startStream', text: text.trim(), promptType: mode });
      });
      setResult(enhanced);
      await onResult({
        original: text.trim(),
        enhanced,
        type: mode,
        provider: cloudSettings.preferred_provider,
        model: cloudSettings.preferred_model || DEFAULT_MODEL[cloudSettings.preferred_provider],
        domain: 'popup',
      });
    } catch (err) {
      setError((err as Error).message || 'Enhancement failed.');
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const reset = () => { setText(''); setResult(''); setError(''); };

  return (
    <motion.div key="enhance" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
      {!hasApiKey && (
        <div className="warn-card" style={{ marginBottom: 10 }}>
          <AlertCircle style={{ width: 16, height: 16, color: '#F59E0B', flexShrink: 0, marginTop: 1 }} strokeWidth={1.5} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>API key needed</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Add a Groq or Gemini key in Settings.</div>
          </div>
        </div>
      )}

      <div className="card">
        <label className="card-label" style={{ marginBottom: 6 }}>
          <Sparkles style={{ width: 13, height: 13, color: '#A78BFA' }} strokeWidth={1.7} />
          Your prompt
        </label>
        <textarea
          className="enhance-input"
          placeholder="Paste or type your prompt here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
          <span>{text.length} chars</span>
          {text && <button className="reset-btn" onClick={reset}><RotateCcw style={{ width: 10, height: 10 }} strokeWidth={1.7} /> Clear</button>}
        </div>

        <div className="mode-pill-row" style={{ marginTop: 10 }}>
          {MODES.map((m) => (
            <button
              key={m.mode}
              className={`mode-pill ${mode === m.mode ? 'mode-pill-active' : ''}`}
              style={mode === m.mode ? { borderColor: m.color, color: m.color, background: `${m.color}1A` } : undefined}
              onClick={() => setMode(m.mode)}
              title={m.desc}
            >
              <span style={{ color: m.color, display: 'flex' }}>{MODE_ICONS[m.mode]}</span>
              {m.mode}
            </button>
          ))}
        </div>

        <button
          className="btn-primary"
          onClick={run}
          disabled={loading || !text.trim() || !hasApiKey}
          style={{ marginTop: 10 }}
        >
          {loading ? 'Enhancing…' : <><Sparkles style={{ width: 14, height: 14 }} strokeWidth={2} /> Enhance</>}
        </button>

        {error && (
          <div className="auth-error" style={{ marginTop: 10 }}>
            <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {result && (
        <div className="card" style={{ borderColor: 'rgba(139,92,246,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label className="card-label">
              <Check style={{ width: 13, height: 13, color: '#10B981' }} strokeWidth={2} />
              Enhanced
            </label>
            <button className="icon-btn" onClick={copyResult} title="Copy">
              {copied
                ? <Check style={{ width: 13, height: 13, color: '#10B981' }} strokeWidth={2} />
                : <Copy style={{ width: 13, height: 13 }} strokeWidth={1.7} />}
            </button>
          </div>
          <div className="result-text">{result}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 6 }}>
            <span>{result.length} chars</span>
            <span>{Math.round((result.length / Math.max(1, text.length)) * 100)}% of input</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
