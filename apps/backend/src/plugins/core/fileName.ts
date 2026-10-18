const MAX_FILE_NAME_LENGTH = 200;

/** A user-typed file name with whitespace collapsed and length capped; '' when none was set. */
export const normalizeFileName = (name: unknown): string =>
  (typeof name === 'string' ? name : '').replace(/\s+/g, ' ').trim().slice(0, MAX_FILE_NAME_LENGTH);

/** OneDrive rejects these characters in file names; trailing dots are also invalid. */
export const toOneDriveFileName = (name: unknown): string =>
  normalizeFileName(name).replace(/[\\/:*?"<>|]/g, '-').replace(/[. ]+$/, '');
