#!/usr/bin/env node

// App Store screenshots, 6.9" (1320x2868). One short headline over one big
// phone: dark page, cream app, nothing else to read.
//
// Screens are stills pulled from the screen recordings in marketing/captures
// (the same footage the App Store preview video uses), so the slides and the
// video always show the same build. Needs ffmpeg and ImageMagick.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const captureDir = join(root, 'marketing', 'captures');
const outputDir = join(root, 'store-screenshots', 'marketing-6.9');
const fontDisplay = join(
  root,
  'node_modules/@expo-google-fonts/source-serif-4/700Bold/SourceSerif4_700Bold.ttf',
);

// Palette tokens, mirroring src/constants/theme.ts.
const NIGHT = '#141312';
const CREAM = '#F7F3EC';
const BRAND = '#D9653D';
const APP_BG = '#F5F2EB'; // the app's screen background, sampled from the captures

const W = 1320;
const H = 2868;

// Captures are 1206x2622; the status bar is the top 180px.
const CAP_W = 1206;
const CAP_H = 2622;
const STATUS_H = 180;
// Every slide wears the same status bar so the clock doesn't jump between them.
const STATUS_FROM = { capture: '03-route-detail', at: 9 };

// Phone: the screen is drawn 1120 wide and runs off the bottom of the page.
const SCREEN_W = 1120;
const SCREEN_H = Math.round((CAP_H * SCREEN_W) / CAP_W);
const BEZEL = 22;
const PHONE_TOP = 690;

// capture/at: which recording and second to grab. scroll: source pixels to
// scroll the content up. Only scroll screens without a tab bar, or the bar
// rides up with the content.
const slides = [
  {
    output: '01-routes.png',
    capture: '01-routes-list',
    at: 0.3,
    headline: ['Pick a goal.', 'See every route.'],
  },
  {
    output: '02-odds.png',
    capture: '03-route-detail',
    at: 9,
    headline: ['See the odds', 'before you buy.'],
  },
  {
    output: '03-outcome.png',
    capture: '03-route-detail',
    at: 25,
    scroll: 320,
    headline: ['The upside.', 'The downside.'],
  },
  {
    output: '04-score.png',
    capture: '04-score-weights',
    at: 40,
    headline: ['You decide', 'what best means.'],
  },
  {
    output: '05-coach.png',
    capture: '04-score-weights',
    at: 0.5,
    scroll: 300,
    headline: ['Ask what could', 'go wrong.'],
  },
];

function magick(args) {
  execFileSync('magick', args, { stdio: 'inherit' });
}

function grab(capture, at, path) {
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-ss', String(at), '-i', join(captureDir, `${capture}.mp4`),
    '-frames:v', '1', path,
  ]);
}

function buildScreen(slide, statusBar, workingDir, path) {
  const raw = join(workingDir, `${slide.output}-raw.png`);
  grab(slide.capture, slide.at, raw);
  const scroll = slide.scroll ?? 0;
  const content = `${CAP_W}x${CAP_H - STATUS_H - scroll}+0+${STATUS_H + scroll}`;
  magick([
    statusBar,
    '(', raw, '-crop', content, '+repage', ')',
    '-background', APP_BG, '-append',
    '-gravity', 'north', '-extent', `${CAP_W}x${CAP_H}`,
    '-resize', `${SCREEN_W}x${SCREEN_H}!`, path,
  ]);
}

function buildPhone(screen, workingDir, path) {
  const mask = join(workingDir, 'mask.png');
  const rounded = join(workingDir, 'rounded.png');
  const fw = SCREEN_W + BEZEL * 2;
  const fh = SCREEN_H + BEZEL * 2;
  magick([
    '-size', `${SCREEN_W}x${SCREEN_H}`, 'xc:none', '-fill', 'white',
    '-draw', `roundrectangle 0,0 ${SCREEN_W - 1},${SCREEN_H - 1} 150,150`, mask,
  ]);
  magick([screen, mask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', rounded]);
  magick([
    '-size', `${fw}x${fh}`, 'xc:none',
    '-fill', '#050505', '-stroke', '#3A3631', '-strokewidth', '4',
    '-draw', `roundrectangle 2,2 ${fw - 3},${fh - 3} 172,172`,
    rounded, '-geometry', `+${BEZEL}+${BEZEL}`, '-compose', 'over', '-composite',
    path,
  ]);
}

// Largest point size (up to 150) at which every headline line fits the page.
function headlineSize(lines) {
  let size = 150;
  for (const line of lines) {
    const width = Number(
      execFileSync('magick', [
        '-font', fontDisplay, '-pointsize', String(size), '-kerning', '-3',
        `label:${line}`, '-format', '%w', 'info:',
      ]).toString(),
    );
    if (width > W - 140) size = Math.floor((size * (W - 140)) / width);
  }
  return size;
}

function renderSlide(slide, statusBar, workingDir) {
  const screen = join(workingDir, `${slide.output}-screen.png`);
  const phone = join(workingDir, `${slide.output}-phone.png`);
  buildScreen(slide, statusBar, workingDir, screen);
  buildPhone(screen, workingDir, phone);

  const size = headlineSize(slide.headline);
  const lineHeight = Math.round(size * 1.08);
  const [first, second] = slide.headline;
  magick([
    '-size', `${W}x${H}`, `canvas:${NIGHT}`,
    // A low clay glow behind the top of the phone.
    '(', '-size', '1500x1500', 'radial-gradient:rgba(217,101,61,0.24)-rgba(217,101,61,0)', ')',
    '-gravity', 'north', '-geometry', `+0+${PHONE_TOP - 450}`, '-compose', 'over', '-composite',
    '-font', fontDisplay, '-pointsize', String(size), '-kerning', '-3',
    '-fill', CREAM, '-annotate', '+0+230', first,
    '-fill', BRAND, '-annotate', `+0+${230 + lineHeight}`, second,
    phone, '-gravity', 'north', '-geometry', `+0+${PHONE_TOP}`, '-composite',
    '-alpha', 'off', '-strip', `PNG24:${join(outputDir, slide.output)}`,
  ]);
}

mkdirSync(outputDir, { recursive: true });
const workingDir = mkdtempSync(join(tmpdir(), 'pathey-store-'));

try {
  const statusRaw = join(workingDir, 'status-raw.png');
  const statusBar = join(workingDir, 'status.png');
  grab(STATUS_FROM.capture, STATUS_FROM.at, statusRaw);
  magick([statusRaw, '-crop', `${CAP_W}x${STATUS_H}+0+0`, '+repage', statusBar]);
  for (const slide of slides) renderSlide(slide, statusBar, workingDir);
} finally {
  rmSync(workingDir, { recursive: true, force: true });
}

console.log(`Generated ${slides.length} screenshots in ${outputDir}`);
