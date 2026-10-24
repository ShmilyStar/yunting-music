import { useEffect, useState } from 'react'

/**
 * 主页横向翻页的「临时让路」开关。
 *
 * 为什么需要它：主页外壳用原生 `PagerView` 承载「发现 / 我的」，而「我的」页
 * 列表行用原生横向 `ScrollView` 做左滑删除。两者都是原生横向滚动，手指一横划，
 * 祖先 `ViewPager2` 总在子 ScrollView 之前拿到 `onInterceptTouchEvent`，行就
 * 被抢走了 —— 表现就是「左滑删除失灵」。
 *
 * 处理办法：行**按下**的那一刻把 Pager 的 `scrollEnabled` 置 false，本手势内
 * 原生 Pager 不再拦截，行自己的 ScrollView 拿到拖动；抬手（或手势被取消）
 * 立刻恢复。只要起始点不是行（标题栏、四宫格、空白处），滑动照常翻页 ——
 * 两套手势因此在同一页里共存。
 *
 * 用模块级状态 + 订阅而不是 Context：行和 Pager 分别在两棵很深的子树里，
 * 中间还隔着 FlatList / 分页，用 Context 会把整页重渲染。
 */
let locked = false
const listeners = new Set<() => void>()

const notify = () => {
  for (const fn of listeners) fn()
}

/** 行内横滑开始 / 结束（可重复调用，值不变时不分发） */
export const setHomePagerSwipeLocked = (next: boolean) => {
  if (locked === next) return
  locked = next
  notify()
}

export const isHomePagerSwipeLocked = () => locked

/** 订阅「当前是否有行正在接收触摸」 */
export const useHomePagerSwipeLocked = () => {
  const [, force] = useState(0)
  useEffect(() => {
    const listener = () => { force(v => v + 1) }
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])
  return locked
}
