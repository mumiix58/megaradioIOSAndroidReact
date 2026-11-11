export type ConnectionKind = 'followers' | 'following';
export interface ConnectionUser { _id: string; fullName: string; username: string; avatar?: string; }

// Accept both the current nested PostgreSQL response and legacy flat lists.
export function normalizeConnections(payload: unknown, kind: ConnectionKind): ConnectionUser[] {
  const raw = Array.isArray(payload) ? payload : (payload as any)?.[kind];
  if (!Array.isArray(raw)) throw new Error('Invalid connections response');
  const seen = new Set<string>();
  return raw.flatMap(entry => {
    const user = entry?.user ?? entry;
    const id = user?._id ?? user?.id;
    if (typeof id !== 'string' || !id || seen.has(id)) return [];
    seen.add(id);
    return [{ _id: id, fullName: typeof user.fullName === 'string' ? user.fullName : '',
      username: typeof user.username === 'string' ? user.username : '',
      avatar: typeof user.avatar === 'string' ? user.avatar : undefined }];
  });
}
export function connectionMatches(user: ConnectionUser, query: string) {
  const text = query.trim().toLocaleLowerCase();
  return !text || `${user.fullName} ${user.username}`.toLocaleLowerCase().includes(text);
}
export function connectionRemoval(kind: ConnectionKind, id: string) {
  const safeId = encodeURIComponent(id);
  return kind === 'following'
    ? { method: 'delete' as const, url: `/api/user/unfollow/${safeId}` }
    : { method: 'post' as const, url: `/api/user-engagement/remove-follower/${safeId}` };
}
