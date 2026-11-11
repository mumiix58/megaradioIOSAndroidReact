import React from 'react';
import { StyleSheet, Text, TouchableOpacity, Pressable, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import {useTranslation} from 'react-i18next';
import {MegaLoadingIndicator} from './MegaLoadingIndicator';

/** Figma 1:4199 (radio failure), 1:4332 (offline). Original broadcast asset. */
export function PlayerErrorState({ offline = false, onRetry, artworkSize = 255, onReport, reportStatus='idle',stationName='' }: { offline?: boolean; onRetry?: () => void; artworkSize?: number;onReport?:()=>void;reportStatus?:'idle'|'sending'|'sent';stationName?:string }) {
  const {t,i18n}=useTranslation();
  const {width}=useWindowDimensions();
  const offlineScale=Math.min(width/375,1.35);
  const offlineText=t('player_offline_retry','No Internet! Try again.');
  // Figma's 255px failure card adapts to the same artwork slot as the logo.
  // Keep the original 102px vector canvas; scale its visual geometry uniformly.
  const scale = artworkSize / 255;
  const radioCard = { width: artworkSize, height: artworkSize, borderRadius: 12.75 * scale };
  const hasReport=!offline&&!!onReport;
  const iconShift=hasReport?Math.max(0,48-55*scale):0;
  const radioIcon = { left: (artworkSize - 102) / 2 + 0.5 * scale, top: 106 * scale - 51 + iconShift, transform: [{ scale }] };
  return (
    <View testID={offline ? 'player-offline-state' : 'player-radio-error-state'} style={styles.container} accessibilityLiveRegion="polite">
      <View style={[styles.card, offline ? [styles.offlineCard,{width:229*offlineScale,height:201*offlineScale,borderRadius:12.75*offlineScale}] : radioCard]}>
        {hasReport&&<Pressable testID="player-report-radio" accessibilityRole="button" accessibilityLabel={t('player_report_station',{name:stationName,defaultValue:'Report this station: {{name}}'})} accessibilityState={{busy:reportStatus==='sending',disabled:reportStatus!=='idle'}} disabled={reportStatus!=='idle'} onPress={onReport} hitSlop={2} style={styles.report}>
          {({pressed})=>reportStatus==='sending'?<MegaLoadingIndicator size="small" color="#CDD2D4"/>:<Text maxFontSizeMultiplier={1.3} style={[styles.reportText,pressed&&{color:'#FF4199'}]}>{t(reportStatus==='sent'?'player_report_sent':'player_report_this',reportStatus==='sent'?'Reported ✓':'Report this')}</Text>}
        </Pressable>}
        <Image source={require('../../assets/images/player/broadcast.svg')} style={[styles.icon, offline ? {left:63.5*offlineScale,top:49*offlineScale,width:102*offlineScale,height:102*offlineScale} : radioIcon]} contentFit="contain" accessible={false} />
        {!offline && <Text style={[styles.radioMessage, { top: 177 * scale }]}>{'Opss!\nRadio doesn’t work.'}</Text>}
      </View>
      {offline && <TouchableOpacity onPress={onRetry} disabled={!onRetry} accessibilityRole="button" accessibilityLabel={offlineText} hitSlop={{top:10,bottom:11,left:4,right:4}} style={[styles.retry,{marginTop:34*offlineScale}]}>
        <Text style={[styles.offlineMessage,{fontSize:20*offlineScale,lineHeight:23*offlineScale}]}>{offlineText}</Text>
      </TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  card: {
    width: 255, height: 255, borderRadius: 12.75,
    backgroundColor: 'rgba(0,0,0,0.42)',
    shadowColor: '#04282C', shadowOffset: { width: 0, height: 7.65 }, shadowOpacity: 1, shadowRadius: 30.6,
  },
  report:{position:'absolute',top:0,left:12,right:12,height:44,alignItems:'center',justifyContent:'center',borderRadius:6,zIndex:2},
  reportText:{fontFamily:'Ubuntu-Medium',fontSize:13,lineHeight:16,color:'#CDD2D4'},
  icon: { position: 'absolute', width: 102, height: 102, left: 76.5, top: 55 },
  radioMessage: { position: 'absolute', top: 177, left: 0, right: 0, color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 14, lineHeight: 16, textAlign: 'center' },
  offlineCard: { width: 229, height: 201 },
  offlineIcon: { left: 63.5, top: 49 },
  retry: { marginTop: 34, minHeight: 23, justifyContent: 'flex-start' },
  offlineMessage: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 20, lineHeight: 23, textAlign: 'center' },
});
