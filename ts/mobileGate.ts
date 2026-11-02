export function isMobileDevice(): boolean {
  if (window.matchMedia?.('(pointer: coarse)').matches) return true;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!touch) return false;
  const w = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  return w > 0 && w < 700;
}

function allLevelsButton(): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'mobile-actions';
  const button = document.createElement('button');
  button.className = 'btm-btn';
  button.setAttribute('type', 'button');
  const label = document.createElement('span');
  label.textContent = 'All Levels';
  button.appendChild(label);
  button.addEventListener('click', () => {
    location.href = '/editors/alllevels';
  });
  actions.appendChild(button);
  return actions;
}

export function blockMobileEditor(shadow: ShadowRoot): void {
  const overlay = shadow.querySelector('.start-overlay');
  if (!overlay) return;
  const card = overlay.querySelector('.start-card');
  const heading = overlay.querySelector('.start-card h2');
  const body = overlay.querySelector('.start-card p');
  const art = overlay.querySelector('.start-sonic') as HTMLImageElement | null;
  if (heading) heading.textContent = 'Desktop required';
  if (body) {
    body.textContent =
      'The level creator needs a mouse and keyboard. ' +
      'Please visit on a desktop computer to build levels.';
  }
  overlay.querySelector('.start-row')?.remove();
  overlay.querySelector('.start-card label')?.remove();
  if (!card || !heading || !body) return;
  card.classList.add('mobile-block');
  if (art) {
    art.src = '/images/sonictoolbox.webp';
    art.width = 552;
    art.height = 512;
    art.alt = 'Sonic with a toolbox';
  }
  const text = document.createElement('div');
  text.className = 'mobile-text';
  card.insertBefore(text, body);
  text.appendChild(body);
  card.appendChild(allLevelsButton());
}
