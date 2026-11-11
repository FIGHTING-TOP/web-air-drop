import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './AppNav.module.css';

function isClipboardPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname === '/airdrop' || pathname === '/manage' || pathname.startsWith('/manage/')) {
    return false;
  }
  return /^\/[a-zA-Z0-9]+$/.test(pathname);
}

export function AppNav() {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!navRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('navOpen', open);
    return () => document.body.classList.remove('navOpen');
  }, [open]);

  return (
    <header className={styles.appNav} ref={navRef}>
      <div className={styles.bar}>
        <NavLink to="/" className={styles.brand} onClick={() => setOpen(false)}>
          <span className={styles.logo} aria-hidden="true">
            ◎
          </span>
          <span>Web AirDrop</span>
        </NavLink>

        <div className={styles.links}>
          <NavLink
            to="/"
            end
            className={() => (isClipboardPath(location.pathname) ? styles.linkActive : styles.link)}
            onClick={() => setOpen(false)}
          >
            剪切板
          </NavLink>
          <NavLink
            to="/airdrop"
            className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
            onClick={() => setOpen(false)}
          >
            AirDrop
          </NavLink>
          {/* <NavLink
            to="/manage"
            className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
            onClick={() => setOpen(false)}
          >
            管理
          </NavLink> */}
        </div>
      </div>
    </header>
  );
}
