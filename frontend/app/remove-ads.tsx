import React, {useCallback} from 'react';
import {useRouter} from 'expo-router';
import {PremiumPaywall} from '../src/components/PremiumPaywall';

/** Direct entry uses the same paywall without mounting Profile's unrelated data/forms. */
export default function RemoveAdsScreen() {
  const router=useRouter();
  const close=useCallback(()=>router.dismissTo('/(tabs)/profile'),[router]);
  return <PremiumPaywall visible mode="remove_ads" onClose={close}/>;
}
