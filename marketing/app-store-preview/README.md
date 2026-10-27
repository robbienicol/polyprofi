# Pathey App Store preview

`pathey-app-preview.mp4`: 886×1920, 30 fps, H.264 High, 27.97 s, silent stereo AAC 48 kHz.
Upload it under the **6.9" iPhone** display size. App Store Connect scales it down for smaller iPhones unless you upload separate previews for them.

## Apple rules this cut follows
- It uses only screen captures of the app, full-bleed. Device frames, outlines and hands are left out because reviewers reject them under 2.3.4.
- The captions are textual overlays. The text has no prices, dates or "new" claims. The end frame discloses that sign-in is required.
- Transitions are plain dissolves and cuts. Jump cuts only remove stretches where the capture is static.
- Length is between 15 and 30 s, at 30 fps.

## Poster frame
In App Store Connect, set the poster frame to **0:01** (the "Pick a goal. See every route." frame). `pathey-app-preview-poster.png` is that frame.
Apple's default frame is often mid-transition. Changing the poster frame after approval requires a new submission.

## Storyboard (all copy is in `build_preview.py`; captions match the store screenshots from `scripts/generate-store-screenshots.mjs`)
| Time | Footage | Caption |
| --- | --- | --- |
| 0–3 s | Routes list, Make +$350 | Pick a goal. See every route. |
| 3–6 s | Scroll into scored routes | Stocks and bets. Same math. |
| 6–9.5 s | Sports + Weeks filters | Filter by topic and timeframe. |
| 9.5–12.5 s | Tap into a route | See the odds before you buy. |
| 12.5–15.5 s | Potential outcome | The upside. The downside. |
| 15.5–20 s | Drag score dials, list re-ranks | You decide what best means. |
| 20–25 s | AI coach question, then answer | Ask what could go wrong. |
| 25–28 s | End frame over the app | Pathey · Not advice. Just the math. |

## Promotional text (170 max; change it any time without a review)
1. One goal. Every route. Ranked. Tell Pathey what you want to make and by when. It scores stocks, savings and prediction markets with the same math. (146)
2. Prediction markets, scored like everything else. See the odds, the exit plan and the downside on every route, then ask the AI coach what could go wrong. (152)
3. Not advice. Just the math. Pathey ranks every route to your goal by its chance of getting there, and tells you when the goal doesn't add up. (140)

## Re-render
Run `python3 build_preview.py` here. You need ffmpeg and `pip install pillow numpy`.
It reads `../captures/`, the fonts in `node_modules/@expo-google-fonts` and `video/public/icon.png`.
To use fresh recordings, replace the files in `../captures/`, delete `.cfr/`, then retune the `start`/`dur` values in `SEGMENTS`.
