import { Sparkles, LogOut, User as UserIcon, ExternalLink } from 'lucide-react';
import type { User } from '../lib/types';
import { FRONTEND_URL } from '../lib/constants';

interface Props {
  user: User | null;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export function Header({ user, onLogout, onOpenLogin }: Props) {
  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-icon-wrap">
          <Sparkles className="header-icon" strokeWidth={1.5} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 className="header-title">PromptEnhancer Pro</h1>
          <p className="header-subtitle">
            {user ? `${user.is_staff ? 'Admin' : 'Member'} · v2.0` : 'Local mode · v2.0'}
          </p>
        </div>
      </div>

      <div className="header-actions">
        {user ? (
          <>
            <a
              href={`${FRONTEND_URL}${user.is_staff ? '/dashboard' : '/'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="header-iconbtn"
              title="Open dashboard"
            >
              <ExternalLink style={{ width: 14, height: 14 }} strokeWidth={1.5} />
            </a>
            <div className="header-user" title={`${user.name} · ${user.email}`}>
              <div className="header-avatar">{user.initials}</div>
            </div>
            <button className="header-iconbtn" onClick={onLogout} title="Sign out">
              <LogOut style={{ width: 14, height: 14 }} strokeWidth={1.5} />
            </button>
          </>
        ) : (
          <button className="header-signin" onClick={onOpenLogin}>
            <UserIcon style={{ width: 12, height: 12 }} strokeWidth={1.7} />
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
