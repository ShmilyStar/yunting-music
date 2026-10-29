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
  private float lyricHeight = 0;

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

  private int getLayoutParamsFlags(boolean touchable) {
    int flag = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
      WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
      WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;


    if (!touchable || isLock || !isTouchable) {
      flag = flag | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
    }

    return flag;
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

    // 高度直接量「真正负责绘制的那个 TextView」：它是唯一和实际渲染完全一致的东西。
    //
    // 踩过的两个坑：按「逻辑行数 × 行高」估算会漏掉英文折行；StaticLayout 自算
    // 又和 TextView 的行距/内边距口径差几像素，表现为最后一行被裁。
    // 这里直接 measure 当前子 TextView（宽 EXACTLY、高 UNSPECIFIED）。
    // 注意：子 TextView 被 setHeight 钉过高度，直接 measure 只会拿回那个旧值，
    // 必须先解绑，量完再放回去（后面 updateHeights 会重新钉）。
    int availableWidth = layoutParams == null ? 0 : layoutParams.width;
    int height = 0;
    android.widget.TextView measured = (android.widget.TextView) textView.getCurrentView();
    if (availableWidth > 0 && measured != null) {
      int pinned = measured.getHeight();
      if (pinned > 0) measured.setHeight(-1);
      measured.measure(
        android.view.View.MeasureSpec.makeMeasureSpec(availableWidth, android.view.View.MeasureSpec.EXACTLY),
        android.view.View.MeasureSpec.makeMeasureSpec(0, android.view.View.MeasureSpec.UNSPECIFIED));
      height = measured.getMeasuredHeight();
      if (pinned > 0) measured.setHeight(pinned);
    }
    if (height <= 0) {
      int lines = isSingleLine ? 1 : Math.max(1, Math.min(maxLineNum, Math.max(1, countLyricLines())));
      int fm = paint.getFontMetricsInt(null);
      height = Math.round(fm * 1.18f) * lines + verticalPadding * 2;
    }
    if (height > maxHeight - 100) height = maxHeight - 100;
    if (height < 1) height = 1;
    lyricHeight = height;
  }

  /** 当前歌词实际会显示的行数（原句 + 翻译 / 下一句），用于按内容收高歌词区 */
  private int countLyricLines() {
    int count = currentLyric.isEmpty() ? 0 : 1;
    if (isSingleLine) return Math.max(1, count);
    if (!currentExtendedLyrics.isEmpty()) {
      for (String line : currentExtendedLyrics) {
        if (line != null && !line.isEmpty()) count++;
      }
    } else {
      for (String line : currentFollowingLyrics) {
        if (line != null && !line.isEmpty()) count++;
      }
    }
    return Math.max(1, Math.min(Math.max(1, maxLineNum), count));
  }

  private void clampPosition() {
    if (layoutParams == null) return;
    int maxX = maxWidth - layoutParams.width;
    if (maxX < 0) maxX = 0;
    if (layoutParams.x < 0) layoutParams.x = 0;
    else if (layoutParams.x > maxX) layoutParams.x = maxX;

    // 纵向只按「歌词区」的高度约束：面板展开只是临时占位，
    // 用整个窗口高度去夹会把歌词推走
    int maxY = maxHeight - Math.round(lyricHeight + panelRowsPx());
    if (maxY < 0) maxY = 0;
    if (layoutParams.y < 0) layoutParams.y = 0;
    else if (layoutParams.y > maxY) layoutParams.y = maxY;
  }

  /**
   * 按当前「歌词区 + 控制行 + 设置行」重新计算窗口高度，并同步子视图尺寸。
   * 面板展开时窗口长高，但歌词区的屏幕位置一定不动。
   */
  private void updateHeights() {
    if (textView == null || panel == null || layoutParams == null) return;
    setLayoutParamsHeight();

    // 默认排法：顶部是歌词区，下面依次是控制行、设置行、宽度条。
    // 歌词靠近屏幕底部、下面放不下时整块翻到歌词上方（panelAbove），行序镜像：
    // 自上而下是宽度条 → 设置行 → 控制行 → 歌词区。
    // 两种排法都不许动歌词的屏幕位置：一动，面板开合就成了「闪一下」。
    // 注意这里也不压缩歌词区：压缩会让歌词在展开时跳位，宁可让窗口超出屏幕底部。
    // 【双窗】窗口高度固定为「歌词区 + 全部面板行」：开合面板不再改尺寸。
    // 面板收起时主窗整块不可点（见 updateHeights 末尾），由触摸小窗接住歌词带的点击。
    float controlRow = dp(CONTROL_ROW_HEIGHT_DP);
    float settingsRow = dp(SETTINGS_ROW_HEIGHT_DP);
    float widthRow = dp(LyricControlPanel.WIDTH_ROW_HEIGHT_DP);
    float rows = controlRow + settingsRow + widthRow;

    float total = lyricHeight + rows;
    // 换行时整体只上移一行（逐行滚动），不是整屏从底部涌上来
    textView.setAnimaDistance(oneLineHeight());
    layoutParams.height = Math.round(total);

    clampPosition();

    // 歌词区在屏幕上的位置：展开前记下的位置优先，没记就用当前窗口位置
    int lyricAnchor = isPanelVisible && lyricTopBeforePanel != Integer.MIN_VALUE
      ? lyricTopBeforePanel : layoutParams.y;
    int lyricMaxY = Math.max(0, maxHeight - Math.round(lyricHeight + panelRowsPx()));
    if (lyricAnchor < 0) lyricAnchor = 0;
    else if (lyricAnchor > lyricMaxY) lyricAnchor = lyricMaxY;

    // 面板永远在歌词下方：位置一旦翻转，窗口就要整体上移，系统会补一段移动动画 = 闪。
    // 代价是歌词不能拖到贴着屏幕底边（下面要留给面板），拖动与落位都按 panelRowsPx() 预留。
    panelAbove = false;
    lyricContentTop = 0;
    layoutParams.y = lyricAnchor;

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
      android.graphics.Rect clip = new android.graphics.Rect(0, 0, layoutParams.width, Math.round(lyricHeight));
      textView.setClipBounds(clip);
      FrameLayout.LayoutParams panelLp = (FrameLayout.LayoutParams) panel.getLayoutParams();
      if (panelLp != null) {
        panelLp.width = layoutParams.width;
        panelLp.height = layoutParams.height;
        panel.setLayoutParams(panelLp);
      }
      textView.setWidth(layoutParams.width);
      textView.setHeight(Math.round(lyricHeight));
      textView.requestLayout();
      panel.setLyricHeight(lyricHeight);
      // 面板内部按「歌词区 → 控制行 → 设置行 → 宽度条」的实际像素排布（向上展开时镜像），
      // 行高随屏幕密度换算，手机 / 平板都按同一套比例走
      panel.setLayout(lyricHeight, controlRow, settingsRow, widthRow);
      panel.setAbove(panelAbove);
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
    // 主窗只有在面板展开时才吃触摸；收起时让触摸小窗接管歌词带，其余位置点穿
    layoutParams.flags = getLayoutParamsFlags(isPanelVisible);
    syncTouchLayer();
    if (changed && container != null && container.getParent() != null) {
      commitWindowGeometry(true);
    }
  }

  /**
   * 按「面板是否展开」重新分配触摸：
   *   展开 → 主窗可点（歌词 + 面板都能操作），小窗退场；
   *   收起 → 主窗不可点（不挡桌面），小窗只覆盖歌词带负责点击 / 拖动。
   * 两者尺寸都不变，所以不会有窗口尺寸动画。
   */
  private void applyTouchFlags() {
    if (layoutParams == null || windowManager == null || container == null) return;
    layoutParams.flags = getLayoutParamsFlags(isPanelVisible);
    try { windowManager.updateViewLayout(container, layoutParams); } catch (Exception ignored) { }
    syncTouchLayer();
  }
  /** 触摸小窗始终贴着歌词带；面板展开时它自己变成不可点，避免和主窗抢事件 */
  private void syncTouchLayer() {
    if (touchLayer == null || touchParams == null || windowManager == null || layoutParams == null) return;
    touchParams.width = layoutParams.width;
    touchParams.height = Math.round(lyricHeight);
    touchParams.x = layoutParams.x;
    touchParams.y = layoutParams.y;
    int base = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
      WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
      WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
    if (isPanelVisible || isLock || !isTouchable) base |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
    touchParams.flags = base;
    if (touchLayer.getParent() == null) {
      try { windowManager.addView(touchLayer, touchParams); } catch (Exception ignored) { }
    } else {
      try { windowManager.updateViewLayout(touchLayer, touchParams); } catch (Exception ignored) { }
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
  }

  private int lastAppliedWidth = -1;
  private int lastAppliedHeight = -1;
  private int lastAppliedX = Integer.MIN_VALUE;
  private int lastAppliedY = Integer.MIN_VALUE;

  /**
   * 面板展开 / 收起时保持歌词位置不变。
   *
   * 面板展开会让窗口向下长高，靠近屏幕底部时 clampPosition 会把窗口整体往上推，
   * 歌词就跟着挪了。这里在展开前记下歌词的屏幕位置，收起后按记录位置还原。
   */
  private int lyricTopBeforePanel = Integer.MIN_VALUE;

  /** 面板排在歌词上方（歌词下面放不下）还是下方 */
  private boolean panelAbove = false;
  /** 歌词区在窗口内的起点 y：向上展开时它等于面板那几行的高度，其余情况为 0 */
  private int lyricContentTop = 0;

  private void updateViewPosition() {
    if (container == null || layoutParams == null || windowManager == null) return;
    updateWH();
    layoutParams.width = (int) (maxWidth * widthPercentage);
    // 密度变化后 SP 需要重新换算成 px，否则字号会沿用旧屏幕的像素值；
    // 单行模式下还要按新宽度重新判断是否需要缩小
    applySingleLineTextSize();
    updateHeights();
    fixViewPosition();
    windowManager.updateViewLayout(container, layoutParams);
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

    // 面板展开时不要按百分比重算 y：此时窗口高度包含面板，按旧的百分比算会跳位 / 闪动，
    // 位置由 updateHeights 里记录的展开前 y 或拖动结果决定
    if (isPanelVisible && lyricTopBeforePanel != Integer.MIN_VALUE) {
      layoutParams.y = lyricTopBeforePanel - lyricContentTop;
      return;
    }
    int maxY = maxHeight - Math.round(lyricHeight + panelRowsPx());
    int y = (int) (maxHeight * prevViewPercentageY);
    if (y < 0) y = 0;
    else if (y > maxY) y = maxY;
    layoutParams.y = y;
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
    container.setOnTouchListener(this);
    // 【双窗】透明触摸小窗：只覆盖歌词带，收起面板时由它接点击/拖动
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

    // 悬浮窗只有一个：重新显示时先把旧的移除，避免重复 addView
    if (container != null) {
      try {
        windowManager.removeView(container);
      } catch (Exception ignored) { /* 已经被移除 */ }
    }

    createViews();

    layoutParams.type = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ?
      WindowManager.LayoutParams.TYPE_SYSTEM_ALERT :
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
    // 【双窗】主窗（歌词+面板）默认不可点：面板收起时它虽然铺着，但不吃触摸
    layoutParams.flags = getLayoutParamsFlags(false);
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

  /** 按歌词视图真实排版高度校正歌词区高度（只增不减，避免来回抖动） */
  private void fitLyricHeightToContent() {
    if (textView == null || layoutParams == null) return;
    int contentHeight = textView.getContentHeight();
    if (contentHeight <= 0) return;
    int limit = maxHeight - 100;
    if (contentHeight > limit) contentHeight = limit;
    if (contentHeight <= Math.round(lyricHeight)) return;
    lyricHeight = contentHeight;
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
    // 记住展开前的窗口 y：展开时长高、收起时还原，歌词在两种状态下都停在原处。
    // 以百分比反推，保证用户拖动后的位置被正确沿用（不用 layoutParams.y，
    // 它可能正被上一次的夹取改写）
    if (!isPanelVisible && layoutParams != null) {
      int maxY = Math.max(0, Math.round(maxHeight - lyricHeight));
      int baseY = Math.round(maxHeight * prevViewPercentageY);
      lyricTopBeforePanel = Math.max(0, Math.min(maxY, baseY));
    }
    isPanelVisible = true;
    isSettingsVisible = false;
    panel.setSettingsVisible(false);
    // 面板立刻可见：commitWindowGeometry 会在提交窗口前把它按新尺寸量好画好
    panel.setVisibility(View.VISIBLE);
    updateHeights();
    applyTouchFlags();
    scheduleHidePanel();
  }

  private void hidePanel() {
    panelHandler.removeCallbacks(hidePanelRunnable);
    if (!isPanelVisible) return;
    isPanelVisible = false;
    isSettingsVisible = false;
    // 收起后面板不再占高度，先把「展开前的位置」写回基准百分比，
    // 这样 updateHeights 一次就能把窗口按正确位置和高度摆好，不会先跳一下再归位
    if (lyricTopBeforePanel != Integer.MIN_VALUE && layoutParams != null) {
      int maxY = Math.max(0, maxHeight - Math.round(lyricHeight));
      int y = Math.max(0, Math.min(maxY, lyricTopBeforePanel));
      layoutParams.y = y;
      prevViewPercentageY = (float) y / (float) maxHeight;
      lyricTopBeforePanel = Integer.MIN_VALUE;
    }
    if (panel != null) {
      // 先隐藏面板，再由 updateHeights 一次性把窗口缩回歌词区高度，
      // 避免「窗口还高着、面板已经消失」的残影
      panel.setSettingsVisible(false);
      panel.setVisibility(View.GONE);
    }
    updateHeights();
    applyTouchFlags();
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
      // 歌词视图始终只占歌词区，不能跟着窗口高度（含面板行）一起长
      textLp.height = Math.round(lyricHeight);
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
          int maxY = maxHeight - Math.round(lyricHeight + panelRowsPx());
          if (maxX < 0) maxX = 0;
          if (maxY < 0) maxY = 0;
          int x = layoutParams.x + (int) tranX;
          if (x < 0) x = 0;
          else if (x > maxX) x = maxX;
          int y = layoutParams.y + (int) tranY;
          if (y < 0) y = 0;
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
          // 已展开面板时，这个位置就是面板收起后应该回到的位置
          if (isPanelVisible) lyricTopBeforePanel = lyricY;
          sendPositionEvent(percentageX, percentageY);
        } else {
          // 面板坐标以窗口左上角为原点，而事件给的是屏幕坐标：x、y 都要减掉窗口偏移。
          // 只减 y 的话，歌词一旦被拖离左边缘，面板上所有控件都会判定成「没命中」而收不到点击
          float winX = layoutParams != null ? layoutParams.x : 0;
          float winY = layoutParams != null ? layoutParams.y : 0;
          handleTap(downWindowX - winX, downWindowY - winY);
        }
        if (isPanelVisible) scheduleHidePanel();
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
    if (windowManager == null || container == null) return;
    layoutParams.flags = getLayoutParamsFlags(isPanelVisible);
    windowManager.updateViewLayout(container, layoutParams);
  }

  public void unlockView() {
    isLock = false;
    if (panel != null) panel.setLocked(false);
    if (windowManager == null || container == null) return;
    layoutParams.flags = getLayoutParamsFlags(isPanelVisible);
    windowManager.updateViewLayout(container, layoutParams);
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
