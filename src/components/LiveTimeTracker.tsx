import React, { useState, useMemo } from 'react';
import { useScreenTime } from '../context/ScreenTimeContext';
import { formatMinutes } from '../data/mockUsageData';
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Clock,
  Briefcase,
  DollarSign,
  Plus,
  Trash2,
  Download,
  Flame,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  Sliders,
  Tag,
  Coffee,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundService } from '../utils/audioAlert';

export const LiveTimeTracker: React.FC = () => {
  const {
    activeTimer,
    startActiveTimer,
    pauseActiveTimer,
    stopActiveTimer,
    resetActiveTimer,
    updateActiveTimerDescription,
    updateActiveTimerProject,
    timeEntries,
    addTimeEntry,
    deleteTimeEntry,
    projects,
    pomodoro,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
    syncScreenTimeToEntries,
    selectedDate,
    currentDayRecord,
  } = useScreenTime();

  const [activeTab, setActiveTab] = useState<'stopwatch' | 'pomodoro' | 'manual'>('stopwatch');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Manual entry form state
  const [manualDesc, setManualDesc] = useState('');
  const [manualProject, setManualProject] = useState(projects[0]?.name || 'Software Development');
  const [manualMinutes, setManualMinutes] = useState(30);
  const [manualBillable, setManualBillable] = useState(true);

  // Filter entries for selectedDate
  const todaysEntries = useMemo(() => {
    return timeEntries.filter((e) => e.date === selectedDate);
  }, [timeEntries, selectedDate]);

  // Aggregate stats
  const totalTrackedSeconds = useMemo(() => {
    return todaysEntries.reduce((sum, e) => sum + e.durationSeconds, 0);
  }, [todaysEntries]);

  const totalBillableEarnings = useMemo(() => {
    return todaysEntries.reduce((sum, e) => {
      if (e.billable && e.hourlyRate) {
        return sum + (e.durationSeconds / 3600) * e.hourlyRate;
      }
      return sum;
    }, 0);
  }, [todaysEntries]);

  // Format seconds into HH:MM:SS
  const formatTimerDisplay = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDesc.trim()) return;

    const matchedProject = projects.find((p) => p.name === manualProject);
    const now = Date.now();

    addTimeEntry({
      description: manualDesc.trim(),
      project: manualProject,
      category: 'work',
      startTime: now - manualMinutes * 60 * 1000,
      endTime: now,
      durationSeconds: manualMinutes * 60,
      billable: manualBillable,
      hourlyRate: matchedProject?.hourlyRate || 0,
      date: selectedDate,
      tags: [manualProject.toLowerCase().replace(/\s+/g, '-')],
    });

    setManualDesc('');
    setManualMinutes(30);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#38bdf8', '#34d399', '#f472b6'],
    });
  };

  // Export CSV Timesheet
  const handleExportTimesheet = () => {
    const headers = [
      'Date',
      'Description',
      'Project',
      'Category',
      'Duration (Minutes)',
      'Duration (Formatted)',
      'Billable',
      'Hourly Rate',
      'Earnings ($)',
      'Start Time',
      'End Time',
    ];

    const rows: string[] = [headers.join(',')];

    todaysEntries.forEach((entry) => {
      const mins = Math.round(entry.durationSeconds / 60);
      const earnings = entry.billable && entry.hourlyRate ? ((entry.durationSeconds / 3600) * entry.hourlyRate).toFixed(2) : '0.00';
      rows.push(
        [
          entry.date,
          `"${entry.description.replace(/"/g, '""')}"`,
          `"${entry.project}"`,
          entry.category,
          mins,
          `"${formatMinutes(mins)}"`,
          entry.billable ? 'YES' : 'NO',
          entry.hourlyRate || 0,
          earnings,
          new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          new Date(entry.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ].join(',')
      );
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `timesheet_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess('Timesheet CSV downloaded successfully!');
    soundService.playSuccessChime();
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Main Active Timer Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Glow ambient background elements */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header & Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold tracking-wider uppercase text-sky-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Interactive Time Tracker
              </span>
              <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Live Stopwatch & Timesheet
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Track Work, Social Media & Phone Focus
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Record active tasks, client billable hours, and sync real Android screen time
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('stopwatch')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'stopwatch'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Stopwatch
            </button>
            <button
              onClick={() => setActiveTab('pomodoro')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
                activeTab === 'pomodoro'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🍅 Pomodoro</span>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'manual'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              + Manual Log
            </button>
          </div>
        </div>

        {/* Tab 1: Live Stopwatch Timer */}
        {activeTab === 'stopwatch' && (
          <div className="space-y-4 relative z-10">
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Task name input */}
              <div className="flex-1 min-w-0 space-y-2">
                <input
                  type="text"
                  value={activeTimer.description}
                  onChange={(e) => updateActiveTimerDescription(e.target.value)}
                  placeholder="What are you working on? (e.g. Instagram Reels Campaign, React Coding, WhatsApp Client Chat...)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
                />

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Project selector */}
                  <select
                    value={activeTimer.project}
                    onChange={(e) => updateActiveTimerProject(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} (${p.hourlyRate}/h)
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() =>
                      startActiveTimer(undefined, undefined, undefined, !activeTimer.billable)
                    }
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      activeTimer.billable
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>{activeTimer.billable ? 'Billable' : 'Non-billable'}</span>
                  </button>
                </div>
              </div>

              {/* Digital Timer Clock Display & Action Buttons */}
              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                <div className="text-right">
                  <span
                    className={`font-mono text-3xl sm:text-4xl font-black tracking-tight ${
                      activeTimer.isRunning
                        ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                        : 'text-white'
                    }`}
                  >
                    {formatTimerDisplay(activeTimer.elapsedSeconds)}
                  </span>
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-bold">
                    {activeTimer.isRunning ? '● Timer Active' : '○ Paused'}
                  </span>
                </div>

                {/* Primary Start / Stop Controls */}
                <div className="flex items-center gap-2">
                  {activeTimer.isRunning ? (
                    <>
                      <button
                        onClick={pauseActiveTimer}
                        className="p-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow-lg shadow-amber-500/20"
                        title="Pause timer"
                      >
                        <Pause className="w-5 h-5 fill-current" />
                      </button>
                      <button
                        onClick={stopActiveTimer}
                        className="p-3 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-bold transition shadow-lg shadow-rose-500/20"
                        title="Stop & Log Entry"
                      >
                        <Square className="w-5 h-5 fill-current" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startActiveTimer()}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-sky-500 hover:from-emerald-300 hover:to-sky-400 text-slate-950 font-black text-sm transition shadow-lg shadow-emerald-500/20"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start</span>
                      </button>
                      {activeTimer.elapsedSeconds > 0 && (
                        <button
                          onClick={resetActiveTimer}
                          className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
                          title="Reset"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Pomodoro Focus Mode */}
        {activeTab === 'pomodoro' && (
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center text-center space-y-4 relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                {pomodoro.mode === 'focus' ? '🎯 25m Focus Sprint' : '☕ 5m Rest Break'}
              </span>
              <span className="text-xs text-slate-400">
                Round {pomodoro.completedRounds + 1}/4
              </span>
            </div>

            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="#1e293b" strokeWidth="6" fill="none" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke={pomodoro.mode === 'focus' ? '#f43f5e' : '#10b981'}
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${
                    2 * Math.PI * 42 * (1 - pomodoro.remainingSeconds / pomodoro.targetSeconds)
                  }`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-mono text-3xl font-black text-white">
                  {Math.floor(pomodoro.remainingSeconds / 60)
                    .toString()
                    .padStart(2, '0')}
                  :{(pomodoro.remainingSeconds % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                  {pomodoro.isActive ? 'Active' : 'Ready'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {pomodoro.isActive ? (
                <button
                  onClick={pausePomodoro}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                >
                  <Pause className="w-4 h-4 fill-current" /> Pause
                </button>
              ) : (
                <button
                  onClick={startPomodoro}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-500/20"
                >
                  <Play className="w-4 h-4 fill-current" /> Start Focus Sprint
                </button>
              )}
              <button
                onClick={resetPomodoro}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-xs"
                title="Reset Pomodoro"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Manual Time Log */}
        {activeTab === 'manual' && (
          <form
            onSubmit={handleAddManual}
            className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 relative z-10"
          >
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="text-[11px] text-slate-400 block mb-1 font-semibold">
                  Activity / Task Description:
                </label>
                <input
                  type="text"
                  required
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="e.g. Client Web Review, Social Media Scheduling..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] text-slate-400 block mb-1 font-semibold">
                  Project:
                </label>
                <select
                  value={manualProject}
                  onChange={(e) => setManualProject(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] text-slate-400 block mb-1 font-semibold">
                  Duration (Minutes):
                </label>
                <input
                  type="number"
                  min="5"
                  max="720"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(Math.max(5, parseInt(e.target.value) || 5))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={manualBillable}
                  onChange={(e) => setManualBillable(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500"
                />
                <span>Billable Time Entry</span>
              </label>

              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-sky-500 text-slate-950 font-bold text-xs hover:brightness-110 transition shadow-md shadow-emerald-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Time Entry</span>
              </button>
            </div>
          </form>
        )}

        {/* Sync Phone Screen Time Bridge Button */}
        <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/40 to-slate-950/60 border border-indigo-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">Phone Screen Time Sync:</strong> Automatically convert
              today's tracked Instagram, WhatsApp, Facebook, and Chrome usage into timesheet blocks.
            </span>
          </div>

          <button
            onClick={syncScreenTimeToEntries}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Phone Usage</span>
          </button>
        </div>
      </div>

      {/* Daily Timesheet Overview Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl space-y-4">
        {/* Timesheet Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-sky-400" />
                Today's Timesheet Activity Log
              </h3>
              <span className="text-xs font-bold text-slate-400">
                ({todaysEntries.length} logged entries)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Consolidated work sessions, billable hours, and phone activity
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportTimesheet}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {downloadSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" /> {downloadSuccess}
          </div>
        )}

        {/* Top 3 Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block mb-0.5">Total Tracked Time</span>
            <span className="text-lg font-bold text-white">
              {formatMinutes(Math.round(totalTrackedSeconds / 60))}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-emerald-400 font-medium block mb-0.5">
              Billable Earnings
            </span>
            <span className="text-lg font-bold text-emerald-400">
              ${totalBillableEarnings.toFixed(2)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-sky-400 font-medium block mb-0.5">
              Phone Screen Time
            </span>
            <span className="text-lg font-bold text-sky-400">
              {formatMinutes(currentDayRecord.totalMinutes)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-purple-400 font-medium block mb-0.5">
              Focus Efficiency
            </span>
            <span className="text-lg font-bold text-purple-400">
              {totalTrackedSeconds > 0
                ? `${Math.round(
                    (totalTrackedSeconds / (totalTrackedSeconds + currentDayRecord.totalMinutes * 60)) *
                      100
                  )}%`
                : '100%'}
            </span>
          </div>
        </div>

        {/* Entries List */}
        <div className="space-y-2.5 pt-2">
          {todaysEntries.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No time entries recorded for {selectedDate}. Start the timer or log a task above!
            </div>
          ) : (
            todaysEntries.map((entry) => {
              const matchedProject = projects.find((p) => p.name === entry.project);
              const color = matchedProject?.color || '#38BDF8';
              const mins = Math.round(entry.durationSeconds / 60);

              return (
                <div
                  key={entry.id}
                  className="p-3 sm:p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white truncate text-xs sm:text-sm">
                          {entry.description}
                        </span>
                        {entry.billable && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            ${entry.hourlyRate}/h
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                        <span className="text-slate-300 font-medium">{entry.project}</span>
                        <span className="text-slate-600">•</span>
                        <span>
                          {new Date(entry.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          -{' '}
                          {new Date(entry.endTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm sm:text-base font-bold text-white">
                      {formatMinutes(mins)}
                    </span>

                    <button
                      onClick={() => deleteTimeEntry(entry.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition"
                      title="Delete Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
