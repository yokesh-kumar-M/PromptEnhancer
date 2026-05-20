import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, Trash2, Copy, Check, ChevronRight, Download,
  Wand2, Briefcase, Scissors, Code, Zap, Sparkles, X, Search, Filter,
} from 'lucide-react';
import type { HistoryItem } from '../lib/types';
import { MODES } from '../lib/constants';

interface Props {
  history: HistoryItem[];
  onDelete: (id: string, remoteId?: number) => Promise<void>;
  onClearAll: () => Promise<void>;
}

function typeIcon(type: string) {
  const s = { style: { width: 12, height: 12 }, strokeWidth: 2 as const };
  switch (type) {
    case 'Enhance': return <Wand2 {...s} style={{ ...s.style, color: '#8B5CF6' }} />;
    case 'Professional': return <Briefcase {...s} style={{ ...s.style, color: '#3B82F6' }} />;
    case 'Shorten': return <Scissors {...s} style={{ ...s.style, color: '#10B981' }} />;
    case 'Code': return <Code {...s} style={{ ...s.style, color: '#F59E0B' }} />;
    case 'Creative': return <Zap {...s} style={{ ...s.style, color: '#EC4899' }} />;
    default: return <Sparkles {...s} style={{ ...s.style, color: '#8B5CF6' }} />;
  }
}

function formatTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function HistoryTab({ history, onDelete, onClearAll }: Props) {
  const [filterMode, setFilterMode] = useState<string>('all');
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const domains = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => { if (h.domain) set.add(h.domain); });
    return Array.from(set).sort();
  }, [history]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return history.filter((h) => {
      if (filterMode !== 'all' && h.type !== filterMode) return false;
      if (filterDomain !== 'all' && h.domain !== filterDomain) return false;
      if (s && !h.original.toLowerCase().includes(s) && !h.enhanced.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [history, filterMode, filterDomain, search]);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promptenhancer-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <Clock style={{ width: 32, height: 32, color: '#3F3F46' }} strokeWidth={1} />
        <p>No history yet</p>
        <span>Enhanced prompts will appear here</span>
      </div>
    );
  }

  return (
    <motion.div key="history" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
      <div className="history-toolbar">
        <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
          <Search style={{ width: 13, height: 13, color: 'var(--text-3)' }} strokeWidth={1.5} />
          <input
            type="text"
            className="search-input"
            placeholder="Search history…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="icon-btn" onClick={() => setSearch('')}><X style={{ width: 11, height: 11 }} strokeWidth={2} /></button>}
        </div>
        <button className="history-toolbtn" onClick={exportJson} title="Export filtered as JSON">
          <Download style={{ width: 12, height: 12 }} strokeWidth={1.7} />
        </button>
      </div>

      <div className="filter-row">
        <Filter style={{ width: 11, height: 11, color: 'var(--text-3)' }} strokeWidth={1.7} />
        <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className="filter-select">
          <option value="all">All modes</option>
          {MODES.map((m) => <option key={m.mode} value={m.mode}>{m.mode}</option>)}
        </select>
        <select value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)} className="filter-select">
          <option value="all">All sites</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="history-header">
        <span className="history-count">
          {filtered.length === history.length
            ? `${history.length} entries`
            : `${filtered.length} of ${history.length}`}
        </span>
        {confirmingClear ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="text-btn danger" onClick={async () => { await onClearAll(); setConfirmingClear(false); }}>
              Confirm clear
            </button>
            <button className="text-btn" onClick={() => setConfirmingClear(false)}>Cancel</button>
          </div>
        ) : (
          <button className="text-btn danger" onClick={() => setConfirmingClear(true)}>
            <Trash2 style={{ width: 11, height: 11 }} /> Clear all
          </button>
        )}
      </div>

      <div className="history-list">
        {filtered.map((item) => (
          <div key={item.id} className="history-item">
            <div className="history-item-header">
              <div className="history-item-meta">
                {typeIcon(item.type)}
                <span className="history-type">{item.type}</span>
                {item.domain && item.domain !== 'popup' && (
                  <span className="history-domain">{item.domain}</span>
                )}
                <span className="history-time">{formatTime(item.timestamp)}</span>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <button className="icon-btn" onClick={() => copy(item.enhanced, item.id)} title="Copy enhanced">
                  {copiedId === item.id
                    ? <Check style={{ width: 12, height: 12, color: '#10B981' }} strokeWidth={2} />
                    : <Copy style={{ width: 12, height: 12 }} strokeWidth={1.5} />}
                </button>
                <button className="icon-btn" onClick={() => onDelete(item.id, item.remoteId)} title="Delete">
                  <Trash2 style={{ width: 12, height: 12 }} strokeWidth={1.7} />
                </button>
              </div>
            </div>
            <button className="history-body-btn" onClick={() => setSelected(item)}>
              <div className="history-original">{item.original.substring(0, 80)}{item.original.length > 80 ? '…' : ''}</div>
              <div className="history-enhanced">
                <ChevronRight style={{ width: 10, height: 10, color: '#8B5CF6', flexShrink: 0 }} />
                <span>{item.enhanced.substring(0, 110)}{item.enhanced.length > 110 ? '…' : ''}</span>
              </div>
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <p style={{ fontSize: 12 }}>No matches</p>
            <span>Adjust your filters or search</span>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <motion.div
            className="modal"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {typeIcon(selected.type)}
                <span style={{ fontWeight: 700, fontSize: 13 }}>{selected.type}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>· {formatTime(selected.timestamp)}</span>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}>
                <X style={{ width: 14, height: 14 }} strokeWidth={2} />
              </button>
            </div>
            <div className="modal-body">
              <div className="diff-pane">
                <div className="diff-label">Original</div>
                <div className="diff-text diff-orig">{selected.original}</div>
                <button className="diff-copy" onClick={() => copy(selected.original, `${selected.id}-o`)}>
                  {copiedId === `${selected.id}-o` ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="diff-pane">
                <div className="diff-label" style={{ color: '#A78BFA' }}>Enhanced</div>
                <div className="diff-text diff-enh">{selected.enhanced}</div>
                <button className="diff-copy" onClick={() => copy(selected.enhanced, `${selected.id}-e`)}>
                  {copiedId === `${selected.id}-e` ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="modal-footer">
              {selected.provider && <span>{selected.provider} · {selected.model || '—'}</span>}
              {selected.domain && selected.domain !== 'popup' && <span>{selected.domain}</span>}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
