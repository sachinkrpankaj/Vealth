export const mockDatabaseInstance = {
  runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  getAllAsync: jest.fn().mockResolvedValue([]),
  execAsync: jest.fn().mockResolvedValue(undefined),
  withTransactionAsync: jest.fn().mockImplementation(async (cb: any) => (cb ? cb() : undefined)),
  closeAsync: jest.fn().mockResolvedValue(undefined),
};

export const openDatabaseAsync = jest.fn().mockResolvedValue(mockDatabaseInstance);
export type SQLiteDatabase = any;
export default {
  openDatabaseAsync,
  mockDatabaseInstance,
};
