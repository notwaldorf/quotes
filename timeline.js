// ── CSV PARSING ───────────────────────────────────────────────────────────────
// Same forgiving comma+quote parser as quotes.js, but tolerant of \r and BOM.
function parseCSV(text) {
  // Strip BOM if present, normalize line endings.
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.trim().split('\n');

  // Drop a header row if the first cell isn't numeric.
  if (lines.length && isNaN(Number(lines[0].split(',')[0]))) lines.shift();

  return lines.map(line => {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    return {
      id: Number(cols[0]),
      quote: cols[1] || '',
      author: cols[2] || '',
      source: cols[3] || '',
      date: cols[4] || '',
    };
  }).filter(r => r.id && r.quote);
}

// ── DATE PARSING ──────────────────────────────────────────────────────────────
// Real-world dates in this CSV come in flavors:
//   "April 2026", "December 2012"           (Month + year)
//   "Spring 2014", "Summer/Autumn 2015"     (season + year)
//   "2018", "2019"                          (bare year)
// We need:
//   1) a Year for grouping
//   2) a sortable position within the year
//   3) a short display label for the entry's date pill
const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// Seasons get mapped to their first month for ordering.
// "Summer/Autumn 2015" sorts as Summer.
const SEASONS = {
  spring: 2,    // March-ish
  summer: 5,    // June-ish
  autumn: 8,    // September-ish
  fall: 8,
  winter: 11,   // December
};

function parseDateInfo(raw) {
  if (!raw) return { year: null, sortKey: 0, label: '' };

  const s = raw.trim();
  const yearMatch = s.match(/(\d{4})/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const tokenSrc = s.replace(/\d{4}/, '').trim().toLowerCase();

  // Month?
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (tokenSrc === name) {
      return { year, sortKey: idx, label: name.toUpperCase() };
    }
  }

  // Season (handle compound like "summer/autumn" — sort by first piece).
  if (tokenSrc) {
    const firstWord = tokenSrc.split(/[\/\s]+/)[0];
    if (SEASONS[firstWord] !== undefined) {
      return {
        year,
        sortKey: SEASONS[firstWord],
        label: s.replace(/\d{4}/, '').trim().toUpperCase(),
      };
    }
  }

  // Bare year — put at the end of the year (chronologically latest within it).
  if (year !== null && !tokenSrc) {
    return { year, sortKey: 99, label: '' };
  }

  // Unknown format — keep raw string as label.
  return { year, sortKey: 99, label: s.toUpperCase() };
}

// ── BUILD ─────────────────────────────────────────────────────────────────────
function buildTimeline(rows) {
  const timeline = document.getElementById('timeline');
  timeline.innerHTML = '';

  // Annotate every row with its parsed date info.
  const annotated = rows.map(r => ({ ...r, _d: parseDateInfo(r.date) }));

  // Group by year.
  const byYear = new Map();
  annotated.forEach(r => {
    const y = r._d.year ?? 'Undated';
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(r);
  });

  // Sort entries within each year DESCENDING (newest first):
  // higher sortKey first; ties broken by higher id (most recently saved).
  for (const list of byYear.values()) {
    list.sort((a, b) => {
      if (a._d.sortKey !== b._d.sortKey) return b._d.sortKey - a._d.sortKey;
      return b.id - a.id;
    });
  }

  // Sort years DESCENDING; "Undated" goes to the end.
  const years = [...byYear.keys()].sort((a, b) => {
    if (a === 'Undated') return 1;
    if (b === 'Undated') return -1;
    return b - a;
  });

  years.forEach(year => {
    const entries = byYear.get(year);

    const group = document.createElement('section');
    group.className = 'year-group';
    group.dataset.year = year;

    const marker = document.createElement('div');
    marker.className = 'year-marker';
    marker.innerHTML = `<div class="year-label">${year}</div>`;
    group.appendChild(marker);

    entries.forEach(e => {
      // Each entry is now a link — clicking the row opens the poster.
      const article = document.createElement('a');
      article.className = 'entry';
      article.dataset.id = e.id;
      article.href = `index.html?id=${e.id}`;

      // Match the poster's behavior of adding a trailing period when missing.
      const quote = /[.!?,;)"'\]]$/.test(e.quote) ? e.quote : e.quote + '.';

      // Build the meta line conditionally — author OR source may be empty.
      const metaParts = [];
      if (e.author) {
        metaParts.push(`<span class="entry-author">${escapeHtml(e.author)}</span>`);
      }
      if (e.source) {
        metaParts.push(`<span class="entry-source">${escapeHtml(e.source)}</span>`);
      }

      article.innerHTML = `
        <div class="entry-left">
          
          ${metaParts.length ? `<div class="entry-meta">${metaParts.join('')}</div>` : ''}
          <div class="entry-date">${escapeHtml(e._d.label || '·')}</div>
        </div>
        <div class="entry-right">
          <div class="entry-id">№ ${String(e.id).padStart(3, '0')}</div>
          <div class="entry-quote">${escapeHtml(quote)}</div>
        </div>
      `;

      group.appendChild(article);
    });

    timeline.appendChild(group);
  });

  // Footer counters.
  document.getElementById('countLabel').textContent =
    `${rows.length} ${rows.length === 1 ? 'quote' : 'quotes'}`;

  const numericYears = [...byYear.keys()].filter(y => typeof y === 'number');
  if (numericYears.length) {
    const lo = Math.min(...numericYears);
    const hi = Math.max(...numericYears);
    document.getElementById('rangeLabel').textContent =
      lo === hi ? `the year ${lo}` : `spanning ${lo} – ${hi}`;
  }

  setupYearPin();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── STICKY YEAR PIN ──────────────────────────────────────────────────────────
function setupYearPin() {
  const pin = document.getElementById('yearPin');
  const groups = [...document.querySelectorAll('.year-group')];
  const entries = [...document.querySelectorAll('.entry')];
  if (!groups.length) return;

  const update = () => {
    // Active year = the year of the topmost entry still visible below the
    // sticky header. Matches how a reader perceives "what year am I in".
    const headerOffset = 80;
    let active = groups[0];
    for (const e of entries) {
      const rect = e.getBoundingClientRect();
      if (rect.bottom > headerOffset) {
        active = e.closest('.year-group');
        break;
      }
    }
    pin.textContent = active.dataset.year;
    pin.classList.add('visible');
  };

  update();
  let raf = null;
  window.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { update(); raf = null; });
  }, { passive: true });
}

// ── ABOUT OVERLAY ─────────────────────────────────────────────────────────────
function openAbout() { document.getElementById('aboutOverlay').classList.add('open'); }
function closeAbout() { document.getElementById('aboutOverlay').classList.remove('open'); }
window.openAbout = openAbout;
window.closeAbout = closeAbout;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAbout();
});

// ── LOAD ──────────────────────────────────────────────────────────────────────
async function load() {
  try {
    const res = await fetch('quotes.csv');
    if (!res.ok) throw new Error('Failed to load quotes.csv');
    const text = await res.text();
    const rows = parseCSV(text);
    buildTimeline(rows);
  } catch (err) {
    document.getElementById('timeline').innerHTML =
      `<div class="loading">Couldn't load quotes.csv — ${escapeHtml(err.message)}</div>`;
    console.error(err);
  }
}

load();