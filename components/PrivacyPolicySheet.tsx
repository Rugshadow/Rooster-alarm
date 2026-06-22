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

export default function PrivacyPolicySheet({ visible, onClose }: Props) {
  const { bg, text, textSecondary } = useTheme();
  const topPad = useTopInset();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1" style={{ backgroundColor: bg }} edges={['left', 'right']}>
        <SafeAreaView edges={[]} style={{ backgroundColor: Colors.primary, paddingTop: topPad }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">Privacy Policy</Text>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: text, marginBottom: 4 }}>PRIVACY POLICY</Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 16 }}>Last updated May 10, 2026</Text>

          <Body>
            {`This Privacy Notice for Rooster Alarm ("we," "us," or "our") describes how and why we might access, collect, store, use, and/or share your personal information when you use our services, including when you download and use our mobile application Rooster Alarm, or engage with us in other related ways.\n\nQuestions or concerns? Contact us at mattshade@roosteralarm.com.`}
          </Body>

          <Section title="SUMMARY OF KEY POINTS" />
          <Body>
            {`• We collect personal information you provide (email, username, password) and information automatically collected (device data, usage data).\n• We do not process sensitive personal information.\n• We do not collect information from third parties.\n• We process your information to provide and improve our services, communicate with you, and comply with law.\n• We do not sell or share your personal information.\n• We keep your information for as long as your account is active.\n• Depending on your location, you may have rights over your personal information.`}
          </Body>

          <Section title="1. WHAT INFORMATION DO WE COLLECT?" />
          <Body>
            {`Personal information you provide:\n• Email addresses\n• Usernames\n• Passwords\n\nWe do not process sensitive information.\n\nApplication data we may collect:\n• Mobile device access (storage, alarm clock)\n• Mobile device data (device ID, model, OS, IP address)\n• Push notifications (if you grant permission)\n\nInformation automatically collected:\n• Log and usage data (IP address, device info, browser type, pages viewed, date/time stamps)`}
          </Body>

          <Section title="2. HOW DO WE PROCESS YOUR INFORMATION?" />
          <Body>
            {`We process your information to:\n• Facilitate account creation and authentication\n• Deliver and facilitate our services\n• Save or protect an individual's vital interest`}
          </Body>

          <Section title="3. WHAT LEGAL BASES DO WE RELY ON?" />
          <Body>
            {`We process your information only when we have a valid legal reason, including:\n• Consent\n• Performance of a contract\n• Legal obligations\n• Vital interests\n\nIf you are in Canada, we may process your information with your express or implied consent, or under specific legal exceptions.`}
          </Body>

          <Section title="4. WHEN AND WITH WHOM DO WE SHARE YOUR INFORMATION?" />
          <Body>
            {`We may share your information in the following situations:\n• Business transfers: In connection with any merger, sale, or acquisition of our business.\n• Offer wall: Third-party advertisers may offer virtual rewards through an offer wall in the app. A unique identifier may be shared with the offer wall provider to prevent fraud.`}
          </Body>

          <Section title="5. THIRD-PARTY WEBSITES" />
          <Body>
            {`Our services may link to third-party websites or contain third-party advertisements. We are not responsible for the safety or privacy practices of those third parties. Review their policies before providing any personal information.`}
          </Body>

          <Section title="6. HOW DO WE HANDLE YOUR SOCIAL LOGINS?" />
          <Body>
            {`If you register or log in using a social media account (e.g. Google), we will receive certain profile information from your social media provider (such as name, email, and profile picture). We use this information only as described in this Privacy Notice.`}
          </Body>

          <Section title="7. HOW LONG DO WE KEEP YOUR INFORMATION?" />
          <Body>
            {`We keep your personal information for as long as you have an account with us. When we no longer need it, we will delete or anonymize your information.`}
          </Body>

          <Section title="8. HOW DO WE KEEP YOUR INFORMATION SAFE?" />
          <Body>
            {`We implement appropriate technical and organizational security measures. However, no electronic transmission or storage technology is 100% secure. You should only access our services within a secure environment.`}
          </Body>

          <Section title="9. DO WE COLLECT INFORMATION FROM MINORS?" />
          <Body>
            {`We do not knowingly collect data from or market to children under 18. By using the services, you represent that you are at least 18 years old. If we learn that we have collected data from a minor, we will deactivate the account and delete the data. Contact us at mattshade@roosteralarm.com if you believe we have collected data from a minor.`}
          </Body>

          <Section title="10. WHAT ARE YOUR PRIVACY RIGHTS?" />
          <Body>
            {`Depending on your location, you may have rights to:\n• Access and obtain a copy of your personal information\n• Correct inaccuracies\n• Request deletion\n• Restrict or object to processing\n• Data portability\n\nTo exercise these rights, submit a data subject access request or email us at mattshade@roosteralarm.com.\n\nYou may withdraw your consent at any time by contacting us. To terminate your account, log in to your account settings.`}
          </Body>

          <Section title="11. CONTROLS FOR DO-NOT-TRACK FEATURES" />
          <Body>
            {`We do not currently respond to Do-Not-Track browser signals, as no uniform standard exists. California law requires us to disclose this.`}
          </Body>

          <Section title="12. DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?" />
          <Body>
            {`Residents of California, Colorado, Connecticut, and other US states may have the right to:\n• Know whether we process your personal data\n• Access, correct, or delete your personal data\n• Opt out of sale or sharing of personal data\n• Non-discrimination for exercising your rights\n\nWe have not sold or shared any personal information in the past 12 months and will not do so in the future.\n\nTo exercise your rights, email mattshade@roosteralarm.com or visit peacealarm.com.`}
          </Body>

          <Section title="13. DO OTHER REGIONS HAVE SPECIFIC PRIVACY RIGHTS?" />
          <Body>
            {`Australia & New Zealand: We comply with Australia's Privacy Act 1988 and New Zealand's Privacy Act 2020.\n\nRepublic of South Africa: You may request access to or correction of your personal information at any time.\n\nEU/UK/Switzerland: You have rights under GDPR and UK GDPR, including the right to lodge a complaint with your local data protection authority.`}
          </Body>

          <Section title="14. DO WE MAKE UPDATES TO THIS NOTICE?" />
          <Body>
            {`We may update this Privacy Notice from time to time. The updated version will be indicated by an updated "Revised" date at the top. We encourage you to review this notice frequently.`}
          </Body>

          <Section title="15. HOW CAN YOU CONTACT US?" />
          <Body>
            {`Email: mattshade@roosteralarm.com\n\nMail:\nRooster Alarm\n923 N Washington St\nLowell, MI 49331\nUnited States`}
          </Body>

          <Section title="16. HOW CAN YOU REVIEW, UPDATE, OR DELETE YOUR DATA?" />
          <Body>
            {`You may submit a data subject access request or contact us at mattshade@roosteralarm.com to review, update, or delete your personal information.`}
          </Body>

          <Text style={{ fontSize: 12, color: textSecondary, marginTop: 24, textAlign: 'center' }}>
            This Privacy Policy was created using Termly's Privacy Policy Generator.
          </Text>
        </ScrollView>

        <View style={{ backgroundColor: Colors.primary }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
