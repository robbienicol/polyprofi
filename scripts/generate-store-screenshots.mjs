#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceDir = join(root, 'store-screenshots', 'source-current');
const outputDir = join(root, 'store-screenshots', 'marketing-6.9');
const generatedBackground = join(sourceDir, 'generated-path-background.png');
const fontRegular = join(
  root,
  'node_modules/@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf',
);
const fontBold = join(
  root,
  'node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf',
);

const slides = [
  {
    layout: 'hook',
    output: '00-what-pathey-does.png',
    source: '02-ranked-routes.png',
    eyebrow: 'PATHEY, IN PLAIN ENGLISH',
    headline: 'Set a money goal.\nSee ranked ways\nto reach it.',
    subhead: 'Pathey compares savings, stocks, crypto and\nprediction markets in one place.',
    background: '#F4FF67',
    accent: '#FF765E',
    text: '#071A16',
    muted: '#304039',
    glow: '#071A16',
  },
  {
    output: '01-how-it-works.png',
    source: '01-how-it-works.png',
    eyebrow: 'PATHEY · THE BIG PICTURE',
    headline: 'See how each\nroute works.',
    subhead: 'Savings, stocks, crypto and prediction markets — explained.',
    background: 'generated',
    text: '#FFFFFF',
    muted: '#C9F7E3',
    glow: '#21D77B',
  },
  {
    output: '02-ranked-routes.png',
    source: '02-ranked-routes.png',
    eyebrow: 'COMPARE WITH CONTEXT',
    headline: 'Options ranked\nfor your goal.',
    subhead: 'Adjust the amount, market and risk profile in one place.',
    background: '#FFE79A',
    accent: '#FF9F1C',
    text: '#071A16',
    muted: '#514521',
    glow: '#FF9F1C',
  },
  {
    output: '03-goals.png',
    source: '03-goals.png',
    eyebrow: 'BUILT AROUND YOUR TARGETS',
    headline: 'Goals stay\nfront and center.',
    subhead: 'See progress, capital committed and what remains.',
    background: '#24CE70',
    accent: '#A8F4C7',
    text: '#06140C',
    muted: '#15492C',
    glow: '#FFFFFF',
  },
  {
    output: '04-portfolio.png',
    source: '04-portfolio.png',
    eyebrow: 'ONE LIVE VIEW',
    headline: 'Your whole plan.\nClearly tracked.',
    subhead: 'Worth now, expected outcomes and goal probability together.',
    background: '#153BB8',
    accent: '#5A7CFF',
    text: '#FFFFFF',
    muted: '#D9E1FF',
    glow: '#75F0C1',
  },
  {
    output: '05-positions.png',
    source: '05-positions.png',
    eyebrow: 'POSITION MONITORING',
    headline: 'Track every\nposition.',
    subhead: 'Monitor live status and record the result when it closes.',
    background: '#FF665B',
    accent: '#FFB3AD',
    text: '#101724',
    muted: '#431A18',
    glow: '#FFE8E4',
  },
  {
    output: '06-new-goal.png',
    source: '06-new-goal.png',
    eyebrow: 'START WITH THE WHY',
    headline: 'Build toward\nsomething real.',
    subhead: 'Choose a goal, then let Pathey map the routes.',
    background: '#DCD7FF',
    accent: '#A899FF',
    text: '#10152B',
    muted: '#403A6B',
    glow: '#6E5BFF',
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
    '#07120F',
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
      fontBold,
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
    fontBold,
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
