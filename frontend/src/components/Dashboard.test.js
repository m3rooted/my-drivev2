import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useDropzone } from 'react-dropzone';
import { filesAPI } from '../services/api';
import Dashboard from './Dashboard';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Demo User', email: 'demo@example.test' }, logout: jest.fn() })
}));

jest.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() })
}));

jest.mock('../services/api', () => ({
  filesAPI: {
    getFiles: jest.fn(),
    getStorage: jest.fn(),
    getFavorites: jest.fn()
  },
  foldersAPI: {}
}));

jest.mock('react-dropzone', () => ({
  useDropzone: jest.fn()
}));

describe('Dashboard upload controls', () => {
  let container;
  let root;
  let openFilePicker;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    openFilePicker = jest.fn();
    useDropzone.mockReturnValue({
      getRootProps: () => ({}),
      getInputProps: () => ({ type: 'file', style: { display: 'none' } }),
      open: openFilePicker
    });
    filesAPI.getFiles.mockResolvedValue({ data: { files: [], folders: [] } });
    filesAPI.getStorage.mockResolvedValue({ data: { used: 0, quota: 100, available: 100 } });
    filesAPI.getFavorites.mockResolvedValue({ data: { files: [], folders: [] } });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  test('opens the file picker when New Upload is clicked', async () => {
    // createRoot render must be inside act so effects and state updates settle before assertions.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      root.render(<Dashboard />);
    });

    const uploadButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('New Upload'));
    expect(uploadButton).toBeTruthy();

    uploadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(openFilePicker).toHaveBeenCalledTimes(1);
  });
});
