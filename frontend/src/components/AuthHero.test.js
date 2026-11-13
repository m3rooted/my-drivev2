import React from 'react';
import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import Login from './Login';
import Register from './Register';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: jest.fn(), register: jest.fn() }),
}));

jest.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }),
}));

const authPages = [
  ['login', Login],
  ['registration', Register],
];

describe.each(authPages)('%s hero artwork', (_pageName, Page) => {
  test('shows the CloudNest cloud-computing image as decorative artwork', () => {
    const view = renderToStaticMarkup(<Page />);
    const container = document.createElement('div');
    container.innerHTML = view;

    const artwork = container.querySelector('.auth-illustration-art[src="/cloudnest-hero-bg.png"]');
    expect(artwork).not.toBeNull();
    expect(artwork.getAttribute('alt')).toBe('');
    expect(artwork.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.auth-page')).not.toBeNull();
    expect(container.querySelector('.auth-card')).not.toBeNull();
    expect(container.querySelector('.auth-theme-toggle')).not.toBeNull();
    expect(container.querySelectorAll('.auth-orbit-icon')).toHaveLength(4);
    expect(container.querySelectorAll('.auth-feature-card')).toHaveLength(3);
    expect(container.querySelector('.auth-sync-orb')).not.toBeNull();

    expect(container.textContent).not.toContain('A calmer place for your files.');
    expect(container.textContent).not.toContain('Keep documents, folders and plans together, then find the right thing when you need it.');

  });
});

test('uses a high-resolution background image', () => {
  const imagePath = path.resolve(__dirname, '../../public/cloudnest-hero-bg.png');
  const png = fs.readFileSync(imagePath);

  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(1600);
  expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(900);
});

test('blends the artwork into the showcase background without a rectangular edge', () => {
  const styles = fs.readFileSync(path.resolve(__dirname, 'AuthPages.css'), 'utf8');
  const artworkRule = styles.match(/\.auth-illustration-art\s*\{([^}]+)\}/);

  expect(artworkRule).not.toBeNull();
  expect(artworkRule[1]).toMatch(/mix-blend-mode:\s*lighten/);
});
