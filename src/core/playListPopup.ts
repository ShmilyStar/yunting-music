/**
 * 播放列表弹层的全局注册与开关。
 *
 * 弹层同时挂在「主界面」与「播放页」两处（点播放列表按钮时主界面可能被播放页盖住），
 * 这里用注册表保存各实例，唤起时只通知**最后注册**的那一个
 * —— 也就是当前处于最上层的那个，避免一次点击同时弹出多层。
 */
interface PopupHandle {
  /** 呼出（已展开时保持展开） */
  show: () => void
  /** 切换：展开时收起、收起时展开（mini 条上的播放列表键用这个） */
  toggle: () => void
}

const listeners: PopupHandle[] = []

/** 注册一个实例，返回注销函数 */
export const registerPlayListPopup = (handle: PopupHandle) => {
  listeners.push(handle)
  return () => {
    const index = listeners.indexOf(handle)
    if (index > -1) listeners.splice(index, 1)
  }
}

/** 呼出弹出层（取最后注册的实例 —— 也就是当前最上层那个） */
export const showPlayListPopup = () => {
  listeners[listeners.length - 1]?.show()
}

/** 开/关切换（同样作用于最上层实例） */
export const togglePlayListPopup = () => {
  listeners[listeners.length - 1]?.toggle()
}
