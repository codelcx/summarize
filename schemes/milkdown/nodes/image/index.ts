import { MilkdownPlugin } from '@milkdown/kit/ctx'
import { ImageView } from './view'
import { imageConfig } from './config'

export const imageComponent: MilkdownPlugin[] = [
  ImageView,
  imageConfig,
]
