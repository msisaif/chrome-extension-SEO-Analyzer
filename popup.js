/*
  popup.js
  - Runs in the extension popup.
  - Asks the content script to analyze the active tab.
  - Renders SEO metrics + score.
*/

const RESULTS = document.getElementById('results');
const ERROR = document.getElementById('error');
const SCORE = document.getElementById('score');
const SUMMARY = document.getElementById('summary');
const PAGE_URL = document.getElementById('pageUrl');
const REFRESH = document.getElementById('refresh');
const TIMESTAMP = document.getElementById('timestamp');

function setError(message) {
    ERROR.hidden = !message;
    ERROR.textContent = message || '';
}

function badgeClass(status) {
    if (status === 'good') return 'good';
    if (status === 'warn') return 'warn';
    return 'bad';
}

function createRow({ label, detail, status, badge }) {
    const row = document.createElement('div');
    row.className = 'row';

    const left = document.createElement('div');
    left.className = 'left';

    const labelEl = document.createElement('div');
    labelEl.className = 'label';
    labelEl.textContent = label;

    const detailEl = document.createElement('div');
    detailEl.className = 'detail';
    detailEl.textContent = detail;

    left.appendChild(labelEl);
    left.appendChild(detailEl);

    const badgeEl = document.createElement('div');
    badgeEl.className = `badge ${badgeClass(status)}`;
    badgeEl.textContent = badge;

    row.appendChild(left);
    row.appendChild(badgeEl);

    return row;
}

function render(analysis) {
    // Reset
    RESULTS.innerHTML = '';
    setError('');

    PAGE_URL.textContent = analysis.page.url || '(unknown URL)';
    SCORE.textContent = String(analysis.score.total);

    SUMMARY.textContent = analysis.summary;
    TIMESTAMP.textContent = `Updated ${new Date(analysis.generatedAt).toLocaleTimeString()}`;

    const items = analysis.items;

    RESULTS.appendChild(
        createRow({
            label: 'Page Title',
            detail: items.title.detail,
            status: items.title.status,
            badge: items.title.badge,
        })
    );

    RESULTS.appendChild(
        createRow({
            label: 'Meta Description',
            detail: items.metaDescription.detail,
            status: items.metaDescription.status,
            badge: items.metaDescription.badge,
        })
    );

    RESULTS.appendChild(
        createRow({
            label: 'Meta Keywords (optional)',
            detail: items.metaKeywords.detail,
            status: items.metaKeywords.status,
            badge: items.metaKeywords.badge,
        })
    );

    RESULTS.appendChild(
        createRow({
            label: 'Headings (H1–H6)',
            detail: items.headings.detail,
            status: items.headings.status,
            badge: items.headings.badge,
        })
    );

    RESULTS.appendChild(
        createRow({
            label: 'Image Alt Attributes',
            detail: items.images.detail,
            status: items.images.status,
            badge: items.images.badge,
        })
    );

    RESULTS.appendChild(
        createRow({
            label: 'Canonical Tag',
            detail: items.canonical.detail,
            status: items.canonical.status,
            badge: items.canonical.badge,
        })
    );

    RESULTS.appendChild(
        createRow({
            label: 'Robots Meta Tag',
            detail: items.robots.detail,
            status: items.robots.status,
            badge: items.robots.badge,
        })
    );

    RESULTS.appendChild(
        createRow({
            label: 'Structured Data (JSON-LD)',
            detail: items.structuredData.detail,
            status: items.structuredData.status,
            badge: items.structuredData.badge,
        })
    );

    RESULTS.appendChild(
        createRow({
            label: 'Word Count',
            detail: items.wordCount.detail,
            status: items.wordCount.status,
            badge: items.wordCount.badge,
        })
    );
}

async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

function isRestrictedUrl(url) {
    // Content scripts are blocked on these pages.
    return (
        !url ||
        url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') ||
        url.startsWith('about:')
    );
}

async function analyze() {
    REFRESH.disabled = true;

    SCORE.textContent = '—';
    SUMMARY.innerHTML =
        '<span class="spinner" aria-hidden="true"></span> Analyzing current page…';
    TIMESTAMP.textContent = '';
    RESULTS.innerHTML = '';
    setError('');

    let tab;
    try {
        tab = await getActiveTab();
    } catch (e) {
        setError('Failed to get active tab.');
        SUMMARY.textContent = 'Could not analyze.';
        REFRESH.disabled = false;
        return;
    }

    PAGE_URL.textContent = tab?.url || '(unknown URL)';

    if (isRestrictedUrl(tab?.url)) {
        setError('This page cannot be analyzed (restricted URL).');
        SUMMARY.textContent = 'Open a regular website tab and try again.';
        REFRESH.disabled = false;
        return;
    }

    try {
        const analysis = await chrome.tabs.sendMessage(tab.id, {
            type: 'ANALYZE_SEO',
        });
        if (!analysis || analysis.type !== 'SEO_ANALYSIS') {
            throw new Error('Unexpected response');
        }
        render(analysis.payload);
    } catch (e) {
        // Common causes: content script not injected yet, or blocked by the page.
        setError(
            'Could not reach analyzer on this page. Try reloading the tab.'
        );
        SUMMARY.textContent = 'Could not analyze.';
    } finally {
        REFRESH.disabled = false;
    }
}

REFRESH.addEventListener('click', () => analyze());

// Analyze immediately when the popup opens.
analyze();
