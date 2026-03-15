const FOOTER_LINKS = [
  { label: "About", href: "/about" },
  { label: "Careers (we\u2019re growing!)", href: "/careers" },
  { label: "Terms of Sedimentation", href: "/terms" },
  { label: "Privacy Pollen-cy", href: "/privacy" },
  { label: "Reed-port a Problem", href: "/report" },
];

export default function Footer() {
  return (
    <footer className="bg-[#1E1915] text-[#FAF8F6]">
      {/* Decorative reed divider */}
      <div className="h-1 bg-gradient-to-r from-[#3F8363] via-[#E87400] to-[#3F8363]" />

      <div className="max-w-[1260px] mx-auto px-4 sm:px-6 py-10">
        <div className="grid sm:grid-cols-3 gap-8">
          {/* Brand column */}
          <div>
            <a href="/" className="font-serif text-xl font-bold tracking-tight hover:text-[#E87400] transition-colors">
              good reeds 🌾
            </a>
            <p className="mt-2 text-sm text-[#FAF8F6]/60 italic leading-relaxed">
              The universe&apos;s #1 reed review platform since the Cretaceous period.
              &quot;Man is but a reed, but he is a thinking reed.&quot;
            </p>
          </div>

          {/* Links column */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#FAF8F6]/40 mb-3">
              Company
            </h4>
            <ul className="space-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-[#FAF8F6]/70 hover:text-[#FAF8F6] transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect column */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#FAF8F6]/40 mb-3">
              Connect
            </h4>
            <ul className="space-y-2 text-sm text-[#FAF8F6]/70">
              <li>
                <a href="#" className="hover:text-[#FAF8F6] transition-colors">
                  🐦 Reed Twitter
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#FAF8F6] transition-colors">
                  📸 Reedstagram
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#FAF8F6] transition-colors">
                  📚 The Good Reeds Blog
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#FAF8F6] transition-colors">
                  🎧 The Reeding Room Podcast
                </a>
              </li>
            </ul>
          </div>
        </div>

        <hr className="border-[#FAF8F6]/10 my-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#FAF8F6]/40">
          <p>&copy; 2026 Good Reeds, Inc. All reeds reserved.</p>
          <p>
            Made with 💚 in a wetland near you
          </p>
        </div>
      </div>
    </footer>
  );
}
