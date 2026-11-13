import mammoth from 'mammoth';

export const extractDocxText = async (arrayBuffer) => {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
};
