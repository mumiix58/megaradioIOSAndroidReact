import type { ConnectionUser } from '../utils/connections';
// Explicit, development-only design preview. These IDs must never reach the API.
export function createConnectionPreview(): Record<'followers' | 'following', ConnectionUser[]> {
  const names = ['Steve Annie', 'Mark Osama', 'Zehra Meryem Akış', 'Walter Williams', 'Maria Addeman'];
  const followingNames = ['Oliver Bennett', 'Lucas Martin', 'Sophie Laurent', 'Noah Williams', 'Emma Anderson'];
  return {
    followers: names.map((fullName, index) => ({ _id: `preview-follower-${index}`, fullName, username: `test${index + 1}` })),
    following: followingNames.map((fullName, index) => ({ _id: `preview-following-${index}`, fullName, username: `testfollow${index + 1}` })),
  };
}
export const connectionPreviewAvatars = [
  require('../../assets/images/connections/steve.png'),
  require('../../assets/images/connections/mark.png'),
  require('../../assets/images/connections/zehra.png'),
  require('../../assets/images/connections/walter.png'),
  require('../../assets/images/connections/maria.png'),
];
