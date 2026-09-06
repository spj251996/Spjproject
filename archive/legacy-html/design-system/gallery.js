// Gallery specimens copy real markup verbatim, including its inline onclick
// handlers (toggleFam / toggleEvent / submitRSVP / closeNav). Production's own
// <script> is intentionally NOT loaded here — the gallery is posed, not live,
// so scroll-reveal / countdown / nav-scroll-state never run. These stubs just
// stop the copied handlers from throwing when a specimen is clicked.
function toggleFam() {}
function toggleEvent() {}
function submitRSVP(e) { if (e) e.preventDefault(); }
function closeNav() {}
