import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './AppNav.module.css';


export function AppNav() {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

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
            className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
          >
            AirDrop
          </NavLink>
          <NavLink
            to="/clipboard"
            className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
          >
            剪切板
          </NavLink>
        </div>

      </div>

    </header>
  );
}
