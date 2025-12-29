import type { EditorOptions } from '@tiptap/vue-3'
import Text from '@tiptap/extension-text'
import Document from '@tiptap/extension-document'
import { Paragraph } from '@tiptap/extension-paragraph'
import { CustomNode } from '../nodes'
import { customExtension, pastPlugin } from '../extensions'

export const editorConfig: Partial<EditorOptions> = {
  extensions: [
    // community extension
    Text,
    Paragraph,
    Document,

    // custom extension
    customExtension,

    // custom Node
    CustomNode,

    // custom plugin
    pastPlugin,
  ],
}
