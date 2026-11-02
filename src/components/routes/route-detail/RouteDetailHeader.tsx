import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/** Back, the title, and the venue handoff. */
export function RouteDetailHeader({
  onBack,
  onShare,
}: {
  onBack: () => void;
  onShare: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingVertical: 6 }}
    >
      <Pressable
        onPress={onBack}
        className="active:opacity-60"
        hitSlop={12}
      >
        <ThemedText
          style={{
            fontSize: 28,
            color: theme.textSecondary,
            lineHeight: 30,
          }}
        >
          ‹
        </ThemedText>
      </Pressable>
      <ThemedText
        style={{ fontSize: 18, fontWeight: "800", color: theme.text }}
      >
        This route
      </ThemedText>
      <Pressable
        onPress={onShare}
        className="active:opacity-60"
        hitSlop={12}
      >
        <ThemedText style={{ fontSize: 20, color: theme.textSecondary }}>
          ⇧
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** The plain-words strategy, for routes with no price to chart (a T-bill, a spending cut). */
export function HowItWorks({ strategy }: { strategy: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.backgroundElement,
        borderRadius: Radius.lg,
        padding: 14,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <ThemedText
        style={{
          fontSize: 10,
          color: theme.textTertiary,
          fontWeight: "700",
          letterSpacing: 0.6,
          marginBottom: 4,
        }}
      >
        HOW IT WORKS
      </ThemedText>
      <ThemedText
        style={{ fontSize: 13.5, color: theme.text, lineHeight: 20 }}
      >
        {strategy}
      </ThemedText>
    </View>
  );
}
