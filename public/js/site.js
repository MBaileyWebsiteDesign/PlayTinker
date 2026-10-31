// Shared behaviour: mobile menu and simple accessible tabs.
document.addEventListener('DOMContentLoaded', () => {
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
