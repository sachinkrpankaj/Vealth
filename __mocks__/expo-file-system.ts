export const documentDirectory = 'file:///mock-documents/';
export const writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
export const readAsStringAsync = jest.fn().mockResolvedValue('');
export const EncodingType = {
  UTF8: 'utf8',
};
export default {
  documentDirectory,
  writeAsStringAsync,
  readAsStringAsync,
  EncodingType,
};
