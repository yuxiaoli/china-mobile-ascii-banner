# China Mobile ASCII Flow

A standalone white banner that slowly brings blue and green ASCII characters into the supplied China Mobile icon.

## Run and publish

Serve this directory with any static HTTP server, or use it as a GitHub Pages artifact. The entry point is `index.html`. No build step or dependencies are required. All runtime assets use relative URLs, so the banner works under a repository subpath.

Run `npm test` to check geometry, color-region fidelity, motion continuity, pause/replay, reduced motion, visibility handling, and cleanup.

## Logo provenance

`assets/china-mobile-logo.svg` is a vector reconstruction traced from a PNG provided by the user in the conversation. It is not represented as a download from an official brand asset source. The SVG retains the supplied five paths, original aspect ratio, and blue (#0085CC) / green (#95C11F) regions. China Mobile's name and logo belong to their respective rights holders; this demo does not grant additional trademark or asset rights.

## Animation

The Canvas 2D renderer is original application code. It does not require WebGL, third-party scripts, analytics, or external network requests. Pause/play, replay, system reduced-motion preferences, and offscreen/hidden-document suspension are supported. The original SVG is the fallback when JavaScript or Canvas 2D is unavailable.

The broad ribbon flow advances continuously at 0.04 radians/second, with an arc phase of 0.09 radians/second. This makes background motion visible over 2–5 seconds without changing the 42-second logo reveal or the supplied logo mask and colors. Reduced motion starts as an explained still composition; the visitor can deliberately enable motion for the current page.

## Verification scope

Automated renderer and control tests cover logo geometry, color-region fidelity, continuous motion, lifecycle handling, and the reduced-motion choice. Live browser verification is reported separately from these source tests.
