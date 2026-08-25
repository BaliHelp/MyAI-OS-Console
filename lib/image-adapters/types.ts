/** Result of an image-generation attempt — mirrors AttemptCallResult (provider-adapters/types.ts)
 * but shaped for image output instead of text. */
export interface AttemptImageResult {
  success: boolean;
  imageBase64: string;
  mimeType: string;
  errorMsg: string;
  status: number;
}

export interface ImageAdapter {
  /** Generate an image from a text prompt and return it as base64. */
  call(
    providerApiKey: string,
    prompt: string,
    options: { model_name?: string },
    selectedKeyId?: string | null,
    selectedKeyLabel?: string
  ): Promise<AttemptImageResult>;
}
