export interface TranscriptItem {
  id: string;
  role: 'user' | 'examiner';
  text: string;
  timestamp: Date;
  isFinal?: boolean;
}

export enum SessionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR',
  FINISHED = 'FINISHED'
}

export interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  color?: string;
}
