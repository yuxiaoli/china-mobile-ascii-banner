# 中国移动香港创新院 — ASCII Flow

A standalone white banner in which blue and green ASCII characters gradually form the supplied China Mobile logo and the outlined “香港创新院” lettering. Desktop uses a horizontal composition; narrow screens place the lettering below the logo.

## Run and publish

Serve this directory with any static HTTP server, or use it as a GitHub Pages artifact. The entry point is `index.html`. No build step or dependencies are required. All runtime assets use relative URLs, so the banner works under a repository subpath.

Run `npm test` to check composition geometry, color-region fidelity, continuous motion, independent controls, pause/replay, reduced motion, visibility handling, and cleanup.

## Artwork provenance

`assets/china-mobile-logo.svg` is the existing vector reconstruction traced from the PNG supplied by the user. Its five paths, 449×445 aspect ratio, and blue (`#0085CC`) / green (`#95C11F`) regions remain intact.

`assets/hk-innovation-lettering.svg` contains the exact five outlined Chinese paths from the user-provided version 7 badge. The original white lettering is recolored to brand blue (`#0085CC`) for the white background. Its path geometry and `39.8 7.8 64.5 12.5` viewBox are preserved. The surrounding badge border and gradient are excluded. The lettering artwork uses its supplied outlines rather than a substitute font.

The application rasterizes the original logo at 449×445 and the lettering at 1290×250, then samples those two masks for the ASCII composition. The original vector images provide the static fallback. The renderer and JavaScript fallback share `compositionLayoutAt` so their placement agrees; CSS supplies a responsive fallback when JavaScript is unavailable.

## Animation and controls

The original Canvas 2D animation needs no WebGL, third-party scripts, analytics, or external network requests. Seeded continuous paths gradually resolve into the logo and lettering, while ambient characters continue moving on white.

Total formation time ranges from 30 to 60 seconds and defaults to 45 seconds. Every cycle includes a fixed 10-second opening, leaving 20, 35, or 50 seconds of assembly at the 30-, 45-, and 60-second settings. Changing the setting during the opening preserves its fixed boundary. During assembly, it preserves current progress and particle positions while changing the remaining pace.

Flow speed ranges from 0.25× to 2×. Changing it preserves the current movement phase and formation progress, then changes future movement speed. The two controls are independent. Replay starts a full cycle with the selected settings; pause and reduced motion remain in effect when settings are adjusted.

Native labelled ranges have visible values, keyboard support, and 44-pixel input height. The system reduced-motion preference starts with an explained, complete still composition. Visitors may explicitly enable motion for the current page. Intentional pause remains separate from hidden-page and offscreen suspension, including page restoration.

## Reuse

Import `AsciiField` from `renderer.js` and supply a canvas with `logoPixels`, `textPixels`, and the optional `reduced` setting. Methods include `setPaused`, `setReduced`, `setFlowSpeed`, `setTotalDuration`, `setFormationDuration` (a total-time alias), `replay`, and `destroy`.

## GitHub Pages

The public website is served from the `develop` branch root at <https://yuxiaoli.github.io/china-mobile-ascii-banner/>. Runtime assets use relative paths beneath `/china-mobile-ascii-banner/`. The `main` branch retains its initial baseline. Live browser verification is reported separately from the source tests.
