import {useAnalyticsOverlay} from '../hooks/useAnalyticsOverlay';
import React, {useEffect,useState,useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import {Image} from 'expo-image';
import { useTranslation } from 'react-i18next';
import {reviewStore,openStoreReview,type ReviewStore} from '../utils/storeReview';

interface Props {
  visible: boolean;
  onClose: () => void;
  onRated?: () => void;
}

export const RateUsModal: React.FC<Props> = ({ visible, onClose, onRated }) => {
  // This modal is mounted even while hidden. Suspending before RootLayout's
  // i18n initialization effect commits would deadlock the entire app startup.
  const { t } = useTranslation(undefined, { useSuspense: false });
  useAnalyticsOverlay('rate-us',visible);

  const [chooseStore,setChooseStore]=useState(false);
  const [opening,setOpening]=useState(false);
  const openingRef=useRef(false);
  useEffect(()=>{if(!visible)setChooseStore(false);},[visible]);
  const handleRate=async(selected?:ReviewStore)=>{
    if(openingRef.current)return;
    const target=selected??reviewStore(Platform.OS,Platform.OS==='web'?navigator.userAgent:'',Platform.OS==='web'?navigator.maxTouchPoints:0);
    if(!target){setChooseStore(true);return;}
    openingRef.current=true;setOpening(true);
    try{
      await openStoreReview(target,Platform.OS!=='web',url=>Linking.openURL(url));
      onRated?.();onClose();
    }catch(error){console.log('[RateUs] Could not open review:',error);}
    finally{openingRef.current=false;setOpening(false);}
  };

  useEffect(()=>{
    if(__DEV__&&Platform.OS==='web'&&process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY==='1'){
      window.parent.postMessage({type:'megaradio-preview-theme',screen:'rateModal',visible},'http://localhost:8082');
      return()=>window.parent.postMessage({type:'megaradio-preview-theme',screen:'rateModal',visible:false},'http://localhost:8082');
    }
  },[visible]);
  const embeddedPreview=__DEV__&&Platform.OS==='web'&&process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY==='1'&&window.parent!==window;

  // Hidden modals must not translate before the root finishes i18n startup.
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card,embeddedPreview&&{transform:[{translateY:-12.5}]}]}
          accessibilityViewIsModal onAccessibilityEscape={onClose}
          onPress={(e) => e.stopPropagation()}
          testID="rate-us-modal"
        >
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            testID="rate-us-close-btn"
            accessibilityRole="button" accessibilityLabel={t('close','Close')}
          >
            <Image source={require('../../assets/images/rate-us/close-circle.svg')} style={{width:24,height:24}} contentFit="contain"/>
          </TouchableOpacity>

          <Image testID="rate-us-stars" source={require('../../assets/images/rate-us/stars.svg')} style={styles.stars} contentFit="contain"/>

          {/* Title */}
          <Text style={styles.title} testID="rate-us-title">
            {t('rate_us_title', 'You like MegaRadio?')}
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {t('rate_us_subtitle', "We're working hard to make MegaRadio better.")}
          </Text>

          {/* Rate us button */}
          <TouchableOpacity
            style={styles.rateTouch}
            accessibilityRole="button"
            onPress={()=>void handleRate()}
            disabled={opening}
            testID="rate-us-btn"
            activeOpacity={0.85}
          >
            <View style={styles.rateBtn}><Text style={styles.rateBtnText}>
              {t('rate_us_button', 'Rate us!')}
            </Text></View>
          </TouchableOpacity>
          {chooseStore&&<View testID="rate-us-store-choice" style={styles.storeChoice}>{(['ios','android'] as const).map(store=><TouchableOpacity key={store} testID={`rate-us-store-${store}`} accessibilityRole="button" disabled={opening} onPress={()=>void handleRate(store)} style={styles.storeTouch}><View style={styles.rateBtn}><Text style={styles.rateBtnText}>{store==='ios'?'App Store':'Google Play'}</Text></View></TouchableOpacity>)}</View>}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.4)',justifyContent:'center',alignItems:'center',paddingHorizontal:24},
  card:{width:302,maxWidth:'100%',minHeight:204,backgroundColor:'#000000',borderRadius:6,borderWidth:1,borderColor:'#292929',paddingTop:5,paddingBottom:15.5,alignItems:'center'},
  closeBtn:{position:'absolute',top:-1,right:-1,width:44,height:44,alignItems:'center',justifyContent:'center',zIndex:2},
  stars:{width:62,height:62},
  title:{color:'#FFFFFF',fontSize:20,lineHeight:23,fontFamily:'Ubuntu-Bold',textAlign:'center',marginBottom:10,maxWidth:'92%'},
  subtitle:{color:'#FFFFFF',fontSize:15,lineHeight:17,fontFamily:'Ubuntu-Medium',textAlign:'center',width:196,maxWidth:'88%'},
  rateTouch:{minWidth:67,minHeight:44,marginTop:8.5,marginLeft:7,alignItems:'center',justifyContent:'center'},
  rateBtn:{backgroundColor:'#FF4199',paddingVertical:6,paddingHorizontal:9,borderRadius:30,alignItems:'center'},
  storeChoice:{flexDirection:'row',gap:16,marginTop:4},
  storeTouch:{minHeight:44,justifyContent:'center'},
  rateBtnText:{color:'#FFFFFF',fontSize:13,lineHeight:15,fontFamily:'Ubuntu-Medium'},
});

export default RateUsModal;
