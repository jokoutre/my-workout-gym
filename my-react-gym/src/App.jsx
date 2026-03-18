import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, CheckCircle, Settings, Dumbbell, Calendar, ArrowRight, Activity, Save, Clock, AlertTriangle } from 'lucide-react';

// --- DATA: Expanded Exercise Database ---
const EXERCISE_DB = [
  // Chest
  { id: 'e1', name: 'Flat Bench Press', equipment: 'Flat Bench, Bars', target: 'Chest', defaultSets: 3, defaultReps: 8, restTime: 90 },
  { id: 'e2', name: 'Incline Dumbbell Press', equipment: 'Incline Bench, Dumbbells', target: 'Chest', defaultSets: 3, defaultReps: 10, restTime: 90 },
  
  // Back
  { id: 'e3', name: 'Lat Pulldown', equipment: 'Lat Pull Machine', target: 'Back', defaultSets: 3, defaultReps: 10, restTime: 90 },
  { id: 'e4', name: 'Pull-ups', equipment: 'Pull-up Bar', target: 'Back', defaultSets: 3, defaultReps: 8, restTime: 120 },
  { id: 'e5', name: 'Dumbbell Rows', equipment: 'Flat Bench, Dumbbells', target: 'Back', defaultSets: 3, defaultReps: 12, restTime: 90 },
  { id: 'e10', name: 'Wide Grip Row', equipment: 'Barbell/Machine', target: 'Back', defaultSets: 3, defaultReps: 10, restTime: 90 },
  { id: 'e11', name: 'Supinated Grip Row', equipment: 'Barbell/Dumbbells', target: 'Back', defaultSets: 3, defaultReps: 10, restTime: 90 },
  
  // Shoulders
  { id: 'e6', name: 'Dumbbell Shoulder Press', equipment: 'Dumbbells', target: 'Shoulders', defaultSets: 3, defaultReps: 10, restTime: 90 },
  { id: 'e7', name: 'Lateral Raises', equipment: 'Dumbbells', target: 'Shoulders', defaultSets: 3, defaultReps: 15, restTime: 60 },
  { id: 'e15', name: 'Behind the Neck Press', equipment: 'Barbell', target: 'Shoulders', defaultSets: 3, defaultReps: 10, restTime: 90 },
  { id: 'e16', name: 'High Pull', equipment: 'Barbell', target: 'Shoulders', defaultSets: 3, defaultReps: 8, restTime: 90 },
  { id: 'e17', name: 'Shoulder Shrugs', equipment: 'Barbell/Dumbbells', target: 'Shoulders', defaultSets: 3, defaultReps: 15, restTime: 60 },
  
  // Arms & Forearms
  { id: 'e8', name: 'Bicep Curls', equipment: 'Dumbbells', target: 'Arms', defaultSets: 3, defaultReps: 12, restTime: 60 },
  { id: 'e9', name: 'Tricep Extensions', equipment: 'Dumbbells', target: 'Arms', defaultSets: 3, defaultReps: 12, restTime: 60 },
  { id: 'e12', name: 'Skull Crushers', equipment: 'EZ Bar/Dumbbells', target: 'Arms', defaultSets: 3, defaultReps: 12, restTime: 60 },
  { id: 'e14', name: 'Reverse Grip Curls', equipment: 'Barbell/Dumbbells', target: 'Arms', defaultSets: 3, defaultReps: 12, restTime: 60 },
  { id: 'e20', name: 'Palms Down Wrist Curls', equipment: 'Barbell/Dumbbells', target: 'Arms', defaultSets: 3, defaultReps: 15, restTime: 60 },
  
  // Legs
  { id: 'e18', name: 'Squat', equipment: 'Barbell, Squat Rack', target: 'Legs', defaultSets: 4, defaultReps: 8, restTime: 120 },
  { id: 'e19', name: 'Romanian Deadlift (RDL)', equipment: 'Barbell/Dumbbells', target: 'Legs', defaultSets: 3, defaultReps: 10, restTime: 90 }
];

// --- UTILITY: Robust LocalStorage Hook ---
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
    mode: 'idle', 
    timeLeft: 0,
    isPaused: false,
    currentWeight: 0,
    loggedReps: 0     
  });

  const generateRoutine = (dayNumber = progress.currentDay) => {
    const legEx = EXERCISE_DB.filter(e => e.target === 'Legs');
    const chestEx = EXERCISE_DB.filter(e => e.target === 'Chest');
    const backEx = EXERCISE_DB.filter(e => e.target === 'Back');
    const shoulderEx = EXERCISE_DB.filter(e => e.target === 'Shoulders');
    const armEx = EXERCISE_DB.filter(e => e.target === 'Arms');

    // Safe rotation helper
    const getRotated = (list, offset = 0) => {
      if (!list || list.length === 0) return null;
      return list[(dayNumber - 1 + offset) % list.length];
    };

    // New 6-Exercise Structure
    const dailyRoutine = [
      getRotated(legEx),         // 1. Legs
      getRotated(chestEx),       // 2. Chest
      getRotated(backEx),        // 3. Back
      getRotated(shoulderEx),    // 4. Shoulders
      getRotated(armEx, 0),      // 5. Arms (First exercise)
      getRotated(armEx, 1),      // 6. Arms (Second exercise, offset by 1)
    ].filter(Boolean); // Removes any nulls just in case
    
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
            <span className="text-xs text-gray-500">Reduce intensity every 4th week.</span>
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

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Today's Plan (6 Exercises)</h2>
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

          <div className="relative w-64 h-64 flex items-center justify-center mb-8 bg-white/40 rounded-full shadow-inner">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-200/50" />
              {workoutState.mode !== 'idle' && (
                <circle 
                  cx="128" cy="128" r="120" stroke="currentColor" strokeWidth="8" fill="transparent" strokeLinecap="round"
                  strokeDasharray="753.6" 
                  strokeDashoffset={isWork ? 0 : (753.6 - (753.6 * (workoutState.timeLeft / (isRest ? currentEx.restTime : 10))))}
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
                </>
              )}
            </div>
          </div>

          <div className="w-full space-y-4">
            {workoutState.mode === 'idle' && (
              <button onClick={startExercise} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2 shadow-lg shadow-blue-200">
                <Play size={20} /> Start Exercise
              </button>
            )}

            {isWork && (
              <div className="bg-white/60 p-4 rounded-2xl border border-gray-200 space-y-5 shadow-sm">
                
                {/* NEW UX DESIGN: Custom Buttons for Weight and Reps */}
                <div className="flex gap-4">
                  {/* Weight Input Box */}
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Weight</label>
                    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <button onClick={() => setWorkoutState(p => ({...p, currentWeight: Math.max(0, p.currentWeight - 2.5)}))} className="w-12 h-12 bg-gray-50 text-gray-600 font-bold text-2xl hover:bg-gray-100 flex items-center justify-center border-r border-gray-200 active:bg-gray-200">-</button>
                      <input 
                        type="number" 
                        inputMode="decimal"
                        className="w-full text-center font-bold text-lg outline-none bg-transparent"
                        value={workoutState.currentWeight || ''}
                        onChange={(e) => setWorkoutState({...workoutState, currentWeight: Number(e.target.value)})}
                        placeholder="0"
                      />
                      <button onClick={() => setWorkoutState(p => ({...p, currentWeight: p.currentWeight + 2.5}))} className="w-12 h-12 bg-gray-50 text-gray-600 font-bold text-2xl hover:bg-gray-100 flex items-center justify-center border-l border-gray-200 active:bg-gray-200">+</button>
                    </div>
                  </div>

                  {/* Reps Input Box */}
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Reps</label>
                    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <button onClick={() => setWorkoutState(p => ({...p, loggedReps: Math.max(0, p.loggedReps - 1)}))} className="w-12 h-12 bg-gray-50 text-gray-600 font-bold text-2xl hover:bg-gray-100 flex items-center justify-center border-r border-gray-200 active:bg-gray-200">-</button>
                      <input 
                        type="number" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="w-full text-center font-bold text-lg outline-none bg-transparent"
                        value={workoutState.loggedReps || ''}
                        onChange={(e) => setWorkoutState({...workoutState, loggedReps: Number(e.target.value)})}
                      />
                      <button onClick={() => setWorkoutState(p => ({...p, loggedReps: p.loggedReps + 1}))} className="w-12 h-12 bg-gray-50 text-gray-600 font-bold text-2xl hover:bg-gray-100 flex items-center justify-center border-l border-gray-200 active:bg-gray-200">+</button>
                    </div>
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