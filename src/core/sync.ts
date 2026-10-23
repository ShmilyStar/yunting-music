import { dismissOverlay, onModalDismissed, showSyncModeModal } from '@/navigation'
import syncState from '@/store/sync/state'
import syncActions from '@/store/sync/action'

type RemoveListener = (() => void) | null
let removeEvent: RemoveListener

export const setSyncStatus = (status: LX.Sync.Status) => {
  syncActions.setStatus(status)
}

export const setSyncMessage = (message: LX.Sync.Status['message']) => {
  syncActions.setMessage(message)
}

export const setSyncModeComponentId = (id: string) => {
  syncActions.setSyncModeComponentId(id)
}

const closeSyncModeModal = () => {
  if (syncState.syncModeComponentId) {
    void dismissOverlay(syncState.syncModeComponentId)
    syncActions.setSyncModeComponentId('')
  }
}
export const selectSyncMode = async<T extends keyof LX.Sync.ModeTypes>(serverName: string, type: T) => new Promise<LX.Sync.ModeTypes[T]>((resolve, reject) => {
  removeSyncModeEvent()
  syncActions.setServerInfo(serverName, type)
  showSyncModeModal()

  // removeListener 必须在 removeListeners 之前声明：若在 onModalDismissed 注册
  // 返回前（第 51 行尚未执行）就触发 removeEvent/removeListeners，TDZ 会让
  // `removeListener!()` 抛 ReferenceError。故先声明、后赋值、统一空值保护。
  let removeListener: RemoveListener = null

  const removeListeners = () => {
    removeListener?.()
    removeListener = null
    removeEvent = null
    global.app_event.off('selectSyncMode', handleSelectMode)
  }

  const handleSelectMode = ({ mode }: LX.Sync.ModeType) => {
    removeListeners()
    closeSyncModeModal()
    resolve(mode as LX.Sync.ModeTypes[T])
  }

  removeEvent = () => {
    removeListeners()
    reject(new Error('cancel'))
  }

  global.app_event.on('selectSyncMode', handleSelectMode)

  removeListener = onModalDismissed(syncState.syncModeComponentId, () => {
    syncActions.setSyncModeComponentId('')
    removeEvent?.()
  })
})

export const removeSyncModeEvent = () => {
  if (!removeEvent) return
  removeEvent()
  removeEvent = null
  closeSyncModeModal()
}
