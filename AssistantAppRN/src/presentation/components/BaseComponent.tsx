import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';

interface BaseComponentProps {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export const BaseComponent: React.FC<BaseComponentProps> = ({ 
  children, 
  style, 
  testID 
}) => {
  return (
    <View style={[styles.container, style]} testID={testID}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default BaseComponent;
