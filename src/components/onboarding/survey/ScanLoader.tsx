import React, { useState } from 'react';
import { View } from 'react-native';

import { SCAN_TASK_COUNT } from '@/components/onboarding/quiz-pages';
import { TaskRow, useTaskProgress } from '@/components/onboarding/quiz-kit';

/** Mid-quiz scan: 3 bars inside about five seconds, then it moves on by itself. */
const SCAN_FILL_MS = 1300;
const SCAN_GAP_MS = 220;
const SCAN_TAIL_MS = 600;

export function LoaderPage({
  tasks,
  active,
  onDone,
}: {
  tasks: string[];
  active: boolean;
  onDone: () => void;
}): React.ReactElement {
  // Latched, so sliding back and forth does not replay the bars from zero.
  const [started, setStarted] = useState(active);
  if (active && !started) setStarted(true);

  return started ? <LoaderBars tasks={tasks} onDone={onDone} /> : <View style={{ flex: 1, minHeight: 160 }} />;
}

function LoaderBars({ tasks, onDone }: { tasks: string[]; onDone: () => void }): React.ReactElement {
  const progress = useTaskProgress({
    count: SCAN_TASK_COUNT,
    fillMs: SCAN_FILL_MS,
    gapMs: SCAN_GAP_MS,
    tailMs: SCAN_TAIL_MS,
    onDone,
  });

  return (
    <View style={{ gap: 18, paddingTop: 8 }}>
      {tasks.map((task, taskIndex) => (
        <TaskRow key={task} label={task} progress={progress} index={taskIndex} />
      ))}
    </View>
  );
}
