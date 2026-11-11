import React from 'react';
import { StyleSheet } from 'react-native';
import { ImageWithFallback } from './ImageWithFallback';

const jazzArtwork = require('../../assets/images/home/jazz-discoverable.png');
const categoryArtwork: Record<string, number> = {
  folk: require('../../assets/images/home/folk-discoverable.png'),
  news: require('../../assets/images/home/news-discoverable.png'),
  talk: require('../../assets/images/home/talk-discoverable.png'),
};
const legacyJazzPath = '/uploads/genres/discoverable/genre-dfd155a5-8ea0-47f6-8c09-d3ba856c4853.png';

interface Props {
  genre: { _id: string; slug?: string; discoverableImage?: string };
}

export function DiscoverableGenreArtwork({ genre }: Props) {
  const bundled = categoryArtwork[genre.slug || ''];
  const configured = bundled ? undefined : genre.discoverableImage?.trim();
  const isJazz = genre.slug === 'jazz' || genre._id === 'genre-jazz';
  let uri: string | null = null;
  if (configured) {
    try {
      const url = new URL(configured, 'https://themegaradio.com');
      const legacyJazz = ['themegaradio.com', 'www.themegaradio.com', 'api.themegaradio.com'].includes(url.hostname)
        && url.pathname === legacyJazzPath;
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        uri = isJazz && legacyJazz ? null : url.href;
      }
    } catch {
      // An invalid configured image falls back to the bundled design artwork.
    }
  }
  return <ImageWithFallback uri={uri}
    fallbackSource={bundled || (isJazz ? jazzArtwork : require('../../assets/images/genre-icon.png'))}
    style={StyleSheet.absoluteFill} contentFit="cover" fallbackContentFit="cover" />;
}
