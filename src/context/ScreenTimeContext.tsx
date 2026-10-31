import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  DayRecord,
  UsageLimit,
  BedtimeSettings,
  TimeframeMode,
  CategoryFilter,
  LiveTrackingState,
  TriggeredAlert,
  TrackedApp,
  TimeEntry,
  Project,
  PomodoroState,
} from '../types';
import {
  TRACKED_APPS,
  DEFAULT_LIMITS,
  DEFAULT_BEDTIME,
  generateInitialHistory,
} from '../data/mockUsageData';
import { soundService } from '../utils/audioAlert';

export interface ActiveTimerState {
  isRunning: boolean;
  description: string;
  project: string;
  category: string;
  startTime: number | null;
  elapsedSeconds: number;
  billable: boolean;
  hourlyRate: number;
}

interface ScreenTimeContextType {
  history: Record<string, DayRecord>;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  timeframe: TimeframeMode;
  setTimeframe: (tf: TimeframeMode) => void;
  categoryFilter: CategoryFilter;
  setCategoryFilter: (filter: CategoryFilter) => void;
  limits: UsageLimit[];
  updateLimit: (id: string, updates: Partial<UsageLimit>) => void;
  addLimit: (limit: UsageLimit) => void;
  deleteLimit: (id: string) => void;
  bedtime: BedtimeSettings;
  updateBedtime: (updates: Partial<BedtimeSettings>) => void;
  liveTracking: LiveTrackingState;
  startLiveTracking: (appId: string) => void;
  stopLiveTracking: () => void;
  activeAlert: TriggeredAlert | null;
  dismissAlert: () => void;
  snoozeAlert: (minutes: number) => void;
  deviceViewMode: 'phone' | 'fluid';
  setDeviceViewMode: (mode: 'phone' | 'fluid') => void;
  selectedAppForDetail: TrackedApp | null;
  setSelectedAppForDetail: (app: TrackedApp | null) => void;
  currentDayRecord: DayRecord;
  addUsageMinutes: (appId: string, minutes: number) => void;
  resetTodayData: () => void;
  importHistoryData: (newHistory: Record<string, DayRecord>, newLimits?: UsageLimit[]) => boolean;
  syncDeviceData: () => Promise<void>;
  isSyncing: boolean;
  lastSyncTime: string;
  trackingSpeed: 'normal' | 'demo';
  setTrackingSpeed: (speed: 'normal' | 'demo') => void;

  // Time Tracker state & actions
  timeEntries: TimeEntry[];
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => void;
  deleteTimeEntry: (id: string) => void;
  activeTimer: ActiveTimerState;
  startActiveTimer: (desc?: string, project?: string, category?: string, billable?: boolean, hourlyRate?: number) => void;
  pauseActiveTimer: () => void;
  stopActiveTimer: () => void;
  resetActiveTimer: () => void;
  updateActiveTimerDescription: (desc: string) => void;
  updateActiveTimerProject: (project: string) => void;
  syncScreenTimeToEntries: () => void;
  pomodoro: PomodoroState;
  startPomodoro: () => void;
  pausePomodoro: () => void;
  resetPomodoro: () => void;
  projects: Project[];
}

const ScreenTimeContext = createContext<ScreenTimeContextType | undefined>(undefined);

const STORAGE_KEYS = {
  HISTORY: 'chronos_screentime_history_v2',
  LIMITS: 'chronos_screentime_limits_v2',
  BEDTIME: 'chronos_screentime_bedtime_v2',
  VIEW_MODE: 'chronos_screentime_view_mode_v2',
  TIME_ENTRIES: 'chronos_time_entries_v2',
  PROJECTS: 'chronos_projects_v2',
};

export const DEFAULT_PROJECTS: Project[] = [
  { id: 'proj_dev', name: 'Software Development', color: '#38BDF8', client: 'Internal App', hourlyRate: 65 },
  { id: 'proj_social', name: 'Social Media & Marketing', color: '#EC4899', client: 'Brand Channel', hourlyRate: 45 },
  { id: 'proj_research', name: 'Web Browsing & Research', color: '#0EA5E9', client: 'Product Strategy', hourlyRate: 40 },
  { id: 'proj_comm', name: 'Client Communications', color: '#10B981', client: 'Key Clients', hourlyRate: 50 },
  { id: 'proj_deepwork', name: 'Deep Focus & Study', color: '#A855F7', client: 'Personal Dev', hourlyRate: 0 },
  { id: 'proj_leisure', name: 'Entertainment & Leisure', color: '#F59E0B', client: 'Rest', hourlyRate: 0 },
];

function generateInitialTimeEntries(today: string): TimeEntry[] {
  const now = Date.now();
  return [
    {
      id: 'entry_1',
      description: 'Instagram & Facebook Content Analysis',
      project: 'Social Media & Marketing',
      category: 'social',
      appId: 'instagram',
      startTime: now - 3600 * 4.5 * 1000,
      endTime: now - 3600 * 3.75 * 1000,
      durationSeconds: 2700, // 45m
      billable: true,
      hourlyRate: 45,
      date: today,
      tags: ['marketing', 'reels', 'analytics'],
    },
    {
      id: 'entry_2',
      description: 'React Native Android APK Build & GitHub Actions CI',
      project: 'Software Development',
      category: 'work',
      startTime: now - 3600 * 3.5 * 1000,
      endTime: now - 3600 * 2.0 * 1000,
      durationSeconds: 5400, // 1h 30m
      billable: true,
      hourlyRate: 65,
      date: today,
      tags: ['android', 'github', 'capacitor'],
    },
    {
      id: 'entry_3',
      description: 'WhatsApp Direct Client Coordination',
      project: 'Client Communications',
      category: 'social',
      appId: 'whatsapp',
      startTime: now - 3600 * 1.5 * 1000,
      endTime: now - 3600 * 1.0 * 1000,
      durationSeconds: 1800, // 30m
      billable: true,
      hourlyRate: 50,
      date: today,
      tags: ['client', 'whatsapp', 'support'],
    },
    {
      id: 'entry_4',
      description: 'Google Chrome Technical Documentation',
      project: 'Web Browsing & Research',
      category: 'browsing',
      appId: 'chrome',
      startTime: now - 3600 * 0.7 * 1000,
      endTime: now - 3600 * 0.2 * 1000,
      durationSeconds: 1800, // 30m
      billable: false,
      hourlyRate: 0,
      date: today,
      tags: ['chrome', 'research', 'docs'],
    },
  ];
}

export const ScreenTimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [timeframe, setTimeframe] = useState<TimeframeMode>('tracker'); // Default to Time Tracker!
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [deviceViewMode, setDeviceViewMode] = useState<'phone' | 'fluid'>('fluid');
  const [selectedAppForDetail, setSelectedAppForDetail] = useState<TrackedApp | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [trackingSpeed, setTrackingSpeed] = useState<'normal' | 'demo'>('normal');

  const syncDeviceData = useCallback(async () => {
    setIsSyncing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      soundService.playSuccessChime();
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Initialize history from localStorage or generate fresh
  const [history, setHistory] = useState<Record<string, DayRecord>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          // ensure today exists
          if (!parsed[todayStr]) {
            const fresh = generateInitialHistory();
            return { ...parsed, [todayStr]: fresh[todayStr] };
          }
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return generateInitialHistory();
  });

  // Initialize limits from localStorage or defaults
  const [limits, setLimits] = useState<UsageLimit[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIMITS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_LIMITS;
  });

  // Bedtime mode
  const [bedtime, setBedtime] = useState<BedtimeSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BEDTIME);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_BEDTIME;
  });

  // Live tracking state
  const [liveTracking, setLiveTracking] = useState<LiveTrackingState>({
    isActive: false,
    appId: 'instagram',
    elapsedSeconds: 0,
    startedAt: null,
  });

  // Active Alert popup
  const [activeAlert, setActiveAlert] = useState<TriggeredAlert | null>(null);
  const [snoozedApps, setSnoozedApps] = useState<Record<string, number>>({});

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LIMITS, JSON.stringify(limits));
    } catch {
      // ignore
    }
  }, [limits]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BEDTIME, JSON.stringify(bedtime));
    } catch {
      // ignore
    }
  }, [bedtime]);

  // Time Tracker state & storage
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_PROJECTS;
  });

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TIME_ENTRIES);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return generateInitialTimeEntries(todayStr);
  });

  const [activeTimer, setActiveTimer] = useState<ActiveTimerState>({
    isRunning: false,
    description: '',
    project: 'Software Development',
    category: 'work',
    startTime: null,
    elapsedSeconds: 0,
    billable: true,
    hourlyRate: 65,
  });

  const [pomodoro, setPomodoro] = useState<PomodoroState>({
    isActive: false,
    mode: 'focus',
    remainingSeconds: 25 * 60,
    completedRounds: 0,
    targetSeconds: 25 * 60,
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TIME_ENTRIES, JSON.stringify(timeEntries));
    } catch {
      // ignore
    }
  }, [timeEntries]);

  // Active Stopwatch Timer interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (activeTimer.isRunning) {
      interval = setInterval(() => {
        setActiveTimer((prev) => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1,
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimer.isRunning]);

  // Pomodoro countdown interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (pomodoro.isActive) {
      interval = setInterval(() => {
        setPomodoro((prev) => {
          if (prev.remainingSeconds <= 1) {
            soundService.playSuccessChime();
            const nextMode = prev.mode === 'focus' ? 'short_break' : 'focus';
            const nextTarget = nextMode === 'focus' ? 25 * 60 : 5 * 60;
            return {
              ...prev,
              mode: nextMode,
              remainingSeconds: nextTarget,
              targetSeconds: nextTarget,
              completedRounds: prev.mode === 'focus' ? prev.completedRounds + 1 : prev.completedRounds,
              isActive: false,
            };
          }
          return {
            ...prev,
            remainingSeconds: prev.remainingSeconds - 1,
          };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pomodoro.isActive]);

  // Current Day Record
  const currentDayRecord = useMemo(() => {
    if (history[selectedDate]) {
      return history[selectedDate];
    }
    // Return empty fallback structure
    return {
      date: selectedDate,
      totalMinutes: 0,
      pickups: 0,
      firstPickup: '08:00 AM',
      screenOnCount: 0,
      apps: {},
    };
  }, [history, selectedDate]);

  // Check limits and trigger alerts if needed
  const checkAlertLimits = useCallback((dateStr: string, currentHist: Record<string, DayRecord>) => {
    const day = currentHist[dateStr];
    if (!day) return;

    const now = Date.now();

    for (const lim of limits) {
      if (!lim.enabled) continue;

      let usedMinutes = 0;
      let appName = lim.targetName;
      let trackedAppId = lim.targetId;

      if (lim.targetType === 'app') {
        const appUsage = day.apps[lim.targetId];
        usedMinutes = appUsage ? appUsage.minutes : 0;
        const appObj = TRACKED_APPS.find((a) => a.id === lim.targetId);
        if (appObj) appName = appObj.name;
      } else if (lim.targetType === 'category') {
        const appsInCat = TRACKED_APPS.filter((a) => a.category === lim.targetId);
        usedMinutes = appsInCat.reduce((sum, a) => sum + (day.apps[a.id]?.minutes || 0), 0);
      } else if (lim.targetType === 'total') {
        usedMinutes = day.totalMinutes;
      }

      // Check snooze expiration
      if (snoozedApps[lim.id] && snoozedApps[lim.id] > now) {
        continue;
      }

      const ratio = usedMinutes / lim.limitMinutes;

      if (ratio >= 1.0) {
        // Limit reached or hard block
        setActiveAlert({
          id: `${lim.id}_100_${Math.floor(usedMinutes)}`,
          appId: trackedAppId,
          appName,
          currentMinutes: usedMinutes,
          limitMinutes: lim.limitMinutes,
          percentage: Math.round(ratio * 100),
          type: lim.hardBlock ? 'hard_block' : 'limit_reached',
          timestamp: now,
        });

        if (lim.soundAlert) {
          soundService.playLimitReachedChime();
        }
        break; // Show highest priority alert
      } else if (ratio >= 0.8 && lim.warnAt80Percent) {
        // Warning threshold reached
        setActiveAlert({
          id: `${lim.id}_80`,
          appId: trackedAppId,
          appName,
          currentMinutes: usedMinutes,
          limitMinutes: lim.limitMinutes,
          percentage: Math.round(ratio * 100),
          type: 'warning',
          timestamp: now,
        });

        if (lim.soundAlert) {
          soundService.playWarningChime();
        }
        break;
      }
    }
  }, [limits, snoozedApps]);

  // Method to increment usage on a specific app
  const addUsageMinutes = useCallback((appId: string, minutesToAdd: number) => {
    setHistory((prev) => {
      const day = prev[selectedDate] || {
        date: selectedDate,
        totalMinutes: 0,
        pickups: 1,
        firstPickup: '08:00 AM',
        screenOnCount: 1,
        apps: {},
      };

      const existingApp = day.apps[appId] || {
        appId,
        minutes: 0,
        opens: 0,
        notifications: 0,
        hourlyMinutes: new Array(24).fill(0),
      };

      const currentHour = new Date().getHours();
      const updatedHourly = [...existingApp.hourlyMinutes];
      updatedHourly[currentHour] = (updatedHourly[currentHour] || 0) + minutesToAdd;

      const updatedApp = {
        ...existingApp,
        minutes: existingApp.minutes + minutesToAdd,
        opens: existingApp.opens + (minutesToAdd > 0 && existingApp.opens === 0 ? 1 : 0),
        hourlyMinutes: updatedHourly,
      };

      const updatedApps = {
        ...day.apps,
        [appId]: updatedApp,
      };

      const newTotal = Object.values(updatedApps).reduce((sum, a) => sum + a.minutes, 0);

      const updatedDay: DayRecord = {
        ...day,
        totalMinutes: newTotal,
        apps: updatedApps,
      };

      const nextHistory = {
        ...prev,
        [selectedDate]: updatedDay,
      };

      // Trigger limit checking
      setTimeout(() => checkAlertLimits(selectedDate, nextHistory), 100);

      return nextHistory;
    });
  }, [selectedDate, checkAlertLimits]);

  // Live tracking timer effect (synchronous real-time updates)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (liveTracking.isActive) {
      interval = setInterval(() => {
        setLiveTracking((prev) => {
          const nextSec = prev.elapsedSeconds + 1;
          // In demo speed mode, increment 1m per second; in normal mode, every 60s
          if (trackingSpeed === 'demo' || (nextSec > 0 && nextSec % 60 === 0)) {
            addUsageMinutes(prev.appId, 1);
          }
          return {
            ...prev,
            elapsedSeconds: nextSec,
          };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [liveTracking.isActive, addUsageMinutes, trackingSpeed]);

  const startLiveTracking = (appId: string) => {
    setLiveTracking({
      isActive: true,
      appId,
      elapsedSeconds: 0,
      startedAt: Date.now(),
    });
  };

  const stopLiveTracking = () => {
    if (liveTracking.isActive && liveTracking.elapsedSeconds >= 10) {
      // Add any partial minutes if user used > 20s
      const partialMins = Math.max(1, Math.round(liveTracking.elapsedSeconds / 60));
      addUsageMinutes(liveTracking.appId, partialMins);
    }
    setLiveTracking((prev) => ({
      ...prev,
      isActive: false,
    }));
  };

  const updateLimit = (id: string, updates: Partial<UsageLimit>) => {
    setLimits((prev) => prev.map((lim) => (lim.id === id ? { ...lim, ...updates } : lim)));
  };

  const addLimit = (newLim: UsageLimit) => {
    setLimits((prev) => {
      const filtered = prev.filter((l) => l.id !== newLim.id);
      return [...filtered, newLim];
    });
  };

  const deleteLimit = (id: string) => {
    setLimits((prev) => prev.filter((lim) => lim.id !== id));
  };

  const updateBedtime = (updates: Partial<BedtimeSettings>) => {
    setBedtime((prev) => ({ ...prev, ...updates }));
  };

  const dismissAlert = () => {
    setActiveAlert(null);
  };

  const snoozeAlert = (minutes: number) => {
    if (activeAlert) {
      const expireTime = Date.now() + minutes * 60 * 1000;
      setSnoozedApps((prev) => ({ ...prev, [activeAlert.id.split('_')[0]]: expireTime }));
      setActiveAlert(null);
    }
  };

  const resetTodayData = () => {
    setHistory((prev) => {
      const cleanDay: DayRecord = {
        date: selectedDate,
        totalMinutes: 0,
        pickups: 0,
        firstPickup: '--:--',
        screenOnCount: 0,
        apps: {},
      };
      return { ...prev, [selectedDate]: cleanDay };
    });
  };

  const importHistoryData = (newHistory: Record<string, DayRecord>, newLimits?: UsageLimit[]) => {
    try {
      if (typeof newHistory === 'object' && Object.keys(newHistory).length > 0) {
        setHistory(newHistory);
        if (newLimits && Array.isArray(newLimits)) {
          setLimits(newLimits);
        }
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const addTimeEntry = useCallback((entry: Omit<TimeEntry, 'id'>) => {
    const newEntry: TimeEntry = {
      ...entry,
      id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setTimeEntries((prev) => [newEntry, ...prev]);
    soundService.playSuccessChime();
  }, []);

  const deleteTimeEntry = useCallback((id: string) => {
    setTimeEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const startActiveTimer = useCallback((
    desc?: string,
    project?: string,
    category?: string,
    billable?: boolean,
    hourlyRate?: number
  ) => {
    setActiveTimer((prev) => ({
      ...prev,
      isRunning: true,
      description: desc !== undefined ? desc : prev.description,
      project: project !== undefined ? project : prev.project,
      category: category !== undefined ? category : prev.category,
      billable: billable !== undefined ? billable : prev.billable,
      hourlyRate: hourlyRate !== undefined ? hourlyRate : prev.hourlyRate,
      startTime: Date.now(),
    }));
    soundService.playSuccessChime();
  }, []);

  const pauseActiveTimer = useCallback(() => {
    setActiveTimer((prev) => ({
      ...prev,
      isRunning: false,
    }));
  }, []);

  const stopActiveTimer = useCallback(() => {
    if (activeTimer.elapsedSeconds >= 5) {
      const now = Date.now();
      const newEntry: TimeEntry = {
        id: `entry_${Date.now()}`,
        description: activeTimer.description.trim() || `${activeTimer.project} Work Session`,
        project: activeTimer.project,
        category: (activeTimer.category as any) || 'work',
        startTime: activeTimer.startTime || (now - activeTimer.elapsedSeconds * 1000),
        endTime: now,
        durationSeconds: activeTimer.elapsedSeconds,
        billable: activeTimer.billable,
        hourlyRate: activeTimer.hourlyRate,
        date: selectedDate,
        tags: [activeTimer.project.toLowerCase().replace(/\s+/g, '-')],
      };
      setTimeEntries((prev) => [newEntry, ...prev]);
      soundService.playSuccessChime();
    }
    setActiveTimer((prev) => ({
      ...prev,
      isRunning: false,
      elapsedSeconds: 0,
      startTime: null,
      description: '',
    }));
  }, [activeTimer, selectedDate]);

  const resetActiveTimer = useCallback(() => {
    setActiveTimer((prev) => ({
      ...prev,
      isRunning: false,
      elapsedSeconds: 0,
      startTime: null,
    }));
  }, []);

  const updateActiveTimerDescription = useCallback((desc: string) => {
    setActiveTimer((prev) => ({ ...prev, description: desc }));
  }, []);

  const updateActiveTimerProject = useCallback((project: string) => {
    const matched = projects.find((p) => p.name === project);
    setActiveTimer((prev) => ({
      ...prev,
      project,
      hourlyRate: matched?.hourlyRate || prev.hourlyRate,
    }));
  }, [projects]);

  const syncScreenTimeToEntries = useCallback(() => {
    const day = history[selectedDate];
    if (!day) return;

    const newEntries: TimeEntry[] = [];
    const now = Date.now();

    Object.values(day.apps).forEach((appUsage, index) => {
      if (appUsage.minutes >= 5) {
        const appObj = TRACKED_APPS.find((a) => a.id === appUsage.appId);
        const name = appObj ? appObj.name : appUsage.appId;
        const exists = timeEntries.some(
          (e) => e.date === selectedDate && e.appId === appUsage.appId
        );
        if (!exists) {
          newEntries.push({
            id: `entry_app_${appUsage.appId}_${Date.now()}_${index}`,
            description: `${name} Phone Screen Time`,
            project: appObj?.category === 'social' ? 'Social Media & Marketing' : appObj?.category === 'browsing' ? 'Web Browsing & Research' : 'Entertainment & Leisure',
            category: appObj?.category || 'other',
            appId: appUsage.appId,
            startTime: now - (index + 1) * 3600 * 1000,
            endTime: now - index * 3600 * 1000,
            durationSeconds: appUsage.minutes * 60,
            billable: false,
            date: selectedDate,
            tags: [appUsage.appId, 'screen-time', 'phone'],
          });
        }
      }
    });

    if (newEntries.length > 0) {
      setTimeEntries((prev) => [...newEntries, ...prev]);
      soundService.playSuccessChime();
    }
  }, [history, selectedDate, timeEntries]);

  const startPomodoro = useCallback(() => {
    setPomodoro((prev) => ({ ...prev, isActive: true }));
  }, []);

  const pausePomodoro = useCallback(() => {
    setPomodoro((prev) => ({ ...prev, isActive: false }));
  }, []);

  const resetPomodoro = useCallback(() => {
    setPomodoro({
      isActive: false,
      mode: 'focus',
      remainingSeconds: 25 * 60,
      completedRounds: 0,
      targetSeconds: 25 * 60,
    });
  }, []);

  return (
    <ScreenTimeContext.Provider
      value={{
        history,
        selectedDate,
        setSelectedDate,
        timeframe,
        setTimeframe,
        categoryFilter,
        setCategoryFilter,
        limits,
        updateLimit,
        addLimit,
        deleteLimit,
        bedtime,
        updateBedtime,
        liveTracking,
        startLiveTracking,
        stopLiveTracking,
        activeAlert,
        dismissAlert,
        snoozeAlert,
        deviceViewMode,
        setDeviceViewMode,
        selectedAppForDetail,
        setSelectedAppForDetail,
        currentDayRecord,
        addUsageMinutes,
        resetTodayData,
        importHistoryData,
        syncDeviceData,
        isSyncing,
        lastSyncTime,
        trackingSpeed,
        setTrackingSpeed,

        // Time Tracker
        timeEntries,
        addTimeEntry,
        deleteTimeEntry,
        activeTimer,
        startActiveTimer,
        pauseActiveTimer,
        stopActiveTimer,
        resetActiveTimer,
        updateActiveTimerDescription,
        updateActiveTimerProject,
        syncScreenTimeToEntries,
        pomodoro,
        startPomodoro,
        pausePomodoro,
        resetPomodoro,
        projects,
      }}
    >
      <div className={bedtime.enabled && bedtime.grayscale ? 'bedtime-grayscale' : ''}>
        {children}
      </div>
    </ScreenTimeContext.Provider>
  );
};

export function useScreenTime() {
  const context = useContext(ScreenTimeContext);
  if (!context) {
    throw new Error('useScreenTime must be used within a ScreenTimeProvider');
  }
  return context;
}
