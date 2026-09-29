const memoryStore = new Map<string, string>();

export const setItemAsync = jest.fn(async (key: string, value: string) => {
  memoryStore.set(key, value);
});

export const getItemAsync = jest.fn(async (key: string) => {
  return memoryStore.get(key) ?? null;
});

export const deleteItemAsync = jest.fn(async (key: string) => {
  memoryStore.delete(key);
});

export const isAvailableAsync = jest.fn().mockResolvedValue(true);

export default {
  setItemAsync,
  getItemAsync,
  deleteItemAsync,
  isAvailableAsync,
};
