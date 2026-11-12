"use server";

import { readComponentSource } from "@/lib/get-llm-text";

/**
 * A component's file name. The name comes from the browser and ends up in a
 * file path, so anything that could leave `components/kokonutui` is refused.
 */
const COMPONENT_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CopyComponentState {
  error: string;
  content: string;
  success: boolean;
}

export const copyComponent = async (
  _prevState: CopyComponentState,
  formData: FormData
) => {
  const name = formData.get("folder");

  if (typeof name !== "string" || !COMPONENT_NAME_RE.test(name)) {
    return {
      error: "Component not found",
      content: "",
      success: false,
    };
  }

  try {
    return {
      error: "",
      content: await readComponentSource(name),
      success: true,
    };
  } catch {
    return {
      error: "Component not found",
      content: "",
      success: false,
    };
  }
};
