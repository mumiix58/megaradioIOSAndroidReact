import {useAnalyticsOverlay} from '../hooks/useAnalyticsOverlay';
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';

interface LogoutModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  visible,
  onCancel,
  onConfirm,
}) => {
  useAnalyticsOverlay('logout-confirmation',visible);
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'logoutModal', visible }, 'http://localhost:8082');
      return () => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'logoutModal', visible: false }, 'http://localhost:8082');
    }
  }, [visible]);
  const embeddedPreview = __DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1' && window.parent !== window;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onCancel} accessible={false} testID="logout-backdrop" />
        <View style={[styles.modalContainer, embeddedPreview && { transform: [{ translateY: -12.5 }] }]} testID="logout-dialog" accessibilityViewIsModal onAccessibilityEscape={onCancel}>
          <Text style={styles.title}>Log Out</Text>
          <Text style={styles.message}>Are you sure you want to{'\n'}log out?</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.buttonTouch}
              onPress={onCancel}
              testID="logout-cancel-btn" accessibilityRole="button"
            >
              <View style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonTouch}
              onPress={onConfirm}
              testID="logout-ok-btn" accessibilityRole="button"
            >
              <View style={styles.okButton}><Text style={styles.okText}>Ok</Text></View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalContainer: { width: 302, maxWidth: '100%', height: 204, backgroundColor: '#000000', borderRadius: 6, borderWidth: 1, borderColor: '#292929', paddingTop: 48, alignItems: 'center' },
  title: { fontSize: 20, lineHeight: 23, fontFamily: 'Ubuntu-Bold', color: '#FFFFFF', marginBottom: 10 },
  message: { fontSize: 15, lineHeight: 17, fontFamily: 'Ubuntu-Medium', color: '#FFFFFF', textAlign: 'center', marginBottom: 22.5 },
  buttonRow: { flexDirection: 'row', gap: 30 },
  buttonTouch: { width: 66, height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { width: 66, height: 27, borderRadius: 30, borderWidth: 2, borderColor: '#3F3F3F', justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 13, lineHeight: 15, fontFamily: 'Ubuntu-Medium', color: '#FFFFFF' },
  okButton: { width: 66, height: 27, borderRadius: 30, backgroundColor: '#FF4199', justifyContent: 'center', alignItems: 'center' },
  okText: { fontSize: 13, lineHeight: 15, fontFamily: 'Ubuntu-Medium', color: '#FFFFFF' },
});

export default LogoutModal;
