import { createContext, useContext } from 'react';

export const NativeCastContext = createContext({
  connected: false,
  remoteStationId: null as string | null,
  arm: () => {},
  notify: (_message: string) => {},
  pause: async () => {},
  resume: async () => {},
  togglePlayPause: async () => {},
  stop: async () => true,
});
export const useNativeCast = () => useContext(NativeCastContext);
