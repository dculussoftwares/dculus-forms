import { getMinCronIntervalMinutes, isCronTooFrequent } from '../scheduleCronValidation';

describe('schedule frequency limit', () => {
  it.each(['* * * * *', '*/5 * * * *', '0,10 * * * *', '*/14 9 * * *'])('flags %s as too frequent', (cron) => {
    expect(isCronTooFrequent(cron)).toBe(true);
  });

  it.each(['0 9 * * *', '*/15 * * * *', '0 * * * *', '30 9 * * 1', '0 9,10 * * *'])('allows %s', (cron) => {
    expect(isCronTooFrequent(cron)).toBe(false);
  });

  it('does not flag invalid expressions (reported separately)', () => {
    expect(getMinCronIntervalMinutes('nonsense')).toBeNull();
    expect(isCronTooFrequent('nonsense')).toBe(false);
  });
});
