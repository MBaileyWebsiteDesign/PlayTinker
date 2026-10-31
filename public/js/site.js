// Shared behaviour: mobile menu and simple accessible tabs.
document.addEventListener('DOMContentLoaded', () => {
  // Give each table cell its column label so tables can stack as cards on phones
  document.querySelectorAll('.table-wrap table').forEach((t) => {
    const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    t.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => { if (heads[i]) td.dataset.label = heads[i]; }));
  });

  // Give each table cell its column label so tables can stack as cards on phones
  document.querySelectorAll('.table-wrap table').forEach((t) => {
    const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    t.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => { if (heads[i]) td.dataset.label = heads[i]; }));
  });

  // Text boxes grow to fit their content instead of scrolling inside the page
  const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 4 + 'px'; };
  document.querySelectorAll('textarea').forEach((t) => {
    t.style.overflow = 'hidden';
    t.addEventListener('input', () => grow(t));
    grow(t);
  });
  addEventListener('resize', () => document.querySelectorAll('textarea').forEach(grow));

  const btn = document.querySelector('.menu-btn');
  const nav = document.getElementById('main-nav');
  if (btn && nav) {
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  }

  document.querySelectorAll('[role=tablist]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role=tab]')];
    const select = (tab) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          next.focus(); select(next);
        }
      });
    });
    const initial = tabs.find((t) => location.hash === '#' + t.dataset.hash) || tabs[0];
    if (initial) select(initial);
  });
});
