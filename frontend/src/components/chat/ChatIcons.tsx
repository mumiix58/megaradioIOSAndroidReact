import React from 'react';
import { Image } from 'expo-image';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
export function ChatIcon({ name = 'chat', size = 24, color = '#FFFFFF' }: { name?: 'chat' | 'send' | 'emoji' | 'photo' | 'close' | 'checks' | 'plus' | 'mic' | 'stop' | 'play' | 'pause'; size?: number; color?: string }) {
  if (name === 'send') return <Image source={require('../../../assets/images/chat/send.svg')} style={{width:size,height:size,transform:[{rotate:'45deg'}]}} tintColor={color} contentFit="contain" />;
  if (name === 'chat') return <Image source={require('../../../assets/images/chat/message.svg')} style={{width:size,height:size}} tintColor={color} contentFit="contain" />;
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {name === 'plus' ? <Path d="M12 5v14M5 12h14"/> : name === 'mic' ? <><Rect x={9} y={2} width={6} height={13} rx={3}/><Path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6"/></> : name === 'stop' ? <Rect x={6} y={6} width={12} height={12} rx={3} fill={color}/> : name === 'play' ? <Path d="m8 5 11 7-11 7Z" fill={color}/> : name === 'pause' ? <><Rect x={6} y={5} width={4} height={14} rx={1} fill={color}/><Rect x={14} y={5} width={4} height={14} rx={1} fill={color}/></> : name === 'emoji' ? <><Circle cx={12} cy={12} r={9} /><Path d="M8 14s1.5 2 4 2 4-2 4-2M8 9h.01M16 9h.01" /></> : name === 'photo' ? <><Rect x={3} y={3} width={18} height={18} rx={3} /><Circle cx={8} cy={8} r={1} /><Path d="m21 15-5-5L5 21" /></> : name === 'close' ? <Path d="m6 6 12 12M6 18 18 6" /> : <Path d="m2 12 4 4L16 6M10 12l4 4L24 6" />}
  </Svg>;
}
