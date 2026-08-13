import { useAuth } from '@clerk/clerk-expo';
import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { fetchRouteCoachReply } from '@/api/client/insights';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Route } from '@/types/routes';

interface CoachMessage {
  role: 'user' | 'coach';
  text: string;
}

export function RouteCoach({ route }: { route: Route }): React.ReactElement {
  const { getToken } = useAuth();
  const theme = useTheme();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const starter = `This route has a ${route.probability}% chance of reaching the goal with $${route.expectedReturn} potential profit. Ask me why it ranks here, what could go wrong, or how to size it.`;

  async function sendQuestion(): Promise<void> {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setQuestion('');
    setMessages((current) => [...current, { role: 'user', text: trimmed }]);
    setLoading(true);
    const reply = await fetchRouteCoachReply(route, trimmed, getToken).catch(() => 'I could not reach the coach right now. The key check is still probability versus downside before you size this.');
    setMessages((current) => [...current, { role: 'coach', text: reply }]);
    setLoading(false);
  }

  return (
    <View style={{ backgroundColor: theme.backgroundElevated, borderRadius: Radius.xl, padding: 16, borderWidth: 1, borderColor: theme.border, gap: 12, ...Shadow.card }}>
      <View className="flex-row items-center justify-between">
        <ThemedText style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>AI Coach</ThemedText>
        <View style={{ borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Brand[500] + '18', borderWidth: 1, borderColor: Brand[500] + '44' }}><ThemedText style={{ fontSize: 10, fontWeight: '800', color: Brand[500] }}>BETA</ThemedText></View>
      </View>
      <View style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, padding: 13 }}><ThemedText style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19 }}>{starter}</ThemedText></View>
      {messages.map((message, index) => {
        const user = message.role === 'user';
        return <View key={`${message.role}-${index}`} style={{ alignSelf: user ? 'flex-end' : 'flex-start', maxWidth: '88%', borderRadius: Radius.lg, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: user ? Brand[500] : theme.backgroundElement, borderWidth: user ? 0 : 1, borderColor: theme.border }}><ThemedText style={{ fontSize: 13, lineHeight: 19, color: user ? '#06140C' : theme.text, fontWeight: user ? '700' : '500' }}>{message.text}</ThemedText></View>;
      })}
      {loading && <View className="flex-row items-center gap-2"><ActivityIndicator color={Brand[500]} size="small" /><ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>Coach is thinking…</ThemedText></View>}
      <View className="flex-row items-center gap-2" style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, paddingLeft: 12, paddingRight: 6, paddingVertical: 6 }}>
        <TextInput value={question} onChangeText={setQuestion} placeholder="Ask why, risk, sizing..." placeholderTextColor={theme.textTertiary} className="flex-1" style={{ color: theme.text, fontSize: 13, paddingVertical: 8 }} onSubmitEditing={sendQuestion} returnKeyType="send" />
        <Pressable onPress={sendQuestion} disabled={loading || question.trim().length === 0} className="active:opacity-80" style={{ borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: Brand[500], opacity: loading || question.trim().length === 0 ? 0.45 : 1 }}><ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#06140C' }}>Send</ThemedText></Pressable>
      </View>
    </View>
  );
}
