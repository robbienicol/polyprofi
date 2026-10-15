#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceDir = join(root, 'store-screenshots', 'source-current');
const outputDir = join(root, 'store-screenshots', 'marketing-6.9');
const generatedBackground = join(sourceDir, 'generated-path-background.png');
// The brand faces (BRANDING.md): Source Serif 4 sets the headline, Public Sans
// everything under it. Read straight out of node_modules so the slides use the
// same files the app bundles.
const fontDisplay = join(
  root,
  'node_modules/@expo-google-fonts/source-serif-4/700Bold/SourceSerif4_700Bold.ttf',
);
const fontBold = join(
  root,
  'node_modules/@expo-google-fonts/public-sans/700Bold/PublicSans_700Bold.ttf',
);
const fontRegular = join(
  root,
  'node_modules/@expo-google-fonts/public-sans/500Medium/PublicSans_500Medium.ttf',
);

// Palette tokens, mirroring src/constants/theme.ts. Slides alternate cream and
// near-black; brand clay carries the eyebrow and the rule, and nothing else.
const CREAM = '#F7F3EC';
const NIGHT = '#141312';
const INK = '#1C1A18';
const MUTED = '#756F68';
const MUTED_DARK = '#A79F95';
const TINT_LIGHT = '#EDE6DA';
const TINT_DARK = '#24211E';
const BRAND = '#D9653D';

const light = { background: CREAM, accent: TINT_LIGHT, text: INK, muted: MUTED, glow: BRAND };
const dark = { background: NIGHT, accent: TINT_DARK, text: CREAM, muted: MUTED_DARK, glow: BRAND };

const slides = [
  {
    layout: 'hook',
    output: '00-what-pathey-does.png',
    source: '02-ranked-routes.png',
    eyebrow: 'PATHEY',
    headline: 'Not advice.\nJust the math.',
    subhead: 'Tell it the goal. It prices every route to it —\nsavings, stocks, crypto, prediction markets.',
    ...light,
  },
  {
    output: '01-how-it-works.png',
    source: '01-how-it-works.png',
    eyebrow: 'EVERY ROUTE, SAFEST FIRST',
    headline: 'Tell it the goal.\nIt finds the route.',
    subhead: 'Every route, safest first. Scored out of 100,\nand every score opens into its working.',
    ...dark,
  },
  {
    output: '02-ranked-routes.png',
    source: '02-ranked-routes.png',
    eyebrow: 'RANKED FOR YOUR NUMBER',
    headline: 'A Roth IRA and a bet\nget the same math.',
    subhead: 'Sometimes the bet wins. Drag the dials,\nand the list re-ranks for your number.',
    ...light,
  },
  {
    output: '03-goals.png',
    source: '03-goals.png',
    eyebrow: 'YOUR NUMBER, YOUR DEADLINE',
    headline: 'Six months or\nsix years.',
    subhead: 'The math changes with your goals — and it\nsays so when the goal does not add up.',
    ...dark,
  },
  {
    output: '04-portfolio.png',
    source: '04-portfolio.png',
    eyebrow: 'ONE LIVE VIEW',
    headline: 'The whole plan,\npriced today.',
    subhead: 'Worth now, expected outcomes and the odds\nof hitting the goal, in one live view.',
    ...light,
  },
  {
    output: '05-positions.png',
    source: '05-positions.png',
    eyebrow: 'WHAT COULD GO WRONG',
    headline: 'An AI coach\nfor every pick.',
    subhead: 'Including what could go wrong. Track each\nposition live, and record how it closed.',
    ...dark,
  },
  {
    output: '06-new-goal.png',
    source: '06-new-goal.png',
    eyebrow: 'START WITH THE GOAL',
    headline: 'Not the best recipe.\nThe best compass.',
    subhead: 'Nobody knows the market.\nEverybody can read a map.',
    ...light,
  },
];

function magick(args) {
  execFileSync('magick', args, { stdio: 'inherit' });
}

function buildBackground(slide, path) {
  if (slide.background === 'generated') {
    magick([
      generatedBackground,
      '-resize',
      '1320x2868^',
      '-gravity',
      'center',
      '-extent',
      '1320x2868',
      '-fill',
      'rgba(0,0,0,0.08)',
      '-colorize',
      '8',
      path,
    ]);
    return;
  }

  magick([
    '-size',
    '1320x2868',
    `canvas:${slide.background}`,
    '-fill',
    slide.accent,
    '-draw',
    'circle 1180,180 1490,180',
    '-draw',
    'circle 80,2520 460,2520',
    path,
  ]);
}

function buildPhone(source, path) {
  const screen = path.replace('.png', '-screen.png');
  const framed = path.replace('.png', '-framed.png');
  const mask = path.replace('.png', '-mask.png');

  magick([source, '-resize', '930x2022!', '-alpha', 'on', screen]);
  magick([
    '-size',
    '930x2022',
    'xc:none',
    '-fill',
    'white',
    '-draw',
    'roundrectangle 0,0 929,2021 78,78',
    mask,
  ]);
  magick([screen, mask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', screen]);
  magick([
    '-size',
    '966x2058',
    'xc:none',
    '-fill',
    NIGHT,
    '-draw',
    'roundrectangle 0,0 965,2057 94,94',
    screen,
    '-geometry',
    '+18+18',
    '-compose',
    'over',
    '-composite',
    framed,
  ]);
  magick([
    framed,
    '(',
    '+clone',
    '-channel',
    'A',
    '-shadow',
    '0x28+0+34',
    ')',
    '+swap',
    '-background',
    'none',
    '-layers',
    'merge',
    '+repage',
    path,
  ]);
}

function renderSlide(slide, workingDir) {
  const background = join(workingDir, `${slide.output}-background.png`);
  const phone = join(workingDir, `${slide.output}-phone.png`);
  const source = join(sourceDir, slide.source);
  const output = join(outputDir, slide.output);

  buildBackground(slide, background);
  buildPhone(source, phone);

  if (slide.layout === 'hook') {
    magick([
      background,
      '-font',
      fontBold,
      '-pointsize',
      '29',
      '-kerning',
      '3.2',
      '-fill',
      slide.muted,
      '-gravity',
      'northwest',
      '-annotate',
      '+86+110',
      slide.eyebrow,
      '-font',
      fontDisplay,
      '-pointsize',
      '130',
      '-kerning',
      '-3.5',
      '-interline-spacing',
      '-15',
      '-fill',
      slide.text,
      '-annotate',
      '+76+180',
      slide.headline,
      '-font',
      fontRegular,
      '-pointsize',
      '37',
      '-kerning',
      '-0.5',
      '-interline-spacing',
      '4',
      '-fill',
      slide.muted,
      '-annotate',
      '+82+690',
      slide.subhead,
      '-fill',
      slide.glow,
      '-draw',
      'roundrectangle 80,850 330,865 7,7',
      phone,
      '-gravity',
      'north',
      '-geometry',
      '+0+930',
      '-compose',
      'over',
      '-composite',
      '-alpha',
      'off',
      '-strip',
      `PNG24:${output}`,
    ]);
    return;
  }

  magick([
    background,
    '-font',
    fontBold,
    '-pointsize',
    '29',
    '-kerning',
    '3.2',
    '-fill',
    slide.muted,
    '-gravity',
    'northwest',
    '-annotate',
    '+86+112',
    slide.eyebrow,
    '-font',
    fontDisplay,
    '-pointsize',
    '112',
    '-kerning',
    '-2.5',
    '-interline-spacing',
    '-12',
    '-fill',
    slide.text,
    '-annotate',
    '+80+168',
    slide.headline,
    '-font',
    fontRegular,
    '-pointsize',
    '38',
    '-kerning',
    '-0.4',
    '-interline-spacing',
    '2',
    '-fill',
    slide.muted,
    '-annotate',
    '+84+456',
    slide.subhead,
    '-fill',
    slide.glow,
    '-draw',
    'roundrectangle 80,590 250,603 6,6',
    phone,
    '-gravity',
    'north',
    '-geometry',
    '+0+650',
    '-compose',
    'over',
    '-composite',
    '-alpha',
    'off',
    '-strip',
    `PNG24:${output}`,
  ]);
}

mkdirSync(outputDir, { recursive: true });
const workingDir = mkdtempSync(join(tmpdir(), 'pathey-store-'));

try {
  for (const slide of slides) renderSlide(slide, workingDir);
} finally {
  rmSync(workingDir, { recursive: true, force: true });
}

console.log(`Generated ${slides.length} screenshots in ${outputDir}`);
