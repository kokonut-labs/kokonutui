# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools==4.68.0", "brotli==1.2.1"]
# ///
"""
Cuts Geist and Geist Mono down to what the site uses and writes them to
public/fonts/, with their @font-face rules in app/fonts.css and the files to
preload in lib/fonts.ts. Run it by hand and commit what it writes; the build
does no font processing.

    uv run scripts/subset-fonts.py

Each font becomes two files in one family:
- core: ASCII, curly quotes, dashes, ellipsis, and every other character the
  site's source puts on a page (é, €, ½, ·, ...). Every page preloads it.
- extended: the rest of Latin-1 and Latin Extended-A. Its unicode-range keeps
  it from loading unless a page shows one of those characters, which today
  only happens when someone types one into a demo.

Characters the site uses stay in core on purpose. The browser shapes each
file's characters as a separate run, so a used é in the extended file would
cost the page that whole file and drop the kerning around the é, shifting the
rest of the line by a fraction of a pixel.

Characters Google Fonts did not serve for these families (arrows, π, ⅓, CJK)
render in a system font today, so they stay out even where Geist has them.

Re-run it when:
- content or a component starts using a character outside ASCII, so it moves
  into core instead of pulling in the extended file,
- text uses a weight outside a font's `used` range below, Geist Mono text
  below 400 above all (canvas text counts: ink-background draws Geist at 650),
- the site turns on an OpenType feature not in FEATURES (slashed-zero,
  diagonal-fractions, a stylistic set) or sets text in true italics,
- the pinned Google Fonts commit is bumped for a new Geist release.

The weight axis is only cut where that is exact: a side of the default
whose weights are unused is dropped whole. Cutting to the exact range in use
(Geist 300-700, Mono 400-500) saves 2.7 KB more per page but rescales the
remaining deltas, which round to whole font units and move antialiased edges
at weights other than 400. `--tight-axes` does it anyway.

Geist's OFL has no Reserved Font Name, so the subsets keep their names.
"""

from __future__ import annotations

import hashlib
import io
import os
import re
import subprocess
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "fonts"
CSS_OUT = ROOT / "app" / "fonts.css"
TS_OUT = ROOT / "lib" / "fonts.ts"

# The same files Google Fonts serves (Geist 1.800, Geist Mono 1.701), pinned
# to a commit of github.com/google/fonts and checked by hash.
GOOGLE_FONTS = "https://raw.githubusercontent.com/google/fonts/6157dfaa640ca5738b4d1a7070fe389c3036d7fc/ofl"


# From fonts.googleapis.com/css2 for both families: latin and latin-ext, then
# cyrillic, cyrillic-ext and vietnamese, then Geist Mono's symbols2.
GOOGLE_LATIN = (
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, "
    "U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, "
    "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, "
    "U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"
)
GOOGLE_OTHER = (
    "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F, U+0301, "
    "U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116, U+0102-0103, U+0110-0111, U+0128-0129, "
    "U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, "
    "U+1EA0-1EF9, U+20AB"
)
GOOGLE_SYMBOLS2 = "U+2000-2001, U+2004-2008, U+200A, U+23B8-23BD, U+2500-259F"


def parse_ranges(ranges: str) -> set[int]:
    cps: set[int] = set()
    for part in ranges.split(","):
        lo, _, hi = part.strip().removeprefix("U+").partition("-")
        cps.update(range(int(lo, 16), int(hi or lo, 16) + 1))
    return cps


@dataclass
class Font:
    family: str
    slug: str
    url: str
    sha256: str
    # Lightest and heaviest weight the site sets in this face.
    used: tuple[int, int]
    # Copied from what next/font/google generated, so text drawn before the
    # web font arrives keeps the same size and line height.
    fallback: str
    # The unicode-ranges Google Fonts served for this family (latin,
    # latin-ext, ...). Anything outside them rendered in a system font.
    served: str


FONTS = [
    Font(
        family="Geist",
        slug="geist",
        url=f"{GOOGLE_FONTS}/geist/Geist%5Bwght%5D.ttf",
        sha256="73894e0448cae90a92b6c2f8732b7bb9acb7b94c418bff559dad4a18e1de9659",
        used=(300, 700),
        fallback="ascent-override: 95.94%;\n  descent-override: 28.16%;\n  line-gap-override: 0%;\n  size-adjust: 104.76%;",
        served=GOOGLE_LATIN + ", " + GOOGLE_OTHER,
    ),
    Font(
        family="Geist Mono",
        slug="geist-mono",
        url=f"{GOOGLE_FONTS}/geistmono/GeistMono%5Bwght%5D.ttf",
        sha256="d00e590b8eb3a59acc329b2d044fd143ae935090b7da33199ebee27cc7de8196",
        used=(400, 500),
        fallback="ascent-override: 74.67%;\n  descent-override: 21.92%;\n  line-gap-override: 0%;\n  size-adjust: 134.59%;",
        served=GOOGLE_LATIN + ", " + GOOGLE_OTHER + ", " + GOOGLE_SYMBOLS2,
    ),
]

# Browsers turn on ccmp, liga, kern, mark and mkmk by themselves (Geist's
# liga draws -> and <- as arrows); tnum is `tabular-nums`. locl is dropped:
# the site only tags en, fr, es, it, de, ja and ko, none of which Geist
# localises.
FEATURES = ["ccmp", "liga", "kern", "mark", "mkmk", "tnum"]

ASCII = set(range(0x20, 0x7F))
LATIN_1 = set(range(0xA0, 0x100))
LATIN_EXT_A = set(range(0x100, 0x180))
# Curly quotes, dashes and ellipsis (also drawn by text-overflow: ellipsis),
# in core even before the site uses them.
CORE_PUNCTUATION = {0x2018, 0x2019, 0x201C, 0x201D, 0x2013, 0x2014, 0x2026}
# Characters the browser draws that never appear in the source: Intl date and
# number output (narrow and thin spaces) and password dots.
RUNTIME = {0x202F, 0x2009, 0x2022}

SCAN_DIRS = ["app", "components", "content", "config", "lib", "hooks"]
SCAN_EXTS = {".ts", ".tsx", ".mdx", ".md", ".css", ".json"}
ESCAPE = re.compile(r"\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})")
NAMED = {"&nbsp;": 0xA0, "&rsaquo;": 0x203A, "&lsaquo;": 0x2039, "&hellip;": 0x2026,
         "&mdash;": 0x2014, "&ndash;": 0x2013, "&rsquo;": 0x2019, "&lsquo;": 0x2018,
         "&ldquo;": 0x201C, "&rdquo;": 0x201D, "&middot;": 0xB7, "&copy;": 0xA9, "&times;": 0xD7}


def site_characters() -> set[int]:
    """Every character the site's source can put on a page, escapes included."""
    chars: set[int] = set()
    hyphens = False
    for d in SCAN_DIRS:
        for path in (ROOT / d).rglob("*"):
            if path.suffix not in SCAN_EXTS or not path.is_file():
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            chars.update(ord(c) for c in text if ord(c) > 0x7E)
            for m in ESCAPE.finditer(text):
                chars.add(int(m.group(1) or m.group(2), 16))
            chars.update(cp for name, cp in NAMED.items() if name in text)
            hyphens = hyphens or bool(re.search(r"hyphens-auto|hyphens:\s*auto", text))
    if hyphens:
        # hyphens: auto draws U+2010 when the font has it.
        chars.add(0x2010)
    return chars


def download(font: Font) -> bytes:
    with urllib.request.urlopen(font.url) as res:
        data = res.read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != font.sha256:
        sys.exit(f"{font.family}: expected sha256 {font.sha256}, got {digest}")
    return data


def subset_font(source: TTFont, unicodes: set[int]) -> bytes:
    options = subset.Options()
    options.layout_features = FEATURES
    options.hinting = False
    options.desubroutinize = True
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]  # names, copyright, OFL
    options.drop_tables += ["STAT", "meta", "DSIG"]
    options.flavor = "woff2"
    font = TTFont(io.BytesIO(save(source, None)), recalcTimestamp=False)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    # The subsetter maps every kept glyph, so a glyph kept only as a component
    # (› is drawn from a flipped ‹) would claim its character too and the file
    # would hold more than its unicode-range says. Map only what was asked.
    for table in font["cmap"].tables:
        table.cmap = {cp: g for cp, g in table.cmap.items() if cp in unicodes}
    return save(font, "woff2")


def save(font: TTFont, flavor: str | None) -> bytes:
    # Keep head.modified as released, so the same input gives the same bytes
    # and file names.
    font.recalcTimestamp = False
    font.flavor = flavor
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def axis_range(font: Font, source: TTFont, tight: bool) -> tuple[int, int]:
    """The weight range to keep: exact-only unless `tight`."""
    axis = next(a for a in source["fvar"].axes if a.axisTag == "wght")
    lo, hi = font.used
    if tight:
        return lo, hi
    default = int(axis.defaultValue)
    return (
        default if lo >= default else int(axis.minValue),
        default if hi <= default else int(axis.maxValue),
    )


def cut_axis(source: TTFont, lo: int, hi: int, tight: bool) -> TTFont:
    """Keep only weights lo-hi of the variable font."""
    axis = next(a for a in source["fvar"].axes if a.axisTag == "wght")
    if (lo, hi) == (axis.minValue, axis.maxValue):
        # Even a no-op range makes the instancer re-encode every delta, which
        # moves some points by a fraction of a unit. Leave the font alone.
        return source
    if tight:
        return instancer.instantiateVariableFont(source, {"wght": (lo, hi)})
    # Dropping a whole side of the default needs no rescaling: delete that
    # side's deltas and leave the rest byte for byte. The instancer would
    # re-encode them too.
    font = TTFont(io.BytesIO(save(source, None)), recalcTimestamp=False)
    gvar = font["gvar"]
    for glyph, variations in gvar.variations.items():
        gvar.variations[glyph] = [
            v for v in variations
            if not (lo == axis.defaultValue and v.axes["wght"][1] < 0)
            and not (hi == axis.defaultValue and v.axes["wght"][1] > 0)
        ]
    fvar = font["fvar"]
    for a in fvar.axes:
        if a.axisTag == "wght":
            a.minValue, a.maxValue = lo, hi
    fvar.instances = [i for i in fvar.instances if lo <= i.coordinates["wght"] <= hi]
    return font


def static_outlines(font: TTFont, weight: int) -> dict[int, tuple]:
    """Each character's outline and advance at one weight."""
    static = instancer.instantiateVariableFont(font, {"wght": weight})
    glyf = static["glyf"]
    return {
        cp: (list(glyf[name].getCoordinates(glyf)[0]), static["hmtx"][name][0])
        for cp, name in static.getBestCmap().items()
    }


def check(font: Font, source: TTFont, data: bytes, expected: set[int], axis: tuple[int, int], reference: dict) -> None:
    """Font tools have quirks: confirm each file is what the CSS says it is."""
    out = TTFont(io.BytesIO(data))
    cmap = set(out.getBestCmap())
    assert cmap == expected, f"{font.slug}: cmap differs by {sorted(cmap ^ expected)}"
    wght = out["fvar"].axes[0]
    assert (wght.axisTag, wght.minValue, wght.defaultValue, wght.maxValue) == (
        "wght", float(axis[0]), 400.0, float(axis[1])
    ), f"{font.slug}: wght axis is {wght.minValue}-{wght.maxValue}"
    for tag in ("GSUB", "GPOS"):
        if tag in out and out[tag].table.FeatureList:
            used = {r.FeatureTag for r in out[tag].table.FeatureList.FeatureRecord}
            assert used <= set(FEATURES), f"{font.slug}: unexpected {tag} features {used - set(FEATURES)}"
    for tag in ("fpgm", "prep", "cvt ", "cvar", "hdmx", "VDMX", "LTSH"):
        assert tag not in out, f"{font.slug}: hinting table {tag} survived"
    for table, fields in {
        "head": ["unitsPerEm"],
        "hhea": ["ascent", "descent", "lineGap"],
        "OS/2": ["sTypoAscender", "sTypoDescender", "sTypoLineGap", "usWinAscent",
                 "usWinDescent", "fsSelection", "usWeightClass", "sxHeight", "sCapHeight"],
    }.items():
        for field in fields:
            a, b = getattr(source[table], field), getattr(out[table], field)
            assert a == b, f"{font.slug}: {table}.{field} changed from {a} to {b}"
    # Same outline and advance as the original at every weight the site uses
    # (only the default when the axis was cut tight, which rounds the rest).
    for weight, glyphs in reference.items():
        for cp, shape in static_outlines(out, weight).items():
            assert shape == glyphs[cp], f"{font.slug}: U+{cp:04X} differs at {weight}"


def unicode_range(cps: set[int]) -> str:
    ranges: list[str] = []
    ordered = sorted(cps)
    start = prev = ordered[0]
    for cp in [*ordered[1:], None]:
        if cp is not None and cp == prev + 1:
            prev = cp
            continue
        ranges.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
        if cp is not None:
            start = prev = cp
    return ", ".join(ranges)


def main() -> None:
    tight = "--tight-axes" in sys.argv
    used = ASCII | CORE_PUNCTUATION | RUNTIME | site_characters()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("geist*.woff2"):
        old.unlink()

    faces: list[str] = []
    preloads: list[str] = []
    print(f"{'file':38} {'bytes':>7} {'glyphs':>6} {'chars':>5}")
    for font in FONTS:
        source = TTFont(io.BytesIO(download(font)))
        lo, hi = axis_range(font, source, tight)
        limited = cut_axis(source, lo, hi, tight)
        weights = {400} if tight else {*range(font.used[0], font.used[1] + 1, 50), *range(lo, hi + 1, 100)}
        reference = {w: static_outlines(source, w) for w in sorted(weights)}
        available = set(limited.getBestCmap())
        available &= parse_ranges(font.served)
        core = used & available
        extended = ((LATIN_1 | LATIN_EXT_A) & available) - core
        for part, cps in (("core", core), ("extended", extended)):
            data = subset_font(limited, cps)
            check(font, source, data, cps, (lo, hi), reference)
            name = f"{font.slug}-{part}.{hashlib.sha256(data).hexdigest()[:10]}.woff2"
            (OUT_DIR / name).write_bytes(data)
            glyphs = TTFont(io.BytesIO(data))["maxp"].numGlyphs
            print(f"{name:38} {len(data):>7} {glyphs:>6} {len(cps):>5}")
            if part == "core":
                preloads.append(f"/fonts/{name}")
            faces.append(
                "@font-face {\n"
                f'  font-family: "{font.family}";\n'
                "  font-style: normal;\n"
                f"  font-weight: {lo} {hi};\n"
                "  font-display: swap;\n"
                f'  src: url("/fonts/{name}") format("woff2");\n'
                f"  unicode-range: {unicode_range(cps)};\n"
                "}\n"
            )
        faces.append(
            "@font-face {\n"
            f'  font-family: "{font.family} Fallback";\n'
            '  src: local("Arial");\n'
            f"  {font.fallback}\n"
            "}\n"
        )

    CSS_OUT.write_text(
        "/* Written by scripts/subset-fonts.py. Edit the script, not this file. */\n\n"
        + "\n".join(faces)
        + "\n.site-fonts {\n"
        '  --font-geist: "Geist", "Geist Fallback";\n'
        '  --font-home-mono: "Geist Mono", "Geist Mono Fallback";\n'
        "  font-family: var(--font-geist);\n"
        "  font-style: normal;\n"
        "}\n"
    )
    TS_OUT.write_text(
        "// Written by scripts/subset-fonts.py. Edit the script, not this file.\n\n"
        "/** The core subsets, preloaded on every page. */\n"
        "export const fontPreloads = [\n"
        + "".join(f'  "{p}",\n' for p in preloads)
        + "];\n"
    )
    subprocess.run(["bunx", "biome", "format", "--write", str(CSS_OUT), str(TS_OUT)], cwd=ROOT, check=True)
    print(f"wrote {os.path.relpath(CSS_OUT, ROOT)} and {os.path.relpath(TS_OUT, ROOT)}")


if __name__ == "__main__":
    main()
