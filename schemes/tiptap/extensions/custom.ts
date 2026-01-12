import { Extension } from '@tiptap/vue-3'

interface CustomExtensionOptions
{
  customOption: string
}

export const customExtension = Extension.create<CustomExtensionOptions>({
  name: 'customExtension',

  /**
   * 继承并扩展功能
   * @example
   * customExtension.extend({
   *  addOptions() {
   *
   *  }
   * })
   */

  /**
   * 自定义配置项
   * @example
   * customExtension.configure({
   *   customOption: 'custom'
   * })
   */

  /**
   * 更多配置项
   * @see https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension
   */

  addOptions()
  {
    return {
      customOption: 'default',
    }
  },

  onCreate()
  {
    // editor create
  },

  onUpdate()
  {
    // editor content update
  },
})
