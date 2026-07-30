export function triggerFlyToCartAnimation(event, imageUrl) {
  if (!event || event.clientX === undefined || event.clientY === undefined) return;

  // 1. Create flying element
  const flyingEl = document.createElement('img');
  flyingEl.src = imageUrl || '/pizza-placeholder.jpg';
  flyingEl.className = 'flying-item';

  // Initial position at click coordinates
  const startX = event.clientX;
  const startY = event.clientY;
  
  // 22.5 is half of 45px (width/height defined in .flying-item)
  flyingEl.style.left = `${startX - 22}px`;
  flyingEl.style.top = `${startY - 22}px`;
  
  document.body.appendChild(flyingEl);
  
  // Force reflow
  flyingEl.getBoundingClientRect();

  // 2. Find target (floating cart button or bottom nav cart icon)
  let target = document.getElementById('floating-tray-btn');
  if (!target || !target.classList.contains('visible')) {
    target = document.getElementById('nav-cart');
  }

  if (target) {
    const targetRect = target.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2 - 22;
    const targetY = targetRect.top + targetRect.height / 2 - 22;

    // Apply animation target values
    flyingEl.style.left = `${targetX}px`;
    flyingEl.style.top = `${targetY}px`;
    flyingEl.style.transform = 'scale(0.1)';
    flyingEl.style.opacity = '0.3';
    
    // Add bounce animation to target right as the item arrives
    setTimeout(() => {
      target.classList.add('bounce-cart');
      setTimeout(() => {
        target.classList.remove('bounce-cart');
      }, 400);
    }, 450); 
  } else {
    // If no target found, just fade it out upwards
    flyingEl.style.transform = 'translateY(-100px) scale(0.5)';
    flyingEl.style.opacity = '0';
  }

  // 3. Cleanup
  setTimeout(() => {
    if (flyingEl.parentNode) {
      document.body.removeChild(flyingEl);
    }
  }, 600); // 0.6s to allow the 0.5s transition to finish
}
