export type ReviewStore='ios'|'android';
export const REVIEW_LINKS={
 ios:{native:'itms-apps://itunes.apple.com/app/viewContentsUserReviews/id6759302561?action=write-review',web:'https://apps.apple.com/app/id6759302561?action=write-review'},
 android:{native:'market://details?id=com.megaradio&showAllReviews=true',web:'https://play.google.com/store/apps/details?id=com.megaradio&showAllReviews=true'},
} as const;

/** Desktop web has no mobile store; never silently default it to Android. */
export function reviewStore(platform:string,userAgent='',maxTouchPoints=0):ReviewStore|null{
 if(platform==='ios'||platform==='android')return platform;
 if(platform!=='web')return null;
 if(/android/i.test(userAgent))return 'android';
 if(/iphone|ipad|ipod/i.test(userAgent)||(/macintosh/i.test(userAgent)&&maxTouchPoints>1))return 'ios';
 return null;
}

/** Explicit Rate Us actions use documented store links, not quota-limited prompts. */
export async function openStoreReview(store:ReviewStore,native:boolean,openURL:(url:string)=>Promise<unknown>):Promise<void>{
 const links=REVIEW_LINKS[store];
 if(native){try{await openURL(links.native);return;}catch{/* A device without a store handler can use HTTPS. */}}
 await openURL(links.web);
}
