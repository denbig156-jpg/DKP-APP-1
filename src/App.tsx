import React, { useState, useEffect } from 'react';
import {
  RotateCw,
  Film,
  Compass,
  Download,
  Power,
  Tv,
  BookOpen,
  Sliders,
  Check,
  Sun,
  Moon,
  PlugZap,
  Play,
  Pause,
  Volume2,
  Home,
  LogOut,
  MessageCircle,
} from 'lucide-react';
import { ApkBuilderSection } from './components/ApkBuilderSection';
import { generateAndroidProjectFiles } from './data/androidProjectFiles';
import { createZipBlob } from './utils/zipBuilder';

const CINEMA_SCENE_IMG = '/src/assets/images/cinema_movie_scene_1794150956399.jpg';
const VERTICAL_FEED_IMG = '/src/assets/images/vertical_feed_scene_1794150957939.jpg';

type CardinalAngle = 0 | 90 | 180 | 270;
type ServiceMode =
  | 'FULL_SENSOR'
  | 'REVERSE_PORTRAIT'
  | 'LANDSCAPE'
  | 'REVERSE_LANDSCAPE'
  | 'PORTRAIT';

/**
 * Screens on the phone:
 * - 'omni_app': Inside the OmniRotate settings app before exiting
 * - 'home_launcher': Android Home Screen after closing/exiting OmniRotate (shows app icons for YouTube, Netflix, TikTok, Chrome, Line)
 * - 'youtube': External YouTube / Movie App
 * - 'tiktok': External TikTok / Short Video App
 * - 'chrome': External Web Browser / Manga Reader
 * - 'line': External Chat App
 */
type PhoneScreenState =
  | 'omni_app'
  | 'home_launcher'
  | 'youtube'
  | 'tiktok'
  | 'chrome'
  | 'line';

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(true);

  // Background Service State
  const [bgServiceActive, setBgServiceActive] = useState<boolean>(true);
  const [serviceMode, setServiceMode] = useState<ServiceMode>('FULL_SENSOR');
  const [physicalPhoneAngle, setPhysicalPhoneAngle] = useState<CardinalAngle>(180);
  const [phoneScreen, setPhoneScreen] = useState<PhoneScreenState>('home_launcher');
  const [chargingCableConnected, setChargingCableConnected] = useState<boolean>(true);
  const [simMoviePlaying, setSimMoviePlaying] = useState<boolean>(true);
  const [showNotificationShade, setShowNotificationShade] = useState<boolean>(false);

  // Real Device Orientation Sensor State
  const [sensorEnabled, setSensorEnabled] = useState<boolean>(false);
  const [sensorStatusMsg, setSensorStatusMsg] = useState<string>(
    'แอปพับไปทำงานเบื้องหลังแล้ว — ลองกดเข้าแอปอื่นบนหน้าโฮมแล้วหมุนเครื่อง 180°'
  );

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (!sensorEnabled) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const beta = event.beta ?? 0;
      const gamma = event.gamma ?? 0;

      if (Math.abs(beta) > Math.abs(gamma)) {
        if (beta < -25) {
          setPhysicalPhoneAngle(180);
          setSensorStatusMsg(`เซนเซอร์ตรวจพบถือเครื่องกลับหัว 180° (beta: ${Math.round(beta)}°)`);
        } else if (beta > 25) {
          setPhysicalPhoneAngle(0);
          setSensorStatusMsg(`เซนเซอร์ตรวจพบถือเครื่องแนวตั้งปกติ 0° (beta: ${Math.round(beta)}°)`);
        }
      } else {
        if (gamma > 25) {
          setPhysicalPhoneAngle(90);
          setSensorStatusMsg(`เซนเซอร์ตรวจพบตะแคงเครื่อง 90° (gamma: ${Math.round(gamma)}°)`);
        } else if (gamma < -25) {
          setPhysicalPhoneAngle(270);
          setSensorStatusMsg(`เซนเซอร์ตรวจพบตะแคงเครื่อง 270° (gamma: ${Math.round(gamma)}°)`);
        }
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [sensorEnabled]);

  const toggleRealSensor = async () => {
    if (sensorEnabled) {
      setSensorEnabled(false);
      setSensorStatusMsg('ปิดเซนเซอร์แล้ว (ใช้ปุ่มจำลองมุมถือเครื่อง 0° / 90° / 180° / 270°)');
      return;
    }

    const anyDeviceOrientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof anyDeviceOrientation?.requestPermission === 'function') {
      try {
        const res = await anyDeviceOrientation.requestPermission();
        if (res === 'granted') {
          setSensorEnabled(true);
          setSensorStatusMsg('เชื่อมต่อเซนเซอร์เอียงเครื่องสำเร็จ — ลองหมุนโทรศัพท์ของคุณ');
        }
      } catch {
        setSensorEnabled(true);
      }
    } else {
      setSensorEnabled(true);
      setSensorStatusMsg('เปิดเซนเซอร์เอียงเครื่องแล้ว — ลองเอียงมือถือหรือกดปุ่ม 180°');
    }
  };

  /**
   * Action: Turn on background service inside OmniRotate app and IMMEDIATELY close/exit out to Android Home Screen!
   */
  const startBackgroundAndCloseApp = (mode: ServiceMode) => {
    setBgServiceActive(true);
    setServiceMode(mode);
    setPhoneScreen('home_launcher');
    setSensorStatusMsg(
      'เปิดบริการเบื้องหลังและปิดหน้าแอปออกมาที่หน้าโฮมแล้ว — กดเข้าแอปดูหนังหรือแอปอื่นได้เลย!'
    );
  };

  const computeContentCounterRotation = (): CardinalAngle => {
    if (!bgServiceActive) {
      // Stock Android without background service:
      // Home screen, TikTok, Line lock to 0° Portrait, and Stock Android NEVER rotates 180° upside down!
      if (
        phoneScreen === 'home_launcher' ||
        phoneScreen === 'tiktok' ||
        phoneScreen === 'line' ||
        phoneScreen === 'omni_app'
      ) {
        return 0;
      }
      if (physicalPhoneAngle === 180) {
        return 0; // Stock Android blocks 180° Reverse Portrait
      }
      return physicalPhoneAngle;
    }

    switch (serviceMode) {
      case 'FULL_SENSOR':
        return physicalPhoneAngle;
      case 'REVERSE_PORTRAIT':
        return 180;
      case 'LANDSCAPE':
        return 90;
      case 'REVERSE_LANDSCAPE':
        return 270;
      case 'PORTRAIT':
        return 0;
    }
  };

  const targetScreenOrientation = computeContentCounterRotation();
  const netAngleToViewerEyes = ((physicalPhoneAngle - targetScreenOrientation + 360) % 360) as CardinalAngle;
  const isImageUprightForViewer = netAngleToViewerEyes === 0;
  const isLandscapeContent = targetScreenOrientation === 90 || targetScreenOrientation === 270;

  const handleQuickDownloadZip = () => {
    const files = generateAndroidProjectFiles({
      appName: 'OmniRotate 4-Way',
      packageName: 'com.omnirotate.fourway',
      defaultMode: serviceMode,
      autoStartOnBoot: true,
      autoExitOnStart: true,
    });
    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'OmniRotate-4Way-Background-APK-Project.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const screenNames: Record<PhoneScreenState, string> = {
    omni_app: 'อยู่ในหน้าตั้งค่าแอป OmniRotate (ยังไม่ได้กดออก)',
    home_launcher: 'หน้าโฮมมือถือ (ปิดแอป OmniRotate ไปทำงานเบื้องหลังแล้ว)',
    youtube: 'กำลังใช้แอปอื่น: YouTube / Netflix (OmniRotate ทำงานเบื้องหลัง)',
    tiktok: 'กำลังใช้แอปอื่น: TikTok / Reels (OmniRotate ทำงานเบื้องหลัง)',
    chrome: 'กำลังใช้แอปอื่น: Chrome / อ่านการ์ตูน (OmniRotate ทำงานเบื้องหลัง)',
    line: 'กำลังใช้แอปอื่น: LINE แชท (OmniRotate ทำงานเบื้องหลัง)',
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar Contract: Strictly 1 row, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80">
        <a
          href="#simulator"
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          OmniRotate 4-Way
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a
            href="#simulator"
            className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            จำลองการทำงานเบื้องหลัง
          </a>
          <a
            href="#how-it-works"
            className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            หลักการพับแอปไปเบื้องหลัง
          </a>
          <a
            href="#apk-builder"
            className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            โค้ดต้นฉบับ .APK
          </a>
          <a
            href="#apk-builder"
            className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            วิธีติดตั้งลงมือถือ
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleQuickDownloadZip}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            ดาวน์โหลดชุดสร้าง .APK
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Section 1: Background Service Simulator */}
        <section id="simulator" className="pb-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Background ForegroundService</span>
                <span aria-hidden="true">·</span>
                <span>กดเปิดแล้วปิดแอปออกไปใช้แอปอื่นได้ทันที</span>
                <span aria-hidden="true">·</span>
                <span>หมุนครบ 4 ทิศรวมกลับหัว 180°</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white text-balance leading-tight">
                เปิดสวิตช์แล้วกดปิดแอปออกได้เลย — ตัวบริการจะรันเบื้องหลังคอยหมุนจอให้ทุกแอปที่คุณไปเปิด
              </h1>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                ไม่ต้องเปิดหนังหรือเปิดเว็บข้างในแอปนี้! เมื่อคุณเปิดแอป <strong>OmniRotate 4-Way</strong> กดเลือกโหมดหมุน 4 ทิศแล้ว แอปจะสั่ง <code className="font-mono text-amber-600 dark:text-amber-400">moveTaskToBack(true)</code> เพื่อพับตัวเองลงไปทำงานเบื้องหลังทันที จากนั้นคุณไปเปิดแอป YouTube, Netflix, TikTok หรือ LINE ตามปกติได้เลย เมื่อถือโทรศัพท์กลับหัว ภาพก็จะตั้งตรงให้ทันที
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsDark((d) => !d)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
                <span>{isDark ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
              </button>

              <a
                href="#apk-builder"
                className="min-h-[44px] px-4 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดโค้ด .APK</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Column: Workflow Controls demonstrating Background Operation */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-6 flex flex-col justify-between gap-6">
              <div className="space-y-6">
                {/* Step 1: Background Service Switch */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        ขั้นตอนที่ 1 · สั่งรันบริการเบื้องหลัง แล้วพับแอปออก
                      </span>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        สถานะเบื้องหลัง (RotationOverlayService)
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBgServiceActive((prev) => !prev)}
                      className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        bgServiceActive
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                      <span>{bgServiceActive ? 'รันเบื้องหลังอยู่' : 'หยุดเบื้องหลังแล้ว'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {[
                      {
                        mode: 'FULL_SENSOR' as ServiceMode,
                        title: 'เปิดเบื้องหลัง: หมุนอัตโนมัติ 4 ทิศ',
                        sub: 'กดปุ๊บพับแอปออกสู่หน้าโฮม -> หมุนตามการถือจริงรวมกลับหัว 180°',
                      },
                      {
                        mode: 'REVERSE_PORTRAIT' as ServiceMode,
                        title: 'เปิดเบื้องหลัง: ล็อกกลับหัว 180°',
                        sub: 'กดปุ๊บพับแอปออกสู่หน้าโฮม -> บังคับทุกแอปกลับหัว 180°',
                      },
                      {
                        mode: 'LANDSCAPE' as ServiceMode,
                        title: 'เปิดเบื้องหลัง: ล็อกแนวนอน 90°',
                        sub: 'กดปุ๊บพับแอปออกสู่หน้าโฮม -> บังคับทุกแอปแนวนอนซ้าย',
                      },
                      {
                        mode: 'REVERSE_LANDSCAPE' as ServiceMode,
                        title: 'เปิดเบื้องหลัง: ล็อกแนวนอน 270°',
                        sub: 'กดปุ๊บพับแอปออกสู่หน้าโฮม -> บังคับทุกแอปแนวนอนขวา',
                      },
                    ].map((item) => {
                      const active = bgServiceActive && serviceMode === item.mode;
                      return (
                        <button
                          key={item.mode}
                          type="button"
                          onClick={() => startBackgroundAndCloseApp(item.mode)}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-white'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">{item.title}</span>
                            {active && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {item.sub}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Open External Apps after exiting OmniRotate */}
                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        ขั้นตอนที่ 2 · เมื่อปิดแอปออกมาแล้ว ไปกดเข้าแอปอื่นตามปกติ
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        เลือกหน้าจอมือถือ (หน้าโฮม หรือแอปภายนอกอื่นๆ)
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'home_launcher' as PhoneScreenState, label: 'หน้าโฮมมือถือ', icon: Home },
                      { id: 'youtube' as PhoneScreenState, label: 'แอป YouTube / หนัง', icon: Film },
                      { id: 'tiktok' as PhoneScreenState, label: 'แอป TikTok / Reels', icon: Tv },
                      { id: 'chrome' as PhoneScreenState, label: 'แอป Chrome / เว็บ', icon: BookOpen },
                      { id: 'line' as PhoneScreenState, label: 'แอป LINE แชท', icon: MessageCircle },
                      { id: 'omni_app' as PhoneScreenState, label: 'เปิดหน้าแอปตั้งค่า', icon: Sliders },
                    ].map((scr) => {
                      const Icon = scr.icon;
                      const isSelected = phoneScreen === scr.id;
                      return (
                        <button
                          key={scr.id}
                          type="button"
                          onClick={() => setPhoneScreen(scr.id)}
                          className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white'
                              : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{scr.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Physical Phone Orientation */}
                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      ขั้นตอนที่ 3 · ลองหมุนตัวเครื่องโทรศัพท์ทั้ง 4 ทิศทางขณะใช้แอปอื่น
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      ท่าทางการถือโทรศัพท์จริง (เช่น ถือกลับหัว 180° ตอนเสียบสายชาร์จ)
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { angle: 0 as CardinalAngle, label: '0° ถือตั้งปกติ', sub: 'สายชาร์จอยู่ล่าง' },
                      { angle: 180 as CardinalAngle, label: '180° ถือกลับหัว', sub: 'สายชาร์จชี้ขึ้นบน' },
                      { angle: 90 as CardinalAngle, label: '90° ตะแคงซ้าย', sub: 'แนวนอนซ้าย' },
                      { angle: 270 as CardinalAngle, label: '270° ตะแคงขวา', sub: 'แนวนอนขวา' },
                    ].map((pos) => {
                      const active = physicalPhoneAngle === pos.angle;
                      return (
                        <button
                          key={pos.angle}
                          type="button"
                          onClick={() => setPhysicalPhoneAngle(pos.angle)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'border-amber-500 bg-amber-500 text-slate-950 font-semibold shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <div className="text-xs font-bold whitespace-nowrap">{pos.label}</div>
                          <div
                            className={`text-[11px] mt-0.5 whitespace-nowrap ${
                              active ? 'text-slate-900' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {pos.sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={toggleRealSensor}
                      className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-colors cursor-pointer ${
                        sensorEnabled
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Compass className="w-4 h-4 text-amber-500" />
                      <span>{sensorEnabled ? 'กำลังหมุนตามเซนเซอร์มือถือจริง' : 'เชื่อมเซนเซอร์เอียงมือถือเครื่องนี้'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChargingCableConnected((c) => !c)}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer"
                    >
                      <PlugZap className="w-4 h-4 text-amber-500" />
                      <span>{chargingCableConnected ? 'แสดงสายชาร์จจำลอง' : 'ซ่อนสายชาร์จ'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div
                className={`rounded-xl border p-4 transition-colors ${
                  isImageUprightForViewer
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200'
                    : 'border-rose-500/50 bg-rose-500/10 text-rose-950 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">
                    {isImageUprightForViewer
                      ? 'ภาพของแอปที่เปิดอยู่ตั้งตรง 100% (ด้วยบริการเบื้องหลัง)'
                      : 'ภาพกลับหัว! (เนื่องจากคุณกดหยุดบริการเบื้องหลังไว้)'}
                  </span>
                  <span className="font-mono text-xs">
                    ถือเครื่อง {physicalPhoneAngle}° · จอหมุนชดเชย {-targetScreenOrientation}°
                  </span>
                </div>
                <p className="text-xs mt-1 opacity-90">
                  {screenNames[phoneScreen]}
                </p>
              </div>
            </div>

            {/* Right Column: Interactive Phone showing External Apps & Home Screen */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-slate-900/50 p-6 flex flex-col justify-between items-center relative overflow-hidden min-h-[560px]">
              <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 z-10">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">
                    {phoneScreen === 'omni_app'
                      ? 'ในแอปตั้งค่า OmniRotate'
                      : 'ออกจากแอปแล้ว · กำลังรันเบื้องหลัง'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-400 font-mono">ถือเครื่อง {physicalPhoneAngle}°</span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPhysicalPhoneAngle((prev) => (((prev + 90) % 360) as CardinalAngle))
                  }
                  className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>หมุนตัวเครื่องทีละ 90°</span>
                </button>
              </div>

              <div className="my-auto py-8 flex items-center justify-center w-full">
                <div
                  className="relative transition-transform duration-200 ease-out flex flex-col items-center"
                  style={{
                    transform: `rotate(${physicalPhoneAngle}deg)`,
                  }}
                >
                  {/* Physical Phone Chassis */}
                  <div className="relative w-[264px] h-[488px] rounded-[42px] bg-slate-950 border-[6px] border-slate-700 shadow-2xl p-2.5 flex flex-col justify-between select-none">
                    <div className="absolute -right-[9px] top-24 w-[3px] h-12 bg-slate-500 rounded-r" />
                    <div className="absolute -right-[9px] top-40 w-[3px] h-8 bg-amber-500 rounded-r" />

                    {/* Front Camera Punch-hole */}
                    <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-black/90 border border-slate-800 pointer-events-none">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-600" />
                      <span className="text-[9px] font-mono text-slate-400">กล้องหน้า</span>
                    </div>

                    {/* Inner Screen */}
                    <div className="relative w-full h-full rounded-[30px] overflow-hidden bg-slate-950 flex items-center justify-center">
                      <div
                        className="relative transition-transform duration-200 ease-out flex flex-col justify-between bg-slate-950 text-white overflow-hidden"
                        style={{
                          width: isLandscapeContent ? '468px' : '244px',
                          height: isLandscapeContent ? '244px' : '468px',
                          transform: `rotate(${-targetScreenOrientation}deg)`,
                        }}
                      >
                        {/* Android System Status Bar (shows Background Service icon) */}
                        <div className="flex items-center justify-between px-3.5 pt-2 pb-1.5 bg-slate-950/90 border-b border-slate-800/80 text-[10px] z-20 shrink-0">
                          <span className="font-mono font-semibold text-emerald-400">
                            {bgServiceActive ? `BG 4-Way (${targetScreenOrientation}°)` : 'BG ปิดอยู่'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowNotificationShade((s) => !s)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer"
                          >
                            {showNotificationShade ? 'ปิดแถบแจ้งเตือน' : 'ดึงแถบแจ้งเตือนลง'}
                          </button>
                        </div>

                        {/* Background Service Notification Control */}
                        {showNotificationShade && (
                          <div className="absolute inset-x-2 top-8 z-30 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 p-2.5 shadow-xl space-y-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-300">
                              <span className="font-semibold text-white">
                                OmniRotate (กำลังรันเบื้องหลัง)
                              </span>
                              <span className="font-mono text-amber-400">{serviceMode}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                              {[
                                { m: 'FULL_SENSOR' as ServiceMode, l: '4 ทิศอัตโนมัติ' },
                                { m: 'REVERSE_PORTRAIT' as ServiceMode, l: 'กลับหัว 180°' },
                                { m: 'LANDSCAPE' as ServiceMode, l: 'แนวนอน' },
                              ].map((btn) => (
                                <button
                                  key={btn.m}
                                  type="button"
                                  onClick={() => {
                                    setBgServiceActive(true);
                                    setServiceMode(btn.m);
                                    setShowNotificationShade(false);
                                  }}
                                  className={`py-1.5 px-1 rounded text-[10px] font-semibold cursor-pointer ${
                                    bgServiceActive && serviceMode === btn.m
                                      ? 'bg-amber-500 text-slate-950'
                                      : 'bg-slate-800 text-slate-200'
                                  }`}
                                >
                                  {btn.l}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Phone Screen Content */}
                        <div className="flex-1 relative overflow-hidden flex flex-col">
                          {/* SCREEN A: ANDROID HOME SCREEN LAUNCHER (After closing OmniRotate app) */}
                          {phoneScreen === 'home_launcher' && (
                            <div className="w-full h-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-4 flex flex-col justify-between">
                              <div className="text-center pt-2">
                                <p className="text-[10px] font-mono text-emerald-400">
                                  ปิดแอป OmniRotate ออกมาหน้าโฮมแล้ว (รันเบื้องหลังอยู่)
                                </p>
                                <h4 className="text-xs font-bold text-white mt-1">
                                  แตะเลือกเข้าแอปอื่นบนมือถือได้เลย
                                </h4>
                              </div>

                              <div className="grid grid-cols-3 gap-3 my-auto">
                                {[
                                  {
                                    id: 'youtube' as PhoneScreenState,
                                    name: 'YouTube',
                                    color: 'bg-rose-600',
                                    icon: Film,
                                  },
                                  {
                                    id: 'tiktok' as PhoneScreenState,
                                    name: 'TikTok',
                                    color: 'bg-slate-800 border border-slate-600',
                                    icon: Tv,
                                  },
                                  {
                                    id: 'chrome' as PhoneScreenState,
                                    name: 'Chrome',
                                    color: 'bg-sky-600',
                                    icon: BookOpen,
                                  },
                                  {
                                    id: 'line' as PhoneScreenState,
                                    name: 'LINE',
                                    color: 'bg-emerald-600',
                                    icon: MessageCircle,
                                  },
                                  {
                                    id: 'omni_app' as PhoneScreenState,
                                    name: 'OmniRotate',
                                    color: 'bg-amber-500 text-slate-950',
                                    icon: RotateCw,
                                  },
                                ].map((appIcon) => {
                                  const Icon = appIcon.icon;
                                  return (
                                    <button
                                      key={appIcon.id}
                                      type="button"
                                      onClick={() => setPhoneScreen(appIcon.id)}
                                      className="flex flex-col items-center gap-1.5 group cursor-pointer"
                                    >
                                      <div
                                        className={`w-11 h-11 rounded-2xl ${appIcon.color} flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform`}
                                      >
                                        <Icon className="w-5 h-5" />
                                      </div>
                                      <span className="text-[10px] font-medium text-slate-200">
                                        {appIcon.name}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="text-center text-[10px] text-slate-400">
                                แม้หน้าโฮมปกติจะไม่หมุนกลับหัว แต่เมื่อมีบริการเบื้องหลัง หน้าโฮมและทุกแอปก็หมุนตั้งตรงตามที่คุณถือ!
                              </div>
                            </div>
                          )}

                          {/* SCREEN B: EXTERNAL YOUTUBE / MOVIE APP */}
                          {phoneScreen === 'youtube' && (
                            <div className="relative w-full h-full flex flex-col justify-between bg-black">
                              <img
                                src={CINEMA_SCENE_IMG}
                                alt="External YouTube Movie App"
                                referrerPolicy="no-referrer"
                                className="absolute inset-0 w-full h-full object-cover opacity-90"
                              />
                              <div className="relative z-10 bg-gradient-to-b from-black/80 to-transparent p-3 flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-white truncate">
                                  แอป YouTube / Netflix (แอปภายนอก)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setPhoneScreen('home_launcher')}
                                  className="px-2 py-0.5 rounded bg-white/20 text-white text-[10px] cursor-pointer"
                                >
                                  กลับหน้าโฮม
                                </button>
                              </div>

                              <div className="relative z-10 my-auto px-3 text-center">
                                <div className="inline-block px-3 py-1.5 rounded-lg bg-black/75 backdrop-blur-sm border border-white/15">
                                  <p className="text-xs font-bold text-white">
                                    กำลังดูหนังในแอปอื่น (ภาพตั้งตรงเสมอ!)
                                  </p>
                                  <p className="text-[10px] text-amber-300 mt-0.5">
                                    OmniRotate ทำงานอยู่เบื้องหลัง
                                  </p>
                                </div>
                              </div>

                              <div className="relative z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 space-y-1.5">
                                <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                                  <div className="w-2/3 h-full bg-rose-500" />
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-200">
                                  <button
                                    type="button"
                                    onClick={() => setSimMoviePlaying((p) => !p)}
                                    className="flex items-center gap-1 font-semibold cursor-pointer"
                                  >
                                    {simMoviePlaying ? (
                                      <Pause className="w-3 h-3 text-rose-400" />
                                    ) : (
                                      <Play className="w-3 h-3 text-rose-400" />
                                    )}
                                    <span>01:14:28 / 02:05:00</span>
                                  </button>
                                  <Volume2 className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* SCREEN C: EXTERNAL TIKTOK / REELS APP */}
                          {phoneScreen === 'tiktok' && (
                            <div className="relative w-full h-full flex flex-col justify-between bg-slate-950">
                              <img
                                src={VERTICAL_FEED_IMG}
                                alt="External TikTok App"
                                referrerPolicy="no-referrer"
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                              <div className="relative z-10 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-[11px]">
                                <span className="font-bold text-white">แอป TikTok (แอปภายนอก)</span>
                                <button
                                  type="button"
                                  onClick={() => setPhoneScreen('home_launcher')}
                                  className="px-2 py-0.5 rounded bg-white/20 text-white text-[10px] cursor-pointer"
                                >
                                  กลับหน้าโฮม
                                </button>
                              </div>
                              <div className="relative z-10 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                                <p className="text-xs font-bold text-white">@kyoto_nightwalk</p>
                                <p className="text-[11px] text-slate-200 mt-1">
                                  เสียบสายชาร์จไว้ด้านบนแล้วถือโทรศัพท์กลับหัวเล่น TikTok ได้เลยเพราะบริการเบื้องหลังช่วยพลิกจอให้!
                                </p>
                              </div>
                            </div>
                          )}

                          {/* SCREEN D: EXTERNAL CHROME / WEB READER */}
                          {phoneScreen === 'chrome' && (
                            <div className="w-full h-full bg-slate-900 p-3.5 flex flex-col justify-between text-left">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-sky-400">
                                    แอป Google Chrome (แอปภายนอก)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setPhoneScreen('home_launcher')}
                                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] cursor-pointer"
                                  >
                                    กลับหน้าโฮม
                                  </button>
                                </div>
                                <h4 className="text-xs font-bold text-white leading-snug">
                                  อ่านการ์ตูนและเว็บไซต์ขณะถือเครื่องกลับหัว 180°
                                </h4>
                                <p className="text-[11px] text-slate-300 leading-relaxed">
                                  แอป OmniRotate ได้ถูกปิดพับลงไปทำงานเบื้องหลังเรียบร้อยแล้ว คุณจึงเปิดใช้ Chrome หรือแอปใดๆ ในเครื่องได้ตามปกติโดยที่ภาพหมุนตามมือครบ 4 ทิศทาง
                                </p>
                              </div>
                              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                                <span>chrome://reader-mode</span>
                                <span className="text-emerald-400 font-semibold">ภาพตั้งตรง 100%</span>
                              </div>
                            </div>
                          )}

                          {/* SCREEN E: EXTERNAL LINE CHAT APP */}
                          {phoneScreen === 'line' && (
                            <div className="w-full h-full bg-slate-900 p-3.5 flex flex-col justify-between text-left">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                  <span className="text-xs font-bold text-emerald-400">
                                    LINE แชท (แอปภายนอก)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setPhoneScreen('home_launcher')}
                                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] cursor-pointer"
                                  >
                                    กลับหน้าโฮม
                                  </button>
                                </div>
                                <div className="space-y-2 pt-1">
                                  <div className="bg-slate-800 rounded-xl p-2 text-[11px] text-slate-200 max-w-[85%]">
                                    นอนชาร์จแบตเล่นมือถืออยู่เหรอ?
                                  </div>
                                  <div className="bg-emerald-600 rounded-xl p-2 text-[11px] text-white max-w-[85%] ml-auto">
                                    ใช่! เปิดแอปหมุนจอไว้เบื้องหลัง ตอนนี้ถือโทรศัพท์กลับหัวเอาสายชาร์จไว้ข้างบน พิมพ์แชทสบายเลย
                                  </div>
                                </div>
                              </div>
                              <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                                แป้นพิมพ์และหน้าแชทหมุนตั้งตรงตามทิศการถือ
                              </div>
                            </div>
                          )}

                          {/* SCREEN F: INSIDE OMNIROTATE APP (Only for turning on & auto-exiting) */}
                          {phoneScreen === 'omni_app' && (
                            <div className="w-full h-full bg-slate-950 p-3.5 flex flex-col justify-between">
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold text-amber-400">
                                  ตั้งค่าแอป OmniRotate 4-Way
                                </h4>
                                <p className="text-[10px] text-slate-300">
                                  แตะโหมดที่ต้องการ แล้วแอปจะ<strong>ปิดตัวเองลงไปทำงานเบื้องหลังทันที</strong> เพื่อให้คุณไปเข้าแอปอื่นได้เลย:
                                </p>
                                <div className="space-y-1.5 pt-1">
                                  {[
                                    { m: 'FULL_SENSOR' as ServiceMode, t: 'เปิดเบื้องหลัง: หมุนครบ 4 ทิศ (แล้วปิดแอปออก)' },
                                    { m: 'REVERSE_PORTRAIT' as ServiceMode, t: 'เปิดเบื้องหลัง: ล็อกกลับหัว 180° (แล้วปิดแอปออก)' },
                                    { m: 'LANDSCAPE' as ServiceMode, t: 'เปิดเบื้องหลัง: ล็อกแนวนอน 90° (แล้วปิดแอปออก)' },
                                  ].map((row) => (
                                    <button
                                      key={row.m}
                                      type="button"
                                      onClick={() => startBackgroundAndCloseApp(row.m)}
                                      className="w-full px-2.5 py-2 rounded-lg text-left text-[10px] font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-between cursor-pointer"
                                    >
                                      <span>{row.t}</span>
                                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setPhoneScreen('home_launcher')}
                                className="w-full py-2 rounded-lg bg-slate-800 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Home className="w-3.5 h-3.5" />
                                <span>กดปุ่มโฮมออกไปหน้าจอมือถือ</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Android Bottom Home Bar (Click anytime to exit to Home Launcher) */}
                        <div className="h-6 bg-slate-950 border-t border-slate-900 flex items-center justify-center shrink-0">
                          <button
                            type="button"
                            onClick={() => setPhoneScreen('home_launcher')}
                            className="px-4 py-1 flex items-center gap-1 text-[10px] text-slate-400 hover:text-white cursor-pointer"
                            title="กดปุ่มโฮมเพื่อออกไปหน้าโฮมมือถือ"
                          >
                            <div className="w-16 h-1 rounded-full bg-slate-500" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-[9px] font-mono text-slate-300 whitespace-nowrap">
                      พอร์ตชาร์จ (ตูดเครื่อง)
                    </div>
                  </div>

                  {chargingCableConnected && (
                    <div className="flex flex-col items-center pointer-events-none">
                      <div className="w-4 h-5 rounded-b bg-amber-500 border border-amber-300 flex items-center justify-center">
                        <PlugZap className="w-3 h-3 text-slate-950" />
                      </div>
                      <div className="w-1.5 h-10 bg-gradient-to-b from-amber-500 to-slate-700 rounded-full" />
                      <span className="mt-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono text-amber-300 whitespace-nowrap">
                        สายชาร์จชี้ไปทางนี้
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
                <span>{sensorStatusMsg}</span>
                <span className="font-mono text-emerald-400">
                  {bgServiceActive ? `Background: ${serviceMode}` : 'Background: STOPPED'}
                </span>
              </div>
            </div>
          </div>

          {/* 3-Step Explanation of how the Background APK works */}
          <div id="how-it-works" className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[
              {
                step: '01. กดเปิดในแอปเพียงครั้งเดียว',
                title: 'สั่งรัน ForegroundService แล้วพับแอปออกทันที',
                desc: 'เมื่อกดปุ่มเปิดโหมดหมุน 4 ทิศในแอป คำสั่ง moveTaskToBack(true) จะพับหน้าต่างแอปทิ้งลงเบื้องหลังทันที ไม่ต้องค้างหน้าแอปไว้',
              },
              {
                step: '02. ไปเข้าแอปดูหนังหรือแอปอื่นตามปกติ',
                title: 'แผ่นใส 0×0 พิกเซล คุมการหมุนอยู่เบื้องหลัง',
                desc: 'RotationOverlayService สร้างแผ่นใสขนาด 0 พิกเซลระดับระบบ (TYPE_APPLICATION_OVERLAY) ทำให้ทุกแอปที่คุณเปิดขึ้นมาหมุนตามได้ทั้ง 4 ทิศ',
              },
              {
                step: '03. ถือโทรศัพท์กลับหัว 180° ภาพก็ตั้งตรง',
                title: 'สลับโหมดหรือปิดได้จากแถบแจ้งเตือนด้านบน',
                desc: 'ขณะดูหนังในแอปอื่น หากต้องการล็อกทิศหรือหยุดหมุน สามารถดึงแถบแจ้งเตือนด้านบนลงมากดสลับได้ทันทีโดยไม่ต้องกลับเข้าแอป',
              },
            ].map((card) => (
              <div
                key={card.step}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5"
              >
                <p className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {card.step}
                </p>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
                  {card.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Android .APK Studio & Source Code Bundle */}
        <ApkBuilderSection />
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-8 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>
            OmniRotate 4-Way Background Service APK Studio · ทำงานเบื้องหลังทับทุกแอป ครบ 4 ทิศทาง (0°, 90°, 180° กลับหัว, 270°)
          </span>
          <a
            href="#simulator"
            className="text-slate-700 dark:text-slate-300 hover:underline underline-offset-4"
          >
            กลับขึ้นด้านบน
          </a>
        </div>
      </footer>
    </div>
  );
}
