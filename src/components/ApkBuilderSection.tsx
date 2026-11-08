import React, { useState, useMemo } from 'react';
import {
  Download,
  Copy,
  Check,
  FileCode,
  Terminal,
  ShieldCheck,
  Smartphone,
  Sliders,
} from 'lucide-react';
import {
  ApkConfigOptions,
  generateAndroidProjectFiles,
} from '../data/androidProjectFiles';
import { createZipBlob } from '../utils/zipBuilder';

export const ApkBuilderSection: React.FC = () => {
  const [config, setConfig] = useState<ApkConfigOptions>({
    appName: 'OmniRotate 4-Way',
    packageName: 'com.omnirotate.fourway',
    defaultMode: 'FULL_SENSOR',
    autoStartOnBoot: true,
    autoExitOnStart: true,
  });

  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copiedFile, setCopiedFile] = useState<boolean>(false);
  const [copiedAdb, setCopiedAdb] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const projectFiles = useMemo(
    () => generateAndroidProjectFiles(config),
    [config]
  );

  const activeFile = projectFiles[selectedFileIndex] || projectFiles[0];

  const handleDownloadZip = () => {
    const blob = createZipBlob(projectFiles);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'OmniRotate-4Way-Background-APK-Project.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
  };

  const handleDownloadSingleFile = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(activeFile.content);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  const handleCopyAdb = async (cmd: string, id: string) => {
    await navigator.clipboard.writeText(cmd);
    setCopiedAdb(id);
    setTimeout(() => setCopiedAdb(null), 2000);
  };

  return (
    <section id="apk-builder" className="py-10 border-t border-slate-200 dark:border-slate-800/80">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">
            02. ดาวน์โหลดโปรเจกต์ Android .APK (ทำงานเบื้องหลังด้วย ForegroundService + WindowManager)
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 text-balance">
            โค้ดต้นฉบับแอป .APK ที่พับตัวเองลงเบื้องหลังทันทีเมื่อกดเปิด เพื่อออกไปใช้แอปอื่นได้เลย
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            ไม่ใช่แอปเล่นวิดีโอในตัว แต่เป็นแอปบริการเบื้องหลัง (<code className="font-mono text-amber-600 dark:text-amber-400">RotationOverlayService.kt</code>) เมื่อคุณกดเปิดโหมดหมุน 4 ทิศในแอป ระบบจะสั่ง <code className="font-mono text-amber-600 dark:text-amber-400">moveTaskToBack(true)</code> เพื่อปิดหน้าต่างแอปลงเบื้องหลังทันที แล้วคุณสามารถไปเข้า YouTube, Netflix, TikTok หรือแอปใดๆ ในเครื่องได้เลย
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadZip}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs sm:text-sm flex items-center gap-2.5 shadow-lg shadow-amber-500/15 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>ดาวน์โหลดชุดโปรเจกต์ .ZIP เรียบร้อยแล้ว</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดชุดสร้างไฟล์ .APK (.ZIP)</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-base">
              <Sliders className="w-4 h-4 text-amber-500" />
              <h3>ตั้งค่าการทำงานเบื้องหลังของไฟล์ .APK</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อแอป (App Name)
                </label>
                <input
                  type="text"
                  value={config.appName}
                  onChange={(e) => setConfig({ ...config, appName: e.target.value || 'OmniRotate 4-Way' })}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  โหมดเบื้องหลังเริ่มต้นเมื่อกดเปิด
                </label>
                <select
                  value={config.defaultMode}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      defaultMode: e.target.value as ApkConfigOptions['defaultMode'],
                    })
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="FULL_SENSOR">หมุนอัตโนมัติครบ 4 ทิศ (0° / 90° / 180° กลับหัว / 270°)</option>
                  <option value="REVERSE_PORTRAIT">ล็อกกลับหัว 180° ตลอดเวลา</option>
                  <option value="LANDSCAPE">ล็อกแนวนอน 90°</option>
                  <option value="REVERSE_LANDSCAPE">ล็อกแนวนอน 270°</option>
                </select>
              </div>

              <div className="pt-2 space-y-2.5">
                <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 cursor-pointer">
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    พับแอปออกสู่หน้าโฮมอัตโนมัติทันทีที่กดเปิด (moveTaskToBack)
                  </span>
                  <input
                    type="checkbox"
                    checked={config.autoExitOnStart}
                    onChange={(e) => setConfig({ ...config, autoExitOnStart: e.target.checked })}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 cursor-pointer">
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    รันเบื้องหลังอัตโนมัติตั้งแต่เปิดเครื่อง (BootReceiver)
                  </span>
                  <input
                    type="checkbox"
                    checked={config.autoStartOnBoot}
                    onChange={(e) => setConfig({ ...config, autoStartOnBoot: e.target.checked })}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>รองรับ Android 7.0 – 15</span>
            <span className="font-mono">Background Service 100%</span>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-6 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-base">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <h3>วิธีนำไฟล์ .ZIP ไปคอมไพล์เป็นไฟล์ .APK ลงมือถือ</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-2">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  วิธีที่ 1 · บิลด์เป็น .APK ฟรีบนเว็บ GitHub (ไม่ต้องลงโปรแกรม)
                </p>
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>กดปุ่มดาวน์โหลดไฟล์ <strong>.ZIP</strong> ด้านบนแล้วแตกไฟล์</li>
                  <li>อัปโหลดขึ้น GitHub Repository ของคุณ</li>
                  <li>กดแท็บ <strong>Actions</strong> บน GitHub รอ 1 นาที จะได้ไฟล์ <strong>app-debug.apk</strong> พร้อมติดตั้งลงมือถือทันที</li>
                </ol>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-2">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  วิธีที่ 2 · เปิดในโปรแกรม Android Studio
                </p>
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>เปิดโฟลเดอร์ที่แตกจากไฟล์ .ZIP ใน <strong>Android Studio</strong></li>
                  <li>กดเมนู <strong>Build &gt; Build APK(s)</strong></li>
                  <li>ติดตั้งลงมือถือ เปิดแอป กดเปิดโหมด 4 ทิศ แล้วแอปจะพับลงเบื้องหลังให้คุณไปเข้าแอปอื่นได้ทันที</li>
                </ol>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span>คำสั่ง ADB สั่งระบบ Android หมุนจอกลับหัว 180° ทับทุกแอปทันที</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    id: 'rot180',
                    label: 'สั่งพลิกหน้าจอทั้งเครื่องกลับหัว 180° ทันที',
                    cmd: 'adb shell settings put system accelerometer_rotation 0 && adb shell settings put system user_rotation 2',
                  },
                  {
                    id: 'rot0',
                    label: 'คืนค่าหมุนหน้าจออัตโนมัติตามปกติ',
                    cmd: 'adb shell settings put system accelerometer_rotation 1 && adb shell settings put system user_rotation 0',
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between gap-2"
                  >
                    <span className="text-xs text-slate-300">{item.label}</span>
                    <div className="flex items-center justify-between gap-2 bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800/80">
                      <code className="font-mono text-[11px] text-amber-300 truncate">
                        {item.cmd}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyAdb(item.cmd, item.id)}
                        className="p-1 text-slate-400 hover:text-white shrink-0 cursor-pointer"
                      >
                        {copiedAdb === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-amber-500" />
              <span>เมื่อเปิดแล้วกดปิดหน้าแอปออกไปเข้าแอปดูหนังหรือแอปอื่นได้เลย</span>
            </span>
            <span>ไม่ต้องรูทเครื่อง</span>
          </div>
        </div>
      </div>

      {/* Source Code Viewer */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {projectFiles.map((file, idx) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedFileIndex(idx)}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  selectedFileIndex === idx
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {file.title}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyCode}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedFile ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>คัดลอกโค้ดแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกโค้ด</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadSingleFile}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span>ดาวน์โหลด {activeFile.title}</span>
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 bg-slate-900/40 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
          <span>{activeFile.description}</span>
          <span className="font-mono text-slate-500">{activeFile.path}</span>
        </div>

        <pre className="p-5 text-xs font-mono text-slate-200 overflow-x-auto max-h-[420px] leading-relaxed">
          <code>{activeFile.content}</code>
        </pre>
      </div>
    </section>
  );
};
