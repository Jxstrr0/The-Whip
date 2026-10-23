// The glossary: the first use of a term of art on a sheet gets a dotted underline, and a tap shows one
// sentence. Terms and sentences live in data/glossary.json. Headings, buttons, labels and stamps are left
// alone, so a term never ends up inside something that already does something when tapped.
import { data } from '../sim/config.js';
import { getSettings } from '../settings.js';

const SKIP = 'button, summary, h1, h2, h3, h4, label, input, textarea, select, svg, .stamp, .badge, .chip, .kicker, .term, [data-act], [data-open-row]';

let compiled = null;
function terms() {
  if (compiled) return compiled;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  compiled = data().glossary.terms.map((term) => ({
    ...term,
    // Longest form first, so "whipped vote" is taken whole before "whip" gets a look at it.
    re: new RegExp(`\\b(${[...term.match].sort((a, b) => b.length - a.length).map(esc).join('|')})\\b`, 'i'),
  }));
  return compiled;
}

// The first match in a string that isn't ruled out by the word before or after it ("in confidence" is not a
// confidence vote; "independent shops" are not members).
function firstUse(term, text) {
  const re = new RegExp(term.re.source, 'gi');
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    if (term.notBefore && new RegExp(`\\b(${term.notBefore.join('|')})\\s+$`, 'i').test(before)) continue;
    if (term.notAfter && new RegExp(`^\\s+(${term.notAfter.join('|')})\\b`, 'i').test(after)) continue;
    return m;
  }
  return null;
}

function textNodes(root) {
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n);
  return out;
}

// Wrap the first use of each term under `node` that `sheet` has not glossed yet. Returns how many were wrapped.
export function glossTerms(node, sheet = node) {
  if (!node.isConnected && node !== sheet) return 0;
  let nodes = null;
  let wrapped = 0;
  for (const term of terms()) {
    if (sheet.querySelector(`.term[data-term="${term.id}"]`)) continue;
    nodes ||= textNodes(node);
    for (const n of nodes) {
      const m = firstUse(term, n.nodeValue);
      if (!m) continue;
      const after = n.splitText(m.index);
      after.nodeValue = after.nodeValue.slice(m[0].length);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'term';
      b.dataset.term = term.id;
      b.textContent = m[0];
      n.parentNode.insertBefore(b, after);
      nodes = null; // the split moved things about; walk again for the next term
      wrapped++;
      break;
    }
  }
  return wrapped;
}

export function unglossAll(root) {
  for (const b of root.querySelectorAll('.term')) b.replaceWith(b.textContent);
}

export function glossAll(root) {
  for (const sheet of root.querySelectorAll('.sheet')) glossTerms(sheet);
}

// Watch the overlay: whatever lands inside a sheet gets glossed as it arrives. onTerm(term) runs on a tap.
export function watchGlossary(root, onTerm) {
  const obs = new MutationObserver((records) => {
    if (!getSettings().glossary) return;
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1 || n.classList.contains('term')) continue;
        const sheet = n.closest('.sheet');
        if (sheet) glossTerms(n, sheet);
      }
    }
  });
  obs.observe(root, { childList: true, subtree: true });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.term');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const term = terms().find((x) => x.id === b.dataset.term);
    if (term) onTerm(term);
  });
  return obs;
}
