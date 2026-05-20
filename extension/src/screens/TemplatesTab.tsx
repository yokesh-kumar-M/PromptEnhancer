import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Copy, Check, Plus, Pencil, Trash2, X, BookOpen, AlertCircle,
} from 'lucide-react';
import type { Template } from '../lib/types';
import { CATEGORIES } from '../lib/constants';

interface Props {
  templates: Template[];
  isLoggedIn: boolean;
  onCreate: (t: Omit<Template, 'id'>) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Template>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

interface DraftState {
  id?: string;
  shortcut: string;
  title: string;
  content: string;
  category: string;
}

const BLANK: DraftState = { shortcut: '', title: '', content: '', category: 'custom' };

export function TemplatesTab({ templates, isLoggedIn, onCreate, onUpdate, onDelete }: Props) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<DraftState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return templates;
    return templates.filter((t) =>
      t.title.toLowerCase().includes(s) ||
      t.shortcut.toLowerCase().includes(s) ||
      t.category.toLowerCase().includes(s) ||
      t.content.toLowerCase().includes(s)
    );
  }, [templates, search]);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const startNew = () => { setEditing(BLANK); setError(''); };
  const startEdit = (t: Template) => {
    setEditing({ id: t.id, shortcut: t.shortcut, title: t.title, content: t.content, category: t.category });
    setError('');
  };
  const cancel = () => { setEditing(null); setError(''); };

  const save = async () => {
    if (!editing) return;
    const shortcut = editing.shortcut.trim();
    const title = editing.title.trim();
    const content = editing.content.trim();
    if (!shortcut || !title || !content) {
      setError('Shortcut, title and content are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const normalized = shortcut.startsWith('//') ? shortcut : `//${shortcut.replace(/^\/+/, '')}`;
      if (editing.id) {
        await onUpdate(editing.id, { shortcut: normalized, title, content, category: editing.category });
      } else {
        await onCreate({ shortcut: normalized, title, content, category: editing.category });
      }
      setEditing(null);
    } catch (err) {
      setError((err as Error).message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div key="templates" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
      <div className="history-toolbar">
        <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
          <Search style={{ width: 13, height: 13, color: 'var(--text-3)' }} strokeWidth={1.5} />
          <input
            type="text"
            className="search-input"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="history-toolbtn" onClick={startNew} title="New template">
          <Plus style={{ width: 13, height: 13 }} strokeWidth={2} />
        </button>
      </div>

      <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-3)', paddingLeft: 2 }}>
        Type a shortcut (e.g. <code className="kbd">//code</code>) in any AI chat to auto-insert.
        {!isLoggedIn && <span style={{ color: '#F59E0B', marginLeft: 4 }}>· Sign in to sync.</span>}
      </div>

      <div className="template-list">
        {filtered.length === 0 && (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <BookOpen style={{ width: 28, height: 28, color: '#3F3F46' }} strokeWidth={1} />
            <p style={{ fontSize: 12 }}>No templates</p>
            <span>Click + to add your first one</span>
          </div>
        )}
        {filtered.map((t) => (
          <div key={t.id} className="template-item">
            <div className="template-header">
              <span className="template-shortcut">{t.shortcut}</span>
              <span className="template-category">{t.category}</span>
            </div>
            <div className="template-title">{t.title}</div>
            <div className="template-content">{t.content.substring(0, 100)}{t.content.length > 100 ? '…' : ''}</div>
            <div className="template-actions">
              <button className="template-copy-btn" onClick={() => copy(t.content, t.id)}>
                {copiedId === t.id
                  ? <><Check style={{ width: 12, height: 12, color: '#10B981' }} strokeWidth={2} /> Copied</>
                  : <><Copy style={{ width: 12, height: 12 }} strokeWidth={1.5} /> Copy</>}
              </button>
              <button className="template-action-btn" onClick={() => startEdit(t)} title="Edit">
                <Pencil style={{ width: 12, height: 12 }} strokeWidth={1.7} />
              </button>
              <button className="template-action-btn danger" onClick={() => onDelete(t.id)} title="Delete">
                <Trash2 style={{ width: 12, height: 12 }} strokeWidth={1.7} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editing && (
          <div className="modal-overlay" onClick={cancel}>
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  {editing.id ? 'Edit Template' : 'New Template'}
                </span>
                <button className="icon-btn" onClick={cancel}>
                  <X style={{ width: 14, height: 14 }} strokeWidth={2} />
                </button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className="auth-label">Shortcut</label>
                  <input
                    className="input"
                    placeholder="//yourcommand"
                    value={editing.shortcut}
                    onChange={(e) => setEditing({ ...editing, shortcut: e.target.value })}
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label className="auth-label">Title</label>
                  <input
                    className="input"
                    placeholder="What this template does"
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="auth-label">Category</label>
                  <select
                    className="input"
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="auth-label">Content</label>
                  <textarea
                    className="enhance-input"
                    rows={5}
                    placeholder="The full template text the shortcut should insert…"
                    value={editing.content}
                    onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  />
                </div>
                {error && (
                  <div className="auth-error">
                    <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} strokeWidth={1.5} />
                    <span>{error}</span>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-ghost-muted" onClick={cancel}>Cancel</button>
                <button className="btn-primary" onClick={save} disabled={saving} style={{ width: 'auto', padding: '0 14px' }}>
                  {saving ? 'Saving…' : editing.id ? 'Save changes' : 'Create'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
