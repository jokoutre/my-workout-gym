import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, CheckCircle, Settings, Dumbbell, Calendar, ArrowRight, Activity, Save, Clock, TrendingUp } from 'lucide-react';

// --- DATA: Strict Hypertrophy Database ---
const EXERCISE_DB = {
  // LOWER BODY
  sq: { id: 'sq', name: 'Back Squat', target: 'Lower', defaultSets: 4, defaultReps: 8, restTime: 120 },
  dl: { id: 'dl', name: 'Deadlift', target: 'Lower', defaultSets: 3, defaultReps: 6, restTime: 120 },
  rdl: { id: 'rdl', name: 'Romanian Deadlift', target: 'Lower', defaultSets: 4, defaultReps: 10, restTime: 90 },
  
  // UPPER BODY - CHEST
  bp: { id: 'bp', name: 'Bench Press', target: 'Chest', defaultSets: 4, defaultReps: 8, restTime: 120 },
  ibp: { id: 'ibp', name: 'Incline Bench Press', target: 'Chest', defaultSets: 4, defaultReps: 10, restTime: 90 },
  
  // UPPER BODY - BACK
  pu: { id: 'pu', name: 'Pull-ups', target: 'Back', defaultSets: 3, defaultReps: 10, restTime: 120 },
  wpu: { id: 'wpu', name: 'Wide Grip Pull-ups', target: 'Back', defaultSets: 3, defaultReps: 8, restTime: 120 },
  wgr: { id: 'wgr', name: 'Wide Grip Row', target: 'Back', defaultSets: 4, defaultReps: 10, restTime: 90 },
  lp: { id: 'lp', name: 'Lat Pulldown', target: 'Back', defaultSets: 3, defaultReps: 12, restTime: 75 },
  
  // UPPER BODY - SHOULDERS
  sp: { id: 'sp', name: 'Shoulder Press', target: 'Shoulders', defaultSets: 3, defaultReps: 10, restTime: 90 },
  ss: { id: 'ss', name: 'Shoulder Shrugs', target: 'Shoulders', defaultSets: 3, defaultReps: 15, restTime: 75 },
  
  // UPPER BODY - ARMS
  cgbp: { id: 'cgbp', name: 'Close Grip Bench Press', target: 'Arms', defaultSets: 3, defaultReps: 10, restTime: 90 },
  sc: { id: 'sc', name: 'Skull Crushers', target: 'Arms', defaultSets: 3, defaultReps: 12, restTime: 75 },
  cu: { id: 'cu', name: 'Chin-ups', target: 'Arms', defaultSets: 3, defaultReps: 8, restTime: 90 },
  bc: { id: 'bc', name: 'Bicep Curls', target: 'Arms', defaultSets: 3, defaultReps: 12, restTime: 60 },
  pgc: { id: 'pgc', name: 'Pronated Grip Curls', target: 'Arms', defaultSets: 3, defaultReps: 12, restTime: 60 },
  puwc: { id: 'puwc', name: 'Palm Up Wrist Curls', target: 'Arms', defaultSets: 3, defaultReps: 15, restTime: 60 },
  pdwc: { id: 'pdwc', name: 'Palm Down Wrist Curls', target: 'Arms', defaultSets: 3, defaultReps: 15, restTime: 60 },

  // CORE
  rt: { id: 'rt', name: 'Russian Twist', target: 'Core', defaultSets: 3, defaultReps: 20, restTime: 60 },
  sb: { id: 'sb', name: 'Side Bends', target: 'Core', defaultSets: 3, defaultReps: 15, restTime: 60 },
  wll: { id: 'wll', name: 'Weighted Leg Lifts', target: 'Core', defaultSets: 3, defaultReps: 15, restTime: 60 },
  kr: { id: 'kr', name: 'Knee Raises', target: 'Core', defaultSets: 3, defaultReps: 15, restTime: 60 }
};

// --- STRICT 3-DAY PROGRAM LOGIC ---
const PROGRAM_SPLIT = {
  1: ['sq', 'bp', 'pu', 'sp', 'cgbp', 'bc', 'puwc', 'wll'], 
  2: ['dl', 'ibp', 'wgr', 'ss', 'sc', 'pgc', 'pdwc', 'rt'], 
  3: ['rdl', 'bp', 'lp', 'sp', 'wpu', 'cu', 'bc', 'kr']     
};

// --- UTILITY: Robust LocalStorage Hook ---
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {}
      return valueToStore;
    });
  };
  return [storedValue, setValue];
}

// --- AUDIO UTILITY ---
const playBeep = (type = 'start') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'ready') osc.frequency.setValueAtTime(600, ctx.currentTime);
    else if (type === 'start') osc.frequency.setValueAtTime(880, ctx.currentTime); 
    else osc.frequency.setValueAtTime(440, ctx.currentTime); 
    
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {}
};

export default function App() {
  const [view, setView] = useLocalStorage('sb_view', 'setup'); 
  const [settings, setSettings] = useLocalStorage('sb_settings', { durationWeeks: 12, enableDeload: true });
  const [progress, setProgress] = useLocalStorage('sb_progress', { currentWeek: 1, currentDay: 1, history: [] });
  const [routine, setRoutine] = useLocalStorage('sb_routine', []);
  
  const [workoutState, setWorkoutState] = useLocalStorage('sb_workoutState', {
    isActive: false,
    activeExerciseIndex: 0,
    currentSet: 1,
    mode: 'idle', 
    timeLeft: 0,
    isPaused: false,
    currentWeight: 0,
    loggedReps: 0     
  });

  const generateRoutine = (dayNumber = progress.currentDay) => {
    const safeDay = ((dayNumber - 1) % 3) + 1;
    const exerciseIds = PROGRAM_SPLIT[safeDay];
    const dailyRoutine = exerciseIds.map(id => EXERCISE_DB[id]);
    
    setRoutine(dailyRoutine);
    return dailyRoutine;
  };

  const startNewProgram = () => {
    setProgress({ currentWeek: 1, currentDay: 1, history: [] });
    generateRoutine(1);
    setWorkoutState({ isActive: false, activeExerciseIndex: 0, currentSet: 1, mode: 'idle', timeLeft: 0, isPaused: false, currentWeight: 0, loggedReps: 0 });
    setView('dashboard');
  };

  const isDeloadWeek = settings.enableDeload && progress.currentWeek > 0 && progress.currentWeek % 4 === 0;

  const calculateTarget = (baseReps, baseSets) => {
    if (isDeloadWeek) {
      return { reps: baseReps, sets: Math.max(1, baseSets - 1) };
    }
    const cycleWeek = ((progress.currentWeek - 1) % 4) + 1; 
    return { reps: baseReps + (cycleWeek - 1), sets: baseSets };
  };

  useEffect(() => {
    let interval = null;
    if (!workoutState.isPaused) {
      if ((workoutState.mode === 'ready' || workoutState.mode === 'rest') && workoutState.timeLeft > 0) {
        interval = setInterval(() => {
          setWorkoutState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
        }, 1000);
      } else if (workoutState.mode === 'work') {
        interval = setInterval(() => {
          setWorkoutState(prev => ({ ...prev, timeLeft: prev.timeLeft + 1 }));
        }, 1000);
      }
    }
    return () => { if (interval) clearInterval(interval); };
  }, [workoutState.mode, workoutState.isPaused, workoutState.timeLeft]);

  useEffect(() => {
    if (workoutState.timeLeft === 0) {
      if (workoutState.mode === 'ready') {
        playBeep('start');
        setWorkoutState(prev => ({ ...prev, mode: 'work', timeLeft: 0 })); 
      } 
      else if (workoutState.mode === 'rest') {
        playBeep('ready');
        const currentEx = routine[workoutState.activeExerciseIndex];
        if (!currentEx) return;

        const { sets: targetSets } = calculateTarget(currentEx.defaultReps, currentEx.defaultSets);
        
        setWorkoutState(prev => {
          if (prev.currentSet < targetSets) {
            return { ...prev, mode: 'ready', timeLeft: 10, currentSet: prev.currentSet + 1, loggedReps: 0 };
          } else {
            if (prev.activeExerciseIndex + 1 < routine.length) {
              return { ...prev, mode: 'idle', activeExerciseIndex: prev.activeExerciseIndex + 1, currentSet: 1, loggedReps: 0 };
            } else {
              return { ...prev, mode: 'complete' }; 
            }
          }
        });
      }
    }
  }, [workoutState.timeLeft, workoutState.mode, routine, workoutState.activeExerciseIndex]);

  useEffect(() => {
    if (workoutState.mode === 'complete') {
      setProgress(prev => {
        let nextDay = prev.currentDay + 1;
        let nextWeek = prev.currentWeek;
        if (nextDay > 3) {
          nextDay = 1;
          nextWeek += 1;
        }
        generateRoutine(nextDay); 
        return { ...prev, currentWeek: nextWeek, currentDay: nextDay };
      });
      setView('summary');
      setWorkoutState(prev => ({ ...prev, mode: 'idle', isActive: false }));
    }
  }, [workoutState.mode]);

  const startExercise = () => {
    playBeep('ready');
    const currentEx = routine[workoutState.activeExerciseIndex];
    const { reps } = calculateTarget(currentEx.defaultReps, currentEx.defaultSets);
    setWorkoutState(prev => ({ ...prev, isActive: true, mode: 'ready', timeLeft: 10, isPaused: false, loggedReps: reps }));
  };

  const finishSet = () => {
    playBeep('end');
    const currentEx = routine[workoutState.activeExerciseIndex];
    const { reps: targetReps } = calculateTarget(currentEx.defaultReps, currentEx.defaultSets);
    
    let nextRestTime = currentEx.restTime;
    if (workoutState.loggedReps < targetReps) {
      nextRestTime += 30; 
    }

    const logEntry = {
      week: progress.currentWeek,
      day: progress.currentDay,
      exerciseId: currentEx.id,
      set: workoutState.currentSet,
      weight: workoutState.currentWeight,
      reps: workoutState.loggedReps,
      targetReps: targetReps,
      duration: workoutState.timeLeft 
    };
    setProgress(prev => ({ ...prev, history: [...prev.history, logEntry] }));
    setWorkoutState(prev => ({ ...prev, mode: 'rest', timeLeft: nextRestTime, isPaused: false }));
  };

  const SetupView = () => (
    <div className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-center mb-6 text-gray-900">
        <Dumbbell size={48} />
      </div>
      <h1 className="text-3xl font-black text-center text-gray-900 mb-2 uppercase tracking-tight">Hypertrophy Program</h1>
      <p className="text-gray-500 text-center mb-8 text-sm font-medium">Strict 3-Day Full Body Split</p>
      
      <div className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <h3 className="font-bold text-gray-800 text-sm mb-2">Program Structure:</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• 3 Days per week</li>
            <li>• 1 Lower, 6 Upper, 1 Core per session</li>
            <li>• Priority: Chest, Shoulders, Back</li>
          </ul>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2 uppercase">Program Length</label>
          <select 
            value={settings.durationWeeks}
            onChange={(e) => setSettings({...settings, durationWeeks: parseInt(e.target.value)})}
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-gray-900 outline-none"
          >
            <option value={8}>8 Weeks</option>
            <option value={12}>12 Weeks</option>
            <option value={16}>16 Weeks</option>
          </select>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div>
            <span className="block text-sm font-bold text-gray-800">Enable Deload Weeks</span>
            <span className="text-xs text-gray-500">Reduce sets every 4th week.</span>
          </div>
          <input 
            type="checkbox" 
            checked={settings.enableDeload}
            onChange={(e) => setSettings({...settings, enableDeload: e.target.checked})}
            className="w-6 h-6 accent-gray-900 rounded"
          />
        </div>

        <button 
          onClick={startNewProgram}
          className="w-full bg-gray-900 text-white font-black py-4 rounded-xl hover:bg-black transition flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          Start Program <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const DashboardView = () => {
    const currentSplitDay = ((progress.currentDay - 1) % 3) + 1;

    return (
      <div className="max-w-md mx-auto">
        <header className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Day {currentSplitDay}</h1>
            <p className="text-gray-500 font-medium flex items-center gap-1"><Calendar size={16}/> Week {progress.currentWeek} • 8 Exercises</p>
          </div>
          <button onClick={() => setView('setup')} className="p-2 text-gray-400 hover:text-gray-900 bg-white rounded-full shadow-sm border border-gray-100">
            <Settings size={20} />
          </button>
        </header>

        <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl mb-6 flex gap-3 shadow-sm">
          <TrendingUp className="text-blue-600 shrink-0 mt-1" size={20} />
          <div>
            <h4 className="font-bold text-blue-900 text-sm">Progression Guide</h4>
            <p className="text-xs text-blue-800 mt-1 leading-relaxed">
              <strong>When to increase weight:</strong> If you hit the top number of target reps for ALL sets of an exercise with good form, increase the weight by 2.5kg/5lbs next time.
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
          <div className="space-y-3">
            {routine.map((ex, idx) => {
              const { reps, sets } = calculateTarget(ex.defaultReps, ex.defaultSets);
              const isCompleted = workoutState.activeExerciseIndex > idx;
              const isCurrent = workoutState.activeExerciseIndex === idx && workoutState.isActive;
              
              return (
                <div key={idx} className={`flex items-center justify-between p-4 rounded-xl transition ${isCompleted ? 'bg-gray-100 opacity-50' : isCurrent ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    {isCompleted ? <CheckCircle className="text-gray-400" size={20} /> : <div className={`w-5 h-5 rounded-full border-2 ${isCurrent ? 'border-gray-600' : 'border-gray-300'}`}></div>}
                    <div>
                      <h3 className={`font-bold ${isCompleted ? 'line-through' : ''}`}>{ex.name}</h3>
                      <p className={`text-xs font-semibold uppercase tracking-wider ${isCurrent ? 'text-gray-400' : 'text-gray-500'}`}>{sets} sets × {reps} reps • {ex.restTime}s rest</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!workoutState.isActive && (
          <button 
            onClick={() => {
              setWorkoutState({ ...workoutState, isActive: true, activeExerciseIndex: 0, currentSet: 1, mode: 'idle', timeLeft: 0, isPaused: false });
              setView('workout');
            }}
            className="w-full bg-gray-900 text-white font-black py-4 rounded-xl hover:bg-black transition flex items-center justify-center gap-2 shadow-xl shadow-gray-200 uppercase tracking-widest"
          >
            <Play size={20} /> Start Session
          </button>
        )}
      </div>
    );
  };

  const WorkoutView = () => {
    const currentEx = routine[workoutState.activeExerciseIndex];
    if (!currentEx) return null; 
    
    const { reps: targetReps, sets: targetSets } = calculateTarget(currentEx.defaultReps, currentEx.defaultSets);
    const isRest = workoutState.mode === 'rest';
    const isReady = workoutState.mode === 'ready';
    const isWork = workoutState.mode === 'work';
    
    let bgColor = 'bg-white';
    if (isReady) bgColor = 'bg-yellow-50';
    if (isRest) bgColor = 'bg-red-50';
    if (isWork) bgColor = 'bg-gray-50';

    const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
      <div className={`max-w-md mx-auto p-6 rounded-3xl border border-gray-100 shadow-sm min-h-[85vh] flex flex-col transition-colors duration-500 ${bgColor}`}>
        
        <header className="flex justify-between items-center mb-6">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-white/50 px-3 py-1 rounded-full border border-gray-200">
            Exercise {workoutState.activeExerciseIndex + 1} / {routine.length}
          </span>
          <button onClick={() => setView('dashboard')} className="text-gray-500 hover:text-gray-900 bg-white/50 p-2 rounded-full border border-gray-200">
            <ArrowRight size={20} />
          </button>
        </header>

        <div className="flex-grow flex flex-col items-center justify-center text-center">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-1">{currentEx.name}</h2>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-8">Set {workoutState.currentSet} of {targetSets}</p>

          <div className="relative w-64 h-64 flex items-center justify-center mb-8 bg-white/60 rounded-full shadow-inner border border-gray-100">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-200/50" />
              {workoutState.mode !== 'idle' && (
                <circle 
                  cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="8" fill="transparent" strokeLinecap="round"
                  strokeDasharray="753.6" 
                  strokeDashoffset={isWork ? 0 : (753.6 - (753.6 * (workoutState.timeLeft / (isRest ? currentEx.restTime : 10))))}
                  className={`transition-all duration-1000 linear ${isRest ? 'text-red-500' : isWork ? 'text-gray-900 opacity-20' : 'text-yellow-500'}`} 
                />
              )}
            </svg>
            
            <div className="z-10 text-center flex flex-col items-center justify-center">
              {workoutState.mode === 'idle' && (
                <>
                  <Dumbbell className="text-gray-300 mb-2" size={32} />
                  <div className="text-xl font-bold text-gray-400">Ready?</div>
                </>
              )}
              {isReady && (
                <>
                  <div className="text-xs font-bold text-yellow-600 mb-1 uppercase tracking-widest">Get Ready</div>
                  <div className="text-7xl font-black text-gray-800">{workoutState.timeLeft}</div>
                </>
              )}
              {isWork && (
                <>
                  <div className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Target Reps</div>
                  <div className="text-7xl font-black text-gray-900 leading-none">{targetReps}</div>
                  <div className="text-sm font-bold text-gray-400 mt-3 flex items-center justify-center gap-1">
                    <Clock size={16} /> {formatTime(workoutState.timeLeft)}
                  </div>
                </>
              )}
              {isRest && (
                <>
                  <div className="text-xs font-bold text-red-600 mb-1 uppercase tracking-widest">Rest</div>
                  <div className="text-6xl font-black text-gray-900">{formatTime(workoutState.timeLeft)}</div>
                </>
              )}
            </div>
          </div>

          <div className="w-full space-y-4">
            {workoutState.mode === 'idle' && (
              <button onClick={startExercise} className="w-full bg-gray-900 text-white font-black py-4 rounded-xl hover:bg-black flex justify-center items-center gap-2 shadow-xl shadow-gray-200 uppercase tracking-widest">
                <Play size={20} /> Start Exercise
              </button>
            )}

            {isWork && (
              <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-5 shadow-sm">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Weight</label>
                    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <button onClick={() => setWorkoutState(p => ({...p, currentWeight: Math.max(0, p.currentWeight - 2.5)}))} className="w-12 h-12 text-gray-500 font-bold text-2xl hover:bg-gray-200 flex items-center justify-center border-r border-gray-200">-</button>
                      <input 
                        type="number" 
                        inputMode="decimal"
                        className="w-full text-center font-black text-xl text-gray-900 outline-none bg-transparent"
                        value={workoutState.currentWeight || ''}
                        onChange={(e) => setWorkoutState({...workoutState, currentWeight: Number(e.target.value)})}
                        placeholder="0"
                      />
                      <button onClick={() => setWorkoutState(p => ({...p, currentWeight: p.currentWeight + 2.5}))} className="w-12 h-12 text-gray-500 font-bold text-2xl hover:bg-gray-200 flex items-center justify-center border-l border-gray-200">+</button>
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Actual Reps</label>
                    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <button onClick={() => setWorkoutState(p => ({...p, loggedReps: Math.max(0, p.loggedReps - 1)}))} className="w-12 h-12 text-gray-500 font-bold text-2xl hover:bg-gray-200 flex items-center justify-center border-r border-gray-200">-</button>
                      <input 
                        type="number" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="w-full text-center font-black text-xl text-gray-900 outline-none bg-transparent"
                        value={workoutState.loggedReps || ''}
                        onChange={(e) => setWorkoutState({...workoutState, loggedReps: Number(e.target.value)})}
                      />
                      <button onClick={() => setWorkoutState(p => ({...p, loggedReps: p.loggedReps + 1}))} className="w-12 h-12 text-gray-500 font-bold text-2xl hover:bg-gray-200 flex items-center justify-center border-l border-gray-200">+</button>
                    </div>
                  </div>
                </div>

                <button onClick={finishSet} className="w-full bg-gray-900 text-white font-black py-4 rounded-xl hover:bg-black flex justify-center items-center gap-2 shadow-lg shadow-gray-200 uppercase tracking-widest">
                  <Save size={20} /> Log & Rest
                </button>
              </div>
            )}

            {(isReady || isRest) && (
              <div className="flex gap-4">
                <button 
                  onClick={() => setWorkoutState(p => ({ ...p, isPaused: !p.isPaused }))} 
                  className="flex-1 bg-white border border-gray-200 text-gray-900 font-bold py-4 rounded-xl shadow-sm hover:bg-gray-50 flex justify-center items-center gap-2 uppercase tracking-wider text-sm"
                >
                  {workoutState.isPaused ? <Play size={18} /> : <Pause size={18} />}
                  {workoutState.isPaused ? 'Resume' : 'Pause'}
                </button>
                <button 
                  onClick={() => setWorkoutState(prev => ({ ...prev, timeLeft: 0 }))} 
                  className="flex-1 bg-gray-900 text-white font-bold py-4 rounded-xl shadow-sm hover:bg-black flex justify-center items-center gap-2 uppercase tracking-wider text-sm"
                >
                  <SkipForward size={18} /> Skip
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    );
  };

  const SummaryView = () => (
    <div className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
      <div className="flex items-center justify-center mb-6 text-gray-900">
        <CheckCircle size={64} />
      </div>
      <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Session Complete</h1>
      <p className="text-gray-500 mb-8 font-medium">Data logged. Eat, rest, and recover.</p>
      
      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-8 text-left">
        <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2 uppercase tracking-widest text-sm"><Activity size={18}/> Next Session</h3>
        <p className="text-gray-600 font-medium mb-3">Week {progress.currentWeek}, Day {progress.currentDay}</p>
        <p className="text-xs text-gray-500 bg-white p-3 rounded-lg border border-gray-100 leading-relaxed">
          Your program will automatically advance to your next full-body split to ensure balanced muscle growth.
        </p>
      </div>

      <button 
        onClick={() => setView('dashboard')}
        className="w-full bg-gray-900 text-white font-black py-4 rounded-xl hover:bg-black flex justify-center items-center gap-2 uppercase tracking-widest shadow-xl shadow-gray-200"
      >
        Return to Dashboard
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100/50 p-4 font-sans flex items-center justify-center text-gray-900 selection:bg-gray-200">
      <div className="w-full">
        {view === 'setup' && <SetupView />}
        {view === 'dashboard' && <DashboardView />}
        {view === 'workout' && <WorkoutView />}
        {view === 'summary' && <SummaryView />}
      </div>
    </div>
  );
}