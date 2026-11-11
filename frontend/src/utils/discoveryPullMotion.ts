/** CarPlay-like resistance: preserve round artwork and move only its local stage. */
export function discoveryPullMotion(motion:number,unit:number){
 'worklet';
 const signed=Math.max(-1,Math.min(1,motion/(14*Math.max(.1,unit))));
 const amount=Math.abs(signed);
 return {amount,translateX:signed*14*unit,scale:1+amount*.012};
}

/** Shared release cadence: visible movement on the very first frame. */
export const DISCOVERY_RELEASE_DURATION = 1050;
export function discoveryReleaseEasing(progress:number){
 'worklet';
 return 1-Math.pow(1-progress,3);
}
