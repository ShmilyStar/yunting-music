import { useEffect } from 'react'
import { View } from 'react-native'
import { useWindowSize } from '@/utils/hooks'
import { createStyle, isWideLayout } from '@/utils/tools'

import Vertical from './Vertical'
import Horizontal from './Horizontal'
import StatusBar from '@/components/common/StatusBar'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'

/**
 * 播放页：按窗口形态在竖屏面板 / 宽屏左右分栏之间选择。
 *
 * 根容器**不画背景**——不透明背景画在各自面板的内容容器上，
 * 这样面板从底部 Tab 上框线收回时露出的是下层主界面（02 §8.3）。
 */
export default ({ componentId, skipAnimation = false }: { componentId: string, skipAnimation?: boolean }) => {
  const { width, height } = useWindowSize()

  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={styles.container}>
      <StatusBar />
      {isWideLayout(width, height)
        ? <Horizontal componentId={componentId} skipAnimation={skipAnimation} />
        : <Vertical componentId={componentId} skipAnimation={skipAnimation} />}
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
})
