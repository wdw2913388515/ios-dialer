/**
 * iOS风格拨号键盘的JavaScript交互逻辑
 * 提供触摸、鼠标和键盘事件处理，以及拨号动画效果
 */

// 音频配置全局变量
let audioFolder = 'wav001'; // 默认音频文件夹路径
let maxConcurrentAudios = 12; // 默认最大并发音频数量 - 增加到12以支持所有按钮同时按下
let audioFadeOutDuration = 1200; // 默认音频淡出时间（毫秒）- 调整为更适合钢琴效果的时间

// 颜色配置全局变量
let keyNormalColor = '#e0e0e0'; // iosKey默认值
let keyPressedColor = '#A0AEC0'; // gray-400
let numberNormalColor = '#000000'; // iosText默认值
let numberPressedColor = '#000000'; // 默认与正常状态相同
let letterNormalColor = '#8e8e93'; // iosSecondText默认值
let letterPressedColor = '#8e8e93'; // 默认与正常状态相同

// 图片功能配置全局变量
let isImageFeatureEnabled = true; // 默认启用图片功能，方便测试和使用
let imageLayer = 'above'; // 默认图片层级：显示在数字和字母上方
// 图片动画时间配置全局变量
let imagePressAnimationDuration = 150; // 默认图片按下动画时间（毫秒）
let imageReleaseAnimationDuration = 150; // 默认图片松手动画时间（毫秒）

/**
 * ====================================================================
 * 按钮触摸大小变换控制器（TouchSizeController）
 * 对应后台「按钮触摸大小变换设置」板块
 * 读取 localStorage 键名：dialerButtonTouchSize
 * 支持五种模式：
 *   - pressEnlarge：按下放大、松手恢复（统一放大尺寸）
 *   - continuous：连续触摸阶梯式变化（每个按钮独立配置）
 *   - othersShrink：按下放大 + 其余按钮自动缩小（聚焦效果）
 *   - ripple：水滴涟漪效果（按下按钮周围按距离阶梯缩小）
 *   - textPreviewScale：额外文本块2号文字效果预览与连续三次触摸放大绑定（模式5）
 * ====================================================================
 */
const TouchSizeController = (function () {
    // localStorage 存储键（与后台一致）
    const STORAGE_KEY = 'dialerButtonTouchSize';

    // 默认配置（与后台 DEFAULT_CONFIG 一致）
    const DEFAULT_CONFIG = {
        mode: 'disabled',
        pressEnlarge: { size: 120, pressDuration: 150, releaseDuration: 150 },
        continuous: {
            pressDuration: 150, releaseDuration: 150, resetInterval: 800,
            buttons: ['1','2','3','4','5','6','7','8','9','*','0','#'].map(k => ({
                key: k, enabled: false, count: 3, sizes: [10, 20, 50],
                // 涟漪子配置（模式2内嵌模式4效果）
                ripple: {
                    enabled: false,        // 是否启用涟漪
                    triggerAt: 2,            // 第几次连续触摸时触发涟漪
                    pressSize: 120,         // 被按下按钮的放大尺寸（%）
                    pressDuration: 150,    // 被按下按钮的放大动画时间
                    othersSize: 80,         // 距离=1 的按钮的缩小尺寸（%）
                    othersDuration: 150,    // 周围按钮缩小动画时间
                    gravity: 3,             // 重力感（响应范围 1-6）
                    releaseDuration: 150    // 松手后全部按钮恢复动画时间
                }
            }))
        },
        othersShrink: {
            pressSize: 120,        // 被按下按钮的放大尺寸（%）
            pressDuration: 150,    // 被按下按钮的放大动画时间
            othersSize: 80,        // 其余按钮的缩小尺寸（%）
            othersDuration: 150,   // 其余按钮的缩小动画时间
            releaseDuration: 150   // 松手后全部按钮恢复动画时间
        },
        ripple: {
            pressSize: 120,        // 被按下按钮的放大尺寸（%）
            pressDuration: 150,    // 被按下按钮的放大动画时间
            othersSize: 80,        // 距离=1 的按钮的缩小尺寸（%）
            othersDuration: 150,   // 周围按钮缩小动画时间
            gravity: 3,            // 重力感（响应范围 1-6）
            releaseDuration: 150   // 松手后全部按钮恢复动画时间
        },
        textPreviewScale: {
            scales: [1.2, 1.5, 2.0],
            animationDuration: 300,
            restoreDuration: 500,
            triggerThreshold: 0
        }
    };

    // 拨号键盘 4 行 3 列布局，用于计算按钮间距离
    // 行号 0~3，列号 0~2
    // '*' 键用字符串 'star' 内部表示？不，实际 data-key 为 '*'
    const KEY_POSITIONS = {
        '1': [0, 0], '2': [0, 1], '3': [0, 2],
        '4': [1, 0], '5': [1, 1], '6': [1, 2],
        '7': [2, 0], '8': [2, 1], '9': [2, 2],
        '*': [3, 0], '0': [3, 1], '#': [3, 2]
    };

    // 运行时状态：每个按钮的连续触摸计数与上次按下时间戳
    // 结构：{ '1': { count: 0, lastTime: 0 }, ... }
    const continuousState = {};

    // 模式5运行时状态：全局递增按下计数（不松手恢复，循环到最大次数后下一次按下重置）
    let mode5PressCount = 0;

    // ====================================================================
    // 模式5（字符勾选）状态机：序列放大系统
    // - 每组维护一个进度下标 progress[groupName]
    // - 锁定按钮：组内非最后一步触发的按钮，松手后保持放大不缩小
    // - 最后一步触发的按钮，松手后恢复默认并重置该组进度
    // - 切换按钮时，之前锁定的按钮恢复默认
    // ====================================================================
    let charSelectState = {
        progress: {},           // { '组1': 已触发步数, '组2': ... }  (绑定模式用)
        lastAutoTriggeredIdx: -1, // 自动模式：上次已触发放大的合并序列索引（用于去重）
        lockedEl: null,         // 当前锁定的按钮元素（松手不恢复）
        lockedKeyValue: null,   // 锁定按钮的键值
        wasLastStep: false      // 本次按下是否是最后一步（松手要恢复）
    };

    /**
     * 自动模式：将所有组合并为一个放大序列，按 absoluteIndex 排序
     * 确保文字在主页出现的顺序与放大触发顺序一致
     * @param {Array} groups - 文字组数组
     * @returns {Array} 合并后的序列 [{groupName, charIdx, scale, absoluteIndex}, ...] 按 absoluteIndex 升序
     */
    function buildMergedSequence(groups) {
        const seq = [];
        groups.forEach(g => {
            if (!g.chars) return;
            g.chars.forEach((c, idx) => {
                seq.push({
                    groupName: g.name,
                    charIdx: idx,
                    scale: c.scale || 1.0,
                    absoluteIndex: c.absoluteIndex,
                    image: c.image || null   // 图片 base64（有则按钮放大时叠加显示）
                });
            });
        });
        seq.sort((a, b) => (a.absoluteIndex || 0) - (b.absoluteIndex || 0));
        return seq;
    }

    // 当前配置（内存缓存）
    let config = loadConfig();

    /**
     * 从 localStorage 读取配置；无则返回默认配置的深拷贝
     * @returns {Object} 配置对象
     */
    function loadConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            const parsed = JSON.parse(raw);
            // 合并默认配置中可能缺失的模式5配置（兼容旧数据）
            if (!parsed.textPreviewScale) {
                parsed.textPreviewScale = JSON.parse(JSON.stringify(DEFAULT_CONFIG.textPreviewScale));
            }
            return parsed;
        } catch (e) {
            console.warn('TouchSizeController: 读取配置失败，使用默认值', e);
            return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
    }

    /**
     * 重新加载配置（供 storage 事件触发时调用）
     */
    function reload() {
        config = loadConfig();
        // 重置连续触摸状态
        for (const k in continuousState) delete continuousState[k];
        // 重置模式5状态
        mode5PressCount = 0;
    }

    /**
     * 获取当前模式
     * @returns {string} 'disabled' | 'pressEnlarge' | 'continuous'
     */
    function getMode() {
        return config.mode || 'disabled';
    }

    /**
     * 获取模式1配置
     * @returns {Object} { size, pressDuration, releaseDuration }
     */
    function getPressEnlargeConfig() {
        return config.pressEnlarge || DEFAULT_CONFIG.pressEnlarge;
    }

    /**
     * 获取模式2通用配置
     * @returns {Object} { pressDuration, releaseDuration, resetInterval }
     */
    function getContinuousCommonConfig() {
        return config.continuous || DEFAULT_CONFIG.continuous;
    }

    /**
     * 获取指定按钮的模式2个性化配置
     * @param {string} key 按钮键值（1-9、*、0、#）
     * @returns {Object|null} { enabled, count, sizes } 或 null
     */
    function getButtonConfig(key) {
        const buttons = (config.continuous && config.continuous.buttons) || [];
        return buttons.find(b => b.key === key) || null;
    }

    /**
     * 获取模式3配置（按下放大 + 其余按钮自动缩小）
     * @returns {Object} { pressSize, pressDuration, othersSize, othersDuration, releaseDuration }
     */
    function getOthersShrinkConfig() {
        return config.othersShrink || DEFAULT_CONFIG.othersShrink;
    }

    /**
     * 获取模式4配置（水滴涟漪效果）
     * @returns {Object} { pressSize, pressDuration, othersSize, othersDuration, gravity, releaseDuration }
     */
    function getRippleConfig() {
        return config.ripple || DEFAULT_CONFIG.ripple;
    }

    /**
     * 获取模式5配置（额外文本块2号文字效果预览放大）
     * @returns {Object} { scales, animationDuration, restoreDuration, triggerThreshold }
     */
    function getTextPreviewScaleConfig() {
        return config.textPreviewScale || DEFAULT_CONFIG.textPreviewScale;
    }

    /**
     * 计算两个按钮之间的曼哈顿距离（|行差| + |列差|）
     * 用于涟漪模式根据远近距离计算缩小比例
     * @param {string} keyA 按钮A 的键值
     * @param {string} keyB 按钮B 的键值
     * @returns {number} 曼哈顿距离；任一不在布局内则返回 -1
     */
    function getKeyDistance(keyA, keyB) {
        const posA = KEY_POSITIONS[keyA];
        const posB = KEY_POSITIONS[keyB];
        if (!posA || !posB) return -1;
        return Math.abs(posA[0] - posB[0]) + Math.abs(posA[1] - posB[1]);
    }

    /**
     * 根据距离与涟漪配置计算其他按钮应使用的缩放比例
     * 距离=1 → othersSize%；距离≥gravity → 100%（不缩小）
     * 中间线性插值
     * @param {number} distance 曼哈顿距离
     * @param {Object} cfg 涟漪配置
     * @returns {number} 缩放比例（1 = 100%）
     */
    function getRippleScale(distance, cfg) {
        const maxDistance = Math.max(1, cfg.gravity || 3); // 响应范围
        const baseScale = (cfg.othersSize || 80) / 100;    // 距离=1 的缩放
        if (distance <= 0) return 1;                       // 自身按钮
        if (distance > maxDistance) return 1;              // 超出范围不缩小
        if (distance === 1) return baseScale;
        if (maxDistance === 1) return baseScale;            // gravity=1 时所有响应都是 baseScale
        // 线性插值：距离1 → baseScale，距离maxDistance → 1
        const t = (distance - 1) / (maxDistance - 1);
        return baseScale + (1 - baseScale) * t;
    }

    /**
     * 获取所有 12 个按钮元素的列表（拨号键盘上的按键）
     * 通过 data-key 属性选择所有 .ios-key / .ios-key-zero 元素
     * @returns {HTMLElement[]}
     */
    function getAllKeyElements() {
        // 优先使用与拨号盘绑定的按钮选择器，包含 .ios-key 与 .ios-key-zero
        return Array.from(document.querySelectorAll('.ios-key[data-key], .ios-key-zero[data-key]'));
    }

    /**
     * 获取指定按钮的连续触摸运行时状态（不存在则初始化）
     * @param {string} key 按钮键值
     * @returns {{count: number, lastTime: number}}
     */
    function getContinuousState(key) {
        if (!continuousState[key]) {
            continuousState[key] = { count: 0, lastTime: 0 };
        }
        return continuousState[key];
    }

    /**
     * 根据当前按下次数计算按钮应使用的缩放比例
     * @param {string} key 按钮键值
     * @returns {number} 缩放比例（1 = 100% 默认大小）
     */
    function getContinuousScale(key) {
        const btnCfg = getButtonConfig(key);
        if (!btnCfg || !btnCfg.enabled) return 1; // 未启用则保持默认
        const state = getContinuousState(key);
        const common = getContinuousCommonConfig();
        const resetInterval = common.resetInterval || 800;
        const now = Date.now();

        // 超过间隔 → 重新计数
        if (state.lastTime && (now - state.lastTime) > resetInterval) {
            state.count = 0;
        }
        state.lastTime = now;

        // 推进到下一次
        state.count += 1;
        // 超过预设次数 → 回到默认大小
        const maxCount = Math.max(1, btnCfg.count || 1);
        if (state.count > maxCount) {
            state.count = 0;
            return 1;
        }
        // 取本次对应的尺寸变化（索引从0开始）
        const idx = state.count - 1;
        const sizes = Array.isArray(btnCfg.sizes) ? btnCfg.sizes : [];
        const deltaPercent = idx < sizes.length ? sizes[idx] : 0;
        // 转换为缩放比例：100% + delta% （例：delta=10 → 1.10）
        return 1 + (deltaPercent / 100);
    }

    /**
     * 判断当前按下次数是否触发涟漪（模式2内嵌模式4效果）
     * 必须在 getContinuousScale 之后调用（此时 state.count 已推进）
     * @param {string} key 按钮键值
     * @returns {Object|null} 涟漪配置对象 或 null（未触发）
     */
    function shouldTriggerRipple(key) {
        const btnCfg = getButtonConfig(key);
        if (!btnCfg || !btnCfg.enabled) return null;
        const ripple = btnCfg.ripple;
        if (!ripple || !ripple.enabled) return null;
        const state = getContinuousState(key);
        const triggerAt = Math.max(1, ripple.triggerAt || 1);
        // 当前次数与触发次数匹配时返回涟漪配置
        if (state.count === triggerAt) return ripple;
        return null;
    }

    /**
     * 应用按下时的尺寸变换
     * @param {HTMLElement} keyElement 按钮元素
     * @param {string} keyValue 按钮键值
     */
    function applyOnPress(keyElement, keyValue) {
        if (!keyElement) return;
        const mode = getMode();
        if (mode === 'disabled') return;

        if (mode === 'pressEnlarge') {
            // 模式1：按下放大、松手恢复
            const cfg = getPressEnlargeConfig();
            const scale = (cfg.size || 100) / 100;
            const duration = cfg.pressDuration || 0;
            applyTransform(keyElement, scale, duration);
        } else if (mode === 'continuous') {
            // 模式2：连续触摸阶梯式变化（可选内嵌涟漪效果）
            const scale = getContinuousScale(keyValue);
            const common = getContinuousCommonConfig();
            const duration = common.pressDuration || 0;
            applyTransform(keyElement, scale, duration);
            // 检查是否触发涟漪（模式2 + 涟漪混合）
            const ripple = shouldTriggerRipple(keyValue);
            if (ripple) {
                // 触发涟漪时覆盖被按下按钮的放大尺寸为涟漪的 pressSize
                const rippleScale = (ripple.pressSize || 100) / 100;
                const rippleDur = ripple.pressDuration || duration;
                applyTransform(keyElement, rippleScale, rippleDur);
                // 让周围按钮按距离阶梯缩小（与模式4相同）
                const othersDur = ripple.othersDuration || 0;
                const allKeys = getAllKeyElements();
                allKeys.forEach(el => {
                    if (el === keyElement) return;
                    const otherKey = el.getAttribute('data-key');
                    if (!otherKey) return;
                    const distance = getKeyDistance(keyValue, otherKey);
                    if (distance <= 0) return;
                    const otherScale = getRippleScale(distance, ripple);
                    applyTransform(el, otherScale, othersDur);
                });
            }
        } else if (mode === 'othersShrink') {
            // 模式3：被按下按钮放大 + 其余按钮自动缩小（聚焦效果）
            const cfg = getOthersShrinkConfig();
            const pressScale = (cfg.pressSize || 100) / 100;     // 被按下按钮的放大比例
            const pressDur = cfg.pressDuration || 0;              // 被按下按钮的放大动画时间
            const othersScale = (cfg.othersSize || 100) / 100;   // 其余按钮的缩小比例
            const othersDur = cfg.othersDuration || 0;            // 其余按钮的缩小动画时间
            // 先放大被按下的按钮
            applyTransform(keyElement, pressScale, pressDur);
            // 再缩小其余所有按钮
            const allKeys = getAllKeyElements();
            allKeys.forEach(el => {
                if (el === keyElement) return;
                const otherKey = el.getAttribute('data-key');
                if (!otherKey) return;
                // 跳过删除按钮等非数字键（仅对 12 个拨号按钮生效）
                applyTransform(el, othersScale, othersDur);
            });
        } else if (mode === 'ripple') {
            // 模式4：水滴涟漪效果（被按下按钮放大，其余按钮按距离阶梯缩小）
            const cfg = getRippleConfig();
            const pressScale = (cfg.pressSize || 100) / 100;     // 被按下按钮的放大比例
            const pressDur = cfg.pressDuration || 0;              // 被按下按钮的放大动画时间
            const othersDur = cfg.othersDuration || 0;            // 其余按钮的缩小动画时间
            // 放大被按下的按钮
            applyTransform(keyElement, pressScale, pressDur);
            // 根据距离计算其余按钮的缩小比例（距离越远缩小越少）
            const allKeys = getAllKeyElements();
            allKeys.forEach(el => {
                if (el === keyElement) return;
                const otherKey = el.getAttribute('data-key');
                if (!otherKey) return;
                const distance = getKeyDistance(keyValue, otherKey);
                if (distance <= 0) return;
                const scale = getRippleScale(distance, cfg);
                applyTransform(el, scale, othersDur);
            });
        } else if (mode === 'textPreviewScale') {
            // 模式5：按钮递增放大循环（不松手恢复）
            // 第1次按下 → scales[0]；第2次 → scales[1]；第3次 → scales[2]；
            // 按下次数超过 scales.length → 恢复 scale(1) 并重置计数
            const cfg = getTextPreviewScaleConfig();
            const scales = cfg.scales || [1.2, 1.5, 2.0];
            const animDuration = cfg.animationDuration || 300;

            mode5PressCount++;

            let scale;
            if (mode5PressCount > scales.length) {
                // 已走完最后一次放大 → 本次按下重置为初始大小
                scale = 1;
                mode5PressCount = 1; // 重置计数，本次算第1次
            } else {
                scale = scales[mode5PressCount - 1];
            }

            applyTransform(keyElement, scale, animDuration);
        } else if (mode === 'charSelect') {
            // 模式5（字符勾选）：根据全局开关走两种模式
            // - 绑定模式 ON：按 buttonKey === keyValue 匹配组，每个组独立进度
            // - 自动模式 OFF：按任意按钮都走组合并序列，松手必恢复
            try {
                const groupsRaw = localStorage.getItem('dialerCharGroups');
                if (!groupsRaw) return;
                let groups = JSON.parse(groupsRaw);
                if (!groups.length) return;

                const bindMode = localStorage.getItem('dialerCharGroupBindMode') === 'on';

                if (bindMode) {
                    // ====== 绑定模式 ======
                    groups = groups.filter(g => g.chars && g.chars.length > 0 && g.buttonKey);
                    if (!groups.length) return;

                    // 切换按钮时恢复之前锁定的按钮
                    if (charSelectState.lockedEl && charSelectState.lockedEl !== keyElement) {
                        applyTransform(charSelectState.lockedEl, 1, 100);
                        removeBtnShadow(charSelectState.lockedEl);  // 🔑 清旧阴影
                        removeCharOverlay(charSelectState.lockedEl); // 🔑 清旧图片
                        charSelectState.lockedEl = null;
                        charSelectState.lockedKeyValue = null;
                    }

                    const group = groups.find(g => g.buttonKey === keyValue);
                    if (!group) {
                        charSelectState.wasLastStep = false;
                        return;
                    }

                    let progress = charSelectState.progress[group.name] || 0;
                    if (progress >= group.chars.length) progress = 0;

                    const isLast = (progress === group.chars.length - 1);
                    const char = group.chars[progress];
                    const scale = char.scale || 1.0;
                    const params = getCharImgParams();
                    charSelectState.wasLastStep = isLast;

                    console.log('[charSelect·绑定] 按钮=' + keyValue + ' → ' + group.name + ' 第' + (progress+1) + '步 scale=' + scale + ' hasImg=' + !!char.image);

                    // 🔑 关键：无图有图都处理——先叠加图片（如果有），再放大+阴影
                    if (char.image) {
                        applyCharOverlay(keyElement, char.image);
                    }

                    if (scale > 1.0) {
                        applyTransform(keyElement, scale, params.btnDur || 180);
                        applyBtnShadow(keyElement, !!char.image);  // 🔑 加阴影（无图也加！）
                    } else if (char.image) {
                        applyBtnShadow(keyElement, true);  // scale=1 但有图也加阴影
                    }

                    if (isLast) {
                        charSelectState.progress[group.name] = 0;
                        charSelectState.lockedEl = null;
                    } else {
                        charSelectState.progress[group.name] = progress + 1;
                        charSelectState.lockedEl = keyElement;
                        charSelectState.lockedKeyValue = keyValue;
                    }

                } else {
                    // ====== 自动模式 ======
                    // ⚠️ 关键：自动打字在 applyOnPress 的后半段才执行（displayedLen++）
                    // 所以这里必须延迟一帧再检查 displayedLen，否则永远少 1！
                    const bindMode = false; // 已在外面判断是自动模式
                    setTimeout(() => {
                        try {
                            // 重新从 localStorage 读一次（确保数据最新）
                            const groupsRaw2 = localStorage.getItem('dialerCharGroups');
                            if (!groupsRaw2) return;
                            let groups2 = JSON.parse(groupsRaw2);
                            groups2 = groups2.filter(g => g.chars && g.chars.length > 0);
                            if (!groups2.length) return;

                            const seq = buildMergedSequence(groups2);
                            if (seq.length === 0) return;

                            const displayedLen2 = typeof window.extraTextBlocksDisplayedLength === 'number'
                                ? window.extraTextBlocksDisplayedLength : 0;

                            console.log('[charSelect·自动] ⏳延迟检查 displayedLen=' + displayedLen2
                                + ' 已触发=' + charSelectState.lastAutoTriggeredIdx
                                + ' seqLen=' + seq.length);

                            if (displayedLen2 <= 0) return;

                            // 从后往前找 absoluteIndex < displayedLen2 的最后一个
                            let match = null;
                            for (let i = seq.length - 1; i >= 0; i--) {
                                const idx = seq[i].absoluteIndex;
                                if (idx != null && idx < displayedLen2) {
                                    match = seq[i];
                                    break;
                                }
                            }

                            if (!match) {
                                console.log('[charSelect·自动] ⏭️ 合并序列最小 idx=' + seq[0].absoluteIndex + ' > displayedLen=' + displayedLen2);
                                return;
                            }

                            console.log('[charSelect·自动] 匹配: absoluteIndex=' + match.absoluteIndex
                                + ' group=' + match.groupName + ' scale=' + match.scale
                                + ' lastTriggered=' + charSelectState.lastAutoTriggeredIdx);

                            if (match.absoluteIndex === charSelectState.lastAutoTriggeredIdx) {
                                return; // 这个字已经触发过了
                            }

                            const params = getCharImgParams();
                            const scale = match.scale || 1.0;
                            const btnDur = params.btnDur;
                            charSelectState.wasLastStep = true;
                            charSelectState.lastAutoTriggeredIdx = match.absoluteIndex;

                            if (scale > 1.0) {
                                console.log('[charSelect·自动] ✅ 触发放大 scale=' + scale + ' dur=' + btnDur);
                                // 📷 先创建 overlay（如果有图片）→ 再 applyTransform → sync 能生效
                                if (match.image) {
                                    applyCharOverlay(keyElement, match.image);
                                }
                                applyTransform(keyElement, scale, btnDur);
                                applyBtnShadow(keyElement, !!match.image);  // 💡 加放大阴影（无图也加）
                            } else {
                                console.log('[charSelect·自动] ⚠️ scale=1.0 没单独设置放大倍数，跳过');
                                if (match.image) {
                                    applyCharOverlay(keyElement, match.image);
                                    applyBtnShadow(keyElement, true);  // 💡 即使 scale=1.0，有图也加阴影
                                }
                            }
                        } catch (e) {
                            console.warn('自动模式延迟检查失败:', e);
                        }
                    }, 50); // 50ms 等打字逻辑先跑完
                }
            } catch (e) {
                console.warn('字符组匹配失败:', e);
            }
        }
    }

    /**
     * 应用松手时的尺寸恢复
     * @param {HTMLElement} keyElement 按钮元素
     * @param {string} keyValue 按钮键值
     */
    function applyOnRelease(keyElement, keyValue) {
        if (!keyElement) return;
        const mode = getMode();
        if (mode === 'disabled') return;

        if (mode === 'pressEnlarge') {
            const cfg = getPressEnlargeConfig();
            applyTransform(keyElement, 1, cfg.releaseDuration || 0);
        } else if (mode === 'continuous') {
            // 模式2松手：判断是否需要恢复默认大小
            const btnCfg = getButtonConfig(keyValue);
            if (!btnCfg || !btnCfg.enabled) {
                return; // 未启用则不变
            }
            const state = getContinuousState(keyValue);
            const maxCount = Math.max(1, btnCfg.count || 1);
            // 检查松手前是否触发了涟漪（在重置 count 之前判断）
            const ripple = btnCfg.ripple;
            const rippleTriggered = ripple && ripple.enabled && state.count === (ripple.triggerAt || 1);
            // 若已达最大次数，松手后重置状态（下次按下从头开始）
            if (state.count >= maxCount) {
                state.count = 0;
            }
            // 松手恢复默认大小
            const common = getContinuousCommonConfig();
            const releaseDur = common.releaseDuration || 0;
            applyTransform(keyElement, 1, releaseDur);
            // 如果松手前触发了涟漪，需要恢复周围按钮
            if (rippleTriggered) {
                const rippleReleaseDur = ripple.releaseDuration || releaseDur;
                const allKeys = getAllKeyElements();
                allKeys.forEach(el => {
                    if (el === keyElement) return;
                    const otherKey = el.getAttribute('data-key');
                    if (!otherKey) return;
                    applyTransform(el, 1, rippleReleaseDur);
                });
            }
        } else if (mode === 'othersShrink') {
            // 模式3松手：恢复全部按钮（被按下按钮与其余按钮）的默认大小
            const cfg = getOthersShrinkConfig();
            const releaseDur = cfg.releaseDuration || 0;
            // 恢复被按下的按钮
            applyTransform(keyElement, 1, releaseDur);
            // 恢复其余按钮
            const allKeys = getAllKeyElements();
            allKeys.forEach(el => {
                if (el === keyElement) return;
                const otherKey = el.getAttribute('data-key');
                if (!otherKey) return;
                applyTransform(el, 1, releaseDur);
            });
        } else if (mode === 'ripple') {
            // 模式4松手：恢复全部按钮（被按下按钮与周围所有按钮）的默认大小
            const cfg = getRippleConfig();
            const releaseDur = cfg.releaseDuration || 0;
            // 恢复被按下的按钮
            applyTransform(keyElement, 1, releaseDur);
            // 恢复其余按钮
            const allKeys = getAllKeyElements();
            allKeys.forEach(el => {
                if (el === keyElement) return;
                const otherKey = el.getAttribute('data-key');
                if (!otherKey) return;
                applyTransform(el, 1, releaseDur);
            });
        } else if (mode === 'charSelect') {
            // 模式5（字符勾选）松手：
            // - 最后一步触发的按钮 → 恢复默认 + 图片跟随缩小 + 同时淡出（三者同步并行）
            // - 非最后一步（已锁定）→ 保持当前大小不变
            // - 未匹配任何组 → 恢复默认 + 淡出移除
            const isLocked = (charSelectState.lockedEl === keyElement);
            if (charSelectState.wasLastStep || !isLocked) {
                const params = getCharImgParams();
                const releaseDur = params.btnDur || 180;
                // 📷 先给 overlay 设好完整的 transition（含 top/left/width/height/opacity）
                applyTransform(keyElement, 1, releaseDur);       // 按钮缩小 + 图片同步缩小
                // 📷 现在 fadeOutAndRemove 不会覆盖 transition！只会把 opacity 设为 0
                removeCharOverlay(keyElement);                    // 图片淡出（和缩小并行）
                removeBtnShadow(keyElement);
                // 三者同步开始：按钮缩小 releaseDur + 图片缩小 releaseDur + 图片淡出 fadeOut
            }
            charSelectState.wasLastStep = false;
        }
    }

    /**
     * 将缩放变换应用到按钮元素
     * @param {HTMLElement} el 按钮元素
     * @param {number} scale 缩放比例（1 = 100%）
     * @param {number} durationMs 动画时长（毫秒）
     */
    function applyTransform(el, scale, durationMs) {
        el.style.transition = durationMs > 0
            ? `transform ${durationMs}ms ease, z-index 0s`
            : 'none';
        el.style.transform = `scale(${scale})`;
        el.style.transformOrigin = 'center center';
        if (scale > 1) {
            el.style.zIndex = '50';
        } else {
            el.style.zIndex = '';
        }
        // ===== 同步更新 outside 图片 overlay（让它跟按钮同步过渡）=====
        syncOutsideOverlay(el, scale, durationMs);
    }

    /**
     * 同步 outside 图片 overlay 的位置/尺寸，跟随按钮 transform 变化
     * 图片的宽高比完全由 naturalWidth/naturalHeight 决定（自身尺寸为主），与阴影无关
     */
    function syncOutsideOverlay(btnEl, scale, durationMs) {
        const btnKey = btnEl.getAttribute('data-key') || btnEl.id || btnEl.className;
        const overlay = document.querySelector(`.char-image-overlay[data-for-btn="${btnKey}"]`);
        if (!overlay) return;
        if (!overlay.dataset.baseNatW) return;
        if (overlay._removing) return;  // 🛡️ 已在淡出移除中，不要再改尺寸/位置

        const params = getCharImgParams();
        // ===== 图片比例：完全由 natural 尺寸决定（与阴影参数彻底解耦）=====
        const natW = parseFloat(overlay.dataset.baseNatW);
        const natH = parseFloat(overlay.dataset.baseNatH);
        const baseW = parseFloat(overlay.dataset.baseBtnSize);  // base scale=1 时的按钮直径

        let w, h;
        if (params.outsideFit === 'height') {
            h = baseW * scale;
            w = h * natW / natH;
        } else {
            w = baseW * scale;
            h = w * natH / natW;
        }

        // 按钮当前中心（getBoundingClientRect 已包含 transform scale）
        const rect = btnEl.getBoundingClientRect();
        const left = rect.left + rect.width / 2 - w / 2;
        const top = rect.top + rect.height / 2 - h / 2;

        // 跟按钮相同的过渡时间 → 完美同步放大/恢复
        overlay.style.transition = durationMs > 0
            ? `top ${durationMs}ms ease, left ${durationMs}ms ease, width ${durationMs}ms ease, height ${durationMs}ms ease, opacity ${params.fadeIn}ms ease`
            : 'none';
        overlay.style.width = w + 'px';
        overlay.style.height = h + 'px';
        overlay.style.left = left + 'px';
        overlay.style.top = top + 'px';
    }

    /**
     * 从 localStorage 读取图片叠加参数
     */
    function getCharImgParams() {
        try {
            const raw = localStorage.getItem('dialerCharImageParams');
            if (raw) {
                const p = JSON.parse(raw);
                const validFit = ['cover', 'contain', 'outside'];
                return {
                    fadeIn: parseInt(p.fadeIn) || 200,
                    fadeOut: parseInt(p.fadeOut) || 200,
                    btnDur: parseInt(p.btnDur) || 180,
                    objectFit: validFit.includes(p.objectFit) ? p.objectFit : 'cover',
                    outsideFit: p.outsideFit === 'height' ? 'height' : 'width',  // 新增：默认宽对齐
                    shadowEnabled: p.shadowEnabled !== false,
                    shadowColor: p.shadowColor || '#ff6b35',
                    shadowBlur: parseInt(p.shadowBlur) || 24,
                    shadowOpacity: parseFloat(p.shadowOpacity) || 0.6,
                    shadowFadeIn: parseInt(p.shadowFadeIn) || 150,
                    shadowFadeOut: parseInt(p.shadowFadeOut) || 150
                };
            }
        } catch (e) {}
        return { fadeIn: 200, fadeOut: 200, btnDur: 180, objectFit: 'cover',
            outsideFit: 'width', shadowEnabled: false, shadowColor: '#ff6b35', shadowBlur: 24, shadowOpacity: 0.6,
            shadowFadeIn: 150, shadowFadeOut: 150 };
    }

    /**
     * hex 颜色 (#ff6b35) + 透明度 → rgba(255,107,53,0.6)
     */
    function hexToRgba(hex, alpha) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    /**
     * 给按钮设置放大阴影（按下放大时调用，带淡入过渡）
     * @param {HTMLElement} btnEl 按钮元素
     * @param {boolean} hasImage 该字符是否叠加了图片（outside 模式下有图时阴影跟图片走，按钮不另加）
     */
    function applyBtnShadow(btnEl, hasImage) {
        if (!btnEl) return;
        const p = getCharImgParams();
        // 阴影总开关关闭：清除阴影并返回
        if (p.shadowEnabled === false) {
            btnEl.style.boxShadow = '';
            return;
        }
        // outside 模式且本次有图片叠加：阴影跟随图片 overlay，按钮不另加
        if (p.objectFit === 'outside' && hasImage) {
            return;
        }
        if (!p.shadowBlur || p.shadowOpacity <= 0) {
            btnEl.style.boxShadow = '';
            return;
        }
        const color = hexToRgba(p.shadowColor, p.shadowOpacity);
        const fadeIn = p.shadowFadeIn || 150;
        // 追加 box-shadow 过渡项（保留 transform 等已有过渡，避免重复累积）
        const tr = btnEl.style.transition || '';
        const cleaned = tr.split(',').filter(s => s.trim() && !/box-shadow/i.test(s)).join(',');
        btnEl.style.transition = (cleaned ? cleaned + ', ' : '') + `box-shadow ${fadeIn}ms ease`;
        btnEl.style.boxShadow = `0 0 ${p.shadowBlur}px ${color}, inset 0 0 ${Math.round(p.shadowBlur/2)}px ${color}`;
    }

    /**
     * 清除按钮放大阴影（松手恢复时调用）
     */
    /**
     * 移除按钮放大阴影（带淡出过渡，平滑消失而非瞬间消失）
     * @param {HTMLElement} btnEl 按钮元素
     */
    function removeBtnShadow(btnEl) {
        if (!btnEl) return;
        if (!btnEl.style.boxShadow) return;
        const p = getCharImgParams();
        const fadeOut = p.shadowFadeOut || 150;
        // 追加 box-shadow 过渡项（保留 transform 等已有过渡）
        const tr = btnEl.style.transition || '';
        const cleaned = tr.split(',').filter(s => s.trim() && !/box-shadow/i.test(s)).join(',');
        btnEl.style.transition = (cleaned ? cleaned + ', ' : '') + `box-shadow ${fadeOut}ms ease`;
        // 过渡到全透明阴影（不能直接清空，否则无过渡）
        btnEl.style.boxShadow = '0 0 0 rgba(0,0,0,0), inset 0 0 0 rgba(0,0,0,0)';
    }

    /**
     * 在按钮上叠加一张图片（透明度过渡 0→1）
     * objectFit 三种模式：
     *   cover   — 在按钮圆形内裁剪填满（默认）
     *   contain — 在按钮圆形内完整显示（不裁剪，可能有留白）
     *   outside — 在按钮**外部**完整显示，不受按钮圆形裁切，自适应不变形
     */
    function applyCharOverlay(btnEl, imageDataUrl) {
        if (!btnEl || !imageDataUrl) return;
        const params = getCharImgParams();
        // ===== 关键修复：快速点击同按钮时，先**立即清除** body 上所有同 data-for-btn 的旧 overlay =====
        // 不等 fadeOut 动画——因为旧的还在淡出中时，querySelector 可能拿到旧的而非新的
        const btnKey = btnEl.getAttribute('data-key') || btnEl.id || btnEl.className;
        if (params.objectFit === 'outside') {
            document.querySelectorAll(`.char-image-overlay[data-for-btn="${btnKey}"]`).forEach(el => {
                if (el.parentNode) el.parentNode.removeChild(el);  // 立即删！不等 transitionend
            });
        } else {
            // cover/contain 模式：用原来的淡出移除（在按钮内部，不会有快速点击冲突问题）
            removeCharOverlay(btnEl);
        }

        const overlay = document.createElement('img');
        overlay.src = imageDataUrl;
        overlay.className = 'char-image-overlay';
        overlay.dataset.forBtn = btnKey;

        if (params.objectFit === 'outside') {
            // ===== outside 模式：照抄 cover/contain 写法，只是位置/尺寸不同 =====
            // 先设占位样式防闪烁，挂到 body，再读 natural 尺寸
            overlay.style.cssText = 'position:fixed;opacity:0;pointer-events:none;z-index:9999;left:0;top:0;';
            document.body.appendChild(overlay);

            // dataURL 几乎瞬间完成，naturalWidth 大概率已就绪
            if (overlay.naturalWidth && overlay.naturalHeight) {
                applyOutsideLayout(overlay, btnEl, params);
            } else {
                // 极端情况还没解析完，等一帧
                requestAnimationFrame(() => {
                    applyOutsideLayout(overlay, btnEl, params);
                });
            }
            return;
        } else {
            // ===== cover / contain 模式：inside 按钮 =====
            overlay.style.cssText = [
                'position: absolute',
                'top: 0', 'left: 0',
                'width: 100%', 'height: 100%',
                `object-fit: ${params.objectFit}`,
                'border-radius: inherit',
                'pointer-events: none',
                'z-index: 60',
                'opacity: 0',
                `transition: opacity ${params.fadeIn}ms ease`,
                params.shadowEnabled !== false ? 'box-shadow: 0 0 8px rgba(0,0,0,0.2)' : '',
                '-webkit-user-drag: none',
                'user-select: none',
            ].join(';');

            const btnPos = getComputedStyle(btnEl).position;
            if (btnPos === 'static') btnEl.style.position = 'relative';
            btnEl.appendChild(overlay);
        }

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });
    }

    /**
     * outside 模式：初始化 overlay（只在创建时调一次）
     * 记录 base 尺寸后，后续位置/尺寸更新全由 syncOutsideOverlay 跟随按钮 transform 负责
     */
    function applyOutsideLayout(overlay, btnEl, params) {
        const natW = overlay.naturalWidth || 100;
        const natH = overlay.naturalHeight || 100;
        // base 尺寸用 offsetWidth/Height — 不受 transform scale 影响
        const baseBtnSize = Math.max(btnEl.offsetWidth, btnEl.offsetHeight);

        // ===== 第一次：按当前按钮 scale 算初始位置 =====
        // 读当前按钮 transform 的 scale 值（从 style 里解析）
        let currentScale = 1;
        const t = btnEl.style.transform;
        const m = t.match(/scale\(([\d.]+)\)/);
        if (m) currentScale = parseFloat(m[1]) || 1;

        let w, h;
        if (params.outsideFit === 'height') {
            h = baseBtnSize * currentScale;
            w = h * natW / natH;
        } else {
            w = baseBtnSize * currentScale;
            h = w * natH / natW;
        }

        // ===== 保存 base 信息到 data 属性（syncOutsideOverlay 后续要用）=====
        overlay.dataset.baseNatW = natW;
        overlay.dataset.baseNatH = natH;
        overlay.dataset.baseBtnSize = baseBtnSize;

        // 当前按钮中心
        const rect = btnEl.getBoundingClientRect();
        const left = rect.left + rect.width / 2 - w / 2;
        const top = rect.top + rect.height / 2 - h / 2;

        // ===== 阴影参数只影响 box-shadow，彻底不参与尺寸计算 =====
        let outsideShadow = '';
        if (params.shadowEnabled !== false && params.shadowBlur > 0 && params.shadowOpacity > 0) {
            const color = hexToRgba(params.shadowColor, params.shadowOpacity);
            outsideShadow = `box-shadow: 0 0 ${params.shadowBlur}px ${color};`;
        }

        overlay.style.cssText = [
            'position: fixed',
            `top: ${top}px`,
            `left: ${left}px`,
            `width: ${w}px`,
            `height: ${h}px`,
            'object-fit: contain',
            'pointer-events: none',
            'z-index: 9999',
            'opacity: 0',
            `transition: opacity ${params.fadeIn}ms ease`,
            outsideShadow,
            'max-width: none',
            'max-height: none',
            '-webkit-user-drag: none',
            'user-select: none',
            'will-change: transform, opacity, top, left',  // 🧊 提示浏览器提前创建合成层
        ].join(';');

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });
        console.log('[outside] init img=', natW + 'x' + natH,
            'baseBtn=', Math.round(baseBtnSize),
            'scale=', currentScale,
            'fit=', params.outsideFit);
    }

    /**
     * 移除按钮上叠加的图片（透明度过渡 1→0）
     */
    function removeCharOverlay(btnEl) {
        if (!btnEl) return;
        // 1. 先清按钮内的 overlay（cover/contain 模式）
        const inside = btnEl.querySelector('.char-image-overlay');
        if (inside) {
            fadeOutAndRemove(inside);
        }
        // 2. 再清 body 上的 outside overlay（用 data-key 唯一标识）
        const btnKey = btnEl.getAttribute('data-key') || btnEl.id || btnEl.className;
        document.querySelectorAll(`.char-image-overlay[data-for-btn="${btnKey}"]`).forEach(el => {
            fadeOutAndRemove(el);
        });
    }

    /** 通用淡出并移除 DOM */
    function fadeOutAndRemove(el) {
        if (!el || el._removing) return;
        el._removing = true;
        const params = getCharImgParams();
        // 🔑 关键：只替换 transition 里的 opacity 项（用 fadeOut duration），保留已有的 top/left/width/height 过渡
        // 这样 outside 模式下：图片尺寸跟随按钮缩小 releaseDur，同时透明度淡出 fadeOut，完美同步不卡顿
        const existing = el.style.transition || '';
        const fadeOutTrans = `opacity ${params.fadeOut}ms ease`;
        if (existing) {
            // 移除已有的 opacity 项（不管它是什么 duration）
            const cleaned = existing.split(',').map(s => s.trim()).filter(s => !s.startsWith('opacity')).join(', ');
            el.style.transition = cleaned ? cleaned + ', ' + fadeOutTrans : fadeOutTrans;
        } else {
            el.style.transition = fadeOutTrans;
        }
        el.style.opacity = '0';
        // 只等 opacity 过渡结束再移除（不被 width/height 的 transitionend 干扰）
        el.addEventListener('transitionend', function onEnd(e) {
            if (e.propertyName === 'opacity') {
                el.removeEventListener('transitionend', onEnd);
                if (el.parentNode) el.parentNode.removeChild(el);
            }
        });
    }

    // ====================================================================
    // 模式5：按钮递增放大循环（不松手恢复，走完所有次数后下一次按下重置）
    // - 每次按下任意按钮，被按按钮自动进入下一级放大
    // - 松手时不自动恢复（区别于模式1/模式2）
    // - 当放大次数超过配置的 scales 长度后，下一次按下自动回到初始大小
    // - 运行时使用全局计数器 mode5PressCount 追踪当前按下次数
    // ====================================================================

    // 暴露的公共 API
    return {
        reload,
        getMode,
        getPressEnlargeConfig,
        getContinuousCommonConfig,
        getButtonConfig,
        getOthersShrinkConfig,
        getRippleConfig,
        getTextPreviewScaleConfig,
        applyOnPress,
        applyOnRelease
    };
})();

// 监听 localStorage 变化（后台保存后实时生效）
window.addEventListener('storage', function (event) {
    if (event.key === 'dialerButtonTouchSize') {
        TouchSizeController.reload();
    }
});

/**
 * 应用拨号显示数字的样式设置（颜色和透明度）
 */
function applyNumberDisplayStyle() {
    // 确保numberDisplay元素存在
    if (!numberDisplay) return;
    
    // 清除之前可能设置的内联样式，避免样式冲突
    numberDisplay.style.removeProperty('color');
    numberDisplay.style.removeProperty('opacity');
    
    // 检查是否存在DialerDataManager并使用其设置的样式
    if (window.dialerDataManager) {
        // 优先使用getDialerNumberDisplayStyle方法
        if (dialerDataManager.getDialerNumberDisplayStyle) {
            const style = dialerDataManager.getDialerNumberDisplayStyle();
            if (style) {
                if (style.color) {
                    numberDisplay.style.color = style.color;
                }
                if (typeof style.opacity !== 'undefined') {
                    numberDisplay.style.opacity = style.opacity;
                }
            }
        } 
        // 兼容getDisplayNumberColor和getDisplayNumberOpacity方法
        else if (dialerDataManager.getDisplayNumberColor && dialerDataManager.getDisplayNumberOpacity) {
            const color = dialerDataManager.getDisplayNumberColor();
            const opacity = dialerDataManager.getDisplayNumberOpacity();
            
            if (color) {
                numberDisplay.style.color = color;
            }
            if (typeof opacity !== 'undefined') {
                numberDisplay.style.opacity = opacity;
            }
        }
    } else {
        // 如果没有DialerDataManager，使用默认样式
        numberDisplay.style.color = '#34c759';
        numberDisplay.style.opacity = 1;
    }
    
    // 强制应用样式，确保优先级
    setTimeout(() => {
        if (window.dialerDataManager && numberDisplay) {
            let color, opacity;
            
            if (dialerDataManager.getDialerNumberDisplayStyle) {
                const style = dialerDataManager.getDialerNumberDisplayStyle();
                color = style?.color || '#34c759';
                opacity = typeof style?.opacity !== 'undefined' ? style.opacity : 1;
            } else {
                color = dialerDataManager.getDisplayNumberColor ? dialerDataManager.getDisplayNumberColor() : '#34c759';
                opacity = dialerDataManager.getDisplayNumberOpacity ? dialerDataManager.getDisplayNumberOpacity() : 1;
            }
            
            // 使用setProperty方法并设置!important优先级
            numberDisplay.style.setProperty('color', color, 'important');
            numberDisplay.style.setProperty('opacity', opacity, 'important');
        }
    }, 0);
}

/**
 * 初始化音频配置
 * 从数据管理器获取最新的音频配置
 */
function initAudioConfig() {
    if (window.dialerDataManager) {
        maxConcurrentAudios = window.dialerDataManager.getMaxConcurrentAudios();
        audioFadeOutDuration = window.dialerDataManager.getAudioFadeOutDuration();
    }
}

/**
 * 初始化图片动画时间配置
 * 优先从localStorage读取设置，确保数据持久化
 */
function initImageAnimationConfig() {
    // 首先从localStorage读取，确保设置能够正确持久化
    const storedPressDuration = localStorage.getItem('imagePressAnimationDuration');
    const storedReleaseDuration = localStorage.getItem('imageReleaseAnimationDuration');
    
    if (storedPressDuration) {
        imagePressAnimationDuration = parseInt(storedPressDuration, 10);
    }
    
    if (storedReleaseDuration) {
        imageReleaseAnimationDuration = parseInt(storedReleaseDuration, 10);
    }
    
    // 然后尝试从dialerDataManager获取（如果需要覆盖localStorage的值）
    if (window.dialerDataManager) {
        if (window.dialerDataManager.getImagePressAnimationDuration) {
            const managerPressDuration = window.dialerDataManager.getImagePressAnimationDuration();
            if (managerPressDuration !== undefined) {
                imagePressAnimationDuration = managerPressDuration;
            }
        }
        
        if (window.dialerDataManager.getImageReleaseAnimationDuration) {
            const managerReleaseDuration = window.dialerDataManager.getImageReleaseAnimationDuration();
            if (managerReleaseDuration !== undefined) {
                imageReleaseAnimationDuration = managerReleaseDuration;
            }
        }
    }
    
    // 确保值在有效范围内（10-1500毫秒）
    imagePressAnimationDuration = Math.max(10, Math.min(1500, isNaN(imagePressAnimationDuration) ? 150 : imagePressAnimationDuration));
    imageReleaseAnimationDuration = Math.max(10, Math.min(1500, isNaN(imageReleaseAnimationDuration) ? 150 : imageReleaseAnimationDuration));
    
    console.log('加载的动画时间设置:', imagePressAnimationDuration, imageReleaseAnimationDuration);
}

/**
 * 应用默认颜色到按钮
 * 将颜色配置应用到拨号键盘的各个元素上
 */
function applyDefaultColors() {
    // 更新按钮背景色
    document.querySelectorAll('.ios-key, .ios-key-zero, .ios-key-delete').forEach(key => {
        key.style.backgroundColor = keyNormalColor;
    });
    
    // 更新数字颜色
    document.querySelectorAll('.ios-key > span:first-child, .ios-key-zero > span:first-child, .ios-key-delete > span:first-child').forEach(number => {
        number.style.color = numberNormalColor;
    });
    
    // 更新字母颜色
    document.querySelectorAll('.ios-key-label').forEach(letter => {
        letter.style.color = letterNormalColor;
    });
}

/**
 * 初始化拨号键盘
 * 在DOM内容加载完成后执行初始化操作
 */
    /* ==================== 模式6：按钮 3D 立体风格 ==================== */
    const BTN3D_STYLES = ['sphere', 'neumorph', 'glass', 'candy', 'keyboard'];

    /**
     * 读取模式6配置（默认关闭）
     * @returns {{enabled:boolean, style:string, keyboardPressBg:string, keyboardPressText:string, keyboardDepth:number}}
     */
    function getButton3DConfig() {
        try {
            const raw = localStorage.getItem('dialerButton3DStyle');
            if (raw) {
                const p = JSON.parse(raw);
                return {
                    enabled: !!p.enabled,
                    style: p.style || 'sphere',
                    keyboardPressBg: p.keyboardPressBg || '#e0e2e6',
                    keyboardPressText: p.keyboardPressText || '#1a1d24',
                    keyboardDepth: parseFloat(p.keyboardDepth) >= 0 ? parseFloat(p.keyboardDepth) : 3
                };
            }
        } catch (e) {}
        return { enabled: false, style: 'sphere', keyboardPressBg: '#e0e2e6', keyboardPressText: '#1a1d24', keyboardDepth: 3 };
    }

    /**
     * 注入 3D 按钮样式表（幂等，只注入一次）
     * 四种风格：sphere=经典立体圆球 neumorph=柔和拟物 glass=玻璃水晶 candy=糖果凸起
     * 注：box-shadow/background 加 !important 保证覆盖宿主样式；
     *     模式5的放大阴影会被 3D 质感替代（同时开启时以 3D 为准）
     */
    function ensureButton3DStyleTag() {
        if (document.getElementById('dialerButton3DStyleTag')) return;
        const style = document.createElement('style');
        style.id = 'dialerButton3DStyleTag';
        style.textContent = `
            [data-key].btn3d-sphere {
                background: radial-gradient(circle at 35% 30%, #fefefe, #dcdce1 45%, #a8a8b0 78%, #8b8b93) !important;
                box-shadow: 0 8px 16px rgba(0,0,0,.22), inset 0 -6px 12px rgba(0,0,0,.14), inset 0 5px 10px rgba(255,255,255,.85) !important;
            }
            [data-key].btn3d-sphere:active,
            [data-key].btn3d-sphere.btn3d-pressed {
                background: radial-gradient(circle at 35% 30%, #d4d4d9, #bcbcc3 50%, #98989f 80%) !important;
                box-shadow: inset 0 5px 12px rgba(0,0,0,.28), 0 2px 5px rgba(0,0,0,.12) !important;
            }
            [data-key].btn3d-neumorph {
                background: #e6e7eb !important;
                box-shadow: 7px 7px 14px #c3c4c8, -7px -7px 14px #ffffff !important;
            }
            [data-key].btn3d-neumorph:active,
            [data-key].btn3d-neumorph.btn3d-pressed {
                box-shadow: inset 5px 5px 10px #c3c4c8, inset -5px -5px 10px #ffffff !important;
            }
            [data-key].btn3d-glass {
                background: linear-gradient(135deg, rgba(255,255,255,.68), rgba(255,255,255,.22)) !important;
                box-shadow: 0 8px 24px rgba(31,38,135,.16), inset 0 1px 0 rgba(255,255,255,.6) !important;
                border: 1px solid rgba(255,255,255,.65) !important;
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }
            [data-key].btn3d-glass:active,
            [data-key].btn3d-glass.btn3d-pressed {
                background: linear-gradient(135deg, rgba(255,255,255,.45), rgba(255,255,255,.12)) !important;
                box-shadow: inset 0 4px 10px rgba(31,38,135,.15), 0 4px 12px rgba(31,38,135,.10) !important;
            }
            [data-key].btn3d-candy {
                background: linear-gradient(180deg, #7cc8ff, #3ba0f6 50%, #2686dc) !important;
                box-shadow: 0 11px 0 #0f5a9e, 0 14px 20px rgba(15,90,158,.35) !important;
                transition: transform .12s ease, box-shadow .12s ease !important;
            }
            [data-key].btn3d-candy:active,
            [data-key].btn3d-candy.btn3d-pressed {
                transform: translateY(7px) !important;
                box-shadow: 0 4px 0 #0f5a9e, 0 6px 10px rgba(15,90,158,.30) !important;
            }
            [data-key].btn3d-candy, [data-key].btn3d-candy * {
                color: #fff !important;
                text-shadow: 0 1px 2px rgba(0,0,0,.25);
            }
            /* 键盘按钮风格：机械键盘质感，白键帽 + 深色边框 + 底部厚边 */
            /* 按下态参数通过 CSS 变量注入，由管理页配置动态控制 */
            [data-key].btn3d-keyboard {
                background: linear-gradient(180deg, #ffffff, #f1f2f4 70%, #e2e4e8) !important;
                border: 2px solid #5a5f6b !important;
                box-shadow: 0 6px 0 #3a3f4a, 0 9px 14px rgba(0,0,0,.20) !important;
                border-radius: 14px !important;
                transition: transform .12s ease, box-shadow .12s ease, background-color .12s ease, color .12s ease !important;
            }
            [data-key].btn3d-keyboard:active,
            [data-key].btn3d-keyboard.btn3d-pressed {
                transform: translateY(var(--kb-depth, 3px)) !important;
                background: var(--kb-press-bg, #e0e2e6) !important;
                /* 底座保留一部分厚边 + 内阴影模拟键帽陷入底座 */
                box-shadow: 0 3px 0 #3a3f4a, inset 0 3px 6px rgba(0,0,0,.22), 0 5px 8px rgba(0,0,0,.16) !important;
            }
            [data-key].btn3d-keyboard:active, [data-key].btn3d-keyboard:active *,
            [data-key].btn3d-keyboard.btn3d-pressed, [data-key].btn3d-keyboard.btn3d-pressed * {
                color: var(--kb-press-text, #1a1d24) !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 应用/移除 3D 按钮风格（遍历所有拨号按钮切换 class）
     */
    function applyButton3DStyle() {
        const cfg = getButton3DConfig();
        ensureButton3DStyleTag();
        // 注入键盘风格的可配置参数到 :root（CSS 变量）
        const root = document.documentElement;
        root.style.setProperty('--kb-press-bg', cfg.keyboardPressBg || '#e0e2e6');
        root.style.setProperty('--kb-press-text', cfg.keyboardPressText || '#1a1d24');
        root.style.setProperty('--kb-depth', (cfg.keyboardDepth >= 0 ? cfg.keyboardDepth : 3) + 'px');
        const keys = document.querySelectorAll('[data-key]');
        keys.forEach(el => {
            BTN3D_STYLES.forEach(s => el.classList.remove('btn3d-' + s));
            if (cfg.enabled && BTN3D_STYLES.includes(cfg.style)) {
                el.classList.add('btn3d-' + cfg.style);
            }
        });
        console.log('[模式6·3D按钮]', cfg.enabled ? '已启用风格=' + cfg.style : '已关闭', '按钮数=' + keys.length);
    }

    // 跨标签页同步：管理页修改配置后，拨号页实时生效
    window.addEventListener('storage', function (e) {
        if (e.key === 'dialerButton3DStyle') applyButton3DStyle();
    });
    // 自动更新兑底：file:// 协议等环境 storage 事件不触发，轮询检测配置变化后自动应用
    let _lastBtn3DConfig = JSON.stringify(getButton3DConfig());
    setInterval(function () {
        try {
            const cur = JSON.stringify(getButton3DConfig());
            if (cur !== _lastBtn3DConfig) {
                _lastBtn3DConfig = cur;
                applyButton3DStyle();
            }
        } catch (e) {}
    }, 1000);

    /* ==================== 模式7：按钮 GIF 弹出效果 ==================== */
    /**
     * 读取模式7配置（默认关闭）
     * @returns {{enabled:boolean, gifDataUrl:string, loop:'infinite'|'once', scale:number, position:'center'|'top'|'bottom', onceDuration:number}}
     */
    function getGifPopupConfig() {
        try {
            const raw = localStorage.getItem('dialerButtonGifPopup');
            if (raw) {
                const p = JSON.parse(raw);
                return {
                    enabled: !!p.enabled,
                    gifDataUrl: p.gifDataUrl || '',
                    loop: p.loop === 'once' ? 'once' : 'infinite',
                    scale: (p.scale > 0) ? parseFloat(p.scale) : 1.5,
                    position: ['center', 'top', 'bottom'].includes(p.position) ? p.position : 'center',
                    onceDuration: (p.onceDuration > 0) ? parseInt(p.onceDuration) : 1200
                };
            }
        } catch (e) {}
        return { enabled: false, gifDataUrl: '', loop: 'infinite', scale: 1.5, position: 'center', onceDuration: 1200 };
    }

    /**
     * 在按钮上弹出 GIF 动画（position:fixed 挂载到 body，不受父级裁切）
     * @param {HTMLElement} keyElement - 被按下的按钮元素
     */
    function showGifPopup(keyElement) {
        const cfg = getGifPopupConfig();
        if (!cfg.enabled || !cfg.gifDataUrl) return;
        // 先清理该按钮已有的 GIF（避免快速连按堆积）
        hideGifPopup(keyElement);
        const rect = keyElement.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * cfg.scale;
        const overlay = document.createElement('img');
        overlay.src = cfg.gifDataUrl;
        overlay.dataset.forGifBtn = keyElement.getAttribute('data-key') || '';
        overlay.style.cssText = [
            'position:fixed',
            'width:' + size + 'px',
            'height:' + size + 'px',
            'object-fit:contain',
            'pointer-events:none',
            'z-index:99998',
            'opacity:0',
            'transition:opacity .15s ease'
        ].join(';');
        // 位置：center=按钮正中央对齐, top=按钮上方, bottom=按钮下方
        let top, left;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        if (cfg.position === 'top') {
            top = rect.top - size - 8;
        } else if (cfg.position === 'bottom') {
            top = rect.bottom + 8;
        } else {
            top = centerY - size / 2;
        }
        left = centerX - size / 2;
        overlay.style.left = left + 'px';
        overlay.style.top = top + 'px';
        document.body.appendChild(overlay);
        // 淡入
        requestAnimationFrame(function () { overlay.style.opacity = '1'; });
        // 注意：once 模式下不再在此自动隐藏——只要手指/鼠标未松开，GIF 一直完整显示；
        // 松手后由 hideGifPopup 根据 onceDuration 延迟淡出。
    }

    /**
     * 隐藏按钮上的 GIF 动画
     * - infinite 模式：立即淡出（松手即消失）
     * - once 模式：松手后延迟 onceDuration ms 再淡出（按住时一直显示完整 GIF）
     * @param {HTMLElement} keyElement - 被按下的按钮元素
     */
    function hideGifPopup(keyElement) {
        const cfg = getGifPopupConfig();
        const key = keyElement.getAttribute('data-key') || '';
        const list = document.querySelectorAll('img[data-for-gif-btn="' + key + '"]');
        list.forEach(function (el) {
            // 清理之前的待隐藏定时器（防止重复触发）
            if (el._gifOnceTimer) { clearTimeout(el._gifOnceTimer); el._gifOnceTimer = null; }
            if (el._removing) return;
            // 执行淡出的闭包
            const doFadeOut = function () {
                el._removing = true;
                el.style.opacity = '0';
                setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 160);
            };
            if (cfg.loop === 'once') {
                // once 模式：松手后延迟 onceDuration 再淡出
                el._gifOnceTimer = setTimeout(doFadeOut, cfg.onceDuration);
            } else {
                // infinite 模式：立即淡出
                doFadeOut();
            }
        });
    }

    // 跨标签页同步
    window.addEventListener('storage', function (e) {
        if (e.key === 'dialerButtonGifPopup') {
            // 配置变化无需立即操作 DOM，下次按键时重新读取即可
        }
    });

    /* ==================== 模式8：按钮水波纹特效 ==================== */
    /**
     * 读取模式8配置（默认关闭）
     * @returns {{enabled:boolean, color:string, duration:number, maxScale:number}}
     */
    function getRippleConfig() {
        try {
            const raw = localStorage.getItem('dialerButtonRipple');
            if (raw) {
                const p = JSON.parse(raw);
                return {
                    enabled: !!p.enabled,
                    color: p.color || 'rgba(255,255,255,0.5)',
                    duration: (p.duration > 0) ? parseInt(p.duration) : 600,
                    maxScale: (p.maxScale > 0) ? parseFloat(p.maxScale) : 4
                };
            }
        } catch (e) {}
        return { enabled: false, color: 'rgba(255,255,255,0.5)', duration: 600, maxScale: 4 };
    }

    /**
     * 在按钮指定位置生成水波纹扩散动画
     * @param {HTMLElement} keyElement - 被按下的按钮
     * @param {number} x - 相对于按钮的点击 x 坐标
     * @param {number} y - 相对于按钮的点击 y 坐标
     */
    function createRipple(keyElement, x, y) {
        const cfg = getRippleConfig();
        if (!cfg.enabled || !keyElement) return;
        // 按钮需要 relative 定位作为波纹定位的参照
        const pos = getComputedStyle(keyElement).position;
        if (pos === 'static') keyElement.style.position = 'relative';
        // 允许波纹超出按钮范围（波纹在按钮后面扩散到按钮外）
        keyElement.style.overflow = 'visible';
        // 波纹起始尺寸 = 按钮直径，放大后通过 scale 放大到 maxScale
        const size = Math.max(keyElement.offsetWidth, keyElement.offsetHeight);
        // 颜色转半透明（hex → rgba，alpha=0.5；已是 rgba 则直接用）
        let rippleColor = cfg.color;
        if (/^#/.test(rippleColor)) {
            rippleColor = hexToRgba(rippleColor, 0.5);
        }
        // 注入 keyframes（每个配置组合唯一，避免重复注入）
        const animName = 'dialerRippleAnim_' + cfg.duration + '_' + cfg.maxScale;
        const styleId = 'dialerRippleKeyframes';
        if (!document.getElementById(styleId)) {
            const st = document.createElement('style');
            st.id = styleId;
            st.textContent = '';
            document.head.appendChild(st);
        }
        const styleTag = document.getElementById(styleId);
        const keyframes = `
            @keyframes ${animName} {
                0%   { transform: scale(1);   opacity: 0;   box-shadow: 0 0 0 ${size * 0.18}px ${rippleColor}; }
                30%  { transform: scale(${1 + (cfg.maxScale - 1) * 0.3}); opacity: 1; box-shadow: 0 0 0 ${size * 0.18}px ${rippleColor}; }
                100% { transform: scale(${cfg.maxScale}); opacity: 0;   box-shadow: 0 0 0 0px ${rippleColor}; }
            }
        `;
        // 已存在同名动画则不重复写入
        if (!styleTag.textContent.includes('@keyframes ' + animName)) {
            styleTag.textContent += keyframes;
        }
        const ripple = document.createElement('span');
        ripple.className = 'dialer-ripple';
        ripple.style.cssText = [
            'position:absolute',
            'border-radius:50%',
            'width:' + size + 'px',
            'height:' + size + 'px',
            'left:' + (x - size / 2) + 'px',
            'top:' + (y - size / 2) + 'px',
            'background:transparent',                     // 内部透明
            'pointer-events:none',
            'z-index:-1',                                // 在按钮图层后面
            'animation:' + animName + ' ' + cfg.duration + 'ms ease-out forwards'
        ].join(';');
        keyElement.appendChild(ripple);
        // 动画结束后移除波纹节点
        setTimeout(function () {
            if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
        }, cfg.duration + 50);
    }

    // 跨标签页同步
    window.addEventListener('storage', function (e) {
        if (e.key === 'dialerButtonRipple') {
            // 配置变化无需立即操作 DOM，下次按键时重新读取即可
        }
    });

function initDialer() {
    // 初始化图片动画时间配置
    initImageAnimationConfig();
    // 初始化模式6：3D 立体按钮风格（默认关闭，仅在配置开启时生效）
    applyButton3DStyle();
    // 获取DOM元素
    const phoneNumberWrapper = document.getElementById('phoneNumberWrapper');
    const phoneNumberContainer = document.getElementById('phoneNumberContainer');
    const phoneNumberContent = document.getElementById('phoneNumberContent');
    const numberDisplay = document.getElementById('numberDisplay');
    const numberPlaceholder = document.getElementById('numberPlaceholder');
    const addNumberText = document.getElementById('addNumberText');
    const keyElements = document.querySelectorAll('[data-key]');
    let phoneNumberValue = '';
    let pressedKeys = {}; // 用于跟踪已按下的键，防止长按重复输入
    
    /**
     * 获取按钮的自定义图片数据
     * @param {string} buttonId - 按钮ID或特殊符号
     * @returns {string|null} - 图片数据URL或null
     */
    function getCustomButtonImage(buttonId) {
        try {
            // 检查是否启用了统一图片模式
            const isSingleImageMode = window.dialerDataManager && window.dialerDataManager.getSingleImageModeEnabled ? 
                window.dialerDataManager.getSingleImageModeEnabled() : 
                localStorage.getItem('singleImageModeEnabled') === 'true';
            
            // 如果启用了统一图片模式
            if (isSingleImageMode) {
                if (window.dialerDataManager && window.dialerDataManager.getSingleButtonImage) {
                    return window.dialerDataManager.getSingleButtonImage();
                } else {
                    // 降级处理
                    return localStorage.getItem('singleButtonImage') || null;
                }
            }
            
            // 检查是否启用了图片功能
            if (!isImageFeatureEnabled) {
                return null;
            }
            
            // 特殊按键映射: * -> 10, 0 -> 11, # -> 12
            const buttonIdMap = {                
                '*': '10',
                '0': '11',
                '#': '12'
            };
            
            // 使用映射后的ID获取图片
            const mappedButtonId = buttonIdMap[buttonId] || buttonId;
            return localStorage.getItem(`dialerButton${mappedButtonId}Image`);
        } catch (error) {
            console.warn(`获取按钮${buttonId}的自定义图片失败:`, error);
            return null;
        }
    }
    
    // 为按钮初始化图片背景（由后台控制的功能）
    function initButtonImages() {
        // 先移除已有的图片容器
        document.querySelectorAll('.key-image-container').forEach(container => {
            container.remove();
        });
        
        // 从数据管理器获取图片功能开关状态，如果没有数据管理器则使用默认值
        const isImageEnabled = window.dialerDataManager && window.dialerDataManager.getImageFeatureEnabled ? 
            window.dialerDataManager.getImageFeatureEnabled() : false;
        
        // 从数据管理器获取统一图片模式开关状态，如果没有数据管理器则使用默认值
        const isSingleImageMode = window.dialerDataManager && window.dialerDataManager.getSingleImageModeEnabled ? 
            window.dialerDataManager.getSingleImageModeEnabled() : 
            localStorage.getItem('singleImageModeEnabled') === 'true';
        
        // 从数据管理器获取图片层级设置，如果没有数据管理器则使用默认值
        const layer = window.dialerDataManager && window.dialerDataManager.getImageLayer ? 
            window.dialerDataManager.getImageLayer() : 
            localStorage.getItem('dialerImageLayer') || 'onTop';
        
        // 全局变量更新
        isImageFeatureEnabled = isImageEnabled;
        imageLayer = layer;
        
        // 如果图片功能或统一图片模式启用，则创建图片容器
        if (isImageEnabled || isSingleImageMode) {
            keyElements.forEach(key => {
                const keyValue = key.getAttribute('data-key');
                
                // 给所有按钮创建图片容器
                if (keyValue) {
                    // 为按钮创建一个图片容器，放置在按钮上方，大小与按钮一致
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'key-image-container';
                    imgContainer.style.position = 'absolute';
                    imgContainer.style.width = '100%';
                    imgContainer.style.height = '100%';
                    imgContainer.style.display = 'flex';
                    imgContainer.style.alignItems = 'center';
                    imgContainer.style.justifyContent = 'center';
                    imgContainer.style.backgroundColor = 'transparent'; // 确保图片容器背景透明
                    
                    // 根据圆形图片显示开关状态决定是否应用圆形样式
                    // 反转逻辑：开关打开时显示完整图片，关闭时显示圆形图片
                    const isFullImageEnabled = window.dialerDataManager && window.dialerDataManager.getRoundImageEnabled ? window.dialerDataManager.getRoundImageEnabled() : true;
                    if (!isFullImageEnabled) {
                        imgContainer.style.borderRadius = '50%'; // 设置圆形裁剪
                        imgContainer.style.overflow = 'hidden'; // 隐藏超出圆形的部分
                    }
                    // 根据图片层级设置调整zIndex与圆形裁剪
                    // 'onTop'       - 图片显示在数字和字母上方（图片完整显示）
                    // 'onTopCircle' - 图片显示在数字和字母上方（与原按钮圆形相同，按圆形裁剪）
                    // 'below'       - 图片显示在数字和字母下方
                    if (imageLayer === 'onTop') {
                        imgContainer.style.zIndex = '100'; // 提高z-index确保图片完全覆盖按钮内容
                        imgContainer.style.overflow = 'visible'; // 允许图片超出容器范围显示
                    } else if (imageLayer === 'onTopCircle') {
                        imgContainer.style.zIndex = '100'; // 与 onTop 相同，位于数字字母上方
                        imgContainer.style.borderRadius = '50%'; // 强制圆形裁剪（与原按钮圆形一致）
                        imgContainer.style.overflow = 'hidden'; // 隐藏超出圆形的部分
                    } else {
                        imgContainer.style.zIndex = '1';
                        imgContainer.style.overflow = isFullImageEnabled ? 'visible' : 'hidden'; // 只有在圆形模式下才隐藏溢出
                    }
                    imgContainer.style.userSelect = 'none'; // 防止文本选择
                    imgContainer.style.pointerEvents = 'none'; // 防止事件捕获
                    
                    // 保存按钮原始内容
                    const originalContent = key.innerHTML;
                    
                    // 移除按钮内所有现有内容
                    key.innerHTML = '';
                    
                    // 创建图片元素
                    const img = document.createElement('img');
                    img.draggable = false; // 禁止图片拖拽
                    img.style.backgroundColor = 'transparent'; // 确保图片元素背景透明
                    // 只使用自定义图片，不使用默认图片
                    const customImage = getCustomButtonImage(keyValue);
                    if (customImage) {
                        img.src = customImage;
                        img.style.display = 'block';
                    } else {
                        // 没有自定义图片时不设置src，保持空白
                        img.style.display = 'none';
                    }
                    
                    // 根据显示模式设置图片大小
                    if (isFullImageEnabled) {
                        // 完整显示模式：使用用户设置的图片大小
                        const fullImageSize = window.dialerDataManager && window.dialerDataManager.getFullImageSize ? window.dialerDataManager.getFullImageSize() : 80;
                        // 设置max-width和max-height来保持原始比例同时控制整体大小
                        img.style.width = 'auto';
                        img.style.height = 'auto';
                        img.style.maxWidth = fullImageSize + '%';
                        img.style.maxHeight = fullImageSize + '%';
                        img.style.objectFit = 'contain'; // 保持原始比例，完整显示图片
                    } else {
                        // 圆形显示模式：填满容器
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.objectFit = 'cover'; // 保持比例并完全覆盖容器
                    }
                    
                    img.style.opacity = '0'; // 初始状态保持透明
                    // 使用配置的图片动画时间（将毫秒转换为秒）
                    img.style.transition = 'opacity ' + (imagePressAnimationDuration / 1000) + 's ease'; // 使用配置的按下动画时间
                    
                    // 将图片添加到容器中
                    imgContainer.appendChild(img);
                    
                    // 设置按钮为相对定位，以便图片容器可以绝对定位在其中
                    key.style.position = 'relative';
                    
                    // 将图片容器添加到按钮中
                    key.appendChild(imgContainer);
                    
                    // 重新创建按钮文本内容的容器，并设置z-index确保在'below'模式下显示在图片上方
                    const textContainer = document.createElement('div');
                    textContainer.style.position = 'relative';
                    textContainer.style.zIndex = '5'; // 设置比图片容器高的z-index
                    textContainer.style.display = 'flex';
                    textContainer.style.flexDirection = 'column';
                    textContainer.style.alignItems = 'center';
                    textContainer.style.justifyContent = 'center';
                    textContainer.style.width = '100%';
                    textContainer.style.height = '100%';
                    textContainer.innerHTML = originalContent;
                    
                    // 将文本容器添加到按钮中
                    key.appendChild(textContainer);
                    
                    // 存储图片引用，方便后续更新
                    key.dataset.imageElement = 'true';
                }
            });
        }
    }
    
    /**
     * 刷新按钮图片
     * 在用户更改设置后可以调用此函数来更新按钮图片，无需刷新整个页面
     */
    function refreshButtonImages() {
        // 获取所有带有图片容器的按钮
        document.querySelectorAll('.key-image-container').forEach(container => {
            const key = container.parentElement;
            const keyValue = key.getAttribute('data-key');
            
            if (keyValue) {
                const img = container.querySelector('img');
                if (img) {
                    // 获取自定义图片
                    const customImage = getCustomButtonImage(keyValue);
                    if (customImage) {
                        img.src = customImage;
                        img.style.display = 'block';
                        img.style.opacity = '0'; // 保持初始透明状态
                    } else {
                        // 没有自定义图片时不设置src，保持空白
                        img.style.display = 'none';
                    }
                }
            }
        });
    }
    
    // 初始化图片（默认不启用）
    initButtonImages();
    
    // 为外部提供启用/禁用图片功能的方法
    window.toggleButtonImageFeature = function(enabled) {
        isImageFeatureEnabled = !!enabled;
        initButtonImages();
        console.log(`按钮图片功能已${isImageFeatureEnabled ? '启用' : '禁用'}`);
    };
    
    // 为外部提供获取图片功能状态的方法
    window.isButtonImageFeatureEnabled = function() {
        return isImageFeatureEnabled;
    };
    
    // 为外部提供刷新按钮图片的方法
    window.refreshButtonImages = function() {
        refreshButtonImages();
        console.log('按钮图片已刷新');
    };
    
    // 从localStorage加载各种颜色配置，如果没有则使用默认值
    keyNormalColor = localStorage.getItem('dialerKeyNormalColor') || '#e0e0e0'; // iosKey默认值
    keyPressedColor = localStorage.getItem('dialerKeyPressedColor') || '#A0AEC0'; // gray-400
    numberNormalColor = localStorage.getItem('dialerNumberNormalColor') || '#000000'; // iosText默认值
    numberPressedColor = localStorage.getItem('dialerNumberPressedColor') || '#000000'; // 默认与正常状态相同
    letterNormalColor = localStorage.getItem('dialerLetterNormalColor') || '#8e8e93'; // iosSecondText默认值
    letterPressedColor = localStorage.getItem('dialerLetterPressedColor') || '#8e8e93'; // 默认与正常状态相同
    
    // 为外部提供更新按钮正常颜色的方法
    window.updateKeyNormalColor = function(color) {
        keyNormalColor = color;
        localStorage.setItem('dialerKeyNormalColor', color);
        applyDefaultColors();
    }
    
    // 为外部提供更新按钮按下颜色的方法
    window.updateKeyPressedColor = function(color) {
        keyPressedColor = color;
        localStorage.setItem('dialerKeyPressedColor', color);
    }
    
    // 为外部提供更新数字正常颜色的方法
    window.updateNumberNormalColor = function(color) {
        numberNormalColor = color;
        localStorage.setItem('dialerNumberNormalColor', color);
        applyDefaultColors();
    }
    
    // 为外部提供更新数字按下颜色的方法
    window.updateNumberPressedColor = function(color) {
        numberPressedColor = color;
        localStorage.setItem('dialerNumberPressedColor', color);
    }
    
    // 为外部提供更新字母正常颜色的方法
    window.updateLetterNormalColor = function(color) {
        letterNormalColor = color;
        localStorage.setItem('dialerLetterNormalColor', color);
        applyDefaultColors();
    }
    
    // 为外部提供更新字母按下颜色的方法
    window.updateLetterPressedColor = function(color) {
        letterPressedColor = color;
        localStorage.setItem('dialerLetterPressedColor', color);
    }
    
    // 重置所有颜色为默认值
    window.resetDialerColors = function() {
        keyNormalColor = '#e0e0e0';
        keyPressedColor = '#A0AEC0';
        numberNormalColor = '#000000';
        numberPressedColor = '#000000';
        letterNormalColor = '#8e8e93';
        letterPressedColor = '#8e8e93';
        
        // 清除localStorage中的颜色设置
        localStorage.removeItem('dialerKeyNormalColor');
        localStorage.removeItem('dialerKeyPressedColor');
        localStorage.removeItem('dialerNumberNormalColor');
        localStorage.removeItem('dialerNumberPressedColor');
        localStorage.removeItem('dialerLetterNormalColor');
        localStorage.removeItem('dialerLetterPressedColor');
        
        // 应用默认颜色
        applyDefaultColors();
    }
    
    // 音频缓存对象
    const audioCache = {};
    // 当前播放的音频（单个）
    let currentPlayingAudio = null;
    // 活跃音频列表 - 用于限制并发播放数量
    const activeAudios = [];
    // 存储每个音频的超时定时器
    const audioTimers = new Map();
    
    // 预设文本数组 - 存储带颜色的预设文本
    const presetTexts = [];
    
    // 添加一个公共方法，允许外部更改音频文件夹路径
    window.setDialerAudioFolder = function(folderPath) {
        audioFolder = folderPath;
        // 清空音频缓存，确保下次播放时加载新文件夹中的音频
        Object.keys(audioCache).forEach(path => {
            if (audioCache[path]) {
                audioCache[path].pause();
            }
        });
        console.log(`拨号键盘音频文件夹已更改为: ${folderPath}`);
    };

    // 添加一个公共方法，允许外部更新音频配置
    window.updateAudioConfig = function() {
        initAudioConfig();
    };
    
    /**
     * 添加预设文本
     * @param {string} text - 预设文本内容
     * @param {string} color - 文本颜色（CSS颜色值），默认为黑色
     * @returns {number} 预设文本ID
     */
    function addPresetText(text, color = '#000000') {
        const id = Date.now(); // 使用时间戳作为唯一ID
        presetTexts.push({ id, text, color });
        console.log(`已添加预设文本: ${text} (颜色: ${color})`);
        return id;
    }
    
    /**
     * 删除预设文本
     * @param {number} id - 预设文本ID
     * @returns {boolean} 是否删除成功
     */
    function removePresetText(id) {
        const index = presetTexts.findIndex(text => text.id === id);
        if (index !== -1) {
            const removedText = presetTexts.splice(index, 1);
            console.log(`已删除预设文本: ${removedText[0].text}`);
            return true;
        }
        console.warn(`未找到ID为${id}的预设文本`);
        return false;
    }
    
    /**
     * 应用预设文本到拨号键盘显示
     * @param {number} id - 预设文本ID
     * @returns {boolean} 是否应用成功
     */
    function applyPresetText(id) {
        const presetText = presetTexts.find(text => text.id === id);
        if (presetText) {
            phoneNumberValue = presetText.text;
            // 设置预设文本颜色
            numberDisplay.style.color = presetText.color;
            updateDisplay();
            console.log(`已应用预设文本: ${presetText.text} (颜色: ${presetText.color})`);
            return true;
        }
        console.warn(`未找到ID为${id}的预设文本`);
        return false;
    }
    
    /**
     * 获取所有预设文本
     * @returns {Array} 预设文本数组
     */
    function getAllPresetTexts() {
        return [...presetTexts]; // 返回副本以避免外部直接修改
    }
    
    // 暴露预设文本相关功能给外部
    window.dialerPresets = {
        add: addPresetText,
        remove: removePresetText,
        apply: applyPresetText,
        getAll: getAllPresetTexts
    };
    
    /**
     * 播放默认按键音效
     * 当wav文件不可用或按键不是数字键时使用
     */
    function playDefaultKeySound() {
        try {
            // 使用Web Audio API创建简单的拨号音效
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 设置音效参数 - iOS风格的短促"嗒"声
            oscillator.type = 'sine';
            oscillator.frequency.value = 500; // 频率  王大伟修改默认800
            gainNode.gain.value = 0.2; // 音量
            
            // 启动音效
            oscillator.start(audioContext.currentTime);
            
            // 设置音效衰减（缓慢淡出）- 1000毫秒
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.0);
            
            // 停止音效 - 1000毫秒
            oscillator.stop(audioContext.currentTime + 1.0);
        } catch (e) {
            // 静默失败
        }
    }
    
    
    /**
     * 播放按键音效
     * @param {string} keyValue - 按键的值
     */
    function playKeySound(keyValue) {
        try {
            // 如果是1-9的数字键，或者是特殊键0、*、#，尝试播放对应的音效
            if (/^[0-9*#]$/.test(keyValue)) {
                // 停止当前正在淡出的音频动画，避免动画冲突
                if (currentPlayingAudio && currentPlayingAudio.fadeOutAnimationId) {
                    cancelAnimationFrame(currentPlayingAudio.fadeOutAnimationId);
                    currentPlayingAudio.fadeOutAnimationId = null;
                }
                
                // 确定音频文件扩展名（根据文件夹名称自动选择）
                const extension = audioFolder.toLowerCase().includes('mp3') ? 'mp3' : 'wav';
                
                // 为特殊字符映射文件名，使用指定的音频文件
                let audioFileName = keyValue;
                // 特殊映射：* -> 10, 0 -> 11, # -> 12
                if (keyValue === '*') audioFileName = '10';
                else if (keyValue === '0') audioFileName = '11';
                else if (keyValue === '#') audioFileName = '12';
                
                // 构建音频文件路径：使用相对路径，确保本地和部署后都能加载
                // audioFolder 默认 'wav001'，对应项目根目录下的 wav001/ 文件夹
                let audioPath = `./${audioFolder}/${audioFileName}.${extension}`;
                
                // 调试日志：输出当前使用的音频路径（F12 Console 可查看）
                console.log(`[音效] folder=${audioFolder} file=${audioFileName}.${extension} path=${audioPath}`);
                
                // 检查并管理活跃音频数量
                if (activeAudios.length >= maxConcurrentAudios) {
                    // 找出最早添加且音量不为0的音频
                    const audioToStop = activeAudios.find(audio => audio.volume > 0);
                    if (audioToStop) {
                        // 清除该音频的定时器
                        if (audioTimers.has(audioToStop)) {
                            clearTimeout(audioTimers.get(audioToStop));
                            audioTimers.delete(audioToStop);
                        }
                        
                        // 立即停止该音频
                        audioToStop.pause();
                        audioToStop.currentTime = 0;
                        // 从活跃列表中移除
                        const index = activeAudios.indexOf(audioToStop);
                        if (index > -1) {
                            activeAudios.splice(index, 1);
                        }
                    }
                }
                
                // 检查缓存中是否已有该音频
                if (!audioCache[audioPath]) {
                    // 创建新的Audio对象并添加到缓存
                    const newAudio = new Audio(audioPath);
                    // 监听加载错误，若失败则回退到默认 wav001 文件夹
                    newAudio.addEventListener('error', function() {
                        console.warn(`[音效] 加载失败: ${audioPath}，尝试回退到 wav001`);
                        const fallbackPath = `./wav001/${audioFileName}.wav`;
                        if (!audioCache[fallbackPath]) {
                            const fallbackAudio = new Audio(fallbackPath);
                            fallbackAudio.addEventListener('error', () => {
                                console.error(`[音效] 回退也失败: ${fallbackPath}，请检查 wav001 文件夹是否已部署`);
                            });
                            audioCache[fallbackPath] = fallbackAudio;
                        }
                        audioCache[audioPath] = audioCache[fallbackPath];
                    });
                    audioCache[audioPath] = newAudio;
                }
                
                // 获取缓存的音频对象
                const audio = audioCache[audioPath];
                
                // 清除该音频可能存在的旧定时器
                if (audioTimers.has(audio)) {
                    clearTimeout(audioTimers.get(audio));
                    audioTimers.delete(audio);
                }
                
                // 重置音频播放状态
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 1.0;
                
                // 播放音频
                audio.play().then(() => {
                    console.log(`[音效] 播放成功: ${audioPath}`);
                }).catch(error => {
                    console.error('[音效] 播放失败:', error, '路径:', audioPath);
                });
                
                // 设置定时器，确保音频在配置的淡出时间后淡出并停止
                const timer = setTimeout(() => {
                    if (audio === currentPlayingAudio || activeAudios.includes(audio)) {
                        fadeOutAudio(audio);
                    }
                    audioTimers.delete(audio);
                }, audioFadeOutDuration);
                
                audioTimers.set(audio, timer);
                
                // 更新当前播放的音频引用
                currentPlayingAudio = audio;
                
                // 添加到活跃音频列表（如果不在列表中）
                if (!activeAudios.includes(audio)) {
                    activeAudios.push(audio);
                }
            } else {
                // 对于非数字键，播放默认的按键音效
                playDefaultKeySound();
            }
        } catch (error) {
            console.error('播放按键音效时出错:', error);
            // 出错时播放默认音效作为备用
            playDefaultKeySound();
        }
    }
    
    /**
     * 音频淡出效果函数 - 实现类似钢琴的音频衰减效果
     * 当用户松手时，音频会自然地逐渐衰减到0音量，模拟钢琴按键的物理特性
     * @param {HTMLAudioElement} audio - 要淡出的音频元素
     * @param {number} duration - 淡出持续时间（毫秒），默认为配置的淡出时间
     */
    function fadeOutAudio(audio, duration = audioFadeOutDuration) {
        if (!audio) return;
        
        // 清除该音频的定时器
        if (audioTimers.has(audio)) {
            clearTimeout(audioTimers.get(audio));
            audioTimers.delete(audio);
        }
        
        // 取消该音频自身可能存在的淡出动画
        if (audio.fadeOutAnimationId) {
            cancelAnimationFrame(audio.fadeOutAnimationId);
            audio.fadeOutAnimationId = null;
        }
        
        const startVolume = audio.volume;
        const startTime = performance.now();
        
        function fadeOut(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 使用指数衰减缓动函数模拟钢琴声音的自然衰减特性
            // 这种曲线更接近真实乐器的声音衰减过程
            const decayFactor = 3; // 衰减因子，值越大衰减越快
            const easedProgress = 1 - Math.exp(-decayFactor * progress);
            audio.volume = startVolume * (1 - easedProgress);
            
            if (progress < 1) {
                audio.fadeOutAnimationId = requestAnimationFrame(fadeOut);
            } else {
                audio.volume = 0;
                // 当音量降低到0时，将音频状态重置为未播放
                audio.currentTime = 0; // 重置播放位置
                audio.pause(); // 确保音频完全停止
                if (currentPlayingAudio === audio) {
                    currentPlayingAudio = null; // 清除当前播放音频引用
                }
                // 从活跃列表中移除
                const index = activeAudios.indexOf(audio);
                if (index > -1) {
                    activeAudios.splice(index, 1);
                }
                audio.fadeOutAnimationId = null;
            }
        }
        
        fadeOut(performance.now());
    }
    
    // 添加触摸事件监听（移动设备）
    keyElements.forEach(key => {
        // 使用touchstart而不是click，以更好地控制长按行为
        key.addEventListener('touchstart', function(e) {
            // 阻止默认行为：防止浏览器合成 mousedown 事件（避免重复输入）、
            // 防止长按弹出选择/复制菜单、防止页面滚动
            e.preventDefault();
            const keyValue = this.getAttribute('data-key');
            
            // 检查键是否已经被按下，防止长按重复输入
            if (pressedKeys[keyValue]) {
                return;
            }
            
            // 标记键为已按下
            pressedKeys[keyValue] = true;
            
            // 计算触摸点相对于按钮的坐标（用于水波纹定位）
            const tRect = this.getBoundingClientRect();
            const touch = e.touches && e.touches[0];
            const tx = touch ? (touch.clientX - tRect.left) : this.offsetWidth / 2;
            const ty = touch ? (touch.clientY - tRect.top) : this.offsetHeight / 2;
            handleKeyPress(keyValue, this, tx, ty);
        });
        
        // 对于桌面设备，仍使用mousedown和mouseup事件以提供更好的交互体验
        key.addEventListener('mousedown', function(e) {
            // 跳过由触摸事件合成的鼠标事件（触摸设备已在 touchstart 中处理）
            if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) {
                return;
            }
            const keyValue = this.getAttribute('data-key');
            
            // 检查键是否已经被按下，防止长按重复输入
            if (pressedKeys[keyValue]) {
                return;
            }
            
            // 标记键为已按下
            pressedKeys[keyValue] = true;
            
            // 计算鼠标点相对于按钮的坐标（用于水波纹定位）
            const mRect = this.getBoundingClientRect();
            const mx = e.clientX - mRect.left;
            const my = e.clientY - mRect.top;
            handleKeyPress(keyValue, this, mx, my);
        });
        
        // 鼠标松开事件
        key.addEventListener('mouseup', function() {
            // 清除pressedKeys中的对应键状态
            const keyValue = this.getAttribute('data-key');
            if (keyValue) {
                delete pressedKeys[keyValue];
            }

            this.classList.remove('key-pressed');
            // 恢复按钮的默认背景颜色
            this.style.backgroundColor = keyNormalColor;
            // 恢复数字的默认颜色
            this.style.color = numberNormalColor;
            // 恢复字母的默认颜色
            const labelElement = this.querySelector('.ios-key-label');
            if (labelElement) {
                labelElement.style.color = letterNormalColor;
            }
            // 隐藏按钮图片（将透明度设置回0）
            const imgContainer = this.querySelector('.key-image-container');
            if (imgContainer) {
                const img = imgContainer.querySelector('img');
                if (img) {
                    // 设置松手动画时间
                    img.style.transition = 'opacity ' + (imageReleaseAnimationDuration / 1000) + 's ease';
                    img.style.opacity = '0'; // 松开时恢复为透明
                }
            }
            // 当鼠标松开时，使用默认淡出时间逐步降低当前播放音频的音量
            fadeOutAudio(currentPlayingAudio); // 使用配置的淡出时间实现平滑渐变
            // 模式7：隐藏 GIF 弹出
            try { hideGifPopup(this); } catch (e) {}
            // 恢复按钮的默认大小尺寸（由后台「按钮触摸大小变换设置」控制）
            if (typeof TouchSizeController !== 'undefined' && TouchSizeController.applyOnRelease) {
                TouchSizeController.applyOnRelease(this, keyValue);
            }
        });

        // 鼠标离开事件
        key.addEventListener('mouseleave', function() {
            this.classList.remove('key-pressed');
            // 恢复按钮的默认背景颜色
            this.style.backgroundColor = keyNormalColor;
            // 恢复数字的默认颜色
            this.style.color = numberNormalColor;
            // 恢复字母的默认颜色
            const labelElement = this.querySelector('.ios-key-label');
            if (labelElement) {
                labelElement.style.color = letterNormalColor;
            }
            // 隐藏按钮图片（将透明度设置回0）
            const imgContainer = this.querySelector('.key-image-container');
            if (imgContainer) {
                const img = imgContainer.querySelector('img');
                if (img) {
                    img.style.opacity = '0'; // 鼠标离开时恢复为透明
                }
            }
            // 当鼠标离开按键时，使用默认淡出时间逐步降低当前播放音频的音量
            fadeOutAudio(currentPlayingAudio); // 使用配置的淡出时间实现平滑渐变
            // 模式7：隐藏 GIF 弹出
            try { hideGifPopup(this); } catch (e) {}
            // 鼠标离开时恢复按钮的默认大小尺寸
            const mouseLeaveKeyValue = this.getAttribute('data-key');
            if (typeof TouchSizeController !== 'undefined' && TouchSizeController.applyOnRelease && mouseLeaveKeyValue) {
                TouchSizeController.applyOnRelease(this, mouseLeaveKeyValue);
            }
        });

        // 触摸结束事件
        key.addEventListener('touchend', function() {
            // 清除pressedKeys中的对应键状态
            const keyValue = this.getAttribute('data-key');
            if (keyValue) {
                delete pressedKeys[keyValue];
            }

            this.classList.remove('key-pressed');
            // 恢复按钮的默认背景颜色
            this.style.backgroundColor = keyNormalColor;
            // 恢复数字的默认颜色
            this.style.color = numberNormalColor;
            // 恢复字母的默认颜色
            const labelElement = this.querySelector('.ios-key-label');
            if (labelElement) {
                labelElement.style.color = letterNormalColor;
            }
            // 隐藏按钮图片（将透明度设置回0）
            const imgContainer = this.querySelector('.key-image-container');
            if (imgContainer) {
                const img = imgContainer.querySelector('img');
                if (img) {
                    img.style.opacity = '0'; // 触摸结束时恢复为透明
                }
            }
            // 模式7：隐藏 GIF 弹出
            try { hideGifPopup(this); } catch (e) {}
            // 当触摸结束时，使用默认淡出时间逐步降低当前播放音频的音量
            fadeOutAudio(currentPlayingAudio); // 使用配置的淡出时间实现平滑渐变
            // 触摸结束时恢复按钮的默认大小尺寸
            if (typeof TouchSizeController !== 'undefined' && TouchSizeController.applyOnRelease) {
                TouchSizeController.applyOnRelease(this, keyValue);
            }
        });
        
        // 触摸取消事件
        key.addEventListener('touchcancel', function() {
            this.classList.remove('key-pressed');
            // 恢复按钮的默认背景颜色
            this.style.backgroundColor = '';
            // 恢复数字的默认颜色
            this.style.color = '';
            // 恢复字母的默认颜色
            const labelElement = this.querySelector('.ios-key-label');
            if (labelElement) {
                labelElement.style.color = '';
            }
            // 隐藏按钮图片（将透明度设置回0）
            const imgContainer = this.querySelector('.key-image-container');
            if (imgContainer) {
                const img = imgContainer.querySelector('img');
                if (img) {
                    img.style.opacity = '0'; // 触摸取消时恢复为透明
                }
            }
            // 当触摸取消时，使用默认淡出时间逐步降低当前播放音频的音量
            fadeOutAudio(currentPlayingAudio); // 使用配置的淡出时间实现平滑渐变
        });
    });
    
    // 添加数字显示区域的点击事件
    phoneNumberWrapper.addEventListener('click', function(e) {
        // 防止点击事件冒泡或有其他副作用
        e.stopPropagation();
        console.log('数字显示区域被点击');
    });
    
    // 添加键盘事件监听
    document.addEventListener('keydown', function(e) {
        let keyValue = e.key;
        
        // 检查键是否已经被按下，防止长按重复输入
        if (pressedKeys[keyValue]) {
            return;
        }
        
        // 标记键为已按下
        pressedKeys[keyValue] = true;
        
        // 处理数字键
        if (/^[0-9]$/.test(keyValue)) {
            e.preventDefault();
            const keyElement = document.querySelector(`[data-key="${keyValue}"]`);
            // 模式6：键盘按下同步 3D 按压效果（无 3D class 时无副作用）
            if (keyElement) keyElement.classList.add('btn3d-pressed');
            handleKeyPress(keyValue, keyElement);
        }
        // 处理特殊按键映射：i -> *, o -> 0, p -> #
        else if (keyValue.toLowerCase() === 'i') {
            e.preventDefault();
            const keyElement = document.querySelector('[data-key="*"]');
            if (keyElement) keyElement.classList.add('btn3d-pressed');
            handleKeyPress('*', keyElement);
        }
        else if (keyValue.toLowerCase() === 'o') {
            e.preventDefault();
            const keyElement = document.querySelector('[data-key="0"]');
            if (keyElement) keyElement.classList.add('btn3d-pressed');
            handleKeyPress('0', keyElement);
        }
        else if (keyValue.toLowerCase() === 'p') {
            e.preventDefault();
            const keyElement = document.querySelector('[data-key="#"]');
            if (keyElement) keyElement.classList.add('btn3d-pressed');
            handleKeyPress('#', keyElement);
        }
        // 处理删除键
        else if (keyValue === 'Backspace' || keyValue === 'Delete') {
            e.preventDefault();
            deleteLastCharacter();
        }
        // 处理回车键作为拨号键（预留功能）
        else if (keyValue === 'Enter') {
            e.preventDefault();
            console.log('拨打电话:', phoneNumberValue);
        }
    });
    
    // 添加keyup事件，清除按键状态
    document.addEventListener('keyup', function(e) {
        delete pressedKeys[e.key];
        
        // 确保键盘松手后也使用配置的淡出时间实现平滑的音频渐变效果
        fadeOutAudio(currentPlayingAudio);
        
        // 清除视觉反馈
        const keyValue = e.key;
        let elementToUpdate = null;
        
        if (/^[0-9]$/.test(keyValue)) {
            elementToUpdate = document.querySelector(`[data-key="${keyValue}"]`);
        } else if (keyValue.toLowerCase() === 'i') {
            elementToUpdate = document.querySelector('[data-key="*"]');
        } else if (keyValue.toLowerCase() === 'o') {
            elementToUpdate = document.querySelector('[data-key="0"]');
        } else if (keyValue.toLowerCase() === 'p') {
            elementToUpdate = document.querySelector('[data-key="#"]');
        }
        
        if (elementToUpdate) {
            elementToUpdate.classList.remove('key-pressed');
            // 模式6：键盘松手同步移除 3D 按压效果
            elementToUpdate.classList.remove('btn3d-pressed');
            // 恢复按钮的默认背景颜色
            elementToUpdate.style.backgroundColor = keyNormalColor;
            // 恢复数字的默认颜色
            elementToUpdate.style.color = numberNormalColor;
            // 恢复字母的默认颜色
            const labelElement = elementToUpdate.querySelector('.ios-key-label');
            if (labelElement) {
                labelElement.style.color = letterNormalColor;
            }
            // 隐藏按钮图片（将透明度设置回0）
            const imgContainer = elementToUpdate.querySelector('.key-image-container');
            if (imgContainer) {
                const img = imgContainer.querySelector('img');
                if (img) {
                    // 设置松手动画时间
                    img.style.transition = 'opacity ' + (imageReleaseAnimationDuration / 1000) + 's ease';
                    img.style.opacity = '0'; // 键盘松开时恢复为透明
                }
            }
            // 键盘松开时恢复按钮的默认大小尺寸
            const dialerKey = elementToUpdate.getAttribute('data-key');
            if (typeof TouchSizeController !== 'undefined' && TouchSizeController.applyOnRelease && dialerKey) {
                TouchSizeController.applyOnRelease(elementToUpdate, dialerKey);
            }
            // 模式7：键盘松手隐藏 GIF 弹出
            try { hideGifPopup(elementToUpdate); } catch (e) {}
        }
    });
    
    // 添加拨号按钮点击事件
    document.getElementById('callButton').addEventListener('click', function() {
        if (phoneNumberValue) {
            console.log('拨打电话:', phoneNumberValue);
            // 这里可以添加实际的拨号逻辑或动画效果
            showCallingAnimation();
        }
    });
    
    /**
     * 处理按键按下事件
     * @param {string} keyValue - 按键的值
     * @param {HTMLElement} keyElement - 按键元素
     */
    function handleKeyPress(keyValue, keyElement, rippleX, rippleY) {
        // 播放按键音效，传入按键值
        playKeySound(keyValue);

        // 模式8：水波纹特效（若未传坐标则用按钮中心）
        try {
            if (rippleX === undefined || rippleY === undefined) {
                const r = keyElement.getBoundingClientRect();
                rippleX = keyElement.offsetWidth / 2;
                rippleY = keyElement.offsetHeight / 2;
            }
            createRipple(keyElement, rippleX, rippleY);
        } catch (e) {}

        // 模式7：按下按钮弹出 GIF 动画（若已启用且已上传 GIF）
        try { showGifPopup(keyElement); } catch (e) {}

        // 保存当前颜色状态
        const currentColor = numberDisplay.style.color;

        // 移除15个字符的限制，允许输入任意长度
        phoneNumberValue += keyValue;
        updateDisplay();

        // 恢复原来的颜色，但如果没有预设文本颜色，则保持默认黑色
        if (phoneNumberValue.length > keyValue.length) {
            numberDisplay.style.color = currentColor;
        } else {
            // 如果是从头开始输入数字，应用从后台管理设置的样式
            applyNumberDisplayStyle();
        }

        // 处理额外文本框的按键逐个显示模式
        if (window.dialerDataManager && window.dialerDataManager.getExtraTextFieldTypingMode()) {
            const extraTextField = document.getElementById('extraTextField');
            const extraTextFieldContent = window.dialerDataManager.getExtraTextFieldContent() || '';

            // 确保extraTextFieldDisplayedLength全局变量存在
            if (typeof window.extraTextFieldDisplayedLength === 'undefined') {
                window.extraTextFieldDisplayedLength = 0;
            }

            // 如果还有未显示的字符，显示下一个字符
            if (window.extraTextFieldDisplayedLength < extraTextFieldContent.length) {
                // 将字符串转换为数组以正确处理emoji
                const textArray = Array.from(extraTextFieldContent);

                // 获取下一个完整字符（正确处理emoji）
                const nextCharacter = textArray[window.extraTextFieldDisplayedLength];

                // 确保下一个字符存在
                if (nextCharacter !== undefined) {
                    // 更新显示内容
                    let newContent = extraTextField.textContent + nextCharacter;
                    window.extraTextFieldDisplayedLength++;

                    // 使用数据管理器处理文本溢出效果
                    if (window.dialerDataManager && window.dialerDataManager.handleTextOverflow) {
                        newContent = window.dialerDataManager.handleTextOverflow(newContent);
                    } else {
                        // 如果数据管理器不可用，使用默认的字数限制
                        if (newContent.length > 12) {
                            // 保留后面的12个字符，前面显示省略号
                            newContent = '...' + newContent.substring(newContent.length - 9);
                        }
                    }

                    // 更新文本内容
                    extraTextField.textContent = newContent;
                }

                // 应用样式设置
                if (window.dialerDataManager && window.dialerDataManager.getExtraTextFieldStyle) {
                    const style = window.dialerDataManager.getExtraTextFieldStyle();
                    if (style) {
                        if (style.fontSize) extraTextField.style.fontSize = style.fontSize + 'px';
                        if (style.fontWeight) extraTextField.style.fontWeight = style.fontWeight;
                        if (style.color) extraTextField.style.color = style.color;
                    }
                }
            }
        }

        // 处理额外文本块的按键逐个显示模式
        if (window.dialerDataManager && window.dialerDataManager.getExtraTextBlocksTypingMode()) {
            const textPreviewArea = document.getElementById('textPreviewArea');
            const extraTextBlocks = window.dialerDataManager.getExtraTextBlocks() || [];

            // 确保extraTextBlocksDisplayedLength全局变量存在
            if (typeof window.extraTextBlocksDisplayedLength === 'undefined') {
                window.extraTextBlocksDisplayedLength = 0;
            }

            // 计算所有文本块的总字符数（使用Array.from确保正确处理emoji）
            let totalCharacters = 0;
            for (let i = 0; i < extraTextBlocks.length; i++) {
                if (extraTextBlocks[i].text) {
                    totalCharacters += Array.from(extraTextBlocks[i].text).length;
                }
            }

            // 如果还有未显示的字符，显示下一个字符
            if (window.extraTextBlocksDisplayedLength < totalCharacters) {
                // 增加显示计数
                window.extraTextBlocksDisplayedLength++;

                // 显示到当前计数的所有字符
                displayTextBlocksByTypingMode(window.extraTextBlocksDisplayedLength);
            }
        }

        // 添加按键按下的视觉效果
        if (keyElement) {
            keyElement.classList.add('key-pressed');
            // 应用自定义按钮按下颜色
            keyElement.style.backgroundColor = keyPressedColor;
            
            // 应用数字按下颜色（直接修改键元素的文本颜色）
            keyElement.style.color = numberPressedColor;
            
            // 应用字母按下颜色
            const labelElement = keyElement.querySelector('.ios-key-label');
            if (labelElement) {
                labelElement.style.color = letterPressedColor;
            }
            
            // 显示按钮图片（将透明度设置为不透明）
            const imgContainer = keyElement.querySelector('.key-image-container');
            if (imgContainer) {
                // 确保图片容器背景在按钮按下时仍然透明
                imgContainer.style.backgroundColor = 'transparent';
                const img = imgContainer.querySelector('img');
                if (img) {
                    // 设置按下动画时间
                    img.style.transition = 'opacity ' + (imagePressAnimationDuration / 1000) + 's ease';
                    img.style.opacity = '1'; // 按下时变为不透明
                    // 确保图片元素背景在按钮按下时仍然透明
                    img.style.backgroundColor = 'transparent';
                }
            }

            // 应用按下时的按钮大小变换（由后台「按钮触摸大小变换设置」控制）
            if (typeof TouchSizeController !== 'undefined' && TouchSizeController.applyOnPress) {
                TouchSizeController.applyOnPress(keyElement, keyValue);
            }
        }
    }
    
    /**
     * 删除最后一个字符 - 实现电话号码和预览文本同步删除
     */
    function deleteLastCharacter() {
        // 无论电话号码是否为空，都同时处理文本和号码的删除
        
        // 处理电话号码删除
        if (phoneNumberValue.length > 0) {
            phoneNumberValue = phoneNumberValue.slice(0, -1);
            updateDisplay();
        }
        
        // 处理额外文本框的同步删除
        if (window.dialerDataManager && window.dialerDataManager.getExtraTextFieldTypingMode()) {
            const extraTextField = document.getElementById('extraTextField');
            if (extraTextField) { // 确保额外文本框元素存在
                // 确保全局变量存在
                if (typeof window.extraTextFieldDisplayedLength === 'undefined') {
                    window.extraTextFieldDisplayedLength = 0;
                }
                
                // 如果还有已显示的字符，减少显示计数
                if (window.extraTextFieldDisplayedLength > 0) {
                    window.extraTextFieldDisplayedLength--;
                    
                    // 获取完整文本内容
                    const extraTextFieldContent = window.dialerDataManager.getExtraTextFieldContent() || '';
                    
                    // 将字符串转换为数组以正确处理emoji
                    const textArray = Array.from(extraTextFieldContent);
                    
                    // 确保window.extraTextFieldDisplayedLength不为负数
                    const displayLength = Math.max(0, window.extraTextFieldDisplayedLength);
                    
                    // 只显示到当前计数的字符
                    let newContent = textArray.slice(0, displayLength).join('');
                    
                    // 使用数据管理器处理文本溢出效果
                    if (window.dialerDataManager && window.dialerDataManager.handleTextOverflow) {
                        newContent = window.dialerDataManager.handleTextOverflow(newContent);
                    } else {
                        // 如果数据管理器不可用，使用默认的字数限制
                        if (newContent.length > 12) {
                            // 保留后面的12个字符，前面显示省略号
                            newContent = '...' + newContent.substring(newContent.length - 9);
                        }
                    }
                    
                    // 更新文本内容
                    extraTextField.textContent = newContent;
                }
            }
        }
        
        // 处理额外文本块的同步删除
        if (window.dialerDataManager && window.dialerDataManager.getExtraTextBlocksTypingMode()) {
            const textPreviewArea = document.getElementById('textPreviewArea');
            const extraTextBlocks = window.dialerDataManager.getExtraTextBlocks() || [];
            
            // 确保全局变量存在
            if (typeof window.extraTextBlocksDisplayedLength === 'undefined') {
                window.extraTextBlocksDisplayedLength = 0;
            }
            
            // 减少显示计数（即使电话号码为空也减少）
            if (window.extraTextBlocksDisplayedLength > 0) {
                window.extraTextBlocksDisplayedLength = Math.max(0, window.extraTextBlocksDisplayedLength - 1);
                
                // 清空预览区域
                textPreviewArea.innerHTML = '';
                
                // 重新显示所有已显示的字符
                if (window.extraTextBlocksDisplayedLength > 0) {
                    displayTextBlocksByTypingMode(window.extraTextBlocksDisplayedLength);
                }
            }
        }
    }
    
    /**
     * 根据按键逐个显示模式，显示指定数量的字符
     * @param {number} displayLength - 要显示的字符数量
     */
    function displayTextBlocksByTypingMode(displayLength) {
        var textPreviewArea = document.getElementById('textPreviewArea');
        var extraTextBlocks = window.dialerDataManager.getExtraTextBlocks() || [];

        // 清空预览区域
        textPreviewArea.innerHTML = '';

        // 创建大背景框容器
        var mainContainer = document.createElement('div');
        mainContainer.className = 'text-blocks-main-container';

        // 创建居中的内部容器
        var innerContainer = document.createElement('div');
        innerContainer.className = 'text-blocks-inner-container';

        // 获取样式设置
        var styleSettings = window.dialerDataManager.getExtraTextFieldStyle() || {};
        var fontSize = (styleSettings.fontSize || 18) + 'px';
        var fontWeight = styleSettings.fontWeight || 'normal';

        // 获取所有文本块的文本内容和颜色信息
        var allText = '';
        var charsDisplayed = 0;
        var textBlocksWithColors = [];

        // 收集所有文本块的文本和颜色信息，直到达到指定的显示长度
        for (var i = 0; i < extraTextBlocks.length && charsDisplayed < displayLength; i++) {
            if (extraTextBlocks[i].text) {
                // 将字符串转换为数组以正确处理emoji
                var textArray = Array.from(extraTextBlocks[i].text);
                var charsToTake = Math.min(textArray.length, displayLength - charsDisplayed);
                var textPart = textArray.slice(0, charsToTake).join('');
                
                // 存储文本块的文本和颜色信息
                textBlocksWithColors.push({
                    text: textPart,
                    color: extraTextBlocks[i].color || '#000000'
                });
                
                allText += textPart;
                charsDisplayed += charsToTake;
            }
        }

        // 从localStorage获取溢出控制设置
        var savedSettings = JSON.parse(localStorage.getItem('extraTextBlock2StyleSettings') || '{}');
        var overflowTextTotalLimit = parseInt(savedSettings.overflowTextTotalLimit) || 8;
        var overflowDisplayCount = parseInt(savedSettings.overflowDisplayCount) || 8;

        // 将字符串转换为数组以正确处理emoji
        var allTextArray = Array.from(allText);

        // 检查是否需要省略号（大于等于设置的总数值时显示省略号）
        var showEllipsis = allTextArray.length >= overflowTextTotalLimit;
        var visibleText = showEllipsis ? allTextArray.slice(allTextArray.length - overflowDisplayCount).join('') : allText;

        // 创建一个临时数组来存储处理后的文本块，保留原始颜色信息
        var processedTextBlocks = [];
        
        // 处理特殊情况：保留原始文本块的颜色信息并正确处理emoji
        // 将所有文本块转换为字符数组，并处理溢出显示
        if (showEllipsis) {
            // 需要显示省略号的情况
            var visibleStartPos = allTextArray.length - overflowDisplayCount;
            var currentPos = 0;
            
            for (var i = 0; i < extraTextBlocks.length; i++) {
                if (extraTextBlocks[i].text) {
                    var blockChars = Array.from(extraTextBlocks[i].text);
                    var blockEndPos = currentPos + blockChars.length;
                    
                    // 检查这个文本块是否与可见区域有交集
                    if (currentPos < allTextArray.length && blockEndPos > visibleStartPos) {
                        // 计算这个文本块在可见区域内的部分
                        var blockVisibleStart = Math.max(0, visibleStartPos - currentPos);
                        var blockVisibleEnd = Math.min(blockChars.length, allTextArray.length - currentPos);
                        
                        if (blockVisibleEnd > blockVisibleStart) {
                            var visibleTextPart = blockChars.slice(blockVisibleStart, blockVisibleEnd).join('');
                            processedTextBlocks.push({
                                text: visibleTextPart,
                                color: extraTextBlocks[i].color || '#000000'
                            });
                        }
                    }
                    
                    currentPos = blockEndPos;
                }
            }
        } else {
            // 不需要显示省略号的情况，直接使用之前收集的文本块
            processedTextBlocks = textBlocksWithColors;
        }
        
        // 创建文本块元素，保留每个文本块的颜色信息
        for (var j = 0; j < processedTextBlocks.length; j++) {
            var block = processedTextBlocks[j];
            if (block.text) {
                // 创建单个文本块的背景div
                var backgroundDiv = document.createElement('div');
                backgroundDiv.className = 'text-block-background';
                
                // 使用文本块自身的颜色，添加透明度
                var backgroundColor = block.color + '20';
                backgroundDiv.style.backgroundColor = backgroundColor;
                
                // 创建文本span元素
                var textSpan = document.createElement('span');
                textSpan.textContent = block.text;
                textSpan.style.color = block.color; // 使用文本块自身的颜色
                textSpan.style.fontSize = fontSize;
                textSpan.style.fontWeight = fontWeight;
                textSpan.style.display = 'block';
                textSpan.style.textAlign = 'center';
                
                // 将文本span添加到背景div中
                backgroundDiv.appendChild(textSpan);
                // 将背景div添加到内部居中容器
                innerContainer.appendChild(backgroundDiv);
            }
        }
        
        // 添加内部容器到大背景框
        mainContainer.appendChild(innerContainer);
        
        // 获取位置设置
        var positionSettings = window.dialerDataManager.getTextBlocksPosition();
        
        // 创建省略号元素（如果需要），并将其放在主容器之外
            if (showEllipsis) {
                var ellipsisElement = document.createElement('div');
                ellipsisElement.className = 'text-ellipsis-element';
                ellipsisElement.style.position = 'absolute';
                
                // 应用位置设置
                ellipsisElement.style.left = positionSettings.ellipsisLeft + 'px';
                ellipsisElement.style.top = 'calc(50% + ' + positionSettings.ellipsisTop + 'px)';
                ellipsisElement.style.transform = 'translate(-100%, -50%)';
                ellipsisElement.style.marginRight = positionSettings.ellipsisMarginRight + 'px';
                
                // 应用新添加的省略号边距参数
                if (positionSettings.ellipsisMarginTop) {
                    ellipsisElement.style.marginTop = positionSettings.ellipsisMarginTop + 'px';
                }
                if (positionSettings.ellipsisMarginBottom) {
                    ellipsisElement.style.marginBottom = positionSettings.ellipsisMarginBottom + 'px';
                }
                ellipsisElement.style.fontSize = fontSize;
                
                // 获取当前可见文本区域最左边字符所在文本块的颜色
                var leftmostVisibleTextColor = '#999999'; // 默认灰色
                
                // 计算当前可见文本在原始文本中的起始位置（正确处理emoji）
                var allTextArray = Array.from(allText);
                var visibleStartPos = allTextArray.length - overflowDisplayCount;
                
                // 遍历原始文本块，找到包含可见起始位置的文本块
                var currentPos = 0;
                for (var i = 0; i < extraTextBlocks.length; i++) {
                    if (extraTextBlocks[i].text) {
                        // 正确处理emoji：将文本转换为数组
                        var blockTextArray = Array.from(extraTextBlocks[i].text);
                        var blockEndPos = currentPos + blockTextArray.length;
                        
                        // 检查可见起始位置是否在当前文本块内或之后
                        if (visibleStartPos < blockEndPos) {
                            // 找到了包含可见起始位置的文本块
                            leftmostVisibleTextColor = extraTextBlocks[i].color || '#999999';
                            break;
                        }
                        
                        currentPos = blockEndPos;
                    }
                }
                
                ellipsisElement.style.color = leftmostVisibleTextColor;
            
            ellipsisElement.style.zIndex = '10'; // 确保省略号层级高于文本块
            ellipsisElement.style.whiteSpace = 'nowrap';
            ellipsisElement.style.pointerEvents = 'none';
            ellipsisElement.textContent = '...';
            
            // 将省略号元素添加到预览区域
            textPreviewArea.appendChild(ellipsisElement);
        }
        
        // 应用主容器的位置设置
        mainContainer.style.position = 'relative';
        mainContainer.style.marginTop = positionSettings.mainContainerTop + 'px';
        mainContainer.style.marginRight = positionSettings.mainContainerRight + 'px';
        mainContainer.style.marginBottom = positionSettings.mainContainerBottom + 'px';
        mainContainer.style.marginLeft = positionSettings.mainContainerLeft + 'px';
        
        // 应用新添加的位置参数
        if (positionSettings.mainContainerVertical) {
            mainContainer.style.transform = 'translateY(' + positionSettings.mainContainerVertical + 'px)';
        }
        if (positionSettings.mainContainerHorizontal) {
            var currentTransform = mainContainer.style.transform || '';
            mainContainer.style.transform = currentTransform + (currentTransform ? ' ' : '') + 'translateX(' + positionSettings.mainContainerHorizontal + 'px)';
        }
        
        // 将大背景框添加到预览区域
        textPreviewArea.appendChild(mainContainer);
    }
    
    /**
     * 更新电话号码显示
     * 根据是否有号码输入，控制号码和"添加号码"文字的显示状态
     * 实现自动换行和字体大小调整，并在文本过长时添加省略号
     * 支持逐个数字的颜色循环显示
     */
    function updateDisplay() {
        // 获取容器和显示元素
        const containerWidth = phoneNumberContainer.clientWidth;
        
        // 计算需要显示的文本
        let displayText = phoneNumberValue || ' ';
        let displayWithEllipsis = displayText;
        let fontSize = 36; // 初始字体大小（与text-4xl保持一致）
        
        // 创建临时元素用于测量文本宽度
        let tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'nowrap'; // 不换行以准确测量单行宽度
        tempSpan.style.fontFamily = '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif';
        document.body.appendChild(tempSpan);
        
        // 如果有电话号码
        if (phoneNumberValue) {
            // 基于字数调整字体大小：第16个字时开始变小
            if (phoneNumberValue.length >= 16) {
                // 计算字体大小：只在16-19个字之间减小字体，20个字及以上保持字体不变
                const adjustedLength = Math.min(phoneNumberValue.length, 20);
                fontSize = Math.max(36 - (adjustedLength - 15) * 2, 16);
            }
            
            // 设置字体大小
            tempSpan.style.fontSize = fontSize + 'px';
            
            // 实现20个字时最左边显示省略号的效果
            if (phoneNumberValue.length > 20) {
                // 保留后面的字符，前面显示省略号
                displayWithEllipsis = '...' + phoneNumberValue.substring(phoneNumberValue.length - 17);
            } else {
                displayWithEllipsis = phoneNumberValue;
            }
        }
        
        // 清理临时元素
        document.body.removeChild(tempSpan);
        
        // 设置字体大小
        numberDisplay.style.fontSize = fontSize + 'px';
        numberDisplay.style.whiteSpace = 'normal'; // 支持换行
        
        // 尝试使用数字颜色序列
        let useNumberColorSequence = false;
        let numberColorSequence = [];
        
        // 检查是否有dialerDataManager并且可以获取数字颜色序列
        if (window.dialerDataManager && window.dialerDataManager.getNumberColorSequence) {
            const sequence = window.dialerDataManager.getNumberColorSequence();
            if (sequence && sequence.length > 0) {
                useNumberColorSequence = true;
                // 按数字标识排序，确保顺序正确
                numberColorSequence = sequence.sort((a, b) => a.number - b.number);
            }
        }
        
        // 如果有电话号码且可以使用颜色序列，逐个设置数字颜色
        if (phoneNumberValue && useNumberColorSequence) {
            // 处理省略号情况
            let prefix = '';
            let numberToDisplay = displayWithEllipsis;
            
            if (displayWithEllipsis.startsWith('...')) {
                prefix = '...';
                numberToDisplay = displayWithEllipsis.substring(3);
            }
            
            // 获取数字颜色序列整体透明度
            let sequenceOpacity = 1.0;
            if (window.dialerDataManager && window.dialerDataManager.getNumberColorSequenceOpacity) {
                sequenceOpacity = window.dialerDataManager.getNumberColorSequenceOpacity();
            }
            
            // 构建带有颜色的HTML
            let coloredHtml = prefix;
            for (let i = 0; i < numberToDisplay.length; i++) {
                // 计算应该使用的颜色索引，实现循环
                const colorIndex = i % numberColorSequence.length;
                const color = numberColorSequence[colorIndex].color;
                
                // 为每个数字创建带颜色和透明度的span
                coloredHtml += `<span style="color: ${color}; opacity: ${sequenceOpacity};">${numberToDisplay[i]}</span>`;
            }
            
            // 设置为HTML内容
            numberDisplay.innerHTML = coloredHtml;
        } else {
            // 正常显示文本并应用样式
            numberDisplay.textContent = displayWithEllipsis;
            // 应用从后台管理设置的字体颜色和透明度样式
            applyNumberDisplayStyle();
        }
        
        // 控制占位符的显示状态
        if (phoneNumberValue) {
            numberPlaceholder.style.display = 'none'; // 有号码时隐藏占位符
        } else {
            numberPlaceholder.style.display = 'block'; // 无号码时显示占位符
            numberDisplay.style.fontSize = '36px'; // 恢复默认字体大小（与text-4xl保持一致）
            applyNumberDisplayStyle(); // 应用从后台管理设置的样式
        }
        
        // 控制"添加号码"文字的显示状态
        if (phoneNumberValue) {
            // 有号码输入时，先添加visible类
            addNumberText.classList.add('visible');
            // 应用从后台管理设置的文字内容
            if (window.dialerDataManager && window.dialerDataManager.getAddNumberText) {
                const text = window.dialerDataManager.getAddNumberText();
                if (text) {
                    addNumberText.textContent = text;
                }
            }
            // 应用从后台管理设置的文字颜色
            if (window.dialerDataManager && window.dialerDataManager.getAddNumberTextColor) {
                const color = window.dialerDataManager.getAddNumberTextColor();
                if (color) {
                    addNumberText.style.color = color;
                }
            }
            // 应用从后台管理设置的可见性（透明度）
            if (window.dialerDataManager && window.dialerDataManager.getAddNumberTextVisible) {
                const visible = window.dialerDataManager.getAddNumberTextVisible();
                // 设置透明度：1为完全显示，0为完全透明
                addNumberText.style.opacity = visible ? '1' : '0';
            }
            // 应用从后台管理设置的字体大小
            if (window.dialerDataManager && window.dialerDataManager.getAddNumberTextFontSize) {
                const fontSize = window.dialerDataManager.getAddNumberTextFontSize();
                if (fontSize) {
                    addNumberText.style.fontSize = fontSize + 'px';
                }
            }
            // 应用从后台管理设置的垂直位置
            if (window.dialerDataManager && window.dialerDataManager.getAddNumberTextVerticalPosition) {
                const position = window.dialerDataManager.getAddNumberTextVerticalPosition();
                if (position) {
                    // 使用margin-top控制垂直位置
                    addNumberText.style.marginTop = position + 'px';
                }
            }
        } else {
            // 没有号码输入时，隐藏"添加号码"文字
            addNumberText.classList.remove('visible');
            // 保持已设置的颜色，只通过透明度控制隐藏
            addNumberText.style.opacity = '0';
            // 不需要清除color样式，保持用户设置的颜色
        }
        
        // 不需要自动滚动，让文本自然换行显示
    }
    
    /**
     * 显示拨号动画并显示拨打的号码，支持自动换行
     * 预设文本部分应用指定颜色，电话号码保持默认黑色
     */
    function showCallingAnimation() {
        if (phoneNumberValue) {
            // 获取默认的拨打文本，如果数据管理器可用的话
            let callText = '正在拨打☎️：';
            let textColor = '#000000'; // 默认颜色
            
            if (window.dialerDataManager) {
                const defaultText = window.dialerDataManager.getDefaultText();
                if (defaultText && defaultText.text) {
                    callText = defaultText.text;
                    if (defaultText.color) {
                        textColor = defaultText.color;
                    }
                }
            }
            
            // 隐藏占位符和"添加号码"文字
            numberPlaceholder.style.display = 'none';
            addNumberText.classList.remove('visible');
            
            // 显示当前拨打的号码，使用HTML来分别设置文本和数字的颜色和透明度
            // 从数据管理器获取电话号码的颜色和透明度设置
            let phoneNumberColor = '#34c759';
            let phoneNumberOpacity = 1;
            
            if (window.dialerDataManager) {
                if (dialerDataManager.getDialerNumberDisplayStyle) {
                    const style = dialerDataManager.getDialerNumberDisplayStyle();
                    phoneNumberColor = style?.color || phoneNumberColor;
                    phoneNumberOpacity = typeof style?.opacity !== 'undefined' ? style.opacity : phoneNumberOpacity;
                } else if (dialerDataManager.getDisplayNumberColor && dialerDataManager.getDisplayNumberOpacity) {
                    phoneNumberColor = dialerDataManager.getDisplayNumberColor() || phoneNumberColor;
                    phoneNumberOpacity = dialerDataManager.getDisplayNumberOpacity() || phoneNumberOpacity;
                }
            }
            
            numberDisplay.innerHTML = `<span style="color: ${textColor}; font-weight: bold;">${callText}</span> <span style="color: ${phoneNumberColor}; opacity: ${phoneNumberOpacity};">${phoneNumberValue}</span>`;
            numberDisplay.style.whiteSpace = 'normal'; // 确保支持换行
            
            // 获取拨号按钮元素
            const callButton = document.getElementById('callButton');
            
            // 添加动画类
            callButton.classList.add('animate-pulse');
            
            // 模拟通话结束后的恢复
            setTimeout(() => {
                callButton.classList.remove('animate-pulse');
                
                // 显示用户正在吃饭的提示（使用数据管理器中的文本）
                const defaultCallStatusText = window.dialerDataManager && window.dialerDataManager.getDefaultCallStatusText();
                const statusText = defaultCallStatusText ? defaultCallStatusText.text : '您拨打的电话用户在吃饭，请稍后再拨~';
                const statusColor = defaultCallStatusText && defaultCallStatusText.color ? defaultCallStatusText.color : '#000000';
                const statusFontSize = defaultCallStatusText && defaultCallStatusText.fontSize ? defaultCallStatusText.fontSize : 36;
                
                // 应用状态文本的颜色和字体大小设置
                numberDisplay.innerHTML = `<span style="color: ${statusColor}; font-weight: bold; font-size: ${statusFontSize}px;">${statusText}</span>`;
                numberDisplay.style.whiteSpace = 'normal'; // 确保支持换行
                
                // 清除可能残留的颜色和透明度内联样式，确保状态文本显示正确
                numberDisplay.style.removeProperty('color');
                numberDisplay.style.removeProperty('opacity');
                
                // 延迟一段时间后恢复原状
                setTimeout(() => {
                    updateDisplay(); // 调用updateDisplay来恢复正常显示
                }, 3000);
            }, 2000);
        }
    }

} // 关闭initDialer函数

// 初始化拨号键盘
document.addEventListener('DOMContentLoaded', function() {
        initDialer();
        // 初始化音频配置
        initAudioConfig();
        
        // 加载按钮1的文字
        if (window.dialerDataManager) {
            const button1Text = window.dialerDataManager.getButton1Text();
            const button1Label = document.querySelector('[data-key="1"] .ios-key-label');
            if (button1Label) {
                button1Label.textContent = button1Text;
                // 如果文字是"空"，则设置透明度为0（完全透明）
                if (button1Text === '空') {
                    button1Label.style.opacity = '0';
                } else {
                    button1Label.style.opacity = '1';
                }
            }
            
            // 初始化时应用拨号显示数字的样式设置
            const numberDisplay = document.getElementById('numberDisplay');
            if (numberDisplay) {
                // 确保在DOM完全加载后应用样式
                setTimeout(() => {
                    applyNumberDisplayStyle();
                    
                    // 添加调试日志，显示当前应用的样式设置
                    let currentStyle = '默认样式 (#34c759, 1.0)';
                    if (dialerDataManager.getDialerNumberDisplayStyle) {
                        const style = dialerDataManager.getDialerNumberDisplayStyle();
                        if (style) {
                            currentStyle = `应用样式 (${style.color || '#34c759'}, ${style.opacity !== undefined ? style.opacity : 1.0})`;
                        }
                    }
                    console.log('拨号显示样式初始化:', currentStyle);
                    
                    // 页面加载时立即应用拨号盘背景颜色、拨号按钮颜色和键盘按钮默认颜色设置
                    applyDialerBackgroundColor();
                    applyCallButtonColor();
                    // 确保在DOM完全加载后应用默认颜色
                    setTimeout(() => {
                        applyDefaultColors();
                    }, 50);
                }, 100);
            } else {
                // 即使没有找到numberDisplay，也要尝试应用背景颜色和拨号按钮颜色
                applyDialerBackgroundColor();
                applyCallButtonColor();
            }
        }
        
        // 初始化所有按钮的图片透明度
        const keyElements = document.querySelectorAll('[data-key]');
        keyElements.forEach(key => {
            const imgContainer = key.querySelector('.key-image-container');
            if (imgContainer) {
                const img = imgContainer.querySelector('img');
                if (img) {
                    img.style.opacity = '0'; // 确保初始状态是透明的
                }
            }
        });
        
        // 强制刷新所有按钮图片，确保特殊按键的图片也能正确加载
        setTimeout(() => {
            if (window.refreshButtonImages) {
                console.log('刷新所有按钮图片，确保特殊按键图片加载');
                window.refreshButtonImages();
            }
        }, 200);

        // ===== 🧊 冷启动预热：让首次交互丝滑无卡顿 =====
        setTimeout(() => {
            prewarmCharSelect();
        }, 400);
    });

    /**
     * 冷启动预热：预加载图片、强制布局、合成层提示
     * 解决首次交互卡顿问题
     */
    function prewarmCharSelect() {
        try {
            const groups = JSON.parse(localStorage.getItem('dialerCharGroups') || '[]');
            if (!groups.length) return;
            const params = getCharImgParams();
            const mode = getMode();
            if (mode !== 'charSelect') return;
            const keyElements = document.querySelectorAll('[data-key]');
            if (!keyElements.length) return;

            console.log('[prewarm] 开始预热，组数=' + groups.length
                + ' objectFit=' + params.objectFit);

            // ① 强制预热按钮布局（读一次 offsetWidth，让浏览器完成首次 layout）
            keyElements.forEach(el => {
                void el.offsetWidth;  // 触发 layout
                void el.offsetHeight;
            });

            // ② CSS will-change 提示浏览器提前创建合成层（transform/opacity 变化时直接走 GPU）
            keyElements.forEach(el => {
                // outside 模式图片在 body 上，按钮只要 transform 提示
                // cover/contain 模式按钮内部 overlay 也要提示
                el.style.willChange = 'transform';
                if (params.objectFit !== 'outside') {
                    const overlay = el.querySelector('.char-image-overlay');
                    if (overlay) overlay.style.willChange = 'opacity';
                }
            });

            // ③ 预加载所有图片（用 Image() 让浏览器解码 + 缓存）
            let preloaded = 0;
            const allImages = [];
            groups.forEach(g => {
                (g.chars || []).forEach(c => {
                    if (c.image) allImages.push(c.image);
                });
            });
            const uniqueImages = [...new Set(allImages)];  // 去重
            uniqueImages.forEach((dataUrl, idx) => {
                const img = new Image();
                img.onload = () => {
                    preloaded++;
                    // decode() 返回 Promise — 等解码完成才标记预热完毕
                    if (img.decode) {
                        img.decode().catch(() => {});  // 某些浏览器可能抛错，忽略
                    }
                    if (preloaded === uniqueImages.length) {
                        console.log('[prewarm] ✅ 图片预热完成，共 ' + uniqueImages.length + ' 张');
                    }
                };
                img.onerror = () => {
                    preloaded++;
                    if (preloaded === uniqueImages.length) {
                        console.log('[prewarm] ✅ 图片预热完成（部分失败）');
                    }
                };
                img.src = dataUrl;
            });

            // ④ outside 模式下，提前创建一个隐藏 overlay 挂到 body
            // 让 DOM 树、样式计算都提前跑一次
            if (params.objectFit === 'outside' && uniqueImages.length) {
                const probe = document.createElement('img');
                probe.className = 'char-image-overlay';
                probe.style.cssText = 'position:fixed;opacity:0;pointer-events:none;z-index:99999;left:-9999px;top:-9999px;width:1px;height:1px;';
                probe.src = uniqueImages[0];
                document.body.appendChild(probe);
                // 等它加载完自然尺寸，然后移除（仅用于预热）
                probe.onload = () => {
                    // 读取一次 naturalWidth/naturalHeight 让浏览器解码
                    void probe.naturalWidth;
                    void probe.naturalHeight;
                    void probe.getBoundingClientRect();  // 触发 body 的 layout
                    probe.remove();
                    console.log('[prewarm] ✅ outside 模式 DOM 预热完成');
                };
            }
        } catch (e) {
            console.warn('[prewarm] 预热失败:', e);
        }
    }
    
    /**
     * 应用拨号盘背景颜色设置
     * 从dialerDataManager获取保存的背景颜色，并应用到拨号盘容器
     */
    function applyDialerBackgroundColor() {
        if (window.dialerDataManager && window.dialerDataManager.getBoxBackgroundColor) {
            const boxColor = window.dialerDataManager.getBoxBackgroundColor();
            if (boxColor) {
                // 应用到整个拨号盘的背景容器
                const dialerContainer = document.querySelector('.dialer-container');
                if (dialerContainer) {
                    dialerContainer.style.backgroundColor = boxColor;
                    console.log('拨号盘背景颜色已应用:', boxColor);
                }
            }
        }
    }
    
    /**
     * 应用拨号按钮颜色、图标大小和图标类型设置
     * 从dialerDataManager获取保存的拨号按钮配置，并应用到拨号按钮元素
     */
    function applyCallButtonColor() {
        if (window.dialerDataManager && document.querySelector('.call-button')) {
            const callButton = document.querySelector('.call-button');
            
            // 应用拨号按钮颜色
            if (window.dialerDataManager.getCallButtonColor) {
                const buttonColor = window.dialerDataManager.getCallButtonColor();
                if (buttonColor) {
                    callButton.style.backgroundColor = buttonColor;
                    console.log('拨号按钮颜色已应用:', buttonColor);
                }
            }
            
            // 应用拨号按钮图标类型和大小
            if (window.dialerDataManager.getCallButtonIconType && window.dialerDataManager.getCallButtonIconSize) {
                const iconType = window.dialerDataManager.getCallButtonIconType();
                const iconSize = window.dialerDataManager.getCallButtonIconSize();
                
                // 移除现有图标元素
                const existingIcon = callButton.querySelector('i');
                if (existingIcon) {
                    existingIcon.remove();
                }
                
                // 创建新的图标元素
                const iconElement = document.createElement('i');
                
                // 根据图标类型设置Font Awesome类
                if (iconType === 'heart') {
                    iconElement.className = 'fa fa-heart';
                } else {
                    // 默认使用手机图标
                    iconElement.className = 'fa fa-phone';
                }
                
                // 应用图标大小
                if (iconSize) {
                    iconElement.style.fontSize = iconSize;
                    console.log('拨号按钮图标大小已应用:', iconSize);
                }
                
                // 添加图标到按钮
                callButton.appendChild(iconElement);
                console.log('拨号按钮图标类型已应用:', iconType);
            }
        }
    }