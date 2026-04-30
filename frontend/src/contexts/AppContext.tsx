import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { KnowledgeTreeFile } from '../types';

interface AppState {
  currentTree: KnowledgeTreeFile | null;
  trees: string[]; // list of tree ids
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'SET_TREE'; payload: KnowledgeTreeFile }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_TREE' };

const initialState: AppState = {
  currentTree: null,
  trees: [],
  loading: false,
  error: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_TREE':
      return { ...state, currentTree: action.payload, error: null };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_TREE':
      return { ...state, currentTree: null };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => {} });

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  return useContext(AppContext);
}
