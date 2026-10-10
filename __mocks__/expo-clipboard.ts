let clipboardContent = '';

export const setStringAsync = jest.fn(async (text: string) => {
  clipboardContent = text;
  return true;
});

export const getStringAsync = jest.fn(async () => {
  return clipboardContent;
});

export const hasStringAsync = jest.fn(async () => {
  return clipboardContent.length > 0;
});

export default {
  setStringAsync,
  getStringAsync,
  hasStringAsync,
};
