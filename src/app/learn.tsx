import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Haptic } from '@/lib/haptics';

interface Question {
  q: string;
  a: string;
}

/**
 * Plain-language answers to the words the app uses. Education, not advice: every
 * answer explains how a thing works, never what anyone should buy.
 */
const TOPICS: readonly { title: string; questions: readonly Question[] }[] = [
  {
    title: 'The basics',
    questions: [
      {
        q: 'Why does diversifying matter?',
        a: "Different kinds of assets tend to go up and down at different times. If all your money is in one stock and that company has a bad year, all of it drops together. Spread across savings, Treasuries, funds and other things, one bad bet hurts less. It doesn't make losses impossible, it makes any single one smaller.",
      },
      {
        q: 'What is the trade-off between risk and return?',
        a: "Higher possible returns almost always come with a higher chance of losing money. A savings account pays a little and is very unlikely to lose you anything. A single stock or a crypto coin can pay a lot more, and can also fall a lot. There is no route that is both very safe and very high paying. If something claims to be, be suspicious.",
      },
      {
        q: 'What does "expected value" mean?',
        a: 'It is the average result if you could take the same bet many times. A 50% chance to win $100 and a 50% chance to lose $100 has an expected value of $0, even though any single try wins or loses $100. It is useful for comparing options, but you only get one try, so the chance it works matters too.',
      },
      {
        q: 'What is compounding?',
        a: 'Earning returns on your earlier returns. If $1,000 earns 5% you have $1,050. Next year the 5% is on $1,050, not $1,000. Over short periods the difference is small; over years it adds up a lot.',
      },
      {
        q: 'What is liquidity?',
        a: 'How quickly you can turn something back into cash without losing value. A savings account is very liquid: withdraw any time. A T-bill pays out on a set date. A thinly traded market can be hard to sell at a fair price.',
      },
    ],
  },
  {
    title: 'Savings & Treasuries',
    questions: [
      {
        q: 'What is a high-yield savings account?',
        a: 'A bank savings account that pays more interest than a typical one, usually an online bank. You can take money out any time. In the U.S., deposits at an FDIC-insured bank are insured up to $250,000 per depositor, per bank. The rate can change at any time.',
      },
      {
        q: 'What is a Treasury bill (T-bill)?',
        a: 'A short loan to the U.S. government, from a few weeks up to a year. You buy it for a bit less than its face value, and on the end date you get the full face value back. The difference is your interest. They are backed by the U.S. government, which is why they are treated as one of the safest places for money.',
      },
      {
        q: 'What does "held to maturity" mean?',
        a: "Keeping something until its end date instead of selling early. Held to maturity, a T-bill pays back exactly what it promised. If you sell before then, you get the market price that day, which can be a little more or less.",
      },
      {
        q: 'What do APY and yield mean?',
        a: 'Yield is what an investment pays, written as a yearly percentage. APY (annual percentage yield) includes compounding. A 4% yield on a 3-month T-bill does not mean you earn 4% in 3 months; you earn about a quarter of that, because the rate is per year.',
      },
    ],
  },
  {
    title: 'Stocks & funds',
    questions: [
      {
        q: 'What is a stock?',
        a: "A small piece of ownership in a company. Its price moves with how investors expect the company to do. Over long periods stocks have historically grown more than savings, but in any given month or year they can fall a lot.",
      },
      {
        q: 'What is an ETF?',
        a: 'An exchange-traded fund: one thing you buy that holds many investments inside it, like hundreds of stocks or a pile of T-bills. It trades like a stock. Owning one is an easy way to diversify.',
      },
      {
        q: 'What is an expense ratio?',
        a: "The yearly fee a fund charges, as a percentage of what you hold. A 0.10% expense ratio costs $1 a year for every $1,000. It comes out of the fund's returns, so lower is better when two funds hold the same things.",
      },
    ],
  },
  {
    title: 'Crypto',
    questions: [
      {
        q: 'Why is crypto so volatile?',
        a: "Crypto prices are mostly driven by what people expect others will pay, not by earnings or interest. News, regulation and big holders buying or selling can move prices 10% or more in a day. It can rise fast and fall just as fast, and it is not insured like a bank account.",
      },
    ],
  },
  {
    title: 'Prediction markets',
    questions: [
      {
        q: 'What is a prediction market?',
        a: 'A market where you buy a share in an outcome, like "Will it rain in NYC tomorrow?". A Yes share pays $1 if it happens and $0 if it doesn\'t. If Yes costs 70¢, the market is roughly saying there is a 70% chance.',
      },
      {
        q: 'Why can a prediction market go to zero?',
        a: "Because the share only pays if the outcome happens. If it doesn't, the share is worth nothing and the money you put in is gone. That is very different from a stock or a T-bill, where a bad outcome usually means less money, not none.",
      },
      {
        q: 'What is the spread?',
        a: "The gap between the price buyers will pay and the price sellers will accept. If you buy at 52¢ and could only sell right away at 48¢, the 4¢ spread is a cost you pay just for getting in and out.",
      },
    ],
  },
  {
    title: 'How Pathey works',
    questions: [
      {
        q: 'How is the score worked out?',
        a: "Every route is scored out of 100 on four things: how likely it is to hit your goal, how much of your money is safe if it misses, how little money it needs, and how fast it pays. You can change how much each one counts in Settings, under Ranking.",
      },
      {
        q: 'What does "chance it works" mean?',
        a: "Our estimate of the chance this route reaches your profit goal by your deadline, from live market prices and historical data. It is an estimate, not a promise.",
      },
      {
        q: 'Does Pathey move my money?',
        a: "No. Pathey never places a trade or holds your money. When you pick a route, we send you to the bank, broker or market that offers it and you decide there.",
      },
      {
        q: 'Is this financial advice?',
        a: "No. Pathey compares options so you can see the trade-offs. Nothing here is a recommendation, and any investment can lose money. For advice about your own situation, talk to a licensed financial adviser.",
      },
    ],
  },
];

export default function LearnScreen(): React.ReactElement {
  const theme = useTheme();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: 'Learn', headerShown: true }} />
      <SafeAreaView className="flex-1" edges={['bottom']}>
        <ScrollView contentContainerClassName="px-4 py-5" contentContainerStyle={{ gap: 22 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 6, paddingHorizontal: 4 }}>
            <ThemedText style={{ fontSize: 24, fontWeight: '800', color: theme.text, letterSpacing: -0.4 }}>
              Investing, in plain English
            </ThemedText>
            <ThemedText style={{ fontSize: 14, lineHeight: 20, color: theme.textSecondary }}>
              Short answers to the words you&apos;ll see in Pathey. Tap a question to open it.
            </ThemedText>
          </View>

          {TOPICS.map((topic) => (
            <View key={topic.title} style={{ gap: 8 }}>
              <ThemedText style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: theme.textTertiary, paddingHorizontal: 4 }}>
                {topic.title.toUpperCase()}
              </ThemedText>
              <View
                style={{
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundElement,
                  overflow: 'hidden',
                }}>
                {topic.questions.map((item, index) => {
                  const expanded = open === item.q;
                  return (
                    <Pressable
                      key={item.q}
                      onPress={() => {
                        Haptic.select();
                        setOpen(expanded ? null : item.q);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      className="active:opacity-80"
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        gap: 8,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: theme.border,
                      }}>
                      <View className="flex-row items-center" style={{ gap: 12 }}>
                        <ThemedText style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.text, lineHeight: 21 }}>
                          {item.q}
                        </ThemedText>
                        <ThemedText style={{ fontSize: 18, color: theme.textTertiary }}>{expanded ? '−' : '+'}</ThemedText>
                      </View>
                      {expanded ? (
                        <ThemedText style={{ fontSize: 14, lineHeight: 21, color: theme.textSecondary }}>
                          {item.a}
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          <ThemedText style={{ fontSize: 11, textAlign: 'center', color: theme.textTertiary, paddingHorizontal: 12 }}>
            Educational only, not financial advice.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
