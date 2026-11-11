import {useAnalyticsOverlay} from '../hooks/useAnalyticsOverlay';
import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, Keyboard, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../hooks/useResponsive';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { CountrySelectorModal } from './CountrySelectorModal';
import { ProfilePhotoFeedback } from './ProfilePhotoFeedback';
import { localizedCountryName } from '../utils/countryLocalization';
import { PROFILE_GENDERS,profileDiscoveryLabels,type ProfileGender,type ProfileDiscoveryPreferences } from '../utils/profileDiscovery';
import { saveProfileDiscoveryPreferences } from '../services/profileDiscoveryPreferences';

type Editor = 'name' | 'email' | 'password' | 'gender' | null;
export function AccountSettingsScreen({ onBack, initialEditor = null, previewResult }: { onBack: () => void; initialEditor?: Editor; previewResult?: 'error' | 'password' }) {
  const { t,i18n } = useTranslation();
  const labels = profileDiscoveryLabels(i18n.language);
  const { user, updateUser } = useAuthStore();
  const responsive = useResponsive();
  const [editor, setEditor] = useState<Editor>(initialEditor);
  useAnalyticsOverlay(editor ? 'account-'+editor : 'account',true);
  const [countryVisible,setCountryVisible]=useState(false);
  const [gender,setGender]=useState<ProfileGender>(user?.preferences?.profileGender || 'undisclosed');
  const [notice,setNotice]=useState<{error:boolean;message:string}|null>(null);
  const dismissNotice=useCallback(()=>setNotice(null),[]);
  const saveDiscovery=async(patch:ProfileDiscoveryPreferences)=>{
    if(busyRef.current)return false;
    busyRef.current=true;setBusy(true);
    try {
      await saveProfileDiscoveryPreferences(patch);
      setNotice({error:false,message:labels.updated});return true;
    } catch {
      setNotice({error:true,message:t('account_save_error','Could not save your changes. Please try again.')});return false;
    } finally {busyRef.current=false;setBusy(false)}
  };
  const [name, setName] = useState(user?.fullName || user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [passwords, setPasswords] = useState(['', '', '']);
  const [revealed, setRevealed] = useState([false, false, false]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState(previewResult === 'error' ? t('account_invalid_value', 'Please enter a valid value.') : '');
  const [result, setResult] = useState<'email' | 'name' | 'password' | 'error' | null>(previewResult || null);
  const [modalVisible, setModalVisible] = useState(initialEditor !== null || !!previewResult);
  useEffect(() => {
    if (!result || !modalVisible || previewResult) return;
    const timer = setTimeout(() => { if (result === 'error') { setResult(null); setError(''); } else setModalVisible(false); }, result === 'error' ? 3200 : 2200);
    return () => clearTimeout(timer);
  }, [result, modalVisible, previewResult]);
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'accountModal', visible: modalVisible }, 'http://localhost:8082');
      return () => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'accountModal', visible: false }, 'http://localhost:8082');
    }
  }, [modalVisible]);
  const close = () => {
    if (busyRef.current) return;
    if (result === 'error') { setResult(null); setError(''); return; }
    // Keep the current panel mounted while Modal fades out.
    Keyboard.dismiss(); setModalVisible(false);
  };
  const open = (next: Editor) => {
    setName(user?.fullName || user?.name || ''); setEmail(user?.email || ''); setError(''); setPasswords(['', '', '']); setRevealed([false, false, false]);
    setGender(user?.preferences?.profileGender || 'undisclosed');
    setResult(null); setEditor(next); setModalVisible(true);
  };
  const showError = (message: string) => { Keyboard.dismiss(); setError(message); setResult('error'); };
  const submit = async () => {
    if (busyRef.current || !editor) return;
    if(editor==='gender'){await saveDiscovery({profileGender:gender});setModalVisible(false);return;}
    if (editor === 'password') {
      if (passwords.some(value => !value)) { showError(t('account_invalid_value', 'Please enter a valid value.')); return; }
      if (passwords[1] !== passwords[2]) { showError(t('account_password_mismatch', 'The new passwords do not match.')); return; }
      // The existing profile endpoint accepts a new password but cannot verify the current one.
      // Do not bypass that verification or display a fabricated success state.
      showError(t('account_password_unavailable', 'Password changes are not available here yet. Your password has not been changed.'));
      return;
    }
    const value = editor === 'name' ? name.trim() : email.trim();
    if (!value || (editor === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
      showError(t('account_invalid_value', 'Please enter a valid value.')); return;
    }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const response = await api.put('/api/auth/profile', editor === 'name' ? { fullName: value } : { email: value });
      const saved = response.data?.user;
      if (!saved || (editor === 'email' ? saved.email?.toLowerCase() !== value.toLowerCase() : saved.fullName !== value)) throw new Error('Invalid account response');
      await updateUser({ ...user!, ...saved, name: saved.fullName || user?.name });
      Keyboard.dismiss(); setResult(editor); setEditor(null);
    } catch {
      showError(t('account_save_error', 'Could not save your changes. Please try again.'));
    } finally { busyRef.current = false; setBusy(false); }
  };
  const fieldLabels = [t('account_enter_password', 'Please Enter Your Password'), t('new_password', 'New Password'), t('confirm_password', 'Confirm New Password')];
  return <SafeAreaView style={s.screen} edges={['top']}>
    <View style={[s.header, { marginHorizontal: responsive.sidePadding }]}>
      <TouchableOpacity style={s.back} onPress={onBack} accessibilityRole="button" accessibilityLabel={t('back', 'Back')} testID="account-back"><Image source={require('../../assets/images/language/back.svg')} style={s.icon} contentFit="contain" /></TouchableOpacity>
      <Text style={s.title}>{t('account', 'Account')}</Text><View style={s.back} />
    </View>
    <ScrollView style={{flex:1}} contentContainerStyle={{ paddingHorizontal: responsive.sidePadding,paddingBottom:24 }}>
      {(['name'] as ('name' | 'email' | 'password')[]).map(kind => <TouchableOpacity key={kind} style={s.row} onPress={() => open(kind)} accessibilityRole="button" accessibilityLabel={t(kind, kind)} testID={`account-${kind}`}>
        <View style={s.identity}><Text style={s.label}>{t(kind, kind.charAt(0).toUpperCase() + kind.slice(1))}</Text>
          {kind !== 'password' && <Text style={s.value} numberOfLines={1}>{kind === 'name' ? user?.fullName || user?.name : user?.email}</Text>}
        </View><Image source={require('../../assets/images/language/back.svg')} style={[s.icon, { transform: [{ rotate: '180deg' }] }]} contentFit="contain" />
      </TouchableOpacity>)}
      <TouchableOpacity style={s.row} onPress={()=>open('gender')} accessibilityRole="button" accessibilityLabel={labels.gender} testID="account-gender">
        <View style={s.identity}><Text style={s.label}>{labels.gender}</Text><Text style={s.value} numberOfLines={1}>{labels[user?.preferences?.profileGender || 'undisclosed']}</Text></View><Image source={require('../../assets/images/language/back.svg')} style={[s.icon,{transform:[{rotate:'180deg'}]}]} contentFit="contain"/>
      </TouchableOpacity>
      <TouchableOpacity style={s.row} onPress={()=>setCountryVisible(true)} accessibilityRole="button" accessibilityLabel={labels.country} testID="account-profile-country">
        <View style={s.identity}><Text style={s.label}>{labels.country}</Text><Text style={s.value} numberOfLines={1}>{user?.preferences?.profileCountryCode ? localizedCountryName({code:user.preferences.profileCountryCode,name:user.preferences.profileCountryCode},i18n.language) : labels.unspecified}</Text></View><Image source={require('../../assets/images/language/back.svg')} style={[s.icon,{transform:[{rotate:'180deg'}]}]} contentFit="contain"/>
      </TouchableOpacity>
      {(['email', 'password'] as ('name' | 'email' | 'password')[]).map(kind => <TouchableOpacity key={kind} style={s.row} onPress={() => open(kind)} accessibilityRole="button" accessibilityLabel={t(kind, kind)} testID={`account-${kind}`}>
        <View style={s.identity}><Text style={s.label}>{t(kind, kind.charAt(0).toUpperCase() + kind.slice(1))}</Text>
          {kind !== 'password' && <Text style={s.value} numberOfLines={1}>{kind === 'name' ? user?.fullName || user?.name : user?.email}</Text>}
        </View><Image source={require('../../assets/images/language/back.svg')} style={[s.icon, { transform: [{ rotate: '180deg' }] }]} contentFit="contain" />
      </TouchableOpacity>)}
    </ScrollView>
    <CountrySelectorModal visible={countryVisible} onClose={()=>{if(!busyRef.current)setCountryVisible(false)}} selectionOnly selectedCountryCode={user?.preferences?.profileCountryCode} selectionTitle={labels.country} unspecifiedLabel={labels.unspecified} onSelect={async item=>{const saved=await saveDiscovery({profileCountryCode:item.code||null});if(!saved)setCountryVisible(false);return saved;}}/>
    {notice&&<ProfilePhotoFeedback notice={notice} onDismiss={dismissNotice}/>}
    <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={s.modalScroll} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled" bounces={false}>
          <Pressable focusable={false} tabIndex={-1} style={[StyleSheet.absoluteFill, Platform.OS === 'web' && { outlineWidth: 0, outlineStyle: 'solid' }]} onPress={close} disabled={busy} accessible={false} testID="account-modal-backdrop" />
          <Pressable style={[s.box, editor === 'password' && !result && s.passwordBox, result && s.successBox]} onPress={result ? close : undefined} accessibilityViewIsModal accessibilityRole={result ? 'button' : undefined} accessibilityLabel={result ? t('done', 'Done') : undefined} testID={result ? 'account-result-close' : 'account-editor'}>
            {result ? <View style={s.successContent} testID={result === 'error' ? 'account-error-result' : 'account-success-result'}>
              <Image source={result === 'error' ? require('../../assets/images/account/error.svg') : require('../../assets/images/account/success.svg')} style={s.successIcon} contentFit="contain" />
              <Text style={[s.successTitle, result === 'error' && { maxWidth: 230 }]} accessibilityRole={result === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite">{result === 'error' ? error : result === 'password' ? t('account_password_updated', 'Your password was changed!') : result === 'email' ? t('account_email_updated', 'Your email was updated!') : t('account_name_updated', 'Your name was updated!')}</Text>
              {result === 'email' && <Text style={s.successSub}>{t('account_email_unverified', 'Email verification is pending')}</Text>}
            </View> : <>
              {editor==='gender'?<>
                <Text style={s.fieldLabel}>{labels.gender}</Text><Text style={[s.value,{marginTop:0,marginBottom:14,fontSize:12}]}>{labels.optional}</Text>
                {PROFILE_GENDERS.map(value=><TouchableOpacity key={value} style={s.genderOption} onPress={()=>setGender(value)} disabled={busy} accessibilityRole="radio" accessibilityState={{checked:gender===value,disabled:busy}} accessibilityLabel={labels[value]} testID={`account-gender-${value}`}><Text style={[s.fieldLabel,{marginBottom:0,flex:1}]}>{labels[value]}</Text><View style={[s.radio,gender===value&&s.radioSelected]}>{gender===value&&<View style={s.radioFill}/>}</View></TouchableOpacity>)}
              </>:editor === 'password' ? fieldLabels.map((label, index) => <View key={index} style={s.passwordField}>
                <Text style={s.fieldLabel}>{label}</Text><View style={s.inputRow}>
                  <TextInput accessibilityLabel={label} testID={`account-password-${index}`} value={passwords[index]} onChangeText={value => setPasswords(values => values.map((previous, i) => i === index ? value : previous))} secureTextEntry={!revealed[index]} autoCapitalize="none" autoCorrect={false} keyboardAppearance="dark" textContentType={index === 0 ? 'password' : 'newPassword'} style={s.input} />
                  <TouchableOpacity style={s.inputAction} onPress={() => setRevealed(values => values.map((value, i) => i === index ? !value : value))} accessibilityRole="button" accessibilityLabel={revealed[index] ? t('hide_password', 'Hide password') : t('show_password', 'Show password')}>
                    <Image source={revealed[index] ? require('../../assets/images/account/eye.svg') : require('../../assets/images/account/eye-off.svg')} style={s.icon} contentFit="contain" />
                  </TouchableOpacity>
                </View>
              </View>) : <>
                <Text style={s.fieldLabel}>{editor === 'email' ? t('change_email', 'Change your email') : t('change_name', 'Change your name')}</Text>
                <View style={s.inputRow}><TextInput value={editor === 'email' ? email : name} onChangeText={editor === 'email' ? setEmail : setName} style={s.input} keyboardType={editor === 'email' ? 'email-address' : 'default'} autoCapitalize={editor === 'email' ? 'none' : 'words'} autoCorrect={false} autoFocus keyboardAppearance="dark" accessibilityLabel={editor === 'email' ? t('email', 'Email') : t('name', 'Name')} testID={`account-${editor}-input`} />
                  <TouchableOpacity style={s.inputAction} onPress={() => editor === 'email' ? setEmail('') : setName('')} accessibilityRole="button" accessibilityLabel={t('clear', 'Clear')}><Image source={require('../../assets/images/account/clear.svg')} style={s.icon} contentFit="contain" /></TouchableOpacity>
                </View>
              </>}
              {!!error && !result && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
              <View style={[s.actions, editor === 'password' && s.passwordActions]}>
                <TouchableOpacity style={s.actionTouch} onPress={close} disabled={busy} accessibilityRole="button" testID="account-cancel"><Text style={s.actionText}>{t('cancel', 'Cancel')}</Text></TouchableOpacity>
                <TouchableOpacity style={s.actionTouch} onPress={() => void submit()} disabled={busy} accessibilityRole="button" testID="account-submit"><View style={s.pinkButton}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.actionText}>{editor === 'email' ? t('send', 'Send') : t('done', 'Done')}</Text>}</View></TouchableOpacity>
              </View>
            </>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1B1C1E' },
  header: { height: 78, flexDirection: 'row', alignItems: 'center' }, back: { width: 44, height: 44, justifyContent: 'center' }, icon: { width: 24, height: 24 },
  title: { flex: 1, fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 21, textAlign: 'center', color: '#FFFFFF' },
  row: { height: 84, borderBottomWidth: 1, borderBottomColor: '#333436', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  identity: { flex: 1, minWidth: 0, justifyContent: 'center' }, label: { fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 17, includeFontPadding:false, color: '#FFFFFF' }, value: { fontFamily: 'Ubuntu-Regular', fontSize: 15, lineHeight: 17, includeFontPadding:false, color: '#BAB2B2', marginTop: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }, modalScroll: { flex: 1 }, modalContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  box: { width: 302, maxWidth: '100%', minHeight: 220, borderRadius: 6, borderWidth: 1, borderColor: '#292929', backgroundColor: '#000000', paddingHorizontal: 18, paddingTop: 35, paddingBottom: 30 },
  genderOption:{minHeight:46,flexDirection:'row',alignItems:'center'},radio:{width:18,height:18,borderRadius:9,borderWidth:1.5,borderColor:'#77787C',alignItems:'center',justifyContent:'center'},radioSelected:{borderColor:'#FF4199'},radioFill:{width:10,height:10,borderRadius:5,backgroundColor:'#FF4199'},
  passwordBox: { minHeight: 437 }, fieldLabel: { fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 18, color: '#FFFFFF', marginBottom: 11 },
  inputRow: { height: 45, borderRadius: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 2 }, input: { flex: 1, minWidth: 0, height:45, padding: 0, lineHeight:18, textAlignVertical:'center', includeFontPadding:false, fontFamily: 'Ubuntu-Medium', fontSize: 15, color: '#5B5B5B', outlineWidth: 0, outlineStyle: 'solid' }, inputAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  passwordField: { marginBottom: 26 }, actions: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 18, marginTop: 36 }, passwordActions: { marginTop: 10 }, actionTouch: { minWidth: 68, height: 44, alignItems: 'center', justifyContent: 'center' }, actionText: { fontFamily: 'Ubuntu-Medium', fontSize: 13, lineHeight: 15, color: '#FFFFFF' }, pinkButton: { backgroundColor: '#FF4199', minWidth: 78, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  error: { color: '#FF83B8', fontFamily: 'Ubuntu-Regular', fontSize: 12, lineHeight: 17, marginTop: 12 },
  successBox: { minHeight: 183, paddingTop: 45, paddingBottom: 30 }, successContent: { alignItems: 'center' }, successIcon: { width: 46, height: 46 }, successTitle: { fontFamily: 'Ubuntu-Bold', fontSize: 14, lineHeight: 16, textAlign: 'center', color: '#FFFFFF', maxWidth: 160, marginTop: 24 }, successSub: { fontFamily: 'Ubuntu-Medium', fontSize: 12, lineHeight: 14, color: '#838383', marginTop: 10, textAlign: 'center' },
});
