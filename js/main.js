document.addEventListener("DOMContentLoaded", () => {
  // Almacén global en memoria temporal / VRAM mientras la pestaña esté abierta
  window.__FRAGMIND_VRAM_CACHE__ = window.__FRAGMIND_VRAM_CACHE__ || new Map();
  const vramPool = window.__FRAGMIND_VRAM_CACHE__;

  const allShells = Array.from(document.querySelectorAll(".media-shell"));

  // Pausa respetuosa para no forzar la CPU/GPU mientras navegas
  function waitCalmly(ms) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if ("requestIdleCallback" in window) {
          requestIdleCallback(() => resolve(), { timeout: 500 });
        } else {
          resolve();
        }
      }, ms);
    });
  }

  // Carga y decodifica una sola imagen en VRAM, manteniendo capa gris opaca + borrosa hasta terminar
  function loadShellImage(shell) {
    return new Promise((resolve) => {
      const imgEl = shell.querySelector("img");
      if (!imgEl) {
        shell.classList.remove("is-loading");
        resolve();
        return;
      }

      const directSrc = imgEl.dataset.src;
      const base = imgEl.dataset.base;
      const candidates = directSrc
        ? [directSrc]
        : [
            `${base}.webp`,
            `${base}.jpg.webp`,
            `${base}.JPG.webp`,
            `${base}.jpg`,
            `${base}.JPG.jpg`
          ];

      let idx = 0;

      function completeReveal(finalSrc, cachedImg) {
        if (finalSrc) {
          if (cachedImg) vramPool.set(finalSrc, cachedImg);
          imgEl.src = finalSrc;
          imgEl.dataset.fullSrc = finalSrc;
          imgEl.classList.add("is-ready");
        }
        // Pequeño respiro antes de quitar la capa opaca para que se vea la transición limpia
        requestAnimationFrame(() => {
          shell.classList.remove("is-loading");
          resolve();
        });
      }

      function tryNextCandidate() {
        if (idx >= candidates.length) {
          shell.classList.remove("is-loading");
          resolve();
          return;
        }

        const candidateSrc = candidates[idx];
        idx += 1;

        // Si ya está en la memoria temporal de la pestaña, úsala al instante
        if (vramPool.has(candidateSrc)) {
          completeReveal(candidateSrc, vramPool.get(candidateSrc));
          return;
        }

        const loader = new Image();
        loader.src = candidateSrc;

        loader
          .decode()
          .then(() => completeReveal(candidateSrc, loader))
          .catch(() => {
            if (loader.complete && loader.naturalWidth > 0) {
              completeReveal(candidateSrc, loader);
            } else {
              tryNextCandidate();
            }
          });
      }

      tryNextCandidate();
    });
  }

  // Cola pausada de 1 en 1 para TODA la página: se toma su tiempo y evita trabones
  async function loadAllPageMediaGradually() {
    for (const shell of allShells) {
      await loadShellImage(shell);
      await waitCalmly(320);
    }
  }

  // Inicia suavemente después del primer pintado de la interfaz
  setTimeout(loadAllPageMediaGradually, 350);

  // Video con pantalla de carga gris opaca + círculo giratorio al reproducir
  const liteVideoContainer = document.getElementById("lite-video-container");
  if (liteVideoContainer) {
    const posterBtn = liteVideoContainer.querySelector(".video-poster-btn");
    const videoSrc = liteVideoContainer.dataset.videoSrc;

    if (posterBtn && videoSrc) {
      posterBtn.addEventListener("click", () => {
        liteVideoContainer.innerHTML = `
          <div class="video-loading-screen">
            <span class="loader-spinner"></span>
            <span class="loader-text">CARGANDO VIDEO...</span>
          </div>
        `;

        const video = document.createElement("video");
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        video.preload = "auto";

        const source = document.createElement("source");
        source.src = videoSrc;
        source.type = "video/mp4";
        video.appendChild(source);

        video.addEventListener(
          "loadeddata",
          () => {
            const loaderScreen = liteVideoContainer.querySelector(".video-loading-screen");
            if (loaderScreen) loaderScreen.remove();
          },
          { once: true }
        );

        liteVideoContainer.appendChild(video);
      });
    }
  }

  // Visor ampliado (Lightbox) con navegación izquierda / derecha
  const projectCards = Array.from(document.querySelectorAll(".project-card"));
  const lightbox = document.getElementById("project-lightbox");
  const lightboxImg = document.getElementById("lightbox-image");
  const lightboxCounter = document.getElementById("lightbox-counter");
  const lightboxTitle = document.getElementById("lightbox-title");
  const lightboxDesc = document.getElementById("lightbox-desc");
  const closeBtn = lightbox ? lightbox.querySelector(".lightbox-close") : null;
  const prevBtn = document.getElementById("lightbox-prev");
  const nextBtn = document.getElementById("lightbox-next");

  let currentIndex = 0;

  function renderLightboxSlide(index) {
    const total = projectCards.length;
    if (!total || index < 0 || index >= total) return;

    currentIndex = index;
    const card = projectCards[currentIndex];
    const cardImg = card.querySelector("img");

    const originalSrc = cardImg ? (cardImg.dataset.fullSrc || cardImg.currentSrc || cardImg.src) : "";
    lightboxImg.src = originalSrc;
    lightboxImg.alt = card.dataset.lightboxTitle || "";
    lightboxCounter.textContent = `${currentIndex + 1} / ${total}`;
    lightboxTitle.textContent = card.dataset.lightboxTitle || "";
    lightboxDesc.textContent = card.dataset.lightboxDesc || "";

    if (prevBtn) {
      prevBtn.classList.toggle("hidden", currentIndex === 0);
    }
    if (nextBtn) {
      nextBtn.classList.toggle("hidden", currentIndex === total - 1);
    }
  }

  function openProjectLightbox(index) {
    renderLightboxSlide(index);
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeProjectLightbox() {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  if (lightbox && lightboxImg && projectCards.length) {
    projectCards.forEach((card, idx) => {
      card.addEventListener("click", () => openProjectLightbox(idx));
    });

    if (prevBtn) {
      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (currentIndex > 0) renderLightboxSlide(currentIndex - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (currentIndex < projectCards.length - 1) renderLightboxSlide(currentIndex + 1);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", closeProjectLightbox);
    }

    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) closeProjectLightbox();
    });

    document.addEventListener("keydown", (e) => {
      if (!lightbox.classList.contains("open")) return;

      if (e.key === "Escape") {
        closeProjectLightbox();
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        renderLightboxSlide(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < projectCards.length - 1) {
        renderLightboxSlide(currentIndex + 1);
      }
    });
  }
});