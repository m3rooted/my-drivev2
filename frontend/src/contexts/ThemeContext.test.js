import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider, useTheme } from './ThemeContext';

const ThemeProbe = () => {
  const { theme } = useTheme();
  return <span>{theme}</span>;
};

const renderTheme = () => renderToStaticMarkup(
  <ThemeProvider>
    <ThemeProbe />
  </ThemeProvider>
);

test('starts in dark mode when no theme preference has been saved', () => {
  localStorage.removeItem('theme');

  expect(renderTheme()).toContain('dark');
});

test('keeps a saved light mode preference', () => {
  localStorage.setItem('theme', 'light');

  expect(renderTheme()).toContain('light');
});
