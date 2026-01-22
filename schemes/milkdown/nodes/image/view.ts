import type { Node } from '@milkdown/kit/prose/model'
import type { NodeViewConstructor } from '@milkdown/kit/prose/view'
import { $view } from '@milkdown/kit/utils'
import { createApp, ref, watchEffect } from 'vue'
import { imageSchema } from '@milkdown/kit/preset/commonmark'
import { imageConfig } from './config'
import Image from './components/image'

export const ImageView = $view(
  imageSchema.node,
  (ctx): NodeViewConstructor =>
  {
    return (initialNode, view, getPos) =>
    {
      console.log('initialNode', initialNode)
      const src = ref(initialNode.attrs.src)
      const alt = ref(initialNode.attrs.alt)
      const title = ref(initialNode.attrs.title)
      const selected = ref(false)
      const readonly = ref(!view.editable)
      const setAttr = (attr: string, value: unknown) =>
      {
        if (!view.editable) return
        const pos = getPos()
        if (pos == null) return
        view.dispatch(
          view.state.tr.setNodeAttribute(
            pos,
            attr,
            value,
          ),
        )
      }

      const config = ctx.get(imageConfig.key)
      const app = createApp(Image, {
        src,
        alt,
        title,
        selected,
        readonly,
        setAttr,
        config,
      })
      const dom = document.createElement('span')
      dom.className = 'custom-image'
      const disposeSelectedWatcher = watchEffect(() =>
      {
        const isSelected = selected.value
        dom.classList.toggle('selected', isSelected)
      })
      const bindAttrs = (node: Node) =>
      {
        src.value = node.attrs.src
        alt.value = node.attrs.alt
        title.value = node.attrs.title
      }
      bindAttrs(initialNode)
      app.mount(dom)

      return {
        dom,
        update: (updatedNode) =>
        {
          if (updatedNode.type !== initialNode.type) return false

          bindAttrs(updatedNode)
          return true
        },
        stopEvent: (e) =>
        {
          if (e.target instanceof HTMLInputElement) return true

          return false
        },
        selectNode: () =>
        {
          selected.value = true
        },
        deselectNode: () =>
        {
          selected.value = false
        },
        destroy: () =>
        {
          disposeSelectedWatcher()
          app.unmount()
          dom.remove()
        },
      }
    }
  },
)
