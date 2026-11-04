import type { Route } from 'next';
import Link from 'next/link';
import { splitRichText } from '@carza/shared';

const linkClass = 'relative z-10 font-medium text-sky-600 hover:underline dark:text-sky-400';

/** Post text with @mentions and #tags linked. `linkClassName` restyles the links (e.g. over video). */
export function RichText({
  text,
  linkClassName = linkClass,
}: {
  text: string;
  linkClassName?: string;
}) {
  return splitRichText(text).map((s, i) =>
    s.type === 'text' ? (
      s.value
    ) : (
      <Link
        key={i}
        href={(s.type === 'mention' ? `/u/${s.username}` : `/t/${s.tag}`) as Route}
        className={linkClassName}
      >
        {s.value}
      </Link>
    ),
  );
}
