import {
  Bitcoin,
  Building,
  ChartColumn,
  ChartLine,
  Coffee,
  Coins,
  CreditCard,
  CreditCardPlus,
  Dog,
  Dumbbell,
  Flag,
  Fuel,
  Gamepad2,
  Gem,
  Globe,
  HandCoins,
  Landmark,
  PiggyBank,
  Plane,
  Popcorn,
  ReceiptText,
  Repeat,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
  Tv,
  Utensils,
  Vote,
  WalletCards,
  Zap,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

import { routeSubcategory } from '@/lib/route-subcategories';
import type { Route } from '@/types/routes';

/*
 * Sports balls Lucide does not draw, in Lucide's own hand: a 24-unit box, round caps
 * and joins, stroke only. Typed as LucideIcon so <Icon icon={…}> takes them as is.
 */
function sportIcon(draw: (stroke: string, width: number) => React.ReactNode): LucideIcon {
  function SportIcon({ size = 24, color = 'currentColor', strokeWidth = 2 }: LucideProps) {
    const width = Number(strokeWidth);
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color as string} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
        {draw(color as string, width)}
      </Svg>
    );
  }
  return SportIcon as unknown as LucideIcon;
}

export const FootballIcon = sportIcon(() => (
  <>
    <Ellipse cx={12} cy={12} rx={10} ry={6} transform="rotate(-45 12 12)" />
    <Line x1={9} y1={15} x2={15} y2={9} />
    <Line x1={9.6} y1={12.6} x2={11.4} y2={14.4} />
    <Line x1={11.1} y1={11.1} x2={12.9} y2={12.9} />
    <Line x1={12.6} y1={9.6} x2={14.4} y2={11.4} />
  </>
));

export const BasketballIcon = sportIcon(() => (
  <>
    <Circle cx={12} cy={12} r={10} />
    <Line x1={12} y1={2} x2={12} y2={22} />
    <Line x1={2} y1={12} x2={22} y2={12} />
    <Path d="M4.9 4.9C8 8 8 16 4.9 19.1" />
    <Path d="M19.1 4.9C16 8 16 16 19.1 19.1" />
  </>
));

export const BaseballIcon = sportIcon(() => (
  <>
    <Circle cx={12} cy={12} r={10} />
    <Path d="M5.6 4.4C8.2 6.5 9.3 9.2 9.3 12s-1.1 5.5-3.7 7.6" />
    <Path d="M18.4 4.4C15.8 6.5 14.7 9.2 14.7 12s1.1 5.5 3.7 7.6" />
    <Line x1={7.3} y1={7.6} x2={8.8} y2={7} />
    <Line x1={7.9} y1={12} x2={9.4} y2={12} />
    <Line x1={7.3} y1={16.4} x2={8.8} y2={17} />
    <Line x1={16.7} y1={7.6} x2={15.2} y2={7} />
    <Line x1={16.1} y1={12} x2={14.6} y2={12} />
    <Line x1={16.7} y1={16.4} x2={15.2} y2={17} />
  </>
));

export const SoccerIcon = sportIcon(() => (
  <>
    <Circle cx={12} cy={12} r={10} />
    <Path d="M12 8.6l3.2 2.3-1.2 3.8H10l-1.2-3.8Z" />
    <Line x1={12} y1={8.6} x2={12} y2={2} />
    <Line x1={15.2} y1={10.9} x2={21.5} y2={8.9} />
    <Line x1={14} y1={14.7} x2={17.9} y2={20.1} />
    <Line x1={10} y1={14.7} x2={6.1} y2={20.1} />
    <Line x1={8.8} y1={10.9} x2={2.5} y2={8.9} />
  </>
));

export const HockeyIcon = sportIcon(() => (
  <>
    <Path d="M4 3l7.3 11.4c.4.6 1 .9 1.7.9H20" />
    <Ellipse cx={8} cy={19.5} rx={3.5} ry={1.6} />
  </>
));

export const TennisIcon = sportIcon(() => (
  <>
    <Circle cx={12} cy={12} r={10} />
    <Path d="M2.6 9.2C6.8 9.6 9.8 6.6 9.3 2.4" />
    <Path d="M21.4 14.8c-4.2-.4-7.2 2.6-6.7 6.8" />
  </>
));

export const GolfIcon = sportIcon(() => (
  <>
    <Path d="M12 18V3l7 3.5-7 3.5" />
    <Ellipse cx={12} cy={19.5} rx={6.5} ry={2} />
  </>
));

const LEAGUE_ICONS: Record<string, LucideIcon> = {
  nfl: FootballIcon,
  cfb: FootballIcon,
  nba: BasketballIcon,
  wnba: BasketballIcon,
  cbb: BasketballIcon,
  mlb: BaseballIcon,
  nhl: HockeyIcon,
  soccer: SoccerIcon,
  tennis: TennisIcon,
  golf: GolfIcon,
  fighting: Swords,
  f1: Flag,
  esports: Gamepad2,
};

const TOPIC_ICONS: Record<string, LucideIcon> = {
  sports: Trophy,
  crypto: Bitcoin,
  politics: Vote,
  economy: ChartLine,
  culture: Popcorn,
  world: Globe,
};

export function leagueIcon(value: string | null | undefined): LucideIcon | undefined {
  return value ? LEAGUE_ICONS[value] : undefined;
}

export function topicIcon(value: string | null | undefined): LucideIcon | undefined {
  return value ? TOPIC_ICONS[value] : undefined;
}

/** A spending category, by the words banks actually file it under. */
function spendingIcon(name: string): LucideIcon {
  const text = name.toLowerCase();
  if (/coffee|cafe/.test(text)) return Coffee;
  if (/dining|restaurant|food|takeout|takeaway|bar/.test(text)) return Utensils;
  if (/grocer|supermarket/.test(text)) return ShoppingCart;
  if (/shop|retail|cloth|merchandise/.test(text)) return ShoppingBag;
  if (/travel|air|hotel|flight/.test(text)) return Plane;
  if (/gas|fuel/.test(text)) return Fuel;
  if (/entertain|movie|stream|music/.test(text)) return Tv;
  if (/gym|fitness|sport/.test(text)) return Dumbbell;
  return Scissors;
}

const SUBCATEGORY_ICONS: Record<string, LucideIcon> = {
  subscriptions: Repeat,
  'new-card': CreditCardPlus,
  reroute: WalletCards,
  calls: TrendingUp,
  puts: TrendingDown,
  income: HandCoins,
  stocks: Building,
  bonds: ReceiptText,
  gold: Coins,
  index: ChartColumn,
  tbills: Landmark,
  savings: PiggyBank,
  'BTC-USD': Bitcoin,
  'ETH-USD': Gem,
  'SOL-USD': Zap,
  'DOGE-USD': Dog,
  'XRP-USD': Coins,
};

export function subcategoryIcon(value: string): LucideIcon | undefined {
  if (value.startsWith('spend-')) return spendingIcon(value.slice(6).replace(/-/g, ' '));
  return SUBCATEGORY_ICONS[value];
}

/**
 * The mark for a route, as specific as what is known about it: the league's ball, then
 * the topic, then the kind of route inside its class, then the class itself.
 */
export function routeIcon(route: Route): LucideIcon | undefined {
  const league = leagueIcon(route.predictionSubtopic);
  if (league) return league;
  const topic = topicIcon(route.predictionTopic);
  if (topic) return topic;
  const sub = routeSubcategory(route);
  if (sub) return subcategoryIcon(sub.value);
  if (route.spendingCut) return Scissors;
  if (route.cardRewards) return CreditCard;
  if (/polymarket|prediction|kalshi/i.test(`${route.category} ${route.platform}`)) return ChartColumn;
  if (/crypto/i.test(route.category)) return Bitcoin;
  if (/savings|treasur/i.test(route.category)) return Landmark;
  if (/stock|etf/i.test(route.category)) return TrendingUp;
  if (/option/i.test(route.category)) return TrendingUp;
  return undefined;
}
