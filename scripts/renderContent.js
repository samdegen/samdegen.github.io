const ICON_SPRITES = {
  email: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18v12H3z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 7l9 6 9-6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 10v7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="7.5" r="1" fill="currentColor"/><path d="M12 17v-4a3 3 0 016 0v4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 11l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 19h16" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
};

export async function loadSiteContent() {
  const response = await fetch('content/site-content.md');
  if (!response.ok) {
    throw new Error(`Unable to load site content: ${response.status}`);
  }
  const text = await response.text();
  const data = parseMarkdownContent(text);
  applyHeader(data.header, data.contactLinks ?? []);
  applyGallery(data.gallery ?? []);
  applySections(data.sections ?? []);
  applyFooter(data.footer ?? '');
  return data;
}

function parseMarkdownContent(text) {
  const lines = text.split(/\r?\n/);
  const result = {
    header: { affiliationLines: [] },
    contactLinks: [],
    gallery: [],
    sections: [],
    footer: ''
  };

  const slugify = value =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || '';

  let state = null;
  let headerAffiliation = false;
  let currentSection = null;
  let currentEntry = null;
  let currentGroup = null;

  const commitAffiliationLine = line => {
    if (!line) return;
    const boldMatch = line.match(/^\*\*(.*)\*\*$/);
    if (boldMatch) {
      result.header.affiliationLines.push({ text: boldMatch[1], bold: true });
    } else {
      result.header.affiliationLines.push({ text: line, bold: false });
    }
  };

  const parseHeadshot = value => {
    const [src = '', alt = ''] = value.split('|').map(part => part.trim());
    result.header.headshot = { src, alt };
  };

  const parseContactLine = value => {
    const segments = value
      .split('|')
      .map(segment => segment.trim())
      .filter(Boolean);
    const entry = {};
    segments.forEach(segment => {
      if (!segment) return;
      if (segment.includes('=')) {
        const [key, ...rest] = segment.split('=');
        const cleanedKey = key.trim();
        const cleanedValue = rest.join('=').trim();
        if (!cleanedKey) return;
        if (cleanedKey === 'aria') {
          entry.ariaLabel = cleanedValue;
        } else {
          entry[cleanedKey] = cleanedValue;
        }
      } else {
        entry[segment] = true;
      }
    });
    if (Object.keys(entry).length) {
      result.contactLinks.push(entry);
    }
  };

  const parseGalleryLine = value => {
    const [src = '', alt = ''] = value.split('|').map(part => part.trim());
    if (src) {
      result.gallery.push({ src, alt });
    }
  };

  const ensureArray = (obj, key) => {
    if (!Array.isArray(obj[key])) {
      obj[key] = [];
    }
    return obj[key];
  };

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) {
      if (state === 'header') {
        headerAffiliation = false;
      }
      return;
    }

    if (line.startsWith('# ')) {
      const heading = line.slice(2).trim().toLowerCase();
      state = heading;
      headerAffiliation = false;
      currentSection = null;
      currentEntry = null;
      currentGroup = null;
      return;
    }

    if (state === 'footer') {
      result.footer = result.footer ? `${result.footer}\n${line}` : line;
      return;
    }

    if (state === 'header') {
      if (line.toLowerCase() === 'affiliation:') {
        headerAffiliation = true;
        return;
      }
      if (headerAffiliation && line.startsWith('- ')) {
        commitAffiliationLine(line.slice(2).trim());
        return;
      }
      headerAffiliation = false;
      const [key, ...rest] = line.split(':');
      if (!key) return;
      const value = rest.join(':').trim();
      switch (key.trim().toLowerCase()) {
        case 'name':
          result.header.name = value;
          break;
        case 'headshot':
          parseHeadshot(value);
          break;
        default:
          break;
      }
      return;
    }

    if (state === 'contact links') {
      if (line.startsWith('- ')) {
        parseContactLine(line.slice(2));
      }
      return;
    }

    if (state === 'gallery') {
      if (line.startsWith('- ')) {
        parseGalleryLine(line.slice(2));
      }
      return;
    }

    if (state === 'sections') {
      if (line.startsWith('## ')) {
        const match = line.match(/^##\s+(.+?)(?:\s+\(([^)]+)\))?$/);
        if (!match) return;
        const title = match[1].trim();
        const layout = (match[2] || 'simple-list').trim();
        currentSection = {
          title,
          layout,
          id: slugify(title)
        };
        result.sections.push(currentSection);
        currentEntry = null;
        currentGroup = null;
        return;
      }

      if (!currentSection) return;

      if (/^id:/i.test(line)) {
        currentSection.id = line.split(':').slice(1).join(':').trim() || currentSection.id;
        return;
      }

      switch (currentSection.layout) {
        case 'nested-list':
          if (line.startsWith('### ')) {
            const title = line.slice(4).trim();
            currentEntry = { title, details: [] };
            ensureArray(currentSection, 'items').push(currentEntry);
            return;
          }
          if (line.startsWith('- ') && currentEntry) {
            currentEntry.details.push(line.slice(2).trim());
          }
          break;
        case 'grouped-list':
          if (line.startsWith('### ')) {
            currentGroup = { title: line.slice(4).trim(), items: [] };
            ensureArray(currentSection, 'groups').push(currentGroup);
            return;
          }
          if (line.startsWith('- ') && currentGroup) {
            currentGroup.items.push(line.slice(2).trim());
          }
          break;
        case 'details-list':
          if (line.startsWith('### ')) {
            currentEntry = { summary: line.slice(4).trim(), body: [] };
            ensureArray(currentSection, 'entries').push(currentEntry);
            return;
          }
          if (!currentEntry) return;
          if (line.toLowerCase().startsWith('paragraph:')) {
            currentEntry.body.push({
              type: 'paragraph',
              text: line.split(':').slice(1).join(':').trim()
            });
            return;
          }
          if (line.toLowerCase().startsWith('note:')) {
            currentEntry.body.push({
              type: 'note',
              text: line.split(':').slice(1).join(':').trim()
            });
          }
          break;
        case 'talk-list':
          if (line.startsWith('### ')) {
            const content = line.slice(4).trim();
            const parts = content.split('|');
            const title = parts[0].trim();
            const tag = parts[1] ? parts[1].trim() : '';
            currentEntry = { title, details: [] };
            if (tag) {
              currentEntry.tag = tag;
            }
            ensureArray(currentSection, 'items').push(currentEntry);
            return;
          }
          if (line.startsWith('- ') && currentEntry) {
            currentEntry.details.push(line.slice(2).trim());
          }
          break;
        case 'simple-list':
        default:
          if (line.startsWith('- ')) {
            ensureArray(currentSection, 'items').push(line.slice(2).trim());
          }
          break;
      }
      return;
    }
  });

  return result;
}

function applyHeader(header, links) {
  if (!header) return;
  const nameEl = document.getElementById('profileName');
  if (nameEl) {
    nameEl.textContent = header.name ?? '';
  }

  const headshotEl = document.getElementById('profileHeadshot');
  if (headshotEl && header.headshot) {
    headshotEl.src = header.headshot.src ?? '';
    headshotEl.alt = header.headshot.alt ?? '';
  }

  const affiliationEl = document.getElementById('profileAffiliation');
  if (affiliationEl) {
    affiliationEl.innerHTML = '';
    const lines = header.affiliationLines ?? [];
    lines.forEach((line, idx) => {
      if (!line) return;
      if (line.bold) {
        const strong = document.createElement('strong');
        strong.textContent = line.text ?? '';
        affiliationEl.appendChild(strong);
      } else {
        affiliationEl.appendChild(document.createTextNode(line.text ?? ''));
      }
      if (idx < lines.length - 1) {
        affiliationEl.appendChild(document.createElement('br'));
      }
    });
  }

  const btnRow = document.getElementById('contactLinks');
  if (btnRow) {
    btnRow.innerHTML = '';
    links.forEach(link => {
      const anchor = document.createElement('a');
      anchor.className = 'download-btn';
      anchor.href = link.href ?? '#';
      anchor.textContent = '';
      anchor.setAttribute('aria-label', link.ariaLabel ?? link.label ?? '');
      if (link.target) anchor.target = link.target;
      if (link.rel) anchor.rel = link.rel;
      if (link.download) anchor.setAttribute('download', '');
      const icon = ICON_SPRITES[link.type];
      if (icon) {
        anchor.insertAdjacentHTML('beforeend', icon);
      }
      const labelSpan = document.createElement('span');
      labelSpan.textContent = link.label ?? '';
      anchor.appendChild(labelSpan);
      btnRow.appendChild(anchor);
    });
  }
}

function applyGallery(items) {
  const track = document.getElementById('carouselTrack');
  if (!track) return;
  track.innerHTML = '';
  items.forEach(item => {
    const slide = document.createElement('div');
    slide.className = 'slide';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = item.src ?? '';
    img.alt = item.alt ?? '';
    img.onerror = () => { img.style.display = 'none'; };
    slide.appendChild(img);
    track.appendChild(slide);
  });
}

function applySections(sections) {
  const container = document.getElementById('sectionsContainer');
  const nav = document.getElementById('primaryNav');
  if (!container) return;
  container.innerHTML = '';
  if (nav) nav.innerHTML = '';

  sections.forEach(section => {
    const sectionEl = document.createElement('section');
    sectionEl.id = section.id ?? '';
    const heading = document.createElement('h2');
    heading.textContent = section.title ?? '';
    sectionEl.appendChild(heading);

    switch (section.layout) {
      case 'nested-list':
        sectionEl.appendChild(buildNestedList(section.items ?? []));
        break;
      case 'grouped-list':
        sectionEl.appendChild(buildGroupedList(section.groups ?? []));
        break;
      case 'details-list':
        sectionEl.appendChild(buildDetailsList(section.entries ?? []));
        break;
      case 'talk-list':
        sectionEl.appendChild(buildTalkList(section.items ?? []));
        break;
      case 'simple-list':
      default:
        sectionEl.appendChild(buildSimpleList(section.items ?? []));
        break;
    }

    container.appendChild(sectionEl);

    if (nav && section.id && section.title) {
      const navLink = document.createElement('a');
      navLink.href = `#${section.id}`;
      navLink.textContent = section.title;
      nav.appendChild(navLink);
    }
  });
}

function applyFooter(text) {
  const footer = document.querySelector('.footer');
  if (footer) {
    footer.textContent = text;
  }
}

function buildNestedList(items) {
  const list = document.createElement('ul');
  items.forEach(item => {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = item.title ?? '';
    li.appendChild(strong);
    if (Array.isArray(item.details) && item.details.length) {
      const inner = document.createElement('ul');
      item.details.forEach(detail => {
        const innerLi = document.createElement('li');
        innerLi.textContent = detail ?? '';
        inner.appendChild(innerLi);
      });
      li.appendChild(inner);
    }
    list.appendChild(li);
  });
  return list;
}

function buildGroupedList(groups) {
  const fragment = document.createDocumentFragment();
  groups.forEach(group => {
    const subheading = document.createElement('h3');
    subheading.textContent = group.title ?? '';
    fragment.appendChild(subheading);
    fragment.appendChild(buildSimpleList(group.items ?? []));
  });
  return fragment;
}

function buildDetailsList(entries) {
  const fragment = document.createDocumentFragment();
  entries.forEach(entry => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const strong = document.createElement('strong');
    strong.textContent = entry.summary ?? '';
    summary.appendChild(strong);
    details.appendChild(summary);
    (entry.body ?? []).forEach(block => {
      const p = document.createElement('p');
      if (block?.type === 'note') {
        const em = document.createElement('em');
        em.textContent = block.text ?? '';
        p.appendChild(em);
      } else {
        p.textContent = block?.text ?? '';
      }
      details.appendChild(p);
    });
    fragment.appendChild(details);
  });
  return fragment;
}

function buildTalkList(items) {
  const list = document.createElement('ul');
  items.forEach(item => {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = item.title ?? '';
    li.appendChild(strong);
    if (item.tag) {
      const tag = document.createElement('span');
      tag.className = 'talk-tag';
      tag.textContent = item.tag;
      li.appendChild(tag);
    }
    if (Array.isArray(item.details) && item.details.length) {
      const inner = document.createElement('ul');
      item.details.forEach(detail => {
        const detailLi = document.createElement('li');
        detailLi.textContent = detail ?? '';
        inner.appendChild(detailLi);
      });
      li.appendChild(inner);
    }
    list.appendChild(li);
  });
  return list;
}

function buildSimpleList(items) {
  const list = document.createElement('ul');
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item ?? '';
    list.appendChild(li);
  });
  return list;
}
