import React from 'react';
import { View,Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from './Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTopInset } from '../hooks/useTopInset';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function Section({ title }: { title: string }) {
  const { text } = useTheme();
  return (
    <Text style={{ fontSize: 15, fontWeight: '700', color: text, marginTop: 20, marginBottom: 6 }}>
      {title}
    </Text>
  );
}

function Body({ children }: { children: string }) {
  const { textSecondary } = useTheme();
  return (
    <Text style={{ fontSize: 14, color: textSecondary, lineHeight: 21 }}>
      {children}
    </Text>
  );
}

export default function TermsSheet({ visible, onClose }: Props) {
  const { bg, text, textSecondary } = useTheme();
  const topPad = useTopInset();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1" style={{ backgroundColor: bg }} edges={['left', 'right']}>
        <SafeAreaView edges={[]} style={{ backgroundColor: Colors.primary, paddingTop: topPad }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">Terms & Conditions</Text>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: text, marginBottom: 4 }}>TERMS AND CONDITIONS</Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 16 }}>Last updated May 17, 2026</Text>

          <Body>
            {`These Terms and Conditions ("Terms") govern your use of Rooster Alarm ("the App"), operated by Rooster Alarm. By downloading or using the App, you agree to be bound by these Terms. If you do not agree, do not use the App.`}
          </Body>

          <Section title="1. USE OF THE APP" />
          <Body>
            {`You must be at least 18 years old to use the App. By using the App, you represent and warrant that you meet this requirement. You agree to use the App only for lawful purposes and in a manner that does not infringe the rights of others.`}
          </Body>

          <Section title="2. ACCOUNTS" />
          <Body>
            {`You may create an account to access additional features. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately at mattshade@roosteralarm.com if you suspect unauthorized use of your account.`}
          </Body>

          <Section title="3. USER CONTENT" />
          <Body>
            {`You may upload audio content ("User Content") to the App. By doing so, you grant Rooster Alarm a non-exclusive, worldwide, royalty-free license to use, store, and display your User Content solely for the purpose of operating the App.\n\nYou represent that you own or have the necessary rights to upload your User Content, and that it does not violate any third-party rights or applicable laws.`}
          </Body>

          <Section title="4. PROHIBITED CONDUCT" />
          <Body>
            {`You agree not to:\n• Upload content that is unlawful, harmful, defamatory, obscene, or infringing\n• Use the App to harass, abuse, or harm others\n• Attempt to gain unauthorized access to any part of the App\n• Reverse engineer, decompile, or disassemble any part of the App\n• Use automated systems to access the App without our permission`}
          </Body>

          <Section title="5. INTELLECTUAL PROPERTY" />
          <Body>
            {`All content, features, and functionality of the App — excluding User Content — are owned by Rooster Alarm and protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express written permission.`}
          </Body>

          <Section title="6. ALARMS AND NOTIFICATIONS" />
          <Body>
            {`The App provides alarm scheduling features. Rooster Alarm is not responsible for missed alarms or notifications due to device settings, operating system behavior, network issues, or any other factors outside our control. You are solely responsible for ensuring the App has the necessary permissions to function on your device.`}
          </Body>

          <Section title="7. THIRD-PARTY SERVICES" />
          <Body>
            {`The App may integrate with or contain links to third-party services. We are not responsible for the content, privacy practices, or availability of any third-party services. Your use of third-party services is governed by their respective terms and policies.`}
          </Body>

          <Section title="8. DISCLAIMERS" />
          <Body>
            {`THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.`}
          </Body>

          <Section title="9. LIMITATION OF LIABILITY" />
          <Body>
            {`TO THE FULLEST EXTENT PERMITTED BY LAW, PEACE ALARM SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE APP, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.`}
          </Body>

          <Section title="10. TERMINATION" />
          <Body>
            {`We reserve the right to suspend or terminate your access to the App at any time, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.`}
          </Body>

          <Section title="11. CHANGES TO THESE TERMS" />
          <Body>
            {`We may update these Terms from time to time. We will notify you of material changes by updating the date at the top of this page. Continued use of the App after changes constitutes your acceptance of the updated Terms.`}
          </Body>

          <Section title="12. GOVERNING LAW" />
          <Body>
            {`These Terms are governed by the laws of the State of Michigan, United States, without regard to its conflict of law provisions.`}
          </Body>

          <Section title="13. CONTACT US" />
          <Body>
            {`Email: mattshade@roosteralarm.com\n\nMail:\nRooster Alarm\n923 N Washington St\nLowell, MI 49331\nUnited States`}
          </Body>
        </ScrollView>

        <View style={{ backgroundColor: Colors.primary }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text style={{ fontWeight: '500', fontSize: 15, color: Colors.textPrimary }}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
