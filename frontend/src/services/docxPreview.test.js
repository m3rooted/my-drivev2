import { extractDocxText } from './docxPreview';
import mammoth from 'mammoth';

jest.mock('mammoth', () => ({
  extractRawText: jest.fn()
}));

test('extracts DOCX content as text so document markup is never treated as HTML', async () => {
  const arrayBuffer = new ArrayBuffer(8);
  mammoth.extractRawText.mockResolvedValue({ value: '<img src=x onerror=alert(1)>' });

  await expect(extractDocxText(arrayBuffer)).resolves.toBe('<img src=x onerror=alert(1)>');
  expect(mammoth.extractRawText).toHaveBeenCalledWith({ arrayBuffer });
});
