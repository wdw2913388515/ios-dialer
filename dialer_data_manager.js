/**
 * iOS拨号键盘数据管理中间层
 * 提供预设文本的增删改查功能，用于管理拨号界面的文本配置
 */

/**
     * 数据管理类
     * 负责存储和管理预设的文本数据，提供增删改查功能
     */
class DialerDataManager {
    constructor() {
        // 初始化预设文本数据，默认包含"拨号"并设为第一个，添加默认颜色属性
        this.presetTexts = this.loadFromStorage() || [
            { id: 1, text: '拨号', isDefault: true, color: '#000000' },
            { id: 2, text: '正在拨打☎️：', isDefault: false, color: '#000000' },
            { id: 3, text: '呼叫中：', isDefault: false, color: '#000000' }
        ];
        
        // 初始化拨打电话提示文本数据，添加字体大小属性
        this.callStatusTexts = this.loadCallStatusTexts() || [
            { id: 1, text: '您拨打的电话用户在吃饭，请稍后再拨~', isDefault: true, color: '#000000', fontSize: '16' },
            { id: 2, text: '对方暂时无法接听，请稍后再拨', isDefault: false, color: '#000000', fontSize: '16' },
            { id: 3, text: '您拨打的用户正在通话中，请稍后再拨', isDefault: false, color: '#000000', fontSize: '16' }
        ];
        
        // 初始化音频文件夹配置
        this.audioSettings = this.loadAudioSettings() || {
            currentFolder: 'wav001', // 默认音频文件夹
            availableFolders: [ // 可用的音频文件夹列表
                { id: 'wav001', name: '默认音效 (wav001)' },
                { id: 'default_mp3s/mp301', name: 'MP3音效 (mp301)' },
                { id: 'default_mp3s/wav01', name: 'WAV音效 (wav01)' },
                { id: 'default_mp3s/wdw002', name: '自定义音效1 (wdw002)' },
                { id: 'default_mp3s/wdw01', name: '自定义音效2 (wdw01)' }
        ]
        }
        
        // 初始化额外文本框内容
        this.extraTextFieldContent = this.loadExtraTextFieldContent() || '歌词文本一二三';
        // 初始化额外文本框逐个显示模式设置
        this.extraTextFieldTypingMode = this.loadExtraTextFieldTypingMode() || false;
        
        // 初始化额外文本框样式设置
        this.extraTextFieldStyle = this.loadExtraTextFieldStyle() || {
            fontSize: '24', // 默认字体大小 24px
            fontWeight: 'normal', // 默认字体粗细 normal
            color: '#000000' // 默认字体颜色 黑色
        };
        
        // 初始化图片功能开关状态
        this.imageFeatureEnabled = this.loadImageFeatureEnabled() || false;
        
        // 初始化统一图片模式开关状态
        this.singleImageModeEnabled = this.loadSingleImageModeEnabled() || false;
        
        // 初始化图片层级设置（默认显示在数字和字母上方）
        this.imageLayer = this.loadImageLayer() || 'above';
        
        // 初始化图片动画时间设置（默认150ms）
        this.imagePressAnimationDuration = this.loadImagePressAnimationDuration() || 150;
        
        // 初始化圆形图片显示开关状态
        // 只有当loadRoundImageEnabled()返回null（表示没有存储的值）时，才使用默认值true
        const savedRoundImageState = this.loadRoundImageEnabled();
        this.roundImageEnabled = savedRoundImageState !== null ? savedRoundImageState : true;
        
        // 初始化完整图片尺寸设置（默认80%）
        const savedFullImageSize = this.loadFullImageSize();
        this.fullImageSize = savedFullImageSize !== null ? savedFullImageSize : 80;
        
        this.imageReleaseAnimationDuration = this.loadImageReleaseAnimationDuration() || 150;
        
        // 初始化额外文本框字数限制设置
        this.extraTextFieldWordLimit = this.loadExtraTextFieldWordLimit() || 12; // 默认最多显示12个字
        this.extraTextFieldEllipsisLength = this.loadExtraTextFieldEllipsisLength() || 9; // 默认省略后保留9个字
        
        // 初始化额外文本块数据
        this.extraTextBlocks = this.loadExtraTextBlocks() || [
            { id: 1, text: '弟娃儿翁', color: '#ff0000' },
            { id: 2, text: '沃尔沃二新文本', color: '#0000ff' },
            { id: 3, text: '新文本沃尔沃二新文本', color: '#00ff00' }
        ];
        
        // 初始化额外文本块逐个显示模式设置
        this.extraTextBlocksTypingMode = this.loadExtraTextBlocksTypingMode() || false;
        
        // 初始化额外文本块彩色文字显示状态设置
        this.extraTextBlocksShowColors = this.loadExtraTextBlocksShowColors() || false;
        
        // 初始化额外文本块字数限制设置
        this.extraTextBlocksWordLimit = this.loadExtraTextBlocksWordLimit() || 10; // 默认最多显示10个字
        this.extraTextBlocksEllipsisLength = this.loadExtraTextBlocksEllipsisLength() || 9; // 默认省略后保留9个字
        
        // 初始化省略号与拨号数字内容  颜色和透明度设置
        this.dialerNumberDisplayStyle = this.loadDialerNumberDisplayStyle() || {
            color: '#000000', // 默认黑色
            opacity: 1 // 默认完全不透明
        };
        
        // 初始化添加号码文字颜色设置
          this.addNumberTextColor = this.loadAddNumberTextColor() || '#007AFF'; // 默认iOS蓝色
          this.addNumberTextVisible = this.loadAddNumberTextVisible() !== false; // 默认显示（透明度为1）
          
          // 初始化添加号码文字字体大小设置
          this.addNumberTextFontSize = this.loadAddNumberTextFontSize() || '16'; // 默认字体大小16px（text-sm）
          
          // 初始化添加号码文字垂直位置设置
          this.addNumberTextVerticalPosition = this.loadAddNumberTextVerticalPosition() || '4'; // 默认垂直位置4px（对应mt-1）
          
          // 初始化添加号码文字内容设置
        
        // 初始化拨号数字颜色序列设置（逐个显示的数字颜色循环）
        // 默认全部为黑色，与 resetNumberColorSequence 保持一致
        this.numberColorSequence = this.loadNumberColorSequence() || [
            { id: 1, color: '#000000' }, // 默认黑色
            { id: 2, color: '#000000' }, // 默认黑色
            { id: 3, color: '#000000' }  // 默认黑色
        ];
        // 初始化数字颜色序列整体透明度设置
        const loadedOpacity = this.loadNumberColorSequenceOpacity();
        this.numberColorSequenceOpacity = loadedOpacity !== null ? loadedOpacity : 1.0;
          this.addNumberText = this.loadAddNumberText() || '添加号码'; // 默认文字内容
          
          // 初始化整个拨号盘背景颜色设置
          this.boxBackgroundColor = this.loadBoxBackgroundColor() || '#f5f5f7'; // 默认iOS灰色背景
          
          // 初始化拨号按钮颜色设置
          this.callButtonColor = this.loadCallButtonColor() || '#34c759'; // 默认iOS绿色背景 (#34c759 对应 iosGreen)
          
          // 初始化拨号按钮图标大小设置
          this.callButtonIconSize = this.loadCallButtonIconSize() || '2rem'; // 默认图标大小
          
          // 初始化拨号按钮图标类型设置
          this.callButtonIconType = this.loadCallButtonIconType() || 'phone'; // 默认手机图标
          
          // 初始化图片功能开关状态，默认关闭
          this.imageFeatureEnabled = this.loadImageFeatureEnabled() || false;
    }

    /**
     * 从localStorage加载额外文本块字数限制设置
     * @returns {number|null} 字数限制或null
     */
    loadExtraTextBlocksWordLimit() {
        try {
            const stored = localStorage.getItem('dialerExtraTextBlocksWordLimit');
            return stored !== null ? parseInt(stored) : null;
        } catch (e) {
            console.error('加载额外文本块字数限制设置失败:', e);
            return null;
        }
    }
    
    /**
     * 从localStorage加载额外文本块省略后保留字数设置
     * @returns {number|null} 省略后保留字数或null
     */
    loadExtraTextBlocksEllipsisLength() {
        try {
            const stored = localStorage.getItem('dialerExtraTextBlocksEllipsisLength');
            return stored !== null ? parseInt(stored) : null;
        } catch (e) {
            console.error('加载额外文本块省略后保留字数设置失败:', e);
            return null;
        }
    }
    
    /**
     * 保存额外文本块字数限制设置到localStorage
     */
    saveExtraTextBlocksWordLimit() {
        try {
            localStorage.setItem('dialerExtraTextBlocksWordLimit', this.extraTextBlocksWordLimit);
        } catch (e) {
            console.error('保存额外文本块字数限制设置失败:', e);
        }
    }
    
    /**
     * 保存额外文本块省略后保留字数设置到localStorage
     */
    saveExtraTextBlocksEllipsisLength() {
        try {
            localStorage.setItem('dialerExtraTextBlocksEllipsisLength', this.extraTextBlocksEllipsisLength);
        } catch (e) {
            console.error('保存额外文本块省略后保留字数设置失败:', e);
        }
    }
    
    /**
     * 获取额外文本块字数限制设置
     * @returns {number} 字数限制
     */
    getExtraTextBlocksWordLimit() {
        return this.extraTextBlocksWordLimit;
    }
    
    /**
     * 获取额外文本块省略后保留字数设置
     * @returns {number} 省略后保留字数
     */
    getExtraTextBlocksEllipsisLength() {
        return this.extraTextBlocksEllipsisLength;
    }
    
    /**
     * 设置额外文本块字数限制
     * @param {number} limit - 字数限制
     * @returns {boolean} 设置是否成功
     */
    setExtraTextBlocksWordLimit(limit) {
        if (Number.isInteger(limit) && limit > 0 && limit <= 100) {
            this.extraTextBlocksWordLimit = limit;
            this.saveExtraTextBlocksWordLimit();
            // 如果省略后保留字数大于字数限制，自动调整
            if (this.extraTextBlocksEllipsisLength > limit) {
                this.setExtraTextBlocksEllipsisLength(limit);
            }
            return true;
        }
        return false;
    }
    
    /**
     * 设置额外文本块省略后保留字数
     * @param {number} length - 省略后保留字数
     * @returns {boolean} 设置是否成功
     */
    setExtraTextBlocksEllipsisLength(length) {
        if (Number.isInteger(length) && length > 0 && length <= this.extraTextBlocksWordLimit) {
            this.extraTextBlocksEllipsisLength = length;
            this.saveExtraTextBlocksEllipsisLength();
            return true;
        }
        return false;
    }
    
    /**
     * 处理额外文本块的文本溢出效果
     * @param {string} text - 需要处理的文本
     * @returns {string} 处理后的文本（可能包含省略号）
     */
    handleExtraTextBlocksOverflow(text) {
        if (text.length > this.extraTextBlocksWordLimit) {
            // 保留后面的字符，前面显示省略号
            // 确保始终显示最新的文本末尾部分
            return '...' + text.substring(text.length - this.extraTextBlocksEllipsisLength);
        }
        return text;
    }
    
    /**
     * 从localStorage加载额外文本块彩色文字显示状态
     * @returns {boolean} 存储的状态或false
     */
    loadExtraTextBlocksShowColors() {
        try {
            const stored = localStorage.getItem('dialerExtraTextBlocksShowColors');
            return stored === 'true';
        } catch (error) {
            console.error('加载额外文本块彩色文字显示状态失败:', error);
            return false;
        }
    }

    /**
     * 保存额外文本块彩色文字显示状态到localStorage
     */
    saveExtraTextBlocksShowColors() {
        try {
            localStorage.setItem('dialerExtraTextBlocksShowColors', this.extraTextBlocksShowColors);
        } catch (error) {
            console.error('保存额外文本块彩色文字显示状态失败:', error);
        }
    }

    /**
     * 获取额外文本块显示颜色设置
     * @returns {boolean} 是否显示颜色
     */
    getExtraTextBlocksShowColors() {
        return this.extraTextBlocksShowColors;
    }
    
    /**
     * 加载添加号码文字颜色设置
     * @returns {string} 颜色值
     */
    loadAddNumberTextColor() {
        try {
            const savedColor = localStorage.getItem('dialerAddNumberTextColor');
            return savedColor;
        } catch (error) {
            console.error('加载添加号码文字颜色设置失败:', error);
            return null;
        }
    }
    
    /**
     * 保存添加号码文字颜色设置
     * @param {string} color - 颜色值
     * @returns {boolean} 是否保存成功
     */
    saveAddNumberTextColor(color) {
        try {
            if (color && typeof color === 'string') {
                this.addNumberTextColor = color;
                localStorage.setItem('dialerAddNumberTextColor', color);
                return true;
            }
            return false;
        } catch (error) {
            console.error('保存添加号码文字颜色设置失败:', error);
            return false;
        }
    }
    
    /**
     * 获取添加号码文字颜色设置
     * @returns {string} 颜色值
     */
    getAddNumberTextColor() {
        return this.addNumberTextColor;
    }
    
    /**
     * 加载添加号码文字可见性设置
     * @returns {boolean} 是否显示
     */
    loadAddNumberTextVisible() {
        try {
            const savedValue = localStorage.getItem('dialerAddNumberTextVisible');
            return savedValue === null ? true : savedValue === 'true';
        } catch (error) {
            console.error('加载添加号码文字可见性设置失败:', error);
            return true;
        }
    }
    
    /**
     * 保存添加号码文字可见性设置
     * @param {boolean} visible - 是否显示
     * @returns {boolean} 是否保存成功
     */
    saveAddNumberTextVisible(visible) {
        try {
            this.addNumberTextVisible = visible;
            localStorage.setItem('dialerAddNumberTextVisible', visible.toString());
            return true;
        } catch (error) {
            console.error('保存添加号码文字可见性设置失败:', error);
            return false;
        }
    }
    
    /**
     * 获取添加号码文字可见性设置
     * @returns {boolean} 是否显示
     */
    getAddNumberTextVisible() {
        return this.addNumberTextVisible;
    }
    
    /**
     * 加载添加号码文字的字体大小设置
     * @returns {string|null} 保存的字体大小设置，如果没有则返回null
     */
    loadAddNumberTextFontSize() {
        try {
            const saved = localStorage.getItem('addNumberTextFontSize');
            // 验证是否为有效的数字字符串
            if (saved && !isNaN(saved) && parseInt(saved) > 0) {
                return saved;
            }
            return null;
        } catch (error) {
            console.error('加载添加号码文字字体大小设置失败:', error);
            return null;
        }
    }
    
    /**
     * 保存添加号码文字的字体大小设置
     * @param {string} fontSize 字体大小值（像素）
     * @returns {boolean} 保存是否成功
     */
    saveAddNumberTextFontSize(fontSize) {
        try {
            // 验证是否为有效的数字字符串
            if (fontSize && !isNaN(fontSize) && parseInt(fontSize) > 0) {
                this.addNumberTextFontSize = fontSize;
                localStorage.setItem('addNumberTextFontSize', fontSize);
                return true;
            }
            return false;
        } catch (error) {
            console.error('保存添加号码文字字体大小设置失败:', error);
            return false;
        }
    }
    
    /**
     * 获取添加号码文字的字体大小设置
     * @returns {string} 字体大小值
     */
    getAddNumberTextFontSize() {
        return this.addNumberTextFontSize;
    }
    
    /**
     * 加载添加号码文字内容设置
     * @returns {string|null} 保存的文字内容，如果没有则返回null
     */
    loadAddNumberText() {
        try {
            const saved = localStorage.getItem('addNumberText');
            return saved;
        } catch (error) {
            console.error('加载添加号码文字内容设置失败:', error);
            return null;
        }
    }
    
    /**
     * 保存添加号码文字内容设置
     * @param {string} text - 要保存的文字内容
     * @returns {boolean} 是否保存成功
     */
    saveAddNumberText(text) {
        try {
            // 验证文字内容长度
            if (text && text.length > 20) {
                console.error('文字内容超过20个字符限制');
                return false;
            }
            this.addNumberText = text || '添加号码';
            localStorage.setItem('addNumberText', this.addNumberText);
            return true;
        } catch (error) {
            console.error('保存添加号码文字内容设置失败:', error);
            return false;
        }
    }
    
    /**
     * 获取添加号码文字内容设置
     * @returns {string} 文字内容
     */
    getAddNumberText() {
        return this.addNumberText;
    }
    
    /**
     * 从localStorage加载最后面的box颜色设置
     * @returns {string|null} box颜色或null
     */
    loadBoxBackgroundColor() {
        try {
            const stored = localStorage.getItem('dialerBoxBackgroundColor');
            return stored !== null ? stored : null;
        } catch (e) {
            console.error('加载box颜色设置失败:', e);
            return null;
        }
    }
    
    /**
     * 保存最后面的box颜色设置到localStorage
     * @param {string} color - box颜色
     * @returns {boolean} 是否保存成功
     */
    saveBoxBackgroundColor(color) {
        try {
            // 验证颜色格式
            if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{3,6}$/.test(color)) {
                console.error('无效的颜色格式');
                return false;
            }
            
            this.boxBackgroundColor = color;
            localStorage.setItem('dialerBoxBackgroundColor', color);
            return true;
        } catch (e) {
            console.error('保存box颜色设置失败:', e);
            return false;
        }
    }
    
    /**
     * 获取最后面的box颜色设置
     * @returns {string} box颜色
     */
    getBoxBackgroundColor() {
          return this.boxBackgroundColor;
      }
      
      /**
       * 从localStorage加载拨号按钮颜色设置
       * @returns {string|null} 拨号按钮颜色或null
       */
      loadCallButtonColor() {
          try {
              const stored = localStorage.getItem('dialerCallButtonColor');
              if (stored && /^#[0-9A-Fa-f]{3,6}$/.test(stored)) {
                  return stored;
              }
              return null;
          } catch (error) {
              console.error('加载拨号按钮颜色设置失败:', error);
              return null;
          }
      }
      
      /**
       * 保存拨号按钮颜色设置到localStorage
       * @param {string} color 拨号按钮颜色
       * @returns {boolean} 保存是否成功
       */
      saveCallButtonColor(color) {
          try {
              // 验证颜色格式
              if (!color || !/^#[0-9A-Fa-f]{3,6}$/.test(color)) {
                  console.error('无效的颜色格式');
                  return false;
              }
              
              this.callButtonColor = color;
              localStorage.setItem('dialerCallButtonColor', color);
              return true;
          } catch (error) {
              console.error('保存拨号按钮颜色设置失败:', error);
              return false;
          }
      }
      
      /**
       * 获取拨号按钮颜色设置
       * @returns {string} 拨号按钮颜色
       */
      getCallButtonColor() {
          return this.callButtonColor;
      }
      
      /**
       * 从localStorage加载拨号按钮图标大小设置
       * @returns {string|null} 图标大小或null
       */
      loadCallButtonIconSize() {
          try {
              const savedSize = localStorage.getItem('dialer_callButtonIconSize');
              return savedSize;
          } catch (error) {
              console.error('加载拨号按钮图标大小设置失败:', error);
              return null;
          }
      }
      
      /**
       * 保存拨号按钮图标大小设置到localStorage
       * @param {string|number} size 图标大小值（纯数字将自动添加rem单位）
       */
      saveCallButtonIconSize(size) {
          try {
              // 转换为字符串
              let sizeStr = String(size).trim();
              
              // 检查是否为纯数字，如果是则自动添加rem单位
              const isNumber = /^\d+(\.\d+)?$/.test(sizeStr);
              if (isNumber) {
                  sizeStr = sizeStr + 'rem';
              } else {
                  // 验证带单位的格式
                  const validSizeRegex = /^[0-9.]+(px|rem|em|%)$/i;
                  if (!validSizeRegex.test(sizeStr)) {
                      throw new Error('无效的大小格式');
                  }
              }
              
              this.callButtonIconSize = sizeStr;
              localStorage.setItem('dialer_callButtonIconSize', sizeStr);
          } catch (error) {
              console.error('保存拨号按钮图标大小设置失败:', error);
              throw error;
          }
      }
      
      /**
       * 获取当前拨号按钮图标大小设置
       * @returns {string} 图标大小
       */
      getCallButtonIconSize() {
          return this.callButtonIconSize;
      }
      
      /**
       * 从localStorage加载拨号按钮图标类型设置
       * @returns {string|null} 图标类型或null
       */
      loadCallButtonIconType() {
          try {
              const savedType = localStorage.getItem('dialer_callButtonIconType');
              return savedType;
          } catch (error) {
              console.error('加载拨号按钮图标类型设置失败:', error);
              return null;
          }
      }
      
      /**
       * 保存拨号按钮图标类型设置到localStorage
       * @param {string} iconType 图标类型（phone或heart）
       */
      saveCallButtonIconType(iconType) {
          try {
              // 验证图标类型
              if (iconType !== 'phone' && iconType !== 'heart') {
                  throw new Error('无效的图标类型');
              }
              
              this.callButtonIconType = iconType;
              localStorage.setItem('dialer_callButtonIconType', iconType);
          } catch (error) {
              console.error('保存拨号按钮图标类型设置失败:', error);
              throw error;
          }
      }
      
      /**
       * 获取当前拨号按钮图标类型设置
       * @returns {string} 图标类型
       */
      getCallButtonIconType() {
          return this.callButtonIconType;
      }

    /**
     * 设置额外文本块彩色文字显示状态
     * @param {boolean} showColors - 是否显示彩色文字
     */
    setExtraTextBlocksShowColors(showColors) {
        this.extraTextBlocksShowColors = showColors;
        this.saveExtraTextBlocksShowColors();
    }

    /**
     * 从localStorage加载数据
     * @returns {Array|null} 存储的数据或null
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('dialerPresetTexts');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('加载预设文本失败:', e);
            return null;
        }
    }

    /**
     * 保存数据到localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem('dialerPresetTexts', JSON.stringify(this.presetTexts));
        } catch (e) {
            console.error('保存预设文本失败:', e);
        }
    }

    /**
     * 获取所有预设文本
     * @returns {Array} 预设文本数组
     */
    getAllPresetTexts() {
        return [...this.presetTexts];
    }

    /**
     * 通过ID获取预设文本
     * @param {number} id - 文本ID
     * @returns {Object|null} 预设文本对象或null
     */
    getPresetTextById(id) {
        return this.presetTexts.find(text => text.id === id) || null;
    }

    /**
     * 通过索引选择预设文本（从1开始）
     * @param {number} index - 索引（从1开始）
     * @returns {Object|null} 预设文本对象或null
     */
    selectPresetTextByIndex(index) {
        if (index >= 1 && index <= this.presetTexts.length) {
            return this.presetTexts[index - 1];
        }
        return null;
    }

    /**
     * 添加新的预设文本
     * @param {string} text - 文本内容
     * @param {string} color - 文本颜色（CSS颜色值），默认为黑色
     * @returns {Object} 添加的预设文本对象
     */
    addPresetText(text, color = '#000000') {
        if (!text || typeof text !== 'string' || text.trim() === '') {
            throw new Error('文本内容不能为空');
        }

        const newId = this.presetTexts.length > 0 
            ? Math.max(...this.presetTexts.map(t => t.id)) + 1 
            : 1;

        const newText = {
            id: newId,
            text: text.trim(),
            color: color || '#000000',
            isDefault: false
        };

        this.presetTexts.push(newText);
        this.saveToStorage();
        return newText;
    }

    /**
     * 更新预设文本
     * @param {number} id - 文本ID
     * @param {string} newText - 新的文本内容
     * @param {string} newColor - 新的文本颜色（可选）
     * @returns {boolean} 是否更新成功
     */
    updatePresetText(id, newText, newColor = null) {
        if (!newText || typeof newText !== 'string' || newText.trim() === '') {
            throw new Error('新文本内容不能为空');
        }

        const textIndex = this.presetTexts.findIndex(text => text.id === id);
        if (textIndex === -1) {
            return false;
        }

        this.presetTexts[textIndex].text = newText.trim();
        if (newColor !== null) {
            this.presetTexts[textIndex].color = newColor;
        }
        this.saveToStorage();
        return true;
    }

    /**
     * 删除预设文本
     * @param {number} id - 文本ID
     * @returns {boolean} 是否删除成功
     */
    deletePresetText(id) {
        // 不允许删除默认文本
        const textToDelete = this.getPresetTextById(id);
        if (textToDelete && textToDelete.isDefault) {
            throw new Error('默认文本不能删除');
        }

        const initialLength = this.presetTexts.length;
        this.presetTexts = this.presetTexts.filter(text => text.id !== id);
        
        if (this.presetTexts.length < initialLength) {
            this.saveToStorage();
            return true;
        }
        return false;
    }

    /**
     * 获取默认文本
     * @returns {Object|null} 默认文本对象或null
     */
    getDefaultText() {
        return this.presetTexts.find(text => text.isDefault) || null;
    }

    /**
     * 设置默认文本
     * @param {number} id - 文本ID
     * @returns {boolean} 是否设置成功
     */
    setDefaultText(id) {
        // 清除所有默认标记
        this.presetTexts.forEach(text => {
            text.isDefault = false;
        });

        // 设置新的默认文本
        const textToSetDefault = this.getPresetTextById(id);
        if (textToSetDefault) {
            textToSetDefault.isDefault = true;
            this.saveToStorage();
            return true;
        }
        return false;
    }

    /**
     * 从localStorage加载额外文本框内容
     * @returns {string|null} 存储的文本内容或null
     */
    loadExtraTextFieldContent() {
        try {
            const stored = localStorage.getItem('dialerExtraTextFieldContent');
            return stored || null;
        } catch (e) {
            console.error('加载额外文本框内容失败:', e);
            return null;
        }
    }
    
    /**
     * 保存额外文本框内容到localStorage
     */
    saveExtraTextFieldContent() {
        try {
            localStorage.setItem('dialerExtraTextFieldContent', this.extraTextFieldContent);
        } catch (e) {
            console.error('保存额外文本框内容失败:', e);
        }
    }
    
    /**
     * 获取额外文本框内容
     * @returns {string} 额外文本框的内容
     */
    getExtraTextFieldContent() {
        return this.extraTextFieldContent;
    }
    
    /**
     * 设置额外文本框内容
     * @param {string} content - 新的文本内容
     */
    setExtraTextFieldContent(content) {
        if (typeof content === 'string' && content.trim() !== '') {
            this.extraTextFieldContent = content.trim();
            this.saveExtraTextFieldContent();
            return true;
        }
        return false;
    }
    
    /**
     * 从localStorage加载额外文本框打字模式设置
     * @returns {boolean|null} 打字模式设置或null
     */
    loadExtraTextFieldTypingMode() {
        try {
            const stored = localStorage.getItem('dialerExtraTextFieldTypingMode');
            return stored !== null ? stored === 'true' : null;
        } catch (e) {
            console.error('加载额外文本框打字模式设置失败:', e);
            return null;
        }
    }

    /**
     * 保存额外文本框打字模式设置到localStorage
     */
    saveExtraTextFieldTypingMode() {
        try {
            localStorage.setItem('dialerExtraTextFieldTypingMode', this.extraTextFieldTypingMode);
        } catch (e) {
            console.error('保存额外文本框打字模式设置失败:', e);
        }
    }

    /**
     * 获取额外文本框打字模式设置
     * @returns {boolean} 打字模式设置
     */
    getExtraTextFieldTypingMode() {
        return this.extraTextFieldTypingMode;
    }

    /**
     * 设置额外文本框打字模式
     * @param {boolean} mode - 是否启用打字模式
     */
    setExtraTextFieldTypingMode(mode) {
        this.extraTextFieldTypingMode = mode;
        this.saveExtraTextFieldTypingMode();
    }
    
    /**
    /**
     * 从localStorage加载额外文本框字数限制设置
     * @returns {number|null} 字数限制或null
     */
    loadExtraTextFieldWordLimit() {
        try {
            const stored = localStorage.getItem('dialerExtraTextFieldWordLimit');
            return stored !== null ? parseInt(stored) : null;
        } catch (e) {
            console.error('加载额外文本框字数限制设置失败:', e);
            return null;
        }
    }
    
    /**
     * 从localStorage加载额外文本框省略后保留字数设置
     * @returns {number|null} 省略后保留字数或null
     */
    loadExtraTextFieldEllipsisLength() {
        try {
            const stored = localStorage.getItem('dialerExtraTextFieldEllipsisLength');
            return stored !== null ? parseInt(stored) : null;
        } catch (e) {
            console.error('加载额外文本框省略后保留字数设置失败:', e);
            return null;
        }
    }
    
    /**
     * 保存额外文本框字数限制设置到localStorage
     */
    saveExtraTextFieldWordLimit() {
        try {
            localStorage.setItem('dialerExtraTextFieldWordLimit', this.extraTextFieldWordLimit);
        } catch (e) {
            console.error('保存额外文本框字数限制设置失败:', e);
        }
    }
    
    /**
     * 保存额外文本框省略后保留字数设置到localStorage
     */
    saveExtraTextFieldEllipsisLength() {
        try {
            localStorage.setItem('dialerExtraTextFieldEllipsisLength', this.extraTextFieldEllipsisLength);
        } catch (e) {
            console.error('保存额外文本框省略后保留字数设置失败:', e);
        }
    }
    
    /**
     * 获取额外文本框字数限制设置
     * @returns {number} 字数限制
     */
    getExtraTextFieldWordLimit() {
        return this.extraTextFieldWordLimit;
    }
    
    /**
     * 获取额外文本框省略后保留字数设置
     * @returns {number} 省略后保留字数
     */
    getExtraTextFieldEllipsisLength() {
        return this.extraTextFieldEllipsisLength;
    }
    
    /**
     * 设置额外文本框字数限制
     * @param {number} limit - 字数限制（必须为正整数）
     * @returns {boolean} 是否设置成功
     */
    setExtraTextFieldWordLimit(limit) {
        // 验证字数限制是否为有效的正整数
        if (Number.isInteger(limit) && limit > 0 && limit <= 100) {
            this.extraTextFieldWordLimit = limit;
            this.saveExtraTextFieldWordLimit();
            return true;
        }
        return false;
    }
    
    /**
     * 设置额外文本框省略后保留字数
     * @param {number} length - 省略后保留字数（必须为正整数且不大于字数限制）
     * @returns {boolean} 是否设置成功
     */
    setExtraTextFieldEllipsisLength(length) {
        // 验证省略后保留字数是否为有效的正整数且不大于字数限制
        if (Number.isInteger(length) && length > 0 && length <= this.extraTextFieldWordLimit) {
            this.extraTextFieldEllipsisLength = length;
            this.saveExtraTextFieldEllipsisLength();
            return true;
        }
        return false;
    }
    
    /**
     * 处理文本溢出效果
     * @param {string} text - 需要处理的文本
     * @returns {string} 处理后的文本（可能包含省略号）
     */
    handleTextOverflow(text) {
        if (text.length > this.extraTextFieldWordLimit) {
            // 保留后面的字符，前面显示省略号
            return '...' + text.substring(text.length - this.extraTextFieldEllipsisLength);
        }
        return text;
    }
    
    /**
     * 从localStorage加载额外文本框样式设置
     * @returns {Object|null} 样式设置对象或null
     */
    loadExtraTextFieldStyle() {
        try {
            const stored = localStorage.getItem('dialerExtraTextFieldStyle');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('加载额外文本框样式设置失败:', e);
            return null;
        }
    }
    
    /**
     * 保存额外文本框样式设置到localStorage
     */
    saveExtraTextFieldStyle() {
        try {
            localStorage.setItem('dialerExtraTextFieldStyle', JSON.stringify(this.extraTextFieldStyle));
        } catch (e) {
            console.error('保存额外文本框样式设置失败:', e);
        }
    }
    
    /**
     * 获取额外文本框样式设置
     * @returns {Object} 样式设置对象
     */
    getExtraTextFieldStyle() {
        return {...this.extraTextFieldStyle};
    }
    
    /**
     * 设置额外文本框字体大小
     * @param {string} fontSize - 字体大小（像素值）
     */
    setExtraTextFieldFontSize(fontSize) {
        // 验证字体大小是否为有效的数字字符串
        if (fontSize && !isNaN(parseInt(fontSize)) && parseInt(fontSize) > 0) {
            this.extraTextFieldStyle.fontSize = fontSize;
            this.saveExtraTextFieldStyle();
            return true;
        }
        return false;
    }
    
    /**
     * 设置额外文本框字体粗细
     * @param {string} fontWeight - 字体粗细（'normal'、'bold' 或 '500'）
     */
    setExtraTextFieldFontWeight(fontWeight) {
        if (fontWeight === 'normal' || fontWeight === 'bold' || fontWeight === '500') {
            this.extraTextFieldStyle.fontWeight = fontWeight;
            this.saveExtraTextFieldStyle();
            return true;
        }
        return false;
    }
    
    /**
     * 设置额外文本框字体颜色
     * @param {string} color - CSS颜色值
     */
    setExtraTextFieldColor(color) {
        // 简单验证是否为有效的CSS颜色值
        const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (color && (colorRegex.test(color) || color === 'black' || color === 'white' || color === 'red' || color === 'green' || color === 'blue')) {
            this.extraTextFieldStyle.color = color;
            this.saveExtraTextFieldStyle();
            return true;
        }
        return false;
    }
    
    /**
     * 获取按钮1的文字
     */
    getButton1Text() {
        // 从localStorage获取保存的按钮1文字，如果不存在则返回默认值
        const savedText = localStorage.getItem('dialerButton1Text');
        return savedText || '阿凸目'; // 默认文本为'阿凸目'
    }

    /**
     * 保存按钮1的文字
     */
    saveButton1Text(text) {
        try {
            // 保存到localStorage
            localStorage.setItem('dialerButton1Text', text);
            return true;
        } catch (error) {
            console.error('保存按钮1文字失败:', error);
            return false;
        }
    }

    /**
     * 重置按钮1文字为默认值
     */
    resetButton1Text() {
        localStorage.removeItem('dialerButton1Text');
        return true;
    }

    /**
     * 重置为默认数据
     */
    resetToDefaults() {
        this.presetTexts = [
            { id: 1, text: '拨号', isDefault: true, color: '#000000' },
            { id: 2, text: '正在拨打☎️：', isDefault: false, color: '#000000' },
            { id: 3, text: '呼叫中：', isDefault: false, color: '#000000' }
        ];
        // 重置拨打电话提示文本为默认数据
        this.callStatusTexts = [
            { id: 1, text: '您拨打的电话用户在吃饭，请稍后再拨~', isDefault: true, color: '#000000', fontSize: '16' },
            { id: 2, text: '对方暂时无法接听，请稍后再拨', isDefault: false, color: '#000000', fontSize: '16' },
            { id: 3, text: '您拨打的用户正在通话中，请稍后再拨', isDefault: false, color: '#000000', fontSize: '16' }
        ];
        this.saveCallStatusTexts();
        
        // 重置音频设置到默认值
        this.audioSettings = {
            currentFolder: 'wav001',
            availableFolders: [
                { id: 'wav001', name: '默认音效 (wav001)' },
                { id: 'default_mp3s/mp301', name: 'MP3音效 (mp301)' },
                { id: 'default_mp3s/wav01', name: 'WAV音效 (wav01)' },
                { id: 'default_mp3s/wdw002', name: '自定义音效1 (wdw002)' },
                { id: 'default_mp3s/wdw01', name: '自定义音效2 (wdw01)' }
            ],
            fadeOutDuration: 500, // 默认淡出时间为500毫秒
            maxConcurrentAudios: 2 // 默认最大并发音频数量为2
        };
        
        // 重置额外文本框内容到默认值
        this.extraTextFieldContent = '歌词文本一二三';
        
        // 重置额外文本框打字模式
        this.extraTextFieldTypingMode = false;
        
        // 重置额外文本块彩色文字显示状态
        this.extraTextBlocksShowColors = false;
        this.saveExtraTextBlocksShowColors();
        
        // 重置额外文本块字数限制设置
        this.extraTextBlocksWordLimit = 12; // 默认最多显示12个字
        this.extraTextBlocksEllipsisLength = 9; // 默认省略后保留9个字
        this.saveExtraTextBlocksWordLimit();
        this.saveExtraTextBlocksEllipsisLength();
        
        // 重置额外文本框样式设置
        this.extraTextFieldStyle = {
            fontSize: '24',
            fontWeight: 'normal',
            color: '#000000'
        };
        
        // 重置额外文本框字数限制设置
        this.extraTextFieldWordLimit = 12; // 默认最多显示12个字
        this.extraTextFieldEllipsisLength = 9; // 默认省略后保留9个字
        
        // 重置额外文本块
        this.extraTextBlocks = [
            { id: 1, text: '弟娃儿翁', color: '#ff0000' },
            { id: 2, text: '沃尔沃二新文本', color: '#0000ff' },
            { id: 3, text: '新文本沃尔沃二新文本', color: '#00ff00' }
        ];
        
        // 移除文本块位置设置
        localStorage.removeItem('dialerTextBlocksPosition');
        
        // 重置按钮1文字
        this.resetButton1Text();
        
        this.saveToStorage();
        this.saveCallStatusTexts();
        this.saveAudioSettings();
        this.saveExtraTextFieldContent();
        this.saveExtraTextFieldTypingMode();
        this.saveExtraTextFieldWordLimit();
        this.saveExtraTextFieldEllipsisLength();
        this.saveExtraTextBlocks();
    }
    
    /**
     * 获取文本块容器和省略号的位置设置
     * @returns {Object} 包含位置设置的对象
     */
    getTextBlocksPosition() {
        const saved = localStorage.getItem('dialerTextBlocksPosition');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('解析文本块位置设置失败:', e);
            }
        }
        // 返回默认位置设置
        return {
            mainContainerTop: 0,
            mainContainerBottom: 0,
            mainContainerVertical: 20,
            mainContainerHorizontal: 0,
            ellipsisTop: 50,
            ellipsisLeft: 5,
            ellipsisMarginTop: 0,
            ellipsisMarginBottom: 0,
            ellipsisMarginRight: 8
        };
    }

    /**
     * 设置文本块容器和省略号的位置
     * @param {Object} position - 包含位置设置的对象
     * @returns {boolean} 设置是否成功
     */
    setTextBlocksPosition(position) {
        try {
            localStorage.setItem('dialerTextBlocksPosition', JSON.stringify(position));
            return true;
        } catch (e) {
            console.error('保存文本块位置设置失败:', e);
            return false;
        }
    }
    
    /**
     * 从localStorage加载拨打电话提示文本
     * @returns {Array|null} 存储的数据或null
     */
    loadCallStatusTexts() {
        try {
            const stored = localStorage.getItem('dialerCallStatusTexts');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('加载拨打电话提示文本失败:', e);
            return null;
        }
    }
    
    /**
     * 保存拨打电话提示文本到localStorage
     */
    saveCallStatusTexts() {
        try {
            localStorage.setItem('dialerCallStatusTexts', JSON.stringify(this.callStatusTexts));
        } catch (e) {
            console.error('保存拨打电话提示文本失败:', e);
        }
    }
    
    /**
     * 获取所有拨打电话提示文本
     * @returns {Array} 提示文本数组
     */
    getAllCallStatusTexts() {
        return [...this.callStatusTexts];
    }
    
    /**
     * 添加新的拨打电话提示文本
     * @param {string} text - 文本内容
     * @param {string} color - 文本颜色，默认为黑色
     * @param {string|number} fontSize - 字体大小，默认为16px
     * @returns {Object} 添加的提示文本对象
     */
    addCallStatusText(text, color = '#000000', fontSize = '16') {
        if (!text || typeof text !== 'string' || text.trim() === '') {
            throw new Error('文本内容不能为空');
        }

        // 简单验证颜色值
        const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (color && !(colorRegex.test(color) || color === 'black' || color === 'white' || color === 'red' || color === 'green' || color === 'blue')) {
            color = '#000000'; // 无效颜色则使用默认黑色
        }

        // 验证字体大小
        const validatedFontSize = parseInt(fontSize);
        const finalFontSize = isNaN(validatedFontSize) || validatedFontSize <= 0 || validatedFontSize > 72 ? '16' : validatedFontSize.toString();

        const newId = this.callStatusTexts.length > 0 
            ? Math.max(...this.callStatusTexts.map(t => t.id)) + 1 
            : 1;

        const newText = {
            id: newId,
            text: text.trim(),
            color: color,
            fontSize: finalFontSize,
            isDefault: false
        };

        this.callStatusTexts.push(newText);
        this.saveCallStatusTexts();
        return newText;
    }
    
    /**
     * 更新拨打电话提示文本
     * @param {number} id - 文本ID
     * @param {string} newText - 新的文本内容
     * @returns {boolean} 是否更新成功
     */
    updateCallStatusText(id, newText) {
        if (!newText || typeof newText !== 'string' || newText.trim() === '') {
            throw new Error('新文本内容不能为空');
        }

        const textIndex = this.callStatusTexts.findIndex(text => text.id === id);
        if (textIndex === -1) {
            return false;
        }

        this.callStatusTexts[textIndex].text = newText.trim();
        this.saveCallStatusTexts();
        return true;
    }

    /**
     * 更新拨打电话提示文本字体大小
     * @param {number} id - 文本ID
     * @param {string|number} newFontSize - 新的字体大小（像素值）
     * @returns {boolean} 是否更新成功
     */
    setCallStatusTextFontSize(id, newFontSize) {
        // 验证字体大小是否为有效的数字
        const fontSize = parseInt(newFontSize);
        if (isNaN(fontSize) || fontSize <= 0 || fontSize > 72) {
            return false;
        }

        const textIndex = this.callStatusTexts.findIndex(text => text.id === id);
        if (textIndex === -1) {
            return false;
        }

        this.callStatusTexts[textIndex].fontSize = fontSize.toString();
        this.saveCallStatusTexts();
        return true;
    }

    /**
     * 更新拨打电话提示文本颜色
     * @param {number} id - 文本ID
     * @param {string} newColor - 新的文本颜色
     * @returns {boolean} 是否更新成功
     */
    setCallStatusTextColor(id, newColor) {
        // 简单验证颜色值
        const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (!newColor || !(colorRegex.test(newColor) || newColor === 'black' || newColor === 'white' || newColor === 'red' || newColor === 'green' || newColor === 'blue')) {
            return false;
        }

        const textIndex = this.callStatusTexts.findIndex(text => text.id === id);
        if (textIndex === -1) {
            return false;
        }

        this.callStatusTexts[textIndex].color = newColor;
        this.saveCallStatusTexts();
        return true;
    }
    
    /**
     * 删除拨打电话提示文本
     * @param {number} id - 文本ID
     * @returns {boolean} 是否删除成功
     */
    deleteCallStatusText(id) {
        // 不允许删除默认文本
        const textToDelete = this.getCallStatusTextById(id);
        if (textToDelete && textToDelete.isDefault) {
            throw new Error('默认文本不能删除');
        }

        const initialLength = this.callStatusTexts.length;
        this.callStatusTexts = this.callStatusTexts.filter(text => text.id !== id);
        
        if (this.callStatusTexts.length < initialLength) {
            this.saveCallStatusTexts();
            return true;
        }
        return false;
    }
    
    /**
     * 通过ID获取拨打电话提示文本
     * @param {number} id - 文本ID
     * @returns {Object|null} 提示文本对象或null
     */
    getCallStatusTextById(id) {
        return this.callStatusTexts.find(text => text.id === id) || null;
    }
    
    /**
     * 获取默认拨打电话提示文本
     * @returns {Object|null} 默认提示文本对象或null
     */
    getDefaultCallStatusText() {
        return this.callStatusTexts.find(text => text.isDefault) || null;
    }
    
    /**
     * 设置默认拨打电话提示文本
     * @param {number} id - 文本ID
     * @returns {boolean} 是否设置成功
     */
    setDefaultCallStatusText(id) {
        // 清除所有默认标记
        this.callStatusTexts.forEach(text => {
            text.isDefault = false;
        });

        // 设置新的默认提示文本
        const textToSetDefault = this.getCallStatusTextById(id);
        if (textToSetDefault) {
            textToSetDefault.isDefault = true;
            this.saveCallStatusTexts();
            return true;
        }
        return false;
    }
    
    /**
     * 重置拨打电话提示文本为默认数据
     */
    resetCallStatusTextsToDefaults() {
        this.callStatusTexts = [
            { id: 1, text: '您拨打的电话用户在吃饭，请稍后再拨~', isDefault: true, color: '#000000', fontSize: '16' },
            { id: 2, text: '对方暂时无法接听，请稍后再拨', isDefault: false, color: '#000000', fontSize: '16' },
            { id: 3, text: '您拨打的用户正在通话中，请稍后再拨', isDefault: false, color: '#000000', fontSize: '16' }
        ];
        this.saveCallStatusTexts();
    }
    
    /**
     * 从localStorage加载拨号显示数字的样式设置
     * @returns {Object|null} 拨号显示数字样式对象或null
     */
    loadDialerNumberDisplayStyle() {
        try {
            const stored = localStorage.getItem('dialerNumberDisplayStyle');
            return stored !== null ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('加载拨号显示数字样式设置失败:', e);
            return null;
        }
    }
    
    /**
     * 保存拨号显示数字的样式设置到localStorage
     */
    saveDialerNumberDisplayStyle() {
        try {
            localStorage.setItem('dialerNumberDisplayStyle', JSON.stringify(this.dialerNumberDisplayStyle));
        } catch (e) {
            console.error('保存拨号显示数字样式设置失败:', e);
        }
    }
    
    /**
     * 获取拨号显示数字的样式设置
     * @returns {Object} 拨号显示数字样式对象
     */
    getDialerNumberDisplayStyle() {
        return this.dialerNumberDisplayStyle;
    }
    
    /**
     * 设置拨号显示数字的字体颜色
     * @param {string} color - 颜色值（16进制格式）
     */
    setDialerNumberDisplayColor(color) {
        if (this.dialerNumberDisplayStyle) {
            this.dialerNumberDisplayStyle.color = color;
            this.saveDialerNumberDisplayStyle();
        }
    }
    
    /**
     * 设置拨号显示数字的透明度
     * @param {number} opacity - 透明度值（0-1之间）
     */
    setDialerNumberDisplayOpacity(opacity) {
        // 确保透明度值在0-1之间
        opacity = Math.max(0, Math.min(1, opacity));
        if (this.dialerNumberDisplayStyle) {
            this.dialerNumberDisplayStyle.opacity = opacity;
            this.saveDialerNumberDisplayStyle();
        }
    }
    
    /**
     * 获取拨号显示数字的颜色（兼容HTML中调用的方法名）
     * @returns {string} 颜色值
     */
    getDisplayNumberColor() {
        return this.dialerNumberDisplayStyle ? this.dialerNumberDisplayStyle.color : '#34c759';
    }
    
    /**
     * 获取拨号显示数字的透明度（兼容HTML中调用的方法名）
     * @returns {number} 透明度值
     */
    getDisplayNumberOpacity() {
        return this.dialerNumberDisplayStyle ? this.dialerNumberDisplayStyle.opacity : 1;
    }
    
    /**
     * 保存拨号显示数字的颜色（兼容HTML中调用的方法名）
     * @param {string} color - 颜色值
     * @returns {boolean} 是否保存成功
     */
    saveDisplayNumberColor(color) {
        try {
            this.setDialerNumberDisplayColor(color);
            return true;
        } catch (e) {
            console.error('保存显示数字颜色失败:', e);
            return false;
        }
    }
    
    /**
     * 保存拨号显示数字的透明度（兼容HTML中调用的方法名）
     * @param {number} opacity - 透明度值
     * @returns {boolean} 是否保存成功
     */
    saveDisplayNumberOpacity(opacity) {
        try {
            this.setDialerNumberDisplayOpacity(opacity);
            return true;
        } catch (e) {
            console.error('保存显示数字透明度失败:', e);
            return false;
        }
    }
    
    /**
     * 重置拨号显示数字的样式设置为默认值
     */
    resetDisplayNumberSettings() {
        this.dialerNumberDisplayStyle = {
            color: '#000000', // 默认黑色
            opacity: 1 // 默认完全不透明
        };
        this.saveDialerNumberDisplayStyle();
    }

    /**
     * 从localStorage加载额外文本块数据
     * @returns {Array|null} 存储的额外文本块数据或null
     */
    loadExtraTextBlocks() {
        try {
            const stored = localStorage.getItem('dialerExtraTextBlocks');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('加载额外文本块失败:', e);
            return null;
        }
    }
    
    /**
     * 保存额外文本块数据到localStorage
     */
    saveExtraTextBlocks() {
        try {
            localStorage.setItem('dialerExtraTextBlocks', JSON.stringify(this.extraTextBlocks));
        } catch (e) {
            console.error('保存额外文本块失败:', e);
        }
    }
    
    /**
     * 获取所有额外文本块
     * @returns {Array} 额外文本块数组
     */
    getExtraTextBlocks() {
        return [...this.extraTextBlocks];
    }
    
    /**
     * 设置额外文本块
     * @param {Array} blocks - 额外文本块数组
     * @returns {boolean} 是否设置成功
     */
    setExtraTextBlocks(blocks) {
        if (Array.isArray(blocks)) {
            this.extraTextBlocks = blocks;
            this.saveExtraTextBlocks();
            return true;
        }
        return false;
    }
    
    /**
     * 添加额外文本块
     * @param {string} text - 文本内容
     * @param {string} color - 文本颜色
     * @returns {Object} 添加的文本块对象
     */
    addExtraTextBlock(text, color = '#000000') {
        const newId = this.extraTextBlocks.length > 0 
            ? Math.max(...this.extraTextBlocks.map(block => block.id)) + 1 
            : 1;
        
        const newBlock = {
            id: newId,
            text: text.trim(),
            color: color
        };
        
        this.extraTextBlocks.push(newBlock);
        this.saveExtraTextBlocks();
        return newBlock;
    }
    
    /**
     * 更新额外文本块
     * @param {number} id - 文本块ID
     * @param {string} text - 新的文本内容
     * @param {string} color - 新的文本颜色
     * @returns {boolean} 是否更新成功
     */
    updateExtraTextBlock(id, text, color) {
        const blockIndex = this.extraTextBlocks.findIndex(block => block.id === id);
        if (blockIndex === -1) {
            return false;
        }
        
        this.extraTextBlocks[blockIndex].text = text.trim();
        this.extraTextBlocks[blockIndex].color = color;
        this.saveExtraTextBlocks();
        return true;
    }
    
    /**
     * 删除额外文本块
     * @param {number} id - 文本块ID
     * @returns {boolean} 是否删除成功
     */
    deleteExtraTextBlock(id) {
        const initialLength = this.extraTextBlocks.length;
        this.extraTextBlocks = this.extraTextBlocks.filter(block => block.id !== id);
        
        if (this.extraTextBlocks.length < initialLength) {
            this.saveExtraTextBlocks();
            return true;
        }
        return false;
    }
    
    /**
     * 从localStorage加载音频设置
     * @returns {Object|null} 存储的音频设置或null
     */
    loadAudioSettings() {
        try {
            const stored = localStorage.getItem('dialerAudioSettings');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('加载音频设置失败:', e);
            return null;
        }
    }

    /**
     * 保存音频设置到localStorage
     */
    saveAudioSettings() {
        try {
            localStorage.setItem('dialerAudioSettings', JSON.stringify(this.audioSettings));
        } catch (e) {
            console.error('保存音频设置失败:', e);
        }
    }

    /**
     * 获取当前使用的音频文件夹
     * @returns {string} 当前音频文件夹路径
     */
    getCurrentAudioFolder() {
        return this.audioSettings.currentFolder;
    }

    /**
     * 设置当前使用的音频文件夹
     * @param {string} folderPath - 音频文件夹路径
     * @returns {boolean} 是否设置成功
     */
    setCurrentAudioFolder(folderPath) {
        // 检查文件夹是否在可用列表中
        const folderExists = this.audioSettings.availableFolders.some(folder => folder.id === folderPath);

        if (folderExists) {
            this.audioSettings.currentFolder = folderPath;
            this.saveAudioSettings();

            // 通知其他组件音频文件夹已更改
            if (window.setDialerAudioFolder) {
                window.setDialerAudioFolder(folderPath);
            }

            return true;
        }
        return false;
    }

    /**
     * 获取所有可用的音频文件夹
     * @returns {Array} 音频文件夹列表
     */
    getAvailableAudioFolders() {
        return [...this.audioSettings.availableFolders];
    }

    /**
     * 获取音频淡出持续时间（毫秒）
     * @returns {number} 淡出时间（毫秒）
     */
    getAudioFadeOutDuration() {
        return this.audioSettings.fadeOutDuration;
    }

    /**
     * 设置音频淡出持续时间（毫秒）
     * @param {number} duration - 淡出时间（毫秒）
     * @returns {boolean} 是否设置成功
     */
    setAudioFadeOutDuration(duration) {
        // 验证参数是否为有效的正整数
        if (Number.isInteger(duration) && duration > 0 && duration <= 5000) {
            this.audioSettings.fadeOutDuration = duration;
            this.saveAudioSettings();
            return true;
        }
        return false;
    }

    /**
     * 获取最大并发音频数量
     * @returns {number} 最大并发音频数量
     */
    getMaxConcurrentAudios() {
        return this.audioSettings.maxConcurrentAudios;
    }

    /**
     * 设置最大并发音频数量
     * @param {number} count - 最大并发音频数量
     * @returns {boolean} 是否设置成功
     */
    setMaxConcurrentAudios(count) {
        // 验证参数是否为有效的正整数
        if (Number.isInteger(count) && count > 0 && count <= 10) {
            this.audioSettings.maxConcurrentAudios = count;
            this.saveAudioSettings();
            return true;
        }
        return false;
    }

    /**
     * 从localStorage加载额外文本块打字模式设置
     * @returns {boolean|null} 打字模式设置或null
     */
    loadExtraTextBlocksTypingMode() {
        try {
            const stored = localStorage.getItem('dialerExtraTextBlocksTypingMode');
            return stored !== null ? stored === 'true' : null;
        } catch (e) {
            console.error('加载额外文本块打字模式设置失败:', e);
            return null;
        }
    }

    /**
     * 保存额外文本块打字模式设置到localStorage
     */
    saveExtraTextBlocksTypingMode() {
        try {
            localStorage.setItem('dialerExtraTextBlocksTypingMode', this.extraTextBlocksTypingMode);
        } catch (e) {
            console.error('保存额外文本块打字模式设置失败:', e);
        }
    }

    /**
     * 获取额外文本块打字模式设置
     * @returns {boolean} 打字模式设置
     */
    getExtraTextBlocksTypingMode() {
        return this.extraTextBlocksTypingMode;
    }

    /**
     * 设置额外文本块打字模式
     * @param {boolean} mode - 是否启用打字模式
     */
    setExtraTextBlocksTypingMode(mode) {
        this.extraTextBlocksTypingMode = mode;
        this.saveExtraTextBlocksTypingMode();
    }
    
    /**
     * 加载添加号码文字的垂直位置设置
     * @returns {string} 垂直位置值（像素）
     */
    loadAddNumberTextVerticalPosition() {
        try {
            const savedPosition = localStorage.getItem('dialer_addNumberTextVerticalPosition');
            if (savedPosition) {
                // 验证数值是否有效
                const position = parseInt(savedPosition);
                if (!isNaN(position) && position >= -20 && position <= 20) {
                    return savedPosition;
                }
            }
        } catch (error) {
            console.error('加载添加号码文字垂直位置失败:', error);
        }
        return '4'; // 默认值为4px（对应mt-1）
    }
    
    /**
     * 保存添加号码文字的垂直位置设置
     * @param {string} position 垂直位置值
     * @returns {boolean} 是否保存成功
     */
    saveAddNumberTextVerticalPosition(position) {
        try {
            // 验证数值是否有效
            const pos = parseInt(position);
            if (!isNaN(pos) && pos >= -20 && pos <= 20) {
                localStorage.setItem('dialer_addNumberTextVerticalPosition', position);
                this.addNumberTextVerticalPosition = position;
                return true;
            }
        } catch (error) {
            console.error('保存添加号码文字垂直位置失败:', error);
        }
        return false;
    }
    
    /**
       * 获取添加号码文字的垂直位置设置
       * @returns {string} 垂直位置值（像素）
       */
      getAddNumberTextVerticalPosition() {
          return this.addNumberTextVerticalPosition;
      }
      
      /**
       * 从localStorage加载数字颜色序列设置
       * @returns {Array|null} 存储的数字颜色序列或null
       */
      loadNumberColorSequence() {
          try {
              const stored = localStorage.getItem('dialerNumberColorSequence');
              return stored !== null ? JSON.parse(stored) : null;
          } catch (e) {
              console.error('加载数字颜色序列设置失败:', e);
              return null;
          }
      }
      
      /**
       * 保存数字颜色序列设置到localStorage
       */
      saveNumberColorSequence() {
          try {
              localStorage.setItem('dialerNumberColorSequence', JSON.stringify(this.numberColorSequence));
          } catch (e) {
              console.error('保存数字颜色序列设置失败:', e);
          }
      }
      
      /**
       * 获取数字颜色序列设置
       * @returns {Array} 数字颜色序列数组
       */
      getNumberColorSequence() {
          return this.numberColorSequence;
      }
      
      /**
       * 设置数字颜色序列设置
       * @param {Array} sequence - 数字颜色序列数组
       */
      setNumberColorSequence(sequence) {
          if (Array.isArray(sequence) && sequence.length > 0) {
              this.numberColorSequence = sequence.map((item, index) => ({
                  id: item.id || index + 1,
                  color: item.color || '#000000'
              }));
              this.saveNumberColorSequence();
          }
      }
      
      /**
       * 添加数字颜色序列项
       * @param {string} color - 颜色值
       */
      addNumberColorSequenceItem(color) {
          const newId = Math.max(...this.numberColorSequence.map(item => item.id), 0) + 1;
          this.numberColorSequence.push({ id: newId, color });
          this.saveNumberColorSequence();
          return newId;
      }
      
      /**
       * 更新数字颜色序列项
       * @param {number} id - 颜色项ID
       * @param {string} color - 新颜色值
       */
      updateNumberColorSequenceItem(id, color) {
          const index = this.numberColorSequence.findIndex(item => item.id === id);
          if (index !== -1) {
              this.numberColorSequence[index].color = color;
              this.saveNumberColorSequence();
              return true;
          }
          return false;
      }
      
      /**
       * 删除数字颜色序列项
       * @param {number} id - 颜色项ID
       */
      deleteNumberColorSequenceItem(id) {
          // 确保至少保留一项
          if (this.numberColorSequence.length <= 1) {
              console.warn('至少需要保留一项颜色设置');
              return false;
          }
          
          const index = this.numberColorSequence.findIndex(item => item.id === id);
          if (index !== -1) {
              this.numberColorSequence.splice(index, 1);
              this.saveNumberColorSequence();
              return true;
          }
          return false;
      }
    
    /**
     * 重置数字颜色序列为默认值
     * 设置为3个序号且颜色均为黑色
     */
    resetNumberColorSequence() {
        try {
            this.numberColorSequence = [
                { id: 1, color: '#000000' }, // 默认黑色
                { id: 2, color: '#000000' }, // 默认黑色
                { id: 3, color: '#000000' }  // 默认黑色
            ];
            this.saveNumberColorSequence();
        } catch (error) {
            console.error('重置数字颜色序列失败:', error);
            throw error;
        }
    }
    
    /**
     * 从localStorage加载数字颜色序列整体透明度设置
     * @returns {number|null} 透明度值或null
     */
    loadNumberColorSequenceOpacity() {
        try {
            const stored = localStorage.getItem('dialerNumberColorSequenceOpacity');
            return stored !== null ? parseFloat(stored) : null;
        } catch (error) {
            console.error('加载数字颜色序列透明度设置失败:', error);
            return null;
        }
    }
    
    /**
     * 保存数字颜色序列整体透明度设置到localStorage
     */
    saveNumberColorSequenceOpacity() {
        try {
            localStorage.setItem('dialerNumberColorSequenceOpacity', this.numberColorSequenceOpacity.toString());
        } catch (error) {
            console.error('保存数字颜色序列透明度设置失败:', error);
        }
    }
    
    /**
     * 获取数字颜色序列整体透明度设置
     * @returns {number} 透明度值
     */
    getNumberColorSequenceOpacity() {
        return this.numberColorSequenceOpacity;
    }
    
    /**
     * 设置数字颜色序列整体透明度
     * @param {number} opacity - 透明度值（0-1范围）
     * @returns {boolean} 设置是否成功
     */
    setNumberColorSequenceOpacity(opacity) {
        try {
            // 确保透明度值在0-1之间
            const validOpacity = Math.max(0, Math.min(1, parseFloat(opacity)));
            this.numberColorSequenceOpacity = validOpacity;
            this.saveNumberColorSequenceOpacity();
            return true;
        } catch (error) {
            console.error('设置数字颜色序列透明度失败:', error);
            return false;
        }
    }
    
    /**
     * 从localStorage加载图片功能开关状态
     * @returns {boolean|null} 存储的开关状态或null
     */
    loadImageFeatureEnabled() {
        try {
            const stored = localStorage.getItem('imageFeatureEnabled');
            return stored !== null ? stored === 'true' : null;
        } catch (e) {
            console.error('加载图片功能开关状态失败:', e);
            return null;
        }
    }
    
    /**
     * 保存图片功能开关状态到localStorage
     */
    saveImageFeatureEnabled() {
        try {
            localStorage.setItem('imageFeatureEnabled', this.imageFeatureEnabled.toString());
        } catch (e) {
            console.error('保存图片功能开关状态失败:', e);
        }
    }
    
    /**
     * 加载图片按下动画时间设置
     * @returns {number} 动画时间（毫秒）或150ms默认值
     */
    loadImagePressAnimationDuration() {
        try {
            const stored = localStorage.getItem('imagePressAnimationDuration');
            return stored !== null ? parseInt(stored, 10) : 150;
        } catch (e) {
            console.error('加载图片按下动画时间设置失败:', e);
            return 150;
        }
    }
    
    /**
     * 加载图片松手动画时间设置
     * @returns {number} 动画时间（毫秒）或150ms默认值
     */
    loadImageReleaseAnimationDuration() {
        try {
            const stored = localStorage.getItem('imageReleaseAnimationDuration');
            return stored !== null ? parseInt(stored, 10) : 150;
        } catch (e) {
            console.error('加载图片松手动画时间设置失败:', e);
            return 150;
        }
    }
    
    /**
     * 保存图片按下动画时间设置到localStorage
     */
    saveImagePressAnimationDuration() {
        try {
            localStorage.setItem('imagePressAnimationDuration', this.imagePressAnimationDuration.toString());
        } catch (e) {
            console.error('保存图片按下动画时间设置失败:', e);
        }
    }
    
    /**
     * 保存图片松手动画时间设置到localStorage
     */
    saveImageReleaseAnimationDuration() {
        try {
            localStorage.setItem('imageReleaseAnimationDuration', this.imageReleaseAnimationDuration.toString());
        } catch (e) {
            console.error('保存图片松手动画时间设置失败:', e);
        }
    }
    
    /**
     * 获取图片功能开关状态
     * @returns {boolean} 图片功能是否启用
     */
    getImageFeatureEnabled() {
        return this.imageFeatureEnabled;
    }
    
    /**
     * 获取图片按下动画时间设置
     * @returns {number} 动画时间（毫秒）
     */
    getImagePressAnimationDuration() {
        return this.imagePressAnimationDuration;
    }
    
    /**
     * 获取图片松手动画时间设置
     * @returns {number} 动画时间（毫秒）
     */
    getImageReleaseAnimationDuration() {
        return this.imageReleaseAnimationDuration;
    }
    
    /**
     * 设置图片功能开关状态
     * @param {boolean} enabled - 是否启用图片功能
     */
    setImageFeatureEnabled(enabled) {
        this.imageFeatureEnabled = !!enabled;
        this.saveImageFeatureEnabled();
    }
    
    /**
     * 设置图片按下动画时间
     * @param {number} duration - 动画时间（毫秒）
     */
    setImagePressAnimationDuration(duration) {
        // 验证输入值在有效范围内（10-1500毫秒）
        let validDuration = parseInt(duration, 10);
        validDuration = isNaN(validDuration) ? 150 : Math.max(10, Math.min(1500, validDuration));
        this.imagePressAnimationDuration = validDuration;
        this.saveImagePressAnimationDuration();
    }
    
    /**
     * 设置图片松手动画时间
     * @param {number} duration - 动画时间（毫秒）
     */
    setImageReleaseAnimationDuration(duration) {
        // 验证输入值在有效范围内（10-1500毫秒）
        let validDuration = parseInt(duration, 10);
        validDuration = isNaN(validDuration) ? 150 : Math.max(10, Math.min(1500, validDuration));
        this.imageReleaseAnimationDuration = validDuration;
        this.saveImageReleaseAnimationDuration();
    }
    
    /**
     * 从localStorage加载统一图片模式开关状态
     * @returns {boolean|null} 存储的开关状态或null
     */
    loadSingleImageModeEnabled() {
        try {
            const stored = localStorage.getItem('singleImageModeEnabled');
            return stored !== null ? stored === 'true' : null;
        } catch (e) {
            console.error('加载统一图片模式开关状态失败:', e);
            return null;
        }
    }
    
    /**
     * 保存统一图片模式开关状态到localStorage
     */
    saveSingleImageModeEnabled() {
        try {
            localStorage.setItem('singleImageModeEnabled', this.singleImageModeEnabled.toString());
        } catch (e) {
            console.error('保存统一图片模式开关状态失败:', e);
        }
    }
    
    /**
     * 获取统一图片模式开关状态
     * @returns {boolean} 统一图片模式是否启用
     */
    getSingleImageModeEnabled() {
        return this.singleImageModeEnabled;
    }
    
    /**
     * 设置统一图片模式开关状态
     * @param {boolean} enabled - 是否启用统一图片模式
     */
    setSingleImageModeEnabled(enabled) {
        this.singleImageModeEnabled = !!enabled;
        this.saveSingleImageModeEnabled();
    }
    
    /**
     * 从localStorage加载完整图片显示开关状态
     * @returns {boolean|null} 存储的开关状态或null
     */
    loadRoundImageEnabled() {
        try {
            const stored = localStorage.getItem('roundImageEnabled');
            return stored !== null ? stored === 'true' : null;
        } catch (e) {
            console.error('加载完整图片显示开关状态失败:', e);
            return null;
        }
    }
    
    /**
     * 保存完整图片显示开关状态到localStorage
     */
    saveRoundImageEnabled() {
        try {
            localStorage.setItem('roundImageEnabled', this.roundImageEnabled.toString());
        } catch (e) {
            console.error('保存完整图片显示开关状态失败:', e);
        }
    }
    
    /**
     * 获取完整图片显示开关状态
     * @returns {boolean} 完整图片显示是否启用
     */
    getRoundImageEnabled() {
        return this.roundImageEnabled;
    }
    
    /**
     * 设置完整图片显示开关状态
     * @param {boolean} enabled - 是否启用完整图片显示
     */
    setRoundImageEnabled(enabled) {
        this.roundImageEnabled = !!enabled;
        this.saveRoundImageEnabled();
    }
    
    /**
     * 从localStorage加载完整显示图片大小设置
     * @returns {number|null} 存储的图片大小百分比或null
     */
    loadFullImageSize() {
        try {
            const stored = localStorage.getItem('fullImageSize');
            return stored !== null ? parseInt(stored, 10) : null;
        } catch (e) {
            console.error('加载完整显示图片大小设置失败:', e);
            return null;
        }
    }
    
    /**
     * 保存完整显示图片大小设置到localStorage
     */
    saveFullImageSize() {
        try {
            localStorage.setItem('fullImageSize', this.fullImageSize.toString());
        } catch (e) {
            console.error('保存完整显示图片大小设置失败:', e);
        }
    }
    
    /**
     * 获取完整显示图片大小设置
     * @returns {number} 图片大小百分比
     */
    getFullImageSize() {
        return this.fullImageSize;
    }
    
    /**
     * 设置完整显示图片大小设置
     * @param {number} size - 图片大小百分比（10-500）
     */
    setFullImageSize(size) {
        // 确保大小在10-500之间
        this.fullImageSize = Math.max(10, Math.min(500, size));
        this.saveFullImageSize();
    }
    
    /**
     * 从localStorage加载图片层级设置
     * @returns {string|null} 存储的图片层级设置或null
     */
    loadImageLayer() {
        try {
            const stored = localStorage.getItem('dialerImageLayer');
            return stored !== null ? stored : null;
        } catch (e) {
            console.error('加载图片层级设置失败:', e);
            return null;
        }
    }
    
    /**
     * 保存图片层级设置到localStorage
     */
    saveImageLayer() {
        try {
            localStorage.setItem('dialerImageLayer', this.imageLayer);
        } catch (e) {
            console.error('保存图片层级设置失败:', e);
        }
    }
    
    /**
     * 获取图片层级设置
     * @returns {string} 图片层级设置 ('onTop' / 'below' / 'onTopCircle')
     */
    getImageLayer() {
        return this.imageLayer;
    }

    /**
     * 设置图片层级设置
     * @param {string} layer - 图片层级设置 ('onTop' / 'below' / 'onTopCircle')
     */
    setImageLayer(layer) {
        // 验证输入值（新增 onTopCircle：在数字字母上方且按圆形裁剪）
        if (layer !== 'onTop' && layer !== 'below' && layer !== 'onTopCircle') {
            console.warn('无效的图片层级设置，使用默认值 "onTop"');
            this.imageLayer = 'onTop';
        } else {
            this.imageLayer = layer;
        }
        this.saveImageLayer();
    }
    
    /**
     * 保存统一图片数据到localStorage
     * @param {string} imageData - 图片数据URL
     */
    saveSingleButtonImage(imageData) {
        try {
            localStorage.setItem('singleButtonImage', imageData);
        } catch (e) {
            console.error('保存统一图片失败:', e);
        }
    }
    
    /**
     * 获取保存的统一图片数据
     * @returns {string|null} 图片数据URL或null
     */
    getSingleButtonImage() {
        try {
            return localStorage.getItem('singleButtonImage');
        } catch (e) {
            console.error('获取统一图片失败:', e);
            return null;
        }
    }
    
    /**
     * 保存统一图片文件名
     * @param {string} fileName - 文件名
     */
    saveSingleButtonImageFileName(fileName) {
        try {
            localStorage.setItem('singleButtonImageFileName', fileName);
        } catch (e) {
            console.error('保存统一图片文件名失败:', e);
        }
    }
    
    /**
     * 获取保存的统一图片文件名
     * @returns {string|null} 文件名或null
     */
    getSingleButtonImageFileName() {
        try {
            return localStorage.getItem('singleButtonImageFileName');
        } catch (e) {
            console.error('获取统一图片文件名失败:', e);
            return null;
        }
    }
}

// 创建并导出单例实例到window对象，确保在浏览器中可用
window.DialerDataManager = DialerDataManager;

// 初始化数据管理器并暴露到全局
window.dialerDataManager = new DialerDataManager();

// 页面加载时，应用保存的音频文件夹设置
window.addEventListener('DOMContentLoaded', function() {
    if (window.dialerDataManager && window.setDialerAudioFolder) {
        const currentFolder = window.dialerDataManager.getCurrentAudioFolder();
        window.setDialerAudioFolder(currentFolder);
    }
});
