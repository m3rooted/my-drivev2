import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import AuthHero from './AuthHero';
import './AuthPages.css';

const AuthPageLayout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="auth-page">
      <AuthHero />
      <main className="auth-main">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="auth-theme-toggle"
        >
          {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
        </button>
        {children}
      </main>
    </div>
  );
};

export default AuthPageLayout;
