import { type COMPONENT_IDS } from '@/config/constant'
import { useEffect, useState } from 'react'
import state, { type InitState } from './state'

/**
 * 已保存的「字体大小」设置（待下次启动生效）。
 *
 * 注意它只是**持久值**，不是本次运行实际使用的倍率——后者是 `global.lx.fontSize`，
 * 见 `core/common.ts` 的 `setFontSize` 注释。
 */
export const useFontSize = () => {
  const [value, update] = useState(state.fontSize)

  useEffect(() => {
    global.state_event.on('fontSizeUpdated', update)
    return () => {
      global.state_event.off('fontSizeUpdated', update)
    }
  }, [])

  return value
}

export const useStatusbarHeight = () => {
  const [value, update] = useState(state.statusbarHeight)

  useEffect(() => {
    global.state_event.on('statusbarHeightUpdated', update)
    return () => {
      global.state_event.off('statusbarHeightUpdated', update)
    }
  }, [])

  return value
}

export const useComponentIds = () => {
  const [value, update] = useState(state.componentIds)

  useEffect(() => {
    global.state_event.on('componentIdsUpdated', update)
    return () => {
      global.state_event.off('componentIdsUpdated', update)
    }
  }, [])

  return value
}

/**
 * `visibleNames` 里的组件全部已挂载、且**没有其它页面压在上面**时才算可见。
 *
 * 保留「键数量必须相等」的严格判断：主页面在二级页（评论页 / 歌单详情）压栈时
 * 会被卸载，返回时重新挂载——这是本仓库一直以来的行为，也顺带规避了
 * Android 上「Home 的原生视图被上层页面遮挡后不恢复、返回整页空白」的问题。
 */
const hasVisible = (visibleNames: COMPONENT_IDS[], ids: InitState['componentIds']) => {
  const names = Object.keys(ids)
  return names.length == visibleNames.length ? visibleNames.every(n => names.includes(n)) : false
}
export const usePageVisible = (visibleNames: COMPONENT_IDS[], onChange: (visible: boolean) => void) => {
  useEffect(() => {
    let visible = hasVisible(visibleNames, state.componentIds)
    const handlecheck = (ids: InitState['componentIds']) => {
      const res = hasVisible(visibleNames, ids)
      // console.log(visible, res, res == visible)
      if (res == visible) return
      visible = res
      onChange(visible)
    }
    global.state_event.on('componentIdsUpdated', handlecheck)
    return () => {
      global.state_event.off('componentIdsUpdated', handlecheck)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}


/**
 * 该音源是否具备可用音质（列表行用来决定是否置灰）。
 *
 * `source` 变化时必须重新初始化 state 并重订阅：以前 effect 依赖是 `[]`，
 * 闭包里锁死了首次传入的 source，列表行复用到别的源时状态不会更新
 * （多源聚合搜索尤其明显）。
 */
export const useAssertApiSupport = (source: LX.Source) => {
  const [value, update] = useState(global.lx.qualityList[source] != null || source == 'local')

  useEffect(() => {
    // source 变化后先同步一次当前真实值
    update(global.lx.qualityList[source] != null || source == 'local')

    const handleUpdate = () => {
      update(global.lx.qualityList[source] != null || source == 'local')
    }
    global.state_event.on('apiSourceUpdated', handleUpdate)
    return () => {
      global.state_event.off('apiSourceUpdated', handleUpdate)
    }
  }, [source])

  return value
}


export const useNavActiveId = () => {
  const [value, update] = useState(state.navActiveId)

  useEffect(() => {
    global.state_event.on('navActiveIdUpdated', update)
    return () => {
      global.state_event.off('navActiveIdUpdated', update)
    }
  }, [])

  return value
}

/** 订阅整个导航栈（底部 Tab 取栈底 `navStack[0]` 做高亮） */
export const useNavStack = () => {
  const [value, update] = useState(state.navStack)

  useEffect(() => {
    global.state_event.on('navStackUpdated', update)
    return () => {
      global.state_event.off('navStackUpdated', update)
    }
  }, [])

  return value
}

export const useBgPic = () => {
  const [value, update] = useState(state.bgPic)

  useEffect(() => {
    global.state_event.on('bgPicUpdated', update)
    return () => {
      global.state_event.off('bgPicUpdated', update)
    }
  }, [])

  return value
}


export const useSourceNames = () => {
  const [value, update] = useState(state.sourceNames)

  useEffect(() => {
    global.state_event.on('sourceNamesUpdated', update)
    return () => {
      global.state_event.off('sourceNamesUpdated', update)
    }
  }, [])

  return value
}

