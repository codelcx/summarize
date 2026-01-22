import { defineComponent, PropType, Ref } from 'vue'
import { ImageConfig } from '../config'

type Attrs = {
  alt: string
  src: string
  title: string
}

type AttrsRef = {
  [P in keyof Attrs]: Ref<Attrs[P] | undefined>
}

interface MilkdownImageProps extends AttrsRef {
  config: ImageConfig
  readonly: Ref<boolean>
  selected: Ref<boolean>
  setAttr: <T extends keyof Attrs>(attr: T, value: Attrs[T]) => void
}

const MilkdownImage = defineComponent({
  name: 'MilkdownImage',

  props: {
    alt: {
      type: Object as PropType<Ref<string | undefined>>,
      required: true,
    },
    src: {
      type: Object as PropType<Ref<string | undefined>>,
      required: true,
    },
    title: {
      type: Object as PropType<Ref<string | undefined>>,
      required: true,
    },
    config: {
      type: Object as PropType<ImageConfig>,
      required: true,
    },
    readonly: {
      type: Object as PropType<Ref<boolean>>,
      required: true,
    },
    selected: {
      type: Object as PropType<Ref<boolean>>,
      required: true,
    },
    setAttr: {
      type: Function as PropType<<T extends keyof Attrs>(attr: T, value: Attrs[T]) => void>,
      required: true,
    },
  },

  setup(props: MilkdownImageProps)
  {
    const handleClick = () =>
    {
      console.log('click image')
    }
    return () => (
      <img
        className="milkdown-image"
        src={props.src.value}
        alt={props.alt.value}
        title={props.alt.value}
        onClick={handleClick}
      />
    )
  },
})

export default MilkdownImage
