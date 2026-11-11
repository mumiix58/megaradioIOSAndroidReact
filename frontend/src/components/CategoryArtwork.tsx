import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

// Original photo and gradient layers exported from Figma Others/categori.
// Text layers are excluded: category names are rendered from API data.
const backgrounds = {
  rock: { photo: require('../../assets/images/home/categories/rock.png'), overlay: require('../../assets/images/home/categories/jazz-1.jpg'), photoRect: [0, 0, 165, 119], overlayRect: [-43, -21, 231, 154], opacity: 0.4 },
  jazz: { photo: require('../../assets/images/home/categories/jazz-0.jpg'), overlay: require('../../assets/images/home/categories/jazz-1.jpg'), photoRect: [-127, -150, 432, 291], overlayRect: [-43, -21, 231, 154], opacity: 0.6 },
  pop: { photo: require('../../assets/images/home/categories/pop-0.jpg'), overlay: require('../../assets/images/home/categories/pop-1.jpg'), photoRect: [-11, -7, 211, 159], overlayRect: [-11, -7, 194, 130], opacity: 0.6 },
  folk: { photo: require('../../assets/images/home/categories/folk-0.jpg'), overlay: require('../../assets/images/home/categories/folk-1.jpg'), photoRect: [-65, -69, 334, 223], overlayRect: [-56, -11, 314, 209], opacity: 0.7 },
};

function placement(rect: number[]) {
  return { position: 'absolute' as const, left: `${rect[0] / 165 * 100}%` as `${number}%`, top: `${rect[1] / 119 * 100}%` as `${number}%`, width: `${rect[2] / 165 * 100}%` as `${number}%`, height: `${rect[3] / 119 * 100}%` as `${number}%` };
}

export function CategoryArtwork({ slug, index }: { slug?: string; index: number }) {
  const key = slug?.includes('rock') ? 'rock' : slug?.includes('folk') ? 'folk' : slug?.includes('jazz') ? 'jazz' : slug?.includes('pop') ? 'pop' : (['folk', 'jazz', 'pop', 'jazz'] as const)[index % 4];
  const artwork = backgrounds[key];
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    <Image source={artwork.photo} contentFit={key === 'rock' ? 'cover' : 'fill'} style={placement(artwork.photoRect)} />
    <Image source={artwork.overlay} contentFit="fill" style={[placement(artwork.overlayRect), { opacity: artwork.opacity }]} />
  </View>;
}
