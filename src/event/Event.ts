// import mitt from 'mitt'
// import type { Emitter } from 'mitt'

export default class Event {
  listeners: Map<string, Array<(...args: any[]) => any>>
  constructor() {
    this.listeners = new Map()
  }

  on(eventName: string, listener: (...args: any[]) => any) {
    let targetListeners = this.listeners.get(eventName)
    if (!targetListeners) this.listeners.set(eventName, targetListeners = [])
    targetListeners.push(listener)
  }

  off(eventName: string, listener: (...args: any[]) => any) {
    let targetListeners = this.listeners.get(eventName)
    if (!targetListeners) return
    const index = targetListeners.indexOf(listener)
    if (index < 0) return
    targetListeners.splice(index, 1)
  }

  emit(eventName: string, ...args: any[]) {
    setImmediate(() => {
      const targetListeners = this.listeners.get(eventName)
      if (!targetListeners) return
      // 遍历副本：监听器在回调里 off 自己（本工程常见）时，直接遍历本体会跳过后一个
      for (const listener of [...targetListeners]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        listener(...args)
      }
    })
  }
}

// export class App_EVENT {
//   listeners: Map<string, Array<() => void>>
//   constructor() {
//     this.listeners = new Map()
//   }

//   on(eventName: string, listener: () => void) {
//     let targetListeners = this.listeners.get(eventName)
//     if (targetListeners) this.listeners.set(eventName, targetListeners = [])
//     targetListeners!.push(listener)
//   }

//   off(eventName: string, listener: () => void) {

//   }
// }

