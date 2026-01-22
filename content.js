/*
  content.js
  - Runs on every page (document_end).
  - Reads the DOM to extract SEO-related elements.
  - Computes a simple SEO score (0–100) and returns it to the popup.

  Note: This is a heuristic scoring model for quick feedback; it is not a search-engine ranking predictor.
*/

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function normalizeSpace(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function getMetaContentByName(name) {
    const el = document.querySelector(`meta[name="${CSS.escape(name)}"]`);
    return normalizeSpace(el?.getAttribute('content') || '');
}

function getCanonicalHref() {
    const el = document.querySelector('link[rel="canonical"]');
    return normalizeSpace(el?.getAttribute('href') || '');
}

function getJsonLdBlocks() {
    const nodes = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
    );
    const parsed = [];
    let parseErrors = 0;

    for (const node of nodes) {
        const raw = normalizeSpace(node.textContent || '');
        if (!raw) continue;

        try {
            // JSON-LD can be an object or an array.
            const value = JSON.parse(raw);
            parsed.push(value);
        } catch {
            parseErrors += 1;
        }
    }

    return { count: nodes.length, parsedCount: parsed.length, parseErrors };
}

function getHeadingsCount() {
    const counts = {};
    for (let level = 1; level <= 6; level++) {
        counts[`h${level}`] = document.querySelectorAll(`h${level}`).length;
    }
    return counts;
}

function getImageAltStats() {
    // Only count images with a usable src (skip tracking pixels/data URIs if desired; keep it simple).
    const imgs = Array.from(document.images || []);
    const relevant = imgs.filter((img) => {
        const src = normalizeSpace(img.getAttribute('src') || '');
        return Boolean(src);
    });

    const total = relevant.length;
    const withAlt = relevant.filter(
        (img) => normalizeSpace(img.getAttribute('alt') || '').length > 0
    ).length;
    const withoutAlt = total - withAlt;

    return { total, withAlt, withoutAlt };
}

function getWordCount() {
    // Exclude script/style/noscript, and use visible text (roughly).
    const clone = document.body?.cloneNode(true);
    if (!clone) return 0;

    for (const node of clone.querySelectorAll(
        'script, style, noscript, template, svg'
    )) {
        node.remove();
    }

    const text = normalizeSpace(clone.textContent || '');
    if (!text) return 0;

    // Word-ish tokenization; good enough for a quick metric.
    const words = text.match(/[\p{L}\p{N}]+/gu) || [];
    return words.length;
}

function scoreTitle(title) {
    const len = title.length;
    if (!title)
        return {
            points: 0,
            status: 'bad',
            badge: 'Missing',
            detail: 'No <title> found.',
        };

    // Typical guidance: ~10–60 chars.
    if (len >= 10 && len <= 60) {
        return {
            points: 20,
            status: 'good',
            badge: `${len} chars`,
            detail: `Present and within recommended length (${len} chars).`,
        };
    }

    const status = len < 10 ? 'warn' : 'warn';
    const badge = `${len} chars`;
    const detail =
        len < 10
            ? `Present but very short (${len} chars).`
            : `Present but long (${len} chars).`;
    // Partial credit if present but out of range.
    return { points: 12, status, badge, detail };
}

function scoreMetaDescription(description) {
    const len = description.length;
    if (!description) {
        return {
            points: 0,
            status: 'bad',
            badge: 'Missing',
            detail: 'No meta description found.',
        };
    }

    // Typical guidance: ~50–160 chars.
    if (len >= 50 && len <= 160) {
        return {
            points: 20,
            status: 'good',
            badge: `${len} chars`,
            detail: `Present and within recommended length (${len} chars).`,
        };
    }

    const detail =
        len < 50
            ? `Present but short (${len} chars).`
            : `Present but long (${len} chars).`;
    return { points: 12, status: 'warn', badge: `${len} chars`, detail };
}

function scoreMetaKeywords(keywords) {
    if (!keywords) {
        // Optional; don’t penalize.
        return {
            points: 0,
            status: 'warn',
            badge: 'Not set',
            detail: 'Meta keywords are optional and often ignored.',
        };
    }

    const len = keywords.length;
    return {
        points: 3,
        status: 'good',
        badge: 'Present',
        detail: `Present (${len} chars). Note: often ignored by search engines.`,
    };
}

function scoreHeadings(counts) {
    const h1 = counts.h1 || 0;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    if (total === 0) {
        return {
            points: 0,
            status: 'bad',
            badge: 'None',
            detail: 'No headings found (H1–H6).',
        };
    }

    // Heuristic: exactly one H1 is ideal.
    if (h1 === 1) {
        return {
            points: 15,
            status: 'good',
            badge: `H1×${h1}`,
            detail: `Headings present. H1 count is ideal (1). Total headings: ${total}.`,
        };
    }

    if (h1 === 0) {
        return {
            points: 7,
            status: 'warn',
            badge: 'No H1',
            detail: `Headings found but missing H1. Total headings: ${total}.`,
        };
    }

    return {
        points: 7,
        status: 'warn',
        badge: `H1×${h1}`,
        detail: `Multiple H1s found (${h1}). Total headings: ${total}.`,
    };
}

function scoreImages(images) {
    const { total, withAlt, withoutAlt } = images;
    if (total === 0) {
        // No images: neutral-ish.
        return {
            points: 6,
            status: 'warn',
            badge: 'No images',
            detail: 'No images detected on the page.',
        };
    }

    const ratio = withAlt / total;
    const pct = Math.round(ratio * 100);

    if (ratio >= 0.9) {
        return {
            points: 10,
            status: 'good',
            badge: `${pct}%`,
            detail: `${withAlt}/${total} images have alt text (${pct}%).`,
        };
    }

    if (ratio >= 0.6) {
        return {
            points: 6,
            status: 'warn',
            badge: `${pct}%`,
            detail: `${withAlt}/${total} images have alt text (${pct}%). ${withoutAlt} missing.`,
        };
    }

    return {
        points: 2,
        status: 'bad',
        badge: `${pct}%`,
        detail: `${withAlt}/${total} images have alt text (${pct}%). ${withoutAlt} missing.`,
    };
}

function scoreCanonical(href) {
    if (!href) {
        return {
            points: 0,
            status: 'warn',
            badge: 'Missing',
            detail: 'No canonical link tag found.',
        };
    }

    // Basic sanity check.
    const looksLikeUrl = /^https?:\/\//i.test(href) || href.startsWith('/');
    if (!looksLikeUrl) {
        return {
            points: 3,
            status: 'warn',
            badge: 'Present',
            detail: `Canonical present but looks unusual: ${href}`,
        };
    }

    return {
        points: 5,
        status: 'good',
        badge: 'Present',
        detail: `Canonical present: ${href}`,
    };
}

function scoreRobots(robots) {
    if (!robots) {
        return {
            points: 6,
            status: 'good',
            badge: 'Not set',
            detail: 'No robots meta tag found (often fine).',
        };
    }

    const value = robots.toLowerCase();
    const blocksIndexing =
        value.includes('noindex') || value.includes('nofollow');

    if (blocksIndexing) {
        return {
            points: 0,
            status: 'bad',
            badge: 'Blocking',
            detail: `Robots meta may prevent indexing: "${robots}"`,
        };
    }

    return {
        points: 6,
        status: 'good',
        badge: 'OK',
        detail: `Robots meta: "${robots}"`,
    };
}

function scoreStructuredData(jsonld) {
    const { count, parsedCount, parseErrors } = jsonld;

    if (count === 0) {
        return {
            points: 0,
            status: 'warn',
            badge: 'None',
            detail: 'No JSON-LD structured data found.',
        };
    }

    if (parsedCount > 0 && parseErrors === 0) {
        return {
            points: 10,
            status: 'good',
            badge: `${parsedCount} block${parsedCount === 1 ? '' : 's'}`,
            detail: `Found ${count} JSON-LD script tag(s); ${parsedCount} parsed successfully.`,
        };
    }

    return {
        points: 5,
        status: 'warn',
        badge: 'Partial',
        detail: `Found ${count} JSON-LD script tag(s); ${parsedCount} parsed; ${parseErrors} parse error(s).`,
    };
}

function scoreWordCount(words) {
    if (words === 0) {
        return {
            points: 0,
            status: 'bad',
            badge: '0',
            detail: 'No body text detected.',
        };
    }

    if (words >= 300) {
        return {
            points: 10,
            status: 'good',
            badge: `${words}`,
            detail: `Good amount of content (${words} words).`,
        };
    }

    if (words >= 150) {
        return {
            points: 6,
            status: 'warn',
            badge: `${words}`,
            detail: `Some content (${words} words); consider adding more.`,
        };
    }

    return {
        points: 2,
        status: 'warn',
        badge: `${words}`,
        detail: `Thin content (${words} words).`,
    };
}

function buildSummary(items, totalScore) {
    const positives = [];
    const issues = [];

    const push = (arr, label, status) => {
        if (status === 'good') arr.push(label);
    };

    push(positives, 'title', items.title.status);
    push(positives, 'meta description', items.metaDescription.status);
    push(positives, 'canonical', items.canonical.status);
    push(positives, 'structured data', items.structuredData.status);

    if (items.headings.status !== 'good') issues.push('headings');
    if (items.images.status !== 'good') issues.push('image alts');
    if (items.robots.status === 'bad') issues.push('robots (noindex/nofollow)');
    if (items.wordCount.status !== 'good') issues.push('content length');

    const parts = [];
    parts.push(`SEO score: ${totalScore}/100.`);

    if (positives.length) {
        parts.push(`Strong: ${positives.join(', ')}.`);
    }

    if (issues.length) {
        parts.push(`Check: ${issues.join(', ')}.`);
    }

    return parts.join(' ');
}

function analyzeSeo() {
    // Title
    const titleText = normalizeSpace(document.title);
    const title = scoreTitle(titleText);

    // Meta
    const metaDescriptionText = getMetaContentByName('description');
    const metaDescription = scoreMetaDescription(metaDescriptionText);

    const metaKeywordsText = getMetaContentByName('keywords');
    const metaKeywords = scoreMetaKeywords(metaKeywordsText);

    // Headings
    const headingCounts = getHeadingsCount();
    const headings = scoreHeadings(headingCounts);

    // Images
    const imageStats = getImageAltStats();
    const images = scoreImages(imageStats);

    // Canonical
    const canonicalHref = getCanonicalHref();
    const canonical = scoreCanonical(canonicalHref);

    // Robots
    const robotsText = getMetaContentByName('robots');
    const robots = scoreRobots(robotsText);

    // Structured Data
    const jsonld = getJsonLdBlocks();
    const structuredData = scoreStructuredData(jsonld);

    // Word count
    const words = getWordCount();
    const wordCount = scoreWordCount(words);

    // Total score: sum of points, clamped to 0–100.
    const total = clamp(
        title.points +
            metaDescription.points +
            metaKeywords.points +
            headings.points +
            images.points +
            canonical.points +
            robots.points +
            structuredData.points +
            wordCount.points,
        0,
        100
    );

    const payload = {
        generatedAt: Date.now(),
        page: {
            url: location.href,
        },
        score: {
            total,
        },
        raw: {
            title: titleText,
            metaDescription: metaDescriptionText,
            metaKeywords: metaKeywordsText,
            headings: headingCounts,
            images: imageStats,
            canonical: canonicalHref,
            robots: robotsText,
            jsonld,
            wordCount: words,
        },
        items: {
            title,
            metaDescription,
            metaKeywords,
            headings: {
                ...headings,
                detail: `${headings.detail} (H1:${headingCounts.h1}, H2:${headingCounts.h2}, H3:${headingCounts.h3}, H4:${headingCounts.h4}, H5:${headingCounts.h5}, H6:${headingCounts.h6})`,
            },
            images,
            canonical,
            robots,
            structuredData,
            wordCount,
        },
    };

    payload.summary = buildSummary(payload.items, total);

    return payload;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'ANALYZE_SEO') return;

    // Keep it synchronous (DOM reads). If you later add async, return true.
    const payload = analyzeSeo();
    sendResponse({ type: 'SEO_ANALYSIS', payload });
});
