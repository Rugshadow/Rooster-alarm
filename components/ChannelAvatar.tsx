import React from 'react';
import { View, Text } from 'react-native';
import { getChannelColor } from '../constants/colors';

type Props = {
  id: string;
  name: string;
  size?: 'carousel' | 'list' | 'large';
};

const SIZE_MAP = {
  carousel: { container: 90, text: 28, radius: 20 },
  list: { container: 60, text: 20, radius: 14 },
  large: { container: 120, text: 40, radius: 28 },
};

export default function ChannelAvatar({ id, name, size = 'carousel' }: Props) {
  const { container, text, radius } = SIZE_MAP[size];
  const bgColor = getChannelColor(id);
  const monogram = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View
      style={{
        width: container,
        height: container,
        borderRadius: radius,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontWeight: 'bold',
          fontSize: text,
        }}
      >
        {monogram}
      </Text>
    </View>
  );
}
