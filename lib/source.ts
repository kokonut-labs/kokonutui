import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { icons } from "lucide-react";
import { createElement } from "react";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  icon(icon) {
    if (!icon) {
      return;
    }

    // Lucide renames icons between versions; fall back to a neutral glyph so a
    // stale name never leaves a sidebar row without an icon.
    const Icon =
      icon in icons ? icons[icon as keyof typeof icons] : icons.Component;
    return createElement(Icon);
  },
});
