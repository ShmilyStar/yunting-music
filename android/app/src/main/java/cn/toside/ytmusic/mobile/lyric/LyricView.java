package cn.toside.ytmusic.mobile.lyric;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextPaint;
import android.text.style.ForegroundColorSpan;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.OrientationEventListener;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.FrameLayout;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;

import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 桌面歌词悬浮窗。
 *
 * 交互形态对齐网易云音乐：默认只显示歌词（无背景），点一下展开半透明控制面板，
 * 面板里可以打开 App / 关闭 / 上一首 / 播放暂停 / 下一首 / 锁定 / 换歌词颜色 / 调字号；
 * 8 秒无操作自动收起；锁定后整个窗口不接收触摸，只能从 App 设置里解锁。
 */
public class LyricView extends Activity implements View.OnTouchListener {
  private static final long PANEL_AUTO_HIDE_DELAY = 8000L;
  private static final int CONTROL_ROW_HEIGHT_DP = 56;
  private static final int SETTINGS_ROW_HEIGHT_DP = 36;
  /** 歌词左右各留 40dp，给面板左上角的音符图标和右上角的关闭让位，避免长句压到图标上 */
  private static final float LYRIC_TEXT_INSET_DP = 40f;

  private FrameLayout container = null;
  private LyricSwitchView textView = null;
  private LyricControlPanel panel = null;
  /** 收起面板时接住「歌词带」触摸的透明小窗（主窗此时不可点，避免挡住桌面） */
  private View touchLayer = null;
  private WindowManager.LayoutParams touchParams = null;
  private WindowManager windowManager = null;
  private WindowManager.LayoutParams layoutParams = null;
  final private ReactApplicationContext reactContext;
  final private LyricEvent lyricEvent;

  private float lastX;
  private float lastY;
  private float downX;
  private float downY;
  /** 按下的位置，屏幕坐标（面板命中判定用） */
  private float downWindowX;
  private float downWindowY;
  private float prevViewPercentageX = 0;
  private float prevViewPercentageY = 0;
  private float widthPercentage = 1f;
  private final int touchSlop;

  private boolean isDragging = false;
  private boolean isLock = false;
  /** 桌面歌词设置页打开时临时取消可触摸，避免悬浮窗挡住下面的滑块等控件 */
  private boolean isTouchable = true;
  private boolean isSingleLine = false;
  private boolean isShowToggleAnima = false;
  private boolean isPanelVisible = false;
  private boolean isSettingsVisible = false;
  private boolean isPlaying = false;
  private String unplayColor = "rgba(255, 255, 255, 1)";
  private String playedColor = "rgba(44, 183, 233, 1)";
  private String shadowColor = "rgba(0, 0, 0, 0.6)";
  private int unplayColorInt = Color.WHITE;
  private int playedColorInt = Color.parseColor("#2CB7E9");
  private float alpha = 1f;
  private float textSize = 20f;
  /** 已经下发给 TextView 的字号（sp），用来跳过重复设置 */
  private float appliedTextSize = -1f;
  private int maxWidth = 0;
  private int maxHeight = 0;
  /** 当前歌词块高度（真正带底色的那一段） */
  private float lyricHeight = 0;
  /** 固定歌词带高度：按「最大可设行数 + 1 行」预留，行数 ± 与换行都不改窗口尺寸 */
  private float bandHeight = 0;
  /** 当前文本真实排版高度（超过预留行数时用，比如长句折行），换句时清零 */
  private int measuredContentHeight = 0;
  /**
   * 兼容模式：个别 ROM 会把负的窗口 y 夹到 0（不给悬浮窗越出屏幕上沿）。
   * 那时「带顶留白」会让歌词整体下移，歌词也贴不到顶。
   * 检测到这种 ROM 就退回「带高 = 当前歌词块、行数 ± 改窗口」的老策略。
   */
  private boolean noNegativeY = false;
  private boolean yClampProbeInFlight = false;

  private int maxLineNum = 2;
  private String currentLyric = "云听音乐 ^-^";
  private ArrayList<String> currentExtendedLyrics = new ArrayList<>();
  private ArrayList<String> currentFollowingLyrics = new ArrayList<>();

  private Runnable onCloseListener = null;

  private int mLastRotation;
  private OrientationEventListener orientationEventListener = null;

  /** 分辨率 / 密度变化（旋转、分屏、改 dpi）时按新屏幕尺寸重新布局 */
  private final android.content.ComponentCallbacks configCallbacks = new android.content.ComponentCallbacks() {
    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
      panelHandler.post(LyricView.this::updateViewPosition);
    }

    @Override
    public void onLowMemory() { }
  };
  private boolean isConfigCallbacksRegistered = false;

  private final Handler panelHandler = new Handler();
  private final Runnable hidePanelRunnable = this::hidePanel;

  LyricView(ReactApplicationContext reactContext, LyricEvent lyricEvent) {
    this.reactContext = reactContext;
    this.lyricEvent = lyricEvent;
    touchSlop = ViewConfiguration.get(reactContext).getScaledTouchSlop();
  }

  private float dp(float value) {
    return value * reactContext.getResources().getDisplayMetrics().density;
  }

  public void setOnCloseListener(Runnable listener) {
    onCloseListener = listener;
  }

  /** 把任务切回创建悬浮窗视图的那个线程（RN 原生模块线程） */
  public void postOnViewThread(Runnable runnable) {
    panelHandler.post(runnable);
  }

  private void listenOrientationEvent() {
    if (orientationEventListener == null) {
      orientationEventListener = new OrientationEventListener(reactContext, SensorManager.SENSOR_DELAY_NORMAL) {
        @Override
        public void onOrientationChanged(int orientation) {
          Display display = windowManager.getDefaultDisplay();
          int rotation = display.getRotation();
          if (rotation != mLastRotation) {
            panelHandler.postDelayed(LyricView.this::updateViewPosition, 300);
          }
          mLastRotation = rotation;
        }
      };
    }
    if (orientationEventListener.canDetectOrientation()) {
      orientationEventListener.enable();
    }
  }

  private void removeOrientationEvent() {
    if (orientationEventListener == null) return;
    orientationEventListener.disable();
  }

  /**
   * 主窗永远不可点：所有手势都由透明的触摸小窗接收。
   * 主窗高度里有看不见的预留留白，可点的话会把桌面图标的点击吞掉。
   */
  private int getLayoutParamsFlags() {
    return WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
      WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE |
      WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
      WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
  }

  /**
   * update screen width and height
   * @return has updated
   */
  private boolean updateWH() {
    // 注意：不能在这里用 getCurrentWindowMetrics()。overlay 窗口所在上下文返回的是
    // 「这个悬浮窗自己」的 bounds，拿它当屏幕宽度会形成正反馈：
    // 窗口变窄 → maxWidth 变小 → 下一轮宽度再乘一次比例 → 越点越窄。
    // 这里要的是屏幕可用区域，用 Display 的 realSize（含状态栏，overlay 可以覆盖全屏）。
    int w;
    int h;
    if (windowManager != null) {
      Display display = windowManager.getDefaultDisplay();
      DisplayMetrics dm = new DisplayMetrics();
      display.getRealMetrics(dm);
      w = dm.widthPixels;
      h = dm.heightPixels;
    } else {
      DisplayMetrics dm = getResources().getDisplayMetrics();
      w = dm.widthPixels;
      h = dm.heightPixels;
    }
    if (maxWidth == w && maxHeight == h) return false;
    maxWidth = w;
    maxHeight = h;
    return true;
  }

  /**
   * 面板展开时最多要占的高度（控制行 + 设置行 + 宽度条）。
   *
   * 拖动 / 落位都按它预留空间：歌词不能被拖到「下面放不下面板」的位置，
   * 否则展开面板时窗口只能整块往上翻——那是一次窗口移动，系统会补动画，就是闪。
   */
  private float panelRowsPx() {
    return dp(CONTROL_ROW_HEIGHT_DP) + dp(SETTINGS_ROW_HEIGHT_DP) +
      dp(LyricControlPanel.WIDTH_ROW_HEIGHT_DP);
  }
  private void setLayoutParamsHeight() {
    if (textView == null) return;
    TextPaint paint = textView.getPaint();
    if (paint == null) return;

    int inset = textInset();
    int verticalPadding = Math.max(4, Math.round(textSize * 0.3f));
    // 上下留白给行高，左右留白避开面板上的图标；视图本身占满窗口宽度，文字才会真正居中
    textView.setPadding(inset, verticalPadding, inset, verticalPadding);

    // 【固定歌词带】窗口高度按「最大可设行数 + 1 行」一次性预留，行数 ± 只挪歌词块，
    // 不改窗口尺寸 —— 窗口一变尺寸系统就会补一段 bounds 动画，看起来就是闪一下。
    //
    // 行高一律按基准字号算：单行模式会把字号临时缩小，跟着缩小的话每句歌词都会
    // 改一次带宽，等于每句都闪。
    float sizeRatio = appliedTextSize > 0 ? textSize / appliedTextSize : 1f;
    int linePx = Math.round(paint.getFontMetricsInt(null) * 1.18f * sizeRatio);
    if (linePx <= 0) linePx = Math.round(dp(20) * 1.18f);

    int reservedLines = isSingleLine ? 1 : Math.max(1, maxLineNum) + 1;
    int pad = verticalPadding * 2;

    // 【固定歌词带】带高只跟屏幕有关：取「整屏 − 面板行 − 100」，
    // 和字号、行数都无关。这样 A± 改字号、行数 ± 都只在带内挪歌词块，
    // 窗口尺寸不变 —— 窗口一变尺寸系统就补一段 bounds 动画，看起来就是闪一下。
    // （此前带高 = 行高 × 9，跟着字号走，所以改字号会 resize。）
    int used = linePx * reservedLines + pad;
    int band;
    if (noNegativeY) {
      // 兼容模式（系统夹负 y）：不预留，带高 = 当前歌词块，窗口顶边永远 ≥ 0
      band = used;
    } else if (maxHeight > 0) {
      band = Math.max(linePx + pad, maxHeight - Math.round(panelRowsPx()) - 100);
    } else {
      band = linePx * (isSingleLine ? 1 : LyricControlPanel.MAX_LINE + 1) + pad;
    }
    // 长句折行后比预留行还高时，歌词块在带内向上长（窗口尺寸不变）
    if (measuredContentHeight > used) used = Math.min(measuredContentHeight, band);
    if (used > band) used = band;
    if (band < 1) band = 1;
    if (used < 1) used = 1;
    bandHeight = band;
    lyricHeight = used;
  }

  private void clampPosition() {
    if (layoutParams == null) return;
    int maxX = maxWidth - layoutParams.width;
    if (maxX < 0) maxX = 0;
    if (layoutParams.x < 0) layoutParams.x = 0;
    else if (layoutParams.x > maxX) layoutParams.x = maxX;

    // 窗口高度恒为「歌词带 + 面板行」，整窗都要留在屏幕里；窗口顶边可以越过屏幕上沿，
    // 因为歌词块贴在带的底部，带上面那段空白是透明的、看不见
    int maxY = maxHeight - Math.round(bandHeight + panelRowsPx());
    if (maxY < 0) maxY = 0;
    int minY = -Math.round(bandHeight - lyricHeight);
    if (layoutParams.y < minY) layoutParams.y = minY;
    else if (layoutParams.y > maxY) layoutParams.y = maxY;
  }

  /**
   * 按「固定歌词带 + 面板行」重算窗口几何，并同步子视图尺寸。
   *
   * 窗口高度只跟歌词带（字号 / 单行模式）与屏幕密度有关：开合面板、行数 ±、换行都不改尺寸，
   * 系统没有可动画的东西。歌词块贴在带底，行数变多时向上长进带顶部那段透明留白里。
   */
  private void updateHeights() {
    if (textView == null || panel == null || layoutParams == null) return;
    setLayoutParamsHeight();

    float controlRow = dp(CONTROL_ROW_HEIGHT_DP);
    float settingsRow = dp(SETTINGS_ROW_HEIGHT_DP);
    float widthRow = dp(LyricControlPanel.WIDTH_ROW_HEIGHT_DP);
    float rows = controlRow + settingsRow + widthRow;

    // 窗口高度 = 固定歌词带 + 全部面板行：开合面板、行数 ±、换行都不改尺寸。
    float total = bandHeight + rows;
    // 换行时整体只上移一行（逐行滚动），不是整屏从底部涌上来
    textView.setAnimaDistance(oneLineHeight());
    layoutParams.height = Math.round(total);

    // 歌词块贴在带的底部（紧挨面板），带上面多出来的空间是透明的：
    // 行数变多时歌词块向上长，面板和窗口都不动。
    int contentTop = Math.max(0, Math.round(bandHeight - lyricHeight));
    lyricContentTop = contentTop;

    // 这里不夹取窗口位置：行数 / 字号重排时窗口一移动就会被系统补一段移动动画。
    // 位置只在拖动和按百分比还原时夹（clampPosition），歌词块顶边可以越过屏幕上沿。

    if (layoutParams.width > 0) {
      // 歌词视图的高度固定为「歌词区高度」：多行歌词需要足够的绘制区域，
      // 同时它不能跟着文字行数变化，否则每句歌词都会让布局变大变小、打断触摸序列。
      // 多行超出歌词区时按歌词区裁切，不会压到相邻的控制行。
      FrameLayout.LayoutParams textLp = (FrameLayout.LayoutParams) textView.getLayoutParams();
      if (textLp != null) {
        textLp.width = layoutParams.width;
        textLp.height = Math.round(lyricHeight);
        textLp.topMargin = lyricContentTop;
        textView.setLayoutParams(textLp);
      }
      // 歌词视图的高度就是歌词块高度，本来就不需要额外的裁剪；
      // 之前按窗口坐标设过裁剪，坐标换算到视图内等于把整块裁没了
      textView.setClipBounds(null);
      FrameLayout.LayoutParams panelLp = (FrameLayout.LayoutParams) panel.getLayoutParams();
      if (panelLp != null) {
        panelLp.width = layoutParams.width;
        panelLp.height = layoutParams.height;
        panel.setLayoutParams(panelLp);
      }
      textView.setWidth(layoutParams.width);
      textView.setHeight(Math.round(lyricHeight));
      textView.requestLayout();
      // 面板内部按「透明留白 → 歌词块 → 控制行 → 设置行 → 宽度条」的实际像素排布，
      // 行高随屏幕密度换算，手机 / 平板都按同一套比例走
      panel.setLayout(contentTop, lyricHeight, controlRow, settingsRow, widthRow);
      panel.setWidthPercent(Math.round(widthPercentage * 100));
    }

    // 只在尺寸真的变了才提交：同样的宽高反复 updateViewLayout 会让悬浮窗闪烁
    int newW = layoutParams.width;
    int newH = layoutParams.height;
    int newX = layoutParams.x;
    int newY = layoutParams.y;
    boolean changed = newW != lastAppliedWidth || newH != lastAppliedHeight
      || newX != lastAppliedX || newY != lastAppliedY;
    lastAppliedWidth = newW;
    lastAppliedHeight = newH;
    lastAppliedX = newX;
    lastAppliedY = newY;
    // 主窗永远不吃触摸：整块交给透明的触摸小窗，歌词带之外的空白才能点穿到桌面
    layoutParams.flags = getLayoutParamsFlags();
    syncTouchLayer();
    if (changed && container != null && container.getParent() != null) {
      commitWindowGeometry(true);
    }
  }

  /** 触摸只由透明小窗接收：主窗始终不可点，歌词带之外的空白不会挡住桌面 */
  private void applyTouchFlags() {
    if (layoutParams == null || windowManager == null || container == null) return;
    layoutParams.flags = getLayoutParamsFlags();
    syncTouchLayer();
  }
  /**
   * 触摸小窗贴着「歌词块」，面板展开时向下盖住面板行。
   * 它是一层全透明的窗口，尺寸变化没有可见动画，所以可以随便跟随内容。
   */
  private void syncTouchLayer() {
    if (touchLayer == null || touchParams == null || windowManager == null || layoutParams == null) return;
    touchParams.width = layoutParams.width;
    touchParams.height = Math.round(lyricHeight) +
      (isPanelVisible ? Math.round(panelRowsPx()) : 0);
    touchParams.x = layoutParams.x;
    touchParams.y = layoutParams.y + lyricContentTop;
    int base = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
      WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
      WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
    if (isLock || !isTouchable) base |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
    touchParams.flags = base;
    if (touchLayer.getParent() == null) {
      try { windowManager.addView(touchLayer, touchParams); } catch (Exception ignored) { }
    } else {
      try {
        windowManager.updateViewLayout(touchLayer, touchParams);
      } catch (Exception e) {
        // 个别 ROM 上触摸小窗的窗口 token 会失效，update 静默失败后它会停在旧尺寸：
        // 面板收起后小窗还盖着面板那一块，表现就是「原来面板位置点不到下面的图标」。
        // 失败时直接移除重加，保证尺寸和面板状态一致。
        Log.e("Lyric", "touch layer update failed, re-adding: " + e.getMessage());
        try { windowManager.removeView(touchLayer); } catch (Exception ignored) { }
        try { windowManager.addView(touchLayer, touchParams); } catch (Exception ignored) { }
      }
    }
  }

  /** 上一次真正提交给窗口管理器的几何，用来跳过无变化的重排（避免闪动） */

  /**
   * 一次提交窗口几何，并在提交前后保持画面连续。
   *
   * 只调用 updateViewLayout 会先让 WMS 应用新尺寸，子视图要等下一帧才重绘，
   * 中间那一帧就是「窗口变大但面板还没画」的空档，也就是闪一下。
   * 这里在提交前先把面板按新尺寸量好并标记重绘，提交后立刻请求一次同步绘制。
   */
  private void commitWindowGeometry(boolean changed) {
    if (!changed) return;
    if (container == null || container.getParent() == null) return;
    // 关键：在 WMS 应用新尺寸之前，先把容器与面板按新尺寸排好并标脏。
    // 这样窗口变大后的第一次绘制就已经带着完整的面板内容，
    // 不会出现「窗口先变高、面板下一帧才画」的空白闪动。
    int w = layoutParams.width;
    int h = layoutParams.height;
    // 歌词视图只能按「歌词区」高度量与摆：它的文字是垂直居中的，
    // 一旦按整个窗口高度（含面板行）布局，文字就整体下移并被裁掉一行，
    // 而容器尺寸没变时 FrameLayout 会跳过 onLayout，这个错位会一直留到下次重排，
    // 表现就是面板开合时歌词「闪一下」。
    int lyricH = Math.round(lyricHeight);
    int contentTop = lyricContentTop;
    if (textView != null) {
      textView.measure(
        View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(lyricH, View.MeasureSpec.EXACTLY));
      textView.layout(0, contentTop, w, contentTop + lyricH);
      textView.invalidate();
    }
    if (panel != null && panel.getVisibility() == View.VISIBLE) {
      panel.measure(
        View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
      panel.layout(0, 0, w, h);
      panel.invalidate();
    }
    container.measure(
      View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
    container.layout(0, 0, w, h);
    windowManager.updateViewLayout(container, layoutParams);
    probeNegativeY();
  }

  /**
   * 检查「负的窗口 y 有没有被系统夹住」。
   *
   * 只有窗口越出屏幕上沿（y < 0）时才需要检查：等 WMS 应用完位置后读一次
   * 视图在屏幕上的真实位置，和期望值对不上就说明这个 ROM 不允许负 y，
   * 切到兼容模式重排一次（带高 = 当前歌词块，窗口退回原来的行为）。
   * 正常 ROM 上这段只会在贴顶时跑一两次，且不产生任何变化。
   */
  private void probeNegativeY() {
    if (noNegativeY || yClampProbeInFlight) return;
    if (layoutParams == null || container == null || container.getParent() == null) return;
    if (layoutParams.y >= 0) return;
    yClampProbeInFlight = true;
    container.postDelayed(() -> {
      yClampProbeInFlight = false;
      if (noNegativeY || layoutParams == null || container == null) return;
      if (layoutParams.y >= 0) return;
      int[] loc = new int[2];
      container.getLocationOnScreen(loc);
      // 期望 y 为负，实际被抬到 0（或明显更靠下）＝ 系统夹了
      if (loc[1] > layoutParams.y + 2) {
        // 先按「歌词块顶边」把窗口落位（兼容模式 contentTop 恒为 0），再重排，
        // 避免中间出现一帧歌词跑到屏幕外的残影
        int stripTop = layoutParams.y + lyricContentTop;
        noNegativeY = true;
        layoutParams.y = Math.max(0, stripTop);
        updateHeights();
        fixViewPosition();
        try {
          windowManager.updateViewLayout(container, layoutParams);
        } catch (Exception ignored) { }
      }
    }, 120);
  }

  private int lastAppliedWidth = -1;
  private int lastAppliedHeight = -1;
  private int lastAppliedX = Integer.MIN_VALUE;
  private int lastAppliedY = Integer.MIN_VALUE;

  /** 歌词块在窗口内的起点 y：固定歌词带顶部那段透明留白的高度 */
  private int lyricContentTop = 0;

  private void updateViewPosition() {
    if (container == null || layoutParams == null || windowManager == null) return;
    updateWH();
    layoutParams.width = (int) (maxWidth * widthPercentage);
    // 密度变化（改 dpi、折叠屏展开、投屏）后 SP 必须重新换算成 px，否则字号会沿用
    // 旧屏幕的像素值；清掉缓存值强制下发一次
    appliedTextSize = -1f;
    applySingleLineTextSize();
    updateHeights();
    fixViewPosition();
    windowManager.updateViewLayout(container, layoutParams);
    probeNegativeY();
  }

  /**
   * 歌词区左右留白：歌词视图仍是整窗宽度、按窗口居中，
   * 只把文字可用宽度收窄一点，避免长句压到面板左上角的音符和右上角的关闭。
   */
  private int textInset() {
    int inset = Math.round(dp(LYRIC_TEXT_INSET_DP));
    // 窗口被宽度滑块拉到很窄时（10% ≈ 36dp），固定 40dp 的内缩会把可用宽度算成负数，
    // 单行缩字会直接跳过、文字溢出窗口。这里让内缩最多占窗口宽度的 1/6。
    if (layoutParams == null || layoutParams.width <= 0) return inset;
    return Math.min(inset, Math.max(0, layoutParams.width / 6));
  }

  private void fixViewPosition() {
    if (layoutParams == null) return;
    int maxX = maxWidth - layoutParams.width;
    int x = (int) (maxWidth * prevViewPercentageX);
    if (x < 0) x = 0;
    else if (x > maxX) x = maxX;
    layoutParams.x = x;

    // 百分比记的是「歌词块顶边」的屏幕位置；窗口顶边在它上面 contentTop 处，
    // 所以这里先按百分比还原歌词块顶边，再倒推窗口位置
    int maxStripTop = Math.max(0, maxHeight - Math.round(lyricHeight + panelRowsPx()));
    int stripTop = Math.round(maxHeight * prevViewPercentageY);
    if (stripTop < 0) stripTop = 0;
    else if (stripTop > maxStripTop) stripTop = maxStripTop;
    layoutParams.y = stripTop - lyricContentTop;
    clampPosition();
    // 这里会改窗口位置，触摸小窗必须跟着挪，否则换分辨率 / 旋转后点击区会留在旧位置
    syncTouchLayer();
  }

  public void sendPositionEvent(float x, float y) {
    if (lyricEvent == null) return;
    WritableMap params = Arguments.createMap();
    params.putDouble("x", x);
    params.putDouble("y", y);
    lyricEvent.sendEvent(lyricEvent.SET_VIEW_POSITION, params);
  }

  /**
   * 左上角 App 图标：把 App 切到前台。
   * 悬浮窗来自 Service 上下文，必须带 NEW_TASK；没有启动入口时静默失败。
   */
  private void openApp() {
    try {
      android.content.Intent intent = reactContext.getPackageManager()
        .getLaunchIntentForPackage(reactContext.getPackageName());
      if (intent == null) return;
      intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
      reactContext.startActivity(intent);
    } catch (Exception e) {
      Log.e("Lyric", "openApp failed: " + e.getMessage());
    }
  }

  private void sendActionEvent(String action, String value) {
    sendActionEvent(action, value, null);
  }

  private void sendActionEvent(String action, String value, String extra) {
    if (lyricEvent == null) return;
    WritableMap params = Arguments.createMap();
    params.putString("action", action);
    if (value != null) params.putString("value", value);
    if (extra != null) params.putString("shadow", extra);
    lyricEvent.sendEvent(lyricEvent.DESKTOP_LYRIC_ACTION, params);
  }

  public void showLyricView(Bundle options) {
    isLock = options.getBoolean("isLock", isLock);
    isSingleLine = options.getBoolean("isSingleLine", isSingleLine);
    isShowToggleAnima = options.getBoolean("isShowToggleAnima", isShowToggleAnima);
    unplayColor = options.getString("unplayColor", unplayColor);
    playedColor = options.getString("playedColor", playedColor);
    shadowColor = options.getString("shadowColor", shadowColor);
    prevViewPercentageX = (float) options.getDouble("lyricViewX", 0f) / 100f;
    prevViewPercentageY = (float) options.getDouble("lyricViewY", 0f) / 100f;
    alpha = (float) options.getDouble("alpha", alpha);
    textSize = (float) options.getDouble("textSize", textSize);
    widthPercentage = (float) options.getDouble("width", 100) / 100f;
    maxLineNum = (int) options.getDouble("maxLineNum", maxLineNum);
    unplayColorInt = parseColor(unplayColor);
    playedColorInt = parseColor(playedColor);
    isPanelVisible = false;
    isSettingsVisible = false;
    handleShowLyric();
    listenOrientationEvent();
  }

  public void showLyricView() {
    try {
      handleShowLyric();
    } catch (Exception e) {
      Log.e("Lyric", e.getMessage());
      return;
    }
    listenOrientationEvent();
  }

  public static int parseColor(String input) {
    if (input == null || input.isEmpty()) return Color.WHITE;
    if (input.startsWith("#")) return Color.parseColor(input);
    Pattern c = Pattern.compile("rgba? *\\( *(\\d+), *(\\d+), *(\\d+)(?:, *([\\d.]+))? *\\)");
    Matcher m = c.matcher(input);
    if (m.matches()) {
      int red = Integer.parseInt(m.group(1));
      int green = Integer.parseInt(m.group(2));
      int blue = Integer.parseInt(m.group(3));
      return Color.rgb(red, green, blue);
    }
    try {
      return Color.parseColor(input);
    } catch (Exception ignored) {
      return Color.parseColor("#000000");
    }
  }

  private void createViews() {
    appliedTextSize = -1f;
    textView = new LyricSwitchView(reactContext, isSingleLine, isShowToggleAnima);
    textView.setText("");
    textView.setTextColor(isSingleLine ? playedColorInt : unplayColorInt);
    textView.setShadowColor(parseColor(shadowColor));
    textView.setAlpha(alpha);
    textView.setTextSize(textSize);
    appliedTextSize = textSize;
    textView.setGravity(Gravity.CENTER);
    if (!isSingleLine) textView.setMaxLines(maxLineNum);

    panel = new LyricControlPanel(reactContext);
    panel.setActionListener(this::handlePanelAction);
    panel.setPlayedColor(playedColorInt);
    panel.setPlaying(isPlaying);
    panel.setLocked(isLock);
    panel.setSingleLineMode(isSingleLine);
    panel.setSettingsVisible(false);
    panel.setVisibility(View.GONE);

    container = new FrameLayout(reactContext);
    // 面板在下、歌词在上：面板整块有底色，歌词必须叠在它上面才看得见；
    // 歌词视图被裁到歌词区内，不会画到控制行上
    container.addView(panel, new FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT));
    container.addView(textView, new FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT));
    // 【双窗】主窗恒定不可点，触摸全部交给下面这层透明小窗
    touchLayer = new View(reactContext);
    touchLayer.setOnTouchListener(this);
    touchParams = new WindowManager.LayoutParams();
    touchParams.type = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ?
      WindowManager.LayoutParams.TYPE_SYSTEM_ALERT : WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
    touchParams.gravity = Gravity.TOP | Gravity.START;
    touchParams.format = PixelFormat.TRANSPARENT;
  }

  private void handleShowLyric() {
    if (windowManager == null) {
      windowManager = (WindowManager) reactContext.getSystemService(Context.WINDOW_SERVICE);
      layoutParams = new WindowManager.LayoutParams();
    }

    // 悬浮窗只有一个：重新显示时先把旧的（主窗 + 触摸小窗）移除，避免重复 addView
    if (container != null) {
      try {
        windowManager.removeView(container);
      } catch (Exception ignored) { /* 已经被移除 */ }
    }
    if (touchLayer != null && touchLayer.getParent() != null) {
      try {
        windowManager.removeView(touchLayer);
      } catch (Exception ignored) { /* 已经被移除 */ }
    }

    createViews();

    layoutParams.type = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ?
      WindowManager.LayoutParams.TYPE_SYSTEM_ALERT :
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
    // 【双窗】主窗（歌词+面板）默认不可点：面板收起时它虽然铺着，但不吃触摸
    layoutParams.flags = getLayoutParamsFlags();
    layoutParams.alpha = 1.0f;
    layoutParams.gravity = Gravity.TOP | Gravity.START;

    updateWH();

    layoutParams.width = (int) (maxWidth * widthPercentage);
    layoutParams.x = (int) (maxWidth * prevViewPercentageX);
    layoutParams.y = (int) (maxHeight * prevViewPercentageY);
    layoutParams.format = PixelFormat.TRANSPARENT;

    applySingleLineTextSize();
    updateHeights();
    fixViewPosition();

    if (!isConfigCallbacksRegistered) {
      reactContext.registerComponentCallbacks(configCallbacks);
      isConfigCallbacksRegistered = true;
    }

    windowManager.addView(container, layoutParams);
  }

  public void setLyric(String text, ArrayList<String> extendedLyrics, ArrayList<String> followingLyrics) {
    currentLyric = text == null ? "" : text;
    currentExtendedLyrics = extendedLyrics == null ? new ArrayList<>() : extendedLyrics;
    currentFollowingLyrics = followingLyrics == null ? new ArrayList<>() : followingLyrics;
    if (textView == null) return;
    applySingleLineTextSize();
    // 高度是直接量当前子 TextView 的，量之前文本必须已经是这一句
    int before = Math.round(lyricHeight);
    measuredContentHeight = 0;
    textView.setText(buildLyricText());
    setLayoutParamsHeight();
    // 行数变化（有翻译 / 没翻译）时歌词区高度要跟着调，窗口只向下长，
    // 顶部歌词区起点不动，所以歌词在屏幕上的位置不受影响
    if (Math.round(lyricHeight) != before) updateHeights();
    // TextView 的排版要等下一帧才完成，排完再按真实高度校正一次，
    // 保证多行歌词的最后一行完整落在歌词区内
    textView.post(this::fitLyricHeightToContent);
  }

  /** 单行行高（像素）：换行滚动只走一行，按当前字号与屏幕密度实时计算 */
  private float oneLineHeight() {
    if (textView == null) return dp(24);
    TextPaint paint = textView.getPaint();
    if (paint == null) return dp(24);
    int lineHeight = paint.getFontMetricsInt(null);
    return lineHeight > 0 ? lineHeight : dp(24);
  }

  /**
   * 单行模式下让整句歌词正好放进一行：
   * 放得下就用用户设定的字号原样显示，放不下才按宽度等比缩小（有下限）。
   * 多行模式不处理，走原来的换行 / 截断逻辑。
   *
   * 每次都先把字号重置成基准值再量，否则每换一句都会在上一次缩小后的
   * 结果上继续缩，越唱越小。
   */
  private void applySingleLineTextSize() {
    if (textView == null || layoutParams == null) return;
    if (!isSingleLine) {
      setTextSizeIfChanged(textSize);
      return;
    }
    TextPaint paint = textView.getPaint();
    if (paint == null) return;
    String text = currentLyric == null ? "" : currentLyric;
    int available = layoutParams.width - textInset() * 2;
    float target = textSize;
    if (!text.isEmpty() && available > 0) {
      // 量之前必须是基准字号，否则量到的是上一句缩小后的结果
      setTextSizeIfChanged(textSize);
      float measured = paint.measureText(text);
      if (measured > available) {
        // textSize 的单位是 sp，缩放比例是无量纲的，所以结果仍是 sp；下限也必须是 sp
        target = Math.max(8f, textSize * available / measured);
      }
    }
    setTextSizeIfChanged(target);
  }

  /**
   * 只在字号真的变了才下发。
   * 每换一句歌词都会走一次排版，重复 setTextSize 会白触发一次 requestLayout。
   */
  private void setTextSizeIfChanged(float sp) {
    if (Math.abs(sp - appliedTextSize) < 0.01f) return;
    appliedTextSize = sp;
    textView.setTextSize(sp);
  }

  /** 按歌词视图真实排版高度校正歌词块高度（只增不减，且不超过固定带的容量） */
  private void fitLyricHeightToContent() {
    if (textView == null || layoutParams == null) return;
    int contentHeight = Math.round(textView.getContentHeight());
    if (contentHeight <= 0) return;
    if (contentHeight <= Math.round(lyricHeight)) return;
    measuredContentHeight = contentHeight;
    updateHeights();
  }

  /**
   * 当前行 + 翻译（已播放色），后面跟下一句（未播放色）。
   * 有翻译时和网易云一致，只显示「原文 + 翻译」，不再追加下一句。
   */
  private CharSequence buildLyricText() {
    ArrayList<String> lines = new ArrayList<>();
    int playedCount = 0;
    if (!currentLyric.isEmpty()) {
      lines.add(currentLyric);
      playedCount++;
    }
    if (!isSingleLine) {
      if (!currentExtendedLyrics.isEmpty()) {
        for (String line : currentExtendedLyrics) {
          if (line != null && !line.isEmpty()) {
            lines.add(line);
            playedCount++;
          }
        }
      } else {
        for (String line : currentFollowingLyrics) {
          if (line != null && !line.isEmpty()) lines.add(line);
        }
      }
      int limit = Math.max(1, maxLineNum);
      while (lines.size() > limit) lines.remove(lines.size() - 1);
      if (playedCount > lines.size()) playedCount = lines.size();
    }

    if (lines.isEmpty()) return "";

    StringBuilder builder = new StringBuilder();
    for (int i = 0; i < lines.size(); i++) {
      if (i > 0) builder.append('\n');
      builder.append(lines.get(i));
    }

    SpannableString lyric = new SpannableString(builder.toString());
    int start = 0;
    for (int i = 0; i < lines.size(); i++) {
      int end = start + lines.get(i).length();
      if (i < playedCount) {
        lyric.setSpan(new ForegroundColorSpan(playedColorInt), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
      }
      start = end + 1;
    }
    return lyric;
  }

  public void setPlaying(boolean playing) {
    isPlaying = playing;
    if (panel != null) panel.setPlaying(playing);
  }

  private void showPanel() {
    if (isLock || !isTouchable || panel == null) return;
    // 窗口尺寸是固定的，展开 / 收起都不动几何，歌词自然停在原处
    isPanelVisible = true;
    isSettingsVisible = false;
    panel.setSettingsVisible(false);
    panel.setVisibility(View.VISIBLE);
    // updateHeights 里已经同步了触摸小窗（展开后要盖住面板行）
    updateHeights();
    scheduleHidePanel();
  }

  private void hidePanel() {
    panelHandler.removeCallbacks(hidePanelRunnable);
    if (!isPanelVisible) return;
    isPanelVisible = false;
    isSettingsVisible = false;
    if (panel != null) {
      // 先隐藏面板，再由 updateHeights 一次性把窗口缩回歌词区高度，
      // 避免「窗口还高着、面板已经消失」的残影
      panel.setSettingsVisible(false);
      panel.setVisibility(View.GONE);
    }
    updateHeights();
  }

  private void scheduleHidePanel() {
    panelHandler.removeCallbacks(hidePanelRunnable);
    if (!isPanelVisible) return;
    panelHandler.postDelayed(hidePanelRunnable, PANEL_AUTO_HIDE_DELAY);
  }

  private void handlePanelAction(String action, String value, String extra) {
    switch (action) {
      case "openApp":
        openApp();
        hidePanel();
        return;
      case "close":
        sendActionEvent("close", null);
        if (onCloseListener != null) onCloseListener.run();
        else destroyView();
        return;
      case "lock":
        lockView();
        sendActionEvent("lock", null);
        return;
      case "prev":
        sendActionEvent("prev", null);
        break;
      case "next":
        sendActionEvent("next", null);
        break;
      case "toggle":
        sendActionEvent("toggle", null);
        break;
      case "settings":
        isSettingsVisible = !isSettingsVisible;
        if (panel != null) panel.setSettingsVisible(isSettingsVisible);
        updateHeights();
        break;
      case "theme":
        if (value != null) {
          setColor(unplayColor, value, extra != null ? extra : shadowColor);
          sendActionEvent("theme", value, extra);
        }
        break;
      case "font+":
        changeTextSize(10);
        break;
      case "font-":
        changeTextSize(-10);
        break;
      case "line+":
        changeLineNum(1);
        break;
      case "line-":
        changeLineNum(-1);
        break;
      case "width":
        if (value != null) {
          int percent = Integer.parseInt(value);
          setWidthPercent(percent);
          sendActionEvent("width", String.valueOf(percent));
        }
        break;
    }
    scheduleHidePanel();
  }

  /** 面板里的宽度控制条：改窗口宽度，并按设置页同样的百分比落库 */
  private void setWidthPercent(int percent) {
    int clamped = Math.max(LyricControlPanel.MIN_WIDTH, Math.min(LyricControlPanel.MAX_WIDTH, percent));
    widthPercentage = clamped / 100f;
    if (panel != null) panel.setWidthPercent(clamped);
    if (textView == null || layoutParams == null || windowManager == null) return;
    int newWidth = (int) (maxWidth * widthPercentage);
    if (newWidth == layoutParams.width) return;
    layoutParams.width = newWidth;
    applyWindowWidth();
  }

  /**
   * 把当前 layoutParams.width 同步到歌词视图与面板，再更新窗口。
   *
   * 只调整宽度相关的东西（子视图宽、窗口 x），不碰字号和文本：
   * 行高与宽度无关，没必要重算；重置文本会在拖动过程中把正在滚动的歌词清空。
   */
  private void applyWindowWidth() {
    if (textView == null || panel == null || container == null) return;
    // 宽度变了，单行模式下要重新判断这句还放不放得下
    applySingleLineTextSize();
    FrameLayout.LayoutParams textLp = (FrameLayout.LayoutParams) textView.getLayoutParams();
    if (textLp != null) {
      textLp.width = layoutParams.width;
      // 歌词视图始终只占歌词块，不能跟着窗口高度（含面板行 / 留白）一起长
      textLp.height = Math.round(lyricHeight);
      textLp.topMargin = lyricContentTop;
      textView.setLayoutParams(textLp);
    }
    FrameLayout.LayoutParams panelLp = (FrameLayout.LayoutParams) panel.getLayoutParams();
    if (panelLp != null) {
      panelLp.width = layoutParams.width;
      panelLp.height = layoutParams.height;
      panel.setLayoutParams(panelLp);
    }
    textView.setWidth(layoutParams.width);
    textView.setHeight(Math.round(lyricHeight));
    // 宽度变了，窗口水平位置要按原来的百分比重新落位
    int maxX = maxWidth - layoutParams.width;
    int x = (int) (maxWidth * prevViewPercentageX);
    if (x < 0) x = 0;
    else if (x > maxX) x = maxX;
    layoutParams.x = x;
    // 同步已提交的几何，避免 updateHeights 的去重逻辑误判成「没变」而跳过刷新
    lastAppliedWidth = layoutParams.width;
    lastAppliedHeight = layoutParams.height;
    lastAppliedX = layoutParams.x;
    lastAppliedY = layoutParams.y;
    windowManager.updateViewLayout(container, layoutParams);
    // 触摸小窗要跟着变宽，否则拖宽后新露出来的那段收不到手势
    syncTouchLayer();
  }

  /** 宽度拖动结束：补一次完整重排，让文字按新宽度重新折行 */
  private void onWidthSettled() {
    if (textView == null || layoutParams == null || container == null) return;
    updateHeights();
  }

  private void changeTextSize(int delta) {
    float next = Math.max(12f, Math.min(50f, textSize + delta / 10f));
    if (next == textSize) return;
    setTextSize(next);
    sendActionEvent("fontSize", String.valueOf(Math.round(next * 10)));
  }

  /**
   * 面板上的行数加 / 减：和设置页「桌面歌词行数」同一个设置项（1~8 行），
   * 先按新行数重排窗口，再把值回传给 JS 落库。
   */
  private void changeLineNum(int delta) {
    int next = Math.max(LyricControlPanel.MIN_LINE, Math.min(LyricControlPanel.MAX_LINE, maxLineNum + delta));
    if (next == maxLineNum) return;
    setMaxLineNum(next);
    sendActionEvent("maxLineNum", String.valueOf(next));
  }

  public void setMaxLineNum(int maxLineNum) {
    this.maxLineNum = maxLineNum;
    if (textView == null) return;
    if (!isSingleLine) textView.setMaxLines(maxLineNum);
    // 先换文本再量高度：顺序反过来会用旧文本算出行高，窗口要等到下一句歌词才跟着变
    measuredContentHeight = 0;
    textView.setText(buildLyricText());
    applySingleLineTextSize();
    updateHeights();
    // 排版完成后再按真实高度兜底一次（行数变多时补足最后一行）
    textView.post(this::fitLyricHeightToContent);
  }

  public void setWidth(int width) {
    setWidthPercent(width);
  }

  /**
   * 临时开启/关闭悬浮窗触摸。
   *
   * 打开桌面歌词设置页、或 App 回到前台时关闭触摸，让点击穿透到下面的控件；
   * 离开后恢复，不改变锁定状态与外观。
   */
  public void setTouchable(boolean touchable) {
    isTouchable = touchable;
    if (!touchable) hidePanel();
    applyTouchFlags();
  }

  @Override
  public boolean onTouch(View v, MotionEvent event) {
    if (isLock || !isTouchable) return false;
    // 悬浮窗里事件会先分发给子视图，坐标随之被换算；按下 / 拖动时记一份原始屏幕坐标，
    // 面板的命中判定统一用它（面板铺满整窗，坐标系以窗口左上角为原点）。
    if (event.getAction() == MotionEvent.ACTION_DOWN || event.getAction() == MotionEvent.ACTION_MOVE) {
      downWindowX = event.getRawX();
      downWindowY = event.getRawY();
    }

    // 面板展开时，设置行下面的宽度控制条优先接管手势
    if (panel != null && panel.handleWidthTouch(event.getAction(), downWindowX, downWindowY)) {
      panelHandler.removeCallbacks(hidePanelRunnable);
      if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
        onWidthSettled();
        scheduleHidePanel();
      }
      return true;
    }

    switch (event.getAction()) {
      case MotionEvent.ACTION_DOWN:
        downX = event.getRawX();
        downY = event.getRawY();
        lastX = downX;
        lastY = downY;
        isDragging = false;
        panelHandler.removeCallbacks(hidePanelRunnable);
        break;
      case MotionEvent.ACTION_MOVE: {
        float nowX = event.getRawX();
        float nowY = event.getRawY();
        if (!isDragging) {
          if (Math.abs(nowX - downX) > touchSlop || Math.abs(nowY - downY) > touchSlop) {
            isDragging = true;
          }
        }
        if (isDragging) {
          float tranX = nowX - lastX;
          float tranY = nowY - lastY;
          int maxX = maxWidth - layoutParams.width;
          // 整窗（带 + 面板行）要留在屏幕内；窗口顶边允许越过屏幕上沿，
          // 带顶部那段留白是透明的，看不见
          int maxY = maxHeight - Math.round(bandHeight + panelRowsPx());
          int minY = -lyricContentTop;
          if (maxX < 0) maxX = 0;
          if (maxY < 0) maxY = 0;
          int x = layoutParams.x + (int) tranX;
          if (x < 0) x = 0;
          else if (x > maxX) x = maxX;
          int y = layoutParams.y + (int) tranY;
          if (y < minY) y = minY;
          else if (y > maxY) y = maxY;
          layoutParams.x = x;
          layoutParams.y = y;
          windowManager.updateViewLayout(container, layoutParams);
          // 触摸小窗要跟着走，否则拖动后点击区域会留在原地
          syncTouchLayer();
        }
        lastX = nowX;
        lastY = nowY;
        break;
      }
      case MotionEvent.ACTION_UP:
        if (isDragging) {
          isDragging = false;
          // 歌词区的屏幕位置才是位置基准：面板向上展开时窗口顶边比歌词高出一截
          // （歌词从 contentTop 处开始画），直接记窗口 y 会让收起面板后的歌词往下跳
          int lyricY = layoutParams.y + lyricContentTop;
          // 拖动结束立刻把新位置记成基准百分比：后续任何重排（展开 / 收起面板、
          // 改行数、改字号）都按这个位置恢复，否则会被旧百分比拉回原位
          float percentageX = (float) layoutParams.x / (float) maxWidth * 100f;
          float percentageY = (float) lyricY / (float) maxHeight * 100f;
          prevViewPercentageX = percentageX / 100f;
          prevViewPercentageY = percentageY / 100f;
          sendPositionEvent(percentageX, percentageY);
        } else {
          // 面板坐标以窗口左上角为原点，而事件给的是屏幕坐标：x、y 都要减掉窗口偏移。
          // 只减 y 的话，歌词一旦被拖离左边缘，面板上所有控件都会判定成「没命中」而收不到点击
          float winX = layoutParams != null ? layoutParams.x : 0;
          float winY = layoutParams != null ? layoutParams.y : 0;
          handleTap(downWindowX - winX, downWindowY - winY);
        }
        if (isPanelVisible) scheduleHidePanel();
        // 拖到贴近屏幕上沿时，顺带检查负 y 是否被系统夹住（每帧查会太吵，松手查一次）
        probeNegativeY();
        break;
    }
    return true;
  }

  private void handleTap(float x, float y) {
    if (!isPanelVisible) {
      showPanel();
      return;
    }
    // 先交给面板判定：关闭 X 和 App 图标都落在歌词区高度内，
    // 必须先命中控件，否则会被下面「点歌词区收起面板」的逻辑吃掉。
    // 坐标已换算成窗口坐标，与面板坐标系一致。
    if (panel != null) {
      if (panel.handleTouch(x, y)) return;
    }
    hidePanel();
  }

  public void lockView() {
    isLock = true;
    if (panel != null) panel.setLocked(true);
    hidePanel();
    applyTouchFlags();
  }

  public void unlockView() {
    isLock = false;
    if (panel != null) panel.setLocked(false);
    applyTouchFlags();
  }

  public void setColor(String unplayColor, String playedColor, String shadowColor) {
    this.unplayColor = unplayColor;
    this.playedColor = playedColor;
    this.shadowColor = shadowColor;
    unplayColorInt = parseColor(unplayColor);
    playedColorInt = parseColor(playedColor);
    if (textView == null) return;
    textView.setTextColor(isSingleLine ? playedColorInt : unplayColorInt);
    textView.setShadowColor(parseColor(shadowColor));
    if (panel != null) panel.setPlayedColor(playedColorInt);
    textView.setSourceText(buildLyricText());
  }

  public void setAlpha(float alpha) {
    this.alpha = alpha;
    if (textView == null) return;
    textView.setAlpha(alpha);
  }

  public void setSingleLine(boolean isSingleLine) {
    this.isSingleLine = isSingleLine;
    if (panel != null) panel.setSingleLineMode(isSingleLine);
    if (windowManager == null || layoutParams == null) return;
    if (container != null) {
      try {
        windowManager.removeView(container);
      } catch (Exception ignored) { }
    }
    createViews();
    updateWH();
    layoutParams.width = (int) (maxWidth * widthPercentage);
    applySingleLineTextSize();
    updateHeights();
    fixViewPosition();
    windowManager.addView(container, layoutParams);
    textView.setText(buildLyricText());
  }

  public void setShowToggleAnima(boolean isShowToggleAnima) {
    this.isShowToggleAnima = isShowToggleAnima;
    if (textView == null) return;
    textView.setShowAnima(isShowToggleAnima);
  }

  public void setTextSize(float textSize) {
    this.textSize = textSize;
    if (textView == null) return;
    applySingleLineTextSize();
    updateHeights();
  }

  /** 设置页改了行数：和面板上的「行数 ±」走同一条重排路径 */
  public void setMaxLineNum() {
    setMaxLineNum(maxLineNum);
  }

  public void setPlayedColor(String unplayColor, String playedColor, String shadowColor) {
    setColor(unplayColor, playedColor, shadowColor);
    if (textView == null) return;
    textView.setSourceText(buildLyricText());
  }

  public void destroyView() {
    removeOrientationEvent();
    panelHandler.removeCallbacks(hidePanelRunnable);
    if (container != null && windowManager != null) {
      try {
        windowManager.removeView(container);
      } catch (Exception ignored) { }
    }
    if (touchLayer != null && windowManager != null && touchLayer.getParent() != null) {
      try {
        windowManager.removeView(touchLayer);
      } catch (Exception ignored) { }
    }
    touchLayer = null;
    container = null;
    textView = null;
    panel = null;
  }

  public void destroy() {
    destroyView();
    if (isConfigCallbacksRegistered) {
      reactContext.unregisterComponentCallbacks(configCallbacks);
      isConfigCallbacksRegistered = false;
    }
    windowManager = null;
    layoutParams = null;
  }
}
