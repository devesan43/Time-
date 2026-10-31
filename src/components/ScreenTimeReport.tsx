import React, { useState, useMemo } from 'react';
import { useScreenTime } from '../context/ScreenTimeContext';
import { TRACKED_APPS, CATEGORY_META, formatMinutes } from '../data/mockUsageData';
import { AppIcon } from './AppIcon';
import {
  FileText,
  Download,
  Printer,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Smartphone,
  Bell,
  Award,
  Flame,
  Moon,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundService } from '../utils/audioAlert';

export const ScreenTimeReport: React.FC = () => {
  const {
    history,
    selectedDate,
    currentDayRecord,
    limits,
    bedtime,
    setSelectedAppForDetail,
  } = useScreenTime();

  const [reportRange, setReportRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Compute records based on selected range
  const rangeRecords = useMemo(() => {
    const dates = Object.keys(history).sort();
    const curIdx = dates.indexOf(selectedDate);
    const endIdx = curIdx >= 0 ? curIdx : dates.length - 1;

    let count = 1;
    if (reportRange === 'weekly') count = 7;
    if (reportRange === 'monthly') count = 30;

    const startIdx = Math.max(0, endIdx - count + 1);
    const selectedDates = dates.slice(startIdx, endIdx + 1);

    return selectedDates.map((d) => history[d]).filter(Boolean);
  }, [history, selectedDate, reportRange]);

  // Aggregated range metrics
  const stats = useMemo(() => {
    let totalMinutes = 0;
    let totalPickups = 0;
    let totalNotifications = 0;
    let socialMinutes = 0;
    let browsingMinutes = 0;
    let prodMinutes = 0;
    let lateNightMinutes = 0;

    const appUsageMap: Record<
      string,
      { minutes: number; opens: number; notifications: number }
    > = {};

    TRACKED_APPS.forEach((app) => {
      appUsageMap[app.id] = { minutes: 0, opens: 0, notifications: 0 };
    });

    rangeRecords.forEach((record) => {
      totalMinutes += record.totalMinutes;
      totalPickups += record.pickups;

      TRACKED_APPS.forEach((app) => {
        const u = record.apps[app.id];
        if (u) {
          appUsageMap[app.id].minutes += u.minutes;
          appUsageMap[app.id].opens += u.opens;
          appUsageMap[app.id].notifications += u.notifications;
          totalNotifications += u.notifications;

          if (app.category === 'social') socialMinutes += u.minutes;
          if (app.category === 'browsing') browsingMinutes += u.minutes;
          if (app.category === 'productivity') prodMinutes += u.minutes;

          // Check late night hours (after 22:00 or before 06:00)
          if (u.hourlyMinutes) {
            u.hourlyMinutes.forEach((m, h) => {
              if (h >= 22 || h <= 5) lateNightMinutes += m;
            });
          }
        }
      });
    });

    const dayCount = Math.max(1, rangeRecords.length);
    const avgDailyMinutes = Math.round(totalMinutes / dayCount);
    const avgPickups = Math.round(totalPickups / dayCount);

    // Health Score calculation (0 - 100)
    const dailyGoal = limits.find((l) => l.targetType === 'total')?.limitMinutes || 240;
    let score = 100;

    // Penalty for exceeding goal
    if (avgDailyMinutes > dailyGoal) {
      const overPct = (avgDailyMinutes - dailyGoal) / dailyGoal;
      score -= Math.min(35, Math.round(overPct * 50));
    }

    // Penalty for excessive social media (>50% of time)
    const socialPct = totalMinutes > 0 ? (socialMinutes / totalMinutes) * 100 : 0;
    if (socialPct > 50) {
      score -= Math.min(25, Math.round((socialPct - 50) * 0.8));
    }

    // Penalty for late-night usage
    const lateNightAvg = Math.round(lateNightMinutes / dayCount);
    if (lateNightAvg > 20) {
      score -= Math.min(20, Math.round((lateNightAvg - 20) * 0.5));
    }

    score = Math.max(30, Math.min(100, Math.round(score)));

    // Grade assignment
    let grade = 'A+';
    if (score < 60) grade = 'D';
    else if (score < 70) grade = 'C';
    else if (score < 80) grade = 'B';
    else if (score < 90) grade = 'A-';
    else grade = 'A';

    return {
      dayCount,
      totalMinutes,
      avgDailyMinutes,
      totalPickups,
      avgPickups,
      totalNotifications,
      socialMinutes,
      browsingMinutes,
      prodMinutes,
      socialPct: Math.round(socialPct),
      browsingPct: totalMinutes > 0 ? Math.round((browsingMinutes / totalMinutes) * 100) : 0,
      lateNightAvg,
      score,
      grade,
      appUsageMap,
      dailyGoal,
    };
  }, [rangeRecords, limits]);

  // Sorted apps by usage
  const auditedApps = useMemo(() => {
    return TRACKED_APPS.map((app) => {
      const usage = stats.appUsageMap[app.id] || { minutes: 0, opens: 0, notifications: 0 };
      const percent = stats.totalMinutes > 0 ? Math.round((usage.minutes / stats.totalMinutes) * 100) : 0;
      const appLimit = limits.find((l) => l.targetId === app.id);
      const isExceeded = appLimit && appLimit.enabled && usage.minutes / stats.dayCount > appLimit.limitMinutes;

      return {
        ...app,
        totalMinutes: usage.minutes,
        avgDailyMinutes: Math.round(usage.minutes / stats.dayCount),
        opens: usage.opens,
        notifications: usage.notifications,
        percent,
        limitMinutes: appLimit?.limitMinutes || null,
        isExceeded,
      };
    }).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [stats, limits]);

  // Export CSV Report
  const handleExportCSV = () => {
    const headers = [
      'Report Scope',
      'Days Count',
      'App Name',
      'Category',
      'Package Name',
      'Total Minutes',
      'Daily Avg Minutes',
      'Share %',
      'Total Opens',
      'Total Notifications',
    ];

    const rows: string[] = [headers.join(',')];
    auditedApps.forEach((app) => {
      rows.push(
        [
          reportRange.toUpperCase(),
          stats.dayCount,
          `"${app.name}"`,
          app.category,
          app.packageName,
          app.totalMinutes,
          app.avgDailyMinutes,
          `${app.percent}%`,
          app.opens,
          app.notifications,
        ].join(',')
      );
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `chronos_screen_report_${reportRange}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess('CSV Report downloaded successfully!');
    soundService.playSuccessChime();
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  // Printable Report Trigger
  const handlePrint = () => {
    window.print();
  };

  const handleCelebrate = () => {
    confetti({
      particleCount: 75,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24'],
    });
    soundService.playSuccessChime();
  };

  return (
    <div className="space-y-6">
      {/* Top Report Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Glow ambient background elements */}
        <div className="absolute top-0 right-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold tracking-wider uppercase text-sky-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Chronos Screen Official Audit
              </span>
              <span className="text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full">
                Android System Report
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Screen Time & Digital Wellbeing Audit Report
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive measurement of Instagram, Facebook, WhatsApp, Chrome browsing, and overall screen habits
            </p>
          </div>

          {/* Scope pills & download buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setReportRange('daily')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  reportRange === 'daily'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setReportRange('weekly')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  reportRange === 'weekly'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                7-Day Report
              </button>
              <button
                onClick={() => setReportRange('monthly')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  reportRange === 'monthly'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                30-Day Audit
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              title="Download Report CSV for Excel/Sheets"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950 text-xs font-bold transition shadow-md shadow-sky-500/20 hover:brightness-110"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {downloadSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {downloadSuccess}
          </div>
        )}

        {/* Executive Score Card & Key Health Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch bg-slate-950/70 p-5 rounded-2xl border border-slate-800/80 relative z-10 mb-6">
          {/* Big Score Grade Circle */}
          <div
            onClick={handleCelebrate}
            className="md:col-span-4 flex flex-col items-center justify-center text-center p-3 border-b md:border-b-0 md:border-r border-slate-800/80 cursor-pointer group"
            title="Click to celebrate wellbeing score!"
          >
            <div className="relative">
              <div
                className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center transition-transform group-hover:scale-105 ${
                  stats.score >= 80
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : stats.score >= 60
                    ? 'border-sky-500/50 bg-sky-500/10 text-sky-400'
                    : 'border-rose-500/50 bg-rose-500/10 text-rose-400'
                }`}
              >
                <span className="text-3xl font-black">{stats.score}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Grade {stats.grade}
                </span>
              </div>
              <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-slate-900 border border-slate-700 text-amber-400">
                <Award className="w-4 h-4" />
              </span>
            </div>

            <span className="text-sm font-bold text-white mt-3">
              Digital Wellbeing Index
            </span>
            <span className="text-xs text-slate-400">
              {stats.score >= 80
                ? 'Healthy Controlled Habits'
                : stats.score >= 65
                ? 'Moderate Phone Attachment'
                : 'High Distraction Vulnerability'}
            </span>
          </div>

          {/* Key Metric Highlights in Grid */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-400" /> Daily Screen Time
              </span>
              <span className="text-lg font-bold text-white block">
                {formatMinutes(stats.avgDailyMinutes)}
              </span>
              <span className="text-[10px] text-slate-400">
                Target: {formatMinutes(stats.dailyGoal)}
              </span>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-pink-400 font-medium block mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-pink-500" /> Social Media Share
              </span>
              <span className="text-lg font-bold text-pink-400 block">
                {stats.socialPct}%
              </span>
              <span className="text-[10px] text-slate-400">
                {formatMinutes(stats.socialMinutes)} total
              </span>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-sky-400 font-medium block mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400" /> Browsing Share
              </span>
              <span className="text-lg font-bold text-sky-400 block">
                {stats.browsingPct}%
              </span>
              <span className="text-[10px] text-slate-400">
                {formatMinutes(stats.browsingMinutes)} total
              </span>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" /> Avg Daily Pickups
              </span>
              <span className="text-lg font-bold text-white block">
                {stats.avgPickups}
              </span>
              <span className="text-[10px] text-slate-400">
                ~{Math.round(stats.avgDailyMinutes / (stats.avgPickups || 1))}m / session
              </span>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1">
                <Bell className="w-3.5 h-3.5 text-amber-400" /> Total Notifications
              </span>
              <span className="text-lg font-bold text-amber-300 block">
                {stats.totalNotifications}
              </span>
              <span className="text-[10px] text-slate-400">
                ~{Math.round(stats.totalNotifications / stats.dayCount)} / day
              </span>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1">
                <Moon className="w-3.5 h-3.5 text-purple-400" /> Late Night Usage
              </span>
              <span className="text-lg font-bold text-purple-300 block">
                {formatMinutes(stats.lateNightAvg)}
              </span>
              <span className="text-[10px] text-slate-400">
                after 10:00 PM curfew
              </span>
            </div>
          </div>
        </div>

        {/* Prominent Quick-Action Highlights for Social Media & Browsing */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-950/40 via-purple-950/40 to-sky-950/40 border border-purple-800/40 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2 overflow-hidden">
                <AppIcon appId="instagram" size="sm" className="inline-block ring-2 ring-slate-950" />
                <AppIcon appId="facebook" size="sm" className="inline-block ring-2 ring-slate-950" />
                <AppIcon appId="whatsapp" size="sm" className="inline-block ring-2 ring-slate-950" />
                <AppIcon appId="chrome" size="sm" className="inline-block ring-2 ring-slate-950" />
              </div>
              <div>
                <strong className="text-white text-xs block">
                  Social & Browsing Dominance: {stats.socialPct + stats.browsingPct}% of Screen Time
                </strong>
                <span className="text-[11px] text-slate-300">
                  Instagram, Facebook, WhatsApp, and Chrome make up the vast majority of your device activity.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                {stats.score >= 75 ? 'Healthy Balance' : 'Limits Recommended'}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed App Audit Breakdown Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              App-by-App Usage & Limits Audit ({auditedApps.length} Tracked Apps)
            </h3>
            <span className="text-xs text-slate-400">
              Ranked by total screen consumption
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Application</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Total Time</th>
                  <th className="py-3 px-3">Daily Avg</th>
                  <th className="py-3 px-3">Share</th>
                  <th className="py-3 px-3">Opens / Notifs</th>
                  <th className="py-3 px-3">Limit Status</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditedApps.map((app) => {
                  const meta = CATEGORY_META[app.category];
                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-slate-850/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedAppForDetail(app)}
                    >
                      {/* App Name & Icon */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <AppIcon appId={app.id} size="sm" />
                          <div>
                            <span className="font-bold text-white group-hover:text-sky-400 transition block">
                              {app.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {app.packageName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.tailwindBg} ${meta.tailwindText} ${meta.tailwindBorder}`}
                        >
                          {meta.label}
                        </span>
                      </td>

                      {/* Total Time */}
                      <td className="py-3 px-3 font-semibold text-white">
                        {formatMinutes(app.totalMinutes)}
                      </td>

                      {/* Daily Avg */}
                      <td className="py-3 px-3 text-slate-300 font-medium">
                        {formatMinutes(app.avgDailyMinutes)} / day
                      </td>

                      {/* Share */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${app.percent}%`,
                                backgroundColor: meta.color,
                              }}
                            />
                          </div>
                          <span className="text-slate-400 text-[11px] font-medium font-mono">
                            {app.percent}%
                          </span>
                        </div>
                      </td>

                      {/* Opens & Notifs */}
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        <span>{app.opens} opens</span>
                        <span className="text-slate-600 mx-1">•</span>
                        <span>{app.notifications} notifs</span>
                      </td>

                      {/* Limit Status */}
                      <td className="py-3 px-3">
                        {app.limitMinutes ? (
                          app.isExceeded ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              <AlertTriangle className="w-3 h-3" /> Exceeded ({formatMinutes(app.limitMinutes)})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Within {formatMinutes(app.limitMinutes)}
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-500">No cap</span>
                        )}
                      </td>

                      {/* Inspect */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAppForDetail(app);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distraction & Attention Takeaways */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-800/40 p-3.5 rounded-2xl border border-slate-700/60 flex items-start gap-3">
            <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-0.5">Top Distraction Culprit</strong>
              <span>
                <strong className="text-rose-300">{auditedApps[0]?.name || 'Instagram'}</strong> represents{' '}
                {auditedApps[0]?.percent || 0}% of all phone time in this {reportRange} audit.
              </span>
            </div>
          </div>

          <div className="bg-slate-800/40 p-3.5 rounded-2xl border border-slate-700/60 flex items-start gap-3">
            <Moon className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-0.5">Night Melatonin Curfew</strong>
              <span>
                Bedtime wind-down mode currently starts at {bedtime.startTime}. Reducing late-night screen time
                improves deep REM sleep.
              </span>
            </div>
          </div>

          <div className="bg-slate-800/40 p-3.5 rounded-2xl border border-slate-700/60 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-0.5">Recommended Action</strong>
              <span>
                Setting a 45m cap on {auditedApps[0]?.name || 'Instagram'} will recover ~4.2 hours per week
                for your personal goals.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
