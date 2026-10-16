import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { installCommand } from "@/components/landing/home/data";
import type { Part } from "@/components/landing/home/parts";
import { OgLogo } from "@/components/og/logo";
import { readMetrics, wrap } from "./measure";

export const OG_SIZE = { width: 1200, height: 630 };

type Theme = "light" | "dark";

/**
 * The catalog's palette, written out for next/og: it draws flexboxes, so the
 * hairline grid is a 1px gap over the line color, as on the site.
 */
const PALETTE = {
  light: {
    page: "#ffffff",
    line: "rgba(0,0,0,0.13)",
    ink: "#000000",
    soft: "rgba(0,0,0,0.6)",
    meta: "rgba(0,0,0,0.5)",
    leaf: "#1FA834",
  },
  dark: {
    page: "#000000",
    line: "rgba(255,255,255,0.14)",
    ink: "#ffffff",
    soft: "rgba(255,255,255,0.6)",
    meta: "rgba(255,255,255,0.5)",
    leaf: "#3BB44B",
  },
};

const FONT_DIR = join(process.cwd(), "lib/og/fonts");

async function loadFonts() {
  const [regular, medium, semibold, mono, monoMedium] = await Promise.all(
    [
      "Geist-Regular.ttf",
      "Geist-Medium.ttf",
      "Geist-SemiBold.ttf",
      "GeistMono-Regular.ttf",
      "GeistMono-Medium.ttf",
    ].map((file) => readFile(join(FONT_DIR, file)))
  );
  const fonts = [
    { name: "Geist", data: regular, weight: 400 as const },
    { name: "Geist", data: medium, weight: 500 as const },
    { name: "Geist", data: semibold, weight: 600 as const },
    { name: "Geist Mono", data: mono, weight: 400 as const },
    { name: "Geist Mono", data: monoMedium, weight: 500 as const },
  ];
  return {
    fonts,
    regular: readMetrics(regular),
    semibold: readMetrics(semibold),
  };
}

const NBSP = "\u00a0";

/** For one-line labels: spaces that next/og keeps even. */
const oneLine = (text: string) => text.replaceAll(" ", NBSP);

/** Lines broken by lib/og/measure, each drawn as one run. */
const lines = (broken: string[]) =>
  broken.map((line) => (
    <div key={line} style={{ display: "flex" }}>
      {oneLine(line)}
    </div>
  ));

export interface DocsImageInput {
  title: string;
  description?: string;
  url: string;
  /** Set on component pages: the part's code, category and packages. */
  part?: Part;
  /** How many components the library has, for pages that aren't one. */
  count: number;
  theme?: Theme;
}

/** A docs page's link preview, drawn like the catalog. */
export async function docsImage({
  title,
  description,
  url,
  part,
  count,
  theme = "light",
}: DocsImageInput) {
  const c = PALETTE[theme];
  const { fonts, regular, semibold } = await loadFonts();
  const mono = { fontFamily: "Geist Mono" };
  const cell = {
    display: "flex",
    alignItems: "center",
    backgroundColor: c.page,
    padding: "0 20px",
  } as const;
  const meta = { ...mono, fontSize: 15, color: c.meta };

  const metaCells = part
    ? [
        <span key="cat" style={meta}>
          {part.category}
        </span>,
        <span key="code" style={{ ...mono, fontSize: 15, color: c.leaf }}>
          {part.code}
        </span>,
        <span key="deps" style={meta}>
          {oneLine(part.dependencies.join(", ") || "no extra packages")}
        </span>,
      ]
    : [
        <span key="cat" style={meta}>
          {oneLine("Documentation")}
        </span>,
        <span key="code" style={meta}>
          {oneLine("React, Tailwind CSS, Motion")}
        </span>,
        <span key="deps" style={meta}>
          {oneLine("Free and open source")}
        </span>,
      ];

  // The title takes two lines at most, as large as that allows.
  const TITLE_WIDTH = 1000;
  const TITLE_TRACKING = -0.05;
  const titleSize =
    [104, 92, 80, 68].find(
      (size) =>
        wrap(title, semibold, {
          size,
          maxWidth: TITLE_WIDTH,
          tracking: TITLE_TRACKING,
        }).length <= 2
    ) ?? 68;
  const titleLines = wrap(title, semibold, {
    size: titleSize,
    maxWidth: TITLE_WIDTH,
    tracking: TITLE_TRACKING,
    maxLines: 2,
  });
  const descriptionLines = description
    ? wrap(description, regular, { size: 24, maxWidth: 840, maxLines: 2 })
    : [];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 28,
        backgroundColor: c.page,
        color: c.ink,
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          gap: 1,
          padding: 1,
          backgroundColor: c.line,
        }}
      >
        <div style={{ display: "flex", height: 54, gap: 1 }}>
          <div style={{ ...cell, flex: 1, gap: 10 }}>
            <OgLogo dark={theme === "dark"} size={24} />
            <span style={{ fontSize: 18, fontWeight: 500 }}>
              {oneLine("Kokonut UI")}
            </span>
          </div>
          {metaCells.map((node) => (
            <div key={node.key} style={{ ...cell, flex: 1 }}>
              {node}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "40px 36px 36px",
            backgroundColor: c.page,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: titleSize,
              fontWeight: 600,
              letterSpacing: "-0.05em",
              lineHeight: 0.95,
            }}
          >
            {lines(titleLines)}
          </div>
          {descriptionLines.length ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 24,
                lineHeight: 1.45,
                color: c.soft,
              }}
            >
              {lines(descriptionLines)}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", height: 68, gap: 1 }}>
          <div
            style={{
              ...cell,
              flex: 7,
              gap: 12,
              padding: "0 36px",
              ...mono,
              fontSize: 18,
            }}
          >
            {part ? (
              <>
                <span style={{ color: c.leaf, marginRight: 12 }}>$</span>
                <span>{oneLine(installCommand(part.name))}</span>
              </>
            ) : (
              <span>kokonutui.com{url}</span>
            )}
          </div>
          <div
            style={{
              ...cell,
              flex: 5,
              justifyContent: "flex-end",
              ...mono,
              fontSize: 16,
              color: c.soft,
            }}
          >
            {part ? "kokonutui.com" : oneLine(`${count} components`)}
          </div>
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts }
  );
}
