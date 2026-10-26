import Image from 'next/image';
import Link from 'next/link';

type Tone = 'light' | 'dark';

// The Carza mark is wide (≈3.1:1). `tone` is the BACKGROUND it sits on: dark → white mark.
const MARK = { width: 1409, height: 455 } as const;

export function CarzaMark({
  tone = 'dark',
  className = 'h-10 w-auto',
}: {
  tone?: Tone;
  className?: string;
}) {
  return (
    <Image
      src={tone === 'dark' ? '/brand/carza-mark-white.png' : '/brand/carza-mark-black.png'}
      alt=""
      width={MARK.width}
      height={MARK.height}
      priority
      className={className}
    />
  );
}

/** Mark + "CARZA" wordmark, linking home. */
export function CarzaLogo({
  tone = 'light',
  size = 'md',
}: {
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
}) {
  const mark = { sm: 'h-6 w-auto', md: 'h-8 w-auto', lg: 'h-14 w-auto' }[size];
  const word = { sm: 'text-lg', md: 'text-xl', lg: 'text-4xl' }[size];
  return (
    <Link href="/" aria-label="Carza home" className="inline-flex items-center gap-3">
      <CarzaMark tone={tone} className={mark} />
      <span
        className={`font-display font-extrabold tracking-[0.28em] ${word} ${tone === 'dark' ? 'text-white' : 'text-foreground'}`}
      >
        CARZA
      </span>
    </Link>
  );
}
