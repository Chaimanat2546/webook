document.getElementById("retry")?.addEventListener("click", () => {
  // The fallback keeps the requested URL, so retry returns to that exact page.
  window.location.reload();
});
