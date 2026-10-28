package cn.toside.ytmusic.mobile.lyric;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;

public class Lyric extends LyricPlayer {
  LyricView lyricView = null;
  LyricEvent lyricEvent = null;
  ReactApplicationContext reactAppContext;

  boolean isRunPlayer = false;
  // String lastText = "LX Music ^-^";
  int lastLine = 0;
  List lines = new ArrayList();
  boolean isShowTranslation;
  boolean isShowRoma;
  boolean isShowLyricView = false;
  boolean isSendLyricTextEvent = false;
  boolean isScreenOff = false;
  String lyricText = "";
  String translationText = "";
  String romaLyricText = "";

  Lyric(ReactApplicationContext reactContext, boolean isShowTranslation, boolean isShowRoma, float playbackRate) {
    this.reactAppContext = reactContext;
    this.isShowTranslation = isShowTranslation;
    this.isShowRoma = isShowRoma;
    this.playbackRate = playbackRate;
    registerScreenBroadcastReceiver();
    // checkA2DPConnection(reactContext);
  }

  private void registerScreenBroadcastReceiver() {
    final IntentFilter theFilter = new IntentFilter();
    /** System Defined Broadcast */
    theFilter.addAction(Intent.ACTION_SCREEN_ON);
    theFilter.addAction(Intent.ACTION_SCREEN_OFF);

    BroadcastReceiver screenOnOffReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        String strAction = intent.getAction();

        switch (Objects.requireNonNull(strAction)) {
          case Intent.ACTION_SCREEN_OFF:
            Log.d("Lyric", "ACTION_SCREEN_OFF");
            handleScreenOff();
            break;
          case Intent.ACTION_SCREEN_ON:
            Log.d("Lyric", "ACTION_SCREEN_ON");
            handleScreenOn();
            break;
        }
      }
    };

    reactAppContext.registerReceiver(screenOnOffReceiver, theFilter);
  }

  // private void checkA2DPConnection(Context context) {
  //   BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

  //   if (bluetoothAdapter != null && bluetoothAdapter.isEnabled()) {
  //     bluetoothAdapter.getProfileProxy(context, new BluetoothProfile.ServiceListener() {
  //       @Override
  //       public void onServiceConnected(int profile, BluetoothProfile proxy) {
  //         if (profile == BluetoothProfile.A2DP) {
  //           List<BluetoothDevice> connectedDevices = proxy.getConnectedDevices();
  //           if (!connectedDevices.isEmpty()) {
  //             System.out.println("已连接的 A2DP 媒体设备：");
  //             for (BluetoothDevice device : connectedDevices) {
  //               System.out.println("设备名称: " + "地址: " + device.getAddress());
  //             }
  //           } else {
  //             System.out.println("没有连接的 A2DP 媒体设备");
  //           }
  //         }
  //         bluetoothAdapter.closeProfileProxy(profile, proxy);
  //       }

  //       @Override
  //       public void onServiceDisconnected(int profile) {
  //         // 服务断开时的处理
  //         System.out.println("蓝牙服务断开时的处理");
  //       }
  //     }, BluetoothProfile.A2DP);
  //   } else {
  //     System.out.println("蓝牙未开启或设备不支持蓝牙");
  //   }
  // }

  private boolean isDisableAutoPause() {
    return !isRunPlayer || isSendLyricTextEvent;
  }
  private void handleScreenOff() {
    isScreenOff = true;
    if (isDisableAutoPause()) return;
    setTempPause(true);
  }

  private void handleScreenOn() {
    isScreenOff = false;
    if (isDisableAutoPause()) return;
    if (lyricView == null) lyricView = new LyricView(reactAppContext, lyricEvent);
    // 悬浮窗的视图挂在 RN 原生模块线程上，屏幕亮起回调在主线程，必须 post 回视图线程
    lyricView.postOnViewThread(() -> {
      handleGetCurrentLyric(lastLine);
      setTempPause(false);
    });
  }

  private void pausePlayer() {
    if (!isRunPlayer || isShowLyricView || isSendLyricTextEvent) return;
    isRunPlayer = false;
    this.pause();
  }

  private void setCurrentLyric(String lyric, ArrayList<String> extendedLyrics, ArrayList<String> followingLyrics) {
    if (isShowLyricView && !isScreenOff && lyricView != null) {
      lyricView.setLyric(lyric, extendedLyrics, followingLyrics);
    }
    if (isSendLyricTextEvent) {
      WritableMap params = Arguments.createMap();
      params.putString("text", lyric);
      params.putArray("extendedLyrics", Arguments.makeNativeArray(extendedLyrics));
      lyricEvent.sendEvent(lyricEvent.LYRIC_Line_PLAY, params);
    }
  }
  private void handleGetCurrentLyric(int lineNum) {
    lastLine = lineNum;
    if (lineNum >= 0 && lineNum < lines.size()) {
      HashMap line = (HashMap) lines.get(lineNum);
      if (line != null) {
        setCurrentLyric((String) line.get("text"), (ArrayList<String>) line.get("extendedLyrics"), getFollowingLyrics(lineNum));
        return;
      }
    }
    setCurrentLyric("", new ArrayList<>(0), new ArrayList<>(0));
  }

  /** 当前行之后的歌词，供桌面歌词按「已播放 / 未播放」两种颜色渲染 */
  private ArrayList<String> getFollowingLyrics(int lineNum) {
    ArrayList<String> following = new ArrayList<>();
    if (lineNum < 0) return following;
    for (int i = lineNum + 1; i < lines.size() && following.size() < 5; i++) {
      HashMap line = (HashMap) lines.get(i);
      if (line == null) continue;
      String text = (String) line.get("text");
      if (text != null && !text.isEmpty()) following.add(text);
    }
    return following;
  }

  public void setSendLyricTextEvent(boolean isSend) {
    if (isSendLyricTextEvent == isSend) return;
    isSendLyricTextEvent = isSend;
    if (isSend) {
      if (lyricEvent == null) lyricEvent = new LyricEvent(reactAppContext);
      isRunPlayer = true;
    } else {
      pausePlayer();
    }
  }

  public void showDesktopLyric(Bundle options, Promise promise) {
    if (isShowLyricView) return;
    if (lyricEvent == null) lyricEvent = new LyricEvent(reactAppContext);
    isShowLyricView = true;
    if (lyricView == null) lyricView = new LyricView(reactAppContext, lyricEvent);
    lyricView.setOnCloseListener(this::hideDesktopLyric);
    try {
      lyricView.showLyricView(options);
    } catch (Exception e) {
      promise.reject(e);
      Log.e("Lyric", e.getMessage());
      return;
    }
    isRunPlayer = true;
    promise.resolve(null);
  }

  public void hideDesktopLyric() {
    if (!isShowLyricView) return;
    isShowLyricView = false;
    pausePlayer();
    if (lyricView != null) {
      lyricView.destroy();
      lyricView = null;
    }
  }

  private void refreshLyric() {
    if (!isRunPlayer) return;
    ArrayList<String> extendedLyrics = new ArrayList<>(2);
    if (isShowTranslation && !"".equals(translationText)) extendedLyrics.add(translationText);
    if (isShowRoma && !"".equals(romaLyricText)) extendedLyrics.add(romaLyricText);
    super.setLyric(lyricText, extendedLyrics);
  }

  public void setLyric(String lyric, String translation, String romaLyric) {
    lyricText = lyric;
    translationText = translation;
    romaLyricText = romaLyric;
    refreshLyric();
  }

  @Override
  public void onSetLyric(List lines) {
    this.lines = lines;
    handleGetCurrentLyric(-1);
    // for (int i = 0; i < lines.size(); i++) {
    //   HashMap line = (HashMap) lines.get(i);
    //   Log.d("Lyric", "onSetLyric: " +(String) line.get("text") + " " + line.get("extendedLyrics"));
    // }
  }

  @Override
  public void onPlay(int lineNum) {
    handleGetCurrentLyric(lineNum);
    // Log.d("Lyric", lineNum + " " + text + " " + (String) line.get("translation"));
  }

  public void pauseLyric() {
    pause();
    if (!isRunPlayer) return;
    // 暂停时保留当前这一行（和网易云一致：歌词停在原处，不消失）。
    // 只有歌词还没开始播放（lastLine 仍是 -1）时才不显示内容。
    if (lastLine >= 0) handleGetCurrentLyric(lastLine);
  }

  @Override
  public void play(int curTime) {
    super.play(curTime);
    if (lyricView != null) lyricView.setPlaying(true);
  }

  @Override
  public void pause() {
    super.pause();
    if (lyricView != null) lyricView.setPlaying(false);
  }

  public void lockLyric() {
    if (lyricView == null) return;
    lyricView.lockView();
  }

  public void unlockLyric() {
    if (lyricView == null) return;
    lyricView.unlockView();
  }

  public void setMaxLineNum(int maxLineNum) {
    if (lyricView == null) return;
    lyricView.setMaxLineNum(maxLineNum);
  }

  public void setWidth(int width) {
    if (lyricView == null) return;
    lyricView.setWidth(width);
  }

  public void setSingleLine(boolean singleLine) {
    if (lyricView == null) return;
    lyricView.setSingleLine(singleLine);
  }

  public void setShowToggleAnima(boolean showToggleAnima) {
    if (lyricView == null) return;
    lyricView.setShowToggleAnima(showToggleAnima);
  }

  public void toggleTranslation(boolean isShowTranslation) {
    this.isShowTranslation = isShowTranslation;
    refreshLyric();
  }

  public void toggleRoma(boolean isShowRoma) {
    this.isShowRoma = isShowRoma;
    refreshLyric();
  }

  public void setPlayedColor(String unplayColor, String playedColor, String shadowColor) {
    if (lyricView == null) return;
    lyricView.setColor(unplayColor, playedColor, shadowColor);
  }

  public void setAlpha(float alpha) {
    if (lyricView == null) return;
    lyricView.setAlpha(alpha);
  }

  public void setTextSize(float size) {
    if (lyricView == null) return;
    lyricView.setTextSize(size);
  }

  public void setTouchable(boolean touchable) {
    if (lyricView == null) return;
    lyricView.setTouchable(touchable);
  }
}
