import { useAuthStore } from './authStore';
import { sessionVersion, isCurrentSession } from '../services/sessionRuntime';
export function captureAccount() {
  const { user, token } = useAuthStore.getState();
  return { ownerId: user?._id || 'guest', token, version: sessionVersion() };
}
export type AccountScope = ReturnType<typeof captureAccount>;
export function isAccountCurrent(scope: AccountScope) {
  return isCurrentSession(scope.version) && useAuthStore.getState().token === scope.token;
}
export const accountKey = (kind: string, scope: AccountScope) => `@megaradio_v3:${kind}:${scope.ownerId}`;
