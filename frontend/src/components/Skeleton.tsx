import React from 'react';
import {useSharedLoadingMotion} from '../hooks/useSharedLoadingMotion';
import { View, StyleSheet, Animated, ViewStyle, type DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

// Basic Skeleton component with shimmer effect
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const shimmerAnim=useSharedLoadingMotion('shimmer');

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[
        styles.skeleton,
        {
          width: width as DimensionValue,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.1)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};

const styles=StyleSheet.create({skeleton:{backgroundColor:'#2A2A2A',overflow:'hidden'},shimmer:{width:'100%',height:'100%'}});
export default Skeleton;
