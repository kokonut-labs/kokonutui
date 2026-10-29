"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";

// Create a cached version of the file reading operation
const readFileCache = cache(
  async (filePath: string) => await fs.readFile(filePath, "utf-8")
);

// Improve caching for the entire component getter
export const getComponent = async (fileName: string | null, folder: string) => {
  const baseDir = path.join(process.cwd(), "components/kokonutui");
  if (!fileName || fileName === "undefined") {
    const fullPath = path.join(baseDir, `${folder}.tsx`);
    // console.log("fullPath", fullPath);
    return await readFileCache(fullPath);
  }

  const fullPath = path.join(baseDir, folder, `${fileName}.tsx`);

  return await readFileCache(fullPath);
};

export interface CopyComponentState {
  error: string;
  content: string;
  success: boolean;
}

export const copyComponent = async (
  _prevState: CopyComponentState,
  formData: FormData
) => {
  try {
    const folder = formData.get("folder");
    const fileName = formData.get("fileName");

    if (!(folder || fileName)) {
      return {
        error: "Folder or file name not found",
        content: "",
        success: false,
      };
    }

    const content = await getComponent(fileName as string, folder as string);

    if (!content) {
      return {
        error: "Component not found",
        content: "",
        success: false,
      };
    }

    return {
      error: "",
      content,
      success: true,
    };
  } catch (error) {
    console.error(error);
    return {
      error: "Failed to copy component",
      content: "",
      success: false,
    };
  }
};
