import { Plus } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";

import { TrackRouteForm } from "@/components/routes/TrackRouteForm";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/Icon";
import { Brand, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Haptic } from "@/lib/haptics";
import type { Route } from "@/types/routes";

/**
 * Pinned, not in the card: the card runs past the fold on most phones, so
 * the one action on this screen was only reachable by scrolling. The acquire
 * form takes the button's place here so it opens where the tap happened.
 */
export function AcquireBar({
  route,
  showForm,
  amount,
  destinationLabel,
  onAmountChange,
  onConfirm,
  onCancel,
  cutPercent,
  onCutPercentChange,
  added,
  isTracking,
  onBegin,
}: {
  route: Route;
  showForm: boolean;
  amount: string;
  destinationLabel: string;
  onAmountChange: (amount: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  cutPercent: number;
  onCutPercentChange: (percent: number) => void;
  added: boolean;
  isTracking: boolean;
  onBegin: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const [pillPressed, setPillPressed] = useState(false);
  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View
        className="px-4 pt-3 pb-2"
        style={{
          backgroundColor: theme.background,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        }}
      >
        {showForm ? (
          <TrackRouteForm
            amount={amount}
            destinationLabel={destinationLabel}
            onAmountChange={onAmountChange}
            onConfirm={onConfirm}
            onCancel={onCancel}
            cardRewards={route.cardRewards}
            cut={route.spendingCut}
            cutPercent={cutPercent}
            onCutPercentChange={onCutPercentChange}
          />
        ) : (
          <Pressable
            onPress={() => { Haptic.press(); onBegin(); }}
            disabled={added || isTracking}
            accessibilityRole="button"
            onPressIn={() => setPillPressed(true)}
            onPressOut={() => setPillPressed(false)}
            // A pill that sits up off the page and gives under the finger: the one
            // action on this screen should look like the thing to press. Pressed state
            // is held here, not in a style function, which NativeWind's Pressable drops.
            style={{
              minHeight: 54,
              borderRadius: Radius.lg,
              backgroundColor: Brand[500],
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: added || isTracking ? 0.6 : pillPressed ? 0.88 : 1,
              transform: [{ scale: pillPressed ? 0.98 : 1 }],
              shadowColor: "#000",
              shadowOpacity: pillPressed ? 0.06 : 0.12,
              shadowRadius: pillPressed ? 4 : 10,
              shadowOffset: { width: 0, height: pillPressed ? 1 : 4 },
              elevation: pillPressed ? 1 : 3,
            }}
          >
            {!added && !isTracking ? <Icon icon={Plus} size={19} color="#FFFFFF" strokeWidth={2.75} /> : null}
            <ThemedText style={{ fontSize: 17, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.2 }}>
              {added
                ? "Saved to your plan ✓"
                : isTracking
                  ? "Saving..."
                  : "Add to plan"}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
