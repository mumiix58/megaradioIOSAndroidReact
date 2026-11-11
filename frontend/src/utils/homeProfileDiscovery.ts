export interface HomeDiscoveryProfile {
  _id: string;
  name?: string; fullName?: string; slug?: string;
  avatar?: string; profileImageUrl?: string; profilePhoto?: string;
  favorites_count?: number; favoriteStationsCount?: number; favoriteCount?: number;
  isPublicProfile?: boolean; isPublic?: boolean; status?: string;
}
export function eligibleHomeProfiles(profiles: readonly HomeDiscoveryProfile[], owner: string): HomeDiscoveryProfile[] {
  const seen = new Set<string>();
  return profiles.filter(profile => {
    if (!profile?._id || profile._id === owner || seen.has(profile._id) || profile.isPublicProfile === false || profile.isPublic === false || (profile.status && profile.status !== 'active')) return false;
    const favorites = profile.favorites_count ?? profile.favoriteStationsCount ?? profile.favoriteCount ?? 0;
    if (!Number.isFinite(favorites) || favorites <= 0) return false;
    seen.add(profile._id);
    return true; // An avatar is deliberately not required.
  }).slice(0,40);
}
export type ProfileDiscoverySnapshot = [string,string[]][];
export function createProfileDiscoveryRotation(initial: ProfileDiscoverySnapshot = [], save?: (snapshot: ProfileDiscoverySnapshot) => void) {
  const decks = new Map<string,string[]>(initial.slice(-8));
  return (owner: string, profiles: readonly HomeDiscoveryProfile[], count: number): string[] => {
    const ids = eligibleHomeProfiles(profiles,owner).map(profile => profile._id);
    const allowed = new Set(ids);
    // Preserve progress when API recency reorders the same people; drop private/removed accounts.
    const queue = [...new Set(decks.get(owner) || [])].filter(id=>allowed.has(id));
    const queued = new Set(queue);
    queue.push(...ids.filter(id=>!queued.has(id)));
    const selected = queue.splice(0,Math.min(count,queue.length));
    queue.push(...selected);
    decks.delete(owner); decks.set(owner,queue);
    if (decks.size > 8) decks.delete(decks.keys().next().value!);
    save?.([...decks].map(([key,value])=>[key,[...value]]));
    return selected;
  };
}
