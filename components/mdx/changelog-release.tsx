import Link from "next/link";
import { getParts, type Part } from "@/components/landing/home/parts";
import {
  EASE_COLORS,
  FOCUS,
  INK,
  LEAF,
  LINE,
  META,
  MONO,
  SOFT,
} from "@/components/landing/home/styles";
import { siteConfig } from "@/config/site";
import { type ChangelogEntry, RELEASES } from "@/lib/changelog";
import { cn } from "@/lib/utils";

const prUrl = (pr: number) => `${siteConfig.links.github}/pull/${pr}`;

/**
 * One changelog release, drawn with the catalog's rules: new components first
 * with their docs description, then the ones that changed, then fixes that
 * touch the whole library. Used under a date heading in changelog.mdx.
 */
export function Release({ date }: { date: string }) {
  const release = RELEASES.find((r) => r.date === date);
  if (!release) {
    return null;
  }
  const parts = new Map(getParts().map((p) => [p.name, p]));
  const rows = (entries: ChangelogEntry[]) =>
    entries.flatMap((entry) => {
      const part = parts.get(entry.name);
      return part ? [{ entry, part }] : [];
    });
  const added = rows(release.added);
  const improved = rows(release.improved);

  return (
    <div className="not-prose flex flex-col gap-8">
      {added.length > 0 ? (
        <Group count={added.length} label="New components">
          {added.map(({ entry, part }) => (
            <Row
              entry={entry}
              key={part.name}
              part={part}
              text={part.description}
            />
          ))}
        </Group>
      ) : null}
      {improved.length > 0 ? (
        <Group count={improved.length} label="Improved">
          {improved.map(({ entry, part }) => (
            <Row entry={entry} key={part.name} part={part} text={entry.note} />
          ))}
        </Group>
      ) : null}
      {release.library?.length ? (
        <Group label="Across the library">
          {release.library.map((change) => (
            <li
              className="flex items-baseline justify-between gap-4 px-4 py-3"
              key={change.note}
            >
              <span className={cn("text-[14px] leading-relaxed", SOFT)}>
                {change.note}
              </span>
              <PrLinks prs={change.prs} />
            </li>
          ))}
        </Group>
      ) : null}
    </div>
  );
}

function Group({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <p className={cn(META, "flex items-baseline gap-2")}>
        <span className={INK}>{label}</span>
        {count ? <span>{count}</span> : null}
      </p>
      <ul
        className={cn(
          "flex flex-col border bg-white dark:bg-black",
          LINE,
          "divide-y divide-black/[0.13] dark:divide-white/[0.14]"
        )}
      >
        {children}
      </ul>
    </section>
  );
}

function Row({
  part,
  entry,
  text,
}: {
  part: Part;
  entry: ChangelogEntry;
  text?: string;
}) {
  return (
    <li className="grid grid-cols-[5ch_1fr_auto] items-baseline gap-x-4 gap-y-1 px-4 py-3">
      <span className={cn(MONO, "font-medium text-[12px]", LEAF)}>
        {part.code}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-3">
          <Link
            className={cn(
              "rounded-sm font-medium text-[15px] tracking-[-0.01em] underline-offset-4 hover:underline",
              INK,
              FOCUS
            )}
            href={part.url}
          >
            {part.title}
          </Link>
          <span className={META}>{part.category}</span>
        </span>
        {text ? (
          <span className={cn("text-pretty text-[14px] leading-relaxed", SOFT)}>
            {text}
          </span>
        ) : null}
      </span>
      <PrLinks prs={[entry.pr]} />
    </li>
  );
}

function PrLinks({ prs }: { prs: number[] }) {
  return (
    <span className="flex shrink-0 gap-2">
      {prs.map((pr) => (
        <a
          className={cn(
            META,
            "rounded-sm hover:text-black dark:hover:text-white",
            EASE_COLORS,
            FOCUS
          )}
          href={prUrl(pr)}
          key={pr}
          rel="noreferrer"
          target="_blank"
        >
          #{pr}
        </a>
      ))}
    </span>
  );
}
