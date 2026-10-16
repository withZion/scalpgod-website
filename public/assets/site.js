// ScalpGOD landing page: mobile menu and the waitlist form.
(() => {
  // ---------- Mobile menu ----------
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.getElementById("mobile-menu");
  if (toggle && menu) {
    const setOpen = (open) => {
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", () => setOpen(menu.hidden));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener("click", (e) => {
      if (!menu.hidden && !menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
  }

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  // ---------- Waitlist ----------
  const form = document.querySelector("[data-wait]");
  if (!form) return;
  const msg = form.querySelector("[data-msg]");
  const btn = form.querySelector("button[type=submit]");
  const label = btn.textContent;
  const DONE = "You're on the list. We'll message you on Telegram when access opens.";
  const TG = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;
  const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

  const say = (text, kind) => { msg.textContent = text; msg.className = "form-msg " + kind; };
  const done = () => { say(DONE, "ok"); form.classList.add("is-done"); };
  const invalid = (input, text) => {
    input.setAttribute("aria-invalid", "true");
    say(text, "err");
    input.focus();
  };

  // Without JavaScript the form posts normally and the Worker redirects back here with ?joined=
  const params = new URLSearchParams(location.search);
  if (params.get("joined") === "1") done();
  if (params.get("joined") === "0") say("That didn't go through. Check your Telegram username and try again.", "err");

  form.addEventListener("input", (e) => e.target.removeAttribute("aria-invalid"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const telegram = form.telegram.value.trim();
    const email = form.email.value.trim();
    if (!TG.test(telegram)) return invalid(form.telegram, "Enter your Telegram username, like @yourname. It's 5 to 32 letters, numbers or underscores.");
    if (email && !EMAIL.test(email)) return invalid(form.email, "That email doesn't look right. Fix it, or leave it blank.");

    btn.disabled = true;
    btn.textContent = "Joining…";
    say("", "");
    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ telegram, email, website: form.website.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) { form.reset(); done(); }
      else say(data.error || "That didn't go through. Try again.", "err");
    } catch {
      say("We couldn't reach the server. Check your connection and try again.", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
})();
