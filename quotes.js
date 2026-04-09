// ── DATA ──────────────────────────────────────────────────────────────────────
// Each row: [id, quote, author, source]
let quotes = [];

function parseCSV(text) {
  return text.trim().split('\n').map(line => {
    // Split on commas but respect quoted fields
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
    return [Number(cols[0]), cols[1], cols[2], cols[3]];
  }).filter(row => row[0] && row[1]);
}

async function loadQuotes() {
  const res = await fetch('quotes.csv');
  const text = await res.text();
  quotes = parseCSV(text);

  const params = new URLSearchParams(window.location.search);
  const paramId = params.get('id');
  const found = paramId ? quotes.findIndex(q => String(q[0]) === paramId) : -1;
  current = found !== -1 ? found : Math.floor(Math.random() * quotes.length);
  render(current);

}

loadQuotes();

// ── COLOR PAIRINGS ────────────────────────────────────────────────────────────
// Each entry: [bg, ink, accent]
const palettes = [
  ['#F5F0E8', '#1A1A1A', '#E8002D'],
  ['#0D1B2A', '#E8E0D0', '#F4A227'],
  ['#F4A227', '#1A1A1A', '#0D1B2A'],
  ['#1C3A2A', '#EAE6D8', '#C8E16A'],
  ['#C8E16A', '#1A1A1A', '#1C3A2A'],
  ['#E8C4B8', '#2A1A1A', '#8B2635'],
  ['#5C1A2A', '#F0E8E0', '#E8C4B8'],
  ['#2A3B5C', '#E8EAF0', '#F4A227'],
  ['#0044FF', '#F0F0F0', '#FFE000'],
  ['#FFE000', '#111111', '#0044FF'],
  ['#E8DCC8', '#3A2A1A', '#C45A28'],
  ['#1A4A40', '#D8F0E8', '#A0E8C8'],
  ['#D8D0F0', '#1A1630', '#6644CC'],
  ['#1A1030', '#E8E0F8', '#C87AFF'],
  ['#2A2A2A', '#E8D88A', '#E8D88A'],
 ['#F0EFEA', '#003080', '#E8002D'],
['#DC2777', 'white', '#e4ff18'],
['#E3E96F', '#6E2473', '#9C69A0'],
['#FFB4EF', '#200006', '#6E2473'],
 ['#2F24CA', '#D7FC48', '#D7FC48'],
 ['#FAFF24', '#9D15B1', '#9D15B1'],
 ['#FFECA6', '#41439D', '#41439D'],
['#506E8A', '#F7FE00', '#F7FE00'],
];

let lastPaletteIndex = -1;

function pickPalette() {
  let idx;
  do { idx = Math.floor(Math.random() * palettes.length); } while (palettes.length !== 1 && idx === lastPaletteIndex);
  lastPaletteIndex = idx;
  return palettes[idx];
}

function applyPalette(poster, [bg, ink, accent]) {
  // Derive muted from ink at 40% opacity by blending with bg
  poster.style.setProperty('--bg', bg);
  poster.style.setProperty('--ink', ink);
  poster.style.setProperty('--accent', accent);
  // Simple muted: mix ink toward bg — approximate with opacity via a mid-tone
  poster.style.setProperty('--muted', ink + '80'); // 50% alpha hex
  document.body.style.background = bg;
}

let current = 0;

// ── RENDER ────────────────────────────────────────────────────────────────────
function render(index) {
  const poster = document.getElementById('poster');
  poster.classList.add('flash');

  setTimeout(() => {
    const [id, quote, author, source] = quotes[index];
    const displayQuote = /[.!?,;)"'\]]$/.test(quote) ? quote : quote + '.';

    document.getElementById('quoteBody').textContent = displayQuote;
    document.getElementById('authorName').textContent = author;
    document.getElementById('sourceName').textContent = source;
    document.getElementById('ghostNum').textContent = String(id).padStart(2, '0');
  
    applyPalette(poster, pickPalette());
    history.replaceState(null, '', '?id=' + quotes[index][0]);

    poster.classList.remove('flash');
  }, 160);
}

function navigate(dir) {
  current = (current + dir + quotes.length) % quotes.length;
  render(current);
}

function navigateRandom() {
  let next;
  do { next = Math.floor(Math.random() * quotes.length); } while (next === current && quotes.length > 1);
  current = next;
  render(current);
}

// ── ABOUT OVERLAY ─────────────────────────────────────────────────────────────
function openAbout() {
  document.getElementById('aboutOverlay').classList.add('open');
}

function closeAbout() {
  document.getElementById('aboutOverlay').classList.remove('open');
}

// ── KEYBOARD ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeAbout(); return; }
  if (document.getElementById('aboutOverlay').classList.contains('open')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(-1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   navigate(1);
  if (e.key === 'r' || e.key === 'R') navigateRandom();
});

// ── SWIPE ─────────────────────────────────────────────────────────────────────
let touchStartX = 0;
document.getElementById('poster').addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });
document.getElementById('poster').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 40) navigate(dx < 0 ? 1 : -1);
}, { passive: true });

// ── INIT ──────────────────────────────────────────────────────────────────────
loadQuotes();