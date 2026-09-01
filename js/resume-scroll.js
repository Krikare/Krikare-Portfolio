(() => {
  const view = document.getElementById("scrollView");
  const backdrop = document.getElementById("scrollBackdrop");
  const closeBtn = document.getElementById("scrollClose");
  const download = document.getElementById("scrollDownload");
  const page = document.getElementById("resumePage");
  if (!view || !download || !page) return;

  let lastFocus = null;

  function openScroll(pdf, preview) {
    lastFocus = document.activeElement;
    page.src = preview;
    download.setAttribute("href", pdf);
    download.setAttribute("download", pdf.split("/").pop());
    view.hidden = false;
    document.body.classList.add("scroll-open");
    closeBtn?.focus();
  }

  function closeScroll() {
    if (view.hidden) return;
    view.hidden = true;
    document.body.classList.remove("scroll-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.querySelectorAll("[data-resume]").forEach((card) => {
    card.addEventListener("click", () => {
      openScroll(card.dataset.pdf, card.dataset.page);
    });
  });

  backdrop?.addEventListener("click", closeScroll);
  closeBtn?.addEventListener("click", closeScroll);
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || view.hidden) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closeScroll();
    },
    true
  );
})();
