# SEO Analyzer (Chrome Extension)

Analyze any website page's basic SEO signals (title, meta tags, headings, image alts, canonical, robots, structured data, and word count) and show a simple score inside a clean popup UI.

![SEO Analyzer Icon](icons/128.png)

## Features

- One-click analysis for the current tab
- Simple score (0-100) + quick summary
- Fast: runs locally by reading the page DOM (no external API)
- Refresh button to re-check after page changes

## What It Checks

The popup shows these metrics:

- Page title length
- Meta description length
- Meta keywords (optional)
- Headings distribution (H1-H6)
- Image alt coverage
- Canonical tag
- Robots meta tag (warns if `noindex`/`nofollow`)
- Structured data (JSON-LD) presence + parse success
- Approx. word count

Note: The scoring is heuristic for quick feedback; it is not an official ranking signal.

## Download and Extract

[Download.zip](https://github.com/msisaif/chrome-extension-SEO-Analyzer/archive/refs/heads/main.zip)

1. Download the zip file.
2. Open your **Downloads** folder.
3. Double-click the `.zip` file to extract it.
4. You will get a folder like `chrome-extension-SEO-Analyzer-main`.

## Install (Load Unpacked)

1. Open Chrome -> `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the folder: `chrome-extension-SEO-Analyzer-main`

## How To Use

1. Open any normal website tab (e.g., `https://example.com`)
2. Click the **SEO Analyzer** extension icon
3. Review the score + checklist
4. Click **Refresh** to analyze again

## Notes / Limitations

- Chrome blocks content scripts on special pages like `chrome://`, `chrome-extension://`, `edge://`, and `about:` (so those can't be analyzed).
- Some websites may block scripts or heavily change the DOM; if you see an error, reload the tab and try again.

## Permissions

- `activeTab` / `tabs`: used to read the current tab URL and message the content script.
- Content script runs on `<all_urls>` to read SEO-related elements from the DOM.
