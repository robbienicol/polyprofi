import {
  ArrowRightLeft,
  Banknote,
  Bitcoin,
  Bell,
  Brain,
  Brush,
  Building,
  CalendarDays,
  Car,
  ChartColumn,
  ChartLine,
  Check,
  Clapperboard,
  Coffee,
  Coins,
  CreditCard,
  Compass,
  Dog,
  Feather,
  FileText,
  FlaskConical,
  Globe,
  Headphones,
  Hourglass,
  House,
  Landmark,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  Map,
  MapPin,
  Menu,
  PartyPopper,
  Pencil,
  Plane,
  Rocket,
  Scale,
  Scissors,
  Search,
  Shield,
  Sparkles,
  Sprout,
  Star,
  Target,
  Trash,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Volleyball,
  Vote,
  Wallet,
  WavesHorizontal,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';

/**
 * Every pictograph in the app is drawn here, as SVG.
 *
 * Emoji were the app's icon set for a long time and they are still how icons
 * travel through *data* — a route carries `emoji`, a saved goal carries the one
 * it was created with, and the route model can emit whatever it likes. Rewriting
 * that data would mean a migration of every stored goal and a stricter contract
 * with the model than it can keep, so instead the glyph is treated as a name:
 * this table turns it into a drawn icon at the moment of rendering, and anything
 * unrecognised falls back to a neutral mark rather than a missing-glyph box.
 *
 * Keep the map and the data in step: an emoji introduced anywhere in `lib/` or
 * in the model's prompt should be given a line here at the same time.
 */
const ICON_BY_GLYPH: Record<string, LucideIcon> = {
  // Markets and instruments
  '📈': TrendingUp,
  '📉': TrendingDown,
  '📊': ChartColumn,
  '🔮': Sparkles,
  '🏦': Landmark,
  '🏢': Building,
  '🏛': Vote,
  '🚀': Rocket,
  '💰': Coins,
  '₿': Bitcoin,
  '💳': CreditCard,
  '💵': Banknote,
  '💸': Wallet,
  '💱': ArrowRightLeft,
  '🪶': Feather,
  '🐕': Dog,
  '✂️': Scissors,
  '✂': Scissors,
  '🔁': ChartLine,
  '🔄': ChartLine,

  // Goals
  '🎯': Target,
  '🛟': LifeBuoy,
  '🎧': Headphones,
  '✈️': Plane,
  '✈': Plane,
  '🚗': Car,
  '🏠': House,
  '🏄': WavesHorizontal,
  '🗾': Map,
  '🌱': Sprout,
  '🏆': Trophy,
  '🎉': PartyPopper,
  '⚡': Zap,
  '⏳': Hourglass,

  // Prediction-market topics
  '🏈': Volleyball,
  '🎬': Clapperboard,
  '🌍': Globe,
  '☕': Coffee,

  // Chrome and settings
  '🔔': Bell,
  '🗓': CalendarDays,
  '🔒': Lock,
  '⭐️': Star,
  '⭐': Star,
  '✉️': Mail,
  '✉': Mail,
  '📄': FileText,
  '⚖️': Scale,
  '⚖': Scale,
  '🧪': FlaskConical,
  '🧹': Brush,
  '🚪': LogOut,
  '🗑': Trash,
  '🔍': Search,
  '🔎': Search,
  '📋': FileText,
  '✏️': Pencil,
  '✏': Pencil,
  '🧭': Compass,
  '📍': MapPin,
  '🧠': Brain,
  '🛡': Shield,
  '⚠️': TriangleAlert,
  '⚠': TriangleAlert,
  '📡': Wifi,
  '☰': Menu,
  '✓': Check,
  '✗': X,
  '✕': X,
};

/** Drawn when a glyph has no icon of its own — the model can emit anything. */
const FALLBACK = Sparkles;

export function iconForGlyph(glyph: string | null | undefined): LucideIcon {
  if (!glyph) return FALLBACK;
  return ICON_BY_GLYPH[glyph] ?? ICON_BY_GLYPH[glyph.replace('️', '')] ?? FALLBACK;
}

/**
 * One icon, sized and coloured like the text it sits beside. `glyph` takes the
 * emoji an older call site (or a piece of data) still carries; `icon` takes a
 * drawn icon directly, for the many places that never had an emoji at all.
 */
export function Icon({
  glyph,
  icon,
  size = 18,
  color,
  strokeWidth = 2,
}: {
  glyph?: string | null;
  icon?: LucideIcon;
  size?: number;
  color: string;
  strokeWidth?: number;
}): React.ReactElement {
  // `createElement` rather than a dynamic JSX tag: the icon is picked from a table
  // of components that already exist, and a capitalised local read as a component
  // being *defined* here, which is the one thing a render is not allowed to do.
  return React.createElement(icon ?? iconForGlyph(glyph), { size, color, strokeWidth });
}
