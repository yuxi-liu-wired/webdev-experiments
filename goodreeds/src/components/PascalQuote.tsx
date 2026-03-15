interface PascalQuoteProps {
  text: string;
  source: string;
}

export default function PascalQuote({ text, source }: PascalQuoteProps) {
  return (
    <figure className="relative my-6">
      {/* Decorative reed border — left accent bar with gradient */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-[#3D6B35] via-[#D4A843] to-[#3D6B35]" />

      {/* Reed decorations top-right and bottom-left */}
      <div className="absolute -top-2 -right-1 text-lg opacity-30 select-none pointer-events-none">
        🌾
      </div>
      <div className="absolute -bottom-2 -left-1 text-lg opacity-30 select-none pointer-events-none rotate-180">
        🌾
      </div>

      <blockquote className="pl-6 pr-4 py-4 bg-gradient-to-r from-[#F4F1EA] to-transparent rounded-r-sm">
        {/* Opening quote mark */}
        <span className="absolute left-4 -top-1 text-4xl text-[#D4A843] font-serif leading-none select-none opacity-40">
          &ldquo;
        </span>

        <p className="font-serif italic text-[#382110] text-base sm:text-lg leading-relaxed relative">
          {text}
        </p>

        <figcaption className="mt-3 text-sm text-[#8C7B6B] font-serif not-italic">
          <span className="text-[#D4A843]">&mdash;</span>{" "}
          <cite className="not-italic font-medium text-[#5C4A3A]">
            Blaise Pascal
          </cite>
          , <span className="italic">{source}</span>
        </figcaption>
      </blockquote>
    </figure>
  );
}
