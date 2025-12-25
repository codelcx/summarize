import Button from './index.vue'
import { SFCWithInstall, withInstall } from '../install'

export const ElButton: SFCWithInstall<typeof Button> = withInstall(Button)
export default ElButton
