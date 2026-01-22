import { $ctx } from '@milkdown/kit/utils'

export interface ImageConfig {
  uploadPlaceholderText: string
}

export const defaultImageConfig: ImageConfig = {
  uploadPlaceholderText: 'Upload Image',
}

export const imageConfig = $ctx(
  defaultImageConfig,
  'ImageConfigCtx',
)
