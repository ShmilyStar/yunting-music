import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'

/**
 * 爱心「已收藏」的判定口径（唯一来源）。
 *
 * 事故背景（用户 2026-10-24 反馈）：mini 条与主播放页的爱心，只要歌曲出现在
 * **任意**用户列表里就显示实心。从「发现」收藏来的歌单（带 `sourceListId`）
 * 里装着整张歌单的歌，于是一收藏歌单，里面每首歌都变成「已收藏」。
 *
 * 用户给定的口径：**只有被添加到「我的歌曲」下的歌单（我的收藏 / 自建歌单）
 * 才算已收藏**，收藏来的歌单本身不算。
 *
 * 判据用 `sourceListId`：从「发现 / 榜单」整张收藏下来的歌单，`sourceListId`
 * 非空；用户在「我的歌曲」里自建的歌单该字段为空。注意不能只看 `source`
 * 字段——自建歌单也可能记录来源音源，用它会误伤。
 *
 * 这个函数被三处共用，任何一处单独改动都会造成「实心但点了没反应」或
 * 「空心点了却删了别处的歌」：
 * 1. `store/list/hook.ts` 的 `useMusicInAnyList`（爱心状态）
 * 2. `core/list.ts` 的 `removeMusicFromFavoriteLists`（实心点击 = 取消收藏）
 * 3. 测试 `test/list/heartFavoriteScope.test.ts` 钉住这条口径
 */
export const getFavoriteListIds = (): string[] => {
  const userListIds = listState.userList
    // 收藏来的歌单不参与「已收藏」判定
    .filter(item => !item.sourceListId)
    .map(item => item.id)
  return [LIST_IDS.LOVE, ...userListIds]
}
