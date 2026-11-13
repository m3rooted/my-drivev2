import React from 'react';
import { CalendarDays, FileText, FolderOpen, Image, RefreshCw, Video } from 'lucide-react';

const orbitIcons = [
  { label: 'Folders', Icon: FolderOpen, position: 'auth-orbit-icon--folder' },
  { label: 'Documents', Icon: FileText, position: 'auth-orbit-icon--document' },
  { label: 'Images', Icon: Image, position: 'auth-orbit-icon--image' },
  { label: 'Videos', Icon: Video, position: 'auth-orbit-icon--video' },
];

const featureCards = [
  { label: 'Folders', Icon: FolderOpen },
  { label: 'Documents', Icon: FileText },
  { label: 'Plans', Icon: CalendarDays },
];

const AuthHero = () => (
  <aside className="auth-showcase" aria-label="CloudNest product overview">
    <div className="auth-brand-lockup">
      <img src="/cloudnest-logo.svg" alt="" aria-hidden="true" />
      <span>CloudNest</span>
    </div>

    <div className="auth-illustration" aria-hidden="true">
      <svg className="auth-orbit-lines" viewBox="0 0 760 480" preserveAspectRatio="none">
        <ellipse className="auth-orbit-path" cx="380" cy="232" rx="304" ry="143" transform="rotate(-19 380 232)" />
        <ellipse className="auth-orbit-path" cx="380" cy="232" rx="266" ry="119" transform="rotate(24 380 232)" />
        <path className="auth-orbit-wave" d="M24 409C112 383 161 424 245 405s144-31 225-7 153 11 266-16" />
        <path className="auth-orbit-wave" d="M38 428c95-26 137 14 226-4s139-28 218-7 156 9 254-13" />
        <circle className="auth-orbit-node" cx="116" cy="126" r="3" />
        <circle className="auth-orbit-node" cx="630" cy="156" r="3" />
        <circle className="auth-orbit-node" cx="154" cy="330" r="2.5" />
        <circle className="auth-orbit-node" cx="604" cy="326" r="2.5" />
      </svg>

      <img
        className="auth-illustration-art"
        src="/cloudnest-hero-bg.png"
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
      />

      {orbitIcons.map(({ label, Icon, position }) => (
        <span key={label} className={`auth-orbit-icon ${position}`}>
          <Icon size={20} strokeWidth={1.8} />
        </span>
      ))}

      <span className="auth-sync-orb">
        <RefreshCw size={17} strokeWidth={2} />
      </span>
    </div>

    <div className="auth-showcase-footer">
      <ul className="auth-feature-cards" aria-label="CloudNest features">
        {featureCards.map(({ label, Icon }) => (
          <li key={label} className="auth-feature-card">
            <Icon size={19} aria-hidden="true" strokeWidth={1.8} />
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <p className="auth-tagline">Your work, in its place.</p>
    </div>
  </aside>
);

export default AuthHero;
