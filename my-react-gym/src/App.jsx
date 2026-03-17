import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, CheckCircle, Settings, Dumbbell, Calendar, ArrowRight, RotateCcw, AlertTriangle, Activity, Save, Clock } from 'lucide-react';

// --- DATA: Available Exercises Based on Equipment ---
const EXERCISE_DB = [
  { id: 'e1', name: 'Flat Bench Press', equipment: 'Flat Bench, Bars', target: 'Chest', defaultSets: 3, defaultReps: 8, restTime: 90 },
  { id: 'e2', name: 'Incline Dumbbell Press', equipment: 'Incline Bench, Dumbbells', target: 'Chest', defaultSets: 3, defaultReps: 10, restTime: 90 },
  { id: 'e3', name: 'Lat Pulldown', equipment: 'Lat Pull Machine', target: 'Back', defaultSets: 3, defaultReps: 10, restTime: 90 },
  { id: 'e4', name: 'Pull-ups', equipment: 'Pull-up Bar', target: 'Back', defaultSets: 3, defaultReps: 8, restTime: 120 },
  { id: 'e5', name: 'Dumbbell Rows', equipment: 'Flat Bench, Dumbbells', target: 'Back', defaultSets: 3, defaultReps: 12, restTime: 90 },
  { id: 'e6', name: 'Dumbbell Shoulder Press', equipment: 'Dumbbells', target: 'Shoulders', defaultSets: 3, defaultReps: 10, restTime: 90 },
  { id: 'e7', name: 'Lateral Raises', equipment: 'Dumbbells', target: 'Shoulders', defaultSets: 3, defaultReps: 15, restTime: 60 },
  { id: 'e8', name: 'Bicep Curls', equipment: 'Dumbbells', target: 'Arms', defaultSets: 3, defaultReps: 12, restTime: 60 },
  { id: 'e9', name: 'Tricep Extensions', equipment: 'Dumbbells', target: 'Arms', defaultSets: 3, defaultReps: 12, restTime: 60 },
];

// --- UTILITY: Robust LocalStorage Hook ---
// FIXED: This hook now perfectly handles functional state updates (e.g., prev => prev + 1).
// This is critical so our 1-second interval timer always pulls the most accurate, up-to-date state.
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error("Error reading localStorage", error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    // By placing the logic INSIDE the setStoredValue callback, we guarantee access to the absolute latest 'prev' state
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error("Error setting localStorage", error);
      }
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
  } catch (e) {
    console.log("Audio blocked or not supported.");
  }
};

export default function App() {
  const [view, setView] = useLocalStorage('sb_view', 'setup'); 
  const [settings, setSettings] = useLocalStorage('sb_settings', { daysPerWeek: 3, durationWeeks: 8, enableDeload: true });
  const [progress, setProgress] = useLocalStorage('sb_progress', { currentWeek: 1, currentDay: 1, history: [] });
  const [routine, setRoutine] = useLocalStorage('sb_routine', []);
  
  const [workoutState, setWorkoutState] = useLocalStorage('sb_workoutState', {
    isActive: false,
    activeExerciseIndex: 0,
    currentSet: 1,
    mode: 'idle', // 'idle', 'ready', 'work', 'rest', 'complete'
    timeLeft: 0,
    isPaused: false,
    currentWeight: 0,
    loggedReps: 0     
  });

  const generateRoutine = (dayNumber = progress.currentDay) => {
    const chestEx = EXERCISE_DB.filter(e => e.target === 'Chest');
    const backEx = EXERCISE_DB.filter(e => e.target === 'Back');
    const shoulderEx = EXERCISE_DB.filter(e => e.target === 'Shoulders');
    const armEx = EXERCISE_DB.filter(e => e.target === 'Arms');

    const getRotated = (list) => list[(dayNumber - 1) % list.length];

    const dailyRoutine = [
      getRotated(chestEx),
      getRotated(backEx),
      getRotated(shoulderEx),
      getRotated(armEx),
    ];
    
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

  // =========================================================================
  // --- RESTRUCTURED LOGIC: Timer Management & Modes ---
  // =========================================================================
  // Clarification on how timeLeft works in each mode:
  // 1. 'idle' : Timer is off (0). Waiting for the user to initiate.
  // 2. 'ready': Counts DOWN from 10 to 0. Gives you time to grab weights.
  // 3. 'work' : Counts UP from 0. Acts as a stopwatch so you know how long the set took.
  // 4. 'rest' : Counts DOWN from your target rest time to 0. Time to recover.
  
  // TIMER TICKER EFFECT: Strictly responsible for adding/subtracting 1 second.
  useEffect(() => {
    let interval = null;
    if (!workoutState.isPaused) {
      if ((workoutState.mode === 'ready' || workoutState.mode === 'rest') && workoutState.timeLeft > 0) {
        // Count DOWN for Rest and Ready modes
        interval = setInterval(() => {
          setWorkoutState(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
        }, 1000);
      } else if (workoutState.mode === 'work') {
        // Count UP for Work mode (Stopwatch functionality)
        interval = setInterval(() => {
          setWorkoutState(prev => ({ ...prev, timeLeft: prev.timeLeft + 1 }));
        }, 1000);
      }
    }
    return () => { if (interval) clearInterval(interval); };
  }, [workoutState.mode, workoutState.isPaused, workoutState.timeLeft]);

  // TIMER TRANSITION EFFECT: Strictly responsible for safely moving between phases when time runs out.
  useEffect(() => {
    if (workoutState.timeLeft === 0) {
      if (workoutState.mode === 'ready') {
        playBeep('start');
        setWorkoutState(prev => ({ ...prev, mode: 'work', timeLeft: 0 })); // Start stopwatch from 0
      } 
      else if (workoutState.mode === 'rest') {
        playBeep('ready');
        
        const currentEx = routine[workoutState.activeExerciseIndex];
        if (!currentEx) return;

        const { sets: targetSets } = calculateTarget(currentEx.defaultReps, currentEx.defaultSets);
        
        setWorkoutState(prev => {
          if (prev.currentSet < targetSets) {
            // Move to next set
            return { ...prev, mode: 'ready', timeLeft: 10, currentSet: prev.currentSet + 1, loggedReps: 0 };
          } else {
            // Move to next exercise, or finish
            if (prev.activeExerciseIndex + 1 < routine.length) {
              return { ...prev, mode: 'idle', activeExerciseIndex: prev.activeExerciseIndex + 1, currentSet: 1, loggedReps: 0 };
            } else {
              return { ...prev, mode: 'complete' }; // Triggers the completion effect below
            }
          }
        });
      }
    }
  }, [workoutState.timeLeft, workoutState.mode, routine, workoutState.activeExerciseIndex]);

  // WORKOUT COMPLETION EFFECT: Handles advancing the program when all exercises are done.
  useEffect(() => {
    if (workoutState.mode === 'complete') {
      setProgress(prev => {
        let nextDay = prev.currentDay + 1;
        let nextWeek = prev.currentWeek;
        if (nextDay > settings.daysPerWeek) {
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
  // =========================================================================

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
    
    // Adaptive Logic: If user struggled (missed reps), give slightly more rest
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
      duration: workoutState.timeLeft // Save how long the set took!
    };
    setProgress(prev => ({ ...prev, history: [...prev.history, logEntry] }));

    setWorkoutState(prev => ({ ...prev, mode: 'rest', timeLeft: nextRestTime, isPaused: false }));
  };

  // --- UI COMPONENTS ---

  const SetupView = () => (
    <div className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-center mb-6 text-blue-600">
        <Dumbbell size={48} />
      </div>
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Build Your Plan</h1>
      <p className="text-gray-500 text-center mb-8">Customized for clear, steady muscle growth.</p>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Days per week (1-6)</label>
          <input 
            type="range" min="1" max="6" value={settings.daysPerWeek} 
            onChange={(e) => setSettings({...settings, daysPerWeek: parseInt(e.target.value)})}
            className="w-full accent-blue-600"
          />
          <div className="text-center text-xl font-bold text-blue-600 mt-2">{settings.daysPerWeek} Days</div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Program Length (Weeks)</label>
          <select 
            value={settings.durationWeeks}
            onChange={(e) => setSettings({...settings, durationWeeks: parseInt(e.target.value)})}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value={4}>4 Weeks</option>
            <option value={8}>8 Weeks</option>
            <option value={12}>12 Weeks</option>
          </select>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <span className="block text-sm font-semibold text-gray-700">Enable Deload Weeks</span>
            <span className="text-xs text-gray-500">Reduce intensity every 4th week to recover.</span>
          </div>
          <input 
            type="checkbox" 
            checked={settings.enableDeload}
            onChange={(e) => setSettings({...settings, enableDeload: e.target.checked})}
            className="w-6 h-6 accent-blue-600 rounded"
          />
        </div>

        <button 
          onClick={startNewProgram}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
        >
          Create My Routine <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const DashboardView = () => (
    <div className="max-w-md mx-auto">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 flex items-center gap-1"><Calendar size={16}/> Week {progress.currentWeek} • Day {progress.currentDay}</p>
        </div>
        <button onClick={() => setView('setup')} className="p-2 text-gray-400 hover:text-gray-800 bg-white rounded-full shadow-sm">
          <Settings size={20} />
        </button>
      </header>

      {isDeloadWeek && (
        <div className="bg-purple-100 text-purple-800 p-4 rounded-2xl mb-6 flex items-start gap-3 border border-purple-200">
          <Activity className="shrink-0 mt-1" size={20} />
          <div>
            <h4 className="font-bold">Deload Week</h4>
            <p className="text-sm">Volume is reduced this week to help your muscles recover and grow.</p>
          </div>
        </div>
      )}

      {workoutState.isActive && (
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded-2xl mb-6 flex items-center justify-between border border-yellow-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} />
            <span className="font-bold text-sm">Workout in progress</span>
          </div>
          <button 
            onClick={() => setView('workout')}
            className="bg-yellow-800 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-yellow-900"
          >
            Resume
          </button>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Today's Plan</h2>
        <div className="space-y-3">
          {routine.map((ex, idx) => {
            const { reps, sets } = calculateTarget(ex.defaultReps, ex.defaultSets);
            const isCompleted = workoutState.activeExerciseIndex > idx;
            const isCurrent = workoutState.activeExerciseIndex === idx && workoutState.isActive;
            
            return (
              <div key={idx} className={`flex items-center justify-between p-4 rounded-xl transition ${isCompleted ? 'bg-green-50 opacity-60' : isCurrent ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  {isCompleted ? <CheckCircle className="text-green-500" size={20} /> : <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>}
                  <div>
                    <h3 className={`font-bold ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{ex.name}</h3>
                    <p className="text-sm text-gray-500">{sets} sets × {reps} reps</p>
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
          className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-200"
        >
          <Play size={20} /> Start Workout
        </button>
      )}
    </div>
  );

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
    if (isWork) bgColor = 'bg-green-50';

    const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
      <div className={`max-w-md mx-auto p-6 rounded-3xl border border-gray-100 shadow-sm min-h-[85vh] flex flex-col transition-colors duration-500 ${bgColor}`}>
        
        <header className="flex justify-between items-center mb-6">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-white/50 px-3 py-1 rounded-full">
            Exercise {workoutState.activeExerciseIndex + 1} of {routine.length}
          </span>
          <button onClick={() => setView('dashboard')} className="text-gray-500 hover:text-gray-800 bg-white/50 p-2 rounded-full">
            <ArrowRight size={20} />
          </button>
        </header>

        <div className="flex-grow flex flex-col items-center justify-center text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-1">{currentEx.name}</h2>
          <p className="text-lg text-gray-500 mb-8 font-medium">Set {workoutState.currentSet} of {targetSets}</p>

          {/* VISUAL TIMER & STOPWATCH */}
          <div className="relative w-64 h-64 flex items-center justify-center mb-8 bg-white/40 rounded-full shadow-inner">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-200/50" />
              {workoutState.mode !== 'idle' && (
                <circle 
                  cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="8" fill="transparent" strokeLinecap="round"
                  strokeDasharray="753.6" 
                  strokeDashoffset={
                    isWork ? 0 : (753.6 - (753.6 * (workoutState.timeLeft / (isRest ? currentEx.restTime : 10))))
                  }
                  className={`transition-all duration-1000 linear ${isRest ? 'text-red-500' : isWork ? 'text-green-500 opacity-20' : 'text-yellow-500'}`} 
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
                  <div className="text-xs font-bold text-green-600 mb-1 uppercase tracking-widest">Target Reps</div>
                  <div className="text-7xl font-black text-gray-800 leading-none">{targetReps}</div>
                  <div className="text-sm font-semibold text-gray-500 mt-3 flex items-center justify-center gap-1">
                    <Clock size={16} /> {formatTime(workoutState.timeLeft)}
                  </div>
                </>
              )}
              {isRest && (
                <>
                  <div className="text-xs font-bold text-red-600 mb-1 uppercase tracking-widest">Rest</div>
                  <div className="text-6xl font-black text-gray-800">{formatTime(workoutState.timeLeft)}</div>
                  {workoutState.loggedReps < targetReps && (
                    <div className="text-xs font-semibold text-red-500 mt-2 max-w-[150px] leading-tight">
                      Rest increased to help you recover!
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* DYNAMIC CONTROLS */}
          <div className="w-full space-y-4">
            {workoutState.mode === 'idle' && (
              <button onClick={startExercise} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2 shadow-lg shadow-blue-200">
                <Play size={20} /> Start Exercise
              </button>
            )}

            {isWork && (
              <div className="bg-white/60 p-4 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Weight (kg/lbs)</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl text-center font-bold text-lg outline-none focus:ring-2 focus:ring-green-500"
                      value={workoutState.currentWeight || ''}
                      onChange={(e) => setWorkoutState({...workoutState, currentWeight: Number(e.target.value)})}
                      placeholder="0"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Actual Reps</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl text-center font-bold text-lg outline-none focus:ring-2 focus:ring-green-500"
                      value={workoutState.loggedReps || ''}
                      onChange={(e) => setWorkoutState({...workoutState, loggedReps: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <button onClick={finishSet} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 flex justify-center items-center gap-2 shadow-lg shadow-green-200">
                  <Save size={20} /> Log & Rest
                </button>
              </div>
            )}

            {(isReady || isRest) && (
              <div className="flex gap-4">
                <button 
                  onClick={() => setWorkoutState(p => ({ ...p, isPaused: !p.isPaused }))} 
                  className="flex-1 bg-white border border-gray-200 text-gray-800 font-bold py-4 rounded-xl shadow-sm hover:bg-gray-50 flex justify-center items-center gap-2"
                >
                  {workoutState.isPaused ? <Play size={20} /> : <Pause size={20} />}
                  {workoutState.isPaused ? 'Resume' : 'Pause'}
                </button>
                <button 
                  // Instantly setting time to 0 guarantees the Transition Effect gracefully catches it
                  onClick={() => setWorkoutState(prev => ({ ...prev, timeLeft: 0 }))} 
                  className="flex-1 bg-gray-800 text-white font-bold py-4 rounded-xl shadow-sm hover:bg-gray-900 flex justify-center items-center gap-2"
                >
                  <SkipForward size={20} /> Skip Timer
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
      <div className="flex items-center justify-center mb-6 text-green-500">
        <CheckCircle size={64} />
      </div>
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Workout Complete!</h1>
      <p className="text-gray-500 mb-8 text-sm">Your progress has been saved automatically. Rest up and recover well.</p>
      
      <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 mb-8 text-left">
        <h3 className="font-bold text-blue-900 mb-1 flex items-center gap-2"><Activity size={18}/> Next Session</h3>
        <p className="text-blue-700 text-sm mb-3">Week {progress.currentWeek}, Day {progress.currentDay}</p>
        <p className="text-xs text-blue-600 bg-blue-100 p-2 rounded-lg">
          The app will automatically rotate your exercises to ensure balanced muscle development next time you train.
        </p>
      </div>

      <button 
        onClick={() => setView('dashboard')}
        className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black flex justify-center items-center gap-2"
      >
        Return to Dashboard
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 font-sans flex items-center justify-center text-gray-900 selection:bg-blue-200">
      <div className="w-full">
        {view === 'setup' && <SetupView />}
        {view === 'dashboard' && <DashboardView />}
        {view === 'workout' && <WorkoutView />}
        {view === 'summary' && <SummaryView />}
      </div>
    </div>
  );
}