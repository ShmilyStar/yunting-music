package cn.toside.ytmusic.mobile.lyric;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.view.View;

/**
 * 桌面歌词的交互面板。
 *
 * 点一下歌词浮层，浮层展开成一块半透明面板：
 * 左上角是 App 图标（点它打开 App），右上角关闭；中间一行是
 * 锁定 / 上一首 / 播放暂停 / 下一首 / 设置，等距排开；
 * 点设置再向下展开「9 个歌词主题色」，最左是行数减、最右是行数增，
 * 全部横向均分。面板只负责画和命中判定，真正的动作由 {@link LyricView} 处理。
 */
public class LyricControlPanel extends View {
  public interface ActionListener {
    void onAction(String action, String value, String extra);
  }

  private static final int ICON_COLOR = 0xE6FFFFFF;
  // 面板整体底色：94% 不透明，压住下层歌词的同时保留一点壁纸层次
  private static final int PANEL_COLOR = 0xF0000000;

  /** 歌词主题色，和设置页 `Theme.tsx` 的 9 个保持一致 */
  private static final String[] THEME_COLORS = {
    "#08e664", // 绿
    "#fffa12", // 黄
    "#019ce4", // 蓝
    "#ff1222", // 红
    "#ef6976", // 粉
    "#c851d4", // 紫
    "#ffa600", // 橙
    "#000000", // 黑
    "#ffffff", // 白
  };

  /** 主题色预先解析成 int：onDraw 每帧都要用，不能在绘制里反复 parseColor */
  private static final int[] THEME_COLOR_INTS = new int[THEME_COLORS.length];
  static {
    for (int i = 0; i < THEME_COLORS.length; i++) THEME_COLOR_INTS[i] = Color.parseColor(THEME_COLORS[i]);
  }

  /** 黑色歌词要配白色描边，否则深色壁纸上看不见 */
  private static final String[] THEME_SHADOWS = {
    "rgba(0,0,0,0.6)",
    "rgba(0,0,0,0.6)",
    "rgba(0,0,0,0.6)",
    "rgba(0,0,0,0.6)",
    "rgba(0,0,0,0.6)",
    "rgba(0,0,0,0.6)",
    "rgba(0,0,0,0.6)",
    "#ffffff",
    "rgba(0,0,0,0.6)",
  };

  /** 控制行 5 项 + 设置行（9 色 + 字号减 + 字号增） */
  private static final int CONTROL_ITEMS = 5;
  private static final int SETTINGS_ITEMS = THEME_COLORS.length + 2;
  private static final int FONT_MINUS_INDEX = THEME_COLORS.length;
  private static final int FONT_PLUS_INDEX = THEME_COLORS.length + 1;

  /** 宽度控制的取值范围，和设置页「窗口宽度」一致 */
  static final int MIN_WIDTH = 10;
  static final int MAX_WIDTH = 100;
  /** 行数控制的取值范围，和设置页「桌面歌词行数」一致 */
  static final int MIN_LINE = 1;
  static final int MAX_LINE = 8;
  /** 设置行下面的宽度控制条占的高度 */
  static final int WIDTH_ROW_HEIGHT_DP = 30;

  private final Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint iconPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint iconFillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint checkPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint sliderTrackPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Paint sliderDotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  /** 触摸时复用的坐标数组：每次事件都 new int[2] 会在拖动时产生大量小对象 */
  private final int[] locOnScreen = new int[2];
  private final Path path = new Path();
  private final Path tmpPath = new Path();
  private final RectF rect = new RectF();

  private ActionListener listener;

  private float lyricHeight = 0f;
  /** 歌词块在窗口内的起点：窗口上方是预留的透明留白，面板底色不能画到那里 */
  private float contentTop = 0f;
  /** 控制行 / 设置行 / 宽度条的实际像素高度，由 LyricView 下发 */
  private float controlRowPx = 0f;
  private float settingsRowPx = 0f;
  private float widthRowPx = 0f;
  private boolean settingsVisible = false;
  /** 设置行的展开进度 0~1：展开/收起在窗口内部做裁剪动画，不改窗口尺寸 */
  private float settingsAnim = 0f;
  private android.animation.ValueAnimator settingsAnimator = null;
  private boolean playing = false;
  private boolean locked = false;
  private boolean singleLineMode = false;
  /** 行数 ± 图标当前使用的颜色：单行模式下置灰 */
  private int lineIconColor = ICON_COLOR;
  private int widthPercent = MAX_WIDTH;
  private int playedColor = THEME_COLOR_INTS[0];

  public LyricControlPanel(Context context) {
    super(context);

    bgPaint.setStyle(Paint.Style.FILL);
    bgPaint.setColor(PANEL_COLOR);

    iconPaint.setStyle(Paint.Style.STROKE);
    // 每个图标绘制前都会按自己的字框重设笔画，这里只是一个安全初值
    iconPaint.setStrokeWidth(dp(1.7f));
    iconPaint.setStrokeCap(Paint.Cap.ROUND);
    iconPaint.setStrokeJoin(Paint.Join.ROUND);
    iconPaint.setColor(ICON_COLOR);

    iconFillPaint.setStyle(Paint.Style.FILL);
    iconFillPaint.setColor(ICON_COLOR);

    textPaint.setTextAlign(Paint.Align.CENTER);
    textPaint.setTextSize(dp(20));
    textPaint.setColor(ICON_COLOR);

    dotPaint.setStyle(Paint.Style.FILL);

    checkPaint.setStyle(Paint.Style.STROKE);
    checkPaint.setStrokeWidth(dp(1.4f));
    checkPaint.setStrokeCap(Paint.Cap.ROUND);
    checkPaint.setStrokeJoin(Paint.Join.ROUND);
    checkPaint.setColor(Color.WHITE);
  }

  /** 每次按当前屏幕密度换算，改 dpi / 分屏后不需要重建面板 */
  private float dp(float value) {
    return value * getResources().getDisplayMetrics().density;
  }

  /**
   * 整套图标的统一笔画：字框边长的 1/14。
   *
   * 参照 Lucide / Tabler / Remix line 这套主流线性图标（24 格字框、描边约 1.75 格、
   * 圆头圆角）。上一版按「实心 + 0.17s 粗描边」画，在 22~26dp 的小字框里糊成一团，
   * 用户的评价是「粗壮、没有美感」—— 问题就出在笔画占了字框近 1/6，留白不够。
   * 现在所有线条一律走这个函数，只有播放键的圆底和跳过三角是实心块。
   */
  private float lineStroke(float s) {
    return Math.max(2f, s / 14f);
  }

  public void setActionListener(ActionListener listener) {
    this.listener = listener;
  }

  public void setSettingsVisible(boolean visible) {
    if (settingsVisible == visible) return;
    settingsVisible = visible;
    float target = visible ? 1f : 0f;
    if (settingsAnimator != null) settingsAnimator.cancel();
    settingsAnimator = android.animation.ValueAnimator.ofFloat(settingsAnim, target);
    settingsAnimator.setDuration(160);
    settingsAnimator.addUpdateListener(a -> {
      settingsAnim = (float) a.getAnimatedValue();
      invalidate();
    });
    settingsAnimator.start();
  }

  /** 当前真正画得到的高度（含歌词块上方的留白）：歌词块 + 控制行 + 设置行（按展开进度） */
  private float visibleHeight() {
    float base = contentTop + lyricHeight + controlRowPx;
    return base + (settingsRowPx + widthRowPx) * settingsAnim;
  }

  /** 歌词块在窗口内的起点 y */
  private float lyricTop() {
    return contentTop;
  }

  /** 控制行中心 y：紧接在歌词块下方 */
  private float controlCenterY() {
    return contentTop + lyricHeight + controlRowPx / 2f;
  }

  /** 色点行中心 y */
  private float settingsCenterY() {
    return contentTop + lyricHeight + controlRowPx + settingsRowPx / 2f;
  }

  public void setPlaying(boolean playing) {
    this.playing = playing;
    invalidate();
  }

  public void setLocked(boolean locked) {
    this.locked = locked;
    invalidate();
  }

  /**
   * 单行歌词模式下「行数 ±」不产生任何可见效果（本来就只显示一行），
   * 置灰这两个图标，用户一看就知道不是点坏了。
   */
  public void setSingleLineMode(boolean singleLine) {
    if (singleLineMode == singleLine) return;
    singleLineMode = singleLine;
    invalidate();
  }

  /** 同步设置页里的窗口宽度（10~100） */
  public void setWidthPercent(int percent) {
    if (percent < MIN_WIDTH) percent = MIN_WIDTH;
    if (percent > MAX_WIDTH) percent = MAX_WIDTH;
    widthPercent = percent;
    invalidate();
  }

  /**
   * 由 {@link LyricView} 在算完窗口高度后同步各段的位置和实际像素高度：
   * 歌词块起点、歌词块、控制行、设置行、宽度条。面板里的所有坐标都从这里推出来，
   * 不再自己按 dp 猜，屏幕密度变化或小屏压高度时排版仍然对齐。
   */
  public void setLayout(float contentTopPx, float lyricHeightPx,
                        float controlRowPx, float settingsRowPx, float widthRowPx) {
    this.contentTop = contentTopPx;
    this.lyricHeight = lyricHeightPx;
    this.controlRowPx = controlRowPx;
    this.settingsRowPx = settingsRowPx;
    this.widthRowPx = widthRowPx;
    invalidate();
  }

  public void setPlayedColor(int color) {
    playedColor = color;
    invalidate();
  }

  @Override
  protected void onDraw(Canvas canvas) {
    super.onDraw(canvas);
    float w = getWidth();
    float h = getHeight();
    if (w <= 0 || h <= 0) return;

    // 窗口高度是固定预留的（见 LyricView.updateHeights），但底色只画到「当前真正用到的高度」：
    // 歌词块上方是透明留白、设置行收起时下面几行也不留黑底，看起来就像窗口只有这么高。
    float top = Math.min(Math.max(0f, contentTop), h);
    float panelH = Math.min(visibleHeight(), h);
    if (panelH <= top) return;

    // 设置行展开/收起时在窗口内部做一次「自上而下揭开」：裁一段动画高度，
    // 内容位置不动，靠裁剪露出来。窗口本身尺寸不变，所以系统没有可动画的东西。
    int save = canvas.save();
    canvas.clipRect(0, top, w, panelH);
    rect.set(0, top, w, panelH);
    canvas.drawRoundRect(rect, dp(12), dp(12), bgPaint);

    // 图标直接画在主画布上：View 走硬件加速，Path 由渲染器按像素做抗锯齿，
    // 边缘天然平滑。早先那套「画到 3 倍离屏位图再缩回来」的做法有三个问题：
    // 每帧新建并回收一张几十 MB 的位图、缩小时双线性只采样 4 个源像素导致细线
    // 重新出现阶梯、以及缩放后的线宽不再落在整像素上而发虚。直接画最清晰。
    drawIcons(canvas, w, h);

    if (settingsVisible || settingsAnim > 0f) drawSettingsRow(canvas, w);
    canvas.restoreToCount(save);
  }

  /** 左上 / 右上角 + 控制行的全部图标 */
  private void drawIcons(Canvas canvas, float w, float h) {
    float scale = iconScale();
    // 两个角图标贴着面板顶角、同一中心线、同一笔画粗细、左右镜像。
    // 音符的墨迹只有字框的 ~0.78，叉是满框的对角线，所以音符字框放大 1.15 倍；
    // 但描边必须按同一个基准算，否则放大字框会连笔画一起放大，两个角一粗一细。
    float cornerSize = dp(19) * scale;
    float cornerStroke = lineStroke(cornerSize);
    float cornerY = cornerCenterY();
    drawAppIcon(canvas, cornerMarginX(), cornerY, cornerSize * 1.15f, cornerStroke);
    drawClose(canvas, w - cornerMarginX(), cornerY, cornerSize, cornerStroke);

    float cy = controlCenterY();
    float glyph = dp(22) * scale;
    drawLock(canvas, controlX(0), cy, glyph);
    drawPrev(canvas, controlX(1), cy, glyph);
    drawPlayPause(canvas, controlX(2), cy, dp(30) * scale);
    drawNext(canvas, controlX(3), cy, glyph);
    drawGear(canvas, controlX(4), cy, glyph);
  }

  /**
   * App 里的主播放键：绿色实心圆 + 白色实心图标（PlayDetail ControlBtn.tsx）。
   * 面板上沿用同一套语言，让桌面歌词和 App 内是同一个控件。
   */
  private static final int PRIMARY_COLOR = 0xFF31C27C;

  /** 色点行 + 宽度条（色点与滑块本来就是实心圆，普通抗锯齿足够，不重复走超采样） */
  private void drawSettingsRow(Canvas canvas, float w) {
    float scale = iconScale();
    float sy = settingsCenterY();
    float itemSpacing = w / SETTINGS_ITEMS;
    // 色点半径同时受密度和间距约束，窄窗口下不会挤在一起。
    float dotRadius = Math.min(dp(9.5f) * scale, itemSpacing * 0.28f);
    for (int i = 0; i < THEME_COLORS.length; i++) {
      float cx = settingsX(i);
      int color = THEME_COLOR_INTS[i];
      dotPaint.setColor(color);
      canvas.drawCircle(cx, sy, dotRadius, dotPaint);
      // 白色圆点在浅色壁纸上、黑色圆点在深色面板上都需要一圈细边
      if (color == Color.WHITE || color == Color.BLACK) {
        iconPaint.setColor(color == Color.WHITE ? 0x33000000 : 0x66FFFFFF);
        canvas.drawCircle(cx, sy, dotRadius, iconPaint);
        iconPaint.setColor(ICON_COLOR);
      }
      if (color == playedColor) {
        // 浅色圆点用深色对勾，深色圆点用白色对勾
        checkPaint.setColor(isDarkColor(color) ? Color.WHITE : 0xFF141414);
        float k = dotRadius * 0.55f;
        path.reset();
        path.moveTo(cx - k, sy);
        path.lineTo(cx - k * 0.2f, sy + k * 0.8f);
        path.lineTo(cx + k * 1.1f, sy - k * 0.9f);
        canvas.drawPath(path, checkPaint);
      }
    }

    // 字号 / 行数图标直接画在主画布，抗锯齿由硬件渲染负责
    drawSettingsIcons(canvas, scale, sy, itemSpacing);

    drawWidthSlider(canvas, w, scale);
  }

  /** 色点行两端的字号减 / 加，和宽度行两端的行数减 / 加 */
  private void drawSettingsIcons(Canvas canvas, float scale, float sy, float itemSpacing) {
    float fontSize = Math.min(dp(21.5f) * scale, itemSpacing * 0.58f);
    drawFontIcon(canvas, settingsX(FONT_MINUS_INDEX), sy, fontSize, false);
    drawFontIcon(canvas, settingsX(FONT_PLUS_INDEX), sy, fontSize, true);

    // 单行模式下这两个按钮不起作用，置灰提示，别让用户以为点坏了
    lineIconColor = singleLineMode ? withAlpha(ICON_COLOR, 0.35f) : ICON_COLOR;
    float iconSize = lineIconHalfSize() * 2f;
    drawLineMinus(canvas, lineMinusX(iconSize), widthRowCenterY(), iconSize);
    drawLinePlus(canvas, linePlusX(iconSize), widthRowCenterY(), iconSize);
  }

  /**
   * 行数减少：三条细横线 + 右侧一个「−」，读起来是「≡ −」。
   */
  private void drawLineMinus(Canvas canvas, float cx, float cy, float s) {
    drawLineRows(canvas, cx, cy, s);
    drawSign(canvas, cx + s * 0.30f, cy, s, false);
  }

  /** 行数增加：三条细横线 + 右侧一个「+」 */
  private void drawLinePlus(Canvas canvas, float cx, float cy, float s) {
    drawLineRows(canvas, cx, cy, s);
    drawSign(canvas, cx + s * 0.30f, cy, s, true);
  }

  /** 行数图标的三条横线：等长、等距、细圆头，右侧留出足够空隙放符号 */
  private void drawLineRows(Canvas canvas, float cx, float cy, float s) {
    iconPaint.setStrokeWidth(lineStroke(s) * 0.85f);
    iconPaint.setStrokeCap(Paint.Cap.ROUND);
    iconPaint.setColor(lineIconColor);
    float left = cx - s * 0.44f;
    float right = cx - s * 0.12f;
    float gap = s * 0.19f;
    for (int i = -1; i <= 1; i++) {
      float y = cy + gap * i;
      canvas.drawLine(left, y, right, y, iconPaint);
    }
  }

  /**
   * 字号：字母「A」+ 右上角减号 / 加号，全部走线性笔画。
   *
   * 上一版把 A 画成实心块（两条 0.20s 粗腿 + 横杠），字腔几乎被填满，
   * 在别人家 1.5 格描边的图标旁边就像一块补丁。
   */
  private void drawFontIcon(Canvas canvas, float cx, float cy, float s, boolean plus) {
    iconPaint.setStrokeWidth(lineStroke(s));
    iconPaint.setStrokeCap(Paint.Cap.ROUND);
    iconPaint.setStrokeJoin(Paint.Join.ROUND);
    iconPaint.setColor(ICON_COLOR);

    float halfW = s * 0.26f;
    float apexX = cx - s * 0.04f;
    float apexY = cy - s * 0.30f;
    float baseY = cy + s * 0.28f;

    // A：两条斜腿 + 一根横杠
    canvas.drawLine(apexX, apexY, apexX - halfW, baseY, iconPaint);
    canvas.drawLine(apexX, apexY, apexX + halfW, baseY, iconPaint);
    float barY = cy + s * 0.10f;
    float t = (barY - apexY) / (baseY - apexY);
    canvas.drawLine(apexX - halfW * t, barY, apexX + halfW * t, barY, iconPaint);

    // 右上角正负号
    float signX = cx + s * 0.30f;
    float signY = apexY + s * 0.04f;
    drawSign(canvas, signX, signY, s, plus);
  }

  /** 正负号：横竖两笔在同一个中心交叉，长度一致，细圆头 */
  private void drawSign(Canvas canvas, float cx, float cy, float s, boolean plus) {
    float arm = s * 0.16f;
    iconPaint.setStrokeWidth(lineStroke(s));
    iconPaint.setStrokeCap(Paint.Cap.ROUND);
    // 颜色由调用方决定：行数图标可能置灰，字号图标永远是亮色
    canvas.drawLine(cx - arm, cy, cx + arm, cy, iconPaint);
    if (plus) canvas.drawLine(cx, cy - arm, cx, cy + arm, iconPaint);
  }

  /**
   * 宽度控制条：对应设置页的「窗口宽度」，拖动即刻调整悬浮窗宽度。
   * 已选段、圆点、数字统一用 App 主色，和上面的播放键是同一个绿，
   * 不再跟着歌词主题色走 —— 主题色属于歌词，控件本身属于 App。
   */
  private void drawWidthSlider(Canvas canvas, float w, float scale) {
    float cy = widthRowCenterY();
    String label = String.valueOf(widthPercent);
    textPaint.setTextSize(Math.max(dp(12), dp(14) * scale));
    float labelWidth = textPaint.measureText(label);

    float gap = dp(10);
    float trackLeft = trackLeft();
    float trackRight = trackRight();
    float half = dp(1.2f);

    // 轨道：剩余段（主色低不透明度）+ 已选段（主色）
    sliderTrackPaint.setColor(withAlpha(PRIMARY_COLOR, 0.28f));
    rect.set(trackLeft, cy - half, trackRight, cy + half);
    canvas.drawRoundRect(rect, half, half, sliderTrackPaint);

    float ratio = (widthPercent - MIN_WIDTH) / (float) (MAX_WIDTH - MIN_WIDTH);
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    float thumbX = trackLeft + (trackRight - trackLeft) * ratio;
    sliderTrackPaint.setColor(PRIMARY_COLOR);
    rect.set(trackLeft, cy - half, thumbX, cy + half);
    canvas.drawRoundRect(rect, half, half, sliderTrackPaint);

    // 圆点用主色的浅色版本
    sliderDotPaint.setColor(lighten(PRIMARY_COLOR));
    canvas.drawCircle(thumbX, cy, dp(6f) * scale, sliderDotPaint);

    // 右侧百分比数值
    textPaint.setColor(PRIMARY_COLOR);
    textPaint.setTextAlign(Paint.Align.LEFT);
    canvas.drawText(label, trackRight + gap, cy + dp(4.5f), textPaint);
    textPaint.setTextAlign(Paint.Align.CENTER);
    textPaint.setColor(ICON_COLOR);
  }

  /** 把颜色按比例混白，近似设置页滑块拇指的浅色 */
  private static int lighten(int color) {
    float f = 0.35f;
    int r = Math.round(Color.red(color) + (255 - Color.red(color)) * f);
    int g = Math.round(Color.green(color) + (255 - Color.green(color)) * f);
    int b = Math.round(Color.blue(color) + (255 - Color.blue(color)) * f);
    return Color.rgb(r, g, b);
  }

  private static int withAlpha(int color, float alpha) {
    return Color.argb(Math.round(255 * alpha), Color.red(color), Color.green(color), Color.blue(color));
  }

  /** 宽度控制条中心 y：和色点行的间距保持一致 */
  private float widthRowCenterY() {
    return contentTop + lyricHeight + controlRowPx + settingsRowPx + widthRowPx / 2f;
  }

  /** 宽度控制条：按下时记录，移动时按比例换算成 10~100 的整数 */
  private boolean widthDragging = false;
  /** 宽度行左 / 右行数按钮被按下时记录动作名，松手再派发 */
  private String pressingLineIcon = null;

  /**
   * 宽度行：中间是宽度控制条（按下 / 拖动 / 松手都按轨道换算），
   * 左右两端是行数减 / 加按钮，按下去只触发一次动作。
   * 传进来的是窗口坐标（含窗口自身偏移），先减掉面板在屏幕上的位置换算成面板坐标。
   */
  public boolean handleWidthTouch(int action, float x, float y) {
    if (!settingsVisible) return false;
    getLocationOnScreen(locOnScreen);
    float localX = x - locOnScreen[0];
    float localY = y - locOnScreen[1];
    float cy = widthRowCenterY();

    if (action == android.view.MotionEvent.ACTION_DOWN) {
      float iconSize = lineIconHalfSize() * 2f;
      float hitRadius = Math.max(dp(20), iconSize * 0.7f);
      if (hit(localX, localY, lineMinusX(iconSize), cy, hitRadius)) {
        pressingLineIcon = "line-";
        return true;
      }
      if (hit(localX, localY, linePlusX(iconSize), cy, hitRadius)) {
        pressingLineIcon = "line+";
        return true;
      }
      widthDragging = Math.abs(localY - cy) <= dp(26);
      if (!widthDragging) return false;
      applyWidthFromX(localX);
      return true;
    }

    if (pressingLineIcon != null) {
      if (action == android.view.MotionEvent.ACTION_UP) {
        String actionName = pressingLineIcon;
        pressingLineIcon = null;
        if (listener != null) listener.onAction(actionName, null, null);
        return true;
      }
      if (action == android.view.MotionEvent.ACTION_CANCEL) {
        pressingLineIcon = null;
        return true;
      }
      return true;
    }

    if (!widthDragging) return false;
    if (action == android.view.MotionEvent.ACTION_MOVE) {
      applyWidthFromX(localX);
      return true;
    }
    if (action == android.view.MotionEvent.ACTION_UP || action == android.view.MotionEvent.ACTION_CANCEL) {
      widthDragging = false;
      if (listener != null && action == android.view.MotionEvent.ACTION_UP) {
        listener.onAction("width", String.valueOf(widthPercent), String.valueOf(widthPercent));
      }
      return true;
    }
    return false;
  }

  /**
   * 轨道左右端点，和绘制用同一套公式，保证「看得到就点得到」。
   *
   * 「轨道 + 数字」整体在窗口里居中，左右两端各留出行数减 / 行数增图标的位置，
   * 长度取可用宽度的七成，比之前铺满整行短一截。
   */
  private float trackLeft() {
    textPaint.setTextSize(Math.max(dp(12), dp(15) * iconScale()));
    float labelWidth = textPaint.measureText(String.valueOf(MAX_WIDTH));
    float gap = dp(10);
    float margin = lineIconHalfSize() + dp(18);
    float avail = getWidth() - margin * 2f;
    float trackLength = Math.max(dp(60), avail * 0.7f);
    float totalWidth = trackLength + gap + labelWidth;
    float left = (getWidth() - totalWidth) / 2f;
    float minLeft = margin;
    float maxLeft = getWidth() - margin - totalWidth;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;
    return left;
  }

  private float trackRight() {
    textPaint.setTextSize(Math.max(dp(12), dp(15) * iconScale()));
    float labelWidth = textPaint.measureText(String.valueOf(MAX_WIDTH));
    float gap = dp(10);
    float left = trackLeft();
    float right = getWidth() - left - labelWidth - gap;
    return Math.max(left + dp(40), right);
  }

  /** 行数图标半宽，绘制与留白共用 */
  private float lineIconHalfSize() {
    return Math.min(dp(12) * iconScale(), dp(14));
  }

  /** 「轨道 + 右侧数字」这段内容的右端（数字的右边缘） */
  private float sliderContentRight() {
    textPaint.setTextSize(Math.max(dp(12), dp(15) * iconScale()));
    float labelWidth = textPaint.measureText(String.valueOf(widthPercent));
    return trackRight() + dp(10) + labelWidth;
  }

  /**
   * 行数减 / 加的位置：分别落在「轨道 + 数字」两端到面板边界这段空白的正中，
   * 左右对称，不会挤在数字旁边，也不会贴到面板边缘。
   */
  private float lineMinusX(float iconSize) {
    float contentLeft = trackLeft();
    return contentLeft / 2f;
  }

  private float linePlusX(float iconSize) {
    float contentRight = sliderContentRight();
    return (contentRight + getWidth()) / 2f;
  }

  private void applyWidthFromX(float x) {
    float left = trackLeft();
    float right = trackRight();
    if (right <= left) return;
    float ratio = (x - left) / (right - left);
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    int percent = Math.round(MIN_WIDTH + ratio * (MAX_WIDTH - MIN_WIDTH));
    if (percent == widthPercent) return;
    widthPercent = percent;
    invalidate();
  }

  /** 控制行第 index 项的中心 x，5 项等距 */
  private float controlX(int index) {
    return getWidth() * (index + 0.5f) / CONTROL_ITEMS;
  }

  /** 设置行第 index 项的中心 x：9 个色点 + 字号减 / 加，共 11 项等距 */
  private float settingsX(int index) {
    return getWidth() * (index + 0.5f) / SETTINGS_ITEMS;
  }

  /**
   * 面板要在手机（窄窗口）和平板（宽窗口）上都能用。
   *
   * 早先按「窗口宽度 / dp(620)」缩放，等于把所有竖屏手机（约 360dp 宽）都当成
   * 需要缩到 0.58 倍的小屏，图标因此在任何手机上都偏小。真正会挤的只有设置行
   * （11 项等分宽度），所以改成按设置行每项能不能放下来决定缩放，
   * 上限 1.12 倍避免平板上无限放大，下限 0.72 保证 10% 宽窗口也不重叠。
   */
  private float iconScale() {
    float w = getWidth();
    if (w <= 0) return 1f;
    float itemSpacing = w / (float) SETTINGS_ITEMS;
    return Math.max(0.72f, Math.min(1.12f, itemSpacing / dp(32f)));
  }

  /** 角图标的左右边距：贴顶角，随图标一起缩放 */
  private float cornerMarginX() {
    return dp(18) * iconScale();
  }

  /** 角图标的中心 y：贴着歌词区（也就是面板）顶边 */
  private float cornerCenterY() {
    return lyricTop() + dp(15) * iconScale();
  }

  /** 角图标的命中半径：比字形大一圈，手指按得动 */
  private float cornerHitRadius() {
    return dp(24) * iconScale();
  }

  /**
   * 整套图标统一规格：
   * 边长 s 的方框里作画，所有坐标以 s 的比例给出；线性为主（见 {@link #lineStroke(float)}），
   * 只有播放键圆底、跳过三角、音符符头这几处保留实心块。
   */
  /**
   * 左上角：App 图标 —— 线性八分音符。
   *
   * 和右上角关闭叉共用同一个方框：细符干、一笔甩出的符尾、小实心符头，
   * 重心落在框心，两个角视觉上等重。
   */
  private void drawAppIcon(Canvas canvas, float cx, float cy, float s, float stroke) {
    iconPaint.setStrokeWidth(stroke);
    iconPaint.setStrokeCap(Paint.Cap.ROUND);
    iconPaint.setColor(ICON_COLOR);

    float headRx = s * 0.155f;
    float headRy = s * 0.115f;
    float headX = cx - s * 0.13f;
    float headY = cy + s * 0.26f;
    float stemX = headX + headRx * 0.82f;
    float stemTop = cy - s * 0.34f;

    // 符干：一笔细竖
    canvas.drawLine(stemX, stemTop, stemX, headY, iconPaint);

    // 符尾：从符干顶端向右下甩出的一道细弧
    path.reset();
    path.moveTo(stemX, stemTop);
    path.quadTo(cx + s * 0.30f, stemTop + s * 0.04f, cx + s * 0.26f, stemTop + s * 0.30f);
    canvas.drawPath(path, iconPaint);

    // 符头：倾斜实心小椭圆
    iconFillPaint.setColor(ICON_COLOR);
    canvas.save();
    canvas.rotate(-20f, headX, headY);
    rect.set(headX - headRx, headY - headRy, headX + headRx, headY + headRy);
    canvas.drawOval(rect, iconFillPaint);
    canvas.restore();
  }

  /** 关闭：两笔等长对角线的叉，细圆头 */
  private void drawClose(Canvas canvas, float cx, float cy, float s, float stroke) {
    iconPaint.setStrokeWidth(stroke);
    iconPaint.setStrokeCap(Paint.Cap.ROUND);
    iconPaint.setColor(ICON_COLOR);
    float r = s * 0.32f;
    canvas.drawLine(cx - r, cy - r, cx + r, cy + r, iconPaint);
    canvas.drawLine(cx + r, cy - r, cx - r, cy + r, iconPaint);
  }

  /**
   * 锁：线性锁身 + 锁梁（对齐 Lucide / Remix 的 lock-line）。
   *
   * 锁定：倒 U 锁梁，两腿插进锁身顶边。
   * 解锁：锁梁只留左腿，弧到右上就收住，右侧留出缺口，一眼能看出是开的。
   * 上一版锁身是实心块、锁孔用底色打洞，在小字框里像一个黑色补丁。
   */
  private void drawLock(Canvas canvas, float cx, float cy, float s) {
    float stroke = lineStroke(s);
    float bw = s * 0.60f;
    float bh = s * 0.38f;
    float bodyTop = cy + s * 0.08f;
    float bodyCy = bodyTop + bh / 2f;
    float r = s * 0.18f;
    float arcTop = bodyTop - r * 1.7f;

    iconPaint.setStrokeWidth(stroke);
    iconPaint.setStrokeCap(Paint.Cap.ROUND);
    iconPaint.setColor(ICON_COLOR);

    if (locked) {
      rect.set(cx - r, arcTop, cx + r, arcTop + r * 2f);
      canvas.drawArc(rect, 180f, 180f, false, iconPaint);
      canvas.drawLine(cx - r, arcTop + r, cx - r, bodyTop + stroke * 0.5f, iconPaint);
      canvas.drawLine(cx + r, arcTop + r, cx + r, bodyTop + stroke * 0.5f, iconPaint);
    } else {
      float openArcTop = arcTop - s * 0.06f;
      rect.set(cx - r, openArcTop, cx + r, openArcTop + r * 2f);
      canvas.drawArc(rect, 180f, 148f, false, iconPaint);
      canvas.drawLine(cx - r, openArcTop + r, cx - r, bodyTop + stroke * 0.5f, iconPaint);
    }

    // 锁身：描边圆角矩形
    rect.set(cx - bw / 2f, bodyTop, cx + bw / 2f, bodyTop + bh);
    canvas.drawRoundRect(rect, s * 0.08f, s * 0.08f, iconPaint);

    // 锁孔：一个小实心点
    iconFillPaint.setColor(ICON_COLOR);
    canvas.drawCircle(cx, bodyCy, s * 0.055f, iconFillPaint);
  }

  /**
   * 上一首：一根细竖条 + 一个小实心三角（网易云 / QQ 音乐桌面歌词工具栏同款）。
   *
   * 竖条走描边而不是实心圆角矩形，三角高度压到 0.42s：
   * 上一版 0.46s 的三角配 0.13s 的粗条，在 22dp 字框里明显比别的图标重。
   */
  private void drawPrev(Canvas canvas, float cx, float cy, float s) {
    float h = s * 0.42f;
    float barX = cx + s * 0.21f;
    iconPaint.setStrokeWidth(lineStroke(s));
    iconPaint.setStrokeCap(Paint.Cap.ROUND);
    iconPaint.setColor(ICON_COLOR);
    canvas.drawLine(barX, cy - h / 2f, barX, cy + h / 2f, iconPaint);

    float triRight = barX - lineStroke(s) * 0.5f - s * 0.04f;
    iconFillPaint.setColor(ICON_COLOR);
    path.reset();
    path.moveTo(triRight, cy - h / 2f);
    path.lineTo(triRight, cy + h / 2f);
    path.lineTo(triRight - h * 0.62f, cy);
    path.close();
    canvas.drawPath(path, iconFillPaint);
  }

  /** 下一首：上一首的镜像 */
  private void drawNext(Canvas canvas, float cx, float cy, float s) {
    float h = s * 0.42f;
    float barX = cx - s * 0.21f;
    iconPaint.setStrokeWidth(lineStroke(s));
    iconPaint.setStrokeCap(Paint.Cap.ROUND);
    iconPaint.setColor(ICON_COLOR);
    canvas.drawLine(barX, cy - h / 2f, barX, cy + h / 2f, iconPaint);

    float triLeft = barX + lineStroke(s) * 0.5f + s * 0.04f;
    iconFillPaint.setColor(ICON_COLOR);
    path.reset();
    path.moveTo(triLeft, cy - h / 2f);
    path.lineTo(triLeft, cy + h / 2f);
    path.lineTo(triLeft + h * 0.62f, cy);
    path.close();
    canvas.drawPath(path, iconFillPaint);
  }

  /**
   * 播放 / 暂停：和 App 播放页一致 —— 主色实心圆底 + 白色实心字形。
   * 圆底用面板同款圆角半径比例，视觉上比一圈细线更「有分量」，也是整个面板的视觉锚点。
   */
  private void drawPlayPause(Canvas canvas, float cx, float cy, float d) {
    float r = d / 2f;
    dotPaint.setColor(PRIMARY_COLOR);
    canvas.drawCircle(cx, cy, r, dotPaint);

    iconFillPaint.setColor(Color.WHITE);
    if (playing) {
      float barW = d * 0.085f;
      float barH = d * 0.32f;
      float gap = d * 0.055f;
      rect.set(cx - gap - barW, cy - barH / 2f, cx - gap, cy + barH / 2f);
      canvas.drawRoundRect(rect, barW * 0.35f, barW * 0.35f, iconFillPaint);
      rect.set(cx + gap, cy - barH / 2f, cx + gap + barW, cy + barH / 2f);
      canvas.drawRoundRect(rect, barW * 0.35f, barW * 0.35f, iconFillPaint);
    } else {
      // 实心三角，重心右移一点点才显得居中
      float h = d * 0.38f;
      float offset = d * 0.04f;
      path.reset();
      path.moveTo(cx - h * 0.40f + offset, cy - h / 2f);
      path.lineTo(cx - h * 0.40f + offset, cy + h / 2f);
      path.lineTo(cx + h * 0.62f + offset, cy);
      path.close();
      canvas.drawPath(path, iconFillPaint);
    }
  }

  /** 粗略亮度判断，避免用 API 24 才有的 Color.luminance */
  private boolean isDarkColor(int color) {
    float r = Color.red(color) / 255f;
    float g = Color.green(color) / 255f;
    float b = Color.blue(color) / 255f;
    return 0.299f * r + 0.587f * g + 0.114f * b < 0.25f;
  }

  /**
   * 设置：细齿齿轮（对齐 Remix `settings-3-line` 的骨架，仍是实心画法）。
   *
   * 8 个齿、齿距 45°：齿顶 12°、左右齿侧各 6.5°、齿谷 20°，左右完全对称。
   * 上一版齿顶 18° + 齿高 0.095s，齿和齿几乎连成一片，中心孔又只有 0.16s，
   * 看着像一朵糊掉的花。现在齿变窄、齿高变长、中心孔放大到 0.185s。
   */
  private void drawGear(Canvas canvas, float cx, float cy, float s) {
    float outer = s * 0.44f;
    float root = s * 0.325f;
    float hole = s * 0.185f;
    int teeth = 8;
    float pitch = 360f / teeth;
    float topSpan = 12f;
    float sideSpan = 6.5f;
    float valleySpan = pitch - topSpan - sideSpan * 2f;

    iconFillPaint.setColor(ICON_COLOR);
    path.reset();
    float a = -90f - pitch / 2f;
    boolean first = true;
    for (int i = 0; i < teeth; i++) {
      // 齿谷
      addArcSegment(path, cx, cy, root, a, a + valleySpan, first);
      first = false;
      a += valleySpan;
      // 齿侧：内圈升到外圈
      addToothSide(path, cx, cy, root, outer, a, a + sideSpan);
      a += sideSpan;
      // 齿顶
      addArcSegment(path, cx, cy, outer, a, a + topSpan, false);
      a += topSpan;
      // 齿侧：外圈落回内圈
      addToothSide(path, cx, cy, outer, root, a, a + sideSpan);
      a += sideSpan;
    }
    path.close();

    // 中心孔
    tmpPath.reset();
    tmpPath.addCircle(cx, cy, hole, Path.Direction.CW);
    path.op(tmpPath, Path.Op.DIFFERENCE);
    canvas.drawPath(path, iconFillPaint);
  }

  /** 沿半径 r 从 from 到 to 画一段圆弧（角度按 12 点顺时针），步长 2° 保证平滑 */
  private void addArcSegment(Path target, float cx, float cy, float r,
                             float from, float to, boolean move) {
    float delta = to - from;
    int steps = Math.max(2, (int) Math.ceil(Math.abs(delta) / 2f));
    for (int k = 0; k <= steps; k++) {
      float deg = from + delta * k / steps;
      float x = polarX(cx, r, deg);
      float y = polarY(cy, r, deg);
      if (move && k == 0) target.moveTo(x, y);
      else target.lineTo(x, y);
    }
  }

  /** 齿侧：从 r1 的 from 角直线过渡到 r2 的 to 角（真实齿轮的齿面是直的） */
  private void addToothSide(Path target, float cx, float cy,
                            float r1, float r2, float from, float to) {
    target.lineTo(polarX(cx, r1, from), polarY(cy, r1, from));
    target.lineTo(polarX(cx, r2, to), polarY(cy, r2, to));
  }

  /** 极坐标转 x（角度按 12 点方向顺时针计） */
  private float polarX(float cx, float r, float deg) {
    return cx + (float) (Math.cos(Math.toRadians(deg - 90f)) * r);
  }

  private float polarY(float cy, float r, float deg) {
    return cy + (float) (Math.sin(Math.toRadians(deg - 90f)) * r);
  }

  /**
   * 只判定、不派发动作：给悬浮窗挑选坐标系用（同一套命中规则）。
   */
  public boolean wouldHit(float x, float y) {
    float w = getWidth();
    if (x <= 0 || y <= 0 || x >= w) return false;
    if (hit(x, y, cornerMarginX(), cornerCenterY(), cornerHitRadius())) return true;
    if (hit(x, y, w - cornerMarginX(), cornerCenterY(), cornerHitRadius())) return true;
    float cy = controlCenterY();
    for (int i = 0; i < CONTROL_ITEMS; i++) {
      if (hit(x, y, controlX(i), cy, controlHitRadius(i))) return true;
    }
    if (settingsVisible) {
      float sy = settingsCenterY();
      float radius = settingsHitRadius(w / SETTINGS_ITEMS);
      for (int i = 0; i < SETTINGS_ITEMS; i++) {
        if (hit(x, y, settingsX(i), sy, radius)) return true;
      }
      if (Math.abs(y - widthRowCenterY()) <= dp(26) && x >= trackLeft() && x <= trackRight() + dp(80)) return true;
    }
    return false;
  }

  /**
   * 命中判定并派发动作。返回 true 表示这次点击落在面板控件上。
   */
  public boolean handleTouch(float x, float y) {
    float w = getWidth();
    float cy = controlCenterY();
    if (x <= 0 || y <= 0 || x >= w) return false;

    if (hit(x, y, cornerMarginX(), cornerCenterY(), cornerHitRadius())) {
      dispatch("openApp", null, null);
      return true;
    }
    if (hit(x, y, w - cornerMarginX(), cornerCenterY(), cornerHitRadius())) {
      dispatch("close", null, null);
      return true;
    }

    String[] controlActions = { "lock", "prev", "toggle", "next", "settings" };
    for (int i = 0; i < CONTROL_ITEMS; i++) {
      if (hit(x, y, controlX(i), cy, controlHitRadius(i))) {
        dispatch(controlActions[i], null, null);
        return true;
      }
    }

    if (settingsVisible) {
      float sy = settingsCenterY();
      float radius = settingsHitRadius(w / SETTINGS_ITEMS);
      for (int i = 0; i < THEME_COLORS.length; i++) {
        if (hit(x, y, settingsX(i), sy, radius)) {
          dispatch("theme", THEME_COLORS[i], THEME_SHADOWS[i]);
          return true;
        }
      }
      if (hit(x, y, settingsX(FONT_MINUS_INDEX), sy, radius)) {
        dispatch("font-", null, null);
        return true;
      }
      if (hit(x, y, settingsX(FONT_PLUS_INDEX), sy, radius)) {
        dispatch("font+", null, null);
        return true;
      }
    }

    return false;
  }

  /** 控制行第 index 项的命中半径：绘制行与两处命中判定共用同一套值，避免各自写死跑偏 */
  private float controlHitRadius(int index) {
    return (index == 2 || index == 4 ? dp(30) : dp(26)) * iconScale();
  }

  /** 设置行每项的命中半径（9 个色点 + 字号 ± 共用） */
  private float settingsHitRadius(float itemSpacing) {
    return Math.max(dp(14) * iconScale(), itemSpacing * 0.34f);
  }

  private boolean hit(float x, float y, float cx, float cy, float radius) {
    float dx = x - cx;
    float dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  }

  private void dispatch(String action, String value, String extra) {
    if (listener != null) listener.onAction(action, value, extra);
  }
}
