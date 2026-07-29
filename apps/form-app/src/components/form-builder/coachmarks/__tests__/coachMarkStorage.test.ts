import { renderHook, act } from '@testing-library/react';
import { dismissCoachMark, useActiveCoachMark } from '../coachMarkStorage';

describe('coachMarkStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with "rail" active when nothing is dismissed', () => {
    const { result } = renderHook(() => useActiveCoachMark());
    expect(result.current.activeId).toBe('rail');
  });

  it('advances to the next id in order once the active one is dismissed', () => {
    const { result } = renderHook(() => useActiveCoachMark());

    act(() => result.current.dismiss('rail'));
    expect(result.current.activeId).toBe('design');

    act(() => result.current.dismiss('design'));
    expect(result.current.activeId).toBe('gear');

    act(() => result.current.dismiss('gear'));
    expect(result.current.activeId).toBeNull();
  });

  it('persists dismissal to localStorage and syncs across independently-mounted hook instances', () => {
    const rail = renderHook(() => useActiveCoachMark());
    const design = renderHook(() => useActiveCoachMark());

    act(() => rail.result.current.dismiss('rail'));

    expect(JSON.parse(localStorage.getItem('dculus.coachmarks.dismissed')!)).toEqual(['rail']);
    expect(design.result.current.activeId).toBe('design');
  });

  it('is a no-op when dismissing an id that is already dismissed', () => {
    dismissCoachMark('rail');
    dismissCoachMark('rail');
    expect(JSON.parse(localStorage.getItem('dculus.coachmarks.dismissed')!)).toEqual(['rail']);
  });
});
