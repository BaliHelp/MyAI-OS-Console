/**
 * Central Image-Generation Adapter Registry
 *
 * Parallel to lib/provider-adapters/index.ts but for image output instead of text — kept
 * separate because AttemptCallResult (text) and AttemptImageResult (image) are different
 * shapes and today only one provider (Gemini) has an image-generation path at all.
 *
 * To add a new image provider: create lib/image-adapters/<name>-image.ts implementing
 * ImageAdapter, import and add a single entry below.
 */

import type { ImageAdapter } from "./types";
import { geminiImageAdapter, GEMINI_IMAGE_PRIMARY_MODEL } from "./gemini-image";

export const IMAGE_PROVIDER_REGISTRY: Record<string, ImageAdapter> = {
  gemini: geminiImageAdapter,
};

export const DEFAULT_IMAGE_MODEL_BY_PROVIDER: Record<string, string> = {
  gemini: GEMINI_IMAGE_PRIMARY_MODEL,
};

export type { ImageAdapter, AttemptImageResult } from "./types";
