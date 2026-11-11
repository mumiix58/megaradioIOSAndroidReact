import React from 'react';
import {useSharedLoadingMotion} from '../hooks/useSharedLoadingMotion';
import { Animated, View, type ActivityIndicatorProps } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

/** One loading treatment across screens and controls; size changes, artwork does not. */
export function MegaLoadingIndicator({ size = 'small', color, animating = true, hidesWhenStopped = true, style, accessibilityLabel, ...props }: ActivityIndicatorProps) {
  const { t } = useTranslation();
  const diameter = typeof size === 'number' ? size : size === 'large' ? 44 : 24;
  // White is reserved for filled action buttons; legacy purple/gray loaders use Mega pink.
  const ink = typeof color === 'string' && ['#fff', '#ffffff', 'white', '#f7f8fc'].includes(color.toLowerCase()) ? '#FFFFFF' : '#FF4199';
  if (!animating && hidesWhenStopped) return null;
  return <View {...props} accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel || t('loading', 'Loading')} style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
    <RingMotion diameter={diameter} animating={animating}>
      <Svg width={diameter} height={diameter} viewBox="0 0 44 44" accessible={false}>
        <Circle cx={22} cy={22} r={18} fill="none" stroke={ink} strokeOpacity={0.16} strokeWidth={3} />
        <Circle cx={22} cy={22} r={18} fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" strokeDasharray="76 114" transform="rotate(-90 22 22)" />
      </Svg>
    </RingMotion>
  </View>;
}

function RingMotion({diameter,animating,children}:{diameter:number;animating:boolean;children:React.ReactNode}){
 if(!animating)return <View style={{width:diameter,height:diameter}}>{children}</View>;
 return <SpinningRing diameter={diameter}>{children}</SpinningRing>;
}
function SpinningRing({diameter,children}:{diameter:number;children:React.ReactNode}){
 const rotation=useSharedLoadingMotion('ring');
 return <Animated.View pointerEvents="none" style={{width:diameter,height:diameter,transform:[{rotate:rotation.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}}>{children}</Animated.View>;
}
