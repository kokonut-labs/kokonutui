import { ArrowUpRightIcon } from "lucide-react";
import XIcon from "@/components/icons/x-icon";
import { cn } from "@/lib/utils";
import { Avatar } from "./client";
import { POSTS, type Post, V0_THREAD, VIDEO_ID } from "./data";
import { SectionHeading } from "./section-heading";
import { FOCUS, FOCUS_INSET } from "./styles";
import { VideoCard } from "./video";

const TOKEN = /(@\w+|https?:\/\/\S+|\b[\w-]+\.com\b)/g;
const IS_TOKEN = /^(@\w+|https?:\/\/\S+|[\w-]+\.com)$/;

/** Post text with mentions and links in X blue, as they read on the timeline. */
function RichText({ text }: { text: string }) {
  let offset = 0;
  return text.split(TOKEN).map((part) => {
    const key = offset;
    offset += part.length;
    if (!part) {
      return null;
    }
    return IS_TOKEN.test(part) ? (
      <span className="text-[#1d9bf0]" key={key}>
        {part}
      </span>
    ) : (
      <span key={key}>{part}</span>
    );
  });
}

export function Voices() {
  // OrcDev's post sits with the video; the rest share a row underneath.
  const [featured, ...rest] = [
    POSTS.find((p) => p.handle === "orcdev") ?? POSTS[0],
    ...POSTS.filter((p) => p.handle !== "orcdev"),
  ];

  return (
    <section className="scroll-mt-28 pt-28 md:pt-36" id="testimonials">
      <SectionHeading
        description="What developers say when they find KokonutUI, including the person behind shadcn/ui."
        title="From the timeline"
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Thread className="lg:col-span-7" />
        <div className="flex flex-col gap-3 lg:col-span-5">
          <VideoCard className="aspect-video w-full" id={VIDEO_ID} />
          <PostCard className="flex-1" post={featured} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rest.map((post) => (
          <PostCard key={post.handle} post={post} />
        ))}
      </div>
    </section>
  );
}

/** The v0 launch post and shadcn's one-word reply, given the room it earns. */
function Thread({ className }: { className?: string }) {
  const { post, reply } = V0_THREAD;
  return (
    <article
      className={cn(
        "group @container relative flex flex-col overflow-hidden rounded-3xl border border-black/[0.07] p-6 transition-[border-color] duration-200 ease-out hover:border-black/[0.13] sm:p-8 dark:border-white/[0.08] dark:hover:border-white/[0.16]",
        className
      )}
    >
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <Avatar name={post.name} size={40} src={post.avatar} />
          <span
            aria-hidden
            className="mt-2 w-px flex-1 bg-black/[0.1] dark:bg-white/[0.12]"
          />
        </div>
        <div className="min-w-0 flex-1 pr-6 pb-6">
          <Byline date={post.date} handle={post.handle} name={post.name} />
          <p className="mt-1 text-pretty text-[15px] text-black/80 leading-relaxed dark:text-white/80">
            <RichText text={post.text} />
          </p>
          <ol className="mt-2 flex flex-col gap-0.5 text-[14px] text-black/55 dark:text-white/55">
            {post.steps.map((step, i) => (
              <li key={step}>
                {i + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="flex gap-3">
        <Avatar name={reply.name} size={40} src={reply.avatar} />
        <div className="min-w-0 flex-1">
          <Byline date={reply.date} handle={reply.handle} name={reply.name} />
          <p className="text-[13px] text-black/55 dark:text-white/55">
            Replying to <span className="text-[#1d9bf0]">@{post.handle}</span>
          </p>
        </div>
      </div>
      <blockquote className="mt-6 flex flex-1 flex-col justify-end">
        {/* Sized to the card, so the word always fits on one line. The quote
            marks are quieter than the word they hold. */}
        <p className="whitespace-nowrap font-semibold text-[min(17cqi,128px)] leading-[0.95] tracking-[-0.055em]">
          <span className="text-black/20 dark:text-white/25">“</span>
          <span className="text-black dark:text-white">{reply.text}</span>
          <span className="text-black/20 dark:text-white/25">”</span>
        </p>
        <footer className="mt-4 text-[14px] text-black/55 dark:text-white/55">
          shadcn, creator of shadcn/ui, on KokonutUI opening in v0
        </footer>
      </blockquote>
      <a
        aria-label="Read the thread on X"
        className={cn("absolute inset-0 rounded-3xl", FOCUS_INSET)}
        href={post.href}
        rel="noreferrer"
        target="_blank"
      >
        <ArrowUpRightIcon
          aria-hidden
          className="absolute top-6 right-6 size-4 text-black/30 transition-[translate,color] duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-black/70 sm:top-8 sm:right-8 dark:text-white/30 dark:group-hover:text-white/70"
        />
      </a>
    </article>
  );
}

function Byline({
  name,
  handle,
  date,
}: {
  name: string;
  handle: string;
  date?: string;
}) {
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[14px]">
      <span className="truncate font-medium text-black dark:text-white">
        {name}
      </span>
      <span className="truncate text-black/55 dark:text-white/55">
        @{handle}
      </span>
      {date ? (
        <>
          <span aria-hidden className="text-black/30 dark:text-white/30">
            ·
          </span>
          <span className="shrink-0 text-black/55 dark:text-white/55">
            {date}
          </span>
        </>
      ) : null}
    </p>
  );
}

function PostCard({ post, className }: { post: Post; className?: string }) {
  return (
    <a
      className={cn(
        "flex flex-col gap-3 rounded-3xl border border-black/[0.07] bg-white p-5 transition-[border-color] duration-200 ease-out hover:border-black/[0.13] dark:border-white/[0.08] dark:bg-black dark:hover:border-white/[0.16]",
        FOCUS,
        className
      )}
      href={post.href ?? `https://x.com/${post.handle}`}
      rel="noreferrer"
      target="_blank"
    >
      <span className="flex items-center gap-2.5">
        <Avatar name={post.name} src={post.avatar} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-[14px] text-black dark:text-white">
            {post.name}
          </span>
          <span className="truncate text-[13px] text-black/55 dark:text-white/55">
            @{post.handle}
          </span>
        </span>
        <XIcon className="size-3.5 shrink-0 text-black/30 dark:text-white/35" />
      </span>
      <span className="text-pretty text-[15px] text-black/80 leading-relaxed dark:text-white/80">
        <RichText text={post.text} />
      </span>
      {post.date ? (
        <span className="mt-auto text-[13px] text-black/55 dark:text-white/55">
          {post.date}
        </span>
      ) : null}
    </a>
  );
}
