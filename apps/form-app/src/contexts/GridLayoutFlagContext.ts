import { createContext, useContext } from 'react';

// Seeded from lib/config's isGridLayoutEnabled() by PageBuilderTab; palette modules can't import lib/config (jest can't parse import.meta)
export const GridLayoutFlagContext = createContext(false);

export const useGridLayoutEnabled = (): boolean => useContext(GridLayoutFlagContext);
