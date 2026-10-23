import { getSongListSetting, saveSongListSetting } from '@/utils/data'
import { useEffect, useRef } from 'react'
import { View } from 'react-native'

// import List from './List/List'
import HeaderBar, { type HeaderBarProps, type HeaderBarType } from './HeaderBar'
import songlistState, { type InitState, type SortInfo } from '@/store/songlist/state'
import List, { type ListType } from './List'
import { createStyle } from '@/utils/tools'


interface SonglistInfo {
  source: InitState['sources'][number]
  sortId: SortInfo['id']
  tagId: string
}

export default () => {
  const headerBarRef = useRef<HeaderBarType>(null)
  const listRef = useRef<ListType>(null)
  const songlistInfo = useRef<SonglistInfo>({ source: 'kw', sortId: '5', tagId: '' })

  useEffect(() => {
    void getSongListSetting().then(info => {
      songlistInfo.current.source = info.source
      songlistInfo.current.sortId = info.sortId || '5'
      songlistInfo.current.tagId = info.tagId
      headerBarRef.current?.setSource(info.source, songlistInfo.current.sortId, info.tagName, info.tagId)
      listRef.current?.loadList(info.source, songlistInfo.current.sortId, info.tagId)
    })
  }, [])

  const handleSortChange: HeaderBarProps['onSortChange'] = (id) => {
    songlistInfo.current.sortId = id
    void saveSongListSetting({ sortId: id })
    listRef.current?.loadList(songlistInfo.current.source, id, songlistInfo.current.tagId)
  }

  const handleTagChange: HeaderBarProps['onTagChange'] = (name, id) => {
    songlistInfo.current.tagId = id
    void saveSongListSetting({ tagName: name, tagId: id })
    listRef.current?.loadList(songlistInfo.current.source, songlistInfo.current.sortId, id)
  }

  const handleSourceChange: HeaderBarProps['onSourceChange'] = (source) => {
    songlistInfo.current.source = source
    // 切源时清空标签、排序取该源的首个排序项（取不到时缺省 '5'）
    songlistInfo.current.tagId = ''
    songlistInfo.current.sortId = songlistState.sortList[source]?.[0]?.id ?? '5'
    void saveSongListSetting({ sortId: songlistInfo.current.sortId, source, tagId: '', tagName: '' })
    headerBarRef.current?.setSource(source, songlistInfo.current.sortId, '', songlistInfo.current.tagId)
    listRef.current?.loadList(source, songlistInfo.current.sortId, songlistInfo.current.tagId)
  }

  return (
    <View style={styles.container}>
      <HeaderBar
        ref={headerBarRef}
        onSortChange={handleSortChange}
        onTagChange={handleTagChange}
        onSourceChange={handleSourceChange}
      />
      <List ref={listRef} />
    </View>
  )
}

const styles = createStyle({
  container: {
    position: 'relative',
    flex: 1,
  },
})

