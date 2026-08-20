import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, useColorScheme, useWindowDimensions, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/(tabs)" asChild>
            <TabButton icon="house">Home</TabButton>
          </TabTrigger>
          <TabTrigger name="goals" href="/(tabs)/goals" asChild>
            <TabButton icon="target">Goals</TabButton>
          </TabTrigger>
          <TabTrigger name="routes" href="/(tabs)/routes" asChild>
            <TabButton icon="list.bullet.rectangle">Routes</TabButton>
          </TabTrigger>
          <TabTrigger name="portfolio" href="/(tabs)/portfolio" asChild>
            <TabButton icon="briefcase">Portfolio</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/(tabs)/profile" asChild>
            <TabButton icon="gearshape">Settings</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, icon, isFocused, ...props }: TabTriggerSlotProps & { icon: SymbolViewProps['name'] }) {
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const tintColor = isFocused ? colors.text : colors.textSecondary;

  return (
    <Pressable {...props} style={({ pressed }) => [compact && styles.compactTab, pressed && styles.pressed]}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.tabButtonView, compact && styles.compactTabButtonView]}>
        <SymbolView name={icon} size={15} tintColor={tintColor} />
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { width } = useWindowDimensions();
  const compact = width < 640;

  return (
    <View {...props} style={[styles.tabListContainer, compact && styles.compactTabListContainer]}>
      <ThemedView type="backgroundElement" style={[styles.innerContainer, compact && styles.compactInnerContainer]}>
        {!compact ? (
          <ThemedText type="smallBold" style={styles.brandText}>
            Pathey
          </ThemedText>
        ) : null}

        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  compactTabListContainer: {
    top: undefined,
    bottom: 0,
    padding: 8,
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  compactInnerContainer: {
    width: '100%',
    maxWidth: 520,
    paddingVertical: 6,
    paddingHorizontal: 7,
    borderRadius: 22,
    gap: 0,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  compactTab: {
    flex: 1,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  compactTabButtonView: {
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
});
