package cn.toside.ytmusic.mobile.lyric;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class LyricEvent {
  final String SET_VIEW_POSITION = "set-position";
  final String LYRIC_Line_PLAY = "lyric-line-play";
  /** 桌面歌词面板上的操作（上一首/下一首/播放暂停/锁定/关闭/换色/调字号） */
  final String DESKTOP_LYRIC_ACTION = "desktop-lyric-action";

  private final ReactApplicationContext reactContext;
  LyricEvent(ReactApplicationContext reactContext) { this.reactContext = reactContext; }

  public void sendEvent(String eventName, @Nullable WritableMap params) {
    // Log.d("Lyric", "senEvent: " + eventName);
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(eventName, params);
  }
}
