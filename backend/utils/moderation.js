import Filter from 'bad-words';
const filter = new Filter();

// add some custom bad words (example) or regex patterns
const customBanned = ['someexplicitword1', 'someexplicitword2'];

function filterText(text) {
  if (!text) return text;
  let t = text;
  customBanned.forEach(w => {
    const re = new RegExp(w, 'gi');
    t = t.replace(re, '****');
  });
  t = filter.clean(t);
  // additional replace for URLs and phone numbers to avoid leaking
  t = t.replace(/https?:\/\/\S+/gi, '[link removed]');
  t = t.replace(/\+?\d{7,15}/g, '[phone removed]');
  return t;
}

function isExplicit(text) {
  // basic detection
  const lowered = (text || '').toLowerCase();
  return customBanned.some(w => lowered.includes(w)) || filter.isProfane(lowered);
}

export { filterText, isExplicit };