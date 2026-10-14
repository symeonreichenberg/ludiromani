(() => {
  "use strict";

  function initGallery(gallery) {
    if (gallery.dataset.lightboxReady === "true") return;
    const items = Array.from(gallery.querySelectorAll("[data-lightbox-item]"));
    const track = gallery.querySelector("[data-lightbox-track]");
    if (!items.length) return;
    gallery.dataset.lightboxReady = "true";

    let index = 0;
    let modal = null, modalImage = null, modalCaption = null;
    let returnFocus = null;
    let autoFrame = 0;
    let autoPaused = false;
    let lastFrameTime = 0;
    let direction = 1;
    let resumeTimer = null;
    const speed = Math.max(4, Number(gallery.dataset.autoplaySpeed) || 18);

    function getItemData(item) {
      const img = item.querySelector("img");
      return {
        img,
        src: item.dataset.full || img?.dataset.full || img?.currentSrc || img?.src || "",
        alt: item.dataset.alt || img?.alt || "",
        caption: item.dataset.caption || img?.dataset.caption || ""
      };
    }

    function createModal() {
      if (modal) return;
      modal = document.createElement("div");
      modal.className = "lightbox-modal";
      modal.hidden = true;
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "Prohlížeč fotografií");
      modal.innerHTML = `
        <button class="lightbox-close" type="button" data-close aria-label="Zavřít">×</button>
        <button class="lightbox-arrow lightbox-prev" type="button" data-prev aria-label="Předchozí obrázek">‹</button>
        <figure class="lightbox-figure">
          <img class="lightbox-image" data-image alt="">
          <figcaption class="lightbox-caption" data-caption></figcaption>
        </figure>
        <button class="lightbox-arrow lightbox-next" type="button" data-next aria-label="Následující obrázek">›</button>
        <div class="lightbox-count" data-count aria-live="polite"></div>`;
      document.body.appendChild(modal);
      modalImage = modal.querySelector("[data-image]");
      modalCaption = modal.querySelector("[data-caption]");
      modal.addEventListener("click", event => {
        if (event.target === modal || event.target.closest("[data-close]")) closeModal();
        else if (event.target.closest("[data-prev]")) showImage(index - 1);
        else if (event.target.closest("[data-next]")) showImage(index + 1);
      });
    }

    function showImage(newIndex) {
      index = (newIndex + items.length) % items.length;
      const data = getItemData(items[index]);
      if (!data.src) return;
      createModal();
      modalImage.src = data.src;
      modalImage.alt = data.alt;
      modalCaption.textContent = data.caption;
      modalCaption.hidden = !data.caption;
      modal.querySelector("[data-count]").textContent = `${index + 1} / ${items.length}`;
      items.forEach((item, i) => item.setAttribute("aria-current", i === index ? "true" : "false"));
      modal.hidden = false;
      document.body.classList.add("lightbox-open");
      modal.querySelector("[data-close]").focus();
    }

    function closeModal() {
      if (!modal || modal.hidden) return;
      modal.hidden = true;
      document.body.classList.remove("lightbox-open");
      if (returnFocus) returnFocus.focus();
    }

    items.forEach((item, i) => {
      const img = item.querySelector("img");
      if (img) img.draggable = false;
      if (!item.hasAttribute("tabindex")) item.setAttribute("tabindex", "0");
      if (!item.hasAttribute("role") && item.tagName !== "BUTTON") item.setAttribute("role", "button");
      item.setAttribute("aria-label", `Otevřít obrázek ${i + 1}`);
      item.addEventListener("click", () => {
        returnFocus = document.activeElement;
        pauseAutoplay();
        showImage(i);
      });
      item.addEventListener("keydown", event => {
        if (item.tagName !== "BUTTON" && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          returnFocus = document.activeElement;
          pauseAutoplay();
          showImage(i);
        }
      });
    });

    // Explicitly scroll the thumbnail strip; disable snapping during smooth manual scroll.
    function scrollThumbnails(dir) {
      if (!track) return;
      pauseAutoplay();
      const distance = Math.max(180, track.clientWidth * 0.75);
      track.style.scrollSnapType = "none";
      track.scrollBy({ left: dir * distance, behavior: "smooth" });
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        track.style.scrollSnapType = "";
        resumeAutoplay();
      }, 850);
    }

    gallery.querySelector("[data-lightbox-scroll-prev]")?.addEventListener("click", () => scrollThumbnails(-1));
    gallery.querySelector("[data-lightbox-scroll-next]")?.addEventListener("click", () => scrollThumbnails(1));

    function pauseAutoplay() {
      autoPaused = true;
      lastFrameTime = 0;
    }
    function resumeAutoplay() {
      autoPaused = false;
      lastFrameTime = 0;
    }

    if (track && !gallery.hasAttribute("data-no-autoplay")) {
      track.addEventListener("mouseenter", pauseAutoplay);
      track.addEventListener("mouseleave", resumeAutoplay);
      track.addEventListener("focusin", pauseAutoplay);
      track.addEventListener("focusout", resumeAutoplay);
      track.addEventListener("pointerdown", pauseAutoplay);
      track.addEventListener("touchstart", pauseAutoplay, { passive: true });
      track.addEventListener("touchend", () => {
        if (resumeTimer) window.clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(resumeAutoplay, 1400);
      }, { passive: true });

      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reducedMotion) {
        const animate = timestamp => {
          if (!lastFrameTime) lastFrameTime = timestamp;
          const elapsed = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
          lastFrameTime = timestamp;
          if (!autoPaused && !document.hidden) {
            const maxScroll = track.scrollWidth - track.clientWidth;
            if (maxScroll > 1) {
              // Avoid CSS scroll-snap fighting tiny animation increments.
              track.style.scrollSnapType = "none";
              track.scrollLeft += direction * speed * elapsed;
              if (track.scrollLeft >= maxScroll - 1) {
                track.scrollLeft = maxScroll;
                direction = -1;
              } else if (track.scrollLeft <= 1) {
                track.scrollLeft = 0;
                direction = 1;
              }
            }
          }
          autoFrame = window.requestAnimationFrame(animate);
        };
        autoFrame = window.requestAnimationFrame(animate);
      }
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) pauseAutoplay();
        else resumeAutoplay();
      });
    }

    document.addEventListener("keydown", event => {
      if (!modal || modal.hidden) return;
      if (event.key === "Escape") closeModal();
      if (event.key === "ArrowLeft") { event.preventDefault(); showImage(index - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); showImage(index + 1); }
    });
  }

  function initAll() {
    document.querySelectorAll("[data-lightbox-gallery]").forEach(initGallery);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
  else initAll();
  window.StaticLightbox = { init: initAll };
})();
