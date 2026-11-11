import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

/** Exact 26px artwork/geometry shared with the web player's Figma icon. */
export function DeezerIcon() {
  return <View style={{width:26,height:26}} accessible={false}>
    <Image source={require('../../assets/images/player/deezer-background.svg')} style={{width:26,height:26}} contentFit="contain" />
    <Image source={require('../../assets/images/player/deezer-mark.svg')} style={{position:'absolute',left:5,top:7,width:16,height:10.4521}} contentFit="contain" />
  </View>;
}
