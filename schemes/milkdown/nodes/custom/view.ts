import { $view } from '@milkdown/kit/utils'
import { Node } from '@milkdown/kit/prose/model'
import { createApp, ref, watchEffect } from 'vue'
import { NodeViewConstructor } from '@milkdown/kit/prose/view'
import { customConfig } from './config'
import { customNodeSchema } from './schema'
import CustomComponent from './components/custom.vue'

export const customView = $view(
  customNodeSchema.node,
  (ctx): NodeViewConstructor =>
  {
    return (initialNode, view, getPos) =>
    {
      const src = ref(initialNode.attrs.src)
      const alt = ref(initialNode.attrs.alt)
      const title = ref(initialNode.attrs.title)
      const align = ref(initialNode.attrs.align)
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

      const config = ctx.get(customConfig.key)
      const app = createApp(CustomComponent, {
        attrs: {
          src,
          alt,
          title,
          align,
        },
        selected,
        readonly,
        setAttr,
        config,
      })
      const dom = document.createElement('p')
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
        align.value = node.attrs.align
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
