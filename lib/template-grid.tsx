import { CheckCheck } from "lucide-react";

interface ListItem {
  id: string;
  text: string;
  subtext?: string;
}

interface ColumnData {
  title: string;
  items: ListItem[];
}

interface TemplateData {
  columnOneData: ColumnData;
  columnTwoData: ColumnData;
  technologies: ColumnData;
}

const data: Record<string, TemplateData> = {
  AI: {
    columnOneData: {
      title: "Features",
      items: [
        { id: "feature-1", text: "1-click download and setup" },
        { id: "feature-2", text: "SEO Ready" },
        { id: "feature-3", text: "Small animations and details" },
        { id: "feature-4", text: "Responsive Design" },
        { id: "feature-5", text: "Dark and Light mode" },
        { id: "feature-6", text: "Modern and Elegant Design" },
        { id: "feature-7", text: "Easy to customize" },
      ],
    },
    columnTwoData: {
      title: "Pages",
      items: [
        { id: "benefit-1", text: "Header" },
        { id: "benefit-2", text: "Hero" },
        { id: "benefit-3", text: "Features Grid" },
        { id: "benefit-4", text: "Pricing" },
        { id: "benefit-5", text: "FAQ" },
        { id: "benefit-6", text: "Footer" },
        { id: "benefit-7", text: "404 Page" },
      ],
    },
    technologies: {
      title: "Technologies",
      items: [
        { id: "technology-1", text: "Next.js", subtext: "v15.2.2" },
        {
          id: "technology-2",
          text: "Tailwind CSS",
          subtext: "v4.11.0",
        },
        { id: "technology-3", text: "TypeScript", subtext: "v5" },
        { id: "technology-4", text: "shadcn/ui", subtext: "" },
        { id: "technology-5", text: "React", subtext: "v19" },
        { id: "technology-6", text: "next-themes", subtext: "v0.4.1" },
        { id: "technology-7", text: "Motion", subtext: "v13" },
      ],
    },
  },
  futur: {
    columnOneData: {
      title: "Features",
      items: [
        { id: "feature-1", text: "1-click download and setup" },
        { id: "feature-2", text: "SEO Ready" },
        { id: "feature-3", text: "Small animations and details" },
        { id: "feature-4", text: "Responsive Design" },
        { id: "feature-5", text: "Dark and Light mode" },
        { id: "feature-6", text: "Modern and Elegant Design" },
        { id: "feature-7", text: "Easy to customize" },
      ],
    },
    columnTwoData: {
      title: "Pages",
      items: [
        { id: "benefit-1", text: "Header" },
        { id: "benefit-2", text: "Hero" },
        { id: "benefit-3", text: "Features Grid" },
        { id: "benefit-4", text: "Pricing" },
        { id: "benefit-5", text: "FAQ" },
        { id: "benefit-6", text: "Footer" },
        { id: "benefit-7", text: "404 Page" },
      ],
    },
    technologies: {
      title: "Technologies",
      items: [
        { id: "technology-1", text: "Next.js", subtext: "v15.2.2" },
        {
          id: "technology-2",
          text: "Tailwind CSS",
          subtext: "v4.0.0",
        },
        { id: "technology-3", text: "TypeScript", subtext: "v5" },
        { id: "technology-4", text: "shadcn/ui", subtext: "" },
        { id: "technology-5", text: "React", subtext: "v19" },
        { id: "technology-6", text: "next-themes", subtext: "v0.4.1" },
        { id: "technology-7", text: "Motion", subtext: "v13" },
      ],
    },
  },
  grace: {
    columnOneData: {
      title: "Features",
      items: [
        { id: "feature-1", text: "1-click download and setup" },
        { id: "feature-2", text: "Markdown Posts" },
        { id: "feature-3", text: "SEO Ready" },
        { id: "feature-4", text: "Responsive Design" },
        { id: "feature-5", text: "Copy Code snippets" },
        { id: "feature-6", text: "Code highlighting" },
        { id: "feature-7", text: "Easy to customize" },
      ],
    },
    columnTwoData: {
      title: "Pages",
      items: [
        { id: "benefit-1", text: "Documentation" },
        { id: "benefit-2", text: "Posts" },
        { id: "benefit-3", text: "Sections" },
        { id: "benefit-4", text: "Cmd + K Search" },
      ],
    },
    technologies: {
      title: "Technologies",
      items: [
        { id: "technology-1", text: "Next.js", subtext: "v15.2.2" },
        { id: "technology-2", text: "Tailwind CSS", subtext: "v4.1.0" },
        { id: "technology-3", text: "TypeScript", subtext: "v5" },
        { id: "technology-5", text: "React", subtext: "v19" },
        { id: "technology-6", text: "next-themes", subtext: "v0.4.1" },
        { id: "technology-7", text: "Fumadocs", subtext: "v15" },
      ],
    },
  },
};

const ListWithIcon = ({ items }: { items: ListItem[] }) => (
  <ul className="ml-0 pl-0">
    {items.map((item) => (
      <li className="flex items-center gap-2" key={item.id}>
        <CheckCheck className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
        <span className="text-sm text-zinc-900 dark:text-zinc-200">
          {item.text}
        </span>
        {item.subtext && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {item.subtext}
          </span>
        )}
      </li>
    ))}
  </ul>
);

export default function TemplateGrid({ template }: { template: string }) {
  const templateData = data[template];
  if (!templateData) {
    return null;
  }

  const { columnOneData, columnTwoData, technologies } = templateData;

  const techColumns: (typeof technologies.items)[] = [];
  for (let i = 0; i < technologies.items.length; i += 4) {
    techColumns.push(technologies.items.slice(i, i + 4));
  }

  return (
    <div className="">
      <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-lg">
          <h2 className="flex items-center gap-2 font-semibold text-sm text-zinc-900 uppercase tracking-wider dark:text-white">
            {columnOneData.title}
          </h2>
          <ListWithIcon items={columnOneData.items} />
        </div>

        <div className="rounded-lg">
          <h2 className="flex items-center gap-2 font-semibold text-sm text-zinc-900 uppercase tracking-wider dark:text-white">
            {columnTwoData.title}
          </h2>
          <ListWithIcon items={columnTwoData.items} />
        </div>
      </div>

      <div className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-sm text-zinc-900 uppercase tracking-wider dark:text-white">
          {technologies.title}
        </h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {techColumns.map((column) => (
            <div
              className="rounded-lg"
              key={column.map((item) => item.id).join("-")}
            >
              <ListWithIcon items={column} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
