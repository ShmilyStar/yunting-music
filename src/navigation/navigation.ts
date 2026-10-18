import { Navigation } from 'react-native-navigation'
// import { InteractionManager } from 'react-native'

import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  // SETTING_SCREEN,
} from './screenNames'

import themeState from '@/store/theme/state'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { getStatusBarStyle } from './utils'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { type ListInfoItem } from '@/store/songlist/state'

// const store = getStore()
// const getTheme = () => getter('common', 'theme')(store.getState())

export async function pushHomeScreen() {
  /*
    Navigation.setDefaultOptions({
      topBar: {
        background: {
          color: '#039893',
        },
        title: {
          color: 'white',
        },
        backButton: {
          title: '', // Remove previous screen name from back button
          color: 'white',
        },
        buttonColor: 'white',
      },
      statusBar: {
        style: 'light',
      },
      layout: {
        orientation: ['portrait'],
      },
      bottomTabs: {
        titleDisplayMode: 'alwaysShow',
      },
      bottomTab: {
        textColor: 'gray',
        selectedTextColor: 'black',
        iconColor: 'gray',
        selectedIconColor: 'black',
      },
    })
  */

  const theme = themeState.theme
  return Navigation.setRoot({
    root: {
      stack: {
        children: [{
          component: {
            name: HOME_SCREEN,
            options: {
              topBar: {
                visible: false,
                height: 0,
                drawBehind: false,
              },
              statusBar: {
                drawBehind: true,
                visible: true,
                style: getStatusBarStyle(theme.isDark),
                backgroundColor: 'transparent',
              },
              navigationBar: {
                // visible: false,
                backgroundColor: theme['c-content-background'],
              },
              layout: {
                componentBackgroundColor: theme['c-content-background'],
              },
            },
          },
        }],
      },
    },
  })
}
export function pushPlayDetailScreen(componentId: string, skipAnimation = false) {
  /*
    Navigation.setDefaultOptions({
      topBar: {
        background: {
          color: '#039893',
        },
        title: {
          color: 'white',
        },
        backButton: {
          title: '', // Remove previous screen name from back button
          color: 'white',
        },
        buttonColor: 'white',
      },
      statusBar: {
        style: 'light',
      },
      layout: {
        orientation: ['portrait'],
      },
      bottomTabs: {
        titleDisplayMode: 'alwaysShow',
      },
      bottomTab: {
        textColor: 'gray',
        selectedTextColor: 'black',
        iconColor: 'gray',
        selectedIconColor: 'black',
      },
    })
  */
  requestAnimationFrame(() => {
    const theme = themeState.theme

    void Navigation.push(componentId, {
      component: {
        name: PLAY_DETAIL_SCREEN,
        passProps: {
          skipAnimation,
        },
        options: {
          topBar: {
            visible: false,
            height: 0,
            drawBehind: false,
          },
          statusBar: {
            drawBehind: true,
            visible: true,
            style: getStatusBarStyle(theme.isDark),
            backgroundColor: 'transparent',
          },
          navigationBar: {
            // visible: false,
            backgroundColor: theme['c-content-background'],
          },
          layout: {
            // 播放页是「从 Tab 栏上框线划出的面板」：面板本身不画背景，
            // 屏幕也必须透明，收回时露出的才是下层主界面而不是整屏底色（02 §8.3）
            componentBackgroundColor: 'transparent',
          },
          animations: {
            // 播放页的进出**全部**由 JS 面板自己做（300ms 从底栏上框线滑出 / 240ms 收回，
            // 见 `PlayDetail/Vertical/index.tsx`）。
            //
            // 两端都必须给一个「不可感知位移」的原生转场，不能置空也不能关掉：
            // - `{}` 是 RNN 默认转场，会把整屏（连标题栏）一起往上推，动画方向就错了；
            // - `{ enabled: false }` 没有转场，下层主界面在切屏瞬间就被移除，会闪一两帧空白；
            // - 1dp 位移加满时长的转场期间，下层主界面一直参与合成，标题栏 / Tab 栏原地不动，
            //   面板滑出时上方透出的正是主页内容。
            // push 时长要盖住面板的 300ms，pop 时长与收回的 240ms 对齐。
            push: {
              // 等 JS 首帧渲染完再开始转场，避免渲染前的空帧闪一下
              waitForRender: true,
              content: {
                translationY: {
                  from: 0,
                  to: 1,
                  duration: 320,
                },
              },
            },
            pop: {
              content: {
                translationY: {
                  from: 0,
                  to: 1,
                  duration: 240,
                },
              },
            },
          },
        },
      },
    })
  })
}
export function pushSonglistDetailScreen(componentId: string, info: ListInfoItem) {
  const theme = themeState.theme

  requestAnimationFrame(() => {
    void Navigation.push(componentId, {
      component: {
        name: SONGLIST_DETAIL_SCREEN,
        passProps: {
          info,
        },
        options: {
          topBar: {
            visible: false,
            height: 0,
            drawBehind: false,
          },
          statusBar: {
            drawBehind: true,
            visible: true,
            style: getStatusBarStyle(theme.isDark),
            backgroundColor: 'transparent',
          },
          navigationBar: {
            // visible: false,
            backgroundColor: theme['c-content-background'],
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
          animations: {
            push: {
              sharedElementTransitions: [
                {
                  fromId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${info.id}`,
                  toId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`,
                  interpolation: { type: 'spring' },
                },
              ],
              elementTransitions: [
                {
                  id: NAV_SHEAR_NATIVE_IDS.songlistDetail_title,
                  alpha: {
                    from: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 300,
                  },
                  translationX: {
                    from: 16, // Animate translationX from 16dp to 0dp
                    duration: 300,
                  },
                },
              ],
              // content: {
              //   scaleX: {
              //     from: 1.2,
              //     to: 1,
              //     duration: 200,
              //   },
              //   scaleY: {
              //     from: 1.2,
              //     to: 1,
              //     duration: 200,
              //   },
              //   alpha: {
              //     from: 0,
              //     to: 1,
              //     duration: 200,
              //   },
              // },
            },
            pop: {
              sharedElementTransitions: [
                {
                  fromId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`,
                  toId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${info.id}`,
                  interpolation: { type: 'spring' },
                },
              ],
              elementTransitions: [
                {
                  id: NAV_SHEAR_NATIVE_IDS.songlistDetail_title,
                  alpha: {
                    to: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 300,
                  },
                  translationX: {
                    to: 16, // Animate translationX from 16dp to 0dp
                    duration: 300,
                  },
                },
              ],
              // content: {
              //   alpha: {
              //     from: 1,
              //     to: 0,
              //     duration: 200,
              //   },
              // },
            },
          },
        },
      },
    })
  })
}
export function pushCommentScreen(componentId: string) {
  /*
    Navigation.setDefaultOptions({
      topBar: {
        background: {
          color: '#039893',
        },
        title: {
          color: 'white',
        },
        backButton: {
          title: '', // Remove previous screen name from back button
          color: 'white',
        },
        buttonColor: 'white',
      },
      statusBar: {
        style: 'light',
      },
      layout: {
        orientation: ['portrait'],
      },
      bottomTabs: {
        titleDisplayMode: 'alwaysShow',
      },
      bottomTab: {
        textColor: 'gray',
        selectedTextColor: 'black',
        iconColor: 'gray',
        selectedIconColor: 'black',
      },
    })
  */
  requestAnimationFrame(() => {
    const theme = themeState.theme

    void Navigation.push(componentId, {
      component: {
        name: COMMENT_SCREEN,
        options: {
          topBar: {
            visible: false,
            height: 0,
            drawBehind: false,
          },
          statusBar: {
            drawBehind: true,
            visible: true,
            style: getStatusBarStyle(theme.isDark),
            backgroundColor: 'transparent',
          },
          navigationBar: {
            // visible: false,
            backgroundColor: theme['c-content-background'],
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
          animations: {
            push: {
              content: {
                translationX: {
                  from: windowSizeTools.getSize().width,
                  to: 0,
                  duration: 300,
                },
              },
            },
            pop: {
              content: {
                translationX: {
                  from: 0,
                  to: windowSizeTools.getSize().width,
                  duration: 300,
                },
              },
            },
          },
        },
      },
    })
  })
}

// export function pushSettingScreen(componentId: string) {
//   /*
//     Navigation.setDefaultOptions({
//       topBar: {
//         background: {
//           color: '#039893',
//         },
//         title: {
//           color: 'white',
//         },
//         backButton: {
//           title: '', // Remove previous screen name from back button
//           color: 'white',
//         },
//         buttonColor: 'white',
//       },
//       statusBar: {
//         style: 'light',
//       },
//       layout: {
//         orientation: ['portrait'],
//       },
//       bottomTabs: {
//         titleDisplayMode: 'alwaysShow',
//       },
//       bottomTab: {
//         textColor: 'gray',
//         selectedTextColor: 'black',
//         iconColor: 'gray',
//         selectedIconColor: 'black',
//       },
//     })
//   */
//     const theme = themeState.theme

//     void Navigation.push(componentId, {
//       component: {
//         name: SETTING_SCREEN,
//         options: {
//           topBar: {
//             visible: false,
//             height: 0,
//             drawBehind: false,
//           },
//           statusBar: {
//             drawBehind: true,
//             visible: true,
//             style: getStatusBarStyle(theme.isDark),
//             backgroundColor: 'transparent',
//           },
//           navigationBar: {
//             // visible: false,
//             backgroundColor: theme['c-content-background'],
//           },
//           layout: {
//             componentBackgroundColor: theme['c-content-background'],
//           },
//           animations: {
//             push: {
//               content: {
//                 translationX: {
//                   from: windowSizeTools.getSize().width,
//                   to: 0,
//                   duration: 300,
//                 },
//               },
//             },
//             pop: {
//               content: {
//                 translationX: {
//                   from: 0,
//                   to: windowSizeTools.getSize().width,
//                   duration: 300,
//                 },
//               },
//             },
//           },
//         },
//       },
//   })
// }

/*
export function pushSingleScreenApp() {
  Navigation.setRoot({
    root: {
      stack: {
        children: [{
          component: {
            name: SINGLE_APP_SCREEN,
            options: {
              topBar: {
                title: {
                  text: 'SINGLE SCREEN APP',
                },
                leftButtons: [
                  {
                    id: 'nav_user_btn',
                    icon: require('assets/icons/ic_nav_user.png'),
                    color: 'white',
                  },
                ],
                rightButtons: [
                  {
                    id: 'nav_logout_btn',
                    icon: require('assets/icons/ic_nav_logout.png'),
                    color: 'white',
                  },
                ],
              },
            },
          },
        }],
      },
    },
  })
}

export function pushTabBasedApp() {
  Navigation.setRoot({
    root: {
      bottomTabs: {
        children: [{
          stack: {
            children: [{
              component: {
                name: TAB1_SCREEN,
                options: {
                  topBar: {
                    title: {
                      text: 'TAB 1',
                    },
                    leftButtons: [
                      {
                        id: 'nav_user_btn',
                        icon: require('assets/icons/ic_nav_user.png'),
                        color: 'white',
                      },
                    ],
                    rightButtons: [
                      {
                        id: 'nav_logout_btn',
                        icon: require('assets/icons/ic_nav_logout.png'),
                        color: 'white',
                      },
                    ],
                  },
                },
              },
            }],
            options: {
              bottomTab: {
                icon: require('assets/icons/ic_tab_home.png'),
                testID: 'FIRST_TAB_BAR_BUTTON',
                text: 'Tab1',
              },
            },
          },
        },
        {
          stack: {
            children: [{
              component: {
                name: TAB2_SCREEN,
                options: {
                  topBar: {
                    title: {
                      text: 'TAB 2',
                    },
                    leftButtons: [
                      {
                        id: 'nav_user_btn',
                        icon: require('assets/icons/ic_nav_user.png'),
                        color: 'white',
                      },
                    ],
                    rightButtons: [
                      {
                        id: 'nav_logout_btn',
                        icon: require('assets/icons/ic_nav_logout.png'),
                        color: 'white',
                      },
                    ],
                  },
                },
              },
            }],
            options: {
              bottomTab: {
                icon: require('assets/icons/ic_tab_menu.png'),
                testID: 'SECOND_TAB_BAR_BUTTON',
                text: 'Tab2',
              },
            },
          },
        }],
      },
    },
  })
}
 */
