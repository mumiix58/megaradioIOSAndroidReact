import {MegaLoadingState} from '../src/components/MegaLoadingState';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import statsService, { ListeningStats, emptyStats } from '../src/services/statsService';
import { useAuthStore } from '../src/store/authStore';
import { useUserProfile } from '../src/hooks/useQueries';
import { profileCount } from '../src/utils/publicProfileView';

interface LocalStats extends ListeningStats {
  uniqueStations: number;
}

export default function StatisticsScreen() {
  const router = useRouter();
  const {width}=useWindowDimensions();
  const compact=width<360;
  const { t } = useTranslation();
  const owner = useAuthStore(state => state.isAuthenticated ? state.user?._id || (state.user as any)?.id || null : null);
  const { data: profile, refetch: refreshProfile } = useUserProfile(owner || '');
  const socialCards = [
    { direction: 'followers' as const, label: t('followers', 'Followers'), value: profile?.followersCount ?? profile?.followers },
    { direction: 'following' as const, label: t('follows', 'Follows'), value: profile?.followingCount ?? profile?.following },
  ];
  const [loadedOwner, setLoadedOwner] = useState<string | null | undefined>(undefined);
  const [stats, setStats] = useState<LocalStats>({
    totalMinutes: 0,
    totalStations: 136000,
    musicPlayed: 0,
    uniqueStationsListened: 0,
    lastUpdated: '',
    uniqueStations: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(React.useCallback(() => {
    let active = true;
    if (owner) void refreshProfile();
    setIsLoading(true);
    setStats({ ...emptyStats(), uniqueStations: 0 });
    Promise.all([statsService.getStats(owner), statsService.getUniqueStationsListened(owner)])
      .then(([stored, count]) => {
        if (!active) return;
        setStats({ ...stored, uniqueStations: count });
        setLoadedOwner(owner);
      })
      .catch(() => { if (active) setLoadedOwner(owner); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [owner, refreshProfile]));

  // Format minutes to hours and minutes
  const formatListeningTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}hr ${minutes}m`;
  };

  // Format large numbers with k suffix
  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${Math.round(num / 1000)}k`;
    }
    return num.toString();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.dismissTo('/(tabs)/profile')}
          style={styles.backButton}
          accessibilityRole="button" accessibilityLabel={t('back','Back')}
          testID="statistics-back-btn"
        >
          <Image source={require('../assets/images/all-stations/back.svg')} style={{width:24,height:24}} contentFit="contain"/>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('statistics', 'Statistics')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading || loadedOwner !== owner ? (
        <MegaLoadingState page testID="statistics-loading" variant="statistics" count={owner ? 2 : 1}/>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Total Listening Card */}
          <View style={styles.totalListeningCard} testID="total-listening-card">
            <View style={styles.totalListeningContent}>
              <Text style={[styles.cardLabel,compact&&{fontSize:16}]}>{t('total_listening', 'Total Listening')}</Text>
              <Text testID="statistics-listening-value" style={styles.totalListeningValue}>
                {formatListeningTime(stats.totalMinutes)}
              </Text>
            </View>
            <View style={styles.waveContainer}>
              <Image testID="statistics-listening-wave" source={require('../assets/images/statistics/listening-wave.svg')} style={{width:111,height:67}} contentFit="contain"/>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {/* Unique Stations Listened Card */}
            <View style={styles.statCard} testID="unique-stations-card">
              <Text style={styles.smallCardLabel}>{t('unique_stations', 'Unique Stations')}</Text>
              <Text testID="statistics-unique-stations-value" style={styles.statValue}>{stats.uniqueStations}</Text>
            </View>

            {/* Music Played Card */}
            <View style={styles.statCard} testID="music-played-card">
              <Text style={styles.smallCardLabel}>{t('songs_played', 'Songs Played')}</Text>
              <Text testID="statistics-songs-value" style={styles.statValue}>{formatNumber(stats.musicPlayed)}</Text>
            </View>
          </View>
          {owner && <View style={styles.statsRow}>
            {socialCards.map(card => <TouchableOpacity
              key={card.direction}
              style={styles.statCard}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${card.label}: ${card.value == null ? '—' : profileCount(card.value)}`}
              testID={`statistics-${card.direction}`}
              onPress={() => router.push({ pathname: '/(tabs)/profile', params: { connections: card.direction, connectionsFrom: 'statistics' } })}
            >
              <Text style={styles.smallCardLabel}>{card.label}</Text>
              <View style={styles.socialValueRow}>
                <Text style={styles.statValue}>{card.value == null ? '—' : profileCount(card.value).toLocaleString()}</Text>
                <Image source={require('../assets/images/all-stations/back.svg')} style={styles.socialArrow} contentFit="contain"/>
              </View>
            </TouchableOpacity>)}
          </View>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#1B1C1E'},
  header:{height:78,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:15},
  backButton:{width:40,height:44,alignItems:'flex-start',justifyContent:'center'},
  headerTitle:{fontSize:18,lineHeight:21,fontFamily:'Ubuntu-Bold',color:'#FFFFFF'},
  headerSpacer:{width:40},
  loadingContainer:{flex:1,justifyContent:'center',alignItems:'center'},
  content:{paddingHorizontal:15,paddingBottom:24},
  totalListeningCard:{minHeight:123,flexDirection:'row',alignItems:'center',backgroundColor:'#282828',borderRadius:10,paddingHorizontal:20,paddingVertical:24},
  totalListeningContent:{flex:1,minWidth:0},
  cardLabel:{fontFamily:'Ubuntu-Medium',fontSize:18,lineHeight:21,color:'#8F8F8F',marginBottom:6},
  smallCardLabel:{fontFamily:'Ubuntu-Medium',fontSize:14,lineHeight:16,color:'#8F8F8F',marginBottom:6},
  totalListeningValue:{fontSize:24,lineHeight:28,fontFamily:'Ubuntu-Bold',color:'#FFFFFF'},
  waveContainer:{width:111,height:67,justifyContent:'center',alignItems:'center'},
  statsRow:{flexDirection:'row',marginTop:15,gap:15},
  statCard:{flex:1,minHeight:123,backgroundColor:'#282828',borderRadius:10,paddingHorizontal:20,paddingVertical:24,justifyContent:'center'},
  socialValueRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},
  socialArrow:{width:16,height:16,opacity:0.55,transform:[{rotate:'180deg'}]},
  statValue:{fontSize:24,lineHeight:28,fontFamily:'Ubuntu-Bold',color:'#FFFFFF'},
});
