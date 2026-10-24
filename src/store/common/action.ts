import state, { type InitState } from './state'
import { type COMPONENT_IDS } from '@/config/constant'
import { isHomeTabId } from '@/config/homeTabs'

type NavId = InitState['navActiveId']

/**
 * 把「要激活的页」折进导航栈。
 *
 * - 主 Tab：栈重置为它自己
 * - 二级页：已在栈里 → 截断回那一层（等价于一直返回）；不在栈里 → 压栈
 */
const reconcileStack = (id: NavId): NavId[] => {
  if (isHomeTabId(id)) return [id]
  const at = state.navStack.indexOf(id)
  if (at > -1) return state.navStack.slice(0, at + 1)
  return [...state.navStack, id]
}

const applyStack = (stack: NavId[]) => {
  state.navStack = stack
  global.state_event.navStackUpdated([...stack])
}

const activate = (id: NavId, stack: NavId[]) => {
  const changed = stack.join() != state.navStack.join()
  if (changed) applyStack(stack)
  state.navActiveId = id
  if (id != 'nav_setting') state.lastNavActiveId = id
  global.state_event.navActiveIdUpdated(id)
}


export default {
  setFontSize(size: number) {
    state.fontSize = size
    global.state_event.fontSizeUpdated(size)
  },
  setStatusbarHeight(size: number) {
    if (state.statusbarHeight == size) return
    state.statusbarHeight = size
    global.state_event.statusbarHeightUpdated(size)
  },
  setComponentId(name: COMPONENT_IDS, id: string) {
    state.componentIds[name] = id
    global.state_event.componentIdsUpdated({ ...state.componentIds })
  },
  removeComponentId(id: string) {
    const name = (Object.entries(state.componentIds) as Array<[COMPONENT_IDS, string]>).find(kv => kv[1] == id)?.[0]
    if (!name) return
    delete state.componentIds[name]
    global.state_event.componentIdsUpdated({ ...state.componentIds })
  },
  /** 兼容旧调用：直接跳到某页，同时把栈折到合理形态 */
  setNavActiveId(id: NavId) {
    activate(id, reconcileStack(id))
  },
  /** 切主 Tab：栈重置 */
  switchHomeTab(id: NavId) {
    if (!isHomeTabId(id)) return
    activate(id, [id])
  },
  /** 压入一个二级页 */
  navigateTo(id: NavId) {
    if (isHomeTabId(id)) {
      this.switchHomeTab(id)
      return
    }
    if (state.navActiveId == id) return
    activate(id, reconcileStack(id))
  },
  /** 出栈；返回是否发生了回退 */
  goBackNav() {
    if (state.navStack.length < 2) return false
    const stack = state.navStack.slice(0, -1)
    activate(stack[stack.length - 1], stack)
    return true
  },
  setLastNavActiveId(id: InitState['navActiveId']) {
    state.lastNavActiveId = id
  },
  setBgPic(pic: string | null) {
    state.bgPic = pic
    global.state_event.bgPicUpdated(pic)
  },
  setSourceNames(names: InitState['sourceNames']) {
    state.sourceNames = names
    global.state_event.sourceNamesUpdated(names)
  },
}
