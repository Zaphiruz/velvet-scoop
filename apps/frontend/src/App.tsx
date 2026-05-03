import { useMemo } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { makeStore, type AppStore } from './store';
import { AppRoutes } from './routes';
import { BottomNav } from './components/BottomNav';

export interface AppProps {
  store?: AppStore;
  memoryRouter?: boolean;
  initialEntries?: string[];
}

export function App({ store, memoryRouter, initialEntries }: AppProps = {}) {
  const s = useMemo(() => store ?? makeStore(), [store]);
  const Router = memoryRouter ? MemoryRouter : BrowserRouter;
  const routerProps = memoryRouter && initialEntries ? { initialEntries } : {};

  return (
    <Provider store={s}>
      <Router {...routerProps}>
        <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
          <header className="mx-auto w-full max-w-screen-sm px-4 pt-4 pb-2">
            <h1 className="text-xl font-semibold tracking-tight">Velvet Scoop</h1>
          </header>
          <main className="mx-auto w-full max-w-screen-sm flex-1">
            <AppRoutes />
          </main>
          <BottomNav />
        </div>
      </Router>
    </Provider>
  );
}
