import React from 'react';
import { Image } from 'expo-image';

/** Original 102px Figma App / noting-found vector. */
export function SearchTelescope() {
  return <Image source={require('../../assets/images/search/telescope.svg')} style={{ width: 102, height: 102 }} contentFit="contain" accessible={false} />;
}
