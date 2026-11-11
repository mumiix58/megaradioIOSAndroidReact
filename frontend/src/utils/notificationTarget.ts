/** Resolve stored notification payloads without constructing guessed deep links. */
export function notificationTarget(item:any):{kind:'station'|'profile'|'chat';id:string;name?:string;avatar?:string}|null {
 const id=(value:any):string|undefined=>typeof value==='string'&&value.trim()?value.trim():value&&typeof value==='object'?id(value._id||value.id):undefined;
 const data=item.data||{},sender=typeof item.fromUserId==='object'?item.fromUserId:item.fromUser;
 const user=id(data.userId)||id(data.followerId)||id(sender)||id(item.fromUserId);
 const name=data.userName||sender?.fullName||sender?.username,avatar=data.userAvatar||sender?.profileImageUrl||sender?.avatar;
 if(item.type==='new_message'&&user)return {kind:'chat',id:user,name,avatar};
 const station=id(data.stationSlug)||id(data.stationId)||id(data.station)||id(item.station);
 if(station)return {kind:'station',id:station};
 if(user)return {kind:'profile',id:user,name,avatar};
 return null;
}
