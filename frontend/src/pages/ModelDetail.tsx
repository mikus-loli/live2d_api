import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchModelConfig, fetchModelList, fetchModelSkins } from '@/utils/api';
import { ArrowLeft, Copy, Check } from 'lucide-react';

function encodePath(s: string) {
  return s.split('/').map(encodeURIComponent).join('/');
}

// 拖拽 hook
function useDrag(
  position: 'left' | 'right',
  mockScale: number,
  mockPageRef: React.RefObject<HTMLDivElement | null>,
  width: number,
  height: number,
  scale: number,
  onOffsetChange: (offsetX: number, offsetY: number) => void,
) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffsetX = useRef(0);
  const startOffsetY = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startY.current = e.clientY;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = position === 'left'
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      const dy = startY.current - e.clientY;
      const rawOffsetX = startOffsetX.current + dx / mockScale;
      const rawOffsetY = startOffsetY.current + dy / mockScale;

      const mockPage = mockPageRef.current;
      const maxOffsetX = mockPage ? (mockPage.clientWidth / mockScale - width * scale) : 9999;
      const maxOffsetY = mockPage ? (mockPage.clientHeight / mockScale - height * scale) : 9999;

      const newOffsetX = Math.max(0, Math.min(Math.round(rawOffsetX), Math.round(Math.max(0, maxOffsetX))));
      const newOffsetY = Math.max(0, Math.min(Math.round(rawOffsetY), Math.round(Math.max(0, maxOffsetY))));

      onOffsetChange(newOffsetX, newOffsetY);
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [position, mockScale, width, height, scale, onOffsetChange]);

  return { onMouseDown, setStartOffset: (ox: number, oy: number) => {
    startOffsetX.current = ox;
    startOffsetY.current = oy;
  }};
}

interface GenState {
  modelName: string;
  modelLast: string;
  modelJson: string;  // Cubism 4 .model3.json 文件名
  apiBase: string;
  isCubism4: boolean;
  position: 'left' | 'right';
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  scale: number;
  hideOnMobile: boolean;
  messages: string[];
  skinId: number;
  skins: { id: number; name: string; model_name?: string; textures?: string[] }[];
  isMulti: boolean;
}

const defaultMessages = ['你好呀~', '今天天气真好!', '有什么想问的吗?', '欢迎来到这里~', '我是你的看板娘哦~'];

function buildEmbedCSS(s: GenState) {
  const pos = s.position === 'left' ? 'left' : 'right';
  let css = `#live2d{position:fixed;${pos}:${s.offsetX}px;bottom:${s.offsetY}px;z-index:99999;pointer-events:auto;opacity:0;transition:opacity .4s ease}#live2d.show{opacity:1}#live2d-dialog{pointer-events:none}`;
  if (s.hideOnMobile) {
    css += '@media(max-width:768px){#live2d,#live2d-dialog{display:none!important}}';
  }
  return `<style>${css}</style>\n`;
}

function buildMobileCheckScript(s: GenState) {
  if (!s.hideOnMobile) return '';
  return '<script>function _l2dMobileCheck(){var e=document.getElementById("live2d"),d=document.getElementById("live2d-dialog");if(!e)return;var isMobile=screen.width<=768||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);if(isMobile){e.style.display="none";if(d)d.style.display="none"}else{e.style.display="";if(d)d.style.display=""}}_l2dMobileCheck();window.addEventListener("resize",_l2dMobileCheck)<\/script>';
}

function buildDialogCSS(s: GenState) {
  const h = Math.round(s.width * (s.scale || 1));
  return `#live2d-dialog{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(${s.offsetY}px + ${h + 20}px);background:rgba(255,255,255,0.95);border-radius:12px;padding:12px 16px;max-width:280px;min-width:120px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:99998;display:none;animation:dialogFadeIn 0.3s ease}#live2d-dialog.show{display:block}#live2d-dialog::after{content:"";position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid rgba(255,255,255,0.95)}#dialog-content{font-size:14px;color:#333;text-align:center;line-height:1.4}@keyframes dialogFadeIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
}

function getCodeTemplate2(s: GenState) {
  const w = Math.round(s.width * (s.scale || 1));
  const h = Math.round(s.height * (s.scale || 1));
  const pos = s.position === 'left' ? 'left' : 'right';
  const msgsJson = JSON.stringify(s.messages.length > 0 ? s.messages : defaultMessages);
  const skinId = s.skinId || 0;
  let modelUrl: string;
  if (s.isMulti && s.skins.length > 0 && skinId > 0) {
    const skin = s.skins[skinId - 1];
    if (skin && skin.model_name) {
      modelUrl = s.apiBase + '/model/' + encodePath(skin.model_name) + '/index.json';
    } else {
      modelUrl = s.apiBase + '/model/' + encodePath(s.modelName) + '/index.json';
    }
  } else if (skinId > 0) {
    modelUrl = s.apiBase + '/model/' + encodePath(s.modelName) + '/config-' + skinId + '.json';
  } else {
    modelUrl = s.apiBase + '/model/' + encodePath(s.modelName) + '/index.json';
  }

  return buildEmbedCSS(s) +
    `<style>${buildDialogCSS(s)}</style>\n` +
    '<div id="live2d-dialog"><div id="dialog-content"></div></div>\n' +
    `<canvas id="live2d" width="${w}" height="${h}"></canvas>\n` +
    '<script>\n' +
    '(function(){\n' +
    `var pos="${pos}",ox=${s.offsetX},w=${w},h=${h};\n` +
    `var msgs=${msgsJson};\n` +
    'var hoverMsgs=["干嘛呢你，快把手拿开～～","鼠…鼠标放错地方了！","你要干嘛呀？","怕怕(ノ≧∇≦)ノ","Hentai！","真…真的是不知羞耻！","不要动手动脚的！"];\n' +
    'var clickMsgs=["是…是不小心碰到了吧…","萝莉控是什么呀？","再摸的话我可要报警了！⌇●﹏●⌇","110 吗，这里有个变态一直在摸我(ó﹏ò｡)","干嘛动我呀！小心我咬你！","别摸我，有什么好摸的！"];\n' +
    'var timeMsgs={"6-7":"早上好！一日之计在于晨，美好的一天就要开始了~","8-11":"上午好！工作顺利嘛，不要久坐，多起来走动走动哦！","12-13":"中午了，工作了一个上午，现在是午餐时间！","14-17":"午后很容易犯困呢，今天的运动目标完成了吗？","18-19":"傍晚了！窗外夕阳的景色很美丽呢~","20-21":"晚上好，今天过得怎么样？","22-23":["已经这么晚了呀，早点休息吧，晚安~","深夜时要爱护眼睛呀！"],"0-5":"你是夜猫子呀？这么晚还不睡觉，明天起的来嘛？"};\n' +
    'var consoleMsg="哈哈，你打开了控制台，是想要看看我的小秘密吗？";\n' +
    'var copyMsg="你都复制了些什么呀，转载要记得加上出处哦！";\n' +
    'var backMsg="哇，你终于回来了~";\n' +
    'var welcomeMsg="欢迎来到这里~今天也要开心哦！";\n' +
    'var scrollMsgs={"25":"已经阅读四分之一啦，继续加油！","50":"已经阅读一半啦，觉得怎么样？","75":"马上就要读完了，精彩还在后面！","100":"哇，你竟然看完了！是不是很棒呢？"};\n' +
    'var dialogTimer=null,idleTimer=null,hoverTimer=null,scrollFired={};\n' +
    'function rnd(a){return a[Math.floor(Math.random()*a.length)]}\n' +
    'function updateDialogPos(){var el=document.getElementById("live2d-dialog");if(!el)return;var dl;if(pos==="left"){dl=ox+Math.round(w/2)}else{dl=window.innerWidth-ox-Math.round(w/2)}el.style.left=dl+"px"}\n' +
    'function showDialog(t,d){var el=document.getElementById("live2d-dialog"),c=document.getElementById("dialog-content");if(!el||!c)return;if(dialogTimer){clearTimeout(dialogTimer);dialogTimer=null}c.textContent=t;el.classList.add("show");resetIdle();if(d&&d>0){dialogTimer=setTimeout(function(){hideDialog()},d)}}\n' +
    'function hideDialog(){var el=document.getElementById("live2d-dialog");if(el)el.classList.remove("show");if(dialogTimer){clearTimeout(dialogTimer);dialogTimer=null}}\n' +
    'function showRandomMsg(){showDialog(rnd(msgs),5000)}\n' +
    'function getTimeMsg(){var h=new Date().getHours(),r;for(var k in timeMsgs){var p=k.split("-"),a=parseInt(p[0]),b=parseInt(p[1]);if(h>=a&&h<=b){r=timeMsgs[k];break}}if(!r)return null;return Array.isArray(r)?r[Math.floor(Math.random()*r.length)]:r}\n' +
    'function resetIdle(){if(idleTimer)clearTimeout(idleTimer);idleTimer=setTimeout(function(){showRandomMsg()},30000)}\n' +
    'updateDialogPos();window.addEventListener("resize",updateDialogPos);\n' +
    'var cv=document.getElementById("live2d");\n' +
    'cv.addEventListener("mouseenter",function(){hoverTimer=setTimeout(function(){showDialog(rnd(hoverMsgs),4000)},500)});\n' +
    'cv.addEventListener("mouseleave",function(){if(hoverTimer){clearTimeout(hoverTimer);hoverTimer=null}});\n' +
    'cv.addEventListener("click",function(){showDialog(rnd(clickMsgs),4000)});\n' +
    'document.addEventListener("copy",function(){showDialog(copyMsg,4000)});\n' +
    'document.addEventListener("visibilitychange",function(){if(!document.hidden)showDialog(backMsg,4000)});\n' +
    'window.addEventListener("scroll",function(){var st=document.documentElement.scrollTop||document.body.scrollTop,sh=document.documentElement.scrollHeight-document.documentElement.clientHeight,pct=Math.round(st/sh*100);["25","50","75","100"].forEach(function(m){if(pct>=parseInt(m)&&!scrollFired[m]){scrollFired[m]=true;showDialog(scrollMsgs[m],4000)}})});\n' +
    'setInterval(function(){if(window.outerWidth-window.innerWidth>160||window.outerHeight-window.innerHeight>160){if(consoleMsg){showDialog(consoleMsg,4000);consoleMsg=null}}},1000);\n' +
    `var s=document.createElement("script");s.src="${s.apiBase}/live2d.min.js";s.onload=function(){loadlive2d("live2d","${modelUrl}");setTimeout(function(){cv.classList.add("show");var tm=getTimeMsg();if(tm)showDialog(tm,6000);else showDialog(welcomeMsg,6000)},800)};document.head.appendChild(s)\n` +
    '})();\n' +
    '<\/script>' +
    buildMobileCheckScript(s);
}

function getCodeTemplate4(s: GenState) {
  const w = Math.round(s.width * (s.scale || 1));
  const h = Math.round(s.height * (s.scale || 1));
  const pos = s.position === 'left' ? 'left' : 'right';
  const msgsJson = JSON.stringify(s.messages.length > 0 ? s.messages : defaultMessages);

  return buildEmbedCSS(s) +
    `<style>${buildDialogCSS(s)}</style>\n` +
    '<div id="live2d-dialog"><div id="dialog-content"></div></div>\n' +
    `<canvas id="live2d" width="${w}" height="${h}"></canvas>\n` +
    '<script>\n' +
    '(function(){\n' +
    `var b="${s.apiBase}",w=${w},h=${h},pos="${pos}",ox=${s.offsetX},oy=${s.offsetY};\n` +
    `var msgs=${msgsJson};\n` +
    'var hoverMsgs=["干嘛呢你，快把手拿开～～","鼠…鼠标放错地方了！","你要干嘛呀？","怕怕(ノ≧∇≦)ノ","Hentai！","真…真的是不知羞耻！","不要动手动脚的！"];\n' +
    'var clickMsgs=["是…是不小心碰到了吧…","萝莉控是什么呀？","再摸的话我可要报警了！⌇●﹏●⌇","110 吗，这里有个变态一直在摸我(ó﹏ò｡)","干嘛动我呀！小心我咬你！","别摸我，有什么好摸的！"];\n' +
    'var timeMsgs={"6-7":"早上好！一日之计在于晨，美好的一天就要开始了~","8-11":"上午好！工作顺利嘛，不要久坐，多起来走动走动哦！","12-13":"中午了，工作了一个上午，现在是午餐时间！","14-17":"午后很容易犯困呢，今天的运动目标完成了吗？","18-19":"傍晚了！窗外夕阳的景色很美丽呢~","20-21":"晚上好，今天过得怎么样？","22-23":["已经这么晚了呀，早点休息吧，晚安~","深夜时要爱护眼睛呀！"],"0-5":"你是夜猫子呀？这么晚还不睡觉，明天起的来嘛？"};\n' +
    'var consoleMsg="哈哈，你打开了控制台，是想要看看我的小秘密吗？";\n' +
    'var copyMsg="你都复制了些什么呀，转载要记得加上出处哦！";\n' +
    'var backMsg="哇，你终于回来了~";\n' +
    'var welcomeMsg="欢迎来到这里~今天也要开心哦！";\n' +
    'var scrollMsgs={"25":"已经阅读四分之一啦，继续加油！","50":"已经阅读一半啦，觉得怎么样？","75":"马上就要读完了，精彩还在后面！","100":"哇，你竟然看完了！是不是很棒呢？"};\n' +
    'var dialogTimer=null,idleTimer=null,hoverTimer=null,scrollFired={};\n' +
    'function rnd(a){return a[Math.floor(Math.random()*a.length)]}\n' +
    'function updateDialogPos(){var el=document.getElementById("live2d-dialog");if(!el)return;var dl;if(pos==="left"){dl=ox+Math.round(w/2)}else{dl=window.innerWidth-ox-Math.round(w/2)}el.style.left=dl+"px"}\n' +
    'function showDialog(t,d){var el=document.getElementById("live2d-dialog"),c=document.getElementById("dialog-content");if(!el||!c)return;if(dialogTimer){clearTimeout(dialogTimer);dialogTimer=null}c.textContent=t;el.classList.add("show");resetIdle();if(d&&d>0){dialogTimer=setTimeout(function(){hideDialog()},d)}}\n' +
    'function hideDialog(){var el=document.getElementById("live2d-dialog");if(el)el.classList.remove("show");if(dialogTimer){clearTimeout(dialogTimer);dialogTimer=null}}\n' +
    'function showRandomMsg(){showDialog(rnd(msgs),5000)}\n' +
    'function getTimeMsg(){var h=new Date().getHours(),r;for(var k in timeMsgs){var p=k.split("-"),a=parseInt(p[0]),b=parseInt(p[1]);if(h>=a&&h<=b){r=timeMsgs[k];break}}if(!r)return null;return Array.isArray(r)?r[Math.floor(Math.random()*r.length)]:r}\n' +
    'function resetIdle(){if(idleTimer)clearTimeout(idleTimer);idleTimer=setTimeout(function(){showRandomMsg()},30000)}\n' +
    'updateDialogPos();window.addEventListener("resize",updateDialogPos);\n' +
    'document.addEventListener("copy",function(){showDialog(copyMsg,4000)});\n' +
    'document.addEventListener("visibilitychange",function(){if(!document.hidden)showDialog(backMsg,4000)});\n' +
    'window.addEventListener("scroll",function(){var st=document.documentElement.scrollTop||document.body.scrollTop,sh=document.documentElement.scrollHeight-document.documentElement.clientHeight,pct=Math.round(st/sh*100);["25","50","75","100"].forEach(function(m){if(pct>=parseInt(m)&&!scrollFired[m]){scrollFired[m]=true;showDialog(scrollMsgs[m],4000)}})});\n' +
    'setInterval(function(){if(window.outerWidth-window.innerWidth>160||window.outerHeight-window.innerHeight>160){if(consoleMsg){showDialog(consoleMsg,4000);consoleMsg=null}}},1000);\n' +
    'function ls(u,c){var d=document.querySelector(\'script[src="\'+u+\'"]\');if(d){if(c)c();return}var s=document.createElement("script");s.src=u;s.onload=c;document.head.appendChild(s)}\n' +
    'ls(b+"/live2dcubismcore.min.js",function(){\n' +
    '  ls(b+"/pixi.min.js",function(){\n' +
    '    ls(b+"/cubism4.min.js",function(){\n' +
    '      var cv=document.getElementById("live2d");\n' +
    '      cv.addEventListener("mouseenter",function(){hoverTimer=setTimeout(function(){showDialog(rnd(hoverMsgs),4000)},500)});\n' +
    '      cv.addEventListener("mouseleave",function(){if(hoverTimer){clearTimeout(hoverTimer);hoverTimer=null}});\n' +
    '      cv.addEventListener("click",function(){showDialog(rnd(clickMsgs),4000)});\n' +
    `      var app=new PIXI.Application({view:cv,width:${w},height:${h},backgroundAlpha:0,autoDensity:true,resolution:window.devicePixelRatio||1});\n` +
    `      PIXI.live2d.Live2DModel.from(b+"/model/${encodePath(s.modelName)}/${encodeURIComponent(s.modelLast)}.model3.json").then(function(m){\n` +
    `        m.anchor.set(0.5,0.5);m.x=${Math.round(w / 2)};m.y=${Math.round(h / 2)};\n` +
    '        var ow=m.width/m.scale.x,oh=m.height/m.scale.y;\n' +
    `        var sc=Math.min(${w}/ow,${h}/oh);m.scale.set(sc);\n` +
    '        app.stage.addChild(m);\n' +
    '        cv.addEventListener("pointermove",function(e){var r=cv.getBoundingClientRect();m.focus(e.clientX-r.left,e.clientY-r.top)});\n' +
    '        cv.addEventListener("pointerleave",function(){m.focus(0,0)});\n' +
    '        cv.classList.add("show");\n' +
    '        var tm=getTimeMsg();if(tm)showDialog(tm,6000);else showDialog(welcomeMsg,6000);\n' +
    '      });\n' +
    '    });\n' +
    '  });\n' +
    '});\n' +
    '})();\n' +
    '<\/script>' +
    buildMobileCheckScript(s);
}

export default function ModelDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const decodedName = decodeURIComponent(name || '');
  const displayName = decodedName.split('/').pop() || decodedName;
  const modelGroup = decodedName.includes('/') ? decodedName.split('/')[0] : '';

  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [genState, setGenState] = useState<GenState>({
    modelName: decodedName,
    modelLast: displayName,
    modelJson: '',
    apiBase: window.location.origin,
    isCubism4: false,
    position: 'right',
    offsetX: 0,
    offsetY: 0,
    width: 300,
    height: 400,
    scale: 1,
    hideOnMobile: true,
    messages: [...defaultMessages],
    skinId: 0,
    skins: [],
    isMulti: false,
  });

  const [messagesText, setMessagesText] = useState(defaultMessages.join('\n'));
  const previewRef = useRef<HTMLDivElement>(null);
  const mockPageRef = useRef<HTMLDivElement>(null);

  // 模拟网页预览常量
  const MOCK_W = 800;
  const MOCK_H = 500;
  const MOCK_SCALE = MOCK_W / 1920;
  const GEN_PREVIEW_SCALE = 1.5;

  const handleOffsetChange = useCallback((offsetX: number, offsetY: number) => {
    setGenState(prev => ({ ...prev, offsetX, offsetY }));
  }, []);

  const { onMouseDown: onModelDragStart, setStartOffset } = useDrag(
    genState.position,
    MOCK_SCALE,
    mockPageRef,
    genState.width,
    genState.height,
    genState.scale || 1,
    handleOffsetChange,
  );

  // 加载模型配置
  const loadModel = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchModelConfig(decodedName, 0);
      setConfig(data);

      // 与后台 computeModelDimensions 完全一致的尺寸计算
      const layout = data?.layout || {};
      const cy = layout.center_y || 0;
      const lw = layout.width || 2;
      const hitAreas = data?.hit_areas_custom || data?.hit_areas || {};
      const allYMin: number[] = [];
      for (const key in hitAreas) {
        const arr = hitAreas[key];
        if (Array.isArray(arr) && typeof arr[1] === 'number') allYMin.push(arr[1]);
      }
      let modelBottom: number;
      if (allYMin.length > 0) {
        modelBottom = cy + Math.min(...allYMin);
      } else {
        modelBottom = cy - lw / 2;
      }
      let optimalRatio = Math.abs(modelBottom);
      optimalRatio = Math.max(0.4, Math.min(optimalRatio, 2.0));
      const defaultWidth = 280;
      const defaultHeight = Math.round(defaultWidth * optimalRatio);

      // 检测 Cubism 4
      const isCubism4 = !!data?.model3;
      const modelJson = data?.model3 || '';

      // 获取皮肤列表和检测多模型分组
      let isMulti = false;
      let skinList: { id: number; name: string; model_name?: string; textures?: string[] }[] = [];
      
      const listData = await fetchModelList();
      const models = listData.models || [];
      
      // 检查是否为多模型分组
      for (const entry of models) {
        if (Array.isArray(entry)) {
          for (const sub of entry) {
            if (sub === decodedName) {
              isMulti = true;
              skinList = entry.map((m: string, i: number) => ({
                id: i + 1,
                name: m.split('/').pop() || m,
                model_name: m,
              }));
              break;
            }
          }
        }
        if (isMulti) break;
      }
      
      // 非多模型时，从 API 获取皮肤列表
      if (!isMulti) {
        try {
          const skinsData = await fetchModelSkins(decodedName);
          if (skinsData.skins && skinsData.skins.length > 0) {
            skinList = skinsData.skins.map(s => ({
              id: s.id,
              name: s.name,
              textures: s.textures,
            }));
          }
        } catch (e) { /* skins not available */ }
      }

      setGenState(prev => ({
        ...prev,
        width: defaultWidth,
        height: defaultHeight,
        isCubism4,
        modelJson,
        isMulti,
        skins: skinList,
      }));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [decodedName]);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // 生成代码
  const generatedCode = genState.isCubism4
    ? getCodeTemplate4(genState)
    : getCodeTemplate2(genState);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 模型尺寸计算
  const scale = genState.scale || 1;
  const mockModelW = Math.round(genState.width * MOCK_SCALE * scale * GEN_PREVIEW_SCALE);
  const mockModelH = Math.round(genState.height * MOCK_SCALE * scale * GEN_PREVIEW_SCALE);
  const mockOx = Math.round(genState.offsetX * MOCK_SCALE);
  const mockOy = Math.round(genState.offsetY * MOCK_SCALE);

  // 预览 iframe - canvas 尺寸与后台 renderW/renderH 一致
  const renderW = Math.round(genState.width * scale * GEN_PREVIEW_SCALE);
  const renderH = Math.round(genState.height * scale * GEN_PREVIEW_SCALE);
  
  var previewSrcDoc: string;
  if (genState.isCubism4) {
    // Cubism 4 预览
    var encodedModelPath = decodedName.split('/').map(encodeURIComponent).join('/');
    var modelUrl = genState.apiBase + '/model/' + encodedModelPath + '/' + encodeURIComponent(genState.modelJson);
    previewSrcDoc = '<!DOCTYPE html><html><head>' +
      '<script src="' + genState.apiBase + '/live2dcubismcore.min.js"><\/script>' +
      '<script src="' + genState.apiBase + '/pixi.min.js"><\/script>' +
      '<script src="' + genState.apiBase + '/cubism4.min.js"><\/script>' +
      '<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:transparent;overflow:hidden}canvas{max-width:100%;max-height:100%}</style>' +
      '</head><body><canvas id="live2d" width="' + renderW + '" height="' + renderH + '"></canvas>' +
      '<script>' +
      'try{' +
      'var cv=document.getElementById("live2d");' +
      'if(!cv)throw new Error("canvas not found");' +
      'var app=new PIXI.Application({view:cv,width:' + renderW + ',height:' + renderH + ',backgroundAlpha:0,autoDensity:true,resolution:window.devicePixelRatio||1});' +
      'if(!PIXI.live2d||!PIXI.live2d.Live2DModel)throw new Error("PIXI.live2d not available");' +
      'console.log("[Cubeism4] Loading model:",' + JSON.stringify(modelUrl) + ');' +
      'PIXI.live2d.Live2DModel.from(' + JSON.stringify(modelUrl) + ').then(function(m){' +
      'console.log("[Cubism4] Model loaded:",m.width,m.height,m.scale.x,m.scale.y);' +
      'm.anchor.set(0.5,0.5);m.x=' + (renderW/2) + ';m.y=' + (renderH/2) + ';' +
      'var origW=m.width/m.scale.x,origH=m.height/m.scale.y;' +
      'var sc=Math.min(' + renderW + '/origW,' + renderH + '/origH);m.scale.set(sc);' +
      'console.log("[Cubism4] Scale:",sc,"orig:",origW,origH);' +
      'app.stage.addChild(m);' +
      'console.log("[Cubism4] Model added to stage");' +
      '}).catch(function(e){console.error("[Cubism4] Load error:",e);});' +
      '}catch(e){console.error("[Cubism4] Init error:",e);}' +
      '<\/script></body></html>';
  } else {
    // Cubism 2 预览
    previewSrcDoc = '<!DOCTYPE html><html><head>' +
      '<script src="' + genState.apiBase + '/live2d.min.js"><\/script>' +
      '<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:transparent;overflow:hidden}canvas{max-width:100%;max-height:100%}</style>' +
      '</head><body><canvas id="live2d" width="' + renderW + '" height="' + renderH + '"></canvas>' +
      '<script>loadlive2d("live2d","' + genState.apiBase + '/get/?name=' + encodeURIComponent(decodedName) + '&textures_id=' + genState.skinId + '")<\/script>' +
      '</body></html>';
  }

  const updateGen = (partial: Partial<GenState>) => {
    setGenState(prev => ({ ...prev, ...partial }));
  };

  const handleMessagesChange = (text: string) => {
    setMessagesText(text);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    updateGen({ messages: lines.length > 0 ? lines : ['你好呀~'] });
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-16">
        <div className="container mx-auto px-4 py-6">
          {/* 返回 + 标题 */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-500 hover:text-cyan-600 transition-colors">
              <ArrowLeft size={18} />
              <span>返回</span>
            </button>
            <h1 className="text-xl font-bold text-gray-800">{displayName}</h1>
            {modelGroup && <span className="text-sm text-gray-400">{modelGroup}</span>}
          </div>

          <div className="flex gap-6 flex-col lg:flex-row">
            {/* 左侧：模拟网页预览 */}
            <div className="flex-shrink-0 flex items-start justify-center">
              <div ref={mockPageRef} className="w-[800px] h-[500px] bg-[#1a1a2e] border border-gray-200 rounded-xl overflow-hidden relative flex flex-col">
                {/* 模拟浏览器头部 */}
                <div className="h-7 bg-[#16213e] border-b border-white/5 flex items-center px-2.5 gap-[5px] flex-shrink-0">
                  <div className="w-[7px] h-[7px] rounded-full bg-[#ff5f57]"></div>
                  <div className="w-[7px] h-[7px] rounded-full bg-[#febc2e]"></div>
                  <div className="w-[7px] h-[7px] rounded-full bg-[#28c840]"></div>
                </div>
                {/* 模拟网页内容 */}
                <div className="flex-1 p-4 flex flex-col gap-2">
                  <div className="h-2 bg-white/[0.06] rounded"></div>
                  <div className="h-2 bg-white/[0.06] rounded w-3/5"></div>
                  <div className="h-2 bg-white/[0.06] rounded"></div>
                  <div className="h-2 bg-white/[0.06] rounded w-3/5"></div>
                  <div className="h-2 bg-white/[0.06] rounded"></div>
                </div>
                {/* 模拟 Live2D 模型位置 - 可拖拽 */}
                <div
                  className="absolute pointer-events-auto cursor-grab"
                  style={{
                    width: mockModelW,
                    height: mockModelH,
                    ...(genState.position === 'left'
                      ? { left: mockOx, right: 'auto' }
                      : { right: mockOx, left: 'auto' }),
                    bottom: mockOy,
                  }}
                  onMouseDown={(e) => {
                    setStartOffset(genState.offsetX, genState.offsetY);
                    onModelDragStart(e);
                  }}
                >
                  <div ref={previewRef} className="w-full h-full flex items-center justify-center pointer-events-none">
                    {loading ? (
                      <div className="text-white/30 text-xs">加载中...</div>
                    ) : config ? (
                      <iframe
                        srcDoc={previewSrcDoc}
                        className="w-full h-full border-0 pointer-events-none"
                        title="Live2D Preview"
                      />
                    ) : (
                      <div className="text-white/30 text-xs">加载失败</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：配置 + 代码 */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              {/* 位置 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">位置</label>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => updateGen({ position: 'left' })}
                    className={`flex-1 py-1.5 text-sm transition-colors ${genState.position === 'left' ? 'bg-cyan-500/10 text-cyan-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >左下</button>
                  <button
                    onClick={() => updateGen({ position: 'right' })}
                    className={`flex-1 py-1.5 text-sm transition-colors ${genState.position === 'right' ? 'bg-cyan-500/10 text-cyan-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >右下</button>
                </div>
              </div>

              {/* 偏移 */}
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">水平偏移</label>
                  <input type="number" min={0} max={500} value={genState.offsetX}
                    onChange={e => updateGen({ offsetX: parseInt(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">垂直偏移</label>
                  <input type="number" min={0} max={500} value={genState.offsetY}
                    onChange={e => updateGen({ offsetY: parseInt(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
              </div>

              {/* 宽高 */}
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">宽度</label>
                  <input type="number" min={100} max={800} value={genState.width}
                    onChange={e => updateGen({ width: Math.max(100, parseInt(e.target.value) || 300) })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">高度</label>
                  <input type="number" min={100} max={800} value={genState.height}
                    onChange={e => updateGen({ height: Math.max(100, parseInt(e.target.value) || 400) })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
              </div>

              {/* 缩放 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">缩放比例</label>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                  {[0.5, 1, 1.5, 2].map(s => (
                    <button key={s} onClick={() => updateGen({ scale: s })}
                      className={`flex-1 py-1.5 text-sm transition-colors ${genState.scale === s ? 'bg-cyan-500/10 text-cyan-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >{s}x</button>
                  ))}
                </div>
              </div>

              {/* 移动端隐藏 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">移动端隐藏</label>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                  <button onClick={() => updateGen({ hideOnMobile: true })}
                    className={`flex-1 py-1.5 text-sm transition-colors ${genState.hideOnMobile ? 'bg-cyan-500/10 text-cyan-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >隐藏</button>
                  <button onClick={() => updateGen({ hideOnMobile: false })}
                    className={`flex-1 py-1.5 text-sm transition-colors ${!genState.hideOnMobile ? 'bg-cyan-500/10 text-cyan-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >显示</button>
                </div>
              </div>

              {/* 皮肤选择 */}
              {genState.skins.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">皮肤选择</label>
                  <select value={genState.skinId}
                    onChange={e => updateGen({ skinId: parseInt(e.target.value) })}
                    className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono outline-none cursor-pointer focus:border-cyan-400 transition-colors"
                  >
                    <option value={0}>默认皮肤</option>
                    {genState.skins.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 聊天内容 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">聊天内容 <span className="text-gray-300 text-[11px]">（每行一条消息）</span></label>
                <textarea rows={4} value={messagesText}
                  onChange={e => handleMessagesChange(e.target.value)}
                  placeholder="你好呀~&#10;今天天气真好!&#10;有什么想问的吗?&#10;欢迎来到这里~"
                  className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono outline-none resize-y min-h-[60px] leading-relaxed focus:border-cyan-400 transition-colors"
                />
              </div>

              {/* 代码块 */}
              <div className="relative">
                <div className="flex items-center justify-between bg-gray-100 border border-gray-200 rounded-t-lg px-3 py-1.5">
                  <span className="text-xs text-gray-500">{genState.isCubism4 ? 'Cubism 4' : 'Cubism 2'} · HTML + JavaScript</span>
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    {copied ? <Check size={12} className="text-green-300" /> : <Copy size={12} />}
                    {copied ? '已复制' : '复制代码'}
                  </button>
                </div>
                <pre className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg p-4 text-xs text-gray-700 overflow-x-auto max-h-64 overflow-y-auto">
                  <code>{generatedCode}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
