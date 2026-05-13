import React from 'react';
import { View, Text, Modal, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export default function WelcomeModal({ visible, onDismiss }: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 28, padding: 28, width: '100%', maxWidth: 380 }}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Image
              source={require('../assets/icon.png')}
              style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 16 }}
              resizeMode="cover"
            />
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center', marginBottom: 12 }}>
              {t('welcome.title')}
            </Text>
            <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 16 }}>
              {t('welcome.body1')}
            </Text>
            <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 }}>
              {t('welcome.body2')}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onDismiss}
            style={{ backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 4 }}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary }}>
              {t('welcome.continue')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
