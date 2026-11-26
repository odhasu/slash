# Slash Wallet local preview

Run the preview from any directory. It binds to localhost and serves captured HTML, Next.js navigation data, and media from `site/`.

```sh
uv run --script /Users/oscargraafmans/Documents/ChatGPT/slash/splashwallet-homepage-capture/serve.py
```

Open [the local preview](http://localhost:8765/).

## Routes

The local URL paths follow the original sitemap, with the Learn index removed. [Manifest](manifest.json)

| Source and local path | Captured pages |
| --- | ---: |
| `/` | 1 |
| `/product/` | 1 |
| `/markets/` and `/markets/{slug}/` | 245 |
| `/learn/hyperliquid-mobile/` and `/learn/hyperliquid-mobile-app/` | 2 |
| `/faq/`, `/support/`, `/android/`, `/brand/`, `/creator-kit/` | 5 |
| `/legal/`, `/legal/privacy-policy/`, `/legal/term-of-service/` | 3 |

Missing pages display the branded 404 page. Live market prices depend on Hyperliquid. App Store, email, and other outbound links use their original destinations.

## Verification

Homepage comparisons cover the original and local pages at 390, 1440, and 1710 pixels wide. Scroll checkpoints include the sticky card rail entering, moving, releasing, and replaying on reverse scroll. The screenshots also show the hero, trader discovery, and footer. [Desktop comparison](extract/comparison/desktop.png) · [Mobile comparison](extract/comparison/mobile.png) · [Motion measurements](extract/comparison/scroll-motion.json) · [Marquee timing](extract/comparison/marquee.json)

Browser checks cover route rendering, client navigation, mobile touch controls, reduced motion, and video playback. [Route render checks](extract/route-render-verification.json) · [Interaction checks](extract/site-verification.json) · [Mobile checks](extract/mobile-verification.json) · [Video checks](extract/video-verification.json)

## Performance

The preview server negotiates Brotli or gzip for HTML, stylesheets, scripts, and Next.js navigation data. HTML, stylesheets, and navigation data revalidate so edits are picked up. Images and JavaScript use a one-hour cache. Fingerprinted fonts use a one-year cache.

The homepage and market directory preload their hero backgrounds. The homepage card illustrations use width-based WebP variants and load lazily. The gradient rules are bundled with the shared stylesheet.

On this Mac, the preview keeps version-matched local copies under `~/Library/Application Support/Slash Preview/site` so macOS can offload workspace files without interrupting a refresh. The workspace files remain the source for edits.

Mobile Lighthouse 13.0.3, cold local homepage runs with simulated throttling.

| Metric | Before | After |
| --- | ---: | ---: |
| Performance score | 36 | 87 |
| Largest Contentful Paint | 11.9 s | 4.0 s |
| Total Blocking Time | 1,118 ms | 81 ms |
| Cumulative Layout Shift | 0 | 0 |
| Total transfer | 3.20 MB | 0.77 MB |

Separate throttled Chromium runs measured a median homepage LCP of 1.63 s across three cold loads after the changes.
