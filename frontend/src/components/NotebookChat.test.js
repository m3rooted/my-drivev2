import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { notebooksAPI } from '../services/api';
import NotebookChat from './NotebookChat';

jest.mock('../services/api', () => ({
  notebooksAPI: {
    getStatus: jest.fn(),
    getSources: jest.fn(),
    getNotebooks: jest.fn(),
    getNotebook: jest.fn(),
    createNotebook: jest.fn(),
    sendMessage: jest.fn(),
    deleteNotebook: jest.fn()
  }
}));

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn()
}));

const savedNotebook = {
  id: 'notebook-1',
  title: 'Product research',
  sources: [{ id: 'file-1', originalName: 'Research.pdf', size: 1200 }],
  messages: [
    { id: 'message-1', role: 'user', content: 'What are the main themes?' },
    { id: 'message-2', role: 'assistant', content: 'The report highlights three themes.' }
  ]
};

describe('NotebookChat', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    notebooksAPI.getStatus.mockResolvedValue({ data: { aiConfigured: true } });
    notebooksAPI.getSources.mockResolvedValue({ data: { sources: savedNotebook.sources } });
    notebooksAPI.getNotebooks.mockResolvedValue({ data: { notebooks: [savedNotebook] } });
    notebooksAPI.getNotebook.mockResolvedValue({ data: { notebook: savedNotebook } });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  test('loads a saved conversation and shows its source files', async () => {
    // createRoot rendering runs asynchronous data loading effects.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      root.render(<NotebookChat />);
    });

    expect(container.textContent).toContain('Product research');
    expect(container.textContent).toContain('Research.pdf');
    expect(container.textContent).toContain('The report highlights three themes.');
    expect(notebooksAPI.getNotebook).toHaveBeenCalledWith('notebook-1');
  });

  test('explains missing server configuration and disables sending', async () => {
    notebooksAPI.getStatus.mockResolvedValue({ data: { aiConfigured: false } });

    // createRoot rendering runs asynchronous data loading effects.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      root.render(<NotebookChat />);
    });

    expect(container.textContent).toContain('GEMINI_API_KEY');
    expect(container.querySelector('#notebook-question').disabled).toBe(true);
    expect(container.querySelector('button[aria-label="Send question"]').disabled).toBe(true);
  });

  test('traps keyboard focus in the create dialog and restores it when closed', async () => {
    notebooksAPI.getNotebooks.mockResolvedValue({ data: { notebooks: [] } });

    // createRoot rendering runs asynchronous data loading effects.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      root.render(<NotebookChat />);
    });

    const openButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('New notebook'));
    openButton.focus();
    await act(async () => {
      openButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const dialog = container.querySelector('[role="dialog"]');
    const closeButton = dialog.querySelector('button[aria-label="Close dialog"]');
    const cancelButton = Array.from(dialog.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Cancel'));
    cancelButton.focus();
    await act(async () => {
      cancelButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });

    expect(document.activeElement).toBe(closeButton);
    await act(async () => {
      closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(openButton);
  });
});
